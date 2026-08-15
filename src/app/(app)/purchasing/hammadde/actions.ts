"use server";

// HAMMADDE EYLEMLERİ — düzeltme defteri ve elle açılan talep.
//
// Üç şey yazılır ve üçü de İNSANIN KARARIDIR:
//   · sınıf taşıma / ad düzeltme / stok boyu / hariç tutma → `purchase_raw_meta`
//   · elle açılan talep                                    → `purchase_raw_manual`
//
// Havuzun KENDİSİ yazılmaz: o `drawing_parts`tan her okumada yeniden türer.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { hamAnahtar } from "@/lib/purchasing/hammadde/havuz";
import {
  createRawManualSchema,
  moveToEquipmentSchema,
  saveRawMetaSchema,
  updateRawManualSchema,
  type CreateRawManualInput,
  type MoveToEquipmentInput,
  type SaveRawMetaInput,
  type UpdateRawManualInput,
} from "./schema";

export interface HammaddeActionResult {
  ok?: number;
  id?: string;
  error?: string;
}

async function requireWrite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." as const };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!canEditPurchasing(profil?.role)) {
    return { error: "Bu işlem için Satın Alma yetkisi gerekir." as const };
  }
  return { supabase, userId: user.id };
}

/**
 * HAMMADDE EKRANLARI DA TAZELENİR.
 *
 * `purchasing/actions.ts:tazele()` ve `drawings/actions.ts:satinAlmayiTazele()`
 * bu iki yolu ayrıca ekler; eklenmezse yeni yüklenmiş bir paket hammadde
 * ekranına "düşmemiş" görünür — 12.08.2026'da ekipman havuzunda birebir
 * yaşanmış bir hata.
 */
function tazele() {
  revalidatePath("/purchasing/hammadde");
  revalidatePath("/purchasing/hammadde/yerlesim");
  // EKİPMAN HAVUZU DA ESKİR: bir satır taşındığında iki ekran birden değişir
  // ve yalnız birini tazelemek, satırı bir an iki yerde birden gösterirdi.
  revalidatePath("/purchasing");
}

// ═══════════════════════════════════════════════════════ DÜZELTME DEFTERİ

/**
 * Stok kalemine düzeltme yazar (taşı · adlandır · not · stok boyu · hariç tut).
 *
 * `null` = DOKUNMA, boş dizge = KALDIR. Üç değerli sözleşme
 * `purchase_item_meta`nınkiyle birebir aynıdır: tek bir alanı değiştiren bir
 * pencere diğerlerini sıfırlamamalıdır.
 *
 * MEVCUT SATIR ÖNCE OKUNUR: `upsert` verilmeyen sütunları varsayılana çeker ve
 * bir notu kaydeden kullanıcı, farkında olmadan sınıf düzeltmesini silerdi.
 */
export async function saveRawMeta(input: SaveRawMetaInput): Promise<HammaddeActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = saveRawMetaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  const v = parsed.data;

  const { data: mevcutlar } = await ctx.supabase
    .from("purchase_raw_meta")
    .select(
      "match_key, kind, label_override, stock_length_mm, excluded, note, sample, " +
        "quality_override, qty_override"
    )
    .in("match_key", v.keys);
  const mevcut = new Map(
    ((mevcutlar ?? []) as unknown as Record<string, unknown>[]).map((r) => [String(r.match_key), r])
  );

  const satirlar = v.keys.map((key, i) => {
    const eski = mevcut.get(key);
    return {
      match_key: key,
      sample: v.samples[i] ?? String(eski?.sample ?? ""),
      kind: v.kind === null ? ((eski?.kind as string | null) ?? null) : v.kind === "" ? null : v.kind,
      label_override:
        v.label === null
          ? ((eski?.label_override as string | null) ?? null)
          : v.label.trim()
            ? v.label.trim()
            : null,
      stock_length_mm:
        v.stockLengthMm === null
          ? ((eski?.stock_length_mm as number | null) ?? null)
          : v.stockLengthMm === 0
            ? null
            : v.stockLengthMm,
      excluded: v.excluded === null ? Boolean(eski?.excluded) : v.excluded,
      note: v.note === null ? String(eski?.note ?? "") : v.note,
      quality_override:
        v.quality === null
          ? ((eski?.quality_override as string | null) ?? null)
          : v.quality.trim()
            ? v.quality.trim()
            : null,
      qty_override:
        v.qty === null
          ? ((eski?.qty_override as number | null) ?? null)
          : v.qty === 0
            ? null
            : v.qty,
      created_by: ctx.userId,
    };
  });

  const { error } = await ctx.supabase
    .from("purchase_raw_meta")
    .upsert(satirlar, { onConflict: "match_key" });
  if (error) return { error: error.message };

  tazele();
  return { ok: satirlar.length };
}

// ═══════════════════════════════════════════════════ ELLE AÇILAN TALEP

function manuelYuk(v: CreateRawManualInput) {
  const tanim = v.sample.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
  return {
    match_key: hamAnahtar(tanim),
    sample: tanim,
    kind: v.kind,
    item_no: v.itemNo,
    section_code: v.sectionCode,
    quality: v.quality,
    thickness_mm: v.thicknessMm,
    width_mm: v.widthMm,
    length_mm: v.lengthMm,
    outer_dia_mm: v.outerDiaMm,
    inner_dia_mm: v.innerDiaMm,
    qty: v.qty,
    unit: v.unit,
    weight_kg: v.weightKg,
    note: v.note,
  };
}

export async function createRawManual(
  input: CreateRawManualInput
): Promise<HammaddeActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = createRawManualSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };

  const { data, error } = await ctx.supabase
    .from("purchase_raw_manual")
    .insert({ ...manuelYuk(parsed.data), created_by: ctx.userId })
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };

  tazele();
  return { ok: 1, id: (data as { id?: string } | null)?.id };
}

export async function updateRawManual(
  input: UpdateRawManualInput
): Promise<HammaddeActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateRawManualSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  const { id, ...v } = parsed.data;

  const { error } = await ctx.supabase
    .from("purchase_raw_manual")
    .update(manuelYuk(v))
    .eq("id", id);
  if (error) return { error: error.message };

  tazele();
  return { ok: 1 };
}

/**
 * Elle açılan talep SİLİNİR, pasife çekilmez.
 *
 * Türetilmiş satırdan farkı budur: türetilmiş bir satır silinse bir sonraki
 * okumada geri gelir (o yüzden `excluded` işareti var), elle açılan satırın
 * kaynağı yoktur ve silinince gerçekten gider.
 */
export async function deleteRawManual(id: string): Promise<HammaddeActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase.from("purchase_raw_manual").delete().eq("id", id);
  if (error) return { error: error.message };

  tazele();
  return { ok: 1 };
}

// ═══════════════════════════════════════════════════ EKİPMANA TAŞIMA

/**
 * Bir hammadde satırını EKİPMAN havuzuna taşır (ya da geri alır).
 *
 * İKİ DEFTERE BİRDEN YAZAR ve ikisi de gereklidir:
 *   · `purchase_raw_meta.to_equipment` — hammadde havuzu satırı DÜŞÜRÜR,
 *   · `purchase_raw_equipment_keys`    — ekipman havuzu o PARÇA TANIMLARINI
 *     kendi okumasına ALIR.
 *
 * Tek bir bayrak yetmezdi: iki havuz iki farklı anahtar uzayında yaşıyor
 * (stok kalemi ↔ parça tanımı) ve köprü açıkça yazılmalı.
 */
export async function moveRawToEquipment(
  input: MoveToEquipmentInput
): Promise<HammaddeActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = moveToEquipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  const v = parsed.data;

  const anahtarlar = [...new Set(v.hamTanimlar.map((t) => hamAnahtar(t)))].filter(Boolean);

  if (v.tasi) {
    const { error: metaHata } = await ctx.supabase.from("purchase_raw_meta").upsert(
      { match_key: v.key, sample: v.sample, to_equipment: true, created_by: ctx.userId },
      { onConflict: "match_key" }
    );
    if (metaHata) return { error: metaHata.message };

    const { error } = await ctx.supabase.from("purchase_raw_equipment_keys").upsert(
      anahtarlar.map((k) => ({
        part_key: k,
        match_key: v.key,
        sample: v.sample,
        created_by: ctx.userId,
      })),
      { onConflict: "part_key" }
    );
    if (error) return { error: error.message };
  } else {
    const { error: metaHata } = await ctx.supabase
      .from("purchase_raw_meta")
      .update({ to_equipment: false })
      .eq("match_key", v.key);
    if (metaHata) return { error: metaHata.message };

    // GERİ ALMA ANAHTARLA DEĞİL KAYNAKLA YAPILIR: aradan geçen sürede o stok
    // kalemine yeni parçalar katılmış olabilir ve elde tutulan liste eksik
    // kalırdı. Defter zaten hangi tanımların oradan geldiğini biliyor.
    const { error } = await ctx.supabase
      .from("purchase_raw_equipment_keys")
      .delete()
      .eq("match_key", v.key);
    if (error) return { error: error.message };
  }

  tazele();
  return { ok: anahtarlar.length };
}
