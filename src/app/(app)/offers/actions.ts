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
import { withDefaults } from "@/lib/offers/payload";
import { offerFileName } from "@/lib/pdf/doc-naming";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/offers/status";
import { renderOfferPdf } from "@/lib/pdf/offer";
import {
  isOfferSignaturePath,
  MAX_OFFER_SIGNATURE_BYTES,
  OFFER_SIGNATURE_BUCKET,
  OFFER_SIGNATURE_MIME,
} from "@/lib/offers/signature";
import { normalizeOfferSignature } from "@/lib/offers/signature-image";
import { loadOfferSignatureImages } from "@/lib/offers/signature-server";
import {
  loadCustomerLogo,
  resolveCustomerIdForSnapshot,
} from "@/lib/customers/logo-server";
import { offerIssuerCompany, offerIssuerName } from "@/lib/offers/issuer";
import {
  copyOfferSchema,
  ensureOptionSchema,
  offerDetailsSchema,
  type CopyOfferInput,
  type EnsureOptionInput,
  type NewOfferInput,
  type OfferDetailsInput,
  offerSubjectSchema,
  type OfferSubjectInput,
  type SaveRevisionInput,
} from "./schema";
import {
  createOfferDraft,
  createOfferRevisionDraft,
  loadOfferAuthor,
  saveOfferRevisionDraft,
  todayIsoDate,
  writeOfferRecord,
} from "./mutations";

export type OfferActionResult = { error?: string; warning?: string; ok?: boolean };

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
  revalidatePath("/offers/analiz");
  if (offerId) revalidatePath(`/offers/${offerId}`);
}

function bugun(): string {
  return todayIsoDate();
}

// ————————————————————————————————————————————————————————— teklif açma

export async function createOffer(input: NewOfferInput): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const result = await createOfferDraft(supabase, user.id, input);
  if (result.error) return { error: result.error.message };

  await audit(supabase, user.id, "offer.create", {
    offer_id: result.data.offerId,
    offer_no: result.data.offerNo,
    customer: result.data.customerName,
    issuer: result.data.issuerName,
  });
  tazele(result.data.offerId);
  redirect(`/offers/${result.data.offerId}`);
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
    .select("id, payload")
    .eq("offer_id", kaynak.id)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const yazildi = await writeOfferRecord(supabase, {
    lang: kaynak.lang as string,
    issue_date: todayIsoDate(),
    customer_id: parsed.data.customerId,
    customer_name: customer.name as string,
    subject: parsed.data.subject,
    currency: kaynak.currency as string,
    created_by: user.id,
  });
  if (yazildi.error) return { error: yazildi.error.message };

  const payload = copyPayloadForCustomer(
    withDefaults(revision?.payload, kaynak.currency as string),
    {
      customerName: customer.name as string,
      sourceRevisionId: revision?.id as string | undefined,
      from: await loadOfferAuthor(supabase, user.id),
    }
  );

  const { error: revError } = await supabase.from("offer_revisions").insert({
    offer_id: yazildi.data.id,
    rev_no: 0,
    label: "R0",
    payload,
    created_by: user.id,
  });
  if (revError) return { error: revError.message };

  await audit(supabase, user.id, "offer.copy", {
    offer_id: yazildi.data.id,
    offer_no: yazildi.data.offerNo,
    source_offer_id: parsed.data.sourceOfferId,
    customer: customer.name,
  });
  tazele(yazildi.data.id);
  redirect(`/offers/${yazildi.data.id}`);
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
    .select("subject, customer_name, status, currency, issued_on, issue_date, won_on")
    .eq("id", id.data)
    .maybeSingle();

  // Durum listeden elle GÖNDERİLDİ yapıldığında da takip saati başlamalıdır.
  // Geçmiş tekliflerde kullanıcının beklediği yaş teklif tarihinden çıkar;
  // açık bir `issued_on` varsa hiçbir zaman üzerine yazılmaz.
  const ilkGonderim =
    parsed.data.status === "sent" && !onceki?.issued_on
      ? ((onceki?.issue_date as string | null) ?? bugun())
      : null;

  // KAZANILMA TARİHİ durumdan ayrı bir tahmin değildir. Pencere alanı açıkça
  // yolladıysa o gün kullanılır; hızlı seçiciden ilk kez `won`a geçiliyorsa
  // bugün önerilir. Zaten kazanılmış ama tarihi bilinmeyen eski bir kaydı
  // sıradan künye düzenlemesiyle bugüne taşımayız.
  const kazanmaGunu =
    parsed.data.status !== "won"
      ? null
      : parsed.data.wonOn !== undefined
        ? parsed.data.wonOn ?? (onceki?.status === "won" ? null : bugun())
        : onceki?.status === "won"
          ? ((onceki.won_on as string | null) ?? null)
          : bugun();

  const becomingWon = parsed.data.status === "won" && onceki?.status !== "won";
  const { data: yazilan, error } = await supabase
    .from("offers")
    .update({
      subject: parsed.data.subject,
      customer_id: parsed.data.customerId,
      customer_name: customer.name,
      // Kazanılma geçişi son revizyonla birlikte SQL işlevinde tamamlanır.
      status: becomingWon ? onceki?.status ?? "draft" : parsed.data.status,
      currency: parsed.data.currency,
      won_on: becomingWon ? onceki?.won_on ?? null : kazanmaGunu,
      ...(ilkGonderim ? { issued_on: ilkGonderim } : {}),
    })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: error.message };
  // Yetkisizlik SESSİZ BAŞARI olmasın: RLS satırı vermezse `update` hata
  // döndürmez, hiçbir satıra dokunmaz.
  if (!yazilan?.length) return { error: "Teklifi düzenleme yetkisi gerekir." };

  const wonResult = becomingWon
    ? await markOfferWon(supabase, id.data, kazanmaGunu)
    : {};
  if (wonResult.error) return { error: wonResult.error };

  await audit(supabase, user.id, "offer.update", {
    offer_id: id.data,
    onceki,
    yeni: {
      ...parsed.data,
      wonOn: kazanmaGunu,
      ...(ilkGonderim ? { issuedOn: ilkGonderim } : {}),
    },
  });
  tazele(id.data);
  return wonResult.warning ? { warning: wonResult.warning } : {};
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
    .select("status, issued_on, issue_date, won_on")
    .eq("id", id.data)
    .maybeSingle();

  if (durum.data === "won" && onceki?.status !== "won") {
    const result = await markOfferWon(supabase, id.data, bugun());
    if (result.error) return { error: result.error };
    tazele(id.data);
    return result.warning ? { warning: result.warning } : {};
  }

  const ilkGonderim =
    durum.data === "sent" && !onceki?.issued_on
      ? ((onceki?.issue_date as string | null) ?? bugun())
      : null;

  const kazanmaGunu =
    durum.data === "won"
      ? onceki?.status === "won"
        ? ((onceki.won_on as string | null) ?? null)
        : bugun()
      : null;

  const { data: yazilan, error } = await supabase
    .from("offers")
    .update({
      status: durum.data,
      won_on: kazanmaGunu,
      ...(ilkGonderim ? { issued_on: ilkGonderim } : {}),
    })
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
    won_on: kazanmaGunu,
    ...(ilkGonderim ? { issued_on: ilkGonderim } : {}),
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

  const result = await createOfferRevisionDraft(supabase, user.id, offerId);
  if (result.error) return { error: result.error.message };

  await audit(supabase, user.id, "offer.revision_create", {
    offer_id: offerId,
    rev_no: result.data.revNo,
  });
  tazele(offerId);
  return { id: result.data.revisionId };
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

  const result = await saveOfferRevisionDraft(supabase, offerId, revisionId, input);
  if (result.error) return { error: result.error.message };

  // ARKA PLAN KAYDI YOL TAZELEMEZ: editör kendi durumunu zaten elinde tutar ve
  // yürürlükteki sayfayı her yazma duraklamasında yeniden çektirmek boş bir ağ
  // turudur. Liste ve panel `force-dynamic`tir, oraya gidildiğinde taze
  // üretilir; tazeleme doğruluk için değil hız içindi. Yayım kendi yollarını
  // yine tam tazeler (`issueOfferRevision`) — kilitlenen belge listede anında
  // görünmelidir.
  if (!input.background) {
    tazele(offerId);
    revalidatePath(`/offers/${offerId}/revisions/${revisionId}`);
  }
  return { ok: true };
}

/**
 * Tarayıcının özel kovaya yüklediği imza PNG'sini ölçer ve standartlaştırır.
 * Payload'a yolu yazmak editörün işidir; bu kapı dosyanın gerçekten PNG ve bu
 * taslak revizyona ait olduğunu kanıtlar.
 */
export async function prepareOfferSignature(
  offerId: string,
  revisionId: string,
  input: { path: string; fileName: string }
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const path = (input.path ?? "").trim();
  if (!isOfferSignaturePath(offerId, revisionId, path)) {
    return { error: "İmza yolu bu teklif revizyonuna ait değil." };
  }
  const { data: revision } = await supabase
    .from("offer_revisions")
    .select("id")
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .eq("status", "draft")
    .maybeSingle();
  if (!revision) return { error: "Yalnız taslak revizyona imza eklenebilir." };

  const { data: file, error: downloadError } = await supabase.storage
    .from(OFFER_SIGNATURE_BUCKET)
    .download(path);
  if (downloadError || !file) return { error: "Yüklenen imza depoda bulunamadı." };

  async function reject(message: string): Promise<OfferActionResult> {
    await supabase.storage.from(OFFER_SIGNATURE_BUCKET).remove([path]);
    return { error: message };
  }
  if (file.size > MAX_OFFER_SIGNATURE_BYTES) return reject("İmza 1 MB sınırını aşıyor.");
  const normalized = await normalizeOfferSignature(new Uint8Array(await file.arrayBuffer()));
  if (!normalized.ok) return reject(normalized.error);
  const { error: uploadError } = await supabase.storage
    .from(OFFER_SIGNATURE_BUCKET)
    .upload(path, normalized.png, { contentType: OFFER_SIGNATURE_MIME, upsert: true });
  if (uploadError) return reject(`İmza kaydedilemedi: ${uploadError.message}`);

  await audit(supabase, user.id, "offer.signature_prepare", {
    offer_id: offerId,
    revision_id: revisionId,
    file: (input.fileName ?? "").trim(),
  });
  return { ok: true };
}

/** Taslakta kullanılmayan imza nesnesini geri alınabilir en dar kapsamda siler. */
export async function removeOfferSignature(
  offerId: string,
  revisionId: string,
  path: string
): Promise<OfferActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  if (!isOfferSignaturePath(offerId, revisionId, path)) {
    return { error: "İmza yolu bu teklif revizyonuna ait değil." };
  }
  const { error } = await supabase.storage.from(OFFER_SIGNATURE_BUCKET).remove([path]);
  if (error) return { error: error.message };
  await audit(supabase, user.id, "offer.signature_remove", {
    offer_id: offerId,
    revision_id: revisionId,
  });
  return { ok: true };
}

async function archiveOfferRevisionPdf(
  supabase: SupabaseClient,
  offerId: string,
  revisionId: string
): Promise<boolean> {
  try {
    const [{ data: revision }, { data: offer }] = await Promise.all([
      supabase
        .from("offer_revisions")
        .select("rev_no, payload")
        .eq("id", revisionId)
        .eq("offer_id", offerId)
        .maybeSingle(),
      supabase
        .from("offers")
        .select("offer_no, issue_date, subject, customer_id, customer_name, currency")
        .eq("id", offerId)
        .maybeSingle(),
    ]);
    if (!offer || !revision) return false;

    const normalizedPayload = withDefaults(revision.payload, offer.currency as string);
    const customerId = await resolveCustomerIdForSnapshot(
      supabase,
      offer.customer_id as string | null,
      offer.customer_name as string
    );
    const [settings, customerLogo, issuerLogo, signatureImages] = await Promise.all([
      getReportSettings(supabase),
      loadCustomerLogo(supabase, customerId),
      loadCustomerLogo(supabase, normalizedPayload.issuer.customerId),
      loadOfferSignatureImages(supabase, normalizedPayload),
    ]);
    const buffer = await renderOfferPdf({
      offer: {
        offerNo: offer.offer_no as string,
        revNo: revision.rev_no as number,
        issueDate: offer.issue_date as string,
        subject: offer.subject as string,
        customerName: offer.customer_name as string,
        currency: offer.currency as string,
      },
      payload: normalizedPayload,
      company: offerIssuerCompany(normalizedPayload, settings),
      customerLogo,
      issuerLogo: normalizedPayload.issuer.customerId ? issuerLogo : undefined,
      meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
      signatureImages,
    });
    const { error } = await supabase.storage
      .from("offers")
      .upload(
        `${offerId}/${offerFileName(
          offer.subject as string,
          offer.offer_no as string,
          revision.rev_no as number,
          offerIssuerName(normalizedPayload, settings)
        )}`,
        buffer,
        { contentType: "application/pdf", upsert: true }
      );
    return !error;
  } catch {
    return false;
  }
}

async function markOfferWon(
  supabase: SupabaseClient,
  offerId: string,
  wonOn: string | null
): Promise<OfferActionResult> {
  const { data, error } = await supabase.rpc("mark_offer_won", {
    p_offer_id: offerId,
    p_won_on: wonOn,
  });
  if (error) return { error: error.message };
  const result = data as {
    revision_id?: string;
    newly_issued?: boolean;
  } | null;
  if (!result?.revision_id) return { error: "Son teklif revizyonu okunamadı" };
  if (!result.newly_issued) return {};
  const archived = await archiveOfferRevisionPdf(supabase, offerId, result.revision_id);
  return archived ? {} : { warning: "Teklif kazanıldı ve son revizyon yayımlandı; PDF arşivlenemedi." };
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
    .select("rev_no, issued_at")
    .single();
  if (error || !revision) {
    return { error: error?.message ?? "Revizyon bulunamadı veya zaten yayımlanmış" };
  }

  const arsivlendi = await archiveOfferRevisionPdf(supabase, offerId, revisionId);

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
 * Akış içi defter kuralı burada da geçerlidir: DEFTERE YAZMAK TEKLİFİN ŞARTI
 * DEĞİLDİR. Kullanıcı listede olmayan bir markayı yazıp teklifini
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
