// TALEP HAVUZU — çok projeli satın alma listesinin saf çekirdeği.
//
// ═══════════════════════════════════════════════════════ NEDEN AYRI KATMAN
//
// `drawings/derive.ts`teki `satinAlmaListesi` BİR PAKETİN listesini üretir ve
// doğru olan da odur: teknik resim paketi bir teslimdir, o teslimin defteri
// kendi içinde tutarlıdır. Ama satınalmacı öyle çalışmıyor (kullanıcı kararı,
// md. 7):
//
//   "Satın Alma ekibi projeleri tek tek ele almıyor. Birden fazla projenin
//    siparişini bir arada biriktirip verebilir."
//
// Havuz bu yüzden PAKETİN ÜSTÜNDE bir katmandır ve üç şeyi paket listesinden
// FARKLI yapar:
//
// 1. ANAHTAR NORMALLEŞTİRİLMİŞ TANIMDIR (`normAnahtar`), paket içi
//    `progressKeyOf` değil. İki proje aynı somunu iki ayrı yazımla yazmış
//    olabilir; havuzda tek satır olmaları gerekir, yoksa satınalmacı aynı
//    somun için iki sipariş açar.
//
// 2. ADETLER İŞ KALEMİ ADEDİYLE ÇARPILIR (md. 6). Ressam BİR ürün için çizer;
//    iş emrinde üç adet varsa üç katı satın alınır. Bu çarpma bugüne kadar
//    hiçbir yerde yapılmıyordu ve satınalmacı kafadan çarpıyordu.
//
// 3. KAYNAK İZİ İŞ DÜZEYİNDEDİR. Paket listesinde iz "hangi montajın cıvatası"
//    sorusuna cevap verir; havuzda soru "bu 240 cıvatanın kaçı hangi işe
//    gidiyor"dur — çünkü sipariş bölünüp iki müşteriye fatura edilebilir.
//
// ÇEKİRDEK SAFTIR: DB/HTTP importu yok, `drawings/` çekirdeğiyle aynı kural.

import { satinAlmaSinifi } from "@/lib/drawings/derive";
import { normalizeTanim } from "@/lib/drawings/normalize";

// ————————————————————————————————————————————————————————— girdi tipleri

/** Bir paketin havuza giren künyesi — hangi işe, kaç adede bağlı? */
export interface HavuzPaketi {
  packageId: string;
  /** Paketin insan okunur adı: grup kodu + açıklama, yoksa klasör adı. */
  label: string;
  /** İş kalemi numarası (metin) — bağ TÜREVDİR (md. 17/18 kuralı). */
  itemNo: string;
  jobNo: string;
  jobTitle: string;
  /** Müşteri kısaltması; listede renkli etiket olur. */
  customer: string;
  /**
   * İŞ KALEMİ ADEDİ ÇARPANI.
   *
   * Kalemin kendi adedi + resimlerini bu kalemle paylaşan kalemlerin adetleri
   * (md. 6: "iki kalem arasında çok az fark var ama üretimde tek resim
   * çiziliyor"). Hesabı `drawingCarpani` yapar.
   */
  carpan: number;
  /**
   * Çarpan BİLİNMİYOR mu?
   *
   * `job_items.qty` boşsa 1 KABUL EDİLİR ama bu bir varsayımdır ve ekran onu
   * açıkça söyler. Sessiz 1, yanlış bir sipariş adedidir; söylenmiş 1 bir
   * sorudur.
   */
  carpanBelirsiz: boolean;
}

/** Havuza giren tek bir defter satırı (paket içi satın alma satırı). */
export interface HavuzSatiri {
  packageId: string;
  /** Paket içi ilerleme anahtarı — işaretlerle bağ buradan kurulur. */
  partKey: string;
  partCode: string;
  /** Ham tanım, depo Excel'inden geldiği gibi. */
  tanim: string;
  material: string;
  /** Resimdeki adet — BİR ürün içindir, çarpan ayrıca uygulanır. */
  qty: number | null;
  weightKg: number | null;
  /** Parçanın ana grubu (kod) ve varsa adı. */
  groupCode: string;
  groupName: string;
}

// ————————————————————————————————————————————————————————— çıktı tipleri

/** Bir talep kaleminin BİR işe düşen payı. */
export interface TalepPayi {
  packageId: string;
  packageLabel: string;
  itemNo: string;
  jobNo: string;
  jobTitle: string;
  customer: string;
  /** Resimdeki adet (bir ürün için). */
  birimAdet: number | null;
  carpan: number;
  carpanBelirsiz: boolean;
  /** birimAdet × carpan — bu işe düşen gerçek ihtiyaç. */
  adet: number | null;
  /** Paket içi anahtar; teslim/sipariş işaretleri bununla bulunur. */
  partKey: string;
  groupName: string;
}

export interface TalepSatiri {
  /** `normAnahtar(tanim)` — teklif, sipariş ve fiyat arşivi bu anahtarı taşır. */
  key: string;
  /** Standart tanım — BÜYÜK HARF, kalıba dizilmiş. */
  tanim: string;
  /**
   * Havuza giren FARKLI ham yazımlar.
   *
   * Gizlenmez: satınalmacı "bu kalem nereden geldi" diye sorduğunda ressamın
   * yazdığı hâli görebilmelidir. Bir kalemde birden çok ham yazım varsa
   * normalleştirme gerçekten iş yapmış demektir.
   */
  hamTanimlar: string[];
  sinif: string;
  malzeme: string;
  /** Birden çok malzeme geçiyorsa çelişki vardır ve gizlenmez (`derive.ts`). */
  malzemeler: string[];
  /** Kalemin geçtiği ana grup adları — "hangi grubun cıvatası" sorusu. */
  anaGruplar: string[];
  /** Bütün payların toplamı; hiçbir payda adet yoksa `null`. */
  adet: number | null;
  /** Bütün kaynak satırlar aynı birim ağırlığı söylüyorsa o sayı, yoksa `null`. */
  birimAgirlikKg: number | null;
  toplamAgirlikKg: number | null;
  paylar: TalepPayi[];
  /** Kaç FARKLI iş kalemi bu kalemi istiyor? */
  isSayisi: number;
  /** Paylardan en az biri belirsiz çarpan taşıyorsa toplam da şüphelidir. */
  carpanBelirsiz: boolean;
}

export interface TalepHavuzu {
  satirlar: TalepSatiri[];
  /** Kategori dağılımı — künye ve süzgeç. */
  siniflar: { sinif: string; satirSayisi: number; adet: number }[];
  toplamKalem: number;
  toplamAdet: number;
  /** Kaç defter satırından toplandı (birleşmeden önce). */
  kaynakSatiri: number;
  /** Birden çok işe hizmet eden kalem sayısı — havuzun asıl kazancı. */
  cokIsliKalem: number;
  /** Çarpanı belirsiz kalem sayısı; ekran bunu uyarı olarak basar. */
  belirsizKalem: number;
  /** Havuza giren paket sayısı. */
  paketSayisi: number;
}

// ————————————————————————————————————————————————————— çarpan hesabı

/** `drawingCarpani` girdisi — iş kalemi defterinin okunan yüzü. */
export interface KalemAdedi {
  id: string;
  itemNo: string;
  /** `null` = bilinmiyor. Sıfır ya da 1 varsayılmaz (md. 6 migration notu). */
  qty: number | null;
  /** Resimlerini bu kalemle paylaşan kalem varsa onun kimliği. */
  sharesWith: string | null;
}

export interface CarpanSonucu {
  carpan: number;
  belirsiz: boolean;
  /** Çarpana katılan kalem numaraları — ekranda ipucu olarak gösterilir. */
  katilanlar: string[];
}

/**
 * Bir teknik resim paketinin adet çarpanı.
 *
 * TAŞIYICI KALEM + ONA BAĞLI KALEMLER. `0075-01` ile `0075-02` yalnız montaj
 * konumunda ayrılıyorsa ressam tek takım resim çizer ve ikisi `0075-01`e
 * bağlanır; o zaman paketin çarpanı qty(01) + qty(02) olur.
 *
 * BELİRSİZLİK YAYILIR: katılanlardan birinin adedi bilinmiyorsa toplam da
 * şüphelidir ve öyle işaretlenir. "Bilinmeyeni 1 say ve sus" davranışı, üç
 * adetlik bir işi bir adet sipariş etmenin en kolay yoludur.
 */
export function drawingCarpani(
  kalemId: string | null,
  kalemNo: string,
  kalemler: readonly KalemAdedi[]
): CarpanSonucu {
  // Kalem KİMLİKLE bulunur; yoksa NUMARAYLA (paketin `job_item_id`si boş
  // olabilir ve `item_no` metni tek bağdır — md. 17'nin kuralı).
  const taşıyıcı =
    (kalemId ? kalemler.find((k) => k.id === kalemId) : undefined) ??
    (kalemNo ? kalemler.find((k) => k.itemNo === kalemNo) : undefined);

  if (!taşıyıcı) return { carpan: 1, belirsiz: true, katilanlar: [] };

  // Ödünç alan bir kaleme denk geldiysek gerçek taşıyıcıya çıkılır: resim
  // ORADA yaşar ve çarpan orada toplanır.
  const kok = taşıyıcı.sharesWith
    ? (kalemler.find((k) => k.id === taşıyıcı.sharesWith) ?? taşıyıcı)
    : taşıyıcı;

  const katkida = [kok, ...kalemler.filter((k) => k.sharesWith === kok.id)];
  let toplam = 0;
  let belirsiz = false;
  for (const k of katkida) {
    if (k.qty == null) {
      belirsiz = true;
      toplam += 1; // açıkça söylenen varsayım
    } else {
      toplam += k.qty;
    }
  }
  return {
    carpan: Math.max(1, toplam),
    belirsiz,
    katilanlar: katkida.map((k) => k.itemNo).filter(Boolean),
  };
}

// ————————————————————————————————————————————————————————— havuz kurulumu

function birimAgirligiCoz(degerler: Set<number>, satirSayisi: number, beklenen: number) {
  // `derive.ts`teki kuralın aynısı: bütün satırlar aynı değeri söylemiyorsa ya
  // da bir satırın ağırlığı hiç yoksa TEK BİR birim ağırlık yoktur.
  return degerler.size === 1 && satirSayisi === beklenen ? [...degerler][0] : null;
}

/**
 * Talep havuzunu kurar.
 *
 * `duzeltmeler` — `drawing_purchase_overrides` defteri (katlanmış tanım →
 * kategori). Paket ekranıyla AYNI defter okunur; kategori düzeltmesi iki
 * ekranda birden geçerlidir, yoksa satınalmacı aynı düzeltmeyi iki kez yapardı.
 */
export function talepHavuzu(
  paketler: readonly HavuzPaketi[],
  satirlar: readonly HavuzSatiri[],
  secenekler: { duzeltmeler?: ReadonlyMap<string, string> } = {}
): TalepHavuzu {
  const paketHaritasi = new Map(paketler.map((p) => [p.packageId, p]));
  const kalemler = new Map<string, TalepSatiri>();
  const birimler = new Map<string, { degerler: Set<number>; satir: number; toplam: number }>();

  for (const s of satirlar) {
    const paket = paketHaritasi.get(s.packageId);
    if (!paket) continue;

    const norm = normalizeTanim(s.tanim);
    // Tanımsız satır havuza GİRMEZ: adı olmayan bir kalem sipariş edilemez ve
    // anahtarı da olamaz. Paket ekranında görünmeye devam eder.
    if (!norm.key) continue;

    const birimAdet = s.qty != null && Number.isFinite(s.qty) ? s.qty : null;
    const adet = birimAdet == null ? null : birimAdet * paket.carpan;
    const birim = s.weightKg != null && Number.isFinite(s.weightKg) ? s.weightKg : null;
    const satirAgirligi = birim == null ? null : birim * (adet ?? paket.carpan);

    const pay: TalepPayi = {
      packageId: s.packageId,
      packageLabel: paket.label,
      itemNo: paket.itemNo,
      jobNo: paket.jobNo,
      jobTitle: paket.jobTitle,
      customer: paket.customer,
      birimAdet,
      carpan: paket.carpan,
      carpanBelirsiz: paket.carpanBelirsiz,
      adet,
      partKey: s.partKey,
      groupName: s.groupName,
    };

    const varOlan = kalemler.get(norm.key);
    if (varOlan) {
      varOlan.paylar.push(pay);
      if (adet != null) varOlan.adet = (varOlan.adet ?? 0) + adet;
      if (satirAgirligi != null) {
        varOlan.toplamAgirlikKg = (varOlan.toplamAgirlikKg ?? 0) + satirAgirligi;
      }
      if (!varOlan.hamTanimlar.includes(s.tanim) && s.tanim) varOlan.hamTanimlar.push(s.tanim);
      const mal = s.material.trim();
      if (mal && !varOlan.malzemeler.includes(mal)) varOlan.malzemeler.push(mal);
      if (!varOlan.malzeme) varOlan.malzeme = mal;
      if (s.groupName && !varOlan.anaGruplar.includes(s.groupName)) {
        varOlan.anaGruplar.push(s.groupName);
      }
      if (paket.carpanBelirsiz) varOlan.carpanBelirsiz = true;

      const izleyici = birimler.get(norm.key);
      if (izleyici) {
        izleyici.toplam += 1;
        if (birim != null) {
          izleyici.degerler.add(birim);
          izleyici.satir += 1;
        }
      }
      continue;
    }

    const mal = s.material.trim();
    // DÜZELTME SÖZLÜĞÜ YENER (`derive.ts` ile aynı kural): sözlük bir tahmin,
    // insanın taşıdığı kategori bir karardır.
    const duzeltme = secenekler.duzeltmeler?.get(norm.key);
    birimler.set(norm.key, {
      degerler: new Set(birim == null ? [] : [birim]),
      satir: birim == null ? 0 : 1,
      toplam: 1,
    });
    kalemler.set(norm.key, {
      key: norm.key,
      tanim: norm.tanim,
      hamTanimlar: s.tanim ? [s.tanim] : [],
      sinif: duzeltme || satinAlmaSinifi(norm.tanim),
      malzeme: mal,
      malzemeler: mal ? [mal] : [],
      anaGruplar: s.groupName ? [s.groupName] : [],
      adet,
      birimAgirlikKg: birim,
      toplamAgirlikKg: satirAgirligi,
      paylar: [pay],
      isSayisi: 0,
      carpanBelirsiz: paket.carpanBelirsiz,
    });
  }

  const liste = [...kalemler.values()];
  for (const k of liste) {
    const b = birimler.get(k.key);
    k.birimAgirlikKg = b ? birimAgirligiCoz(b.degerler, b.satir, b.toplam) : null;
    k.isSayisi = new Set(k.paylar.map((p) => p.itemNo || p.packageId)).size;
    // Paylar İŞ SIRASINDA durur: satınalmacı bir kalemi bölerken hangi işten
    // ne kadar geldiğini yukarıdan aşağı okur.
    k.paylar.sort((a, b2) => a.itemNo.localeCompare(b2.itemNo, "tr"));
  }

  const siniflar = [...new Set(liste.map((k) => k.sinif))]
    .map((sinif) => {
      const grup = liste.filter((k) => k.sinif === sinif);
      return {
        sinif,
        satirSayisi: grup.length,
        adet: grup.reduce((t, k) => t + (k.adet ?? 0), 0),
      };
    })
    .sort((a, b) => b.satirSayisi - a.satirSayisi);

  return {
    satirlar: liste,
    siniflar,
    toplamKalem: liste.length,
    toplamAdet: liste.reduce((t, k) => t + (k.adet ?? 0), 0),
    kaynakSatiri: liste.reduce((t, k) => t + k.paylar.length, 0),
    cokIsliKalem: liste.filter((k) => k.isSayisi > 1).length,
    belirsizKalem: liste.filter((k) => k.carpanBelirsiz).length,
    paketSayisi: new Set(liste.flatMap((k) => k.paylar.map((p) => p.packageId))).size,
  };
}
