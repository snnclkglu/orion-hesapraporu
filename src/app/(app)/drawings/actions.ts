"use server";

// Teknik Resimler — sunucu eylemleri.
//
// AYRIŞTIRMA HER ZAMAN SUNUCUDA yapılır. İstemci yalnız yol, boyut ve imza
// gönderir; adı çözen, rolü belirleyen ve kodu bulan `src/lib/drawings/`
// çekirdeğidir. İstemci de aynı saf işlevleri çağırır ama YALNIZ ÖN İNCELEME
// GÖSTERMEK için — tek doğruluk kaynağı sunucudur ve kural değiştiğinde eski
// bir sekmeden gelen kayıt yanlış ayrıştırılmış olmaz.

// `randomUUID` AÇIKÇA içe aktarılır: `globalThis.crypto` yalnız Node 19+'da
// kararlıdır ve dağıtımın Node sürümüne bağlı sessiz bir kırılganlık istemiyoruz.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { resolveItemNo } from "@/lib/job-items";
import { parseFile } from "@/lib/drawings/file-name";
import { folderNameFromContents, parseFolderName } from "@/lib/drawings/folder-name";
import { reconcile, RECONCILER_VERSION, type PackageSnapshot } from "@/lib/drawings/reconcile";
import type { BomRow, ParsedFile } from "@/lib/drawings/types";
import {
  ackFindingSchema,
  bindAliasSchema,
  createPackageSchema,
  finalizeUploadSchema,
  packageIdSchema,
  remapItemSchema,
  type AckFindingInput,
  type BindAliasInput,
  type CreatePackageInput,
  type DrawingActionResult,
  type FinalizeUploadInput,
  type RemapItemInput,
} from "./schema";

const BUCKET = "drawings";

/** Yazma yetkisi + oturum. Asıl engel RLS'tir; bu yalnız anlaşılır mesaj içindir. */
async function requireWrite(): Promise<
  { supabase: SupabaseClient; userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditDrawings(profile?.role)) {
    return { error: "Teknik resim yükleme yetkiniz yok (Yönetici · Mühendis · Teknik Ressam)." };
  }
  return { supabase, userId: user.id };
}

/**
 * Paketi ve dosya kayıtlarını oluşturur; depo yollarını istemciye döner.
 *
 * SIRA ÖNEMLİ: önce satırlar, sonra baytlar. Yarıda kalan bir yükleme,
 * satırları zaten yazılmış olduğu için kaldığı yerden sürdürülebilir olur —
 * 454 dosyalık bir pakette bu vazgeçilmez.
 */
export async function createPackage(
  input: CreatePackageInput
): Promise<DrawingActionResult & { packageId?: string; uploads?: { relPath: string; storagePath: string }[] }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createPackageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { folderName, itemNoOverride, files } = parsed.data;

  const cozulmus: ParsedFile[] = files.map((f) =>
    parseFile({ relPath: f.relPath, size: f.size, checksum: f.checksum })
  );

  // Klasör adı çözülemezse İÇERİĞE bakılır; o da olmazsa kullanıcının yazdığı
  // kalem numarası kullanılır. Üçü de boşsa paket YİNE açılır ve listede
  // "Eşleşmemiş" olarak durur — bir klasörü adlandırma biçimi yüzünden geri
  // çevirmek, ressamın bir daha denememesi demektir.
  let tanima = parseFolderName(folderName);
  if (!tanima.value) {
    tanima = folderNameFromContents(
      folderName,
      cozulmus.map((f) => f.fileName)
    );
  }
  const klasor = tanima.value;
  const itemNo = (itemNoOverride || klasor?.itemNo || "").trim();
  const link = itemNo ? await resolveItemNo(supabase, itemNo) : { jobItemId: null, jobId: null };

  const { data: paket, error: paketHatasi } = await supabase
    .from("drawing_packages")
    .insert({
      folder_name: folderName,
      recognized_by: tanima.by,
      item_no: itemNo,
      job_id: link.jobId,
      job_item_id: link.jobItemId,
      job_code: klasor?.job ?? "",
      item_suffix: klasor?.suffix ?? "",
      group_code: klasor?.group ?? "",
      description: klasor?.description ?? "",
      capacity: klasor?.capacity ?? "",
      status: "yukleniyor",
      file_count: cozulmus.length,
      bytes_total: cozulmus.reduce((t, f) => t + f.size, 0),
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (paketHatasi || !paket) {
    return { error: `Paket oluşturulamadı: ${paketHatasi?.message ?? "bilinmeyen hata"}` };
  }
  const packageId = paket.id as string;

  // KİMLİK BURADA ÜRETİLİR, veritabanında değil.
  //
  // Depo anahtarı `{package_id}/{file_id}` olduğu için satır yazılmadan yol
  // bilinemez gibi görünür — ve ilk sürüm bu yüzden önce satırları yazıp
  // SONRA her birine `storage_path`i tek tek UPDATE ediyordu. 454 dosyada bu
  // 454 ardışık gidiş-geliş demek: sunucu eylemi dakikalarca sürer ya da
  // zaman aşımına düşer. Kimliği burada üretmek tek geçişte yazmayı sağlar.
  const uploads: { relPath: string; storagePath: string }[] = [];
  for (let i = 0; i < cozulmus.length; i += 200) {
    const obek = cozulmus.slice(i, i + 200).map((f) => {
      const fileId = randomUUID();
      const storagePath = `${packageId}/${fileId}`;
      uploads.push({ relPath: f.relPath, storagePath });
      return {
        id: fileId,
        storage_path: storagePath,
        package_id: packageId,
        rel_path: f.relPath,
        folder: f.folder,
        file_name: f.fileName,
        ext: f.ext,
        role: f.role,
        lifecycle: f.lifecycle,
        part_code: f.partCode,
        material: f.material,
        thickness_mm: f.thicknessMm,
        qty: f.qty,
        label: f.label,
        recognized_by: f.recognizedBy,
        folder_material: f.folderMaterial,
        folder_thickness_mm: f.folderThicknessMm,
        size_bytes: f.size,
        checksum: f.checksum,
      };
    });

    const { error } = await supabase.from("drawing_files").insert(obek);
    if (error) return { error: `Dosya kaydı yazılamadı: ${error.message}`, packageId };
  }

  revalidatePath("/drawings");
  return { packageId, uploads };
}

/** Yüklenebilen dosyaları işaretler ve paketi "yuklendi"ye çeker. */
export async function finalizeUpload(input: FinalizeUploadInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = finalizeUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, storedPaths } = parsed.data;

  for (let i = 0; i < storedPaths.length; i += 200) {
    const obek = storedPaths.slice(i, i + 200);
    const { error } = await supabase
      .from("drawing_files")
      .update({ stored: true })
      .eq("package_id", packageId)
      .in("rel_path", obek);
    if (error) return { error: `Yükleme işaretlenemedi: ${error.message}` };
  }

  await supabase
    .from("drawing_packages")
    .update({ status: "yuklendi", updated_by: userId })
    .eq("id", packageId);

  revalidatePath("/drawings");
  return {};
}

/**
 * Eşleştirme — YALNIZ VERİTABANI, depoya hiç dokunmaz.
 *
 * Dosya kayıtları ve ham BOM satırları zaten yazılı olduğu için kural
 * değiştiğinde 200 MB'lık paketi yeniden indirmeye gerek yoktur; bu eylem
 * saniyenin altında biter. Onaylar ve öğrenilen bağlar METİN ANAHTARLI ayrı
 * tablolarda olduğu için silme-yazma döngüsünden sağ çıkar.
 */
export async function reconcilePackage(input: {
  packageId: string;
}): Promise<DrawingActionResult & { recognitionPct?: number }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  const { data: paket } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, item_no, job_item_id, group_map")
    .eq("id", packageId)
    .maybeSingle();
  if (!paket) return { error: "Paket bulunamadı." };

  const dosyalar = await tumSayfalar(supabase, "drawing_files", packageId, "*");
  // Excel'in YOLU `drawing_files` üzerinden gelir: "İPTAL" bir klasör değil bir
  // DURUM olduğu için ham satırın hangi yoldan geldiğini bilmek şart.
  const bomSatirlari = await tumSayfalar(
    supabase,
    "drawing_bom_rows",
    packageId,
    "*, drawing_files (rel_path)"
  );

  const files: ParsedFile[] = dosyalar.map((d) =>
    parseFile({
      relPath: d.rel_path as string,
      size: Number(d.size_bytes ?? 0),
      checksum: (d.checksum as string) ?? "",
    })
  );

  // İPTAL altındaki Excel'ler ESKİ sürümdür; defter CANLI olandan kurulur.
  const bomYolu = (r: Record<string, unknown>): string =>
    ((r.drawing_files as { rel_path?: string } | null)?.rel_path ?? "") as string;

  const bom: BomRow[] = bomSatirlari
    .filter((r) => !bomYolu(r).split("/").some((s) => s === "İPTAL"))
    .map((r) => ({
      fileRelPath: bomYolu(r),
      sheetName: (r.sheet_name as string) ?? "",
      sourceKind: (r.source_kind as BomRow["sourceKind"]) ?? "bilinmiyor",
      rowNo: Number(r.row_no ?? 0),
      itemPath: (r.item_path as string) ?? "",
      partNumber: (r.part_number as string) ?? "",
      bomStructure: (r.bom_structure as string) ?? "",
      description: (r.description as string) ?? "",
      title: (r.title as string) ?? "",
      materialRaw: (r.material_raw as string) ?? "",
      itemQtyRaw: (r.item_qty_raw as string) ?? "",
      qtyRaw: (r.qty_raw as string) ?? "",
      category: (r.category as string) ?? "",
      massRaw: (r.mass_raw as string) ?? "",
      revRaw: (r.rev_raw as string) ?? "",
      extra: (r.extra as Record<string, string>) ?? {},
    }));

  // Sistemdeki güncel kalem numarası: kaymışsa `bilgi` bulgusu basılır.
  let systemItemNo = "";
  if (paket.job_item_id) {
    const { data: kalem } = await supabase
      .from("job_items")
      .select("item_no")
      .eq("id", paket.job_item_id)
      .maybeSingle();
    systemItemNo = (kalem?.item_no as string) ?? "";
  }

  const folderName = paket.folder_name as string;
  let tanima = parseFolderName(folderName);
  if (!tanima.value) {
    tanima = folderNameFromContents(
      folderName,
      files.map((f) => f.fileName)
    );
  }

  const snap: PackageSnapshot = {
    folderName,
    folder: tanima.value,
    files,
    bom,
    groupMap: (paket.group_map as Record<string, string>) ?? {},
    systemItemNo,
  };
  const sonuc = reconcile(snap);

  // Yol → dosya kimliği (parçaya dosya bağlamak için).
  const yolKimlik = new Map<string, string>();
  for (const d of dosyalar) yolKimlik.set(d.rel_path as string, d.id as string);

  // Dosya kararları (kopya / süperse) satırlara yazılır.
  //
  // YALNIZ DEĞİŞENLER yazılır. Kararların ezici çoğunluğu dosyanın adından
  // zaten çıkarılmış olanı tekrarlar; hepsini tek tek UPDATE etmek 454 ardışık
  // gidiş-geliş demekti. Değişen satır sayısı gerçek paketlerde yirmiyi
  // geçmiyor (kopyalar ve süperse edilenler).
  const mevcutDurum = new Map(
    dosyalar.map((d) => [
      d.rel_path as string,
      {
        lifecycle: d.lifecycle as string,
        superseded: (d.superseded_file_id as string | null) ?? null,
        duplicate: (d.duplicate_of_id as string | null) ?? null,
      },
    ])
  );
  for (const k of sonuc.fileDecisions) {
    const id = yolKimlik.get(k.relPath);
    if (!id) continue;
    const superseded = k.supersedesRelPath ? yolKimlik.get(k.supersedesRelPath) ?? null : null;
    const duplicate = k.duplicateOfRelPath ? yolKimlik.get(k.duplicateOfRelPath) ?? null : null;
    const mevcut = mevcutDurum.get(k.relPath);
    if (
      mevcut &&
      mevcut.lifecycle === k.lifecycle &&
      mevcut.superseded === superseded &&
      mevcut.duplicate === duplicate
    ) {
      continue;
    }
    await supabase
      .from("drawing_files")
      .update({
        lifecycle: k.lifecycle,
        superseded_file_id: superseded,
        duplicate_of_id: duplicate,
      })
      .eq("id", id);
  }

  // Defter ve bulgular baştan kurulur. `drawing_finding_acks` ve
  // `drawing_aliases` metin anahtarlı ayrı tablolarda olduğu için etkilenmez.
  await supabase.from("drawing_parts").delete().eq("package_id", packageId);
  await supabase.from("drawing_findings").delete().eq("package_id", packageId);

  const partRows = sonuc.parts.map((p) => ({
    package_id: packageId,
    part_code: p.partCode,
    bom_seq: p.bomSeq,
    parent_code: p.parentCode,
    item_path: p.itemPath,
    level: p.level,
    kind: p.kind,
    name: p.name,
    description: p.description,
    assembly_title: p.assemblyTitle,
    material: p.material,
    material_raw: p.materialRaw,
    category: p.category,
    qty: p.qty,
    cut_length_mm: p.cutLengthMm,
    thickness_mm: p.thicknessMm,
    weight_kg: p.weightKg,
    has_model: p.hasModel,
    has_sheet: p.hasSheet,
    has_cut: p.hasCut,
    has_3d: p.has3d,
    sheet_file_id: p.sheetRelPath ? yolKimlik.get(p.sheetRelPath) ?? null : null,
    cut_file_id: p.cutRelPath ? yolKimlik.get(p.cutRelPath) ?? null : null,
    sort: p.sort,
  }));
  for (let i = 0; i < partRows.length; i += 300) {
    const { error } = await supabase.from("drawing_parts").insert(partRows.slice(i, i + 300));
    if (error) return { error: `Parça defteri yazılamadı: ${error.message}` };
  }

  const findingRows = sonuc.findings.map((f) => ({
    package_id: packageId,
    code: f.code,
    kind: f.kind,
    subject: f.subject,
    title: f.title,
    detail: f.detail ?? "",
    data: f.data ?? {},
    hint_id: f.hintId ?? "",
  }));
  for (let i = 0; i < findingRows.length; i += 300) {
    const { error } = await supabase.from("drawing_findings").insert(findingRows.slice(i, i + 300));
    if (error) return { error: `Bulgular yazılamadı: ${error.message}` };
  }

  const sayac: Record<string, number> = { eksik: 0, celiski: 0, bilgi: 0 };
  for (const f of sonuc.findings) sayac[f.kind] = (sayac[f.kind] ?? 0) + 1;

  await supabase
    .from("drawing_packages")
    .update({
      status: "aktif",
      part_count: sonuc.parts.length,
      unrecognized_count: sonuc.recognition.unrecognized.length,
      finding_counts: sayac,
      recognition_pct: sonuc.recognition.pct,
      reconciled_at: new Date().toISOString(),
      reconciler_version: RECONCILER_VERSION,
      updated_by: userId,
    })
    .eq("id", packageId);

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  return { recognitionPct: sonuc.recognition.pct };
}

/** Sayfa sayfa okur; `max_rows` sessizce satır kırpmasın. */
async function tumSayfalar(
  supabase: SupabaseClient,
  table: string,
  packageId: string,
  select: string
): Promise<Record<string, unknown>[]> {
  const sonuc: Record<string, unknown>[] = [];
  const SAYFA = 900;
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("package_id", packageId)
      .range(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    const dilim = (data ?? []) as unknown as Record<string, unknown>[];
    sonuc.push(...dilim);
    if (dilim.length < SAYFA) break;
  }
  return sonuc;
}

/**
 * Paketi başka bir iş kalemine bağlar.
 *
 * `rewriteItemNo` kapalıyken YALNIZ BAĞLANTI değişir, paketin `item_no` metni
 * olduğu gibi kalır — ressamın klasörü hâlâ o numarayı diyor ve metin ASILDIR.
 * Açıkken metin de güncellenir; kodların içi ASLA değişmez.
 */
export async function remapPackageItemNo(input: RemapItemInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = remapItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, jobItemId, rewriteItemNo } = parsed.data;

  const guncelleme: Record<string, unknown> = { updated_by: userId };
  if (!jobItemId) {
    guncelleme.job_item_id = null;
    guncelleme.job_id = null;
  } else {
    const { data: kalem } = await supabase
      .from("job_items")
      .select("id, job_id, item_no")
      .eq("id", jobItemId)
      .maybeSingle();
    if (!kalem) return { error: "İş kalemi bulunamadı." };
    guncelleme.job_item_id = kalem.id;
    guncelleme.job_id = kalem.job_id;
    if (rewriteItemNo) guncelleme.item_no = kalem.item_no;
  }

  const { error } = await supabase.from("drawing_packages").update(guncelleme).eq("id", packageId);
  if (error) return { error: `Eşleştirme yazılamadı: ${error.message}` };

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  return {};
}

/** "Bunu gördüm." Bulgular yeniden üretilse de onay kalır (metin anahtarlı). */
export async function ackFinding(input: AckFindingInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = ackFindingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, code, subject, note } = parsed.data;

  const { error } = await supabase.from("drawing_finding_acks").upsert(
    { package_id: packageId, code, subject, note, acked_by: userId },
    { onConflict: "package_id,code,subject" }
  );
  if (error) return { error: `Onay yazılamadı: ${error.message}` };

  revalidatePath(`/drawings/${packageId}/report`);
  return {};
}

/**
 * Tanınmayan bir dosyayı elle bir koda bağlar VE bunu hatırlar.
 *
 * Bağ `drawing_aliases`a yazılır: aynı desen başka bir pakette geçtiğinde
 * kendiliğinden çözülür. Kuralı sıkılaştırmadan isabeti artırmanın yolu budur.
 */
export async function bindAlias(input: BindAliasInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = bindAliasSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, scope, pattern, resolvesTo } = parsed.data;

  const { error: aliasHatasi } = await supabase.from("drawing_aliases").upsert(
    { scope, pattern, resolves_to: resolvesTo, created_by: userId },
    { onConflict: "scope,pattern" }
  );
  if (aliasHatasi) return { error: `Bağ kaydedilemedi: ${aliasHatasi.message}` };

  // Bu paketteki dosyaya da hemen uygulanır; kullanıcı sonucu beklemez.
  if (scope === "dosya") {
    await supabase
      .from("drawing_files")
      .update({ part_code: resolvesTo, recognized_by: "dosya.elle" })
      .eq("package_id", packageId)
      .eq("rel_path", pattern);
  }

  return reconcilePackage({ packageId });
}

/** Paketi ve bütün depo nesnelerini siler — YALNIZ YÖNETİCİ (RLS keser). */
export async function deletePackage(input: { packageId: string }): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  // Depo nesneleri yabancı anahtarla gitmez; önce onlar temizlenir yoksa
  // bucket'ta yetim 450 dosya kalır.
  const { data: liste } = await supabase.storage.from(BUCKET).list(packageId, { limit: 1000 });
  if (liste?.length) {
    await supabase.storage.from(BUCKET).remove(liste.map((o) => `${packageId}/${o.name}`));
  }

  const { error, count } = await supabase
    .from("drawing_packages")
    .delete({ count: "exact" })
    .eq("id", packageId);
  if (error) return { error: `Paket silinemedi: ${error.message}` };
  // RLS sessiz bir no-op üretebilir; sayıyı okumak onu gerçek hataya çevirir.
  if (!count) return { error: "Paketi yalnız Yönetici silebilir." };

  revalidatePath("/drawings");
  return {};
}
