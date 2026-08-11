"use server";

// Satın Alma — kategori düzeltme eylemleri.
//
// SÖZLÜK BİLEMEDİĞİNDE İNSAN SÖYLER, SİSTEM HATIRLAR. `satinAlmaSinifi` on beş
// ürün ailesini tanımdan okur ve iki gerçek pakette 126 kalemin 125'ini doğru
// yerleştiriyor; kalanı "Diğer"e düşer. Orası bir çöp kutusu olamaz: kullanıcı
// kalemi doğru kategoriye taşır ve o düzeltme deftere yazılır.
//
// DÜZELTME PAKETE DEĞİL TANIMA BAĞLIDIR. `SOMUN M16 DIN934` her pakette aynı
// somundur; düzeltmeyi paket başına saklamak aynı işi her teslimde yeniden
// yaptırırdı. Bu, `drawing_aliases`in kurduğu kalıbın aynısıdır (md. 18/1:
// "sistem kullanıldıkça hoşgörüsünü kaybetmeden daha çoğunu anlar").
//
// İSTEMCİNİN TANIMI GÖNDERİLMEZ, yalnız ANAHTARLARI gider: hangi anahtarın
// hangi tanıma karşılık geldiği sunucuda defterden okunur. Aksi hâlde açık
// kalmış eski bir sekme, o günden beri düzeltilmiş bir tanımı eski hâliyle
// deftere yazardı.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trKatla } from "@/lib/drawings/tr-text";
import { progressKeyOf } from "@/lib/drawings/progress";
import { requireWrite } from "../../actions";
import {
  createPurchaseCategorySchema,
  movePurchaseCategorySchema,
  type CreatePurchaseCategoryInput,
  type MovePurchaseCategoryInput,
  type PurchaseActionResult,
} from "./schema";

/** Bir `upsert`in en çok kaç satır taşıyacağı. */
const YIGIN = 500;

interface DefterSatiri {
  part_code: string;
  description: string;
  name: string;
  assembly_title: string;
}

/**
 * Anahtar → ham tanım haritası.
 *
 * Anahtar `progressKeyOf` ile kurulur (kodlu parçada kod, kodsuzda katlanmış
 * tanım) — `derive.ts`in satın alma listesiyle AYNI kural. Tanım ise düzeltme
 * defterinin anahtarını üretecek olan ham metindir.
 */
async function tanimHaritasi(
  supabase: SupabaseClient,
  packageId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("drawing_parts")
    .select("part_code, description, name, assembly_title")
    .eq("package_id", packageId)
    .order("sort");
  if (error) throw new Error(error.message);

  const harita = new Map<string, string>();
  for (const r of (data ?? []) as DefterSatiri[]) {
    const partCode = r.part_code ?? "";
    const description = r.description ?? "";
    const name = r.name ?? "";
    const key = progressKeyOf({ partCode, description, name });
    // TANIM SEÇİMİ `derive.ts`in `satinAlmaTanimi` KURALIYLA AYNI: kodsuz
    // satırda montaj başlığına düşülmez (orada anahtar zaten tanımdan kurulur
    // ve yedek bir ad kimliği bozardı), kodlu satırda düşülür.
    const tanim =
      (description || name).trim() ||
      (partCode ? (r.assembly_title ?? "").trim() || partCode : "");
    if (tanim && !harita.has(key)) harita.set(key, tanim);
  }
  return harita;
}

function tazele(packageId: string) {
  revalidatePath(`/drawings/${packageId}/purchasing`);
}

/**
 * Seçili kalemleri bir kategoriye taşır.
 *
 * Aynı tanım için ikinci bir düzeltme gelirse ÜSTÜNE YAZILIR (`upsert`):
 * kullanıcı fikrini değiştirebilir ve iki çelişen satır bırakmak, hangisinin
 * geçerli olduğunu belirsiz yapardı.
 */
export async function movePurchaseCategory(
  input: MovePurchaseCategoryInput
): Promise<PurchaseActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = movePurchaseCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, keys, category } = parsed.data;

  try {
    const tanimlar = await tanimHaritasi(supabase, packageId);

    // Defterde karşılığı olmayan anahtar SESSİZCE DÜŞÜRÜLÜR: istemciden gelen
    // bir liste hiçbir zaman doğruluk kaynağı değildir (markStage ile aynı).
    const satirlar = [...new Set(keys)]
      .map((k) => tanimlar.get(k))
      .filter((t): t is string => Boolean(t))
      .map((tanim) => ({
        match_key: trKatla(tanim),
        category,
        sample: tanim.slice(0, 200),
        created_by: userId,
      }));

    // Aynı katlanmış anahtara düşen iki tanım olabilir ("CİVATA" / "CIVATA");
    // `upsert` tek çağrıda aynı anahtarı iki kez görürse Postgres
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" der.
    const tekil = [...new Map(satirlar.map((s) => [s.match_key, s])).values()];
    if (tekil.length === 0) return { error: "Taşınacak kalem bulunamadı." };

    for (let i = 0; i < tekil.length; i += YIGIN) {
      const { error } = await supabase
        .from("drawing_purchase_overrides")
        .upsert(tekil.slice(i, i + YIGIN), { onConflict: "match_key" });
      if (error) return { error: error.message };
    }

    tazele(packageId);
    return { ok: tekil.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kategori taşınamadı." };
  }
}

/**
 * Yeni kategori tanımlar.
 *
 * Koddaki sözlükte ZATEN VAR OLAN bir ad reddedilmez, sessizce kabul edilir ve
 * defterde satır açılmaz: kullanıcının yazdığı ad ile sözlüğünki aynıysa
 * sonuç zaten istediği şeydir ve "bu kategori zaten var" demek gereksiz bir
 * engeldir. Defterde varsa da aynı: `upsert` ile ad tekil kalır.
 */
export async function createPurchaseCategory(
  input: CreatePurchaseCategoryInput
): Promise<PurchaseActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createPurchaseCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name } = parsed.data;

  const { error } = await supabase
    .from("drawing_purchase_categories")
    .upsert({ name, created_by: userId }, { onConflict: "name" });
  if (error) return { error: error.message };

  revalidatePath("/drawings");
  return { ok: 1 };
}
