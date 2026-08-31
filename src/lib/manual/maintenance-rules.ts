// BAKIM TAKVİMİ KURAL DEFTERİ — saf; React, DB ve HTTP yok.
//
// NEDEN ÜRETİLİR: kaynak belgede (185/40T) bakım çizelgesi 235 SATIRDIR ve
// her satır o vincin ekipmanına bağlıdır. Şablon onu bilerek BOŞ doğuruyordu
// (KITAP-5) ve mühendis her kılavuzda aynı iki yüz satırı elle taşıyordu.
// Oysa satırların kaynağı zaten yazılıdır: hangi redüktör, hangi fren, kaç
// tekerlek — hepsi ekipman listesindedir. ~40 kural × ekipman listesi = o
// vincin kendi çizelgesi.
//
// İKİ KATMANLI DEFTER (kullanıcı kararı, 30.08.2026):
//   KOD KATMANI  — burası. Dayanağı bir STANDART olan satırlar; testle kilitli.
//   PANEL KATMANI — `manual_maintenance_rules` tablosu. Firmaya özel satırlar,
//                   kod kuralının üzerine binebilir ya da yenisini ekler.
// Birleştirme TEK yerdedir (`mergeMaintenanceRules`); çekirdek DB OKUMAZ,
// sunucu adaptörü defteri okuyup buraya GEÇİRİR (değişmez md. 7).
//
// DAYANAK STANDARDIN ADIDIR, MADDE NUMARASI DEĞİL. Standartların baskıları
// arasında madde numaraları kayar; uydurma bir "md. 5.2" atfı, bir güvenlik
// belgesinde doğrulanamayan bir otorite iddiası olurdu. `basis` alanı belgeye
// BASILMAZ — defterde durur ve testte okunur.
//
// ÜRETİLEN ÇİZELGE BİR ÖNERİDİR. Mühendis bloğa dokunduğu anda `edited` açılır
// ve tazeleme onu bir daha ezmez (KITAP-4'ün aynı yasası).

import type { ManualEquipmentRow } from "./sources";
import type { ManualTable } from "./types";

/** İnsan gücü — şablonun kendi açıklama çizelgesindeki kodlar. */
export const BAKIM_KISI = ["F", "E", "MA", "I"] as const;
export type BakimKisi = (typeof BAKIM_KISI)[number];

/** Zaman dilimi — şablonun çizelgesindeki kodlar, artan aralıkta. */
export const BAKIM_SIKLIK = ["d", "w", "2w", "m", "2m", "y", "2y"] as const;
export type BakimSiklik = (typeof BAKIM_SIKLIK)[number];

/**
 * Çalışma durumu — anlamları şablondaki açıklama çizelgesinde YAZILIDIR:
 *   R  = Vincin akımı ana şalterde kesikken
 *   AR = Akım alma baraları ve vincin akımı, ana şalter ve bara şalterinden kesikken
 *   LR = Vinç çalışır durumdayken
 * Kodlar burada ikinci kez TANIMLANMAZ, yalnız kullanılır.
 */
export const BAKIM_DURUM = ["R", "AR", "LR"] as const;
export type BakimDurum = (typeof BAKIM_DURUM)[number];

/** Bakım çizelgesinin altı sütunu — şablondaki başlıkların AYNISI. */
export const BAKIM_BASLIKLARI = [
  "No.",
  "Parça",
  "Görev",
  "Kişi",
  "Sıklık",
  "Çalışma Durumu",
] as const;

export interface MaintenanceRule {
  /** Kararlı kimlik; panel defteri bu kimlikle kod kuralının üzerine biner. */
  id: string;
  /**
   * Ekipman ADINA uyan desen (RegExp kaynağı, `i` bayrağıyla derlenir).
   * BOŞSA kural vincin kendisine aittir (çelik yapı, ray, etiket) ve ekipman
   * listesinden bağımsız olarak bir kez basılır.
   *
   * Desen STRING'dir çünkü panel defterinden de gelebilir; bozuk bir desen
   * düz metin araması olarak ele alınır — bir kuralın bozukluğu bütün
   * çizelgeyi düşüremez.
   */
  match?: string;
  part: string;
  task: string;
  person: BakimKisi;
  freq: BakimSiklik;
  state: BakimDurum;
  /** DAYANAK — belgeye basılmaz, defterde durur, testte okunur. */
  basis: string;
  /** Bu kaldırma grubundan İTİBAREN geçerli (ör. "M7"); boşsa hepsinde. */
  minGroup?: string;
  /** Panel defterinden kapatılan kod kuralı — çizelgeye girmez. */
  disabled?: boolean;
}

/**
 * KOD DEFTERİ.
 *
 * Sıra ÖNEMLİDİR: çizelge bu sırayı korur, böylece aynı vincin iki revizyonu
 * arasındaki fark okunabilir kalır. Yeni kural sona eklenir, araya değil.
 */
export const MAINTENANCE_RULE_BOOK: readonly MaintenanceRule[] = [
  // ————————————————————————————————————————— vincin kendisi (desensiz)
  {
    id: "gunlukKontrol",
    part: "Vinç geneli",
    task: "Kullanım öncesi görsel kontrol: acil stop, limit şalterleri, fren tutuşu, yağ kaçağı, gevşek cıvata",
    person: "F",
    freq: "d",
    state: "LR",
    basis: "ISO 12480-1 — vinçlerin güvenli kullanımı",
  },
  {
    id: "yapiKaynak",
    part: "Çelik yapı",
    task: "Ana kiriş ve başkiriş kaynak dikişlerini çatlak yönünden gözle muayene et",
    person: "I",
    freq: "y",
    state: "AR",
    basis: "ISO 9927-1 — kaynaklı yapının muayenesi",
  },
  {
    id: "civata",
    part: "Cıvatalı birleşimler",
    task: "Başkiriş–ana kiriş ve yürüyüş grubu cıvatalarının sıkma momentini kontrol et",
    person: "F",
    freq: "y",
    state: "AR",
    basis: "Üreticinin sıkma momenti çizelgesi",
  },
  {
    id: "korozyon",
    part: "Boya ve korozyon",
    task: "Boya hasarını ve korozyonu denetle; açılan yüzeyi temizleyip rötuş yap",
    person: "MA",
    freq: "y",
    state: "AR",
    basis: "İşletme deneyimi",
  },
  {
    id: "etiket",
    part: "Uyarı etiketleri ve kimlik plakaları",
    task: "Etiket ve plakaların okunurluğunu denetle; okunmayanı yenile",
    person: "I",
    freq: "2m",
    state: "AR",
    basis: "ISO 3864-2 — güvenlik işaretleri",
  },
  {
    id: "kalanOmur",
    part: "Kaldırma mekanizması",
    task: "Kalan servis ömrünü (SWP) kaydet ve değerlendir; sınıra yaklaşıldıysa genel revizyon planla",
    person: "I",
    freq: "y",
    state: "AR",
    basis: "ISO 12482 / FEM 9.755 — kalan servis ömrü",
  },
  {
    id: "ray",
    part: "Yürüyüş rayı",
    task: "Ray aşınmasını, ek boşluklarını, bağlantı elemanlarını ve açıklık sapmasını ölç",
    person: "I",
    freq: "y",
    state: "AR",
    basis: "ISO 9927-1 — periyodik muayene",
  },
  {
    id: "limitSivic",
    part: "Limit şalterleri",
    task: "Kaldırma üst/alt ve yürüyüş limitlerini fiilen deneyerek doğrula",
    person: "E",
    freq: "w",
    state: "LR",
    basis: "ISO 12480-1 — güvenlik donanımının denenmesi",
  },
  {
    id: "acilStop",
    part: "Acil stop devresi",
    task: "Bütün acil stop butonlarını tek tek dene; her biri bütün hareketleri kesmeli",
    person: "E",
    freq: "w",
    state: "LR",
    basis: "ISO 12480-1 — güvenlik donanımının denenmesi",
  },
  {
    id: "topraklama",
    part: "Elektrik tesisatı",
    task: "Topraklama sürekliliğini ve yalıtım direncini ölç, sonucu kaydet",
    person: "E",
    freq: "y",
    state: "AR",
    basis: "İşletme deneyimi",
  },

  // ——————————————————————————————————————————————————————— motor
  {
    id: "motorTemizlik",
    match: "^Motor$",
    part: "Motor",
    task: "Soğutma kanatlarını ve fan kapağını tozdan temizle",
    person: "E",
    freq: "2m",
    state: "AR",
    basis: "Motor üreticisinin kataloğu",
  },
  {
    id: "motorBaglanti",
    match: "^Motor$",
    part: "Motor",
    task: "Klemens bağlantılarının sıkılığını ve topraklamayı kontrol et",
    person: "E",
    freq: "y",
    state: "AR",
    basis: "Motor üreticisinin kataloğu",
  },
  {
    id: "motorYatak",
    match: "^Motor$",
    part: "Motor",
    task: "Yatak sesini ve titreşimi dinle; anormal seste yatağı değiştir",
    person: "MA",
    freq: "2m",
    state: "LR",
    basis: "İşletme deneyimi",
  },

  // —————————————————————————————————————————————————————— redüktör
  {
    id: "reduktorKacak",
    match: "^Redüktör$",
    part: "Redüktör",
    task: "Yağ seviyesini ve kaçak olup olmadığını kontrol et",
    person: "MA",
    freq: "w",
    state: "R",
    basis: "Redüktör üreticisinin kataloğu",
  },
  {
    id: "reduktorSes",
    match: "^Redüktör$",
    part: "Redüktör",
    task: "Dişli sesini ve gövde sıcaklığını kontrol et",
    person: "MA",
    freq: "m",
    state: "LR",
    basis: "İşletme deneyimi",
  },
  {
    id: "reduktorHavalik",
    match: "^Redüktör$",
    part: "Redüktör",
    task: "Havalık tapasını sök, temizle ve yerine tak",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "Redüktör üreticisinin kataloğu",
  },
  {
    id: "reduktorYagIlk",
    match: "^Redüktör$",
    part: "Redüktör",
    task: "İLK yağ değişimi — üreticinin verdiği ilk çalışma saatinde yapılır (yağ tipi yağlama tablosunda)",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "Redüktör üreticisinin kataloğu",
  },
  {
    id: "reduktorYag",
    match: "^Redüktör$",
    part: "Redüktör",
    task: "Periyodik yağ değişimi — üreticinin verdiği aralıkta (yağ tipi yağlama tablosunda)",
    person: "MA",
    freq: "2y",
    state: "AR",
    basis: "Redüktör üreticisinin kataloğu",
  },

  // ————————————————————————————————————————————————————————— fren
  {
    id: "frenBalata",
    match: "^Fren$",
    part: "Fren",
    task: "Balata kalınlığını ölç; üreticinin verdiği sınırın altındaysa değiştir",
    person: "MA",
    freq: "m",
    state: "AR",
    basis: "ISO 9927-1 — fren muayenesi",
  },
  {
    id: "frenHavaAraligi",
    match: "^Fren$",
    part: "Fren",
    task: "Hava aralığını ölç ve üreticinin değerine ayarla",
    person: "MA",
    freq: "m",
    state: "AR",
    basis: "Fren üreticisinin kataloğu",
  },
  {
    id: "frenKasnak",
    match: "^Fren$",
    part: "Fren",
    task: "Kasnak/diski aşınma, çatlak ve yağ bulaşmasına karşı kontrol et",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "ISO 9927-1 — fren muayenesi",
  },
  {
    id: "frenTest",
    match: "^Fren$",
    part: "Fren",
    task: "Anma yükünde tutma denemesi yap; kayma varsa devreye alma",
    person: "I",
    freq: "y",
    state: "LR",
    basis: "ISO 9927-1 — işlev denemesi",
  },

  // ———————————————————————————————————————————————————— çelik halat
  {
    id: "halatGunluk",
    match: "^Çelik halat$",
    part: "Çelik halat",
    task: "Görsel kontrol: kopan tel, ezilme, kuş kafesi, korozyon, yağsız bölge",
    person: "F",
    freq: "d",
    state: "R",
    basis: "ISO 4309 / DIN 15020 — halat muayenesi",
  },
  {
    id: "halatYag",
    match: "^Çelik halat$",
    part: "Çelik halat",
    task: "Halatı temizle ve halat yağıyla yağla",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "DIN 15020 — halat bakımı",
  },
  {
    id: "halatMuayene",
    match: "^Çelik halat$",
    part: "Çelik halat",
    task: "Ayrıntılı muayene: belirli uzunlukta kopan tel sayımı, çap ölçümü, hurdaya ayırma kıstaslarıyla karşılaştırma",
    person: "I",
    freq: "2m",
    state: "AR",
    basis: "ISO 4309 / DIN 15020 — hurdaya ayırma kıstasları",
  },
  {
    id: "halatMuayeneSik",
    match: "^Çelik halat$",
    part: "Çelik halat",
    task: "AĞIR HİZMET: ayrıntılı halat muayenesini ayda bir tekrarla",
    person: "I",
    freq: "m",
    state: "AR",
    basis: "ISO 4309 — kullanım sınıfına göre muayene sıklığı",
    minGroup: "M7",
  },
  {
    id: "halatSoket",
    match: "soket",
    part: "Halat soketi",
    task: "Soket dolgusunu, pimi ve emniyet elemanlarını kontrol et",
    person: "I",
    freq: "y",
    state: "AR",
    basis: "DIN 15020 — halat uç bağlantısı",
  },

  // ——————————————————————————————————————————————— tambur ve makara
  {
    id: "tamburYiv",
    match: "^Tambur$",
    part: "Tambur",
    task: "Yiv aşınmasını ölç; halat baskı plakası cıvatalarını sık",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "DIN 15020 — tambur ve halat sarımı",
  },
  {
    id: "tamburSarim",
    match: "^Tambur$",
    part: "Tambur",
    task: "En alt kanca konumunda tamburda en az iki emniyet sarımı kaldığını doğrula",
    person: "F",
    freq: "m",
    state: "AR",
    basis: "DIN 15020 — emniyet sarımı",
  },
  {
    id: "makaraDonme",
    match: "makara",
    part: "Makara",
    task: "Serbest dönmeyi, yiv aşınmasını ve halatın yandan kaçmadığını kontrol et",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "DIN 15020 — makara muayenesi",
  },

  // ————————————————————————————————————————————— rulman ve yataklar
  {
    id: "rulmanGres",
    match: "rulman|yatak",
    part: "Rulman / yatak",
    task: "Gres bas — gres tipi ve miktarı yağlama tablosundadır",
    person: "MA",
    freq: "m",
    state: "AR",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "rulmanSes",
    match: "rulman|yatak",
    part: "Rulman / yatak",
    task: "Ses ve sıcaklık kontrolü; boşluk artışını değerlendir",
    person: "MA",
    freq: "2m",
    state: "LR",
    basis: "İşletme deneyimi",
  },

  // ———————————————————————————————————————————————————————— kanca
  {
    id: "kancaEmniyet",
    match: "^Kanca$",
    part: "Kanca",
    task: "Emniyet mandalını ve kancanın serbest dönmesini kontrol et",
    person: "F",
    freq: "w",
    state: "R",
    basis: "ISO 9927-1 — kanca muayenesi",
  },
  {
    id: "kancaAgiz",
    match: "^Kanca$",
    part: "Kanca",
    task: "Ağız açıklığını ölç ve ilk ölçüyle karşılaştır; üreticinin verdiği sınırı aşan açılmada hurdaya ayır",
    person: "I",
    freq: "2m",
    state: "AR",
    basis: "DIN 15400 — kanca ölçüleri ve hurdaya ayırma",
  },
  {
    id: "kancaCatlak",
    match: "^Kanca$",
    part: "Kanca",
    task: "Çatlak muayenesi; şüphe hâlinde tahribatsız muayene uygula",
    person: "I",
    freq: "y",
    state: "AR",
    basis: "ISO 9927-1 — kanca muayenesi",
  },

  // ———————————————————————————————————————— tekerlek, tampon, kaplin
  {
    id: "tekerAsinma",
    match: "^Tekerlek$",
    part: "Tekerlek",
    task: "Bandaj aşınmasını ve flanş durumunu ölç",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "ISO 9927-1 — yürüyüş grubu muayenesi",
  },
  {
    id: "tekerTemas",
    match: "^Tekerlek$",
    part: "Tekerlek",
    task: "Ray üzerindeki temas izini ve kaymayı gözle; eğik aşınmada eksen ayarını denetle",
    person: "MA",
    freq: "m",
    state: "LR",
    basis: "İşletme deneyimi",
  },
  {
    id: "tamponHasar",
    match: "^Tampon$",
    part: "Tampon",
    task: "Deformasyon, çatlak ve bağlantı cıvatalarını kontrol et",
    person: "F",
    freq: "2m",
    state: "AR",
    basis: "ISO 9927-1 — tampon muayenesi",
  },
  {
    id: "kaplinElastik",
    match: "kaplin",
    part: "Kaplin",
    task: "Elastik elemanı ve cıvataları kontrol et; eksen kaçıklığını ölç",
    person: "MA",
    freq: "2m",
    state: "AR",
    basis: "Kaplin üreticisinin kataloğu",
  },

  // ————————————————————————————————————————————— elektrik ve kabin
  {
    id: "panoTemizlik",
    match: "pano",
    part: "Elektrik panosu",
    task: "Panoyu tozdan temizle; klemens sıkılığını, fan ve filtreyi kontrol et",
    person: "E",
    freq: "2m",
    state: "AR",
    basis: "İşletme deneyimi",
  },
  {
    id: "feston",
    match: "feston",
    part: "Feston kablo taşıyıcı",
    task: "Taşıyıcı arabaları, kabloyu, askı elemanlarını ve ray temizliğini kontrol et",
    person: "E",
    freq: "2m",
    state: "AR",
    basis: "İşletme deneyimi",
  },
  {
    id: "kabin",
    match: "kabin",
    part: "Operatör kabini",
    task: "Cam, kapı kilidi, koltuk, kumanda organları, aydınlatma ve yangın söndürücüyü kontrol et",
    person: "F",
    freq: "m",
    state: "AR",
    basis: "ISO 12480-1 — operatör çalışma yeri",
  },
  {
    id: "loadcell",
    match: "yük hücresi|loadcell",
    part: "Aşırı yük sınırlayıcı",
    task: "Sınırlayıcıyı deneyerek doğrula ve kalibrasyonunu kaydet",
    person: "I",
    freq: "y",
    state: "LR",
    basis: "ISO 9927-1 — güvenlik donanımının denenmesi",
  },
];

// —————————————————————————————————————————————————————— birleştirme

/**
 * KOD DEFTERİ + PANEL DEFTERİ.
 *
 * Aynı `id`yi taşıyan panel satırı kod kuralının ÜZERİNE BİNER; `disabled`
 * ise kural çizelgeden düşer. Yeni `id` ek kuraldır ve sona eklenir — araya
 * girseydi iki revizyon arasındaki fark okunamaz olurdu.
 *
 * BİRLEŞTİRME TEK YERDEDİR: ekran, PDF ve yayım dondurması aynı fonksiyonu
 * çağırır, yoksa panelde kapatılan bir kural bir yerde basılmaya devam ederdi.
 */
export function mergeMaintenanceRules(
  book: readonly MaintenanceRule[],
  overlay: readonly MaintenanceRule[]
): MaintenanceRule[] {
  const harita = new Map<string, MaintenanceRule>();
  for (const r of book) harita.set(r.id, r);
  const ekler: MaintenanceRule[] = [];
  for (const o of overlay) {
    if (harita.has(o.id)) harita.set(o.id, { ...harita.get(o.id)!, ...o });
    else ekler.push(o);
  }
  return [...harita.values(), ...ekler].filter((r) => !r.disabled);
}

// ————————————————————————————————————————————————————————— çizelge

/** FEM/ISO grup kodunun sırası; tanınmayan kod `null` (kural atlanmaz). */
function grupSirasi(kod: string | undefined): number | null {
  const m = /^[MA](\d)$/i.exec((kod ?? "").trim());
  return m ? Number(m[1]) : null;
}

/**
 * Deseni derler. BOZUK DESEN DÜZ METİN ARAMASIDIR: panel defterinden gelen
 * bir hata bütün çizelgeyi düşüremez (KITAP-2'nin "belge düşmez" ilkesi).
 */
function desenUyar(match: string, ad: string): boolean {
  try {
    return new RegExp(match, "i").test(ad);
  } catch {
    return ad.toLocaleLowerCase("tr").includes(match.toLocaleLowerCase("tr"));
  }
}

export interface MaintenanceScheduleOptions {
  /** Kaldırma mekanizması grubu ("M7"); `minGroup` kuralları bunu okur. */
  hoistGroup?: string;
  /** Birleştirilmiş kural listesi; verilmezse kod defteri kullanılır. */
  rules?: readonly MaintenanceRule[];
}

/**
 * BAKIM ÇİZELGESİNİ ÜRETİR.
 *
 * Desensiz kurallar önce ("Genel"), sonra ekipman listesindeki GRUP SIRASIYLA
 * o gruba düşen kurallar. Sıra kaynağın sırasıdır: çizelgeyi okuyan mühendis
 * ekipman listesinde gördüğü düzeni burada da bulur.
 *
 * AYNI GRUPTA AYNI PARÇADAN BİRDEN ÇOK VARSA TEK SATIR ÜRETİLİR: dört
 * tekerlek için dört özdeş "bandaj aşınmasını ölç" satırı çizelgeyi uzatır
 * ama hiçbir şey söylemez. Adet ekipman listesindedir.
 *
 * SEÇENEK SATIRLARI ÇİZELGEYE GİRMEZ: alternatif ekipman TAKILI DEĞİLDİR ve
 * takılmamış bir redüktörün yağını değiştirmek diye bir görev yoktur.
 */
export function maintenanceScheduleTable(
  equipment: readonly ManualEquipmentRow[],
  opts: MaintenanceScheduleOptions = {}
): ManualTable {
  const kurallar = opts.rules ?? MAINTENANCE_RULE_BOOK;
  const vincGrubu = grupSirasi(opts.hoistGroup);

  const gecerli = (r: MaintenanceRule): boolean => {
    if (!r.minGroup) return true;
    const esik = grupSirasi(r.minGroup);
    if (esik === null || vincGrubu === null) return false;
    return vincGrubu >= esik;
  };

  const takili = equipment.filter((r) => !r.alternative);
  const rows: string[][] = [];

  // ——— Genel: desensiz kurallar
  const genel = kurallar.filter((r) => !r.match && gecerli(r));
  genel.forEach((r, i) => {
    rows.push([`1.${i + 1}`, r.part, r.task, r.person, r.freq, r.state]);
  });

  // ——— Ekipman grupları, kaynağın sırasıyla
  const gruplar: string[] = [];
  for (const e of takili) if (!gruplar.includes(e.group)) gruplar.push(e.group);

  let grupNo = genel.length > 0 ? 1 : 0;
  for (const grup of gruplar) {
    const parcalar = takili.filter((e) => e.group === grup);
    const grupSatirlari: string[][] = [];
    for (const r of kurallar) {
      if (!r.match || !gecerli(r)) continue;
      const uyan = parcalar.filter((e) => desenUyar(r.match!, e.component));
      if (uyan.length === 0) continue;
      // Parça adı KAYNAKTAN gelir, kuralın `part` alanından değil: kural
      // "Rulman / yatak" der, vinçte o parça "Tambur rulman yatağı"dır ve
      // bakımı yapacak kişi listede o adı arayacaktır.
      const adlar: string[] = [];
      for (const e of uyan) if (!adlar.includes(e.component)) adlar.push(e.component);
      for (const ad of adlar) {
        grupSatirlari.push(["", ad, r.task, r.person, r.freq, r.state]);
      }
    }
    if (grupSatirlari.length === 0) continue;
    grupNo += 1;
    grupSatirlari.forEach((satir, i) => {
      satir[0] = `${grupNo}.${i + 1}`;
      satir[1] = `${grup} · ${satir[1]}`;
      rows.push(satir);
    });
  }

  return {
    head: [...BAKIM_BASLIKLARI],
    rows,
    caption:
      "Çizelge ekipman listesinden üretilir. Kısaltmalar bu bölümün açıklama tablosundadır; vince özel görevleri satır ekleyerek tamamlayın.",
  };
}
