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
  tanimOlculeri,
} from "@/lib/drawings/normalize";
import { progressKeyOf } from "@/lib/drawings/progress";
import { trKatla } from "@/lib/drawings/tr-text";
import {
  drawingCarpani,
  talepHavuzu,
  type HavuzPaketi,
  type HavuzSatiri,
  type KalemAdedi,
  type TalepHavuzu,
  type TalepSatiri,
} from "@/lib/purchasing/demand";
import type { PartKind } from "@/lib/drawings/types";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { vatRateOf } from "@/lib/purchasing/vat";

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
  // ZENGİN + DAR (SATIN-21): label_override / qty_override 20260814000006 ile
  // geliyor; uygulanmamışsa dar sorguya düşülür ve override boş kalır.
  const zenginMeta = await supabase
    .from("purchase_item_meta")
    .select("match_key, category, note, label_override, qty_override");
  const defterVerisi = zenginMeta.error
    ? (await supabase.from("purchase_item_meta").select("match_key, category, note")).data
    : zenginMeta.data;
  const defter = (defterVerisi ?? []) as {
    match_key: string;
    category: string | null;
    note: string | null;
    label_override?: string | null;
    qty_override?: number | null;
  }[];
  const duzeltmeler = new Map(
    defter.filter((r) => r.category).map((r) => [r.match_key, r.category as string])
  );
  const notlar = new Map(defter.filter((r) => r.note).map((r) => [r.match_key, r.note as string]));
  // OTOMATİK SATIR DÜZELTMESİ (md. 1): görünen tanım ve adet override edilir;
  // match_key sabittir, teklif/sipariş bağı bozulmaz.
  const etiketDuzeltme = new Map(
    defter
      .filter((r) => r.label_override && r.label_override.trim())
      .map((r) => [r.match_key, (r.label_override as string).trim()])
  );
  const adetDuzeltme = new Map(
    defter
      .filter((r) => r.qty_override != null)
      .map((r) => [r.match_key, Number(r.qty_override)])
  );

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
  //
  // HAMMADDEDEN TAŞINMIŞ SATIRLAR DA BURAYA GİRER (kullanıcı kararı,
  // 15.08.2026: *"Diğer kısmında kaplin rulman gibi ekipmanları benim Ekipman
  // tarafına taşıyabilmem lazım."*). Kaplin, rulman ve kanca gibi kalemler
  // Excel'de PARÇA KODU taşıyor ve `isPurchaseRow` onları üretim tarafına
  // yolluyor; oysa satın alınıyorlar.
  //
  // KÜME BOŞKEN HİÇBİR EK SORGU KOŞMAZ: `purchase_raw_equipment_keys` normalde
  // boştur ve bu okuma o zaman atlanır — ekipman ekranının maliyeti değişmez.
  const tasinanAnahtarlar = await loadEquipmentMovedKeys(supabase);

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

    if (tasinanAnahtarlar.size > 0) {
      const imalat = await tumSatirlar<ParcaSatiri>((bas, son) =>
        supabase
          .from("drawing_parts")
          .select(PARCA_ALANLARI)
          .in("package_id", paketIdleri)
          .in("kind", ["imalat", "bilinmiyor"])
          .neq("part_code", "")
          .order("id")
          .range(bas, son)
      );
      for (const r of imalat) {
        const t = (r.description || r.name || "").trim();
        if (t && tasinanAnahtarlar.has(trKatla(t.replace(/\s+/g, " ")))) ham.push(r);
      }
    }

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

  const havuz = talepHavuzu(havuzPaketleri, satirlar, { duzeltmeler, notlar });

  // ————————————————————————————————— 7. otomatik satır düzeltmeleri (md. 1)
  if (etiketDuzeltme.size > 0 || adetDuzeltme.size > 0) {
    for (const row of havuz.satirlar) {
      const yeniTanim = etiketDuzeltme.get(row.key);
      if (yeniTanim) {
        row.tanim = yeniTanim;
        row.olculer = tanimOlculeri(yeniTanim);
      }
      const yeniAdet = adetDuzeltme.get(row.key);
      if (yeniAdet != null) row.adet = yeniAdet;
    }
  }

  // ————————————————————————————————— 8. manuel talepler (SATIN-21)
  const manuel = await loadManualDemands(supabase);
  if (manuel.length > 0) havuz.satirlar.push(...manuel);

  // Override ve manuel satırlar toplamı/kategori dağılımını değiştirir; özet
  // yeniden hesaplanır (çekirdek saf kalsın diye burada, DB katmanında).
  havuzOzetiniTazele(havuz);

  return {
    havuz,
    paketler: paketKunyeleri,
    carpanlar,
    kategoriDefteriVar: defterVerisi != null,
    grupAdlari,
  };
}

/** Manuel talepleri okuyup havuz satırına çevirir (SATIN-21). */
async function loadManualDemands(supabase: SupabaseClient): Promise<TalepSatiri[]> {
  const { data, error } = await supabase
    .from("purchase_manual_demands")
    .select("id, match_key, sample, category, item_no, quantity, unit, weight_kg, quality, note")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as {
    id: string;
    match_key: string;
    sample: string;
    category: string;
    item_no: string;
    quantity: number | null;
    unit: string;
    weight_kg: number | null;
    quality: string;
    note: string;
  }[]).map((r) => {
    const tanim = (r.sample || "").trim();
    const key = r.match_key || `manual:${r.id}`;
    const adet = r.quantity == null ? null : Number(r.quantity);
    const agirlik = r.weight_kg == null ? null : Number(r.weight_kg);
    const kalite = (r.quality || "").trim();
    return {
      key,
      tanim,
      parcaKodlari: [],
      birim: r.unit || "Adet",
      olculer: tanimOlculeri(tanim),
      not: r.note || "",
      hamTanimlar: [tanim],
      sinif: r.category || "Diğer",
      malzeme: kalite,
      malzemeler: kalite ? [kalite] : [],
      anaGruplar: [],
      adet,
      birimAgirlikKg: null,
      toplamAgirlikKg: agirlik,
      paylar: [
        {
          packageId: "",
          packageLabel: "Manuel talep",
          itemNo: r.item_no || "",
          jobNo: "",
          jobTitle: "",
          customer: "",
          birimAdet: adet,
          carpan: 1,
          carpanBelirsiz: false,
          adet,
          partKey: "",
          groupName: "",
        },
      ],
      isSayisi: r.item_no ? 1 : 0,
      carpanBelirsiz: false,
      manualId: r.id,
    } satisfies TalepSatiri;
  });
}

/** Override/manuel satır sonrası havuz özetini yeniden türetir. */
function havuzOzetiniTazele(havuz: TalepHavuzu): void {
  const liste = havuz.satirlar;
  havuz.siniflar = [...new Set(liste.map((k) => k.sinif))]
    .map((sinif) => {
      const grup = liste.filter((k) => k.sinif === sinif);
      return {
        sinif,
        satirSayisi: grup.length,
        adet: grup.reduce((t, k) => t + (k.adet ?? 0), 0),
      };
    })
    .sort((a, b) => b.satirSayisi - a.satirSayisi);
  havuz.toplamKalem = liste.length;
  havuz.toplamAdet = liste.reduce((t, k) => t + (k.adet ?? 0), 0);
  havuz.kaynakSatiri = liste.reduce((t, k) => t + k.paylar.length, 0);
  havuz.cokIsliKalem = liste.filter((k) => k.isSayisi > 1).length;
  havuz.belirsizKalem = liste.filter((k) => k.carpanBelirsiz).length;
  havuz.paketSayisi = new Set(
    liste.flatMap((k) => k.paylar.map((p) => p.packageId).filter(Boolean))
  ).size;
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
  /** Ödeme biçimi ve vadesi — karşılaştırma başlığında `(90 Gün)` olur. */
  paymentMethod: string;
  paymentTermDays: number;
  /** Teslim süresi GÜN; 0 = Hazır, null = söylenmedi. */
  leadTimeDays: number | null;
  /**
   * TEKLİF PARTİSİ — hangi "Teklif Aç" işleminden geldi (md. 24, 15.08.2026).
   *
   * `null` yalnız migration uygulanmamışken olur; devralınan satırlara da
   * (tedarikçi, tarih) ikilisinden parti verildi.
   */
  batchId: string | null;
  /** Partinin benzersiz kodu (`TK0007`); parti yoksa boş. */
  batchCode: string;
  /** `acik` · `iptal` — iptal edilmiş parti karşılaştırmaya girmez. */
  batchStatus: string;
}

/** Bir firmanın BİR teklifi — altında kalem kalem fiyatlar. */
export interface TeklifPartisi {
  id: string;
  code: string;
  supplier: string;
  quotedAt: string;
  scope: string;
  note: string;
  status: string;
  cancelledAt: string | null;
  cancelReason: string;
  /** Hangi TALEBİN cevabı (migration 20260815000007); yoksa kendi başınadır. */
  requestId: string | null;
  satirlar: TeklifSatiri[];
}

/**
 * TALEP — sorulan soru. Firmaların cevapları `TeklifPartisi` satırlarıdır.
 *
 * Kullanıcı kararı (15.08.2026): *"Birkaç firmadan aynı teklifi aldığımda
 * burada görebileyim."* Ekrandaki liste satırı artık budur.
 */
export interface TeklifTalebi {
  id: string;
  code: string;
  title: string;
  scope: string;
  status: string;
  note: string;
}

/** `loadTeklifler` süzgeci — sorgu kurucusu tipe sarılamadığı için nesne. */
type TeklifSuzgeci =
  | { tur: "anahtar"; degerler: string[] }
  | { tur: "parti"; degerler: string[] }
  | { tur: "hepsi" };

const TEKLIF_ALANLARI =
  "id, match_key, sample, supplier, unit_price, currency, fx_rate, unit_price_eur, " +
  "qty, unit, quoted_at, valid_until, chosen, note, item_no";

/**
 * ZENGİN SORGU (SATIN-21'in "sütun olmayabilir" kuralı).
 *
 * `payment_*` ve `lead_time_days` 20260815000003 ile geliyor; migration
 * uygulanmadan önce onları isteyen bir `select` BÜTÜN teklif listesini
 * düşürür ve havuzun teklif sütunu boşalırdı.
 */
const TEKLIF_ALANLARI_ZENGIN =
  TEKLIF_ALANLARI +
  ", payment_method, payment_term_days, lead_time_days" +
  // PARTİ KÜNYESİ GÖMÜLÜ OKUNUR (20260815000004): ayrı bir sorgu, iptal
  // edilmiş partinin satırlarını süzmek için ikinci bir gidiş-dönüş ederdi.
  ", batch_id, purchase_quote_batches (code, status)";

function teklifEsle(r: Record<string, unknown>): TeklifSatiri {
  const parti = (r.purchase_quote_batches ?? null) as { code?: string; status?: string } | null;
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
    paymentMethod: String(r.payment_method ?? "pesin"),
    paymentTermDays: r.payment_term_days == null ? 0 : Number(r.payment_term_days),
    leadTimeDays: r.lead_time_days == null ? null : Number(r.lead_time_days),
    batchId: (r.batch_id as string | null) ?? null,
    batchCode: String(parti?.code ?? ""),
    batchStatus: String(parti?.status ?? "acik"),
  };
}

/**
 * Verilen anahtarların teklifleri; anahtar listesi boşsa TÜMÜ (fiyat arşivi).
 *
 * **İPTAL EDİLMİŞ PARTİNİN SATIRLARI DÜŞÜLÜR** ve bu varsayılan bilinçlidir:
 * iptal edilmiş bir teklif havuzun "en iyi fiyat" sütununda, karşılaştırmada
 * ya da fiyat arşivinde görünmemelidir — silinmediği için defterde durur ama
 * yarışa girmez. Teklif ekranının kendisi `iptalDahil` ile hepsini ister:
 * orada iptalin kendisi bir bilgidir ve geri alınabilir.
 */
export async function loadTeklifler(
  supabase: SupabaseClient,
  keys?: readonly string[],
  secenekler: { iptalDahil?: boolean; batchIds?: readonly string[] } = {}
): Promise<TeklifSatiri[]> {
  // Sorgu kurucusu bir TİPE SARILMAZ (`tumSatirlar`ın uyarısı): supabase-js'in
  // derin jenerikleri "excessively deep" verir. Süzgeç bu yüzden bir NESNE
  // olarak taşınır ve kurucunun içinde uygulanır.
  const oku = (alanlar: string, filtre: TeklifSuzgeci) =>
    tumSatirlar<Record<string, unknown>>((bas, son) => {
      let q = supabase.from("purchase_quotes").select(alanlar);
      if (filtre.tur === "anahtar") q = q.in("match_key", filtre.degerler);
      else if (filtre.tur === "parti") q = q.in("batch_id", filtre.degerler);
      // `id` bir EŞİTLİK BOZUCUDUR: aynı gün girilmiş iki teklifin sırası
      // `quoted_at` ile belirlenmez ve sayfalanan sorguda bu satır kaybettirir.
      return q.order("quoted_at", { ascending: false }).order("id").range(bas, son);
    });

  /**
   * İKİ SORGU, TEK `or(...)` DEĞİL.
   *
   * Anahtar ve parti kimliği aynı sorguda `or` ile birleştirilebilirdi ama
   * PostgREST'in `or` dizgisinde değerler METİN olarak gömülüdür ve
   * `match_key` içinde virgül, parantez ve tırnak geçebilir — kaçırılmış tek
   * bir karakter, sessizce YANLIŞ satır kümesi döndürür. İki ayrı sorgu +
   * kimlikle tekilleştirme bu riski hiç doğurmaz.
   */
  const suzgecler: TeklifSuzgeci[] = [];
  if (keys && keys.length > 0) suzgecler.push({ tur: "anahtar", degerler: [...keys] });
  if (secenekler.batchIds && secenekler.batchIds.length > 0) {
    suzgecler.push({ tur: "parti", degerler: [...secenekler.batchIds] });
  }
  // Hiç süzgeç yoksa TÜMÜ okunur (fiyat arşivinin kullanımı).
  if (suzgecler.length === 0) suzgecler.push({ tur: "hepsi" });

  // ZENGİN + DAR: yeni sütunlar yoksa teklifler yine gelir, vade ve teslim
  // varsayılana düşer (SATIN-21). `batch_id` süzgeci DAR sürümde YOKTUR —
  // sütunu olmayan bir şemada parti de yoktur, o sorgu sessizce atlanır.
  const benzersiz = new Map<string, TeklifSatiri>();
  for (const filtre of suzgecler) {
    let veri: Record<string, unknown>[];
    try {
      veri = await oku(TEKLIF_ALANLARI_ZENGIN, filtre);
    } catch {
      if (filtre.tur === "parti") continue;
      veri = await oku(TEKLIF_ALANLARI, filtre);
    }
    for (const r of veri) {
      const t = teklifEsle(r);
      benzersiz.set(t.id, t);
    }
  }

  const hepsi = [...benzersiz.values()].sort(
    (a, b) => b.quotedAt.localeCompare(a.quotedAt) || a.id.localeCompare(b.id)
  );
  return secenekler.iptalDahil ? hepsi : hepsi.filter((t) => t.batchStatus !== "iptal");
}

const PARTI_ALANLARI =
  "id, code, supplier, quoted_at, scope, note, status, cancelled_at, cancel_reason";

/** `request_id` 20260815000007 ile geliyor — ZENGİN + DAR (SATIN-21). */
const PARTI_ALANLARI_ZENGIN = `${PARTI_ALANLARI}, request_id`;

const TALEP_ALANLARI = "id, code, title, scope, status, note";

/**
 * TEKLİF PARTİLERİ — teklifler sayfasının omurgası.
 *
 * Satırlar AYRI okunur ve burada gruplanır: gömülü bir `purchase_quotes (...)`
 * seçimi sayfalamayı parti başına yapardı ve otuz kalemlik bir teklifte
 * satırların bir kısmı sessizce düşerdi (`tumSatirlar`ın var oluş sebebi).
 *
 * PARTİSİ OLMAYAN SATIR DA KAYBOLMAZ: migration uygulanmamışsa ya da bir
 * parti silinmişse satırlar (tedarikçi, tarih) ikilisinde toplanır ve kodsuz
 * bir parti olarak görünür — kodsuz bir teklif, görünmeyen bir teklifden
 * iyidir.
 *
 * ═══════════════════════════ KAPSAM, ANAHTAR LİSTESİNİN YERİNE GEÇMEZ — EKLENİR
 *
 * Kullanıcı bildirimi (15.08.2026): *"Fiyat girdiğimde de teklif karşılaştırma
 * bölümüne düşmüyor. Ancak tekliflere kaydedildi diye uyarı geliyor."* Ölçüldü
 * ve doğruydu: kayıt yapılıyor, sayfa okumuyordu. Sebebi tek bir süzgeçti —
 * teklifler YALNIZ havuz anahtarlarıyla isteniyordu ve **plaka teklifinin
 * anahtarı havuzda YOKTUR** (`SAC 12 X 1500 X 3000 S235JR` bir ÜRÜN,
 * havuzdaki `SAC 12 MM S235JR` bir İHTİYAÇtır — HAM-24 bunu açıkça söylüyor
 * ve sayfa da bu duruma hazırlıklıydı; eksik olan bir kat aşağıdaydı).
 *
 * Artık iki küme BİRLEŞTİRİLİR: (a) anahtarı havuzda geçen satırlar,
 * (b) kapsamı bu ekran olan PARTİLERİN bütün satırları. Kapsamı tek başına
 * kullanmak da yanlış olurdu — devralınan kodsuz satırların partisi yoktur.
 */
export async function loadTeklifDefteri(
  supabase: SupabaseClient,
  keys?: readonly string[],
  secenekler: { scope?: string } = {}
): Promise<{ partiler: TeklifPartisi[]; talepler: TeklifTalebi[] }> {
  // ————————————————————————————————— 1. parti künyeleri
  const partiOku = async (alanlar: string) =>
    supabase
      .from("purchase_quote_batches")
      .select(alanlar)
      .order("quoted_at", { ascending: false })
      .order("code");

  let partiVerisi: Record<string, unknown>[] = [];
  let talepSutunuVar = true;
  {
    const zengin = await partiOku(PARTI_ALANLARI_ZENGIN);
    if (zengin.error) {
      talepSutunuVar = false;
      const dar = await partiOku(PARTI_ALANLARI);
      partiVerisi = dar.error ? [] : ((dar.data ?? []) as unknown as Record<string, unknown>[]);
    } else {
      partiVerisi = (zengin.data ?? []) as unknown as Record<string, unknown>[];
    }
  }

  const partiler = new Map<string, TeklifPartisi>();
  for (const r of partiVerisi) {
    partiler.set(String(r.id), {
      id: String(r.id),
      code: String(r.code ?? ""),
      supplier: String(r.supplier ?? ""),
      quotedAt: String(r.quoted_at ?? ""),
      scope: String(r.scope ?? "hammadde"),
      note: String(r.note ?? ""),
      status: String(r.status ?? "acik"),
      cancelledAt: (r.cancelled_at as string | null) ?? null,
      cancelReason: String(r.cancel_reason ?? ""),
      requestId: (r.request_id as string | null) ?? null,
      satirlar: [],
    });
  }

  // ————————————————————————————————— 2. satırlar (anahtar ∪ kapsam)
  const kapsamPartileri = secenekler.scope
    ? [...partiler.values()].filter((p) => p.scope === secenekler.scope).map((p) => p.id)
    : [];

  // İKİ SÜZGEÇ DE BOŞSA SORGU HİÇ KOŞMAZ. `loadTeklifler` süzgeçsiz
  // çağrıldığında TÜMÜNÜ okur (fiyat arşivinin kullanımı) — kapsam isteyen bir
  // çağrıya bütün defteri döndürmek, havuzu boş bir kurulumda hammadde
  // ekranını ekipman teklifleriyle doldururdu.
  if (secenekler.scope && (keys?.length ?? 0) === 0 && kapsamPartileri.length === 0) {
    return { partiler: [], talepler: [] };
  }

  const satirlar = await loadTeklifler(supabase, keys, {
    iptalDahil: true,
    batchIds: kapsamPartileri,
  });

  /** Kodsuz satırlar için sanal parti — kaybolmasınlar. */
  const sanal = new Map<string, TeklifPartisi>();
  for (const t of satirlar) {
    const p = t.batchId ? partiler.get(t.batchId) : undefined;
    if (p) {
      p.satirlar.push(t);
      continue;
    }
    // Kapsam süzgeci varken kodsuz satırlar da dışarıda kalmaz: onların
    // kapsamı bilinmiyor ve bilinmeyeni gizlemek kullanıcıyı yanıltır.
    const anahtar = `${t.supplier}|${t.quotedAt}`;
    let s = sanal.get(anahtar);
    if (!s) {
      s = {
        id: `kodsuz:${anahtar}`,
        code: "",
        supplier: t.supplier,
        quotedAt: t.quotedAt,
        scope: "",
        note: "",
        status: "acik",
        cancelledAt: null,
        cancelReason: "",
        requestId: null,
        satirlar: [],
      };
      sanal.set(anahtar, s);
    }
    s.satirlar.push(t);
  }

  // BOŞ PARTİ LİSTEDE DURMAZ: satırları silinmiş bir teklif bir teklif
  // değildir; künyesi defterde kalır ama ekranda gürültü eder.
  //
  // KAPSAM DIŞI PARTİ DE DURMAZ: bir ekipman teklifinin satırı yalnız
  // anahtarı hammadde havuzunda geçtiği için okunmuş olabilir; o parti bu
  // ekranın sorusunun cevabı değildir. (Kapsamı BİLİNMEYEN devralınan parti
  // istisnadır: onu ancak anahtarı konuşturur ve anahtar onu buraya getirdiyse
  // yeri burasıdır.)
  const kapsamUygun = (p: TeklifPartisi) =>
    !secenekler.scope ||
    p.scope === secenekler.scope ||
    p.scope === "" ||
    p.satirlar.some((t) => keys?.includes(t.matchKey));

  const liste = [...partiler.values(), ...sanal.values()]
    .filter((p) => p.satirlar.length > 0 && kapsamUygun(p))
    .sort((a, b) => b.quotedAt.localeCompare(a.quotedAt) || a.code.localeCompare(b.code, "tr"));

  // ————————————————————————————————— 3. talepler
  const talepIdler = [...new Set(liste.map((p) => p.requestId).filter(Boolean))] as string[];
  let talepler: TeklifTalebi[] = [];
  if (talepSutunuVar && talepIdler.length > 0) {
    const { data, error } = await supabase
      .from("purchase_quote_requests")
      .select(TALEP_ALANLARI)
      .in("id", talepIdler);
    if (!error) {
      talepler = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        code: String(r.code ?? ""),
        title: String(r.title ?? ""),
        scope: String(r.scope ?? "hammadde"),
        status: String(r.status ?? "acik"),
        note: String(r.note ?? ""),
      }));
    }
  }

  return { partiler: liste, talepler };
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
  /** KDV HARİÇ birim fiyat — fiyat arşivi ve bütün panolar bunu okur. */
  unitPrice: number | null;
  /** Satır KDV oranı (%); yalnız ödenecek tutarı büyütür. */
  vatRate: number;
  /** Satırın MARKA/KALİTE snapshotu (SATIS-16). */
  quality: string;
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
  "unit_price, vat_rate, quality, received_qty, note";

/**
 * `vat_rate`/`quality` OLMAYABİLİR (SATIN-21'in ZENGİN + DAR kalıbı).
 *
 * Sütunlar 20260814000004/000005 ile geliyor; uygulanmamış bir ortamda onları
 * isteyen bir `select` BÜTÜN siparişleri düşürürdü. Eksik oran `vatRateOf` ile
 * varsayılana, eksik marka/kalite boş metne düşer.
 */
const SIPARIS_SATIR_ALANLARI_DAR = SIPARIS_SATIR_ALANLARI.replace(", vat_rate", "").replace(
  ", quality",
  ""
);

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
  // Sütun yoklaması SAYFALAMADAN ÖNCE yapılır: `tumSatirlar` içinde denemek,
  // ilk sayfa düştüğünde geri kalanı da düşürürdü.
  const yoklama = await supabase.from("purchase_order_lines").select("vat_rate, quality").limit(1);
  const alanlar = yoklama.error ? SIPARIS_SATIR_ALANLARI_DAR : SIPARIS_SATIR_ALANLARI;
  const satirlar = await tumSatirlar<Record<string, unknown>>((bas, son) =>
    supabase
      .from("purchase_order_lines")
      .select(alanlar)
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
      vatRate: vatRateOf(s.vat_rate),
      quality: String(s.quality ?? ""),
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

/**
 * MARKA/KALİTE öneri listesi — aktif kayıtların adları (SATIS-16).
 *
 * SÜTUN/TABLO OLMAYABİLİR (SATIN-21): 20260814000005 uygulanmamışsa sorgu düşer
 * ve boş liste döner — sipariş/sarf ekranı yine açılır, yalnız öneri boş kalır.
 */
export async function loadQualities(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("purchase_qualities")
    .select("name")
    .eq("active", true)
    .order("name");
  if (error) return [];
  return [...new Set(((data ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean))];
}

/** Defterdeki bir firma — ad + kimlik kodu (`TD0007`). */
export interface TedarikciKaydi {
  id: string;
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
 * SÜTUN OLMAYABİLİR VARSAYIMI (SATIN-21): `code` 20260813010004 ile geliyor.
 * Uygulanmamış bir ortamda zengin sorgu düşer, dar sorgu adları getirir ve
 * sipariş numarası önerisi sessizce devre dışı kalır — sayfa AÇILIR.
 */
export async function loadTedarikciDefteri(supabase: SupabaseClient): Promise<TedarikciKaydi[]> {
  const zengin = await supabase.from("purchase_suppliers").select("id, name, code, active").order("name");
  if (!zengin.error) {
    return ((zengin.data ?? []) as { id: string; name: string; code: string | null; active: boolean }[]).map(
      (r) => ({ id: r.id, name: r.name ?? "", code: r.code ?? "", active: r.active !== false })
    );
  }

  const dar = await supabase.from("purchase_suppliers").select("id, name, active").order("name");
  if (dar.error) return [];
  return ((dar.data ?? []) as { id: string; name: string; active: boolean }[]).map((r) => ({
    id: r.id,
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
  isNumaralari?: readonly string[];
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
    if (sorgu.isNumaralari?.length) {
      q = q.overlaps("isler", sorgu.isNumaralari as string[]);
    }
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
 * Süzgeç seçenekleri — iş numarası, kategori ve tedarikçi listesi.
 *
 * Kategori ve tedarikçi KAYNAK TABLODAN, iş numarası ise yalnız arşivde
 * karşılığı bulunan bağlamları tekilleştiren dar görünümden okunur. Ana dizinin
 * kalem başına dizilerini açmak (unnest) her sayfa isteğinde bütün görünümü
 * yeniden hesaplatırdı; ayrı seçenek görünümü bu işi veritabanında tutar.
 */
export async function loadArsivSecenekleri(
  supabase: SupabaseClient
): Promise<{
  isNumaralari: string[];
  kategoriler: string[];
  tedarikciler: string[];
  toplam: number;
}> {
  const [isler, kat, ted, sayim] = await Promise.all([
    // Ayrı seçenek görünümü yalnız arşivde gerçekten karşılığı olan iş
    // numaralarını döndürür. `jobs` defterinin tamamını göstermek, hiç fiyatı
    // olmayan işleri seçilebilir kılıp boş sonuç üretirdi.
    supabase.from("purchase_price_job_options").select("is_no"),
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
  const isNumaralari = [
    ...new Set(((isler.data ?? []) as { is_no: string }[]).map((r) => r.is_no).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a, "tr", { numeric: true }));
  return { isNumaralari, kategoriler, tedarikciler, toplam: sayim.count ?? 0 };
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

/**
 * HAMMADDEDEN EKİPMANA TAŞINMIŞ PARÇA TANIMLARI.
 *
 * Defter yoksa (migration uygulanmamış) BOŞ küme döner ve ekipman havuzu
 * bugünkü gibi çalışır — "sütun olmayabilir" kuralı (SATIN-21).
 */
export async function loadEquipmentMovedKeys(
  supabase: SupabaseClient
): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase
    .from("purchase_raw_equipment_keys")
    .select("part_key");
  if (error) return new Set();
  return new Set(((data ?? []) as { part_key: string }[]).map((r) => r.part_key));
}
