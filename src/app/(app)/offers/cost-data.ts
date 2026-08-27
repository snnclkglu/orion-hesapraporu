// MALİYET ÇALIŞMASININ OKUMA KATMANI.
//
// `data.ts`ten AYRI bir dosyadır çünkü ayrı bir yetki sorusudur
// (`can_see_offer_costs`). Aynı dosyada dursalardı teklif listesini besleyen
// bir sorguya maliyet alanı eklemek fark edilmeden mümkün olurdu — ve kâr
// marjı, teklifi görebilen ama maliyeti görmemesi gereken bir role oradan
// sızardı.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  costModels,
  costSteelWeights,
  costWeights,
  withCostDefaults,
} from "@/lib/offers/cost/payload";
import {
  costOverview,
  costTotals,
  loadedCostByOfferItem,
  manualCostByPriceLine,
} from "@/lib/offers/cost/totals";
import type { CostPayload } from "@/lib/offers/cost/types";
import { MATERIAL_PRICE_DEFS } from "@/lib/offers/cost/registry";
import { emptyPayload, withDefaults } from "@/lib/offers/payload";

export interface CostMaterialPriceBook {
  prices: Record<string, number | null>;
  error?: string;
}

/**
 * Global hammadde fiyat defteri — yalnız YENİ maliyetin açılış kopyasıdır.
 *
 * Eksik satır `null` kalır; kod varsayılanına sessiz düşmez. Defterde bir
 * fiyat silindiyse yeni belgenin eski bir sayıyla hesaplanması, boş görünmesi
 * ve insanın karar vermesinden daha tehlikelidir.
 */
export async function loadCostMaterialPriceBook(
  supabase: SupabaseClient
): Promise<CostMaterialPriceBook> {
  const prices: Record<string, number | null> = Object.fromEntries(
    MATERIAL_PRICE_DEFS.map((d) => [d.key, null])
  );
  const { data, error } = await supabase
    .from("offer_cost_material_prices")
    .select("key, unit_price")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) return { prices, error: error.message };

  for (const row of (data ?? []) as { key: string; unit_price: number | string | null }[]) {
    if (!(row.key in prices)) continue;
    const n = row.unit_price === null ? null : Number(row.unit_price);
    prices[row.key] = n !== null && Number.isFinite(n) ? n : null;
  }
  return { prices };
}

export interface OfferCostRecord {
  id: string;
  offer_id: string;
  rev_no: number;
  label: string;
  status: string;
  direct_amount: number | string | null;
  total_amount: number | string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  issued_at: string | null;
}

export interface OfferCostFull extends OfferCostRecord {
  payload: CostPayload;
}

/** Teklif panelinde Özet sayfasıyla aynı üç karar tutarını taşıyan satır. */
export interface OfferCostListRecord extends OfferCostRecord {
  summaryPrice: number | null;
  summaryCost: number | null;
  summaryProfit: number | null;
}

const ALANLAR =
  "id, offer_id, rev_no, label, status, direct_amount, total_amount, notes, created_at, updated_at, issued_at";

/**
 * Bir teklifin maliyet revizyonları — en yeniden eskiye.
 *
 * YUMUŞAK DÜŞER (SATIN-21): göç uygulanmamış bir ortamda teklif paneli yine
 * açılır, yalnız maliyet bölümü boş görünür. Teklif yazmak maliyet tablosuna
 * bağlı değildir ve olmamalıdır.
 */
export async function loadOfferCosts(
  supabase: SupabaseClient,
  offerId: string
): Promise<OfferCostListRecord[]> {
  const [{ data, error }, { data: offerRevision }] = await Promise.all([
    supabase
      .from("offer_cost_revisions")
      .select(`${ALANLAR}, payload`)
      .eq("offer_id", offerId)
      .order("rev_no", { ascending: false }),
    supabase
      .from("offer_revisions")
      .select("payload")
      .eq("offer_id", offerId)
      .order("rev_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) return [];
  return ((data ?? []) as (OfferCostRecord & { payload: unknown })[]).map((row) => {
    const payload = withCostDefaults(row.payload);
    const models = costModels(payload);
    const totals = costTotals(payload, costWeights(models));
    const offer = offerRevision
      ? withDefaults(offerRevision.payload, payload.currency)
      : emptyPayload(payload.currency);
    const summary = costOverview(totals, offer, costSteelWeights(models), payload).margin;
    return {
      id: row.id,
      offer_id: row.offer_id,
      rev_no: row.rev_no,
      label: row.label,
      status: row.status,
      direct_amount: row.direct_amount,
      total_amount: row.total_amount,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      issued_at: row.issued_at,
      summaryPrice: summary.price,
      summaryCost: summary.cost,
      summaryProfit: summary.profit,
    };
  });
}

/** Maliyet revizyonunu BELGE olarak okur — `withCostDefaults` bugüne taşır. */
export async function loadOfferCostRevision(
  supabase: SupabaseClient,
  offerId: string,
  costRevId: string,
  currency = "EUR"
): Promise<OfferCostFull | null> {
  const { data } = await supabase
    .from("offer_cost_revisions")
    .select(`${ALANLAR}, payload`)
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as OfferCostRecord),
    payload: withCostDefaults((data as { payload: unknown }).payload, currency),
  };
}

export interface OfferCostSummary {
  id: string;
  revNo: number;
  status: string;
  direct: number | null;
  total: number | null;
  /** Maliyetin kurulduğu TEKLİF revizyonu — güncelle karşılaştırılır. */
  sourceRevNo: number | null;
  updatedAt: string;
}

/**
 * Teklifin GÜNCEL maliyet özeti — teklif editöründeki "Maliyet" sütununun
 * ve panelin kâr rozetinin kaynağı.
 *
 * Payload'ı da okur çünkü sütun kalem kalem maliyet ister; özet sütunlar
 * (`total_amount`) yalnız belgenin toplamını söyler. Tek sorgu ile ikisi de
 * gelir — teklif editörü zaten tek bir revizyon açıyor, ikinci bir istek
 * kazancı yok.
 */
export async function loadLatestOfferCost(
  supabase: SupabaseClient,
  offerId: string,
  currency = "EUR"
): Promise<{ summary: OfferCostSummary; payload: CostPayload } | null> {
  const { data, error } = await supabase
    .from("offer_cost_revisions")
    .select(`${ALANLAR}, payload`)
    .eq("offer_id", offerId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as OfferCostRecord & { payload: unknown };
  const payload = withCostDefaults(r.payload, currency);
  return {
    summary: {
      id: r.id,
      revNo: r.rev_no,
      status: r.status,
      direct: r.direct_amount === null ? null : Number(r.direct_amount),
      total: r.total_amount === null ? null : Number(r.total_amount),
      sourceRevNo: payload.sourceRevNo,
      updatedAt: r.updated_at,
    },
    payload,
  };
}

/** Maliyet revizyonunun etiketi — teklifin R'siyle karışmasın diye M'dir. */
export function costRevLabel(revNo: number): string {
  return `M${revNo}`;
}

/**
 * TEKLİF EDİTÖRÜNÜN "MALİYET" SÜTUNUNUN kaynağı.
 *
 * Kullanıcı isteği (17.08.2026): *"Teklif satırında tutarın soluna maliyet
 * sütünü eklemek istiyorum."* Sütun kalemin GENEL GİDER DAHİL maliyetini
 * gösterir (`LOADED_COST_LABEL`, md. 9):
 * doğrudan maliyet + proje geneli ve oranlı grupların payı. Yalnız doğrudan
 * maliyeti göstermek, sabit giderleri hiç taşımayan sahte bir kâr üretirdi.
 *
 * Maliyet ayrı bir tabloda yaşadığı için ekstra bir okuma gerekir; teklif
 * editörü zaten tek bir revizyon açtığından bu tek bir sorgudur. Maliyet
 * çalışması yoksa `null` döner ve sütun "—" gösterir — sıfır DEĞİL: maliyeti
 * girilmemiş bir kalem bedava değildir.
 */
export interface OfferCostForEditor {
  costRevId: string;
  costRevNo: number;
  status: string;
  sourceRevNo: number | null;
  /** Teklif kalemi kimliği → genel gider dahil maliyet. */
  byItem: Record<string, number>;
  /**
   * SERBEST FİYAT SATIRI kimliği → maliyet özetinden girilen maliyet.
   *
   * Kullanıcı isteği (23.08.2026, md. 1): *"Eğer özet sayfasından girersem
   * öncelik o olsun. Fiyat kısmına da oradan gelsin."* Sözlükte OLMAYAN satır
   * eskisi gibi kendi `manualCost` kutusunu okur — iki kaynak TOPLANMAZ.
   */
  byManualLine: Record<string, number>;
  direct: number | null;
  total: number | null;
}

export async function loadOfferCostForEditor(
  supabase: SupabaseClient,
  offerId: string,
  currency = "EUR"
): Promise<OfferCostForEditor | null> {
  const kayit = await loadLatestOfferCost(supabase, offerId, currency);
  if (!kayit) return null;
  const totals = costTotals(kayit.payload, costWeights(costModels(kayit.payload)));
  return {
    costRevId: kayit.summary.id,
    costRevNo: kayit.summary.revNo,
    status: kayit.summary.status,
    sourceRevNo: kayit.summary.sourceRevNo,
    byItem: loadedCostByOfferItem(totals),
    byManualLine: manualCostByPriceLine(kayit.payload),
    direct: totals.direct,
    total: totals.total,
  };
}
