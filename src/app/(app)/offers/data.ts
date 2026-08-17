// TEKLİF BÖLÜMÜNÜN ORTAK OKUMA KATMANI.
//
// EKRAN İLE BELGE AYNI YERDEN OKUR (Satış Takibi'nin kuralı): liste, teklif
// paneli, editör ve PDF ucu aynı fonksiyonları çağırır. İki sorgu yazılsaydı
// müşteriye giden belge ile ekrandaki teklif sessizce ayrışırdı.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerContact } from "@/lib/customer-contacts";
import { withDefaults } from "@/lib/offers/payload";
import type { OfferListRow } from "@/lib/offers/filter";
import type { OfferPayload } from "@/lib/offers/types";

// ————————————————————————————————————————————————————————— liste

interface OfferListRecord {
  id: string;
  offer_no: string;
  lang: string;
  issue_date: string;
  seq: number;
  customer_id: string | null;
  customer_name: string;
  subject: string;
  status: string;
  currency: string;
  job_id: string | null;
  issued_on: string | null;
  created_at: string;
  updated_at: string;
  latest_revision_id: string | null;
  latest_rev_no: number | null;
  latest_rev_status: string | null;
  latest_total: number | string | null;
  crane_types: unknown;
  capacities_t: unknown;
  item_count: number | null;
}

function sayilar(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
}

function metinler(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

export interface OfferListEntry extends OfferListRow {
  lang: string;
  customerId: string | null;
  latestRevisionId: string | null;
  latestRevStatus: string | null;
  updatedAt: string;
}

/**
 * Liste satırları — `offer_list` GÖRÜNÜMÜNDEN okunur.
 *
 * Görünüm süzgeç boyutlarını (vinç tipi, tonaj) güncel revizyonun payload'ından
 * TÜRETİR; tabloya kopyalanmadıkları için ekrandaki süzgeç belgenin gerçekte
 * söylediğinden başka bir şey gösteremez. Müşteri kısaltması ve rengi ayrı bir
 * sorgudan gelir: teklif `customer_name` FOTOĞRAFINI taşır, defter ise
 * kısaltmayı ve tonu (İşler ve Satış Takibi'yle aynı düzen).
 */
export async function loadOfferList(supabase: SupabaseClient): Promise<OfferListEntry[]> {
  const [{ data, error }, { data: musteriler }] = await Promise.all([
    supabase.from("offer_list").select("*").order("issue_date", { ascending: false }),
    supabase.from("customers").select("id, name, short_name, color_hue"),
  ]);
  if (error) return [];

  const defter = new Map(
    (musteriler ?? []).map((c) => [c.id as string, c as { short_name: string | null; color_hue: number | null }])
  );

  return (data as OfferListRecord[]).map((r) => {
    const musteri = r.customer_id ? defter.get(r.customer_id) : undefined;
    return {
      id: r.id,
      offer_no: r.offer_no,
      subject: r.subject,
      customer_name: r.customer_name,
      customerShort: musteri?.short_name || null,
      customerHue: musteri?.color_hue ?? null,
      status: r.status,
      issue_date: r.issue_date,
      issuedOn: r.issued_on,
      currency: r.currency,
      latestTotal: r.latest_total === null ? null : Number(r.latest_total),
      latestRevNo: r.latest_rev_no,
      craneTypes: metinler(r.crane_types),
      capacities: sayilar(r.capacities_t),
      itemCount: r.item_count ?? 0,
      lang: r.lang,
      customerId: r.customer_id,
      latestRevisionId: r.latest_revision_id,
      latestRevStatus: r.latest_rev_status,
      updatedAt: r.updated_at,
    };
  });
}

// ————————————————————————————————————————————————————————— tekil

export interface OfferRecord {
  id: string;
  offer_no: string;
  lang: string;
  issue_date: string;
  seq: number;
  customer_id: string | null;
  customer_name: string;
  subject: string;
  status: string;
  currency: string;
  job_id: string | null;
  issued_on: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OfferRevisionRecord {
  id: string;
  offer_id: string;
  rev_no: number;
  label: string;
  status: string;
  total_amount: number | string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  issued_at: string | null;
}

export async function loadOffer(
  supabase: SupabaseClient,
  offerId: string
): Promise<{ offer: OfferRecord; revisions: OfferRevisionRecord[] } | null> {
  const { data: offer } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return null;
  const { data: revisions } = await supabase
    .from("offer_revisions")
    .select("id, offer_id, rev_no, label, status, total_amount, notes, created_at, updated_at, issued_at")
    .eq("offer_id", offerId)
    .order("rev_no", { ascending: false });
  return { offer: offer as OfferRecord, revisions: (revisions ?? []) as OfferRevisionRecord[] };
}

export interface OfferRevisionFull extends OfferRevisionRecord {
  payload: OfferPayload;
}

/** Revizyonu BELGE olarak okur — `withDefaults` eski kayıtları bugüne taşır. */
export async function loadOfferRevision(
  supabase: SupabaseClient,
  offerId: string,
  revisionId: string
): Promise<{ offer: OfferRecord; revision: OfferRevisionFull } | null> {
  const { data: offer } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return null;
  const { data: revision } = await supabase
    .from("offer_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("offer_id", offerId)
    .maybeSingle();
  if (!revision) return null;
  return {
    offer: offer as OfferRecord,
    revision: {
      ...(revision as OfferRevisionRecord),
      payload: withDefaults(revision.payload, (offer as OfferRecord).currency),
    },
  };
}

// ————————————————————————————————————————————————————————— defter

export interface OfferOptionRow {
  id: string;
  list_key: string;
  value: string;
  parent_id: string | null;
  sort: number;
  active: boolean;
  is_default: boolean;
  note: string;
}

/**
 * Teklif defterinin TAMAMI — editör bütün açılır listeleri tek okumada alır.
 *
 * Liste başına ayrı sorgu atılsaydı editör açılışında elli sorgu koşardı;
 * defterin bütünü birkaç yüz satırdır ve bir kerede gelmesi hem daha hızlı hem
 * daha basittir (fiyat arşivinin dersi: sayım embed ile alınır, N+1 kurulmaz).
 *
 * YUMUŞAK DÜŞER (SATIN-21): tablo yoksa boş defter döner ve ekran yine açılır —
 * göç uygulanmamış bir ortamda teklif yazmak zorlaşır ama imkânsız olmaz.
 */
export async function loadOfferOptions(supabase: SupabaseClient): Promise<OfferOptionRow[]> {
  const { data, error } = await supabase
    .from("offer_options")
    .select("id, list_key, value, parent_id, sort, active, is_default, note")
    .order("list_key")
    .order("sort")
    .order("value");
  if (error) return [];
  return (data ?? []) as OfferOptionRow[];
}

/** `list_key` → seçenekler (yalnız etkin olanlar; kök maddeler). */
export type OfferOptionIndex = Record<string, OfferOptionRow[]>;

export function indexOptions(rows: readonly OfferOptionRow[]): OfferOptionIndex {
  const out: OfferOptionIndex = {};
  for (const row of rows) {
    if (!row.active) continue;
    (out[row.list_key] ??= []).push(row);
  }
  return out;
}

/**
 * Defterde VARSAYILAN işaretli değerler — `list_key` → değer.
 *
 * Yeni teklif bunlarla doldurulur (`applyDefaults`). Bir listede birden çok
 * varsayılan bulunursa İLKİ kazanır: kural yazma yolunda korunuyor
 * (`updateOfferOption` kardeşleri düşürür), burada yalnız kararlı davranırız.
 */
export function defaultsOf(rows: readonly OfferOptionRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!row.active || !row.is_default || row.parent_id) continue;
    if (out[row.list_key] === undefined) out[row.list_key] = row.value;
  }
  return out;
}

/** Ebeveyn kimliği → çocuk seçenekler (marka → tip/seri). */
export function indexChildren(rows: readonly OfferOptionRow[]): Record<string, OfferOptionRow[]> {
  const out: Record<string, OfferOptionRow[]> = {};
  for (const row of rows) {
    if (!row.active || !row.parent_id) continue;
    (out[row.parent_id] ??= []).push(row);
  }
  return out;
}

export interface OfferTemplateRow {
  id: string;
  name: string;
  crane_type: string;
  skeleton: { groupKeys?: string[] } | null;
  sort: number;
  active: boolean;
}

export async function loadOfferTemplates(supabase: SupabaseClient): Promise<OfferTemplateRow[]> {
  const { data, error } = await supabase
    .from("offer_templates")
    .select("id, name, crane_type, skeleton, sort, active")
    .eq("active", true)
    .order("sort")
    .order("name");
  if (error) return [];
  return (data ?? []) as OfferTemplateRow[];
}

// ————————————————————————————————————————————————————————— müşteri

/**
 * MÜŞTERİ SEÇİCİSİ İŞ EMRİNDEN DEVRALINIR, kopyalanmaz.
 *
 * `CustomerPicker` ve `NewCustomerDialog` (`jobs/customer-picker.tsx`) zaten
 * defterden seçmeyi ve akışı kesmeden yeni kayıt açmayı yapıyor — kullanıcının
 * istediği "hızlı müşteri kayıt sistemi" tam olarak odur. İkinci bir seçici
 * yazılsaydı kısaltma/renk kuralları iki yerde yaşar ve biri diğerinden
 * ayrışırdı. Tip de oradan gelir; burada ikinci bir müşteri şekli tanımlanmaz.
 */
export type { CustomerOption } from "@/app/(app)/jobs/schema";
import type { CustomerOption } from "@/app/(app)/jobs/schema";

/**
 * Müşteri defteri — teklif YALNIZ LİSTEDEN seçilir ya da "Yeni Müşteri" ile
 * deftere yazılır (iş emrinin kuralı, IS-14): serbest metin ikinci bir müşteri
 * listesi büyütür ve kısaltma/renk gibi defter alanları o kayıtlara bağlanamaz.
 */
/**
 * MÜŞTERİNİN İLETİŞİM KİŞİLERİ — teklif kapağındaki "KİME" bloğunun kaynağı.
 *
 * Kullanıcı isteği (17.08.2026): *"Müşteri seçtiğimde müşteri bilgilerini de
 * getir … teklifte kişi belirtiliyor. Bir veya birden fazla kişi olabilir."*
 * Defter `/admin/customers` ekranındadır; teklif onu YALNIZ OKUR ve seçilen
 * kişinin bilgilerini kapağa FOTOĞRAF olarak yazar — defter sonradan
 * düzeltilince teslim edilmiş teklif değişmemelidir (müşteri adıyla aynı kural).
 */
export async function loadCustomerContacts(
  supabase: SupabaseClient,
  customerId: string | null | undefined
): Promise<CustomerContact[]> {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from("customer_contacts")
    .select("id, customer_id, name, title, department, phone, email, note, is_primary, active, sort")
    .eq("customer_id", customerId)
    .order("sort")
    .order("name");
  // YUMUŞAK DÜŞER (SATIN-21): göç uygulanmamış bir ortamda teklif yazmak
  // zorlaşır ama imkânsız olmaz — kapak alanları elle doldurulabilir.
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as string,
    customerId: r.customer_id as string,
    name: (r.name as string) ?? "",
    title: (r.title as string) ?? "",
    department: (r.department as string) ?? "",
    phone: (r.phone as string) ?? "",
    email: (r.email as string) ?? "",
    note: (r.note as string) ?? "",
    isPrimary: r.is_primary === true,
    active: r.active !== false,
    sort: (r.sort as number) ?? 0,
  }));
}

export async function loadCustomers(supabase: SupabaseClient): Promise<CustomerOption[]> {
  const { data } = await supabase
    .from("customers")
    .select("id, name, short_name, color_hue, address, tax_office, tax_no, phone, fax, notes")
    .order("name");
  return (data ?? []) as CustomerOption[];
}
