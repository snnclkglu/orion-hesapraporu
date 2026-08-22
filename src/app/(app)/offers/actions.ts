"use server";

// TEKLİF SERVER ACTION'LARI.
//
// Sıra her action'da AYNIDIR (uygulamanın deseni): `createClient` →
// `auth.getUser` → Zod `safeParse` → (gerekiyorsa) önceki hâli oku → yaz →
// `audit_log` → `revalidatePath` → `{}` / `redirect`.
//
// DENETİM İZİ `detail` İÇİNDEN GEÇER: `audit_log.project_id` bir HESAP RAPORU
// projesine yabancı anahtarla bağlıdır ve oraya bir teklif kimliği yazılamaz.
// Teklif kimliği `detail.offer_id` alanındadır (Yönetim panelinin `audit`
// yardımcısıyla aynı düzen).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requestPermanentDeletion } from "@/lib/deletion-request-server";
import { getReportSettings } from "@/lib/settings";
import { isAdminRole } from "@/lib/roles";
import { trKatla } from "@/lib/drawings/tr-text";
import { copyPayloadForCustomer } from "@/lib/offers/copy";
import { offerValueUpper } from "@/lib/offers/options";
import { nextSeq, offerNo } from "@/lib/offers/no";
import {
  applyDefaults,
  emptyPayload,
  greetingFor,
  withDefaults,
} from "@/lib/offers/payload";
import { coverFieldsFromContact, suggestedContact } from "@/lib/customer-contacts";
import { itemFactsFromRows } from "@/lib/offers/registry";
import { defaultsOf, loadCustomerContacts, loadOfferOptions } from "./data";
import { withTotal } from "@/lib/offers/pricing";
import { offerFileName } from "@/lib/pdf/doc-naming";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/offers/status";
import { renderOfferPdf } from "@/lib/pdf/offer";
import {
  copyOfferSchema,
  ensureOptionSchema,
  newOfferSchema,
  offerDetailsSchema,
  saveRevisionSchema,
  type CopyOfferInput,
  type EnsureOptionInput,
  type NewOfferInput,
  type OfferDetailsInput,
  offerSubjectSchema,
  type OfferSubjectInput,
  type SaveRevisionInput,
} from "./schema";

export type OfferActionResult = { error?: string; ok?: boolean };

async function audit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ project_id: null, actor: actorId, action, detail });
}

function tazele(offerId?: string) {
  revalidatePath("/offers");
  if (offerId) revalidatePath(`/offers/${offerId}`);
}

/** Bugünün ISO tarihi — teklif numarası ondan türer. */
function bugun(): string {
  return new Date().toISOString().slice(0, 10);
}

// ————————————————————————————————————————————————————————— teklif açma

/**
 * Yeni teklif numarası önerir.
 *
 * ÖNERİDİR, KİLİT DEĞİLDİR: asıl tekillik `offers_seq_uidx` benzersiz
 * indeksindedir. İki kişi aynı anda teklif açarsa ikincinin insert'i 23505 ile
 * düşer ve çağıran sırayı bir artırıp yeniden dener (`order-no.ts` ile aynı
 * ruh). Numarayı bir kilit altında üretmek, günde birkaç teklif açan bir firma
 * için gereksiz bir karmaşıklık olurdu.
 */
async function oneriliSira(supabase: SupabaseClient, lang: string, tarih: string): Promise<number> {
  const { data } = await supabase
    .from("offers")
    .select("seq")
    .eq("lang", lang)
    .eq("issue_date", tarih);
  return nextSeq((data ?? []).map((r) => r.seq as number));
}

interface YeniTeklifKaydi {
  lang: string;
  issue_date: string;
  customer_id: string;
  customer_name: string;
  subject: string;
  currency: string;
  created_by: string;
}

/** Numara çakışırsa sırayı artırıp yeniden dener; üç denemeden sonra vazgeçer. */
async function teklifYaz(
  supabase: SupabaseClient,
  kayit: YeniTeklifKaydi
): Promise<{ id: string; offer_no: string } | { error: string }> {
  let seq = await oneriliSira(supabase, kayit.lang, kayit.issue_date);
  for (let deneme = 0; deneme < 3; deneme += 1) {
    const { data, error } = await supabase
      .from("offers")
      .insert({ ...kayit, seq, offer_no: offerNo(kayit.lang as "tr" | "en", kayit.issue_date, seq) })
      .select("id, offer_no")
      .single();
    if (!error && data) return data as { id: string; offer_no: string };
    if (error?.code !== "23505") return { error: error?.message ?? "Teklif oluşturulamadı" };
    seq += 1;
  }
  return { error: "Teklif numarası üretilemedi; lütfen tekrar deneyin." };
}

/** Teklifi hazırlayanın künyesi — kapağın "KİMDEN" sütununu doldurur. */
async function hazirlayan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ name: string; title: string; email: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, title")
    .eq("id", userId)
    .maybeSingle();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return {
    name: (profile?.full_name as string) ?? "",
    title: (profile?.title as string) ?? "",
    email: user?.email ?? "",
  };
}

export async function createOffer(input: NewOfferInput): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = newOfferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", parsed.data.customerId)
    .maybeSingle();
  if (!customer) return { error: "Müşteri defterde bulunamadı" };

  const yazildi = await teklifYaz(supabase, {
    lang: parsed.data.lang,
    issue_date: bugun(),
    customer_id: parsed.data.customerId,
    // MÜŞTERİ ADI FOTOĞRAFTIR: defter sonradan düzeltilince teslim edilmiş
    // teklif değişmemelidir.
    customer_name: customer.name as string,
    subject: parsed.data.subject,
    currency: parsed.data.currency,
    created_by: user.id,
  });
  if ("error" in yazildi) return { error: yazildi.error };

  // İlk revizyon (R0) — kapak künyesi, defter varsayılanları ve muhatap dolu;
  // teknik kalemler editörde, kalem kalem eklenir.
  let payload = emptyPayload(parsed.data.currency);
  const kunye = await hazirlayan(supabase, user.id);
  payload.cover = {
    ...payload.cover,
    fromName: kunye.name,
    fromTitle: kunye.title,
    fromEmail: kunye.email,
  };
  // TEST YÜKÜ, GEÇERLİLİK VE GİRİŞ PARAGRAFI DEFTERDEN DOLU GELİR (kullanıcı
  // isteği). Değerler koda gömülmez; Tanımlar sayfasından değiştirilir.
  const defter = await loadOfferOptions(supabase);
  payload = applyDefaults(payload, defaultsOf(defter));

  // MÜŞTERİ SEÇİLDİĞİNDE MUHATAP DA GELİR (kullanıcı isteği: *"Müşteri
  // seçtiğimde müşteri bilgilerini de getir"*). Defterdeki BİRİNCİL kişi
  // önerilir; kullanıcı editörde başkasını seçebilir. Kişi yoksa alanlar BOŞ
  // kalır — uydurma bir muhatap adı, kapağın en görünür satırında yanlış
  // olurdu (değişmez md. 4).
  const kisiler = await loadCustomerContacts(supabase, parsed.data.customerId);
  const muhatap = suggestedContact(kisiler);
  if (muhatap) {
    const ek = defter.find((o) => o.list_key === "cover.honorific" && o.is_default)?.value ?? "";
    payload.cover = {
      ...payload.cover,
      ...coverFieldsFromContact(muhatap),
      greeting: greetingFor(muhatap.name, ek),
    };
  }

  // İLK KALEM "VİNÇ - 1"DİR, TEKLİF KONUSU DEĞİL (kullanıcı isteği,
  // 17.08.2026: *"girdiğim teklif konusu ekleyeceğim vinç ile aynı olmayabilir;
  // konu kapak bölümüne gelsin, ilk vinç Vinç - 1 olarak gelsin"*). Konu
  // BELGENİN adıdır ("YENİ FABRİKA VİNÇ TEKLİFLERİ") ve üç vinçlik bir teklifin
  // ilk vincine onu takmak, kullanıcının her seferinde sildiği bir başlık
  // üretirdi. Başlık zaten kapasite ve vinç tipi girildiğinde kendiliğinden
  // yazılır (`withAutoTitle`).
  // TEKLİF KALEMSİZ AÇILIR (kullanıcı isteği, 17.08.2026: *"şablon seçimini
  // teklifi oluştururken değil de kalem eklerken yapsak daha iyi olur; teklif
  // ilk boş olarak gelsin, ben kalem eklerken hangi şablona göre geldiğini
  // orada seçeyim, çünkü bir teklif içerisinde hem tek kirişli hem çift kirişli
  // hem portal olabilir"*).
  //
  // Şablonu teklif düzeyinde sormak, ÇOK ÜRÜNLÜ bir belgeyi tek bir vinç tipine
  // bağlamak olurdu: ASTOR'un "Yeni Fabrika" teklifinde bir çift kirişli, bir
  // tek kirişli ve iki monoray var. Şablon artık KALEMİN sorusudur ve her
  // kalemde yeniden sorulur (`KalemEkleDialog`).
  payload.items = [];

  const { error: revError } = await supabase.from("offer_revisions").insert({
    offer_id: yazildi.id,
    rev_no: 0,
    label: "R0",
    payload,
    created_by: user.id,
  });
  if (revError) return { error: revError.message };

  await audit(supabase, user.id, "offer.create", {
    offer_id: yazildi.id,
    offer_no: yazildi.offer_no,
    customer: customer.name,
  });
  tazele(yazildi.id);
  redirect(`/offers/${yazildi.id}`);
}

/**
 * Teklifi BAŞKA BİR MÜŞTERİYE kopyalar.
 *
 * Kullanıcı isteği: *"Benzer bir işi başka müşteri isterse hemen ona kopyalayıp
 * değiştirebileyim."* Kopya YENİ BİR TEKLİFTİR (yeni numara, kendi revizyon
 * zinciri) — kaynak teklifin revizyonu DEĞİLDİR. İki müşterinin teklifi tek
 * belgede sürseydi birine yapılan bir düzeltme ötekinin geçmişini de
 * değiştirirdi.
 */
export async function copyOfferToCustomer(input: CopyOfferInput): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = copyOfferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [{ data: kaynak }, { data: customer }] = await Promise.all([
    supabase.from("offers").select("id, lang, currency").eq("id", parsed.data.sourceOfferId).maybeSingle(),
    supabase.from("customers").select("name").eq("id", parsed.data.customerId).maybeSingle(),
  ]);
  if (!kaynak) return { error: "Kaynak teklif bulunamadı" };
  if (!customer) return { error: "Müşteri defterde bulunamadı" };

  // KAYNAK OLARAK GÜNCEL REVİZYON alınır: kopyalanan şey teklifin BUGÜNKÜ
  // hâlidir, ilk hâli değil.
  const { data: revision } = await supabase
    .from("offer_revisions")
    .select("payload")
    .eq("offer_id", kaynak.id)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const yazildi = await teklifYaz(supabase, {
    lang: kaynak.lang as string,
    issue_date: bugun(),
    customer_id: parsed.data.customerId,
    customer_name: customer.name as string,
    subject: parsed.data.subject,
    currency: kaynak.currency as string,
    created_by: user.id,
  });
  if ("error" in yazildi) return { error: yazildi.error };

  const payload = copyPayloadForCustomer(
    withDefaults(revision?.payload, kaynak.currency as string),
    {
      customerName: customer.name as string,
      from: await hazirlayan(supabase, user.id),
    }
  );

  const { error: revError } = await supabase.from("offer_revisions").insert({
    offer_id: yazildi.id,
    rev_no: 0,
    label: "R0",
    payload,
    created_by: user.id,
  });
  if (revError) return { error: revError.message };

  await audit(supabase, user.id, "offer.copy", {
    offer_id: yazildi.id,
    offer_no: yazildi.offer_no,
    source_offer_id: parsed.data.sourceOfferId,
    customer: customer.name,
  });
  tazele(yazildi.id);
  redirect(`/offers/${yazildi.id}`);
}

// ————————————————————————————————————————————————————————— düzenleme

export async function updateOfferDetails(
  offerId: string,
  input: OfferDetailsInput
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };
  const parsed = offerDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", parsed.data.customerId)
    .maybeSingle();
  if (!customer) return { error: "Müşteri defterde bulunamadı" };

  const { data: onceki } = await supabase
    .from("offers")
    .select("subject, customer_name, status, currency")
    .eq("id", id.data)
    .maybeSingle();

  const { data: yazilan, error } = await supabase
    .from("offers")
    .update({
      subject: parsed.data.subject,
      customer_id: parsed.data.customerId,
      customer_name: customer.name,
      status: parsed.data.status,
      currency: parsed.data.currency,
    })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: error.message };
  // Yetkisizlik SESSİZ BAŞARI olmasın: RLS satırı vermezse `update` hata
  // döndürmez, hiçbir satıra dokunmaz.
  if (!yazilan?.length) return { error: "Teklifi düzenleme yetkisi gerekir." };

  await audit(supabase, user.id, "offer.update", { offer_id: id.data, onceki, yeni: parsed.data });
  tazele(id.data);
  return {};
}

/**
 * TEKLİF KONUSUNU günceller — kapak bölümünden (kullanıcı isteği 18.08.2026).
 *
 * `updateOfferDetails`ten AYRIDIR ve bilinçli: o eylem müşteriyi, durumu ve
 * para birimini de ister ve hepsini birden yazar. Kapaktaki kutu yalnız konuyu
 * değiştirir; ötekileri de göndermek, editörde bulunmayan alanları bir
 * varsayılanla ezmenin yolu olurdu.
 *
 * YAYIMLANMIŞ REVİZYON ENGEL DEĞİLDİR: kilit REVİZYONUN metnine aittir, konu
 * ise teklifin künyesidir ve bir yazım hatası düzeltilebilmelidir. Dosya adı
 * ve altbilgi bir sonraki basımda yeni konuyu taşır.
 */
export async function updateOfferSubject(
  offerId: string,
  input: OfferSubjectInput
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };
  const parsed = offerSubjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: onceki } = await supabase
    .from("offers")
    .select("subject")
    .eq("id", id.data)
    .maybeSingle();
  if (onceki?.subject === parsed.data.subject) return {};

  const { data: yazilan, error } = await supabase
    .from("offers")
    .update({ subject: parsed.data.subject })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: error.message };
  // Yetkisizlik SESSİZ BAŞARI olmasın: RLS satırı vermezse `update` hata
  // döndürmez, hiçbir satıra dokunmaz.
  if (!yazilan?.length) return { error: "Teklifi düzenleme yetkisi gerekir." };

  await audit(supabase, user.id, "offer.subject", {
    offer_id: id.data,
    onceki: onceki?.subject ?? null,
    yeni: parsed.data.subject,
  });
  tazele(id.data);
  return {};
}

/**
 * TEKLİFİN DURUMUNU DEĞİŞTİRİR — liste satırından, tek tıkla.
 *
 * Kullanıcı isteği (22.08.2026): *"teklif bazen iptal edilebiliyor. satırda
 * silme ve iptal özelliği olsun."*
 *
 * `updateOfferDetails`TEN AYRIDIR ve gerekçesi `updateOfferSubject`inkiyle
 * aynıdır: o eylem müşteriyi, konuyu, durumu ve para birimini birlikte ister
 * ve hepsini birden YAZAR. Liste satırında bunların hiçbiri yoktur; hepsini
 * göndermek, ekranda bulunmayan alanları bir varsayılanla ezmenin yolu olurdu.
 *
 * SİLME DEĞİL, DURUM: iptal edilen teklif kaydında KALIR. Bir teklifin iptal
 * edilmiş olması bir olgudur ve gelecek yıl "geçen sene bu müşteriye ne
 * vermiştik" sorusunun cevabı odur; kaydı silmek o cevabı da siler. Silme
 * ayrı bir eylemdir ve yayımlanmış revizyonu olan teklifte reddedilir.
 */
export async function updateOfferStatus(
  offerId: string,
  status: OfferStatus
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };
  const durum = z.enum(OFFER_STATUSES).safeParse(status);
  if (!durum.success) return { error: "Geçersiz teklif durumu" };

  const { data: onceki } = await supabase
    .from("offers")
    .select("status")
    .eq("id", id.data)
    .maybeSingle();

  const { data: yazilan, error } = await supabase
    .from("offers")
    .update({ status: durum.data })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: error.message };
  // Yetkisizlik SESSİZ BAŞARI olmasın: RLS satırı vermezse `update` hata
  // döndürmez, hiçbir satıra dokunmaz.
  if (!yazilan?.length) return { error: "Teklifi düzenleme yetkisi gerekir." };

  await audit(supabase, user.id, "offer.status", {
    offer_id: id.data,
    onceki: onceki?.status ?? null,
    yeni: durum.data,
  });
  tazele(id.data);
  return {};
}

export async function deleteOffer(offerId: string): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };

  // YAYIMLANMIŞ REVİZYONU OLAN TEKLİF SİLİNMEZ. Teklif müşterinin elindedir;
  // kaydını silmek, gönderilmiş bir belgenin izini yok etmektir. Kural
  // veritabanındaki tetikleyicide de var (cascade silme oraya çarpar) ama
  // burada ANLAŞILIR bir cümleyle karşılanır.
  const { data: yayinli } = await supabase
    .from("offer_revisions")
    .select("id")
    .eq("offer_id", id.data)
    .eq("status", "issued")
    .limit(1);
  if (yayinli?.length) {
    return { error: "Yayımlanmış revizyonu olan teklif silinemez; İptal durumuna alabilirsiniz." };
  }

  return requestPermanentDeletion({ entityType: "offer", targetId: id.data });
}

// ————————————————————————————————————————————————————————— revizyon

/**
 * Yeni revizyon — KALAN SON revizyondan kopyalar.
 *
 * `rev_no` en büyük numaranın bir fazlasıdır, kayıt sayısı DEĞİL: bir taslak
 * silindiğinde numara geri dönmemelidir, yoksa iki farklı belge aynı adı
 * taşırdı (mühendislikteki `createRevision` ile aynı gerekçe).
 */
export async function createOfferRevision(offerId: string): Promise<OfferActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };

  const { data: son } = await supabase
    .from("offer_revisions")
    .select("rev_no, payload, notes")
    .eq("offer_id", id.data)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revNo = (son?.rev_no ?? -1) + 1;
  const { data, error } = await supabase
    .from("offer_revisions")
    .insert({
      offer_id: id.data,
      rev_no: revNo,
      label: `R${revNo}`,
      payload: son?.payload ?? emptyPayload(),
      notes: son?.notes ?? "",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await audit(supabase, user.id, "offer.revision_create", { offer_id: id.data, rev_no: revNo });
  tazele(id.data);
  return { id: data.id as string };
}

export async function deleteOfferRevision(
  offerId: string,
  revisionId: string
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  return requestPermanentDeletion({
    entityType: "offer_revision",
    targetId: revisionId,
    context: { offer_id: offerId },
  });
}

/**
 * Revizyonu kaydeder.
 *
 * TOPLAM BURADA HESAPLANIR ve payload'a yazılır: veritabanındaki
 * `total_amount` üretilmiş sütunu onu okur ve liste ekranı belgeyi açmadan
 * tutarı gösterir. Ekranda hesaplanıp yazılmasaydı iki farklı toplam
 * dolaşırdı.
 */
export async function saveOfferRevision(
  offerId: string,
  revisionId: string,
  input: SaveRevisionInput
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = saveRevisionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const payload = withDefaults(parsed.data.payload);
  payload.pricing = withTotal(payload.pricing);
  // KALEM KÜNYESİ TEKNİK SATIRLARDAN TÜRETİLİR (kullanıcı isteği: kapasite ve
  // açıklık artık yalnız GENEL ÖZELLİKLER'de sorulur). Teklif listesindeki
  // tonaj ve vinç tipi süzgeçleri bu sayıları okur; ayrı bir alanda
  // saklanmadıkları için belgeden AYRIŞAMAZLAR.
  payload.items = payload.items.map((item) => {
    const kunye = itemFactsFromRows(item.groups);
    return {
      ...item,
      capacityT: kunye.capacityT,
      spanM: kunye.spanM,
      // VİNÇ TİPİ TÜRETİLMEZ, SORULUR (md. 3): `GENEL ÖZELLİKLER > Vinç Tipi`
      // satırı emekliye ayrıldı ve tek soruluşu kalem künyesindeki kutudur.
      craneType: item.craneType || "",
    };
  });

  // NOT VERİLMEDİYSE SÜTUNA HİÇ DOKUNULMAZ (bkz. `saveRevisionSchema`):
  // otomatik kayıt saniyede bir yazdığı için, "yazılmayan alan boşaltılır"
  // varsayımı burada revizyon notunu sessizce silmek olurdu.
  const guncelleme: Record<string, unknown> = { payload };
  if (parsed.data.notes !== undefined) guncelleme.notes = parsed.data.notes;

  const { data: yazilan, error } = await supabase
    .from("offer_revisions")
    .update(guncelleme)
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .eq("status", "draft")
    .select("id");
  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun."
        : error.message,
    };
  }
  if (!yazilan?.length) {
    return { error: "Revizyon bulunamadı ya da yayımlanmış — yeni bir revizyon oluşturun." };
  }

  // ARKA PLAN KAYDI YOL TAZELEMEZ: editör kendi durumunu zaten elinde tutar ve
  // yürürlükteki sayfayı her yazma duraklamasında yeniden çektirmek boş bir ağ
  // turudur. Liste ve panel `force-dynamic`tir, oraya gidildiğinde taze
  // üretilir; tazeleme doğruluk için değil hız içindi. Yayım kendi yollarını
  // yine tam tazeler (`issueOfferRevision`) — kilitlenen belge listede anında
  // görünmelidir.
  if (!parsed.data.background) {
    tazele(offerId);
    revalidatePath(`/offers/${offerId}/revisions/${revisionId}`);
  }
  return { ok: true };
}

/**
 * Revizyonu yayımlar: durum `issued` olur, tetikleyici damgalar ve kilitler.
 *
 * PDF `offers` kovasına ARŞİVLENİR — teslim edilen belge bir daha üretilmez,
 * okunur. Arşivleme hatası YAYINI GERİ ALMAZ, yalnız uyarı döner (mühendislik
 * raporundaki aynı denge: yayın bir karardır, arşiv bir kolaylıktır).
 */
export async function issueOfferRevision(
  offerId: string,
  revisionId: string
): Promise<OfferActionResult & { warning?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: revision, error } = await supabase
    .from("offer_revisions")
    .update({ status: "issued" })
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .eq("status", "draft")
    .select("rev_no, payload, issued_at")
    .single();
  if (error || !revision) {
    return { error: error?.message ?? "Revizyon bulunamadı veya zaten yayımlanmış" };
  }

  let arsivlendi = false;
  try {
    const { data: offer } = await supabase
      .from("offers")
      .select("offer_no, issue_date, subject, customer_name, currency")
      .eq("id", offerId)
      .single();
    if (offer) {
      const settings = await getReportSettings(supabase);
      const buffer = await renderOfferPdf({
        offer: {
          offerNo: offer.offer_no as string,
          revNo: revision.rev_no as number,
          issueDate: offer.issue_date as string,
          subject: offer.subject as string,
          customerName: offer.customer_name as string,
          currency: offer.currency as string,
        },
        payload: withDefaults(revision.payload, offer.currency as string),
        company: {
          company: settings.company,
          address: settings.address ?? "",
          phone: settings.phone ?? "",
          email: settings.email ?? "",
          web: settings.web ?? "",
        },
        meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
      });
      const { error: uploadError } = await supabase.storage
        .from("offers")
        .upload(
          `${offerId}/${offerFileName(
            offer.subject as string,
            offer.offer_no as string,
            revision.rev_no as number
          )}`,
          buffer,
          { contentType: "application/pdf", upsert: true }
        );
      arsivlendi = !uploadError;
    }
  } catch {
    arsivlendi = false;
  }

  await audit(supabase, user.id, "offer.revision_issue", {
    offer_id: offerId,
    rev_no: revision.rev_no,
    pdf_archived: arsivlendi,
  });

  // YAYIN TARİHİ HER YAYIMDA TAZELENİR (kullanıcı isteği): takip sayacı "en son
  // ne zaman bir şey gönderdim" sorusunu cevaplar ve revizyon göndermek
  // müşteriyle konuşmayı yeniden başlatır. `issue_date` DEĞİŞMEZ — o numaranın
  // içindeki tarihtir ve teklifin kimliğidir (migration 20260819000003).
  await supabase.from("offers").update({ issued_on: bugun() }).eq("id", offerId);

  // Defter satırı "Gönderildi"ye geçer — ama YALNIZ hazırlanıyorken.
  // Kullanıcının elle "Kazanıldı" dediği bir teklifi yeni bir revizyon
  // yüzünden geri çekmek, az önce verilmiş bir kararı ezmek olurdu (iş
  // emrinin sevk kuralıyla birebir aynı gerekçe).
  await supabase.from("offers").update({ status: "sent" }).eq("id", offerId).eq("status", "draft");

  tazele(offerId);
  revalidatePath(`/offers/${offerId}/revisions/${revisionId}`);
  return arsivlendi ? {} : { warning: "Teklif yayımlandı ancak PDF arşivlenemedi." };
}

// ————————————————————————————————————————————————————————— defter

/**
 * Yazılan değeri deftere ekler — akışı kesmeden.
 *
 * `YeniFirma` bileşeninin kuralı burada da geçerlidir: DEFTERE YAZMAK TEKLİFİN
 * ŞARTI DEĞİLDİR. Kullanıcı listede olmayan bir markayı yazıp teklifini
 * kaydedebilir; düğmeye basmak yalnız bir dahaki sefere listede çıkmasını
 * sağlar. Upsert DEĞİL: önce katlanmış anahtarla aranır, yoksa yazılır —
 * `ensureQuality` ile aynı düzen.
 */
export async function ensureOfferOption(
  input: EnsureOptionInput
): Promise<OfferActionResult & { value?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = ensureOptionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // DEFTERE GİREN METİN BURADA DA BÜYÜR (kullanıcı isteği 19.08.2026, md. 4).
  // Editörün "deftere ekle" kapısı Tanımlar ekranından AYRI bir yoldur; yalnız
  // orayı büyütseydik defter iki yazıma bölünürdü — kullanıcının teklif
  // içinden eklediği madde küçük harfle, Tanımlar'dan eklediği büyük harfle.
  // Muaf listeler (`OFFER_LIST_KEEP_CASE`) burada da muaftır.
  const deger = offerValueUpper(parsed.data.listKey, parsed.data.value);
  const anahtar = trKatla(deger);
  const sorgu = supabase
    .from("offer_options")
    .select("id, value")
    .eq("list_key", parsed.data.listKey)
    .eq("match_key", anahtar);
  const { data: mevcut } = await (parsed.data.parentId
    ? sorgu.eq("parent_id", parsed.data.parentId)
    : sorgu.is("parent_id", null)
  ).maybeSingle();
  if (mevcut) return { value: mevcut.value as string };

  const { data: sonSira } = await supabase
    .from("offer_options")
    .select("sort")
    .eq("list_key", parsed.data.listKey)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("offer_options").insert({
    list_key: parsed.data.listKey,
    value: deger,
    match_key: anahtar,
    parent_id: parsed.data.parentId,
    sort: ((sonSira?.sort as number) ?? 0) + 10,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/offers/tanimlar");
  return { value: deger };
}

/**
 * YAYIMLANMIŞ REVİZYONU TASLAĞA GERİ ÇEKER — yalnız YÖNETİCİ.
 *
 * Kullanıcı isteği (17.08.2026): *"Yönetici yayınlanan teklifi düzenleyebilsin.
 * Yanlış yayınlamış olabilir."*
 *
 * KİLİDİN KENDİSİ KALKMIYOR, bir KAPI açılıyor: yayımlanmış revizyon hâlâ
 * doğrudan güncellenemez (`guard_issued_offer_revision`); burada durum önce
 * `draft`a çekilir, düzenleme ondan sonra normal yolundan yapılır. Fark önemli:
 * yanlışlıkla yapılan bir düzenleme değil, BİLİNÇLİ bir geri çekme gerekiyor.
 *
 * İZ BIRAKIR ve bu bilinçlidir: teslim edilmiş bir belgenin geri çekilmesi
 * denetim defterine yazılır (`offer.revision_unlock`) ve arşivdeki PDF
 * SİLİNMEZ — müşterinin elindeki kâğıdın karşılığı arşivde durmaya devam eder.
 *
 * `issued_on` GERİ ALINMAZ: teklif gerçekten gönderildiyse takip sayacı o günü
 * saymaya devam etmelidir. Yanlış yayımlanmış bir teklifte kullanıcı tarihi
 * zaten yeni yayımda tazeleyecektir.
 */
export async function unlockOfferRevision(
  offerId: string,
  revisionId: string
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole(profile?.role)) {
    return { error: "Yayımlanmış bir teklifi yalnız Yönetici geri çekebilir." };
  }

  // ALANLAR TAM BU ÜÇÜDÜR ve tetikleyicinin kapısı da onları sorar
  // (`guard_issued_offer_revision`, migration 20260819000009): durum `draft`,
  // yayım damgaları boş, geri kalan her şey AYNI. Buraya bir alan daha eklemek
  // — örneğin `notes` — geri çekmeyi sessizce çalışmaz hâle getirir.
  const { data: geri, error } = await supabase
    .from("offer_revisions")
    .update({ status: "draft", issued_at: null, issued_by: null })
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .eq("status", "issued")
    .select("id, rev_no");
  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Geri çekme veritabanı tarafından engellendi — `20260819000009_offer_revision_unlock` migration'ı uygulanmamış olabilir."
        : error.message,
    };
  }
  if (!geri?.length) return { error: "Revizyon bulunamadı ya da zaten taslak." };

  await audit(supabase, user.id, "offer.revision_unlock", {
    offer_id: offerId,
    rev_no: geri[0].rev_no,
  });
  tazele(offerId);
  revalidatePath(`/offers/${offerId}/revisions/${revisionId}`);
  return {};
}
