// HAMMADDE TALEP HAVUZU — çok projeli malzeme ihtiyacı.
//
// EKİPMAN HAVUZUNUN KARDEŞİDİR, KOPYASI DEĞİL (`demand.ts`). Üç şeyi paylaşır:
// anahtar NORMALLEŞTİRİLMİŞ TANIMDIR, adetler İŞ KALEMİ ADEDİYLE ÇARPILIR
// (md. 6) ve kaynak izi İŞ DÜZEYİNDEDİR. Üç şeyde ayrılır:
//
//   1. KAYNAK SATIRLARI İMALATTIR. Ekipman havuzu satın alma satırlarını okur;
//      hammadde havuzu tam olarak ONUN OKUMADIKLARINI okur. İki ekran aynı
//      satırı iki kez SAYMAZ; farklı soruları cevaplarlar (parça mı üretilecek,
//      hangi plakadan kesilecek).
//
//   2. BİRLEŞTİRME BİRİMİ PARÇA DEĞİL STOK KALEMİDİR. `SAC 15x375x1500` ile
//      `SAC 15x300x850` iki ayrı parçadır ama TEK bir plakadan çıkarlar:
//      `SAC 15 MM S355JR`. Havuz bu yüzden iki katmanlıdır — üstte sipariş
//      edilecek stok kalemi, altında onu isteyen kesim parçaları.
//
//   3. MİKTAR SORUSU SINIFA GÖRE DEĞİŞİR. Sacda soru ALAN ve AĞIRLIK, profilde
//      METRE ve KAÇ BOY, doluda AĞIRLIKtır. Tek bir "adet" sütunu üçünü de
//      yanlış anlatırdı.
//
// ÇEKİRDEK SAFTIR: DB/HTTP importu yok.

import { trKatla } from "@/lib/drawings/tr-text";
import { hammaddeCozumle, type HammaddeCozumu, type PayKaynagi } from "./cozumle";
import { STOK_BOYU_MM, type HammaddeSinifi } from "./siniflar";

// ═════════════════════════════════════════════════════════════ GİRDİLER

/** Havuza giren paketin künyesi — `demand.ts`teki `HavuzPaketi` ile aynı. */
export interface HammaddePaketi {
  packageId: string;
  label: string;
  itemNo: string;
  jobNo: string;
  jobTitle: string;
  customer: string;
  /** İş kalemi adedi çarpanı (`drawingCarpani`). */
  carpan: number;
  carpanBelirsiz: boolean;
}

/** Defterden okunan bir imalat satırı. */
export interface HammaddeKaynagi {
  packageId: string;
  partKey: string;
  partCode: string;
  tanim: string;
  malzeme: string;
  kategori: string;
  kind: string;
  /** Resimdeki adet — BİR ürün için; çarpan ayrıca uygulanır. */
  qty: number | null;
  /**
   * TOPLAM KESİM BOYU [mm] — Excel'in kirli `QTY` sütunundan
   * (`drawing_parts.cut_length_mm`). `Testere` satırlarında ressam bu sütuna
   * adet değil TOPLAM BOY yazar ("240000,000 mm" = 20 × 12.000).
   *
   * Adet bilinmediğinde gerçek sayı BURADAN türetilir; bkz. `adediCoz`.
   */
  kesimBoyuMm?: number | null;
  groupCode: string;
  groupName: string;
  /** Parçanın KENDİ resmi (detay pafta) — depo yolu ve dosya adı. */
  detayPdf?: DosyaBagi | null;
  /** BİR ÜST montajın resmi (üst pafta). */
  anaPdf?: DosyaBagi | null;
  /**
   * ÖLÇÜSÜ ELLE DÜZELTİLMİŞ Mİ? (`purchase_raw_part_dims`)
   *
   * `tanim` o zaman ressamın yazdığı metin DEĞİL, düzeltilmiş metindir; ham
   * hâli `hamTanim`da durur ve ekran ikisini yan yana gösterir — kullanıcı
   * kararı: *"değiştirdiğim kırmızı renkli olsun, değiştirildi gibi göze
   * çarpsın."*
   */
  olcuElle?: boolean;
  hamTanim?: string;
}

/** Depodaki bir dosyaya bağ — imzalı bağlantı istemcide üretilir. */
export interface DosyaBagi {
  ad: string;
  yol: string;
  /**
   * Paftanın PARÇA KODU — üst pafta düğmesinin etiketinde görünür.
   *
   * Kullanıcı kararı (15.08.2026): *"ana pafta derken bir üst paftasını
   * demiştim … 11.1.1 numaralı işte bir üst paftası 11.1 olarak gelsin."*
   * Kodu yazmadan "Üst pafta" demek hangi montaja bakıldığını gizlerdi.
   */
  kod?: string;
}

/**
 * ADET ÇÖZÜMÜ — kesim boyu bir ADET KANITIDIR.
 *
 * `Item QTY` sütunu olmayan sayfalarda defterin adedi boş kalır (bkz.
 * `reconcile.ts`). Ama aynı satır TOPLAM KESİM BOYUNU taşıyor ve tanım BİRİM
 * BOYU söylüyor: `NPL 120x120x10 L=6000` + 24.000 mm toplam = 4 adet.
 *
 * Bölme TAM ÇIKMALIDIR (%1 tolerans): çıkmıyorsa birim boy yanlış okunmuştur
 * ve uydurulmuş bir adet, boş bir adetten çok daha pahalıdır — defterin
 * kendi sayısına dönülür.
 *
 * İKİSİ DE VARSA VE ÇELİŞİYORSA kesim boyu kazanır: o sayı ressamın
 * Excel'inden birebir gelir, adet ise sütun eşlemesinin sonucudur.
 */
export function adediCoz(
  qty: number | null,
  kesimBoyuMm: number | null | undefined,
  birimBoyMm: number | null
): { adet: number | null; kaynak: "defter" | "kesimBoyu" } {
  if (kesimBoyuMm != null && kesimBoyuMm > 0 && birimBoyMm != null && birimBoyMm > 0) {
    const oran = kesimBoyuMm / birimBoyMm;
    const yuvarlak = Math.round(oran);
    if (yuvarlak >= 1 && Math.abs(oran - yuvarlak) <= 0.01 * yuvarlak) {
      return { adet: yuvarlak, kaynak: "kesimBoyu" };
    }
  }
  return { adet: qty != null && Number.isFinite(qty) ? qty : null, kaynak: "defter" };
}

// ═════════════════════════════════════════════════════════════ ÇIKTILAR

/** Stok kalemini isteyen TEK bir kesim parçası. */
export interface KesimParcasi {
  packageId: string;
  partKey: string;
  partCode: string;
  /** Ressamın yazdığı ham tanım. */
  tanim: string;
  itemNo: string;
  jobNo: string;
  customer: string;
  groupName: string;
  /** Resimdeki adet. */
  birimAdet: number | null;
  carpan: number;
  /** birimAdet × carpan — gerçekten kesilecek adet. */
  adet: number | null;
  /** SATIN ALINACAK ölçüler — pay uygulanmış hâli. */
  kalinlikMm: number | null;
  enMm: number | null;
  boyMm: number | null;
  disCapMm: number | null;
  icCapMm: number | null;
  /**
   * RESİMDEKİ ölçüler — pay varsa `…Mm` alanlarından FARKLIDIR.
   *
   * Ekran ikisini yan yana basar: satınalmacı "resimde Ø90 yazıyor, ben neden
   * Ø95 alıyorum" sorusunu ekranda cevaplayabilmelidir.
   */
  resimDisCapMm: number | null;
  resimBoyMm: number | null;
  birimAgirlikKg: number | null;
  payKaynagi: PayKaynagi;
  payUygulandi: boolean;
  eksikler: string[];
  detayPdf: DosyaBagi | null;
  anaPdf: DosyaBagi | null;
  /** Ölçüsü elle düzeltildi mi? Ekran satırı KIRMIZI basar. */
  olcuElle: boolean;
  /** Ressamın yazdığı ham tanım — düzeltme varsa `tanim`dan farklıdır. */
  hamTanim: string;
}

export interface HammaddeSatiri {
  /** `trKatla(stokTanimi)` — teklif/sipariş/fiyat arşivi aynı anahtarı taşır. */
  key: string;
  /**
   * ÇÖZÜCÜNÜN ÜRETTİĞİ anahtar — düzeltme defterinin anahtarı budur.
   *
   * Taşınmış bir satırda `key`ten FARKLIDIR ve ekran taşımayı geri alırken
   * bunu kullanır; `key` ile yazsaydı düzeltme kendi kendini bulamazdı.
   */
  kaynakAnahtar: string;
  /** Satın alınacak stok kaleminin adı: "SAC 15 MM S355JR". */
  tanim: string;
  sinif: HammaddeSinifi;
  kesitKodu: string;
  kalite: string;
  /** Kalite elle mi girildi? Ekran bunu bir rozetle söyler. */
  kaliteElle?: boolean;
  /** Adet elle mi ezildi? Türetilen sayı `turetilenAdet`te durur. */
  adetElle?: boolean;
  /** Ezilmeden önceki türetilmiş parça adedi — karşılaştırma için. */
  turetilenAdet?: number;
  /** Metre ağırlığı [kg/m]; sacda null. */
  kgPerM: number | null;
  agirlikKaynagi: HammaddeCozumu["agirlikKaynagi"];
  /** Çelik dışı bir malzeme tanındıysa uyarı olur. */
  celikVarsayildi: boolean;

  /** Kaç kesim parçası bu stok kalemini istiyor (satır sayısı, adet değil). */
  parcaSayisi: number;
  /** Kesilecek toplam parça ADEDİ (adetler çarpanla birlikte). */
  parcaAdedi: number;
  /** Toplam kesim boyu [mm] — profil/ray/boru/dolu. */
  toplamBoyMm: number | null;
  /**
   * GEREKEN STOK BOYU ADEDİ — kesim parçaları standart boya YERLEŞTİRİLEREK
   * bulunur, `toplam / 12000` ile DEĞİL. Fark gerçektir: 7000 mm'lik iki parça
   * 14 m eder ve "iki boy" der; oysa ikisi de tek bir 12 m'ye sığmaz, cevap
   * yine iki boydur — ama 5000+5000+5000 üç parça 15 m eder ve naif hesap iki
   * boy derken doğrusu ikidir (5+5=10 ≤ 12, kalan 5 ikinci boya). Uzun
   * listelerde iki sonuç ayrışır ve eksik sipariş verdirir.
   */
  boyAdedi: number | null;
  /** Standart boydan UZUN parçalar — ekleme gerekir, sessiz geçilmez. */
  boyuAsanParca: number;
  /** Bu sınıfın satın alma boyu [mm]; yoksa null. */
  stokBoyuMm: number | null;
  /** Toplam sac alanı [mm²] — yalnız SAC. */
  toplamAlanMm2: number | null;
  toplamAgirlikKg: number | null;

  parcalar: KesimParcasi[];
  paylar: HammaddePayi[];
  /** Kaç farklı iş kalemi bu malzemeyi istiyor? */
  isSayisi: number;
  carpanBelirsiz: boolean;
  /** Kesim parçalarının topladığı okunamayan ölçüler (tekilleştirilmiş). */
  eksikler: string[];
  /** Pay uygulandı mı ve kaynağı ne? Ekran bunu açıkça yazar. */
  payUygulandi: boolean;
  payKaynagi: PayKaynagi;
  /** İnsanın bu stok kalemine yazdığı not. */
  not: string;
  /** Elle eklenmiş satır mı (`purchase_raw_manual`)? */
  manualId?: string;
  /** Kullanıcı sınıfı elle değiştirdi mi ("klasöre taşı")? */
  sinifElle?: boolean;
}

/** Bir stok kaleminin BİR işe düşen payı. */
export interface HammaddePayi {
  packageId: string;
  packageLabel: string;
  itemNo: string;
  jobNo: string;
  jobTitle: string;
  customer: string;
  parcaAdedi: number;
  boyMm: number | null;
  agirlikKg: number | null;
}

export interface HammaddeHavuzu {
  satirlar: HammaddeSatiri[];
  /** Sınıf dağılımı — künye ve süzgeç. */
  siniflar: { sinif: HammaddeSinifi; satirSayisi: number; agirlikKg: number }[];
  toplamKalem: number;
  toplamAgirlikKg: number;
  /** Kaç imalat satırından toplandı (birleşmeden önce). */
  kaynakSatiri: number;
  cokIsliKalem: number;
  belirsizKalem: number;
  paketSayisi: number;
}

// ══════════════════════════════════════════════════════════════ SEÇENEKLER

export interface HammaddeSecenekleri {
  /**
   * SINIF DÜZELTMELERİ — kullanıcının "klasöre taşı" kararı.
   *
   * ANAHTAR ÇÖZÜCÜNÜN ÜRETTİĞİ STOK ANAHTARIDIR, taşındıktan SONRAKİ değil.
   * Sebep basit: taşındıktan sonraki anahtarla arasaydık, bir sonraki okumada
   * satır zaten yeni anahtarda olacağı için düzeltme bulunamaz ve satır eski
   * sınıfına geri düşerdi. Çözücünün ürettiği anahtar SABİTTİR — tanım
   * değişmedikçe her okumada aynı çıkar.
   *
   * GRUP BAŞINA TEK SATIR: kullanıcı bir stok kalemini taşıdığında defterde
   * tek bir kayıt oluşur ve o gruba SONRADAN katılan parçalar düzeltmeyi
   * KENDİLİĞİNDEN devralır. Parça başına kayıt tutulsaydı, aynı yanlışı
   * yapan yeni bir resim yüklendiğinde kullanıcı taşımayı yeniden yapardı.
   */
  sinifDuzeltmeleri?: ReadonlyMap<string, HammaddeSinifi>;
  /** Görünen stok adını ezen düzeltme (anahtar: çözücünün stok anahtarı). */
  etiketDuzeltmeleri?: ReadonlyMap<string, string>;
  /** Kaliteyi ezen düzeltme — ressam yazmamışsa ya da yanlış yazmışsa. */
  kaliteDuzeltmeleri?: ReadonlyMap<string, string>;
  /**
   * ADEDİ EZEN DÜZELTME.
   *
   * Türetilmiş adet bir SAYIM sonucudur; satınalmacı bazen fazladan alır
   * ("yedek koyalım") ya da elde stok vardır. Ezilen değer PARÇA ADEDİDİR;
   * ağırlık ve boy sayısı ondan yeniden türer, ekranda iki ayrı gerçek olmaz.
   */
  adetDuzeltmeleri?: ReadonlyMap<string, number>;
  /** Stok kalemine yazılmış insan notu (anahtar: çözücünün stok anahtarı). */
  notlar?: ReadonlyMap<string, string>;
  /** Havuzdan çıkarılmış stok kalemleri (anahtar: çözücünün stok anahtarı). */
  haricler?: ReadonlySet<string>;
  /**
   * EKİPMAN HAVUZUNA TAŞINMIŞ stok kalemleri.
   *
   * `haricler`den AYRI TUTULUR ve bu bilinçli: "havuzdan çıkar" bir susturma,
   * "ekipmana taşı" bir YENİDEN SINIFLANDIRMAdır — satır kaybolmaz, öteki
   * havuzda görünür. İkisini tek bayrağa indirmek, taşınan bir kalemin
   * gerçekten karşı tarafa geçip geçmediğini ekranda sorulamaz yapardı.
   */
  ekipmanaTasinanlar?: ReadonlySet<string>;
}

// ═══════════════════════════════════════════════════════════════ KURULUM

export function hammaddeHavuzu(
  paketler: readonly HammaddePaketi[],
  kaynaklar: readonly HammaddeKaynagi[],
  secenekler: HammaddeSecenekleri = {}
): HammaddeHavuzu {
  const paketHaritasi = new Map(paketler.map((p) => [p.packageId, p]));
  const kalemler = new Map<string, HammaddeSatiri>();
  /** Adedi hiçbir kaynaktan okunamayan stok kalemleri — ekran bunu söyler. */
  const eksikAdet = new Set<string>();
  let kaynakSatiri = 0;

  for (const k of kaynaklar) {
    const paket = paketHaritasi.get(k.packageId);
    if (!paket) continue;

    const cozum = hammaddeCozumle({
      tanim: k.tanim,
      malzeme: k.malzeme,
      kategori: k.kategori,
      kind: k.kind,
      partCode: k.partCode,
    });
    if (!cozum) continue;
    kaynakSatiri++;

    // DÜZELTME SÖZLÜĞÜ YENER (`demand.ts` ile aynı kural): sözlük bir tahmin,
    // insanın taşıdığı sınıf bir karardır. Taşınan satırın STOK KALEMİ de
    // değişir — yoksa "Boru" grubunda duran bir satırın anahtarı hâlâ
    // "DOLU Ø90" olurdu ve iki ekran birbiriyle çelişirdi.
    const kaynakAnahtar = cozum.stokAnahtari;
    if (secenekler.haricler?.has(kaynakAnahtar)) continue;
    if (secenekler.ekipmanaTasinanlar?.has(kaynakAnahtar)) continue;
    const duzeltme = secenekler.sinifDuzeltmeleri?.get(kaynakAnahtar);
    const sinif = duzeltme ?? cozum.sinif;
    const tasinmis = duzeltme
      ? tasinmisStok(cozum, duzeltme)
      : { key: cozum.stokAnahtari, tanim: cozum.stokTanimi };
    const etiket = secenekler.etiketDuzeltmeleri?.get(kaynakAnahtar);
    const kaliteDuzeltme = secenekler.kaliteDuzeltmeleri?.get(kaynakAnahtar);
    const key = tasinmis.key;
    const tanim = etiket?.trim() || tasinmis.tanim;
    if (!key) continue;

    const cozulmus = adediCoz(k.qty, k.kesimBoyuMm, cozum.olcu.boyMm);
    const birimAdet = cozulmus.adet;
    const adet = birimAdet == null ? null : birimAdet * paket.carpan;
    if (birimAdet == null) eksikAdet.add(key);

    const parca: KesimParcasi = {
      packageId: k.packageId,
      partKey: k.partKey,
      partCode: k.partCode,
      tanim: k.tanim,
      itemNo: paket.itemNo,
      jobNo: paket.jobNo,
      customer: paket.customer,
      groupName: k.groupName,
      birimAdet,
      carpan: paket.carpan,
      adet,
      kalinlikMm: cozum.olcu.kalinlikMm,
      enMm: cozum.olcu.enMm,
      boyMm: cozum.olcu.boyMm,
      disCapMm: cozum.olcu.disCapMm,
      icCapMm: cozum.olcu.icCapMm,
      resimDisCapMm: cozum.resimOlcusu.disCapMm,
      resimBoyMm: cozum.resimOlcusu.boyMm,
      birimAgirlikKg: cozum.birimAgirlikKg,
      payKaynagi: cozum.payKaynagi,
      payUygulandi: cozum.payUygulandi,
      eksikler: cozum.eksikler,
      detayPdf: k.detayPdf ?? null,
      anaPdf: k.anaPdf ?? null,
      olcuElle: Boolean(k.olcuElle),
      hamTanim: k.hamTanim || k.tanim,
    };

    let satir = kalemler.get(key);
    if (!satir) {
      satir = {
        key,
        kaynakAnahtar,
        tanim,
        sinif,
        kesitKodu: cozum.kesitKodu,
        kalite: kaliteDuzeltme?.trim() || cozum.kalite,
        kaliteElle: Boolean(kaliteDuzeltme?.trim()),
        kgPerM: cozum.kgPerM,
        agirlikKaynagi: cozum.agirlikKaynagi,
        celikVarsayildi: cozum.celikVarsayildi,
        parcaSayisi: 0,
        parcaAdedi: 0,
        toplamBoyMm: null,
        boyAdedi: null,
        boyuAsanParca: 0,
        stokBoyuMm: STOK_BOYU_MM[sinif],
        toplamAlanMm2: null,
        toplamAgirlikKg: null,
        parcalar: [],
        paylar: [],
        isSayisi: 0,
        carpanBelirsiz: false,
        eksikler: [],
        payUygulandi: false,
        payKaynagi: "yok",
        not: "",
        sinifElle: duzeltme != null,
      };
      kalemler.set(key, satir);
    }

    satir.parcalar.push(parca);
    if (paket.carpanBelirsiz) satir.carpanBelirsiz = true;
    if (cozum.payUygulandi) {
      satir.payUygulandi = true;
      // RESSAMIN PAYI OTOMATİĞİ YENER: bir kalemin parçalarından biri elle pay
      // almışsa satır "ressam" der — o bir karardır ve görünmelidir.
      if (satir.payKaynagi !== "ressam") satir.payKaynagi = cozum.payKaynagi;
    }
    for (const e of cozum.eksikler) if (!satir.eksikler.includes(e)) satir.eksikler.push(e);
  }

  const liste = [...kalemler.values()];
  for (const s of liste) {
    ozetle(s);
    // ADET DÜZELTMESİ ÖZETTEN SONRA UYGULANIR ve türetilen sayı SAKLANIR:
    // ekran ikisini yan yana gösterebilmeli, yoksa "bu 40 nereden geldi"
    // sorusunun cevabı kaybolur. Ağırlık ve boy sayısı ORANLA taşınır —
    // yeniden hesaplamak parça ölçülerini değiştirmek olurdu.
    const yeniAdet = secenekler.adetDuzeltmeleri?.get(s.kaynakAnahtar);
    if (yeniAdet != null && yeniAdet > 0 && yeniAdet !== s.parcaAdedi) {
      const oran = s.parcaAdedi > 0 ? yeniAdet / s.parcaAdedi : 0;
      s.turetilenAdet = s.parcaAdedi;
      s.adetElle = true;
      s.parcaAdedi = yeniAdet;
      if (oran > 0) {
        if (s.toplamAgirlikKg != null) s.toplamAgirlikKg = Math.round(s.toplamAgirlikKg * oran * 1000) / 1000;
        if (s.toplamBoyMm != null) s.toplamBoyMm = Math.round(s.toplamBoyMm * oran * 100) / 100;
        if (s.toplamAlanMm2 != null) s.toplamAlanMm2 = s.toplamAlanMm2 * oran;
        if (s.boyAdedi != null && s.stokBoyuMm) s.boyAdedi = Math.ceil(s.boyAdedi * oran);
      }
    }
    // ADEDİ OKUNAMAYAN SATIR SESSİZ KALMAZ: ağırlık ve boy hesabı o satırda
    // eksik çıkar ve ekran sebebini söylemek zorundadır.
    if (eksikAdet.has(s.key) && !s.eksikler.includes("adet okunamadı")) {
      s.eksikler.push("adet okunamadı");
    }
  }

  // SIRA SINIFA GÖRE, sonra AĞIRLIĞA GÖRE BÜYÜKTEN KÜÇÜĞE: satınalmacının ilk
  // baktığı şey en çok para tutan kalemdir.
  liste.sort(
    (a, b) =>
      sinifSirasi(a.sinif) - sinifSirasi(b.sinif) ||
      (b.toplamAgirlikKg ?? 0) - (a.toplamAgirlikKg ?? 0) ||
      a.tanim.localeCompare(b.tanim, "tr")
  );

  if (secenekler.notlar) {
    for (const s of liste) s.not = secenekler.notlar.get(s.kaynakAnahtar) ?? "";
  }

  return ozetiKur(liste, kaynakSatiri);
}

/** Havuz özeti — override/manuel satır eklendikten sonra da çağrılabilir. */
export function ozetiKur(liste: HammaddeSatiri[], kaynakSatiri: number): HammaddeHavuzu {
  const siniflar = [...new Set(liste.map((k) => k.sinif))]
    .map((sinif) => {
      const grup = liste.filter((k) => k.sinif === sinif);
      return {
        sinif,
        satirSayisi: grup.length,
        agirlikKg: grup.reduce((t, k) => t + (k.toplamAgirlikKg ?? 0), 0),
      };
    })
    .sort((a, b) => sinifSirasi(a.sinif) - sinifSirasi(b.sinif));

  return {
    satirlar: liste,
    siniflar,
    toplamKalem: liste.length,
    toplamAgirlikKg: liste.reduce((t, k) => t + (k.toplamAgirlikKg ?? 0), 0),
    kaynakSatiri,
    cokIsliKalem: liste.filter((k) => k.isSayisi > 1).length,
    belirsizKalem: liste.filter((k) => k.carpanBelirsiz).length,
    paketSayisi: new Set(liste.flatMap((k) => k.parcalar.map((p) => p.packageId))).size,
  };
}

/** Bir stok kaleminin toplamlarını ve paylarını kurar. */
export function ozetle(s: HammaddeSatiri): void {
  s.parcaSayisi = s.parcalar.length;
  s.parcaAdedi = s.parcalar.reduce((t, p) => t + (p.adet ?? 0), 0);

  let agirlik = 0;
  let agirlikVar = false;
  let boy = 0;
  let boyVar = false;
  let alan = 0;
  let alanVar = false;
  const kesimler: number[] = [];

  for (const p of s.parcalar) {
    const adet = p.adet ?? 0;
    if (p.birimAgirlikKg != null && adet > 0) {
      agirlik += p.birimAgirlikKg * adet;
      agirlikVar = true;
    }
    if (p.boyMm != null && adet > 0) {
      boy += p.boyMm * adet;
      boyVar = true;
      for (let i = 0; i < adet; i++) kesimler.push(p.boyMm);
    }
    if (s.sinif === "SAC" && p.enMm != null && p.boyMm != null && adet > 0) {
      alan += p.enMm * p.boyMm * adet;
      alanVar = true;
    }
  }

  s.toplamAgirlikKg = agirlikVar ? Math.round(agirlik * 1000) / 1000 : null;
  s.toplamBoyMm = boyVar ? Math.round(boy * 100) / 100 : null;
  s.toplamAlanMm2 = alanVar ? alan : null;

  if (s.stokBoyuMm && kesimler.length > 0) {
    const { boyAdedi, asan } = boyaYerlestir(kesimler, s.stokBoyuMm);
    s.boyAdedi = boyAdedi;
    s.boyuAsanParca = asan;
  } else {
    s.boyAdedi = null;
    s.boyuAsanParca = 0;
  }

  // PAYLAR İŞ SIRASINDA durur: satınalmacı bir kalemi bölerken hangi işten ne
  // kadar geldiğini yukarıdan aşağı okur.
  const paylar = new Map<string, HammaddePayi>();
  for (const p of s.parcalar) {
    let pay = paylar.get(p.packageId);
    if (!pay) {
      pay = {
        packageId: p.packageId,
        packageLabel: p.itemNo || p.packageId,
        itemNo: p.itemNo,
        jobNo: p.jobNo,
        jobTitle: "",
        customer: p.customer,
        parcaAdedi: 0,
        boyMm: null,
        agirlikKg: null,
      };
      paylar.set(p.packageId, pay);
    }
    const adet = p.adet ?? 0;
    pay.parcaAdedi += adet;
    if (p.boyMm != null) pay.boyMm = (pay.boyMm ?? 0) + p.boyMm * adet;
    if (p.birimAgirlikKg != null) pay.agirlikKg = (pay.agirlikKg ?? 0) + p.birimAgirlikKg * adet;
  }
  s.paylar = [...paylar.values()].sort((a, b) => a.itemNo.localeCompare(b.itemNo, "tr"));
  s.isSayisi = new Set(s.paylar.map((p) => p.itemNo || p.packageId)).size;

  // Parçalar BÜYÜKTEN KÜÇÜĞE: sac yerleşiminde de, profil kesiminde de önce
  // büyük parça yerleşir; liste o sırayla okunursa ekran algoritmayla aynı
  // hikâyeyi anlatır.
  s.parcalar.sort(
    (a, b) =>
      (b.boyMm ?? 0) * (b.enMm ?? 1) - (a.boyMm ?? 0) * (a.enMm ?? 1) ||
      a.tanim.localeCompare(b.tanim, "tr")
  );
}

/**
 * 1B KESİM YERLEŞİMİ — kaç standart boy gerekir?
 *
 * `toplam / boy` YANLIŞ CEVAP VERİR ve hata hep AZ yöndedir: 7000 + 7000 = 14 m
 * "iki boy" der ve doğrudur, ama 7000 + 6000 = 13 m de "iki boy" der — oysa
 * ikisi tek bir 12 m'ye sığmaz ve cevap yine ikidir. Fark uzun listelerde
 * büyür: on tane 7 m'lik parça 70 m eder (naif: 6 boy) ama her boya yalnız BİR
 * parça sığar, yani on boy gerekir. Dört boyluk bir eksik sipariş, iki hafta
 * gecikme demektir.
 *
 * FFD (first-fit-decreasing) kullanılır: optimalin en çok %22'si kadar fazla
 * verir, deterministiktir ve kesim payı olmadan da gerçeğe çok yakındır.
 * Standart boydan UZUN parça hiçbir boya sığmaz — ayrıca sayılır ve ekranda
 * "ekleme gerekir" diye görünür; sessizce bir boya sayılmaz.
 */
export function boyaYerlestir(
  kesimler: readonly number[],
  stokBoyuMm: number
): { boyAdedi: number; asan: number } {
  const sigan: number[] = [];
  let asan = 0;
  for (const k of kesimler) {
    if (k > stokBoyuMm) asan++;
    else sigan.push(k);
  }
  const sirali = [...sigan].sort((a, b) => b - a);
  const boylar: number[] = [];
  for (const k of sirali) {
    let kondu = false;
    for (let i = 0; i < boylar.length; i++) {
      if (boylar[i] + k <= stokBoyuMm) {
        boylar[i] += k;
        kondu = true;
        break;
      }
    }
    if (!kondu) boylar.push(k);
  }
  return { boyAdedi: boylar.length, asan };
}

// ══════════════════════════════════════════════════════════════ YARDIMCI

const SINIF_SIRASI: HammaddeSinifi[] = ["SAC", "PROFIL", "RAY", "DOLU", "BORU", "DIGER"];
function sinifSirasi(s: HammaddeSinifi): number {
  const i = SINIF_SIRASI.indexOf(s);
  return i < 0 ? SINIF_SIRASI.length : i;
}

/**
 * SINIF DÜZELTMESİNİN ANAHTARI — kaynak satırın katlanmış ham tanımı.
 *
 * `normAnahtar` DEĞİLDİR ve bu bilinçli: o fonksiyon satın alma tanımını
 * standart kalıba dizer (galvaniz ekler, DIN düzeltir) ve bir SAC parçasında
 * yapacağı iş yoktur. Düzeltme defteri ressamın yazdığı satırı işaret eder;
 * araya bir normalleştirme koymak, defterdeki kaydın hangi satıra ait olduğunu
 * belirsizleştirirdi.
 */
export function hamAnahtar(tanim: string): string {
  return trKatla(tanim.replace(/\s+/g, " "));
}

/**
 * STOK KALEMİNİN MİKTARI VE BİRİMİ — sınıfa göre değişir, kural TEK YERDE.
 *
 * Sac PLAKA ile alınır ama plaka adedi ancak yerleşim yapılınca bilinir; o
 * yüzden sacda birim KİLODUR (tedarikçi de tonaj konuşur). Profil, ray ve
 * boruda BOY adedi vardır. Dolu malzemede yine kilo.
 *
 * Sayı UYDURULMAZ: hesaplanamıyorsa `null` döner ve pencere adedi kullanıcıya
 * sorar.
 *
 * ═════════════════ FONKSİYON ÜÇ EKRANDA AYRI AYRI YAZILMIŞTI VE AYRIŞMIŞTI
 *
 * Havuz tablosu `Math.ceil`, teklif karşılaştırması `Math.round` kullanıyordu
 * (ölçüldü, 15.08.2026): aynı kalem bir ekranda 361 kg, öbüründe 360 kg
 * görünebiliyordu ve teklif tutarı ekranlar arasında oynardı. Doğrusu YUKARI
 * YUVARLAMAKtır — eksik sipariş verdiren bir yuvarlama, fazladan bir kilodan
 * çok daha pahalıdır.
 */
export function stokMiktari(s: {
  boyAdedi: number | null;
  toplamAgirlikKg: number | null;
  parcaAdedi: number;
}): { miktar: number | null; birim: string } {
  if (s.boyAdedi != null && s.boyAdedi > 0) return { miktar: s.boyAdedi, birim: "Boy" };
  if (s.toplamAgirlikKg != null && s.toplamAgirlikKg > 0) {
    return { miktar: Math.ceil(s.toplamAgirlikKg), birim: "Kg" };
  }
  return { miktar: s.parcaAdedi > 0 ? s.parcaAdedi : null, birim: "Adet" };
}

/**
 * ELLE TAŞINAN SATIRIN STOK KALEMİ.
 *
 * Kullanıcı bir satırı "Boru"dan "Dolu"ya taşıdığında adı da taşınmalıdır;
 * yoksa Dolu grubunda `BORU Ø140/Ø90` yazan bir kalem durur ve ekran kendi
 * kendisiyle çelişir. Ölçüler ÇÖZÜLDÜĞÜ GİBİ kalır — taşıma bir SINIF
 * kararıdır, ölçü kararı değil.
 */
function tasinmisStok(c: HammaddeCozumu, yeni: HammaddeSinifi): { key: string; tanim: string } {
  const o = c.olcu;
  const yaz = (v: number | null) => (v == null ? "?" : Number.isInteger(v) ? String(v) : String(v).replace(".", ","));
  let govde: string;
  switch (yeni) {
    case "SAC":
      govde = `SAC ${yaz(o.kalinlikMm)} MM`;
      break;
    case "PROFIL":
      govde = `PROFİL ${c.kesitKodu || yaz(o.enMm)}`;
      break;
    case "RAY":
      govde = `RAY ${c.kesitKodu || yaz(o.enMm)}`;
      break;
    case "DOLU":
      govde = `DOLU Ø${yaz(o.disCapMm)}`;
      break;
    case "BORU":
      govde = `BORU Ø${yaz(o.disCapMm)}/Ø${yaz(o.icCapMm)}`;
      break;
    default:
      govde = c.stokTanimi;
  }
  const tanim = [govde, c.kalite].filter(Boolean).join(" ");
  return { key: hamAnahtar(tanim), tanim };
}
