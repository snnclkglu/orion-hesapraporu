// Satın Alma — sunucu tarafı okumalar.
//
// EKRAN İLE BELGE AYNI YERDEN OKUR. Satış Takibi'nde öğrenilen ders (md. 16):
// iki sorgu yazılırsa müşteriye giden liste ile ekrandaki tablo sessizce
// ayrışır. Bu dosya havuzun, takvimlerin ve fiyat arşivinin ortak okuma
// katmanıdır.
//
// SORGU DAR TUTULUR. Bütün paketlerin BÜTÜN parçalarını okumak (iki gerçek
// pakette 261 + 672 satır) elli pakette otuz bin satır eder ve sayfayı
// dizlerinin üstüne çökertirdi. Havuza yalnız SATIN ALMA satırları girer ve
// süzgeç veritabanı tarafındadır: `kind = 'satinalma'` VEYA parça numarası boş
// — `isPurchaseRow`un SQL karşılığı. İki tanımın ayrışmaması bir testle
// korunur (`__tests__/purchasing-split.test.ts`).

import type { SupabaseClient } from "@supabase/supabase-js";
import { tumSatirlar } from "../drawings/data";
import {
  anaGrupAdaylari,
  anaGrupKodu,
  genelKompleMu,
  normalizeTanim,
  GENEL_KOMPLE_ADI,
} from "@/lib/drawings/normalize";
import { progressKeyOf } from "@/lib/drawings/progress";
import {
  drawingCarpani,
  talepHavuzu,
  type HavuzPaketi,
  type HavuzSatiri,
  type KalemAdedi,
  type TalepHavuzu,
} from "@/lib/purchasing/demand";
import type { PartKind } from "@/lib/drawings/types";

// ————————————————————————————————————————————————————————————— paketler

interface PaketSatiri {
  id: string;
  folder_name: string;
  item_no: string;
  job_id: string | null;
  job_item_id: string | null;
  group_code: string;
  description: string;
  status: string;
  jobs: {
    job_no: string;
    title: string;
    customer: string;
    customers: { short_name: string } | null;
  } | null;
}

const PAKET_ALANLARI =
  "id, folder_name, item_no, job_id, job_item_id, group_code, description, status, " +
  "jobs (job_no, title, customer, customers (short_name))";

/**
 * SÜPERSE PAKET HAVUZA GİRMEZ.
 *
 * Bir grubun R02'si yüklendiğinde R01 `superse` olur; ikisini birden saymak
 * her kalemi iki kez sipariş ettirirdi. Bu, havuzun paket listesinden en
 * önemli farkıdır — orada eski sürüm bilerek görünür (arşivdir), burada
 * bir hatadır.
 */
const CANLI_DURUMLAR = ["aktif", "yuklendi"];

export interface PaketKunye {
  id: string;
  label: string;
  itemNo: string;
  jobNo: string;
  jobTitle: string;
  customer: string;
}

// ————————————————————————————————————————————————————————— parça satırı

interface ParcaSatiri {
  package_id: string;
  part_code: string;
  register_key: string;
  kind: PartKind;
  name: string;
  description: string;
  assembly_title: string;
  material: string;
  qty: number | null;
  weight_kg: number | null;
}

const PARCA_ALANLARI =
  "package_id, part_code, register_key, kind, name, description, assembly_title, " +
  "material, qty, weight_kg";

// —————————————————————————————————————————————————————————————— sonuç

export interface HavuzVerisi {
  havuz: TalepHavuzu;
  paketler: PaketKunye[];
  /** Kalem numarası → çarpan açıklaması; ekran uyarıyı buradan yazar. */
  carpanlar: Map<string, { carpan: number; belirsiz: boolean; katilanlar: string[] }>;
  /** Kategori düzeltme defteri okunabildi mi (migration uygulandı mı)? */
  kategoriDefteriVar: boolean;
  /** Ana grup adı defteri; boşsa kodlar adsız görünür. */
  grupAdlari: Map<string, string>;
}

/**
 * Talep havuzunu kurar.
 *
 * `jobIds` verilirse yalnız o işlerin paketleri girer — satınalmacı çoğu zaman
 * "şu üç projeyi bir arada sipariş edeceğim" diye çalışır ve havuzu daraltmak
 * ekranın değil KULLANICININ kararıdır.
 */
export async function loadHavuz(
  supabase: SupabaseClient,
  secenekler: { jobIds?: readonly string[] } = {}
): Promise<HavuzVerisi> {
  // ————————————————————————————————— 1. canlı paketler
  let paketSorgu = supabase.from("drawing_packages").select(PAKET_ALANLARI);
  if (secenekler.jobIds && secenekler.jobIds.length > 0) {
    paketSorgu = paketSorgu.in("job_id", secenekler.jobIds as string[]);
  }
  const { data: paketVerisi } = await paketSorgu.in("status", CANLI_DURUMLAR).order("item_no");
  const paketSatirlari = (paketVerisi ?? []) as unknown as PaketSatiri[];

  // ————————————————————————————————— 2. iş kalemi adetleri (çarpan)
  //
  // İKİ DENEMEDE OKUNUR: `qty` ve `shares_drawings_with` sütunları 20260812
  // migration'ıyla geliyor. Uygulanmadan önce onları isteyen bir `select`
  // BÜTÜN sorguyu düşürür ve havuz hiç görünmezdi (satın alma sayfasındaki
  // `due_at` kalıbının aynısı). Sütunlar yoksa çarpan 1'dir ve ekran bunu
  // "adet belirsiz" olarak yazar — sessizce doğru varsaymaz.
  let kalemVerisi: unknown[] | null = null;
  let carpanSutunlariVar = true;
  {
    const zengin = await supabase
      .from("job_items")
      .select("id, item_no, qty, shares_drawings_with");
    if (zengin.error) {
      carpanSutunlariVar = false;
      const dar = await supabase.from("job_items").select("id, item_no");
      kalemVerisi = dar.data;
    } else {
      kalemVerisi = zengin.data;
    }
  }
  const kalemler: KalemAdedi[] = ((kalemVerisi ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    itemNo: String(r.item_no ?? ""),
    qty: carpanSutunlariVar && r.qty != null ? Number(r.qty) : null,
    sharesWith: carpanSutunlariVar ? ((r.shares_drawings_with as string | null) ?? null) : null,
  }));

  // ————————————————————————————————— 3. ana grup adı defteri
  const { data: grupVerisi } = await supabase
    .from("drawing_group_names")
    .select("group_code, name");
  const grupAdlari = new Map(
    ((grupVerisi ?? []) as { group_code: string; name: string }[]).map((g) => [
      g.group_code,
      g.name,
    ])
  );
  const bilinenGruplar = new Set(grupAdlari.keys());

  // ————————————————————————————————— 4. kalem defteri (kategori + not)
  //
  // `purchase_item_meta` anahtarı NORMALLEŞTİRİLMİŞ tanımdır; eski
  // `drawing_purchase_overrides` ham tanımla anahtarlıyordu ve iki şema bir
  // arada yaşayamazdı (bkz. 20260812000003 migration notu).
  const { data: defterVerisi } = await supabase
    .from("purchase_item_meta")
    .select("match_key, category, note");
  const defter = (defterVerisi ?? []) as {
    match_key: string;
    category: string | null;
    note: string | null;
  }[];
  const duzeltmeler = new Map(
    defter.filter((r) => r.category).map((r) => [r.match_key, r.category as string])
  );
  const notlar = new Map(defter.filter((r) => r.note).map((r) => [r.match_key, r.note as string]));

  // ————————————————————————————————— 5. paket künyeleri + çarpanlar
  const carpanlar = new Map<string, { carpan: number; belirsiz: boolean; katilanlar: string[] }>();
  const havuzPaketleri: HavuzPaketi[] = [];
  const paketKunyeleri: PaketKunye[] = [];

  for (const p of paketSatirlari) {
    const c = drawingCarpani(p.job_item_id, p.item_no, kalemler);
    // Çarpan sütunları hiç yoksa çarpan bir VARSAYIMdır ve öyle işaretlenir.
    const belirsiz = c.belirsiz || !carpanSutunlariVar;
    carpanlar.set(p.id, { ...c, belirsiz });

    const label =
      [p.group_code, p.description].filter(Boolean).join(" · ") || p.folder_name || p.item_no;
    const kunye: PaketKunye = {
      id: p.id,
      label,
      itemNo: p.item_no,
      jobNo: p.jobs?.job_no ?? "",
      jobTitle: p.jobs?.title ?? "",
      customer: p.jobs?.customers?.short_name || p.jobs?.customer || "",
    };
    paketKunyeleri.push(kunye);
    havuzPaketleri.push({
      packageId: p.id,
      label,
      itemNo: p.item_no,
      jobNo: kunye.jobNo,
      jobTitle: kunye.jobTitle,
      customer: kunye.customer,
      carpan: c.carpan,
      carpanBelirsiz: belirsiz,
    });
  }

  // ————————————————————————————————— 6. satın alma satırları
  const paketIdleri = paketSatirlari.map((p) => p.id);
  const satirlar: HavuzSatiri[] = [];
  if (paketIdleri.length > 0) {
    const ham = await tumSatirlar<ParcaSatiri>((bas, son) =>
      supabase
        .from("drawing_parts")
        .select(PARCA_ALANLARI)
        .in("package_id", paketIdleri)
        // `isPurchaseRow`un SQL karşılığı — satın alma yapısı VEYA kodsuz satır.
        .or("kind.eq.satinalma,part_code.eq.")
        // SIRALAMASIZ SAYFALAMA BİR HATADIR. `range()` ile sayfalanan bir sorgu
        // `order by` taşımıyorsa Postgres satır sırasını GARANTİ ETMEZ: aynı
        // satır iki sayfada birden gelebilir, bir başkası hiç gelmeyebilir.
        // Bugün üç canlı pakette toplam ~222 satır var ve tek sayfaya sığıyor,
        // yani hata GİZLİ — havuz elli pakete çıktığında sessizce kalem
        // kaybetmeye başlardı. `id` benzersizdir, yani sıra TAM belirlidir.
        .order("id")
        .range(bas, son)
    );

    for (const r of ham) {
      const tanim = (r.description || r.name || "").trim();
      // GENEL KOMPLE DEFTERE BAĞLI DEĞİLDİR. `anaGrupKodu` bilinen kodlar
      // arasından seçer ve defterde karşılığı yoksa BOŞ döner; `-0000` ise
      // firmanın numaralandırma sözleşmesiyle kendi başına tanınır, yani bu
      // kural yazılmadan önce eşleştirilmiş paketler de yeniden eşleştirme
      // beklemeden grubunu gösterir.
      const groupCode =
        anaGrupKodu(r.part_code ?? "", bilinenGruplar) ||
        anaGrupAdaylari(r.part_code ?? "").find(genelKompleMu) ||
        "";
      /**
       * ANA GRUP ADI İKİ KAYNAKTAN GELİR — ve ikincisi asıl kaynaktır.
       *
       * Satın alma satırlarının ÇOĞUNUN PARÇA KODU YOKTUR (ölçüldü: MONORAY
       * 50/55, MTC 86/90 kodsuz) — cıvatanın, segmanın, rulmanın kodu olmaz.
       * Koddan grup türetmek bu yüzden onların hiçbirinde çalışmaz ve ilk
       * denemede havuzun 186 kaleminin 186'sı adsız çıktı.
       *
       * Kodsuz satırın grubu MONTAJ BAŞLIĞIdır (`assembly_title`) — defterin
       * o satır için yazdığı üst montaj. Ad defteri (`drawing_group_names`)
       * yine önceliklidir: orada varsa insanın düzelttiği ya da ürün
       * ağacından çıkarılmış OTORİTER ad kullanılır.
       */
      const defterAdi = groupCode ? grupAdlari.get(groupCode) : undefined;
      // Üçüncü basamak FİRMA SÖZLEŞMESİDİR (`-0000` → GENEL KOMPLE) ve defter
      // burada da devreye girer: eski paketler bu kural yazılmadan önce
      // eşleştirildi, yeniden eşleştirilmedikçe `drawing_group_names`te
      // karşılıkları yok. Kural burada da okununca o paketler ekranda adsız
      // kalmaz — yeniden eşleştirme beklemeden.
      const groupName =
        defterAdi ??
        (r.assembly_title
          ? normalizeTanim(r.assembly_title).tanim
          : genelKompleMu(groupCode)
            ? GENEL_KOMPLE_ADI
            : "");
      satirlar.push({
        packageId: r.package_id,
        // Anahtar `progressKeyOf` ile ÜRETİLİR, elle kurulmaz: paket
        // ekranındaki işaretlerle bağ ancak aynı fonksiyon çağrılırsa tutar.
        partKey: progressKeyOf({
          partCode: r.part_code ?? "",
          description: r.description ?? "",
          name: r.name ?? "",
          kind: r.kind,
        }),
        partCode: r.part_code ?? "",
        tanim,
        material: r.material ?? "",
        qty: r.qty,
        weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
        groupCode,
        groupName,
      });
    }
  }

  return {
    havuz: talepHavuzu(havuzPaketleri, satirlar, { duzeltmeler, notlar }),
    paketler: paketKunyeleri,
    carpanlar,
    kategoriDefteriVar: defterVerisi != null,
    grupAdlari,
  };
}

// ═══════════════════════════════════════════════════════ TEKLİF ve SİPARİŞ

export interface TeklifSatiri {
  id: string;
  matchKey: string;
  sample: string;
  supplier: string;
  unitPrice: number;
  currency: string;
  fxRate: number | null;
  unitPriceEur: number | null;
  qty: number | null;
  unit: string;
  quotedAt: string;
  validUntil: string | null;
  chosen: boolean;
  note: string;
  itemNo: string;
}

const TEKLIF_ALANLARI =
  "id, match_key, sample, supplier, unit_price, currency, fx_rate, unit_price_eur, " +
  "qty, unit, quoted_at, valid_until, chosen, note, item_no";

function teklifEsle(r: Record<string, unknown>): TeklifSatiri {
  return {
    id: String(r.id),
    matchKey: String(r.match_key ?? ""),
    sample: String(r.sample ?? ""),
    supplier: String(r.supplier ?? ""),
    unitPrice: Number(r.unit_price ?? 0),
    currency: String(r.currency ?? "EUR"),
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    unitPriceEur: r.unit_price_eur == null ? null : Number(r.unit_price_eur),
    qty: r.qty == null ? null : Number(r.qty),
    unit: String(r.unit ?? "Adet"),
    quotedAt: String(r.quoted_at ?? ""),
    validUntil: (r.valid_until as string | null) ?? null,
    chosen: r.chosen === true,
    note: String(r.note ?? ""),
    itemNo: String(r.item_no ?? ""),
  };
}

/** Verilen anahtarların teklifleri; anahtar listesi boşsa TÜMÜ (fiyat arşivi). */
export async function loadTeklifler(
  supabase: SupabaseClient,
  keys?: readonly string[]
): Promise<TeklifSatiri[]> {
  const veri = await tumSatirlar<Record<string, unknown>>((bas, son) => {
    let q = supabase.from("purchase_quotes").select(TEKLIF_ALANLARI);
    if (keys && keys.length > 0) q = q.in("match_key", keys as string[]);
    // `id` bir EŞİTLİK BOZUCUDUR: aynı gün girilmiş iki teklifin sırası
    // `quoted_at` ile belirlenmez ve sayfalanan sorguda bu satır kaybettirir.
    return q.order("quoted_at", { ascending: false }).order("id").range(bas, son);
  });
  return veri.map(teklifEsle);
}

export interface SiparisSatiri {
  id: string;
  matchKey: string;
  sample: string;
  itemNo: string;
  packageId: string | null;
  partKey: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  receivedQty: number;
  note: string;
}

export interface Siparis {
  id: string;
  orderNo: string;
  supplier: string;
  orderedAt: string;
  dueAt: string | null;
  receivedAt: string | null;
  paymentMethod: string;
  paymentTermDays: number;
  advancePct: number | null;
  advanceAmount: number | null;
  advancePaidAt: string | null;
  balancePaidAt: string | null;
  currency: string;
  fxRate: number | null;
  note: string;
  cancelledAt: string | null;
  satirlar: SiparisSatiri[];
}

const SIPARIS_ALANLARI =
  "id, order_no, supplier, ordered_at, due_at, received_at, payment_method, " +
  "payment_term_days, advance_pct, advance_amount, advance_paid_at, balance_paid_at, " +
  "currency, fx_rate, note, cancelled_at";

const SIPARIS_SATIR_ALANLARI =
  "id, order_id, match_key, sample, item_no, package_id, part_key, qty, unit, " +
  "unit_price, received_qty, note";

/**
 * Siparişleri satırlarıyla birlikte okur.
 *
 * İki sorgu, TEK gömülü sorgu değil: PostgREST'in gömülü listesi `max_rows`
 * sınırına takılabilir ve o kırpma SESSİZDİR — bir siparişin satırlarının
 * yarısı kaybolsa ekran bunu fark etmezdi (`tumSatirlar`ın var oluş sebebi).
 */
export async function loadSiparisler(
  supabase: SupabaseClient,
  secenekler: { iptalDahil?: boolean } = {}
): Promise<Siparis[]> {
  const basliklar = await tumSatirlar<Record<string, unknown>>((bas, son) => {
    let q = supabase.from("purchase_orders").select(SIPARIS_ALANLARI);
    if (!secenekler.iptalDahil) q = q.is("cancelled_at", null);
    return q.order("ordered_at", { ascending: false }).order("id").range(bas, son);
  });
  if (basliklar.length === 0) return [];

  const idler = basliklar.map((b) => String(b.id));
  const satirlar = await tumSatirlar<Record<string, unknown>>((bas, son) =>
    supabase
      .from("purchase_order_lines")
      .select(SIPARIS_SATIR_ALANLARI)
      .in("order_id", idler)
      .order("sample")
      .order("id")
      .range(bas, son)
  );

  const satirHaritasi = new Map<string, SiparisSatiri[]>();
  for (const s of satirlar) {
    const oid = String(s.order_id);
    const liste = satirHaritasi.get(oid) ?? [];
    liste.push({
      id: String(s.id),
      matchKey: String(s.match_key ?? ""),
      sample: String(s.sample ?? ""),
      itemNo: String(s.item_no ?? ""),
      packageId: (s.package_id as string | null) ?? null,
      partKey: String(s.part_key ?? ""),
      qty: Number(s.qty ?? 0),
      unit: String(s.unit ?? "Adet"),
      unitPrice: s.unit_price == null ? null : Number(s.unit_price),
      receivedQty: Number(s.received_qty ?? 0),
      note: String(s.note ?? ""),
    });
    satirHaritasi.set(oid, liste);
  }

  return basliklar.map((b) => ({
    id: String(b.id),
    orderNo: String(b.order_no ?? ""),
    supplier: String(b.supplier ?? ""),
    orderedAt: String(b.ordered_at ?? ""),
    dueAt: (b.due_at as string | null) ?? null,
    receivedAt: (b.received_at as string | null) ?? null,
    paymentMethod: String(b.payment_method ?? "pesin"),
    paymentTermDays: Number(b.payment_term_days ?? 0),
    advancePct: b.advance_pct == null ? null : Number(b.advance_pct),
    advanceAmount: b.advance_amount == null ? null : Number(b.advance_amount),
    advancePaidAt: (b.advance_paid_at as string | null) ?? null,
    balancePaidAt: (b.balance_paid_at as string | null) ?? null,
    currency: String(b.currency ?? "EUR"),
    fxRate: b.fx_rate == null ? null : Number(b.fx_rate),
    note: String(b.note ?? ""),
    cancelledAt: (b.cancelled_at as string | null) ?? null,
    satirlar: satirHaritasi.get(String(b.id)) ?? [],
  }));
}

/**
 * Tedarikçi ad önerileri — teklif ve sipariş defterlerinin BİRLEŞİMİ.
 *
 * Ayrı bir tedarikçi tablosu açılmadı (bkz. migration notu): ad `adBuyuk` ile
 * normalleştirilir ve arayüz var olanları önerir. Öneri listesi olmadan aynı
 * firma üç yazımla girilir ve fiyat karşılaştırması bölünürdü.
 */
export async function loadTedarikciler(supabase: SupabaseClient): Promise<string[]> {
  const [teklif, siparis] = await Promise.all([
    supabase.from("purchase_quotes").select("supplier"),
    supabase.from("purchase_orders").select("supplier"),
  ]);
  const adlar = new Set<string>();
  for (const r of (teklif.data ?? []) as { supplier: string }[]) if (r.supplier) adlar.add(r.supplier);
  for (const r of (siparis.data ?? []) as { supplier: string }[]) if (r.supplier) adlar.add(r.supplier);
  return [...adlar].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Bir tanımın normalleştirilmiş anahtarı — action ve ekran aynı yolu kullanır. */
export function anahtarla(tanim: string): { key: string; tanim: string } {
  const n = normalizeTanim(tanim);
  return { key: n.key, tanim: n.tanim };
}
