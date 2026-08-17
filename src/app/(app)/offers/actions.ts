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
import { getReportSettings } from "@/lib/settings";
import { trKatla } from "@/lib/drawings/tr-text";
import { copyPayloadForCustomer } from "@/lib/offers/copy";
import { nextSeq, offerNo } from "@/lib/offers/no";
import { emptyItem, emptyPayload, withDefaults } from "@/lib/offers/payload";
import { withTotal } from "@/lib/offers/pricing";
import { offerFileName } from "@/lib/pdf/doc-naming";
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

  // İlk revizyon (R0) — şablon seçildiyse kalem iskeleti onunla kurulur.
  const payload = emptyPayload(parsed.data.currency);
  const kunye = await hazirlayan(supabase, user.id);
  payload.cover = {
    ...payload.cover,
    fromName: kunye.name,
    fromTitle: kunye.title,
    fromEmail: kunye.email,
  };

  if (parsed.data.templateId) {
    const { data: sablon } = await supabase
      .from("offer_templates")
      .select("name, crane_type, skeleton")
      .eq("id", parsed.data.templateId)
      .maybeSingle();
    const groupKeys = (sablon?.skeleton as { groupKeys?: string[] } | null)?.groupKeys ?? [];
    const item = emptyItem(parsed.data.itemTitle || parsed.data.subject, groupKeys);
    item.craneType = (sablon?.crane_type as string) || "";
    payload.items = [item];
  } else if (parsed.data.itemTitle) {
    payload.items = [emptyItem(parsed.data.itemTitle)];
  }

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

  const { data: silinen, error } = await supabase.from("offers").delete().eq("id", id.data).select("id");
  if (error) return { error: error.message };
  if (!silinen?.length) return { error: "Teklif silmek yönetici yetkisi ister." };

  await audit(supabase, user.id, "offer.delete", { offer_id: id.data });
  revalidatePath("/offers");
  return {};
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

  const { data: silinen, error } = await supabase
    .from("offer_revisions")
    .delete()
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .select("id, rev_no");
  // Yayımlanmış revizyonu tetikleyici durdurur; mesajı anlaşılır kılalım.
  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Yayımlanmış revizyon silinemez; yeni bir revizyon oluşturun."
        : error.message,
    };
  }
  if (!silinen?.length) return { error: "Revizyon silme yetkisi gerekir." };

  await audit(supabase, user.id, "offer.revision_delete", {
    offer_id: offerId,
    rev_no: silinen[0].rev_no,
  });
  tazele(offerId);
  return {};
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

  const { data: yazilan, error } = await supabase
    .from("offer_revisions")
    .update({ payload, notes: parsed.data.notes })
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

  tazele(offerId);
  revalidatePath(`/offers/${offerId}/revisions/${revisionId}`);
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

  const anahtar = trKatla(parsed.data.value);
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
    value: parsed.data.value,
    match_key: anahtar,
    parent_id: parsed.data.parentId,
    sort: ((sonSira?.sort as number) ?? 0) + 10,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/offers/tanimlar");
  return { value: parsed.data.value };
}
