"use server";

// Üretim durumu — sunucu eylemleri.
//
// Paylaşılan `drawings/actions.ts`e DOKUNULMAZ; bu ekranın yazma yolları kendi
// dosyasında durur. Menüden gizlemek yalnız görgü kuralıdır, asıl engel
// RLS'tir (`can_edit_drawings()`); buradaki yetki kontrolü anlaşılır bir mesaj
// içindir.
//
// ANAHTAR HER YERDE KODDAN TÜRETİLİR. `drawing_packages.item_no` okunmaz —
// `remapItem(rewriteItemNo)` onu yeniden yazabilir ve `autoItemNos` kaydırabilir.
// Kayıtlar (item_no, part_code, stage) üçlüsüyle benzersizdir ve item_no
// defterin KODLARINDAN gelir; ressam kodu yeniden çizmediği sürece sabittir.
//
// DEFTER HENÜZ KURULMAMIŞ OLABİLİR. Migration'ı ana oturum uygulayacak; o güne
// kadar `drawing_stages` ve `stage_id` yoktur. Bu dosya bunu bir hata değil bir
// durum sayar: aşama bağı kurulamıyorsa kayıt METİNLE yazılır ve ekran çalışır.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
// Yetki sorusu TEK YERDE: `../../actions.ts`. Bu dosya kendi kopyasını
// taşıyordu (dosya sahipliği kuralının bedeli); birleştirmede tekile indi.
import { requireWrite } from "../../actions";
import { canEditDrawings } from "@/lib/roles";
import {
  progressItemNo,
  registerItemNo,
  suggestStagesFromFolders,
  trackedParts,
  type ProgressPart,
  type SuggestionFile,
} from "@/lib/drawings/progress";
import {
  applySuggestionSchema,
  markStageSchema,
  setPartStageSchema,
  type ApplySuggestionInput,
  type MarkStageInput,
  type ProgressActionResult,
  type SetPartStageInput,
} from "./schema";

/** Bir `in(...)` listesinin en çok kaç eleman taşıyacağı — URL uzunluğu sınırı. */
const KUME = 150;
/** Bir `insert`in en çok kaç satır taşıyacağı. */
const YIGIN = 500;

function kumele<T>(liste: readonly T[], boy: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < liste.length; i += boy) parcalar.push(liste.slice(i, i + boy));
  return parcalar;
}

interface DefterSatiri {
  part_code: string;
  description: string;
  name: string;
  qty: number | null;
}

/** Paketin parça defteri — anahtar uzayı ve adetler buradan çıkar. */
async function defteriOku(
  supabase: SupabaseClient,
  packageId: string
): Promise<ProgressPart[]> {
  const { data, error } = await supabase
    .from("drawing_parts")
    .select("part_code, description, name, qty")
    .eq("package_id", packageId)
    .order("sort");
  if (error) throw new Error(error.message);
  return ((data ?? []) as DefterSatiri[]).map((r) => ({
    partCode: r.part_code ?? "",
    description: r.description ?? "",
    name: r.name ?? "",
    qty: r.qty ?? null,
  }));
}

/**
 * Aşamanın defterdeki kimliği.
 *
 * `undefined` = defter YOK (migration henüz uygulanmamış) → `stage_id` alanı
 * insert yükünden tamamen çıkarılır, çünkü sütun da yoktur.
 * `null` = defter var ama bu slug orada yok → bağ boş bırakılır, kayıt metinle
 * yaşar. Aşama defterinden silinmiş olması atölyenin kaydını düşürmemeli.
 */
async function asamaKimligi(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from("drawing_stages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return undefined;
  return (data?.id as string | undefined) ?? null;
}

function tazele(packageId: string) {
  revalidatePath(`/drawings/${packageId}/progress`);
  revalidatePath(`/drawings/${packageId}/parts`);
  revalidatePath("/drawings");
}

/** Boş tarih metni `null` olur — atölye her zaman tarihi bilmez. */
function tarih(raw: string): string | null {
  const t = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

interface YazilacakSatir {
  item_no: string;
  part_code: string;
  stage: string;
  qty_done: number;
  done_at: string | null;
  package_id: string;
  created_by: string;
  stage_id?: string | null;
}

/**
 * Verilen anahtarları bir aşamaya işaretler ya da işareti kaldırır.
 *
 * ZATEN İŞARETLİ SATIRA DOKUNULMAZ. Toplu bir hareket, atölyenin tek tek
 * girdiği adet/tarih/notu ezmemelidir: "20'sini kesildi işaretle" komutu
 * kesilmiş olanların kaydını yeniden yazmaz, eksik olanları tamamlar. Bu
 * sayede aynı öneriyi ikinci kez uygulamak yeni satır da yaratmaz.
 */
export async function markStage(input: MarkStageInput): Promise<ProgressActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = markStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, stage, keys, mode, doneAt } = parsed.data;

  try {
    const defter = await defteriOku(supabase, packageId);
    const izlenen = trackedParts(defter);
    const adet = new Map(izlenen.all.map((p) => [p.key, p.qty]));
    const kalemNo = izlenen.itemNo || registerItemNo(defter);

    // Defterde karşılığı olmayan anahtar SESSİZCE DÜŞÜRÜLÜR: istemciden gelen
    // bir liste hiçbir zaman doğruluk kaynağı değildir.
    const gecerli = [...new Set(keys)].filter((k) => adet.has(k));
    if (gecerli.length === 0) return { error: "İşaretlenecek parça bulunamadı." };

    // Anahtarlar kalem numarasına göre öbeklenir: kodlu parçalar kendi
    // öneklerini taşır, satın alma kalemleri defterin türetilmiş numarasını.
    const kalemeGore = new Map<string, string[]>();
    for (const k of gecerli) {
      const kalem = progressItemNo(k, kalemNo);
      if (!kalem) continue;
      const liste = kalemeGore.get(kalem);
      if (liste) liste.push(k);
      else kalemeGore.set(kalem, [k]);
    }
    if (kalemeGore.size === 0) {
      return { error: "Paketin kalem numarası çözülemedi; ilerleme anahtarı kurulamıyor." };
    }

    if (mode === "kaldir") {
      let silinen = 0;
      for (const [kalem, liste] of kalemeGore) {
        for (const kume of kumele(liste, KUME)) {
          const { error } = await supabase
            .from("drawing_part_progress")
            .delete()
            .eq("item_no", kalem)
            .eq("stage", stage)
            .in("part_code", kume);
          if (error) return { error: error.message };
          silinen += kume.length;
        }
      }
      tazele(packageId);
      return { ok: silinen };
    }

    const asamaId = await asamaKimligi(supabase, stage);
    const gun = tarih(doneAt);
    const yazilacak: YazilacakSatir[] = [];

    for (const [kalem, liste] of kalemeGore) {
      const { data, error } = await supabase
        .from("drawing_part_progress")
        .select("part_code")
        .eq("item_no", kalem)
        .eq("stage", stage);
      if (error) return { error: error.message };
      const varOlan = new Set((data ?? []).map((r) => r.part_code as string));

      for (const k of liste) {
        if (varOlan.has(k)) continue;
        const satir: YazilacakSatir = {
          item_no: kalem,
          part_code: k,
          stage,
          qty_done: adet.get(k) ?? 0,
          done_at: gun,
          package_id: packageId,
          created_by: userId,
        };
        if (asamaId !== undefined) satir.stage_id = asamaId;
        yazilacak.push(satir);
      }
    }

    if (yazilacak.length === 0) {
      tazele(packageId);
      return { ok: 0 };
    }

    for (const yigin of kumele(yazilacak, YIGIN)) {
      const { error } = await supabase.from("drawing_part_progress").insert(yigin);
      if (error) return { error: error.message };
    }

    tazele(packageId);
    return { ok: yazilacak.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Üretim durumu yazılamadı." };
  }
}

/**
 * Tek parçanın adet/tarih/notunu yazar.
 *
 * Var olan satır GÜNCELLENİR (`created_by` korunur — kaydı ilk giren kişinin
 * bilgisi bir düzeltmede kaybolmamalı), yoksa yenisi açılır.
 */
export async function setPartStage(input: SetPartStageInput): Promise<ProgressActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = setPartStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, stage, key, qtyDone, doneAt, note } = parsed.data;

  try {
    const defter = await defteriOku(supabase, packageId);
    const izlenen = trackedParts(defter);
    if (!izlenen.all.some((p) => p.key === key)) {
      return { error: "Bu parça paketin defterinde bulunamadı." };
    }
    const kalem = progressItemNo(key, izlenen.itemNo);
    if (!kalem) return { error: "Paketin kalem numarası çözülemedi." };

    const { data: mevcut, error: okumaHatasi } = await supabase
      .from("drawing_part_progress")
      .select("id")
      .eq("item_no", kalem)
      .eq("part_code", key)
      .eq("stage", stage)
      .maybeSingle();
    if (okumaHatasi) return { error: okumaHatasi.message };

    const gun = tarih(doneAt);

    if (mevcut?.id) {
      const { error } = await supabase
        .from("drawing_part_progress")
        .update({ qty_done: qtyDone, done_at: gun, note })
        .eq("id", mevcut.id);
      if (error) return { error: error.message };
    } else {
      const asamaId = await asamaKimligi(supabase, stage);
      const satir: YazilacakSatir & { note: string } = {
        item_no: kalem,
        part_code: key,
        stage,
        qty_done: qtyDone,
        done_at: gun,
        note,
        package_id: packageId,
        created_by: userId,
      };
      if (asamaId !== undefined) satir.stage_id = asamaId;
      const { error } = await supabase.from("drawing_part_progress").insert(satir);
      if (error) return { error: error.message };
    }

    tazele(packageId);
    return { ok: 1 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Üretim durumu yazılamadı." };
  }
}

/**
 * Klasör adındaki durum ipucundan üretilen öneriyi uygular.
 *
 * KAPSAM SUNUCUDA YENİDEN HESAPLANIR. İstemci yalnız hangi klasörü ve hangi
 * aşamayı onayladığını söyler; hangi parçaların o klasörden geldiğini
 * `drawing_files` + `drawing_parts` söyler. Aksi hâlde açık kalmış eski bir
 * sekme, o günden beri yeniden eşleştirilmiş bir paketi eski kapsamla
 * işaretleyebilirdi.
 */
export async function applyFolderSuggestion(
  input: ApplySuggestionInput
): Promise<ProgressActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = applySuggestionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, stage, folderPath, doneAt } = parsed.data;

  try {
    const defter = await defteriOku(supabase, packageId);
    const izlenen = trackedParts(defter);

    const { data: dosyalar, error } = await supabase
      .from("drawing_files")
      .select("folder, part_code, file_name, qty, lifecycle")
      .eq("package_id", packageId);
    if (error) return { error: error.message };

    const gorunum: SuggestionFile[] = (dosyalar ?? [])
      .filter((f) => (f.lifecycle as string) !== "haric")
      .map((f) => ({
        folder: (f.folder as string) ?? "",
        partCode: (f.part_code as string) ?? "",
        fileName: (f.file_name as string) ?? "",
        qty: (f.qty as number | null) ?? null,
      }));

    const oneri = suggestStagesFromFolders({ files: gorunum, parts: izlenen.all }).find(
      (o) => o.folderPath === folderPath && o.stage === stage
    );
    if (!oneri) {
      return { error: "Öneri artık geçerli değil — paket yeniden eşleştirilmiş olabilir." };
    }
    if (oneri.pending.length === 0) {
      return { ok: 0 };
    }

    return await markStage({
      packageId,
      stage,
      keys: oneri.pending,
      mode: "isaretle",
      doneAt,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Öneri uygulanamadı." };
  }
}
