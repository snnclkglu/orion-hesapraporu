"use server";

// TEKLİF ANALİZİNİN YAZMA UCU — kazanma puanı ve beklenen iş defteri.
//
// Sıra her action'da AYNIDIR (uygulamanın deseni): `createClient` →
// `auth.getUser` → Zod `safeParse` → yaz → `audit_log` → `revalidatePath` → `{}`.
//
// YETKİSİZ YAZIM SESSİZ KALMAZ. RLS (`can_edit_offers`) reddettiğinde Postgres
// UPDATE/DELETE'te hata DÖNDÜRMEZ, yalnız sıfır satır etkiler; ekran
// "kaydettim" der ve hiçbir şey değişmez. Bu yüzden her yazma `.select("id")`
// ile satır SAYAR (`tanimlar/actions.ts` kalıbı). INSERT ayrıdır: orada red
// gerçek bir hatadır ve `42501` koduyla gelir.
//
// DENETİM İZİ `detail` İÇİNDEN GEÇER: `audit_log.project_id` bir HESAP RAPORU
// projesine yabancı anahtarla bağlıdır ve oraya bir teklif ya da beklenen iş
// kimliği yazılamaz.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currency";
import { adBuyuk } from "@/lib/tr-text";

export type AnalizActionResult = { error?: string; ok?: boolean };

const YETKI_YOK = "Teklif analizini düzenleme yetkisi gerekir.";

type Baglam = { supabase: SupabaseClient; user: User };

async function oturum(): Promise<Baglam | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  return { supabase, user };
}

async function audit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ project_id: null, actor: actorId, action, detail });
}

/**
 * Analiz sayfası VE teklif listesi tazelenir: puan ve beklenen tarih teklifin
 * kendi alanlarıdır (`offers.win_score` / `offers.expected_on`) ve
 * `offer_list` görünümü ikisini de taşır — yalnız bu sayfayı tazelemek,
 * listedeki satırın eski hâlde kalması demekti.
 */
function tazele() {
  revalidatePath("/offers/analiz");
  revalidatePath("/offers");
}

// ————————————————————————————————————————————————————————— ortak alanlar

/**
 * PUAN BOŞ BIRAKILABİLİR ve bu bir eksiklik değil bir DURUMDUR: kullanıcı
 * henüz o teklifin yakınlığına karar vermemiştir. Uydurma bir orta değer
 * atamak, verilmemiş bir kararı verilmiş gibi gösterirdi (değişmez md. 4);
 * puansız satır projeksiyona girmez ve ekranda renksiz kalır.
 */
const puanAlani = z
  .number()
  .int("Puan tam sayı olmalı.")
  .min(1, "Puan 1 ile 10 arasında olmalı.")
  .max(10, "Puan 1 ile 10 arasında olmalı.")
  .nullable();

/**
 * Boş tarih `null` gelir — istemci "" yerine `null` yollar (yer tutucu yok).
 *
 * YIL 1000–9999 ARASINDADIR. Sınır bir biçim kaprisi değil, gerçek bir kaydın
 * önünü kesiyor: `<input type="date">` dolu bir alanda yıl bölmesine basılan
 * ilk rakamla `0002-09-15` üretir ve bu dizge yukarıdaki desene UYAR —
 * kullanıcı "2026" yazmayı bitirmeden `0002` kaydedilmişti (md. 25).
 *
 * KURAL İKİ YERDE YAŞIYOR (değişmez md. 8): ekranda `tarihKesin`
 * (`lead-dialog.tsx`), burada bu şema. Sunucu ucu kaldırılamaz — sayfa tek
 * yazma yolu değildir ve bir istemci hatası veritabanına 2 yılını yazamamalı.
 * İkisinin ayrışmasını `lib/offers/__tests__/analiz.test.ts` bu dosyayı okuyup
 * engelliyor.
 */
const tarihAlani = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Beklenen tarih geçersiz.")
  .refine((v) => Number(v.slice(0, 4)) >= 1000, "Beklenen tarihin yılı eksik.")
  .nullable();

const tutarAlani = z
  .number()
  .finite("Tutar geçersiz.")
  .min(0, "Tutar negatif olamaz.")
  .nullable();

// ————————————————————————————————————————————————————— verilmiş teklifin puanı

const teklifPuaniSemasi = z
  .object({
    offerId: z.uuid("Geçersiz teklif."),
    score: puanAlani,
    expectedOn: tarihAlani,
  })
  .strict();

export type SetOfferScoreInput = z.input<typeof teklifPuaniSemasi>;

/**
 * Verilmiş bir teklifin kazanma puanını ve karar beklenen tarihini yazar.
 *
 * İKİSİ TEK ÇAĞRIDA: ekranda da yan yana dururlar ve satır içinde
 * değiştirilirler; ayrı iki action olsaydı puanı değiştiren bir tıklama
 * tarihi, tarihi değiştiren bir tıklama puanı okumadan yazma riskini
 * doğururdu. Çağıran her seferinde satırın GÜNCEL ikilisini yollar.
 */
export async function setOfferScore(
  offerId: string,
  score: number | null,
  expectedOn: string | null
): Promise<AnalizActionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = teklifPuaniSemasi.safeParse({ offerId, score, expectedOn });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("offers")
    .update({ win_score: parsed.data.score, expected_on: parsed.data.expectedOn })
    .eq("id", parsed.data.offerId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.score_set", {
    offer_id: parsed.data.offerId,
    win_score: parsed.data.score,
    expected_on: parsed.data.expectedOn,
  });
  tazele();
  return { ok: true };
}

// ————————————————————————————————————————————————————————— beklenen işler

/**
 * MÜŞTERİ BURADA SERBEST METİN OLABİLİR — teklifin kendisinde defter
 * ZORUNLUdur (IS-14) ama beklenen iş çoğu zaman bir telefon görüşmesidir ve
 * firmayı deftere yazacak bilgi henüz yoktur. Gevşeme bilinçlidir ve
 * migration 20260819000004'te de gerekçelidir. Defterden seçildiyse ad
 * defterden okunur (fotoğraf), elle yazıldıysa BÜYÜK HARF saklanır
 * (değişmez md. 3).
 */
const beklenenIsSemasi = z
  .object({
    customerId: z.uuid("Geçersiz müşteri.").nullable(),
    customerName: z.string().trim().max(200).transform(adBuyuk),
    subject: z.string().trim().min(1, "Konu gerekli.").max(300),
    expectedOn: tarihAlani,
    amount: tutarAlani,
    currency: z.enum(CURRENCIES),
    winScore: puanAlani,
    notes: z.string().trim().max(2000),
    active: z.boolean(),
  })
  .strict()
  .refine((v) => v.customerId !== null || v.customerName !== "", {
    message: "Müşteriyi listeden seçin ya da firma adını yazın.",
    path: ["customerName"],
  });

export type LeadInput = z.input<typeof beklenenIsSemasi>;

/** Defter kaydı varsa ad ORADAN okunur; yoksa kullanıcının yazdığı ad kalır. */
async function musteriAdi(
  supabase: SupabaseClient,
  customerId: string | null,
  yazilan: string
): Promise<string> {
  if (!customerId) return yazilan;
  const { data } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? yazilan;
}

/** RLS reddi INSERT'te gerçek bir hatadır ve `42501` koduyla gelir. */
function eklemeHatasi(error: { code?: string; message: string }): string {
  return error.code === "42501" ? YETKI_YOK : error.message;
}

export async function createLead(input: LeadInput): Promise<AnalizActionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = beklenenIsSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase.from("offer_leads").insert({
    customer_id: v.customerId,
    customer_name: await musteriAdi(supabase, v.customerId, v.customerName),
    subject: v.subject,
    expected_on: v.expectedOn,
    amount: v.amount,
    currency: v.currency,
    win_score: v.winScore,
    notes: v.notes,
    active: v.active,
    created_by: user.id,
  });
  if (error) return { error: eklemeHatasi(error) };

  await audit(supabase, user.id, "offer.lead_create", {
    customer_id: v.customerId,
    customer_name: v.customerName,
    subject: v.subject,
    expected_on: v.expectedOn,
    win_score: v.winScore,
  });
  tazele();
  return { ok: true };
}

export async function updateLead(id: string, input: LeadInput): Promise<AnalizActionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const kimlik = z.uuid("Geçersiz kayıt.").safeParse(id);
  if (!kimlik.success) return { error: kimlik.error.issues[0].message };
  const parsed = beklenenIsSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("offer_leads")
    .update({
      customer_id: v.customerId,
      customer_name: await musteriAdi(supabase, v.customerId, v.customerName),
      subject: v.subject,
      expected_on: v.expectedOn,
      amount: v.amount,
      currency: v.currency,
      win_score: v.winScore,
      notes: v.notes,
      active: v.active,
    })
    .eq("id", kimlik.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.lead_update", {
    lead_id: kimlik.data,
    subject: v.subject,
    expected_on: v.expectedOn,
    win_score: v.winScore,
    active: v.active,
  });
  tazele();
  return { ok: true };
}

/**
 * Beklenen işi SİLER.
 *
 * Silme yalnız YANLIŞ AÇILMIŞ satır içindir. Teklife dönüşen bir beklenen iş
 * silinmez, `offer_id` ile bağlanıp pasife alınır (migration'ın kuralı):
 * tahminin ne kadar tuttuğunu gösteren tek kayıt odur ve analizden zaten
 * `tekilSatirlar` ile düşer. Ekran bu ayrımı silmeden önce sorar.
 */
export async function deleteLead(id: string): Promise<AnalizActionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const kimlik = z.uuid("Geçersiz kayıt.").safeParse(id);
  if (!kimlik.success) return { error: kimlik.error.issues[0].message };

  const { data: mevcut } = await supabase
    .from("offer_leads")
    .select("customer_name, subject")
    .eq("id", kimlik.data)
    .maybeSingle();

  const { data, error } = await supabase
    .from("offer_leads")
    .delete()
    .eq("id", kimlik.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.lead_delete", { lead_id: kimlik.data, ...(mevcut ?? {}) });
  tazele();
  return { ok: true };
}
