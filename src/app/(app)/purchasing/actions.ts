"use server";

// Satın Alma — sunucu eylemleri.
//
// Yetki kontrolü anlaşılır bir hata mesajı içindir; ASIL ENGEL RLS'tir
// (`can_see_purchasing()` / `can_edit_purchasing()`). Bu dosyadaki hiçbir
// kontrol, veritabanındaki politikanın yerine geçmez.
//
// SİPARİŞ VERMEK İKİ ŞEY YAZAR ve bu bilinçlidir:
//   1. `purchase_orders` + `purchase_order_lines` — ticari kayıt
//   2. `drawing_part_progress` "satinalindi" — paket ekranındaki İŞARET
//
// İkincisi olmasaydı satınalmacı havuzdan sipariş verir, paketin Satın Alma
// sekmesi ise hâlâ "bekliyor" gösterirdi; atölye o ekrana bakıyor. Tersi de
// geçerli: paket ekranından işaretlemek bir sipariş KAYDI oluşturmaz — orası
// hızlı bir işaret, burası ticari kayıttır. İki yol tek yönde birleşir.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, tagsOf } from "@/lib/roles";
import { PURCHASE_STAGE_SLUG, progressItemNo, registerItemNo } from "@/lib/drawings/progress";
import {
  chooseQuoteSchema,
  createOrderSchema,
  deleteOrderSchema,
  deleteQuoteSchema,
  saveGroupNameSchema,
  saveQuoteSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type PurchasingActionResult,
  type SaveGroupNameInput,
  type SaveQuoteInput,
  type UpdateOrderInput,
} from "./schema";

type Ctx = { supabase: SupabaseClient; userId: string };

/**
 * Yazma yetkisi — rol VE etiket birlikte okunur.
 *
 * Etiket sütunu iki denemede okunur: migration uygulanmadan önce sorgunun
 * tamamı düşer ve YÖNETİCİ bile yazamaz hâle gelirdi.
 */
async function requireWrite(): Promise<Ctx | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const zengin = await supabase
    .from("profiles")
    .select("role, tags")
    .eq("id", user.id)
    .maybeSingle();
  const profil = zengin.error
    ? (await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()).data
    : zengin.data;

  const yetki = {
    role: (profil as { role?: string } | null)?.role ?? "",
    tags: tagsOf((profil as { tags?: string[] } | null)?.tags),
  };
  if (!canEditPurchasing(yetki)) {
    return { error: "Bu işlem için Satın Alma yetkisi gerekir." };
  }
  return { supabase, userId: user.id };
}

function tazele() {
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/siparisler");
  revalidatePath("/purchasing/teslimat");
  revalidatePath("/purchasing/odemeler");
  revalidatePath("/purchasing/fiyatlar");
}

// ═══════════════════════════════════════════════════════════════ TEKLİFLER

/**
 * Teklif kaydeder (yeni ya da düzeltme).
 *
 * "TEKLİF ALINDI" AYRI BİR İŞARET DEĞİLDİR: kalemin bir teklifi varsa teklif
 * alınmıştır. Ayrı bir boolean tutulsaydı iki gerçek ayrışabilir ve ekran
 * "alındı" derken listede tek fiyat görünmeyebilirdi.
 */
export async function saveQuote(input: SaveQuoteInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveQuoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const q = parsed.data;

  const yuk = {
    match_key: q.matchKey,
    sample: q.sample,
    supplier: q.supplier,
    unit_price: q.unitPrice,
    currency: q.currency,
    fx_rate: q.currency === "EUR" ? 1 : q.fxRate,
    qty: q.qty,
    unit: q.unit,
    quoted_at: q.quotedAt ?? new Date().toISOString().slice(0, 10),
    valid_until: q.validUntil,
    note: q.note,
    item_no: q.itemNo,
    package_id: q.packageId,
  };

  if (q.id) {
    const { error } = await supabase.from("purchase_quotes").update(yuk).eq("id", q.id);
    if (error) return { error: error.message };
    tazele();
    return { ok: 1, id: q.id };
  }

  const { data, error } = await supabase
    .from("purchase_quotes")
    .insert({ ...yuk, created_by: userId })
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  tazele();
  return { ok: 1, id: (data?.id as string) ?? undefined };
}

/**
 * Kazanan teklifi işaretler — aynı kalemdeki diğerleri düşer.
 *
 * "Kazanan" bir SEÇİMDİR ve tektir; iki teklifi birden seçili bırakmak
 * satınalmacının kendi kaydını okunmaz yapardı.
 */
export async function chooseQuote(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = chooseQuoteSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { data: teklif } = await supabase
    .from("purchase_quotes")
    .select("match_key, chosen")
    .eq("id", id)
    .maybeSingle();
  if (!teklif) return { error: "Teklif bulunamadı." };

  // Zaten seçiliyse SEÇİM KALDIRILIR: aynı düğme hem seçer hem bırakır
  // (paket ekranındaki çip kuralının aynısı — dokunmak işareti kaldırır).
  if (teklif.chosen) {
    const { error } = await supabase.from("purchase_quotes").update({ chosen: false }).eq("id", id);
    if (error) return { error: error.message };
    tazele();
    return { ok: 0 };
  }

  await supabase
    .from("purchase_quotes")
    .update({ chosen: false })
    .eq("match_key", teklif.match_key);
  const { error } = await supabase.from("purchase_quotes").update({ chosen: true }).eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

export async function deleteQuote(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = deleteQuoteSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { error } = await ctx.supabase.from("purchase_quotes").delete().eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

// ═══════════════════════════════════════════════════════════════ SİPARİŞ

/**
 * Paket başına "satın alındı" işaretini yazar.
 *
 * `markStage`i ÇAĞIRMAZ ve bu bilinçlidir: o eylem `can_edit_drawings()`
 * ister (Yönetici · Mühendis · Teknik Ressam) ve satınalmacı o kümede
 * değildir. RLS satın alma AŞAMALARI için ayrıca izin verir
 * (20260812000002/4b); burada yazılan tam olarak o iki aşamadan biridir.
 *
 * HATA YUTULUR ama SESSİZ DEĞİLDİR: sipariş kaydı asıl olandır ve işaret
 * yazılamadı diye onu geri almak, kullanıcının girdiği bütün ticari veriyi
 * kaybettirirdi. Kaç işaretin yazıldığı çağırana döner ve ekran farkı söyler.
 */
async function siparisIsaretle(
  supabase: SupabaseClient,
  userId: string,
  satirlar: readonly { packageId: string | null; partKey: string }[],
  gun: string | null
): Promise<number> {
  const pakete = new Map<string, string[]>();
  for (const s of satirlar) {
    if (!s.packageId || !s.partKey) continue;
    const liste = pakete.get(s.packageId) ?? [];
    liste.push(s.partKey);
    pakete.set(s.packageId, liste);
  }
  if (pakete.size === 0) return 0;

  let yazilan = 0;
  for (const [packageId, anahtarlar] of pakete) {
    // Kalem numarası defterin KODLARINDAN türetilir (md. 18): paketin
    // `item_no` alanı yeniden yazılmış olabilir ve onunla yazmak satın alma
    // kaydını paket ekranında görünmez yapardı.
    const { data: defter } = await supabase
      .from("drawing_parts")
      .select("part_code")
      .eq("package_id", packageId);
    const kalemNo = registerItemNo(
      ((defter ?? []) as { part_code: string }[]).map((p) => ({ partCode: p.part_code ?? "" }))
    );

    const benzersiz = [...new Set(anahtarlar)];
    // Zaten işaretli olana DOKUNULMAZ: satınalmacının elle girdiği tarih ve
    // notu bir toplu hareket ezmemelidir (`markStage` ile aynı kural).
    const { data: mevcut } = await supabase
      .from("drawing_part_progress")
      .select("part_code")
      .eq("stage", PURCHASE_STAGE_SLUG)
      .in("part_code", benzersiz);
    const varOlan = new Set(((mevcut ?? []) as { part_code: string }[]).map((r) => r.part_code));

    const yuk = benzersiz
      .filter((k) => !varOlan.has(k))
      .map((k) => ({
        item_no: progressItemNo(k, kalemNo),
        part_code: k,
        stage: PURCHASE_STAGE_SLUG,
        qty_done: 0,
        done_at: gun,
        package_id: packageId,
        created_by: userId,
      }))
      .filter((r) => r.item_no);

    if (yuk.length === 0) continue;
    const { error } = await supabase.from("drawing_part_progress").insert(yuk);
    if (!error) yazilan += yuk.length;
    revalidatePath(`/drawings/${packageId}/purchasing`);
  }
  return yazilan;
}

/**
 * Sipariş açar — başlık + satırlar + paket işaretleri.
 *
 * SATIRLAR BİRDEN ÇOK PROJEYE AİT OLABİLİR (md. 7); başlık yalnız tedarikçiyi,
 * tarihleri ve ödeme koşulunu taşır.
 */
export async function createOrder(input: CreateOrderInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const o = parsed.data;

  const { data: baslik, error: baslikHatasi } = await supabase
    .from("purchase_orders")
    .insert({
      order_no: o.orderNo,
      supplier: o.supplier,
      ordered_at: o.orderedAt,
      due_at: o.dueAt,
      payment_method: o.paymentMethod,
      payment_term_days: o.paymentMethod === "vadeli" ? o.paymentTermDays : 0,
      advance_pct: o.advancePct && o.advancePct > 0 ? o.advancePct : null,
      advance_amount: o.advanceAmount && o.advanceAmount > 0 ? o.advanceAmount : null,
      currency: o.currency,
      fx_rate: o.currency === "EUR" ? 1 : o.fxRate,
      note: o.note,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (baslikHatasi) return { error: baslikHatasi.message };
  const orderId = baslik?.id as string | undefined;
  if (!orderId) return { error: "Sipariş kaydı oluşturulamadı." };

  const { error: satirHatasi } = await supabase.from("purchase_order_lines").insert(
    o.lines.map((l) => ({
      order_id: orderId,
      match_key: l.matchKey,
      sample: l.sample,
      item_no: l.itemNo,
      package_id: l.packageId,
      part_key: l.partKey,
      qty: l.qty,
      unit: l.unit,
      unit_price: l.unitPrice,
      note: l.note,
    }))
  );
  if (satirHatasi) {
    // Başlık yazıldı ama satırlar yazılamadı: BOŞ SİPARİŞ BIRAKILMAZ. Sıra
    // "önce ucuz olanı kaybet" ilkesinin tersi değil aynısıdır — burada
    // kaybedilecek hiçbir şey yok, yalnız yarım bir kayıt var.
    await supabase.from("purchase_orders").delete().eq("id", orderId);
    return { error: satirHatasi.message };
  }

  const isaret = await siparisIsaretle(supabase, userId, o.lines, o.orderedAt);
  tazele();
  return { ok: isaret, id: orderId };
}

/** Siparişin hâlini günceller: teslim alındı, avans ödendi, bakiye ödendi, iptal. */
export async function updateOrder(input: UpdateOrderInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...alanlar } = parsed.data;

  // Yalnız GÖNDERİLEN alanlar yazılır: `undefined` "dokunma", `null` "temizle"
  // demektir ve ikisi karıştırılmaz — tarihi silmek meşru bir işlemdir.
  const yuk: Record<string, unknown> = {};
  if ("dueAt" in alanlar) yuk.due_at = alanlar.dueAt;
  if ("receivedAt" in alanlar) yuk.received_at = alanlar.receivedAt;
  if ("advancePaidAt" in alanlar) yuk.advance_paid_at = alanlar.advancePaidAt;
  if ("balancePaidAt" in alanlar) yuk.balance_paid_at = alanlar.balancePaidAt;
  if ("cancelledAt" in alanlar) yuk.cancelled_at = alanlar.cancelledAt;
  if (alanlar.note !== undefined) yuk.note = alanlar.note;
  if (Object.keys(yuk).length === 0) return { ok: 0 };

  const { error } = await ctx.supabase.from("purchase_orders").update(yuk).eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/**
 * Siparişi siler.
 *
 * İPTAL ETMEK YETMEDİĞİ ZAMAN — yani sipariş YANLIŞLIKLA açıldığında. Doğru
 * refleks iptaldir (`cancelledAt`): iptal kaydı bırakır, silme bırakmaz.
 * Satırlar `on delete cascade` ile gider; paket ekranındaki "satın alındı"
 * işaretine DOKUNULMAZ — o işaret satınalmacının kendi kaydıdır ve siparişin
 * kopyası değildir.
 */
export async function deleteOrder(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = deleteOrderSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz sipariş." };

  const { error } = await ctx.supabase.from("purchase_orders").delete().eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

// ═══════════════════════════════════════════════════════ ANA GRUP DEFTERİ

/**
 * Grup adını elle yazar ya da düzeltir.
 *
 * `manual = true` işaretlenir: içe aktarım bir daha bu adı EZMEZ. Kategori
 * düzeltme defteriyle aynı felsefe — insanın verdiği karar, bir sonraki
 * eşleştirmede tahmine yenilmemelidir.
 */
export async function saveGroupName(
  input: SaveGroupNameInput
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveGroupNameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { groupCode, name } = parsed.data;

  if (!name) {
    const { error } = await supabase
      .from("drawing_group_names")
      .delete()
      .eq("group_code", groupCode);
    if (error) return { error: error.message };
    tazele();
    return { ok: 0 };
  }

  const { error } = await supabase
    .from("drawing_group_names")
    .upsert(
      { group_code: groupCode, name, manual: true, created_by: userId },
      { onConflict: "group_code" }
    );
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}
