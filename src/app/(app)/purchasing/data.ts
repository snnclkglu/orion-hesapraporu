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
  genelKompleAdi,
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
import type { GunlukKur } from "@/lib/purchasing/kur";

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
  /**
   * SATIRIN AĞAÇTAKİ ÜSTÜ — kodsuz satırın grubu BURADAN okunur.
   *
   * Satın alma satırlarının çoğunun kendi kodu yoktur (cıvatanın, rulmanın
   * resmi olmaz) ve DEPO Excel'i onların montaj başlığını da yazmaz — canlı
   * veride ölçüldü: MTC'nin 96 satırının yalnız 3'ünde `assembly_title` dolu.
   * ÜRÜN AĞACI ise satırın yerini `Item` sütununda taşır ve `reconcile` onu
   * `parent_code`a çözer (89/96). Grup adı zinciri bu yüzden `part_code` ile
   * bitmez, `parent_code` ile devam eder.
   */
  parent_code: string;
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
  "package_id, part_code, parent_code, register_key, kind, name, description, " +
  "assembly_title, material, qty, weight_kg";

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
    // `product_name` dar yedekte de istenir: o sütun eski ve `qty` ile birlikte
    // düşmesi için bir sebep yok. Genel komplenin adı ondan kuruluyor.
    const zengin = await supabase
      .from("job_items")
      .select("id, item_no, product_name, qty, shares_drawings_with");
    if (zengin.error) {
      carpanSutunlariVar = false;
      const dar = await supabase.from("job_items").select("id, item_no, product_name");
      kalemVerisi = dar.data;
    } else {
      kalemVerisi = zengin.data;
    }
  }
  /** Kalem kimliği → ürün adı; `xxxx-xx-0000` grubunun adı bundan kurulur. */
  const urunAdlari = new Map(
    ((kalemVerisi ?? []) as Record<string, unknown>[]).map((r) => [
      String(r.id),
      String(r.product_name ?? ""),
    ])
  );
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
  /**
   * Paket kimliği → ürün adı.
   *
   * İş kalemine bağlı değilse KLASÖRÜN açıklamasına düşülür ("MTC PASLANMAZ"):
   * genel komplenin hangi ürüne ait olduğu orada da yazıyor ve boş bırakmak
   * satınalmacıya hiçbir şey söylemezdi.
   */
  const paketUrunAdlari = new Map<string, string>();

  for (const p of paketSatirlari) {
    paketUrunAdlari.set(
      p.id,
      (p.job_item_id ? urunAdlari.get(p.job_item_id) : "") || p.description || ""
    );
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
      //
      // ZİNCİR İKİ KODA BAKAR: önce satırın KENDİ kodu, sonra AĞAÇTAKİ ÜSTÜ.
      // İkincisi olmadan kodsuz satırların hiçbiri grup gösteremiyordu —
      // kullanıcı bildirimi 13.08.2026: *"Satın alma bunların hangi grup
      // içerisinde olduğunu görmek istiyor."*
      //
      // KODUN KENDİSİ BİR GRUP OLABİLİR. `anaGrupAdaylari` üç bloktan KISA
      // adaylar üretmez, yani `0043-00-0850` gibi grubun kendisi olan bir kod
      // eski zincirde BOŞ dönüyordu; `parent_code` çoğu zaman tam olarak öyle
      // bir koddur ve kontrol en başa konur.
      const grupCoz = (kod: string): string => {
        const k = (kod ?? "").trim();
        if (!k) return "";
        if (bilinenGruplar.has(k)) return k;
        if (genelKompleMu(k)) return k;
        return (
          anaGrupKodu(k, bilinenGruplar) || anaGrupAdaylari(k).find(genelKompleMu) || ""
        );
      };
      const groupCode = grupCoz(r.part_code ?? "") || grupCoz(r.parent_code ?? "");
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
            ? // ÜRÜN ADIYLA yazılır: çok projeli bir listede yan yana duran üç
              // "GENEL KOMPLE" satırı hangisinin hangi vince ait olduğunu
              // söylemez (kullanıcı kararı, 13.08.2026).
              genelKompleAdi(paketUrunAdlari.get(r.package_id))
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
  // ————————————————————————————— 1. DEFTER (birincil kaynak)
  //
  // `purchase_suppliers` 13.08.2026'da açıldı (migration 20260813010001) ve
  // devralınan 285 firma oraya yazıldı. Defter öneri listesinin ASIL kaynağıdır:
  // öncesinde liste yalnız DAHA ÖNCE TEKLİF GİRİLMİŞ firmaları biliyordu, yani
  // ilk kez çalışılan her firma her seferinde elle yazılıyordu.
  //
  // PASİF FİRMA ÖNERİLMEZ. Devralınan listede banka, otel ve kargo da var;
  // kullanıcı onları pasife çeker ve öneri listesinden düşerler — kayıt durur.
  const defter = await supabase
    .from("purchase_suppliers")
    .select("name")
    .eq("active", true);

  const adlar = new Set<string>();
  if (!defter.error) {
    for (const r of (defter.data ?? []) as { name: string }[]) if (r.name) adlar.add(r.name);
  }

  // ————————————————————————————— 2. DEFTERLERDEN GELENLER (yedek + tamamlayıcı)
  //
  // Tablo henüz uygulanmamış olabilir (`defter.error`) ya da geçmişte elle
  // yazılmış bir ad deftere hiç girmemiş olabilir. İki kaynağın BİRLEŞİMİ
  // alınır: bir adın öneri listesinden düşmesi, o adla girilmiş kaydı
  // görünmez yapmaz ama kullanıcıyı aynı firmayı yeniden yazmaya iter.
  const [teklif, siparis] = await Promise.all([
    supabase.from("purchase_quotes").select("supplier"),
    supabase.from("purchase_orders").select("supplier"),
  ]);
  for (const r of (teklif.data ?? []) as { supplier: string }[]) if (r.supplier) adlar.add(r.supplier);
  for (const r of (siparis.data ?? []) as { supplier: string }[]) if (r.supplier) adlar.add(r.supplier);
  return [...adlar].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Defterdeki bir firma — ad + kimlik kodu (`TD0007`). */
export interface TedarikciKaydi {
  name: string;
  code: string;
  active: boolean;
}

/**
 * TEDARİKÇİ DEFTERİ — kodlarıyla birlikte.
 *
 * `loadTedarikciler`den AYRI durur ve ikisi farklı soruları cevaplar: o,
 * öneri listesidir (teklif ve sipariş defterlerinden gelen adları da kapsar);
 * bu, KİMLİK defteridir ve sipariş numarası önerisinin kaynağıdır.
 *
 * PASİF FİRMA DA OKUNUR: öneri listesinden düşmüş bir firmanın kodu, o firmaya
 * daha önce verilmiş siparişin numarasını okumak için hâlâ gerekli.
 *
 * SÜTUN OLMAYABİLİR VARSAYIMI (md. 21): `code` 20260813010004 ile geliyor.
 * Uygulanmamış bir ortamda zengin sorgu düşer, dar sorgu adları getirir ve
 * sipariş numarası önerisi sessizce devre dışı kalır — sayfa AÇILIR.
 */
export async function loadTedarikciDefteri(supabase: SupabaseClient): Promise<TedarikciKaydi[]> {
  const zengin = await supabase.from("purchase_suppliers").select("name, code, active").order("name");
  if (!zengin.error) {
    return ((zengin.data ?? []) as { name: string; code: string | null; active: boolean }[]).map(
      (r) => ({ name: r.name ?? "", code: r.code ?? "", active: r.active !== false })
    );
  }

  const dar = await supabase.from("purchase_suppliers").select("name, active").order("name");
  if (dar.error) return [];
  return ((dar.data ?? []) as { name: string; active: boolean }[]).map((r) => ({
    name: r.name ?? "",
    code: "",
    active: r.active !== false,
  }));
}

/**
 * Kullanılmış BÜTÜN sipariş numaraları — iptal edilenler DÂHİL.
 *
 * Öneri ve çakışma denetimi aynı listeyi okur. İptal edilmiş bir siparişin
 * numarası yeniden kullanılamaz: kayıt duruyor, tedarikçi o numarayı biliyor ve
 * aynı numaralı ikinci bir sipariş "hangisi iptal olan?" sorusunu doğururdu.
 */
export async function loadSiparisNolari(supabase: SupabaseClient): Promise<string[]> {
  const veri = await tumSatirlar<{ order_no: string | null }>((bas, son) =>
    supabase.from("purchase_orders").select("order_no").order("id").range(bas, son)
  );
  return veri.map((r) => (r.order_no ?? "").trim()).filter(Boolean);
}

// ═══════════════════════════════════════════ FİYAT ARŞİVİ — SUNUCU SÜZGECİ

/** Arşiv listesinin bir satırı — `purchase_price_index` görünümünden. */
export interface ArsivSatiri {
  matchKey: string;
  sample: string;
  sonHareket: string;
  sonAlisGun: string;
  sonAlisFirma: string;
  sonAlisEur: number | null;
  sonAlisBirim: number | null;
  sonAlisPara: string;
  enDusuk: number | null;
  enYuksek: number | null;
  teklifSayisi: number;
  siparisSayisi: number;
  gecmisSayisi: number;
  firmalar: string[];
  kategoriler: string[];
}

export interface ArsivSorgusu {
  q?: string;
  kategoriler?: readonly string[];
  tedarikciler?: readonly string[];
  kaynaklar?: readonly string[];
  sayfa?: number;
  sayfaBoyu?: number;
}

export interface ArsivSonucu {
  satirlar: ArsivSatiri[];
  /** SÜZGEÇTEN GEÇEN toplam — sayfa sayısı bundan çıkar. */
  toplam: number;
  sayfa: number;
  sayfaBoyu: number;
}

/** Aramanın SQL karşılığı — ekrandaki `trKatla` ile aynı katlama. */
function aramaKatla(q: string): string {
  return q
    .normalize("NFC")
    .trim()
    .replace(/[iıİIçÇğĞöÖşŞüÜ]/g, (h) =>
      ({ i: "I", ı: "I", İ: "I", I: "I", ç: "C", Ç: "C", ğ: "G", Ğ: "G", ö: "O", Ö: "O", ş: "S", Ş: "S", ü: "U", Ü: "U" })[h] ?? h
    )
    .toUpperCase();
}

/**
 * Arşivin BİR SAYFASI — süzgeç veritabanında.
 *
 * Kullanıcı bildirimi (13.08.2026, ikinci tur): sayfa hâlâ yavaştı. Ölçüldü:
 * görünümün kendisi 54 ms, asıl maliyet 1675 satırın (360 KB) her ziyarette
 * taşınıp istemcide süzülmesiydi — ekranda 100 satır var.
 *
 * SÜZGEÇ TÜM ARŞİVDE ÇALIŞIR ve bu kullanıcının şartıydı ("arama ve filtreyi
 * tüm sayfalar için yapsın"). Sunucuya taşınınca şart gevşemedi, tersine
 * gerçek anlamını kazandı: artık istemciye HİÇ GELMEMİŞ satırlarda da arıyor.
 */
export async function loadFiyatDizini(
  supabase: SupabaseClient,
  sorgu: ArsivSorgusu = {}
): Promise<ArsivSonucu> {
  const sayfaBoyu = Math.min(Math.max(sorgu.sayfaBoyu ?? 100, 10), 200);
  const sayfa = Math.max(1, sorgu.sayfa ?? 1);

  try {
    let q = supabase
      .from("purchase_price_index")
      .select(
        "match_key, sample, son_hareket, son_alis_gun, son_alis_firma, son_alis_eur, " +
          "son_alis_birim, son_alis_para, en_dusuk, en_yuksek, teklif_sayisi, " +
          "siparis_sayisi, gecmis_sayisi, firmalar, kategoriler, turler",
        { count: "exact" }
      );

    const ara = aramaKatla(sorgu.q ?? "");
    // `%` ve `_` KAÇIRILIR: kullanıcının yazdığı bir alt çizgi joker olmamalı.
    if (ara) q = q.like("ara", `%${ara.replace(/[%_]/g, "\$&")}%`);
    if (sorgu.kategoriler?.length) q = q.overlaps("kategoriler", sorgu.kategoriler as string[]);
    if (sorgu.tedarikciler?.length) q = q.overlaps("firmalar", sorgu.tedarikciler as string[]);
    if (sorgu.kaynaklar?.length) q = q.overlaps("turler", sorgu.kaynaklar as string[]);

    // SIRA: EN SON HAREKET, YENİDEN ESKİYE (kullanıcı kararı). Beraberliği
    // anahtar bozar ki sayfalar arasında satır atlanmasın/yinelenmesin.
    const bas = (sayfa - 1) * sayfaBoyu;
    const { data, count, error } = await q
      .order("son_hareket", { ascending: false, nullsFirst: false })
      .order("match_key")
      .range(bas, bas + sayfaBoyu - 1);
    if (error) throw error;

    return {
      satirlar: ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        matchKey: String(r.match_key ?? ""),
        sample: String(r.sample ?? ""),
        sonHareket: String(r.son_hareket ?? "").slice(0, 10),
        sonAlisGun: String(r.son_alis_gun ?? "").slice(0, 10),
        sonAlisFirma: String(r.son_alis_firma ?? ""),
        sonAlisEur: r.son_alis_eur == null ? null : Number(r.son_alis_eur),
        sonAlisBirim: r.son_alis_birim == null ? null : Number(r.son_alis_birim),
        sonAlisPara: String(r.son_alis_para ?? "TRY"),
        enDusuk: r.en_dusuk == null ? null : Number(r.en_dusuk),
        enYuksek: r.en_yuksek == null ? null : Number(r.en_yuksek),
        teklifSayisi: Number(r.teklif_sayisi ?? 0),
        siparisSayisi: Number(r.siparis_sayisi ?? 0),
        gecmisSayisi: Number(r.gecmis_sayisi ?? 0),
        firmalar: (r.firmalar as string[] | null) ?? [],
        kategoriler: (r.kategoriler as string[] | null) ?? [],
      })),
      toplam: count ?? 0,
      sayfa,
      sayfaBoyu,
    };
  } catch {
    return { satirlar: [], toplam: 0, sayfa, sayfaBoyu };
  }
}

/**
 * Süzgeç seçenekleri — kategori ve tedarikçi listesi.
 *
 * Dizinden değil KAYNAK TABLODAN okunur: dizin kalem başına tekilleştirilmiş
 * diziler taşıyor ve onları açmak (unnest) her sayfa isteğinde bütün görünümü
 * yeniden hesaplatırdı. Buradaki iki sorgu küçüktür ve süzgeç açılmadan da
 * gerekir.
 */
export async function loadArsivSecenekleri(
  supabase: SupabaseClient
): Promise<{ kategoriler: string[]; tedarikciler: string[]; toplam: number }> {
  const [kat, ted, sayim] = await Promise.all([
    supabase.from("purchase_price_history").select("category").neq("category", ""),
    supabase.from("purchase_suppliers").select("name").eq("active", true),
    // SÜZGEÇSİZ TOPLAM — şeritteki "şu kadar / bu kadar" sayacı için. Sunucu
    // sayfalamasında `satirlar.length` sayfa BOYUdur (100) ve onu toplam diye
    // göstermek, 114 sonuç bulan bir aramada "100 / 1679" yazardı.
    supabase.from("purchase_price_index").select("match_key", { count: "exact", head: true }),
  ]);
  const kategoriler = [
    ...new Set(((kat.data ?? []) as { category: string }[]).map((r) => r.category)),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  const tedarikciler = [
    ...new Set(((ted.data ?? []) as { name: string }[]).map((r) => r.name)),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  return { kategoriler, tedarikciler, toplam: sayim.count ?? 0 };
}

/**
 * Bir kalemin BÜTÜN fiyat olayları — YALNIZ satır açıldığında.
 *
 * Liste artık kalem başına özet gösteriyor (`purchase_price_index`); ayrıntı
 * 1675 kalemin yalnız açılanı için istenir. Üç kaynak da burada birleşir ve
 * TÜRÜ satırda durur — hangi fiyatın denetlenebilir bir sipariş, hangisinin
 * dışarıdan gelmiş bir fatura olduğu okunabilmeli.
 */
export interface ArsivOlayi {
  id: string;
  tur: "teklif" | "siparis" | "gecmis";
  supplier: string;
  gun: string;
  birim: number;
  currency: string;
  birimEur: number | null;
  adet: number | null;
  itemNo: string;
  kategori: string;
  secildi: boolean;
  iptal: boolean;
  /** Yalnız devralınan satır silinebilir (yönetici); diğerlerinin kendi yolu var. */
  silinebilir: boolean;
}

export async function loadArsivOlaylari(
  supabase: SupabaseClient,
  matchKey: string
): Promise<ArsivOlayi[]> {
  if (!matchKey) return [];
  const [teklif, satir, gecmis] = await Promise.all([
    supabase
      .from("purchase_quotes")
      .select("id, supplier, unit_price, currency, unit_price_eur, qty, quoted_at, chosen, item_no")
      .eq("match_key", matchKey)
      .limit(200),
    supabase
      .from("purchase_order_lines")
      .select(
        "id, sample, qty, unit_price, item_no, purchase_orders (supplier, ordered_at, currency, fx_rate, cancelled_at)"
      )
      .eq("match_key", matchKey)
      .limit(200),
    supabase
      .from("purchase_price_history")
      .select("id, supplier, priced_at, qty, unit_price, currency, unit_price_eur, item_no, category")
      .eq("match_key", matchKey)
      .order("priced_at", { ascending: false })
      .limit(500),
  ]);

  const olaylar: ArsivOlayi[] = [];

  for (const r of (teklif.data ?? []) as Record<string, unknown>[]) {
    olaylar.push({
      id: `t-${r.id}`,
      tur: "teklif",
      supplier: String(r.supplier ?? ""),
      gun: String(r.quoted_at ?? "").slice(0, 10),
      birim: Number(r.unit_price ?? 0),
      currency: String(r.currency ?? "EUR"),
      birimEur: r.unit_price_eur == null ? null : Number(r.unit_price_eur),
      adet: r.qty == null ? null : Number(r.qty),
      itemNo: String(r.item_no ?? ""),
      kategori: "",
      secildi: r.chosen === true,
      iptal: false,
      silinebilir: false,
    });
  }

  for (const r of (satir.data ?? []) as Record<string, unknown>[]) {
    const o = r.purchase_orders as
      | { supplier: string; ordered_at: string; currency: string; fx_rate: number | null; cancelled_at: string | null }
      | null;
    if (r.unit_price == null) continue;
    const birim = Number(r.unit_price);
    const kur = o?.fx_rate == null ? null : Number(o.fx_rate);
    olaylar.push({
      id: `s-${r.id}`,
      tur: "siparis",
      supplier: o?.supplier ?? "",
      gun: String(o?.ordered_at ?? "").slice(0, 10),
      birim,
      currency: o?.currency ?? "EUR",
      birimEur: kur && kur > 0 ? birim / kur : null,
      adet: r.qty == null ? null : Number(r.qty),
      itemNo: String(r.item_no ?? ""),
      kategori: "",
      secildi: false,
      iptal: Boolean(o?.cancelled_at),
      silinebilir: false,
    });
  }

  for (const r of (gecmis.data ?? []) as Record<string, unknown>[]) {
    olaylar.push({
      id: String(r.id),
      tur: "gecmis",
      supplier: String(r.supplier ?? ""),
      gun: String(r.priced_at ?? "").slice(0, 10),
      birim: Number(r.unit_price ?? 0),
      currency: String(r.currency ?? "TRY"),
      birimEur: r.unit_price_eur == null ? null : Number(r.unit_price_eur),
      adet: r.qty == null ? null : Number(r.qty),
      itemNo: String(r.item_no ?? ""),
      kategori: String(r.category ?? ""),
      secildi: false,
      iptal: false,
      silinebilir: true,
    });
  }

  // Yeniden eskiye: son fiyat üstte, referans odur.
  return olaylar.sort((a, b) => b.gun.localeCompare(a.gun));
}

/**
 * EN SON YAYIMLANMIŞ GÜNLÜK KUR — teklif/sipariş pencerelerinin referansı.
 *
 * "En yakın tarih" kullanıcının sözü (13.08.2026) ve tam olarak doğru olan da
 * budur: TCMB hafta sonu ve resmî tatilde yayın yapmaz, yani "bugünün kuru"
 * diye bir şey her gün yoktur. `order by rate_date desc limit 1` en son GERÇEK
 * yayını verir ve ekran gününü yazar.
 *
 * SESSİZCE BAŞARISIZ OLUR: kur tablosu hiç doldurulmamışsa (`null`) pencere
 * kutuyu boş bırakır ve kullanıcı elle yazar.
 */
export async function loadSonKur(supabase: SupabaseClient): Promise<GunlukKur | null> {
  const { data, error } = await supabase
    .from("fx_rate_daily")
    .select("rate_date, usd_try, eur_try")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as { rate_date: string; usd_try: number | null; eur_try: number | null };
  if (r.eur_try == null) return null;
  return {
    rateDate: String(r.rate_date).slice(0, 10),
    usdTry: Number(r.usd_try ?? 0),
    eurTry: Number(r.eur_try),
  };
}

/** Bir tanımın normalleştirilmiş anahtarı — action ve ekran aynı yolu kullanır. */
export function anahtarla(tanim: string): { key: string; tanim: string } {
  const n = normalizeTanim(tanim);
  return { key: n.key, tanim: n.tanim };
}
