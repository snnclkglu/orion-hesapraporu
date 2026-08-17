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
import { canEditPurchasing, isAdminRole } from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";
import { anahtarla, loadArsivOlaylari, loadSiparisNolari, type ArsivOlayi } from "./data";
import { trKatla } from "@/lib/drawings/tr-text";
import { PURCHASE_STAGE_SLUG, progressItemNo, registerItemNo } from "@/lib/drawings/progress";
import { siparisNoCakisiyorMu } from "@/lib/purchasing/order-no";
import { talepBasligi, talepImzasi } from "@/lib/purchasing/talep";
import { bugunISO } from "@/lib/purchasing/terms";
import {
  cancelQuoteBatchSchema,
  chooseQuoteSchema,
  createManualDemandSchema,
  createOrderSchema,
  deleteOrderSchema,
  deleteQuoteSchema,
  editOrderSchema,
  editQuoteBatchSchema,
  ensureQualitySchema,
  mergeQuoteBatchesSchema,
  mergeQuoteRequestsSchema,
  quoteBatchIdSchema,
  renameQuoteRequestSchema,
  saveBulkQuoteSchema,
  splitQuoteBatchSchema,
  saveDemandOverrideSchema,
  saveGroupNameSchema,
  saveItemMetaSchema,
  saveQuoteSchema,
  updateOrderSchema,
  type CreateManualDemandInput,
  type CreateOrderInput,
  type EditOrderInput,
  type EditQuoteBatchInput,
  type EnsureQualityInput,
  type PurchasingActionResult,
  type SaveBulkQuoteInput,
  type SaveDemandOverrideInput,
  type SaveGroupNameInput,
  type SaveItemMetaInput,
  type SaveQuoteInput,
  type UpdateOrderInput,
} from "./schema";

type Ctx = { supabase: SupabaseClient; userId: string };

/**
 * Yazma yetkisi — TEK BİR SÜTUNDAN, rolden.
 *
 * Burada bir süre "rol VE etiket birlikte okunur" yazıyordu ve yanındaki kod
 * `tags` sütununu zengin/dar sorgu ikilisiyle çekiyordu; görev etiketleri
 * 12.08.2026'da role dönüşüp sütun düşürülünce ikisi de kalktı.
 */
async function requireWrite(): Promise<Ctx | { error: string }> {
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

  if (!canEditPurchasing(profil?.role)) {
    return { error: "Bu işlem için Satın Alma yetkisi gerekir." };
  }
  return { supabase, userId: user.id };
}

function tazele() {
  revalidatePath("/purchasing");
  // HAMMADDE HAVUZU DA ESKİR: sipariş ve teklif anahtarları iki havuzda
  // ORTAKTIR (`match_key`), yani bir sac plakasına verilen sipariş hammadde
  // ekranındaki "Kalan" sütununu da değiştirir.
  revalidatePath("/purchasing/hammadde");
  revalidatePath("/purchasing/hammadde/yerlesim");
  revalidatePath("/purchasing/hammadde/teklifler");
  revalidatePath("/purchasing/siparisler");
  revalidatePath("/purchasing/teslimat");
  revalidatePath("/purchasing/fiyatlar");
  // TEKNİK RESİMLER'İN ÖZETİ DE ESKİR. Mühendisin gördüğü "geldi mi" cevabı
  // buradaki her sipariş hareketinden türer (12.08.2026 kararı); teslim
  // işaretlendiği hâlde ressamın ekranında "yolda" yazması, o ekranın güvenini
  // ilk günden bitirirdi. Hangi paketleri etkilediği burada BİLİNMEZ —
  // `updateOrder` yalnız sipariş kimliği alır — bu yüzden dinamik yolun
  // TAMAMI tazelenir (`type: "page"`).
  revalidatePath("/drawings/[id]/purchasing", "page");
  // TEDARİKÇİ DEFTERİ ARTIK YÖNETİMDEDİR (13.08.2026): sipariş penceresinden
  // açılan bir firma o listede de anında görünmelidir, yoksa yönetici defteri
  // eksik sanıp aynı firmayı ikinci kez yazar.
  revalidatePath("/admin/suppliers");
}

// ═══════════════════════════════════════════════════════════════ TEKLİFLER

/**
 * Teklif kaydeder (yeni ya da düzeltme).
 *
 * "TEKLİF ALINDI" AYRI BİR İŞARET DEĞİLDİR: kalemin bir teklifi varsa teklif
 * alınmıştır. Ayrı bir boolean tutulsaydı iki gerçek ayrışabilir ve ekran
 * "alındı" derken listede tek fiyat görünmeyebilirdi.
 */
/**
 * BİR TEKLİF SATIRININ PARTİSİNİ BULUR YA DA AÇAR.
 *
 * Tek kalemlik teklif penceresinden girilen fiyatlar da bir koda bağlanmalı
 * (kullanıcı kararı: *"Her teklif aç dediğimde bu benzersiz bir kodla takip
 * edilebilsin"*) — ama her satır için ayrı bir parti açmak defteri gereksiz
 * şişirirdi: satınalmacı aynı firmanın üç kalemine arka arkaya fiyat girerken
 * TEK bir teklifi giriyordur.
 *
 * Bu yüzden AYNI GÜN + AYNI FİRMA + AÇIK parti yeniden kullanılır. Toplu
 * "Teklif Aç" ise HER ZAMAN yeni bir parti açar: orada kullanıcının kendisi
 * "bu ayrı bir teklif" demiştir.
 *
 * PARTİ AÇILAMAZSA TEKLİF YİNE KAYDEDİLİR (`null` döner): kod bir künyedir,
 * fiyatın kendisi değil — migration uygulanmamış bir ortamda teklif girmeyi
 * durdurmak, kullanıcının asıl işini engellemek olurdu.
 */
async function partiBulVeyaAc(
  supabase: SupabaseClient,
  userId: string,
  firma: string,
  gun: string,
  scope: string
): Promise<string | null> {
  const { data: mevcut, error } = await supabase
    .from("purchase_quote_batches")
    .select("id")
    .eq("supplier", firma)
    .eq("quoted_at", gun)
    .eq("status", "acik")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (mevcut?.id) return String(mevcut.id);

  const { data } = await supabase
    .from("purchase_quote_batches")
    .insert({ supplier: firma, quoted_at: gun, scope, created_by: userId })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function saveQuote(input: SaveQuoteInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveQuoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const q = parsed.data;

  const gunu = q.quotedAt ?? new Date().toISOString().slice(0, 10);
  const partiId = q.id
    ? null // düzenlemede parti DEĞİŞMEZ: teklif nereye girdiyse orada kalır.
    : (q.batchId ?? (await partiBulVeyaAc(supabase, userId, q.supplier, gunu, q.scope)));

  const yuk = {
    match_key: q.matchKey,
    sample: q.sample,
    supplier: q.supplier,
    unit_price: q.unitPrice,
    currency: q.currency,
    fx_rate: q.currency === "EUR" ? 1 : q.fxRate,
    quoted_at: q.quotedAt ?? new Date().toISOString().slice(0, 10),
    valid_until: q.validUntil,
    // VADE VE TESLİM SÜRESİ (15.08.2026): karşılaştırma tablosunun iki
    // sütunu. `payment_method` "vadeli" değilse gün SIFIRLANIR — "peşin ve
    // 90 gün" birbirini yalanlayan bir kayıttır.
    payment_method: q.paymentMethod,
    payment_term_days: q.paymentMethod === "vadeli" ? q.paymentTermDays : 0,
    lead_time_days: q.leadTimeDays,
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
    .insert({ ...yuk, ...(partiId ? { batch_id: partiId } : {}), created_by: userId })
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  tazele();
  return { ok: 1, id: (data?.id as string) ?? undefined };
}

// ═════════════════════════════════════════════════════════ TEKLİF PARTİSİ

/**
 * TOPLU TEKLİF — bir firmanın bir teklifi, tek kodla.
 *
 * Eskiden pencere satır satır `saveQuote` çağırıyordu; on beş kalemde on beş
 * gidiş-dönüş ve — daha kötüsü — ortada kesilirse YARIM bir teklif. Artık
 * satırlar TEK `insert` ile yazılır ve hepsi aynı partiye bağlanır. Yazma
 * başarısız olursa açılan boş parti geri alınır: kodu tüketilmiş ama satırı
 * olmayan bir teklif, listede cevaplanamayan bir soru olurdu.
 */
export async function saveBulkQuote(input: SaveBulkQuoteInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveBulkQuoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const gunu = v.quotedAt ?? new Date().toISOString().slice(0, 10);

  // TALEP ÖNCE ÇÖZÜLÜR: parti onun altına açılır ve kullanıcı "aynı teklifi
  // ikinci firmadan aldım" dediğinde ikisi kendiliğinden yan yana gelir.
  const talepId = await talepBulVeyaAc(supabase, userId, {
    requestId: v.requestId ?? null,
    scope: v.scope,
    anahtarlar: v.satirlar.map((s) => s.matchKey),
    tanimlar: v.satirlar.map((s) => s.sample),
  });

  const { data: parti, error: partiHata } = await supabase
    .from("purchase_quote_batches")
    .insert({
      supplier: v.supplier,
      quoted_at: gunu,
      scope: v.scope,
      note: v.note,
      ...(talepId ? { request_id: talepId } : {}),
      created_by: userId,
    })
    .select("id, code")
    .maybeSingle();
  if (partiHata) return { error: partiHata.message };

  const partiId = (parti?.id as string) ?? null;
  const { error } = await supabase.from("purchase_quotes").insert(
    v.satirlar.map((s) => ({
      match_key: s.matchKey,
      sample: s.sample,
      supplier: v.supplier,
      unit_price: s.unitPrice,
      currency: v.currency,
      fx_rate: v.currency === "EUR" ? 1 : v.fxRate,
      // MİKTAR TEKLİFLE BİRLİKTE DONAR — ama yalnız bir YEDEKtir
      // (`teklifMiktari`): havuzda karşılığı olan kalemde havuz konuşur.
      // Plakanın havuzda karşılığı yoktur ve bu sayı olmadan karşılaştırmanın
      // "Tutar" sütunu orada kalıcı olarak boş kalırdı.
      qty: s.qty,
      unit: s.unit,
      quoted_at: gunu,
      payment_method: v.paymentMethod,
      payment_term_days: v.paymentMethod === "vadeli" ? v.paymentTermDays : 0,
      // TESLİM SÜRESİ SATIRDA ÇÖZÜLMÜŞ GELİR (şemanın gerekçesi): toplu seçim
      // ile kalem bazındaki değişikliği pencere birleştirir, sunucu yedekleme
      // yapmaz — `null` "sorulmadı" demektir ve başka bir şeye dönüşemez.
      lead_time_days: s.leadTimeDays,
      note: v.note,
      item_no: "",
      package_id: null,
      ...(partiId ? { batch_id: partiId } : {}),
      created_by: userId,
    }))
  );
  if (error) {
    if (partiId) await supabase.from("purchase_quote_batches").delete().eq("id", partiId);
    return { error: error.message };
  }

  tazele();
  return { ok: v.satirlar.length, id: partiId ?? undefined, no: (parti?.code as string) ?? "" };
}

// ═════════════════════════════════════════════════════════ TEKLİF TALEBİ

/**
 * TALEBİ BULUR YA DA AÇAR — kalem kümesinin imzasından.
 *
 * Kullanıcıya "bu teklif hangi talebe ait" diye SORULMAZ (migration
 * 20260815000007'nin gerekçesi): üç firmaya aynı listeyi gönderen kullanıcı
 * üçünün yan yana gelmesini bekler, üç kez de aynı soruyu cevaplamayı değil.
 *
 * TALEP AÇILAMAZSA TEKLİF YİNE KAYDEDİLİR (`null` döner) — `partiBulVeyaAc`ın
 * kuralının aynısı: talep bir künyedir, fiyatın kendisi değil. Migration
 * uygulanmamış bir ortamda teklif girmeyi durdurmak, kullanıcının asıl işini
 * engellemek olurdu.
 */
async function talepBulVeyaAc(
  supabase: SupabaseClient,
  userId: string,
  v: {
    requestId: string | null;
    scope: string;
    anahtarlar: readonly string[];
    tanimlar: readonly string[];
  }
): Promise<string | null> {
  if (v.requestId) return v.requestId;

  const imza = talepImzasi(v.anahtarlar);
  const { data: mevcut, error } = await supabase
    .from("purchase_quote_requests")
    .select("id")
    .eq("scope", v.scope)
    .eq("signature", imza)
    .eq("status", "acik")
    .limit(1)
    .maybeSingle();
  // Tablo yoksa (migration uygulanmamış) teklif yine kaydedilir.
  if (error) return null;
  if (mevcut?.id) return String(mevcut.id);

  const { data } = await supabase
    .from("purchase_quote_requests")
    .insert({
      scope: v.scope,
      signature: imza,
      title: talepBasligi(v.tanimlar),
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * TALEPLERİ BİRLEŞTİR — "bu teklifleri aynı yerde karşılaştırayım".
 *
 * Parti birleştirmesinin (`mergeQuoteBatches`) AYNI FİRMA şartı BURADA YOKTUR
 * ve bu bir gevşeme değil, farklı bir sorudur: orada iki liste TEK bir firmanın
 * teklifi hâline geliyordu, burada firmalar ayrı ayrı duruyor ve yalnız
 * karşılaştırma kapsamı birleşiyor. Talebin tanımı zaten "birkaç firmanın
 * cevapladığı soru"dur.
 *
 * BOŞALAN TALEP SİLİNİR: kod defterde bir boşluk bırakır ve bu kabul edilmiştir
 * (sayaç kuralı) — kalemi ve firması olmayan bir talep, listede cevaplanamayan
 * bir satır olurdu.
 */
export async function mergeQuoteRequests(
  hedefId: string,
  kaynakIdler: string[]
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = mergeQuoteRequestsSchema.safeParse({ hedefId, kaynakIdler });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const kaynaklar = [...new Set(v.kaynakIdler)].filter((k) => k !== v.hedefId);
  if (kaynaklar.length === 0) return { error: "Birleştirmek için ikinci bir teklif seçin." };

  const { data: hedef } = await supabase
    .from("purchase_quote_requests")
    .select("id, code, signature")
    .eq("id", v.hedefId)
    .maybeSingle();
  if (!hedef) return { error: "Hedef teklif bulunamadı." };

  const { error: tasima } = await supabase
    .from("purchase_quote_batches")
    .update({ request_id: v.hedefId })
    .in("request_id", kaynaklar);
  if (tasima) return { error: tasima.message };

  // İMZA ARTIK BİRLEŞİK KÜMEDİR: yazılmasaydı, kaynak talebin kalem kümesiyle
  // gelen bir sonraki teklif eski (artık boş) talebi arar, bulamaz ve üçüncü
  // bir talep açardı — kullanıcı aynı birleştirmeyi her seferinde yeniden
  // yapmak zorunda kalırdı.
  const { data: satirlar } = await supabase
    .from("purchase_quotes")
    .select("match_key, purchase_quote_batches!inner (request_id)")
    .eq("purchase_quote_batches.request_id", v.hedefId);
  const anahtarlar = ((satirlar ?? []) as { match_key: string }[]).map((r) => String(r.match_key));
  if (anahtarlar.length > 0) {
    await supabase
      .from("purchase_quote_requests")
      .update({ signature: talepImzasi(anahtarlar) })
      .eq("id", v.hedefId);
  }

  const { error } = await supabase
    .from("purchase_quote_requests")
    .delete()
    .in("id", kaynaklar);
  if (error) return { error: error.message };

  tazele();
  return { ok: kaynaklar.length, no: String(hedef.code ?? "") };
}

/**
 * TEKLİFİ AYIR — bir firmanın cevabını talebin dışına çıkarır.
 *
 * Kullanıcı isteği: *"teklifi ayır"*. Otomatik eşleşme kalem kümesine bakar ve
 * bazen fazla cömerttir: aynı kalemler için iki HAFTA arayla alınmış fiyatlar
 * tek talebe düşer, oysa onlar iki ayrı pazarlıktır. Ayırmak o kararı insana
 * geri verir.
 *
 * YENİ TALEP AYRILAN PARTİNİN KENDİ KALEM KÜMESİNİ alır; imzası eskisiyle aynı
 * olacağı için `status` 'kapali' yazılır — açık bırakılsaydı bir sonraki teklif
 * ayrılmış talebe geri düşer ve ayırma kendiliğinden geri alınmış olurdu.
 */
export async function splitQuoteBatch(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = splitQuoteBatchSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { data: parti } = await supabase
    .from("purchase_quote_batches")
    .select("id, code, supplier, scope, request_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!parti) return { error: "Teklif bulunamadı." };

  const { data: satirlar } = await supabase
    .from("purchase_quotes")
    .select("match_key, sample")
    .eq("batch_id", parsed.data.id);
  const liste = (satirlar ?? []) as { match_key: string; sample: string }[];

  const { data: yeni, error: acmaHatasi } = await supabase
    .from("purchase_quote_requests")
    .insert({
      scope: String(parti.scope ?? "hammadde"),
      signature: talepImzasi(liste.map((r) => String(r.match_key))),
      title: `${talepBasligi(liste.map((r) => String(r.sample)))} · ${parti.supplier}`,
      status: "kapali",
      note: "Ayrılmış teklif",
      created_by: userId,
    })
    .select("id, code")
    .maybeSingle();
  if (acmaHatasi) return { error: acmaHatasi.message };

  const { error } = await supabase
    .from("purchase_quote_batches")
    .update({ request_id: yeni?.id ?? null })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  // Kaynağı boşaldıysa temizle — ayırma bir ARTIK bırakmamalı.
  if (parti.request_id) await bosTalebiSil(supabase, String(parti.request_id));

  tazele();
  return { ok: 1, no: String(yeni?.code ?? "") };
}

/** Kullanıcının verdiği ad, türetilen addan her zaman iyidir. */
export async function renameQuoteRequest(
  id: string,
  title: string
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = renameQuoteRequestSchema.safeParse({ id, title });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase
    .from("purchase_quote_requests")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/** Partisi kalmamış talebi siler; hiçbir eylem arkasında ölü satır bırakmaz. */
async function bosTalebiSil(supabase: SupabaseClient, talepId: string): Promise<void> {
  const { count } = await supabase
    .from("purchase_quote_batches")
    .select("id", { count: "exact", head: true })
    .eq("request_id", talepId);
  if ((count ?? 0) === 0) await supabase.from("purchase_quote_requests").delete().eq("id", talepId);
}

/** Partinin başlığını ve satır fiyatlarını yeniden yazar. */
export async function editQuoteBatch(input: EditQuoteBatchInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = editQuoteBatchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const gunu = v.quotedAt ?? new Date().toISOString().slice(0, 10);

  const { error: basHata } = await supabase
    .from("purchase_quote_batches")
    .update({ supplier: v.supplier, quoted_at: gunu, note: v.note })
    .eq("id", v.id);
  if (basHata) return { error: basHata.message };

  // SATIRLAR KİMLİKLE GÜNCELLENİR (silip-yazma YOK): teklifin kimliği fiyat
  // arşivinde ve "kazanan" işaretinde yaşıyor.
  for (const s of v.satirlar) {
    const { error } = await supabase
      .from("purchase_quotes")
      .update({
        supplier: v.supplier,
        quoted_at: gunu,
        unit_price: s.unitPrice,
        currency: v.currency,
        fx_rate: v.currency === "EUR" ? 1 : v.fxRate,
        payment_method: v.paymentMethod,
        payment_term_days: v.paymentMethod === "vadeli" ? v.paymentTermDays : 0,
        lead_time_days: s.leadTimeDays,
      })
      .eq("id", s.id)
      .eq("batch_id", v.id);
    if (error) return { error: error.message };
  }

  // YÜKTE OLMAYAN SATIR SİLİNİR: kullanıcı kalemi listeden çıkardıysa o teklif
  // gerçekten geri alınmıştır.
  const kalanlar = v.satirlar.map((s) => s.id);
  let silme = supabase.from("purchase_quotes").delete().eq("batch_id", v.id);
  if (kalanlar.length > 0) silme = silme.not("id", "in", `(${kalanlar.join(",")})`);
  const { error: silHata } = await silme;
  if (silHata) return { error: silHata.message };

  tazele();
  return { ok: v.satirlar.length };
}

/**
 * TEKLİFİ İPTAL ET — silme DEĞİL.
 *
 * İptal edilmiş parti karşılaştırmaya, havuzun "en iyi fiyat" sütununa ve
 * fiyat arşivine GİRMEZ (`loadTeklifler` süzer) ama defterde durur: bir teklif
 * geri çekildiğinde onun var olduğu bilgisi de bir bilgidir ve geri alınabilir
 * olmalıdır (siparişin `reopenOrder` kuralının aynısı).
 */
export async function cancelQuoteBatch(
  id: string,
  reason = ""
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = cancelQuoteBatchSchema.safeParse({ id, reason });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { error } = await ctx.supabase
    .from("purchase_quote_batches")
    .update({
      status: "iptal",
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

export async function reopenQuoteBatch(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = quoteBatchIdSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { error } = await ctx.supabase
    .from("purchase_quote_batches")
    .update({ status: "acik", cancelled_at: null, cancel_reason: "" })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/**
 * TEKLİFİ SİL — yalnız YÖNETİCİ ve yalnız İPTAL EDİLMİŞ parti.
 *
 * `deleteOrder` ile birebir aynı kelepçe: silmenin önünde iptal adımı durur,
 * yani kimse tek tıkla bir teklifi yok edemez. Satırlar da gider (teklifin
 * kendisi onlardır); fiyat arşivi kaydı `purchase_price_index` üzerinden
 * teklife bağlı olduğu için o da kapanır — istenen budur, iptal edilmiş bir
 * teklif bir fiyat kanıtı değildir.
 */
export async function deleteQuoteBatch(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!isAdminRole(profil?.role)) return { error: "Teklifi yalnız yönetici silebilir." };

  const parsed = quoteBatchIdSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz teklif." };

  const { data: parti } = await supabase
    .from("purchase_quote_batches")
    .select("status, request_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!parti) return { error: "Teklif bulunamadı." };
  if (parti.status !== "iptal") {
    return { error: "Önce teklifi iptal edin; silme yalnız iptal edilmiş teklifte yapılır." };
  }

  const { error: satirHata } = await supabase
    .from("purchase_quotes")
    .delete()
    .eq("batch_id", parsed.data.id);
  if (satirHata) return { error: satirHata.message };

  const { error } = await supabase
    .from("purchase_quote_batches")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  // Son firma da silindiyse TALEP DE GİDER: kimsenin cevaplamadığı bir soru
  // listede boş bir satır olurdu.
  if (parti.request_id) await bosTalebiSil(supabase, String(parti.request_id));

  tazele();
  return { ok: 1 };
}

/**
 * PARTİLERİ BİRLEŞTİR — aynı firmanın ayrı ayrı girilmiş teklifleri tek kodda.
 *
 * Kaynak partiler SİLİNMEZ: satırları hedefe taşınır ve kendileri iptal
 * damgası alır ("TK0007 ile birleştirildi"). Silinselerdi kod defterde bir
 * boşluk bırakır ve "TK0004 neydi" sorusu cevapsız kalırdı.
 */
export async function mergeQuoteBatches(
  hedefId: string,
  kaynakIdler: string[]
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = mergeQuoteBatchesSchema.safeParse({ hedefId, kaynakIdler });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const kaynaklar = v.kaynakIdler.filter((k) => k !== v.hedefId);
  if (kaynaklar.length === 0) return { error: "Birleştirilecek ikinci bir teklif seçin." };

  const { data: partiler } = await supabase
    .from("purchase_quote_batches")
    .select("id, code, supplier")
    .in("id", [v.hedefId, ...kaynaklar]);
  const liste = (partiler ?? []) as { id: string; code: string; supplier: string }[];
  const hedef = liste.find((p) => p.id === v.hedefId);
  if (!hedef) return { error: "Hedef teklif bulunamadı." };

  // AYNI FİRMA ŞARTI (şemanın gerekçesi): parti "bir firmanın bir teklifi"dir.
  const farkli = liste.find((p) => p.supplier !== hedef.supplier);
  if (farkli) {
    return {
      error: `Yalnız aynı firmanın teklifleri birleştirilir (${hedef.supplier} ≠ ${farkli.supplier}).`,
    };
  }

  const { error: tasima } = await supabase
    .from("purchase_quotes")
    .update({ batch_id: v.hedefId })
    .in("batch_id", kaynaklar);
  if (tasima) return { error: tasima.message };

  const { error } = await supabase
    .from("purchase_quote_batches")
    .update({
      status: "iptal",
      cancelled_at: new Date().toISOString(),
      cancel_reason: `${hedef.code} ile birleştirildi`,
    })
    .in("id", kaynaklar);
  if (error) return { error: error.message };

  tazele();
  return { ok: kaynaklar.length, no: hedef.code };
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
    // Kalem numarası defterin KODLARINDAN türetilir (RESIM-18): paketin
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

  // NUMARA ÇAKIŞMASI SUNUCUDA DA SORULUR. Ekran öneriyi kendi listesinden
  // üretir ve o liste sayfanın açıldığı andaki fotoğraftır; iki satınalmacı
  // aynı dakikada sipariş açarsa ikisi de aynı numarayı önerir.
  if (siparisNoCakisiyorMu(o.orderNo, await loadSiparisNolari(supabase))) {
    return { error: `"${o.orderNo}" numarası başka bir siparişte kullanılıyor.` };
  }

  // YENİ FİRMA KENDİLİĞİNDEN DEFTERE GİRER (kullanıcı kararı, 13.08.2026).
  // Pencere bunu tedarikçi alanından çıkılırken zaten yapıyor (kodu görmek
  // için); burası o yolun KAPANMADIĞINI garanti eder — klavyeyle doldurulup
  // doğrudan kaydedilen bir pencere defteri atlardı. Hata YUTULUR: defter bir
  // öneri kaynağıdır, siparişin şartı değil.
  await firmayiDeftereYaz(supabase, userId, o.supplier);

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
      // FİYAT KDV HARİÇ YAZILIR; oran ayrı bir sütundur ve ödenecek tutarı
      // yalnız ödeme takvimi büyütür (SATIN-21).
      unit_price: l.unitPrice,
      vat_rate: l.vatRate,
      quality: l.quality ?? "",
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

  // İPTAL EDİLEN SİPARİŞ TALEP HAVUZUNA GERİ DÜŞER — İŞARETİYLE BİRLİKTE.
  //
  // Kullanıcı bildirimi (13.08.2026): *"Siparişler sayfasında siparişi iptal
  // ettiğimde talep havuzuna geri düşsün istiyorum."* Havuzun ADEDİ zaten
  // düşüyordu (`loadSiparisler` iptalleri hiç okumaz) ama paketin Satın Alma
  // sekmesindeki `satinalindi` İŞARETİ kalıyordu: canlı veride ölçüldü,
  // iptal edilmiş üç sipariş satırının üçü de hâlâ işaretliydi. Atölye ve
  // mühendis o ekrana bakıyor ve "ısmarlandı" görüyordu — oysa sipariş yok.
  //
  // İŞARET YALNIZ BAŞKA CANLI SİPARİŞ YOKSA KALDIRILIR. Aynı kalem iki ayrı
  // siparişte geçebilir; birini iptal etmek diğerinin kaydını silmemelidir.
  if (yuk.cancelled_at) {
    await siparisIsaretleriniKaldir(ctx.supabase, id);
  }

  tazele();
  return { ok: 1 };
}

/**
 * Bir siparişin yazdığı `satinalindi` işaretlerini geri alır.
 *
 * TESLİM ALINDI İŞARETİNE DOKUNULMAZ: o, malın fiziksel olarak geldiğini
 * söyler ve siparişin iptali onu yalanlamaz — gelmiş bir malı "gelmedi"
 * yapmak, atölyenin elindeki gerçeği silmek olurdu.
 *
 * SESSİZ BAŞARISIZLIK KABUL: işaret silinemezse sipariş yine iptal olur.
 * İptali bir yan kayıt yüzünden düşürmek, kullanıcıyı iptal edemez hâle
 * getirirdi.
 */
async function siparisIsaretleriniKaldir(
  supabase: Ctx["supabase"],
  orderId: string
): Promise<void> {
  const { data: satirlar } = await supabase
    .from("purchase_order_lines")
    .select("part_key, package_id")
    .eq("order_id", orderId);
  await anahtarIsaretleriniKaldir(
    supabase,
    (satirlar ?? []) as { part_key: string; package_id: string | null }[],
    orderId
  );
}

/**
 * Verilen satırların paket işaretlerini geri alır.
 *
 * `siparisIsaretleriniKaldir` bunu siparişin TAMAMI için çağırır (iptal),
 * `editOrder` ise yalnız ÇIKARILAN satırlar için (düzenleme). Kural ikisinde de
 * aynıdır ve tek yerde durur: başka CANLI siparişte geçen anahtar korunur.
 */
async function anahtarIsaretleriniKaldir(
  supabase: Ctx["supabase"],
  satirlar: readonly { part_key: string; package_id: string | null }[],
  haricOrderId: string
): Promise<void> {
  const anahtarlar = [...new Set(satirlar.map((r) => r.part_key).filter(Boolean))];
  if (anahtarlar.length === 0) return;
  const orderId = haricOrderId;

  // Başka CANLI siparişte geçen anahtarlar korunur.
  const { data: digerleri } = await supabase
    .from("purchase_order_lines")
    .select("part_key, purchase_orders!inner (cancelled_at)")
    .in("part_key", anahtarlar)
    .neq("order_id", orderId)
    .is("purchase_orders.cancelled_at", null);
  const korunan = new Set(
    ((digerleri ?? []) as { part_key: string }[]).map((r) => r.part_key)
  );

  const silinecek = anahtarlar.filter((k) => !korunan.has(k));
  if (silinecek.length === 0) return;

  await supabase
    .from("drawing_part_progress")
    .delete()
    .eq("stage", PURCHASE_STAGE_SLUG)
    .in("part_code", silinecek);

  const paketler = [
    ...new Set(
      ((satirlar ?? []) as unknown as { package_id: string | null }[])
        .map((r) => r.package_id)
        .filter((x): x is string => Boolean(x))
    ),
  ];
  for (const p of paketler) revalidatePath(`/drawings/${p}/purchasing`);
}

/**
 * Verilmiş bir siparişi DÜZENLER — başlık + var olan satırlar.
 *
 * Kullanıcı kararı (13.08.2026): *"Siparişler sayfasında önceden girilen
 * sipariş düzenlenebilsin."* Gerekçe ve sınırlar `editOrderSchema`da yazılı.
 *
 * SATIR KİMLİĞİYLE GÜNCELLENİR, silinip yeniden yazılmaz: `received_qty` o
 * satırın kendi geçmişidir ve kısmi teslim almış bir siparişte fiyatı
 * düzeltmek, gelen malı "gelmedi" yapmamalıdır. Bu yüzden `upsert` yükünde
 * `received_qty` HİÇ GEÇMEZ — PostgREST yalnız gönderilen sütunları yazar.
 *
 * BAŞKA SİPARİŞİN SATIRI TAŞINAMAZ: gelen kimliklerin hepsi bu siparişe ait
 * olmalıdır. Kontrol bir güvenlik kapısı değil (RLS zaten var) bir BÜTÜNLÜK
 * kapısıdır — açık duran eski bir sekmeden gelen istek, başka bir siparişin
 * satırını sessizce buraya çekebilirdi.
 */
export async function editOrder(input: EditOrderInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = editOrderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const o = parsed.data;

  const { data: mevcut } = await supabase
    .from("purchase_orders")
    .select("order_no")
    .eq("id", o.id)
    .maybeSingle();
  if (!mevcut) return { error: "Sipariş bulunamadı." };

  if (
    siparisNoCakisiyorMu(
      o.orderNo,
      await loadSiparisNolari(supabase),
      String((mevcut as { order_no: string }).order_no ?? "")
    )
  ) {
    return { error: `"${o.orderNo}" numarası başka bir siparişte kullanılıyor.` };
  }

  const { data: eskiVerisi } = await supabase
    .from("purchase_order_lines")
    .select("id, part_key, package_id")
    .eq("order_id", o.id);
  const eski = (eskiVerisi ?? []) as { id: string; part_key: string; package_id: string | null }[];
  const bilinen = new Set(eski.map((e) => e.id));
  if (o.lines.some((l) => !bilinen.has(l.id))) {
    return { error: "Sipariş satırı bulunamadı; sayfayı yenileyip tekrar deneyin." };
  }

  await firmayiDeftereYaz(supabase, userId, o.supplier);

  const { error: baslikHatasi } = await supabase
    .from("purchase_orders")
    .update({
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
    })
    .eq("id", o.id);
  if (baslikHatasi) return { error: baslikHatasi.message };

  const { error: satirHatasi } = await supabase.from("purchase_order_lines").upsert(
    o.lines.map((l) => ({
      id: l.id,
      order_id: o.id,
      match_key: l.matchKey,
      sample: l.sample,
      item_no: l.itemNo,
      package_id: l.packageId,
      part_key: l.partKey,
      qty: l.qty,
      unit: l.unit,
      unit_price: l.unitPrice,
      vat_rate: l.vatRate,
      quality: l.quality ?? "",
      note: l.note,
    })),
    { onConflict: "id" }
  );
  if (satirHatasi) return { error: satirHatasi.message };

  // ÇIKARILAN SATIRIN İŞARETİ DE GİDER (iptal kuralının aynısı): sipariş
  // edilmemiş bir kalem paket ekranında "ısmarlandı" görünmeye devam ederse
  // atölye onu bekler ve kimse yeniden sipariş etmez.
  const kalan = new Set(o.lines.map((l) => l.id));
  const cikarilan = eski.filter((e) => !kalan.has(e.id));
  if (cikarilan.length > 0) {
    const { error: silmeHatasi } = await supabase
      .from("purchase_order_lines")
      .delete()
      .in(
        "id",
        cikarilan.map((c) => c.id)
      );
    if (silmeHatasi) return { error: silmeHatasi.message };
    await anahtarIsaretleriniKaldir(supabase, cikarilan, o.id);
  }

  tazele();
  return { ok: o.lines.length };
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

/**
 * İPTAL EDİLMİŞ BİR SİPARİŞİ GERİ AÇAR (kullanıcı kararı, 14.08.2026:
 * *"Yanlışlıkla iptal etmiş olabilir, siparişi geri açma özelliği de olsun."*).
 *
 * İptal `cancelled_at`i yazar ve paket işaretlerini KALDIRIR; geri açmak ikisini
 * de tersine çevirir: damga temizlenir ve satırların paket "satın alındı"
 * işaretleri yeniden yazılır (iptalin aynadaki hareketi). Yalnız İPTAL EDİLMİŞ
 * bir sipariş geri açılabilir — açık bir siparişi "geri açmak" anlamsızdır.
 */
export async function reopenOrder(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;
  const parsed = deleteOrderSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz sipariş." };

  const { data: mevcut } = await supabase
    .from("purchase_orders")
    .select("ordered_at, cancelled_at")
    .eq("id", id)
    .maybeSingle();
  if (!mevcut) return { error: "Sipariş bulunamadı." };
  if (!(mevcut as { cancelled_at: string | null }).cancelled_at) {
    return { error: "Sipariş zaten açık." };
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ cancelled_at: null })
    .eq("id", id);
  if (error) return { error: error.message };

  const { data: satirlar } = await supabase
    .from("purchase_order_lines")
    .select("part_key, package_id")
    .eq("order_id", id);
  const isaret = await siparisIsaretle(
    supabase,
    userId,
    ((satirlar ?? []) as { part_key: string; package_id: string | null }[]).map((r) => ({
      partKey: r.part_key,
      packageId: r.package_id,
    })),
    String((mevcut as { ordered_at: string | null }).ordered_at ?? "") || null
  );
  tazele();
  return { ok: isaret };
}

/**
 * KALEM BAZINDA TESLİM — Teslim Takvimi'nden yazılır (kullanıcı kararı,
 * 14.08.2026). Satırın `received_qty`si güncellenir; siparişin `received_at`i
 * TÜREVDİR: bütün satırlar tamamlandığında (received ≥ qty) bugüne yazılır,
 * biri bile eksikse temizlenir. Böylece "teslim alındı" tek bir gerçekten
 * (kısmi mi tam mı) okunur, iki ayrı yere elle girilmez.
 *
 * `updates` boş bırakılamaz; her satır bu siparişe ait olmalıdır (bütünlük
 * kapısı, `editOrder`daki kuralın aynısı).
 */
export async function receiveOrderLines(input: {
  orderId: string;
  updates: { lineId: string; receivedQty: number }[];
}): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const orderId = String(input.orderId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { error: "Geçersiz sipariş." };
  const updates = (input.updates ?? []).filter((u) => /^[0-9a-f-]{36}$/i.test(u.lineId));
  if (updates.length === 0) return { error: "Güncellenecek satır yok." };

  const { data: satirVerisi } = await supabase
    .from("purchase_order_lines")
    .select("id, qty")
    .eq("order_id", orderId);
  const satirlar = (satirVerisi ?? []) as { id: string; qty: number }[];
  const bilinen = new Map(satirlar.map((s) => [s.id, Number(s.qty)]));
  if (updates.some((u) => !bilinen.has(u.lineId))) {
    return { error: "Sipariş satırı bulunamadı; sayfayı yenileyin." };
  }

  for (const u of updates) {
    const tavan = bilinen.get(u.lineId) ?? 0;
    // Teslim alınan adet [0, sipariş adedi] arasına kelepçelenir: fazla teslim
    // bir veri hatasıdır, eksi teslim anlamsızdır.
    const deger = Math.max(0, Math.min(tavan, Number(u.receivedQty) || 0));
    const { error } = await supabase
      .from("purchase_order_lines")
      .update({ received_qty: deger })
      .eq("id", u.lineId)
      .eq("order_id", orderId);
    if (error) return { error: error.message };
  }

  // received_at TÜRETİLİR: bütün satırların güncel received_qty'si okunup
  // kıyaslanır (elle girilen bir tarihe güvenilmez).
  const { data: guncel } = await supabase
    .from("purchase_order_lines")
    .select("qty, received_qty")
    .eq("order_id", orderId);
  const hepsi = (guncel ?? []) as { qty: number; received_qty: number }[];
  const tumuTeslim =
    hepsi.length > 0 && hepsi.every((s) => Number(s.received_qty) >= Number(s.qty));
  const { data: bas } = await supabase
    .from("purchase_orders")
    .select("received_at")
    .eq("id", orderId)
    .maybeSingle();
  const mevcutTeslim = (bas as { received_at: string | null } | null)?.received_at ?? null;
  if (tumuTeslim && !mevcutTeslim) {
    await supabase
      .from("purchase_orders")
      .update({ received_at: bugunISO() })
      .eq("id", orderId);
  } else if (!tumuTeslim && mevcutTeslim) {
    await supabase.from("purchase_orders").update({ received_at: null }).eq("id", orderId);
  }

  tazele();
  return { ok: updates.length };
}

// ═══════════════════════════════════════════════════════ MARKA/KALİTE

/**
 * MARKA/KALİTE öneri defterine yeni bir değer yazar (SATIS-16).
 *
 * TEDARİKÇİ DEFTERİNİN KURALININ AYNISI: önce katlanmış anahtarla ARANIR
 * (`upsert` değil), yoksa yazılır. Ad BÜYÜK HARFLE saklanır (`adBuyuk`, IS-14)
 * — seed değerleri de büyük harftir ve "logitech" ile "LOGITECH" tek kayıt olur.
 * Yetki `can_edit_purchasing` ya da sarf düzenleme; RLS de aynı kapıyı tutar.
 */
export async function ensureQuality(
  input: EnsureQualityInput
): Promise<PurchasingActionResult & { name?: string }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = ensureQualitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ad = adBuyuk(parsed.data.name.trim());
  if (!ad) return { error: "Marka/Kalite gerekli." };

  const { data: mevcut } = await supabase
    .from("purchase_qualities")
    .select("id, name")
    .eq("match_key", ad)
    .maybeSingle();
  if (mevcut) return { ok: 0, name: (mevcut as { name: string }).name };

  const { error } = await supabase
    .from("purchase_qualities")
    .insert({ name: ad, match_key: ad, created_by: userId });
  if (error) return { error: error.message };
  return { ok: 1, name: ad };
}

// ═══════════════════════════════════════════════ HAVUZ DÜZELTME + MANUEL

/**
 * TALEP HAVUZU SATIR DÜZELTMESİ (md. 1): otomatik çekilen tanım/adet yanlışsa
 * kullanıcı düzeltir. `match_key` DEĞİŞMEZ — yalnız GÖRÜNEN değerler override
 * edilir (`purchase_item_meta.label_override` / `qty_override`), böylece
 * teklif/sipariş/fiyat arşivi bağı bozulmaz.
 */
export async function saveDemandOverride(
  input: SaveDemandOverrideInput
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveDemandOverrideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase.from("purchase_item_meta").upsert(
    {
      match_key: v.key,
      sample: v.sample,
      category: v.category ? v.category : null,
      note: v.note,
      // Boş etiket / null adet override'ı KALDIRIR (türetilmiş değere döner).
      label_override: v.label.trim() ? v.label.trim() : null,
      qty_override: v.qty,
      created_by: userId,
    },
    { onConflict: "match_key" }
  );
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/** MANUEL TALEP EKLER (SATIN-21): havuza teknik resimden gelmeyen bir kalem. */
export async function createManualDemand(
  input: CreateManualDemandInput
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createManualDemandSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { key, tanim } = anahtarla(v.sample);

  const { error } = await supabase.from("purchase_manual_demands").insert({
    match_key: key || tanim,
    sample: tanim,
    category: v.category || "Diğer",
    item_no: v.itemNo,
    quantity: v.quantity,
    unit: v.unit || "Adet",
    weight_kg: v.weightKg,
    quality: v.quality,
    note: v.note,
    created_by: userId,
  });
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/** Manuel talebi siler (SATIN-21). */
export async function deleteManualDemand(id: string): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz talep." };
  const { error } = await ctx.supabase.from("purchase_manual_demands").delete().eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

// ═══════════════════════════════════════════════════════ KALEM DEFTERİ

/**
 * Seçili kalemlerin kategorisini ve/veya notunu yazar.
 *
 * TÜMÜ DEĞİL SEÇİLİ OLANLAR: "Diğer"deki otuz kalemin hepsi aynı yere gitmez.
 * `null` ile boş dizge AYRI ANLAMLIDIR — `null` "bu alana dokunma", boş dizge
 * "temizle" demektir. Karıştırılsaydı kategori taşırken notlar silinirdi.
 */
export async function saveItemMeta(input: SaveItemMetaInput): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = saveItemMetaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { keys, samples, category, note } = parsed.data;

  // Var olan satırlar okunur: `upsert` bütün sütunları yazar ve dokunulmaması
  // gereken alan (not ya da kategori) sessizce sıfırlanırdı.
  const { data: mevcut } = await supabase
    .from("purchase_item_meta")
    .select("match_key, category, note")
    .in("match_key", keys);
  const eski = new Map(
    ((mevcut ?? []) as { match_key: string; category: string | null; note: string | null }[]).map(
      (r) => [r.match_key, r]
    )
  );

  const yuk = keys.map((k, i) => {
    const o = eski.get(k);
    return {
      match_key: k,
      sample: samples[i] ?? o?.category ?? "",
      // Boş dizge düzeltmeyi KALDIRIR (sözlüğe dönülür); `null` dokunmaz.
      category: category === null ? (o?.category ?? null) : category || null,
      note: note === null ? (o?.note ?? "") : note,
      created_by: userId,
    };
  });

  const { error } = await supabase
    .from("purchase_item_meta")
    .upsert(yuk, { onConflict: "match_key" });
  if (error) return { error: error.message };

  tazele();
  return { ok: keys.length };
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

// ═══════════════════════════════════════════════ TEDARİKÇİ DEFTERİ ve ARŞİV

// DEFTER YÖNETİMDE, KAPI BURADA (kullanıcı kararı, 13.08.2026).
//
// Firmaların listesi artık Yönetim → Tedarikçiler ekranında yaşıyor ve kod
// oradan verilir; ama YENİ BİR FİRMA YİNE AKIŞIN İÇİNDEN AÇILIR:
// *"Sipariş Aç bölümüne yeni bir tedarikçi ismi girilirse, otomatik yeni bir
// tedarikçi açılsın."* Satınalmacıyı yönetim ekranına göndermek, teklif ve
// sipariş girişini durdururdu — 12.08.2026'da defterin hiç açılmama gerekçesi
// buydu ve o gerekçe hâlâ geçerli.
//
// ANAHTAR KATLANMIŞ ADDIR: "ÇELİK RULMAN" ile "CELIK RULMAN" tek firmadır.

/** Defterdeki bir firmanın kimliği; `code` eski ortamlarda boş olabilir. */
type FirmaKimligi = { id: string; name: string; code: string };

/**
 * Katlanmış ada göre defter satırını okur.
 *
 * SÜTUN OLMAYABİLİR (SATIN-21): `code` 20260813010004 ile geliyor ve onu isteyen
 * bir `select` uygulanmamış ortamda BÜTÜN sorguyu düşürür — firma kaydı da
 * sipariş de o yüzden hiç yazılamazdı.
 */
async function firmaOku(supabase: SupabaseClient, anahtar: string): Promise<FirmaKimligi | null> {
  const zengin = await supabase
    .from("purchase_suppliers")
    .select("id, name, code")
    .eq("match_key", anahtar)
    .maybeSingle();
  if (!zengin.error) {
    const r = zengin.data as { id: string; name: string; code: string | null } | null;
    return r ? { id: r.id, name: r.name ?? "", code: r.code ?? "" } : null;
  }

  const dar = await supabase
    .from("purchase_suppliers")
    .select("id, name")
    .eq("match_key", anahtar)
    .maybeSingle();
  const r = dar.data as { id: string; name: string } | null;
  return r ? { id: r.id, name: r.name ?? "", code: "" } : null;
}

/**
 * Firmayı deftere yazar — YOKSA. Kodu veritabanı verir (sıra sayacı).
 *
 * ÖNCE OKUR, SONRA YAZAR ve bu `upsert`ten bilinçli bir sapmadır: `code`
 * sütununun varsayılanı `nextval(...)`tır ve çakışan bir `upsert` de o sayacı
 * TÜKETİR. Sipariş açılışında her seferinde çağrıldığı için defter birkaç
 * haftada dört haneyi doldurur ve kodlar arasında yüzlerce boşluk kalırdı.
 */
async function firmayiDeftereYaz(
  supabase: SupabaseClient,
  userId: string,
  ham: string
): Promise<{ error?: string; firma?: FirmaKimligi; yeni?: boolean }> {
  const ad = adBuyuk((ham ?? "").trim()).slice(0, 120);
  if (!ad) return { error: "Firma adı boş olamaz." };
  const anahtar = trKatla(ad);

  const mevcut = await firmaOku(supabase, anahtar);
  if (mevcut) return { firma: mevcut, yeni: false };

  const { data, error } = await supabase
    .from("purchase_suppliers")
    .insert({ name: ad, match_key: anahtar, created_by: userId })
    .select("id, name, code")
    .maybeSingle();

  if (error) {
    // YARIŞ ÇAKIŞMASI BİR HATA DEĞİLDİR: aynı anda başka biri (ya da aynı
    // kullanıcının ikinci sekmesi) yazmış olabilir. Kullanıcının derdi "bu ad
    // listede olsun", "ben yarattım" değil.
    const tekrar = await firmaOku(supabase, anahtar);
    if (tekrar) return { firma: tekrar, yeni: false };
    return { error: `Firma kaydedilemedi: ${error.message}` };
  }

  const r = data as { id: string; name: string; code: string | null } | null;
  if (!r?.id) return { error: "Firma kaydedildi ancak kimliği okunamadı." };
  return { firma: { id: r.id, name: r.name ?? ad, code: r.code ?? "" }, yeni: true };
}

export async function ensureSupplier(
  input: { name: string }
): Promise<PurchasingActionResult & { name?: string; code?: string }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };

  const sonuc = await firmayiDeftereYaz(ctx.supabase, ctx.userId, input.name);
  if (sonuc.error) return { error: sonuc.error };

  if (sonuc.yeni) tazele();
  return {
    ok: sonuc.yeni ? 1 : 0,
    id: sonuc.firma?.id,
    name: sonuc.firma?.name,
    code: sonuc.firma?.code,
  };
}

/**
 * Devralınan fiyat satırını siler — YALNIZ YÖNETİCİ.
 *
 * Kullanıcı kararı (13.08.2026): *"Fiyat arşivinde adminin silebilme özelliği
 * olsun."* Kapı `can_edit_purchasing()`ten DAR tutulur: satın alma ekibi
 * arşivi okur ve kendi tekliflerini yönetir, ama DEVRALINAN bir kaydı silmek
 * geri alınamaz ve o kaydın kaynağı artık elimizde olmayabilir.
 *
 * Teklif ve sipariş satırları BURADAN SİLİNMEZ: onların kendi yolu var
 * (`deleteQuote`, sipariş iptali) ve arşiv onları yalnız OKUR. Tek bir "sil"
 * düğmesinin üç ayrı defteri silmesi, kullanıcının neyi kaybettiğini
 * bilmemesi demekti.
 */
export async function deletePriceHistory(
  input: { ids: string[] }
): Promise<PurchasingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: kullanici } = await supabase.auth.getUser();
  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };
  if (!isAdminRole(profil?.role)) {
    return { error: "Arşiv kaydını yalnız yönetici silebilir." };
  }

  const idler = (input.ids ?? []).filter(Boolean).slice(0, 500);
  if (idler.length === 0) return { ok: 0 };

  const { error, count } = await supabase
    .from("purchase_price_history")
    .delete({ count: "exact" })
    .in("id", idler);
  if (error) return { error: `Silinemedi: ${error.message}` };

  tazele();
  return { ok: count ?? idler.length };
}

/**
 * Bir kalemin devralınan alım satırları — SATIR AÇILDIĞINDA.
 *
 * Kullanıcı bildirimi (13.08.2026): *"Fiyat arşivine tıkladığımda biraz kasma
 * yapıyor."* Ölçüldü: 4722 devralınan satırın tamamı her ziyarette istemciye
 * gidiyordu (1,3 MB) ve altı ardışık sorguyla okunuyordu. Liste artık kalem
 * başına ÖZET alıyor (`purchase_price_index` görünümü); ayrıntıyı yalnız
 * açılan satır ister ve o da tek bir sorgudur.
 *
 * 1675 kalemin 1674'ünün ayrıntısı hiç açılmıyor — onları baştan göndermek,
 * okunmayan bir kitabı her sayfa açılışında basmaktı.
 */
export async function fetchPriceHistory(
  input: { matchKey: string }
): Promise<{ error?: string; satirlar?: ArsivOlayi[] }> {
  const supabase = await createClient();
  const { data: kullanici } = await supabase.auth.getUser();
  if (!kullanici.user) return { error: "Oturum bulunamadı." };
  // OKUMA KAPISI RLS'TEDİR (`can_see_purchasing()`); burada ayrıca rol
  // sorulmaz — iki kapı zamanla ayrışır ve biri gevşerse fark edilmez.
  const satirlar = await loadArsivOlaylari(supabase, input.matchKey ?? "");
  return { satirlar };
}
