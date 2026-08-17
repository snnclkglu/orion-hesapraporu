// TEKLİF DEFTERİNİN SEED MİGRATION'INI ÜRETİR.
//
//     npx tsx scripts/gen-offer-seed.ts
//     → supabase/migrations/20260819000007_offer_options_seed_v2.sql
//
// ÜRETİLEN DOSYA ELLE DÜZENLENMEZ; ikinci koşuda bayt bayt aynı çıkar
// (`generate-raw-purchase-import.mjs` ile aynı kural).
//
// NEDEN BETİK: `match_key` katlanmış anahtardır ve katlamayı YALNIZ TypeScript
// bilir. Postgres'in `upper()`ı Türkçe farkında değildir ("İSDEMİR" → "ISDEMIR"
// olur, "SİBRE" → "SIBRE" beklenirken) ve `trKatla` ayrıca i ailesinin dördünü
// tek harfe indirir. Anahtarı SQL'de hesaplamak, defterdeki tekilliği koddaki
// tekillikten AYIRIRDI (`terms.test.ts` deseninin kaçındığı şey).
//
// VERİNİN KAYNAĞI: firmanın 2026'da verdiği on dört teklifin METNİ ve
// uygulamanın kendi katalog/sabit defterleri. UYDURULMUŞ DEĞER YOKTUR
// (değişmez md. 4) — bir seçenek burada varsa gerçek bir belgede geçmiştir.
// Bu yüzden bazı listeler TEK maddeliktir ve bazıları (garanti) BOŞTUR:
// devralınan tekliflerin hiçbirinde garanti maddesi yok. Listeler KAPALI
// DEĞİLDİR; kullanıcı yazdığı değeri tek tıkla deftere ekler.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { trKatla } from "../src/lib/drawings/tr-text";

type Liste = { key: string; degerler: string[] };

/** `bas`tan `bit`e `adim` aralıklı tam sayı dizisi (iki uç DÂHİL). */
function seri(bas: number, bit: number, adim: number): number[] {
  const out: number[] = [];
  if (adim === 0) return out;
  for (let v = bas; adim > 0 ? v <= bit : v >= bit; v += adim) out.push(v);
  return out;
}

/**
 * IEC standart motor güçleri (kW) — 0,25'ten 500'e.
 *
 * Seri IEC 60072'nin anma güçleridir; ondalık ayıraç TÜRKÇEDİR (virgül) çünkü
 * değer doğrudan belgeye basılır ve firmanın bütün tekliflerinde öyle yazıyor.
 */
const MOTOR_GUCLERI = [
  "0,25", "0,37", "0,55", "0,75", "1,1", "1,5", "2,2", "3", "4", "5,5", "7,5",
  "11", "15", "18,5", "22", "30", "37", "45", "55", "75", "90", "110", "132",
  "160", "200", "250", "315", "355", "400", "450", "500",
];

/**
 * Sürücü (frekans invertörü) anma güçleri (kW).
 *
 * Kaynak firmanın kullandığı iki seridir: Schneider ATV-320 (0,37–15 kW) ve
 * ATV-340 (0,75–75 kW), ABB ACS880 üst kademeleriyle birlikte. Motor serisiyle
 * AYNI DEĞİLDİR — sürücü katalogları 0,25 kW'ı taşımaz ve üst uçta daha seyrek
 * kademelenir.
 */
const SURUCU_GUCLERI = [
  "0,37", "0,55", "0,75", "1,1", "1,5", "2,2", "3", "4", "5,5", "7,5", "11",
  "15", "18,5", "22", "30", "37", "45", "55", "75", "90", "110", "132", "160",
  "200", "250", "315", "355", "400", "500",
];
type Kademeli = { key: string; parentKey: string; cocuklar: Record<string, string[]> };

// ————————————————————————————————————————————————————————— MARKALAR

const MARKALAR: Liste[] = [
  // Tekliflerde geçenler + `cat_equipment` kataloğundaki gerçek markalar.
  { key: "brand.motor", degerler: ["GAMAK", "ELK", "ABB", "SIEMENS", "SEW-EURODRIVE", "INNOMOTICS"] },
  { key: "brand.gearbox", degerler: ["YILMAZ R.", "FLENDER", "SEW-EURODRIVE", "SIEMENS", "POLAT (PGR)", "ROSSI"] },
  { key: "brand.brake", degerler: ["SIBRE", "DERELİ", "GALVI NEWCOMEN"] },
  // Sürücü kataloğu YOKTUR; bu liste tamamen tekliflerden ve uygulamanın
  // sürücü atık ısısı tablosundan (ABB ACS880, `drive-losses.ts`) gelir.
  { key: "brand.drive", degerler: ["SCHNEIDER", "VEIOKONG", "SIEMENS", "ABB"] },
  { key: "brand.bearing", degerler: ["SKF"] },
  { key: "brand.pendant", degerler: ["Elfatek"] },
  { key: "brand.limit", degerler: ["Stromag", "Crosslimit", "Terr"] },
  { key: "brand.trafo", degerler: ["Eka"] },
  { key: "brand.powerSupply", degerler: ["Omron", "Phoenix"] },
  { key: "brand.terminal", degerler: ["Phoenix"] },
  { key: "brand.loadcell", degerler: ["Esit", "Kobastar", "Elfatek"] },
  { key: "brand.signalization", degerler: ["Mucco"] },
  { key: "brand.cable", degerler: ["Üntel", "Helukabel"] },
  { key: "brand.resistor", degerler: ["Ressa"] },
  { key: "brand.switchgear", degerler: ["Schneider", "Siemens"] },
  { key: "brand.panel", degerler: ["EAE", "TEMPA"] },
  { key: "brand.busbar", degerler: ["Vasel", "Conductix-Wampfler"] },
];

const KADEMELI: Kademeli[] = [
  {
    key: "series.gearbox",
    parentKey: "brand.gearbox",
    cocuklar: {
      // Tekliflerde geçen yazımlar + katalogdaki seri kodları.
      "YILMAZ R.": ["VR Tipi", "HT Tipi", "HT Sandık Tipi", "DR Tipi", "KR Tipi", "M Tipi", "Planet R."],
      FLENDER: ["B2", "B3", "B4", "H1", "H2", "H3", "H4"],
      "SEW-EURODRIVE": ["R", "F", "K", "S", "W", "X"],
      SIEMENS: ["SIMOGEAR"],
      "POLAT (PGR)": ["PCS"],
    },
  },
  {
    key: "series.drive",
    parentKey: "brand.drive",
    cocuklar: {
      SCHNEIDER: ["ATV-320", "ATV-340"],
      ABB: ["ACS880"],
    },
  },
  {
    key: "series.pendant",
    parentKey: "brand.pendant",
    cocuklar: { Elfatek: ["EN-MİD Serisi"] },
  },
];

// ———————————————————————————————————————————————— TEKNİK DEĞER LİSTELERİ

const TEKNIK: Liste[] = [
  {
    key: "val.reeving",
    degerler: ["2/1", "4/1", "4/2", "8/2", "12/2", "16/2", "16/4", "20/2", "20/4", "24/4"],
  },
  { key: "val.speedControl", degerler: ["Çift Hız Kontrolü (Frekans İnvertörlü)", "Frekans İnvertörlü"] },
  { key: "val.controlType", degerler: ["İnvertör Kontrollü"] },
  {
    key: "val.hook",
    // İlk madde tekliflerin tamamında geçen yazımdır; kalanlar uygulamanın
    // kendi kanca tipi defterinden (`calc/fields.ts` HOOK_TYPES) gelir.
    degerler: [
      "DIN 15401/P Tek Ağızlı Kanca",
      "DIN 15402 Çift Ağızlı Kanca",
      "Kaldırma Kirişi (Spreader)",
      "Polip",
      "Mekanik Kepçe",
      "Motorlu Kepçe",
      "C Kancası",
    ],
  },
  { key: "val.ropeConstruction", degerler: ["6x36"] },
  { key: "val.ropeGrade", degerler: ["1770 N/mm2", "1960 N/mm2"] },
  { key: "val.ropeCore", degerler: ["Kendir Özlü", "Çelik Özlü"] },
  {
    key: "val.brakeType",
    degerler: [
      "Kasnak Fren",
      "Elektrohidrolik Kasnak Fren",
      "Elektromanyetik Motor Freni",
      "Elektromanyetik Fren Soğutmalı",
    ],
  },
  { key: "val.safetyBrake", degerler: ["Emniyet Freni"] },
  { key: "val.gearboxMounting", degerler: ["Paralel Şaft", "Delik Milli", "Helisel Dişli", "Sandık Tipi"] },
  { key: "val.wheelStandard", degerler: ["DIN15090"] },
  { key: "val.wheelMaterial", degerler: ["C4140 35-42 HRC", "CK45"] },
  {
    key: "val.driveSystem",
    degerler: ["2 Tekerden Tahrik", "4 Tekerden Tahrik", "8 Tekerden Tahrik"],
  },
  {
    key: "val.travelSystem",
    degerler: ["4 Teker", "8 Teker", "8 Teker, 4 Boji", "16 Teker, 8 Boji, 4 Ekolayzır"],
  },
  {
    key: "val.rail",
    // Tekliflerde geçen yazımlar + `cat_rails` defterindeki ray kodları.
    degerler: [
      "40x30 Ray",
      "60x40 Dikdörtgen Ray",
      "A45",
      "A55",
      "A65",
      "A75",
      "A100",
      "A120",
      "A150",
      "S46",
      "Mevcut Ray",
      "Müşteri Kapsamında",
    ],
  },
  {
    // TEK BİÇİM (kullanıcı isteği, 17.08.2026: *"Vinç sınıfları düzgün değil,
    // tek tipte olsun. FEM 2m / ISO M5 şeklinde yazsa yeterli. 1Am'den 5m'e
    // kadar olsun."*). Devralınan tekliflerde aynı sınıf üç ayrı kuyrukla
    // (`- ISO/FEM A5 H2/B3`, `H3/B4`, kuyruksuz) yazılmıştı; liste bu yüzden
    // yedi maddeyken gerçekte beş sınıf vardı.
    key: "val.craneClass",
    degerler: [
      "FEM 1Am / ISO M4",
      "FEM 2m / ISO M5",
      "FEM 3m / ISO M6",
      "FEM 4m / ISO M7",
      "FEM 5m / ISO M8",
    ],
  },
  {
    key: "val.craneType",
    // Uygulamanın kendi vinç tipi defteri (`crane-types.ts`) + tekliflerde
    // geçen ve o defterde olmayan ürünler (kaldırma kirişi, araba, kabin).
    degerler: [
      "Çift Kirişli Gezer Köprülü Vinç",
      "Tek Kirişli Gezer Köprülü Vinç",
      "Monoray Vinç",
      "Şarj / Döküm Vinci",
      "Portal Vinç",
      "Çift Kirişli Gezer Köprülü Portal Vinç",
      "Yarı Portal Vinç",
      "Pergel Vinç",
      "Alttan Askılı Vinç",
      "Konsol Vinç",
      "Rıhtım / Liman Vinci",
      "Kaldırma Kirişi",
      "Vinç Arabası",
      "Operatör Kabini",
    ],
  },
  { key: "val.environmentPlace", degerler: ["Kapalı Alan", "Açık Alan", "Kapalı / Açık Alan"] },
  // SICAKLIK MİN VE MAKS AYRI (kullanıcı isteği): min 0'dan -30'a beşer azalır,
  // maks 40'tan 80'e beşer artar. Önceden eşleştirilmiş aralık listesi, gerçekte
  // bağımsız olan iki kararı birbirine bağlıyordu (-10/+50 varken -5/+50 yoktu).
  { key: "val.tempMin", degerler: seri(0, -30, -5).map((n) => (n > 0 ? `+${n}` : `${n}`)) },
  { key: "val.tempMax", degerler: seri(40, 80, 5).map((n) => `+${n}`) },
  // MOTOR GÜÇLERİ — IEC standart serisi (0,25 kW'tan 500 kW'a). Liste kapalı
  // değildir; seri dışı bir motor yazılıp deftere eklenebilir.
  { key: "val.motorPower", degerler: MOTOR_GUCLERI },
  { key: "val.motorRpm", degerler: ["750", "1000", "1500", "3000"] },
  // SÜRÜCÜ GÜÇLERİ motor serisiyle AYNI değildir: sürücü kataloglarının anma
  // güçleri motorunkinden bir kademe seyrektir ve 0,37 kW'tan başlar.
  { key: "val.drivePower", degerler: SURUCU_GUCLERI },
  // TEKER ÇAPLARI — FEM serisi (200…1250) + firmanın küçük vinçlerde kullandığı
  // dört küçük çap (kullanıcı isteği: *"buna biz çap 80 100 120 ve 150 de
  // ekleyelim"*).
  {
    key: "val.wheelDia",
    degerler: ["80", "100", "120", "150", "200", "250", "315", "400", "500", "630", "710", "800", "900", "1000", "1120", "1250"],
  },
  // HALAT ÇAPLARI — devralınan tekliflerde geçen çaplar ve aradaki standart
  // kademeler.
  {
    key: "val.ropeDia",
    degerler: ["8", "10", "12", "14", "16", "18", "20", "22", "24", "26", "28", "30", "32", "36"],
  },
  {
    key: "val.girder",
    degerler: [
      "Kutu Çelik Konstrüksiyon",
      "Kutu Çelik Konstrüksiyon, St52",
      "Kutu Çelik Konstrüksiyon, St52/St44",
      "Çelik Konstrüksiyon",
    ],
  },
  {
    key: "val.girderCalc",
    degerler: [
      "FEM / DIN15018 - 1/1000 Maksimum Sehim",
      "FEM / DIN15018 - 1/1000 (M6) Maksimum Sehim",
      "1/250 Maksimum Sehim",
    ],
  },
  { key: "val.steelGrade", degerler: ["S355JR", "St52", "St44/St52", "St52 / St44"] },
  { key: "val.platform", degerler: ["Tek Taraflı Yürüme Platformu", "Çift Taraflı Yürüme Platformu", "Yok"] },
  {
    key: "val.paint",
    degerler: [
      "Kumlama + Astar + Son Kat, Renk : RAL1007 Sarı",
      "RAL 1007",
      "RAL 1007 Turuncu",
      "Isıya Dayanıklı Boya, RAL : 1018",
    ],
  },
  { key: "val.supplyVoltage", degerler: ["400 VAC 50 Hz", "380 VAC", "220 VAC"] },
  { key: "val.controlVoltage", degerler: ["220 – 24 VDC", "220 VAC", "24 VDC", "48 VDC", "110 VAC"] },
  {
    key: "val.runwayPower",
    degerler: ["Müşteri Kapsamında", "Kapalı Bara", "Kapalı Kutu Bara (Opsiyonel)", "Hariç"],
  },
  { key: "val.scope", degerler: ["Orion Kapsamında", "Müşteri Kapsamında", "Dahil", "Hariç", "Opsiyonel"] },
  { key: "val.testDynamic", degerler: ["Q x 1,1"] },
  { key: "val.testStatic", degerler: ["Q x 1,25"] },
  { key: "val.priceUnit", degerler: ["Takım", "Adet", "Kişi", "Metre", "Gün"] },
];

// ———————————————————————————————————————————————————— TİCARİ ŞARTLAR

const TICARI: Liste[] = [
  // GEÇERLİLİK: on dört teklifin on dördünde aynı değer. Liste tek maddeliktir
  // ve uydurma bir "30 gün" eklenmemiştir — kullanıcı gerekirse yazıp ekler.
  { key: "term.validity", degerler: ["14 iş günü"] },
  // TESLİM SÜRESİ ARTIK PARÇALI SEÇİLİR (kullanıcı isteği): hazır cümle listesi
  // her yeni aralık için deftere bir madde daha yazdırıyordu. Üç küçük liste
  // aynı cümleyi sınırsız üretir.
  {
    key: "term.deliveryTrigger",
    degerler: [
      "Avans Ödemesi Sonrası",
      "Sipariş Onayı Sonrası",
      "Sözleşme İmzalanması Sonrası",
    ],
  },
  { key: "val.deliveryWeeks", degerler: seri(4, 30, 1).map(String) },
  { key: "val.deliveryUnit", degerler: ["Hafta", "Ay"] },
  { key: "term.freight", degerler: ["Dahil", "Hariç"] },
  {
    key: "term.erection",
    degerler: ["Vinçlerin yerine montajı ve devreye alınması dahildir.", "Hariç"],
  },
  {
    key: "term.deliveryPlace",
    degerler: [
      "Yerinde çalışır halde teslim",
      "Ankara, Başkent OSB.",
      "Ankara Başkent OSB., Orion Vinç Fabrika",
      "Ankara Fabrika",
      "Proje gönderimi",
    ],
  },
  // GARANTİ ARTIK VARSAYILANLI (kullanıcı kararı, 17.08.2026: *"Garanti
  // standart 2 yıl olarak gelsin. Elle düzeltirim eğer müşteri uzatma
  // isterse."*). Devralınan on dört teklifin hiçbirinde garanti maddesi YOKTU
  // ve liste bu yüzden boş başlamıştı; değer artık bir bulgudan değil bir FİRMA
  // KARARINDAN geliyor.
  { key: "term.warranty", degerler: ["2 Yıl", "1 Yıl", "3 Yıl"] },
  {
    key: "term.paymentHeader",
    degerler: [
      "KDV Dahil ödeme şekli aşağıda belirtilen şekildedir.",
      "Ödeme şekli aşağıda belirtilen şekildedir.",
      "Teslimde Nakit",
    ],
  },
  {
    key: "term.paymentLine",
    degerler: [
      "%40 Avans Sipariş ile Nakit",
      "%50 Avans Sipariş ile Nakit",
      "%30 Avans Sipariş ile Nakit",
      "%60 Teslimat Sonrası Nakit",
      "%60 Teslimat Sonrası Nakit (Fatura + 30 Gün)",
      "%60 Sevk ile Nakit",
      "%50 Nakit Sevk Öncesi",
      "Sevk Öncesi %30 Nakit",
      "Devreye Alma Sonrası %30 Nakit",
      "Her vinç teslimatı sonrası %60 Nakit",
      "Montaj Sonrası Kalan Nakit",
      "%50 Detay Projeler Tamamlandığında Nakit",
      "Teslim + 30 Gün Nakit",
      "Teslimde Nakit",
    ],
  },
  {
    key: "term.note",
    degerler: [
      "Belirtilen fiyatlara KDV dahil değildir.",
      "Teklif fiyatına hiçbir yurtiçi vergi, harç, pul avans damga vergisi, banka komisyonu ve masrafları v.b. dahil değildir.",
      "Malzemenin kısmen veya tamamen alınması firmamız dışındaki nedenlerden ötürü (inşaat işlerinin tamamlanmaması, nakliye alıcıya ait ise araç bulunamaması v.b.) gecikmesi halinde malzemenin sevkiyata hazır olduğunun müşteriye bildirilmesini takiben 5 gün içerisinde ödeme koşulları aynen devam edecektir.",
      "Teslim sonrası vincin tüm imalat projeleri dwg. formatında paylaşılacaktır.",
      "Elektrik projelendirme ve tasarım dahil değildir.",
    ],
  },
  {
    key: "term.exclusion",
    degerler: [
      "Vincin montaj sahasında gerekli olan tüm inşaat işleri",
      "Köprü rayı ve hol bara montajı",
      "Hol boyu bara tesisatı ve besleme",
      "Nakliye",
      "Nakliye ve Montaj",
      "Montajda kullanılacak mobil ve sepetli vinçler",
      "Montaj için yatay ve düşey hareketleri sağlayacak gerekli sayı ve kapasitedeki montaj vinci sağlanması",
      "Sahaya gelen malzemelerin boşaltılması ve depolanması",
      "Test için gerekli uygun yük temini ve bu yükün bağlanması için gereken ekipmanlar",
      "Sahada ihtiyaç duyulacak her türlü enerji temini",
      "Vinç barası",
      "Vinç üzeri enerji besleme noktasına kadar gerekli kesit ve miktarda kablo bağlantısı sağlanması",
      "Kabin montaj sahasında gerekli olan tüm inşaat işleri",
      "Kabin montajı",
    ],
  },
];

const KAPAK: Liste[] = [
  { key: "cover.honorific", degerler: ["Bey,", "Hanım,"] },
  {
    key: "cover.intro",
    // Devralınan belgelerde bu cümlenin bir de "olduğun" yazımı var; o bir
    // YAZIM HATASIDIR, bir seçenek değil — deftere doğrusu girer.
    degerler: [
      "Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.",
    ],
  },
];

/** Yeni teklifte kendiliğinden seçilen değerler. */
const VARSAYILANLAR = new Set([
  "term.validity|14 iş günü",
  "term.warranty|2 Yıl",
  "term.deliveryTrigger|Avans Ödemesi Sonrası",
  "val.deliveryUnit|Hafta",
  "val.testDynamic|Q x 1,1",
  "val.testStatic|Q x 1,25",
  "cover.intro|Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.",
]);

// ————————————————————————————————————————————————————————— ŞABLONLAR

const SABLONLAR: { name: string; craneType: string; groupKeys: string[] }[] = [
  {
    name: "Çift Kirişli Gezer Köprülü Vinç",
    craneType: "Çift Kirişli Gezer Köprülü Vinç",
    groupKeys: ["general", "mainHoist", "trolley", "bridge", "steel", "electrical"],
  },
  {
    name: "Çift Kirişli Vinç — Yardımcı Kaldırmalı",
    craneType: "Çift Kirişli Gezer Köprülü Vinç",
    groupKeys: ["general", "mainHoist", "auxHoist", "trolley", "bridge", "steel", "electrical"],
  },
  {
    name: "Tek Kirişli / Monoray Vinç",
    craneType: "Monoray Vinç",
    groupKeys: ["general", "mainHoist", "trolley", "steel", "electrical"],
  },
  {
    name: "Portal Vinç",
    craneType: "Portal Vinç",
    groupKeys: ["general", "mainHoist", "trolley", "gantry", "steel", "electrical"],
  },
  {
    name: "Pergel Vinç",
    craneType: "Pergel Vinç",
    groupKeys: ["general", "mainHoist", "trolley", "boom", "steel", "electrical"],
  },
  {
    name: "Vinç Arabası",
    craneType: "Vinç Arabası",
    groupKeys: ["general", "mainHoist", "auxHoist", "trolley", "steel", "electrical"],
  },
  { name: "Kaldırma Kirişi", craneType: "Kaldırma Kirişi", groupKeys: ["general", "steel"] },
  { name: "Operatör Kabini", craneType: "Operatör Kabini", groupKeys: ["general", "steel"] },
];

// ————————————————————————————————————————————————————————— üretim

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const satirlar: string[] = [];

function listeYaz(liste: Liste, baslik?: string) {
  if (baslik) satirlar.push(`-- ${baslik}`);
  if (liste.degerler.length === 0) {
    satirlar.push(`-- ${liste.key}: BOŞ (kaynak belgelerde karşılığı yok)`);
    return;
  }
  const values = liste.degerler
    .map((d, i) => {
      const varsayilan = VARSAYILANLAR.has(`${liste.key}|${d}`);
      return `  (${q(liste.key)}, ${q(d)}, ${q(trKatla(d))}, ${(i + 1) * 10}, ${varsayilan})`;
    })
    .join(",\n");
  satirlar.push(
    `insert into public.offer_options (list_key, value, match_key, sort, is_default) values\n${values}\non conflict do nothing;`
  );
}

satirlar.push(`-- TEKLİF DEFTERİ — SEED (ÜRETİLMİŞ DOSYA, ELLE DÜZENLENMEZ)
--
--     npx tsx scripts/gen-offer-seed.ts
--
-- Kaynak: firmanın 2026'da verdiği on dört teklifin METNİ ve uygulamanın kendi
-- katalog/sabit defterleri. UYDURULMUŞ DEĞER YOKTUR (değişmez md. 4): bir
-- seçenek burada varsa gerçek bir belgede geçmiştir. Bu yüzden bazı listeler
-- tek maddelik, "Garanti" listesi ise BOŞTUR — devralınan tekliflerin hiçbirinde
-- garanti maddesi yok ve bir garanti süresi uydurmak, teklifte yapılabilecek en
-- pahalı hatadır.
--
-- LİSTELER KAPALI DEĞİLDİR: kullanıcı yazdığı değeri tek tıkla deftere ekler
-- (\`ensureOfferOption\`), tıpkı tedarikçi defterindeki gibi.
--
-- \`on conflict do nothing\`: seed iki kez uygulanırsa kullanıcının eklediği ya
-- da düzenlediği maddeler EZİLMEZ.`);

satirlar.push("\n-- ——————————————————————————————————————————————— MARKALAR");
for (const l of MARKALAR) listeYaz(l);

satirlar.push("\n-- ————————————————————————————— KADEMELİ LİSTELER (marka → tip/seri)");
for (const k of KADEMELI) {
  for (const [marka, seriler] of Object.entries(k.cocuklar)) {
    const values = seriler
      .map((s, i) => `  (${q(k.key)}, ${q(s)}, ${q(trKatla(s))}, ${(i + 1) * 10})`)
      .join(",\n");
    satirlar.push(`insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values\n${values}\n) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = ${q(k.parentKey)} and match_key = ${q(trKatla(marka))}
) p
on conflict do nothing;`);
  }
}

satirlar.push("\n-- ——————————————————————————————————————— TEKNİK DEĞER LİSTELERİ");
for (const l of TEKNIK) listeYaz(l);

satirlar.push("\n-- ————————————————————————————————————————————— TİCARİ ŞARTLAR");
for (const l of TICARI) listeYaz(l);

satirlar.push("\n-- ————————————————————————————————————————————— KAPAK METİNLERİ");
for (const l of KAPAK) listeYaz(l);

satirlar.push(`\n-- ——————————————————————————————————————————————————— ŞABLONLAR
-- İskelet yalnız GRUP ANAHTARLARINI taşır; satırlar defterden (\`registry.ts\`)
-- kurulur. Satırların kopyası buraya yazılsaydı defter her genişlediğinde
-- şablonlar eskir ve yeni alan hiçbir teklifte görünmezdi.`);

const sablonValues = SABLONLAR.map(
  (s, i) =>
    `  (${q(s.name)}, ${q(trKatla(s.name))}, ${q(s.craneType)}, ${q(
      JSON.stringify({ groupKeys: s.groupKeys })
    )}::jsonb, ${(i + 1) * 10})`
).join(",\n");

satirlar.push(
  `insert into public.offer_templates (name, match_key, crane_type, skeleton, sort) values\n${sablonValues}\non conflict do nothing;`
);

const cikti = `${satirlar.join("\n\n")}\n`;
const hedef = join(process.cwd(), "supabase", "migrations", "20260819000007_offer_options_seed_v2.sql");
writeFileSync(hedef, cikti, "utf8");

const toplam =
  MARKALAR.reduce((n, l) => n + l.degerler.length, 0) +
  KADEMELI.reduce((n, k) => n + Object.values(k.cocuklar).reduce((m, s) => m + s.length, 0), 0) +
  TEKNIK.reduce((n, l) => n + l.degerler.length, 0) +
  TICARI.reduce((n, l) => n + l.degerler.length, 0) +
  KAPAK.reduce((n, l) => n + l.degerler.length, 0);

process.stdout.write(`${hedef}\n${toplam} defter maddesi · ${SABLONLAR.length} şablon\n`);
