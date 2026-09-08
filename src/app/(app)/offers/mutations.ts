import "server-only";

// TEKLİF YAZMA ÇEKİRDEĞİ.
//
// Sunucu action'ı ile çerezsiz agent API'si aynı iş kurallarını burada paylaşır.
// Bu dosya HTTP, yönlendirme ve yol tazeleme bilmez; çağıran kapı kendi kimlik
// doğrulamasını yapar ve yalnız doğrulanmış actorId ile buraya gelir.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { coverFieldsFromContact, suggestedContact } from "@/lib/customer-contacts";
import { nextSeq, offerNo } from "@/lib/offers/no";
import {
  applyDefaults,
  emptyPayload,
  emptyItem,
  greetingFor,
  withDefaults,
} from "@/lib/offers/payload";
import { withTotal } from "@/lib/offers/pricing";
import { itemFactsFromRows } from "@/lib/offers/registry";
import { DEFAULT_OFFER_WIN_SCORE, defaultOfferExpectedOn } from "@/lib/offers/analiz";
import { preserveAgentProtectedOfferFields } from "@/lib/offers/agent";
import { defaultItemTitle } from "@/lib/offers/title";
import type { OfferItem } from "@/lib/offers/types";
import { defaultsOf, loadCustomerContacts, loadOfferOptions } from "./data";
import {
  addOfferTemplateItemSchema,
  newOfferSchema,
  saveRevisionSchema,
  type AddOfferTemplateItemInput,
  type NewOfferInput,
  type SaveRevisionInput,
} from "./schema";

export type OfferMutationErrorKind =
  | "validation"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "database";

export interface OfferMutationError {
  kind: OfferMutationErrorKind;
  message: string;
}

export type OfferMutationResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: OfferMutationError };

function failure(kind: OfferMutationErrorKind, message: string): OfferMutationResult<never> {
  return { error: { kind, message } };
}

/** Bugünün ISO tarihi — teklif numarası ondan türer. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface NewOfferRecord {
  lang: string;
  issue_date: string;
  customer_id: string;
  customer_name: string;
  subject: string;
  currency: string;
  created_by: string;
}

/** Yeni teklif numarası önerir; asıl kilit veritabanındaki tekil indekstir. */
async function suggestedSequence(
  supabase: SupabaseClient,
  lang: string,
  date: string
): Promise<number> {
  const { data } = await supabase
    .from("offers")
    .select("seq")
    .eq("lang", lang)
    .eq("issue_date", date);
  return nextSeq((data ?? []).map((row) => row.seq as number));
}

/** Numara çakışırsa sırayı artırıp yeniden dener; üç denemeden sonra vazgeçer. */
export async function writeOfferRecord(
  supabase: SupabaseClient,
  record: NewOfferRecord
): Promise<OfferMutationResult<{ id: string; offerNo: string }>> {
  let sequence = await suggestedSequence(supabase, record.lang, record.issue_date);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("offers")
      .insert({
        ...record,
        seq: sequence,
        offer_no: offerNo(record.lang as "tr" | "en", record.issue_date, sequence),
        expected_on: defaultOfferExpectedOn(record.issue_date),
        win_score: DEFAULT_OFFER_WIN_SCORE,
      })
      .select("id, offer_no")
      .single();
    if (!error && data) {
      return { data: { id: data.id as string, offerNo: data.offer_no as string } };
    }
    if (error?.code !== "23505") {
      return failure("database", "Teklif oluşturulamadı.");
    }
    sequence += 1;
  }
  return failure("conflict", "Teklif numarası üretilemedi; lütfen tekrar deneyin.");
}

/** Kapağın KİMDEN kişisi; kullanıcı ve agent aynı profil defterini okur. */
export async function loadOfferAuthor(
  supabase: SupabaseClient,
  actorId: string
): Promise<{ name: string; title: string; email: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, title, email")
    .eq("id", actorId)
    .maybeSingle();
  return {
    name: (profile?.full_name as string) ?? "",
    title: (profile?.title as string) ?? "",
    email: (profile?.email as string) ?? "",
  };
}

export interface CreatedOfferDraft {
  offerId: string;
  offerNo: string;
  revisionId: string;
  customerName: string;
  issuerName: string;
}

/** İlk R0 taslağıyla birlikte yeni teklif açar. */
export async function createOfferDraft(
  supabase: SupabaseClient,
  actorId: string,
  input: NewOfferInput
): Promise<OfferMutationResult<CreatedOfferDraft>> {
  const parsed = newOfferSchema.safeParse(input);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);

  const [{ data: customer }, { data: issuerCustomer }] = await Promise.all([
    supabase
      .from("customers")
      .select("name")
      .eq("id", parsed.data.customerId)
      .maybeSingle(),
    parsed.data.issuerCustomerId
      ? supabase
          .from("customers")
          .select("id, name, address, tax_office, tax_no, phone, fax")
          .eq("id", parsed.data.issuerCustomerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!customer) return failure("not_found", "Müşteri defterde bulunamadı");
  if (parsed.data.issuerCustomerId && !issuerCustomer) {
    return failure("not_found", "Teklifi hazırlayan firma müşteri defterinde bulunamadı");
  }

  const written = await writeOfferRecord(supabase, {
    lang: parsed.data.lang,
    issue_date: todayIsoDate(),
    customer_id: parsed.data.customerId,
    customer_name: customer.name as string,
    subject: parsed.data.subject,
    currency: parsed.data.currency,
    created_by: actorId,
  });
  if (written.error) return written;

  let payload = emptyPayload(parsed.data.currency);
  if (issuerCustomer) {
    payload.issuer = {
      customerId: issuerCustomer.id as string,
      company: (issuerCustomer.name as string) ?? "",
      address: (issuerCustomer.address as string) ?? "",
      taxOffice: (issuerCustomer.tax_office as string) ?? "",
      taxNo: (issuerCustomer.tax_no as string) ?? "",
      phone: (issuerCustomer.phone as string) ?? "",
      fax: (issuerCustomer.fax as string) ?? "",
      email: "",
      web: "",
    };
  }

  const author = await loadOfferAuthor(supabase, actorId);
  payload.cover = {
    ...payload.cover,
    fromName: author.name,
    fromTitle: author.title,
    fromEmail: author.email,
  };

  const options = await loadOfferOptions(supabase);
  payload = applyDefaults(payload, defaultsOf(options));

  const contacts = await loadCustomerContacts(supabase, parsed.data.customerId);
  const contact = suggestedContact(contacts);
  if (contact) {
    const honorific =
      options.find((option) => option.list_key === "cover.honorific" && option.is_default)
        ?.value ?? "";
    payload.cover = {
      ...payload.cover,
      ...coverFieldsFromContact(contact),
      greeting: greetingFor(contact.name, honorific),
    };
  }

  // TEKLIF-32: teklif kalemsiz açılır; şablon her yeni kalemde ayrıca seçilir.
  payload.items = [];

  const { data: revision, error: revisionError } = await supabase
    .from("offer_revisions")
    .insert({
      offer_id: written.data.id,
      rev_no: 0,
      label: "R0",
      payload,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (revisionError || !revision) {
    return failure("database", "İlk teklif revizyonu oluşturulamadı.");
  }

  return {
    data: {
      offerId: written.data.id,
      offerNo: written.data.offerNo,
      revisionId: revision.id as string,
      customerName: customer.name as string,
      issuerName: (issuerCustomer?.name as string | undefined) ?? "ORION VİNÇ",
    },
  };
}

export interface CreatedOfferRevision {
  revisionId: string;
  revNo: number;
}

export interface AddedOfferTemplateItem {
  item: OfferItem;
}

/**
 * Taslak revizyona defterdeki şablondan kalem ekler.
 *
 * Ham payload alanlarını dışarıdaki agent'ın kurmasına bırakmak, şablon
 * değiştiğinde sessizce eksik bölüm üretirdi. Arayüzdeki Kalem Ekle ile aynı
 * `emptyItem` kurucusu burada çağrılır; yanıt kurulan satırları geri verir ki
 * agent değerleri görüp sonraki PUT'ta yalnız gerçek anahtarları doldursun.
 */
export async function addOfferTemplateItemDraft(
  supabase: SupabaseClient,
  offerId: string,
  revisionId: string,
  input: AddOfferTemplateItemInput
): Promise<OfferMutationResult<AddedOfferTemplateItem>> {
  const offer = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!offer.success) return failure("validation", offer.error.issues[0].message);
  const revision = z.uuid("Geçersiz revizyon").safeParse(revisionId);
  if (!revision.success) return failure("validation", revision.error.issues[0].message);
  const parsed = addOfferTemplateItemSchema.safeParse(input);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);

  const { data: current, error: revisionError } = await supabase
    .from("offer_revisions")
    .select("payload, status")
    .eq("id", revision.data)
    .eq("offer_id", offer.data)
    .maybeSingle();
  if (revisionError) return failure("database", "Teklif revizyonu okunamadı.");
  if (!current) return failure("not_found", "Revizyon bulunamadı.");
  if (current.status === "issued") {
    return failure(
      "conflict",
      "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun."
    );
  }
  if (current.status !== "draft") {
    return failure("forbidden", "Yalnız taslak revizyona kalem eklenebilir.");
  }

  const { data: template, error: templateError } = await supabase
    .from("offer_templates")
    .select("id, crane_type, skeleton")
    .eq("id", parsed.data.templateId)
    .eq("active", true)
    .maybeSingle();
  if (templateError) return failure("database", "Teklif şablonu okunamadı.");
  if (!template) return failure("not_found", "Teklif şablonu bulunamadı.");

  const payload = withDefaults(current.payload);
  const skeleton = template.skeleton as { groupKeys?: unknown } | null;
  const groupKeys = Array.isArray(skeleton?.groupKeys)
    ? skeleton.groupKeys.filter((key): key is string => typeof key === "string")
    : [];
  const manualTitle = parsed.data.title?.trim() ?? "";
  const item = emptyItem(
    manualTitle || defaultItemTitle(payload.items.length + 1),
    groupKeys.length ? groupKeys : ["general"]
  );
  item.craneType = (template.crane_type as string | null) ?? "";
  item.titleManual = manualTitle !== "";
  payload.items = [...payload.items, item];

  const saved = await saveOfferRevisionDraft(supabase, offer.data, revision.data, {
    payload: payload as unknown as Record<string, unknown>,
    background: false,
  });
  if (saved.error) return saved;
  return { data: { item } };
}

/** Son revizyon snapshot'ından yeni bir taslak revizyon üretir. */
export async function createOfferRevisionDraft(
  supabase: SupabaseClient,
  actorId: string,
  offerId: string
): Promise<OfferMutationResult<CreatedOfferRevision>> {
  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return failure("validation", id.error.issues[0].message);

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id")
    .eq("id", id.data)
    .maybeSingle();
  if (offerError) return failure("database", "Teklif okunamadı.");
  if (!offer) return failure("not_found", "Teklif bulunamadı.");

  const { data: latest } = await supabase
    .from("offer_revisions")
    .select("rev_no, payload, notes")
    .eq("offer_id", id.data)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revNo = (latest?.rev_no ?? -1) + 1;
  const { data, error } = await supabase
    .from("offer_revisions")
    .insert({
      offer_id: id.data,
      rev_no: revNo,
      label: `R${revNo}`,
      payload: latest?.payload ?? emptyPayload(),
      notes: latest?.notes ?? "",
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    return failure("conflict", "Aynı revizyon eşzamanlı oluşturuldu; lütfen tekrar deneyin.");
  }
  if (error || !data) return failure("database", "Teklif revizyonu oluşturulamadı.");

  return { data: { revisionId: data.id as string, revNo } };
}

/** Taslak revizyonu normalize eder, toplamı ve kalem künyesini yeniden türetir. */
export async function saveOfferRevisionDraft(
  supabase: SupabaseClient,
  offerId: string,
  revisionId: string,
  input: SaveRevisionInput
): Promise<OfferMutationResult<{ ok: true }>> {
  const offer = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!offer.success) return failure("validation", offer.error.issues[0].message);
  const revision = z.uuid("Geçersiz revizyon").safeParse(revisionId);
  if (!revision.success) return failure("validation", revision.error.issues[0].message);

  const parsed = saveRevisionSchema.safeParse(input);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);

  const payload = withDefaults(parsed.data.payload);
  payload.pricing = withTotal(payload.pricing);
  payload.items = payload.items.map((item) => {
    const facts = itemFactsFromRows(item.groups);
    return {
      ...item,
      capacityT: facts.capacityT,
      spanM: facts.spanM,
      craneType: item.craneType || "",
    };
  });

  const update: Record<string, unknown> = { payload };
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  const { data: written, error } = await supabase
    .from("offer_revisions")
    .update(update)
    .eq("id", revision.data)
    .eq("offer_id", offer.data)
    .eq("status", "draft")
    .select("id");

  const issuedMessage = "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.";
  if (error) {
    if (error.message.includes("Yayınlanmış") || error.message.includes("Yayımlanmış")) {
      return failure("conflict", issuedMessage);
    }
    return failure("database", "Teklif revizyonu kaydedilemedi.");
  }
  if (!written?.length) {
    const { data: current } = await supabase
      .from("offer_revisions")
      .select("status")
      .eq("id", revision.data)
      .eq("offer_id", offer.data)
      .maybeSingle();
    if (current?.status === "issued") return failure("conflict", issuedMessage);
    if (!current) return failure("not_found", "Revizyon bulunamadı.");
    return failure("forbidden", "Teklifi düzenleme yetkisi gerekir.");
  }

  return { data: { ok: true } };
}

/**
 * Agent taslak kaydı: normal kayıt çekirdeği + imza/profil alanı koruması.
 * İmza yükleme v1 scope'unda değildir; ham payload ile iç depo yolu yazılamaz.
 */
export async function saveOfferRevisionDraftForAgent(
  supabase: SupabaseClient,
  offerId: string,
  revisionId: string,
  input: SaveRevisionInput
): Promise<OfferMutationResult<{ ok: true }>> {
  const offer = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!offer.success) return failure("validation", offer.error.issues[0].message);
  const revision = z.uuid("Geçersiz revizyon").safeParse(revisionId);
  if (!revision.success) return failure("validation", revision.error.issues[0].message);
  const parsed = saveRevisionSchema.safeParse(input);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);

  const { data: current, error } = await supabase
    .from("offer_revisions")
    .select("payload, status")
    .eq("id", revision.data)
    .eq("offer_id", offer.data)
    .maybeSingle();
  if (error) return failure("database", "Teklif revizyonu okunamadı.");
  if (!current) return failure("not_found", "Revizyon bulunamadı.");
  if (current.status === "issued") {
    return failure(
      "conflict",
      "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun."
    );
  }

  const payload = preserveAgentProtectedOfferFields(parsed.data.payload, current.payload);
  return saveOfferRevisionDraft(supabase, offer.data, revision.data, {
    payload: payload as unknown as Record<string, unknown>,
    notes: parsed.data.notes,
    background: parsed.data.background,
  });
}
