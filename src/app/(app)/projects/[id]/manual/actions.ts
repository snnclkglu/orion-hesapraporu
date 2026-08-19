"use server";

// İŞLETME VE BAKIM EL KİTABI — yazma katmanı.
//
// REVİZYON MODELİ TEKLİFİN İKİZİDİR (TEKLIF-2): `payload` belgenin tamamıdır,
// yayımlanan revizyon `guard_issued_manual_revision` ile dondurulur ve yeni
// revizyon öncekinin KOPYASIYLA açılır — mühendis boş sayfayla başlamaz.
//
// YAYIMDA OTOMATİK TABLOLAR DONAR. Taslakta bir "auto" bloğu her açılışta
// hesap raporundan/elektrik projesinden yeniden üretilir; yayımda çözülmüş
// tablo `frozen`a yazılır. Aksi hâlde teslim edilmiş bir kılavuz, kaynağı
// sonradan revize edilince sessizce başka bir şey söylerdi — ve bu, bir vinç
// kılavuzunda yapılabilecek en pahalı hatadır.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { manualFromTemplate, withManualDefaults } from "@/lib/manual/payload";
import { MANUAL_DOC_TITLE, suggestCoverTitle } from "@/lib/manual/naming";
import { resolveAutoTable, type ManualSourceData } from "@/lib/manual/sources";
import { MANUAL_IMAGE_BUCKET } from "@/lib/manual/data";
import type { ManualPayload, ManualSection } from "@/lib/manual/types";
import { buildManualSourceData } from "./sources-data";

export type ManualResult = { ok?: boolean; error?: string; revisionId?: string };

async function yetki(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return { error: "El kitabı düzenleme yetkiniz yok." };
  }
  return { userId: user.id };
}

/**
 * El kitabını açar ve İLK REVİZYONU şablondan kurar.
 *
 * Künye PROJEDEN doldurulur (müşteri, vinç tipi, ürün adı); ÜRETİCİ, SERİ NO
 * ve SAHA uygulamada yoktur ve BOŞ kalır — uydurulmaz (değişmez md. 4).
 */
export async function createManual(projectId: string): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: proje } = await supabase
    .from("projects")
    .select("id, name, customer, crane_type")
    .eq("id", projectId)
    .maybeSingle();
  if (!proje) return { error: "Proje bulunamadı." };

  const { data: varOlan } = await supabase
    .from("manuals")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (varOlan) return { error: "Bu projenin el kitabı zaten açılmış." };

  const ad = String(proje.name ?? "");
  const tip = String(proje.crane_type ?? "");
  const kapak = suggestCoverTitle(ad, tip);

  const { data: manual, error: manualHatasi } = await supabase
    .from("manuals")
    .insert({
      project_id: projectId,
      title: kapak,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (manualHatasi || !manual) return { error: manualHatasi?.message ?? "El kitabı açılamadı." };

  const govde = manualFromTemplate({
    customer: String(proje.customer ?? ""),
    product: ad,
    craneType: tip,
  });
  govde.docTitle = MANUAL_DOC_TITLE;
  govde.coverTitle = kapak;

  const { data: rev, error: revHatasi } = await supabase
    .from("manual_revisions")
    .insert({
      manual_id: manual.id,
      rev_no: 1,
      payload: govde,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (revHatasi || !rev) return { error: revHatasi?.message ?? "Revizyon açılamadı." };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, revisionId: String(rev.id) };
}

const kaydetSemasi = z.object({
  revisionId: z.uuid("Geçersiz revizyon"),
  /** Gövde JSONB olarak gelir; şekil `withManualDefaults` ile SINANIR. */
  payload: z.unknown(),
  label: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
});

/** Taslağı kaydeder. Yayımlanmış revizyonda DB tetikleyicisi reddeder. */
export async function saveManualRevision(
  projectId: string,
  input: { revisionId: string; payload: unknown; label?: string; notes?: string }
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = kaydetSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // GELEN GÖVDE OLDUĞU GİBİ YAZILMAZ. İstemciden gelen JSON serbest biçimlidir;
  // `withManualDefaults` tanınmayan düğümü düşürür ve şekli bugüne taşır.
  // Aksi hâlde bir hata (ya da kötü niyet) veritabanına okunamayan bir belge
  // yazabilirdi ve o kayıt bir daha açılmazdı.
  const govde = withManualDefaults(parsed.data.payload);

  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_revisions")
    .update({
      payload: govde,
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    })
    .eq("id", parsed.data.revisionId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/manual/${parsed.data.revisionId}`);
  return { ok: true };
}

/** Otomatik blokları kaynaktan çözüp `frozen`a yazar (yayım hazırlığı). */
function dondur(sections: ManualSection[], veri: ManualSourceData): ManualSection[] {
  return sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) =>
      b.kind === "auto" ? { ...b, frozen: resolveAutoTable(b.source, veri) } : b
    ),
    children: dondur(s.children, veri),
  }));
}

/**
 * Revizyonu YAYIMLAR.
 *
 * İki iş bir arada yapılır ve SIRA ÖNEMLİDİR: önce otomatik tablolar donar,
 * SONRA durum `issued` olur. Ters sırada tetikleyici ikinci yazmayı
 * reddederdi ve belge, kaynağı hâlâ canlı okuyan bir yayın olurdu.
 */
export async function issueManualRevision(
  projectId: string,
  revisionId: string
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("id, status, payload")
    .eq("id", revisionId)
    .maybeSingle();
  if (!rev) return { error: "Revizyon bulunamadı." };
  if (rev.status === "issued") return { error: "Bu revizyon zaten yayımlanmış." };

  const veri = await buildManualSourceData(supabase, projectId);
  const govde: ManualPayload = withManualDefaults(rev.payload);
  govde.sections = dondur(govde.sections, veri);

  const { error } = await supabase
    .from("manual_revisions")
    .update({ payload: govde, status: "issued" })
    .eq("id", revisionId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/manual/${revisionId}`);
  return { ok: true };
}

/**
 * Yeni revizyon — öncekinin KOPYASIYLA açılır.
 *
 * GÖRSELLER DE KOPYALANIR (`equipment_attachments`ın `copyEquipmentNotes`
 * dersi): mühendis her sürümde aynı saha fotoğrafını yeniden yüklemez.
 * Kopyalama depo nesnesini de çoğaltır çünkü kayıt revizyona bağlıdır ve
 * eski revizyonun nesnesini paylaşmak, o revizyon silinince yeni belgeyi
 * boşa düşürürdü.
 *
 * DONMUŞ TABLOLAR ÇÖZÜLÜR: yeni revizyon bir TASLAKTIR ve taslakta otomatik
 * blok CANLIDIR — yoksa yeni sürüm, güncellenmiş hesap raporunu değil eski
 * yayının fotoğrafını basardı.
 */
export async function newManualRevision(
  projectId: string,
  manualId: string
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: son } = await supabase
    .from("manual_revisions")
    .select("id, rev_no, payload")
    .eq("manual_id", manualId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!son) return { error: "Kopyalanacak revizyon yok." };

  const govde = withManualDefaults(son.payload);
  const cozulmus = (sections: ManualSection[]): ManualSection[] =>
    sections.map((s) => ({
      ...s,
      blocks: s.blocks.map((b) => {
        if (b.kind !== "auto") return b;
        const { frozen: _atilan, ...kalan } = b;
        return kalan;
      }),
      children: cozulmus(s.children),
    }));
  govde.sections = cozulmus(govde.sections);

  const yeniNo = Number(son.rev_no ?? 0) + 1;
  const { data: yeni, error } = await supabase
    .from("manual_revisions")
    .insert({
      manual_id: manualId,
      rev_no: yeniNo,
      payload: govde,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (error || !yeni) return { error: error?.message ?? "Revizyon açılamadı." };

  // Görselleri taşı: önce depo nesnesi kopyalanır, sonra kayıt yazılır.
  // Sıra "önce ucuz olanı kaybet"in tersidir çünkü HENÜZ KAYIT YOKTUR —
  // kopyalanamayan bir nesne yalnız o görseli düşürür, revizyonu değil.
  const { data: gorseller } = await supabase
    .from("manual_images")
    .select("id, file_name, storage_path, width, height, size_bytes")
    .eq("revision_id", son.id);
  for (const g of (gorseller ?? []) as Record<string, unknown>[]) {
    const eski = String(g.storage_path);
    const uzanti = eski.slice(eski.lastIndexOf(".") + 1) || "png";
    const yeniYol = `${yeni.id}/${String(g.id)}.${uzanti}`;
    const { error: kopyaHatasi } = await supabase.storage
      .from(MANUAL_IMAGE_BUCKET)
      .copy(eski, yeniYol);
    if (kopyaHatasi) continue;
    // KİMLİK KORUNUR: gövdedeki `imageId` atıfları aynı kalmalı, yoksa her
    // resim bloğu boşa düşerdi.
    await supabase.from("manual_images").insert({
      id: String(g.id),
      revision_id: yeni.id,
      file_name: String(g.file_name ?? ""),
      storage_path: yeniYol,
      width: Number(g.width ?? 0),
      height: Number(g.height ?? 0),
      size_bytes: Number(g.size_bytes ?? 0),
      created_by: izin.userId,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, revisionId: String(yeni.id) };
}

/** Taslak revizyonu siler. Yayımlanmışı DB tetikleyicisi reddeder. */
export async function deleteManualRevision(
  projectId: string,
  revisionId: string
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: gorseller } = await supabase
    .from("manual_images")
    .select("storage_path")
    .eq("revision_id", revisionId);

  const { error } = await supabase.from("manual_revisions").delete().eq("id", revisionId);
  if (error) return { error: error.message };

  const yollar = ((gorseller ?? []) as { storage_path: string }[]).map((g) => g.storage_path);
  if (yollar.length) await supabase.storage.from(MANUAL_IMAGE_BUCKET).remove(yollar);

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
