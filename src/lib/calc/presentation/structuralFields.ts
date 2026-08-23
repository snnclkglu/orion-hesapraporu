// Yapısal modüllerin (ana kiriş, buruşma, başkiriş) form alanı metadata'sı —
// UI formları bu tanımlardan üretilir. key'ler motor tiplerinin alan adlarıyla
// birebir aynıdır (bkz. fields.ts deseni).
//
// "…Override" ile biten alanlar normalde BOŞ bırakılır: değerleri teknik
// özelliklerden türetilir (yapı sınıfı → γc, kaldırma/yük sınıfı → H ve B
// bileşenleri). Alan doldurulduğunda türetme devre dışı kalır.

import type { FieldDef } from "../fields";
import type { BucklingInputs, BucklingPanelInputs } from "../modules/buckling";
import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import { RAIL_T_PROFILE_ON } from "../modules/mainGirder";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";

export const FATIGUE_MATERIALS = ["S235JR", "S355JR"] as const;
export const NOTCH_CLASSES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"] as const;
export const LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;
export const GIRDER_STATIC_MATERIALS = ["St37", "St44", "St52"] as const;
export const HOIST_CLASSES = ["H1", "H2", "H3", "H4"] as const;
export const RAIL_T_PROFILE_OPTIONS = ["Yok", RAIL_T_PROFILE_ON] as const;

/** Ana kiriş girdilerinde ray altı T profil anahtarı açık mı? */
function tProfileOn(inputs: Record<string, unknown>): boolean {
  return String(inputs.railTProfile ?? "").trim() === RAIL_T_PROFILE_ON;
}

// --- ANA KİRİŞ --------------------------------------------------------------

export const GIRDER_DEP_FIELDS: FieldDef<GirderDeps>[] = [
  { key: "mainHookBlockWeightKg", label: "Kanca Bloğu / Kepçe Ağırlığı", unit: "kg", type: "number" },
  { key: "mainRopeWeightKg", label: "Halat Ağırlığı", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba Ağırlığı", unit: "t", type: "number" },
  { key: "trolleyWheelCount", label: "Araba Teker Sayısı", type: "number" },
  { key: "trolleyDrivenWheels", label: "Araba Tahrikli Teker Sayısı", type: "number" },
  { key: "trolleyActualSpeedMpm", label: "Gerçekleşen Araba Hızı", unit: "m/dak", type: "number" },
  { key: "trolleyAccelTimeS", label: "Araba İvmelenme Süresi", unit: "s", type: "number" },
  { key: "bridgeWeightT", label: "Köprü Toplam Ağırlığı (Kirişler + Başkirişler)", unit: "t", type: "number" },
  { key: "bridgeWheelCount", label: "Köprü Teker Sayısı", type: "number" },
  { key: "bridgeDrivenWheels", label: "Köprü Tahrikli Teker Sayısı", type: "number" },
  { key: "bridgeActualSpeedMpm", label: "Gerçekleşen Köprü Hızı", unit: "m/dak", type: "number" },
  { key: "bridgeAccelTimeS", label: "Köprü İvmelenme Süresi", unit: "s", type: "number" },
];

/**
 * Bilgi notlarında iki kaynak türü BİLEREK ayrılır:
 * - "Standart dayanağı" yalnız kaynak maddede tanımlanan kuralı anlatır.
 * - "Kod kullanımı" ORION kesit/yük modelinin o değeri nerede kullandığını söyler.
 *
 * Böylece bir geometrik model kabulü, standart zorunluluğu gibi sunulmaz.
 */
const GIRDER_INPUT_INFO: Partial<Record<keyof GirderInputs & string, string>> = {
  railHeightMm:
    "Kod kullanımı — Rayın anma yüksekliğini kesit şemasında belgelemek için kullanılır. " +
    "Ray çelik sac kesitinin A, Cz, Cy, Iyy ve Izz hesabına bu ölçüyle katılmaz; kamber " +
    "ölü yükündeki ray kg/m değeri yürütme bölümünde seçilen ray kodundan ayrıca okunur.",
  t1Mm:
    "Kod kullanımı — Ray ekseninde ortalanan ray altı sacının kalınlığıdır; alan, ağırlık " +
    "merkezi ve iki eksendeki atalet hesabına girer. Ray altı T profil 'Var' seçilirse bu " +
    "sac iptal edilir, kayıtlı değer korunur fakat kesitte kullanılmaz.",
  b1Mm:
    "Kod kullanımı — Ray altı sacının genişliğidir ve merkezi kesit ortasında değil " +
    "ray ekseninde, y = x + t3/2 konumundadır. Bu eksantrik konum özellikle Cy ve Izz " +
    "hesabını etkiler; T profil açıkken b1 kesite girmez.",
  t2Mm:
    "Kod kullanımı — Kutu kesitin üst iç başlık kalınlığıdır; A, ağırlık, Iyy/Izz, " +
    "kesit modülleri ve kapalı kesit burulma hesabına girer. FEM 1.001 Ek A-3.4 " +
    "buruşma kontrolünde üst sac panel kalınlığı e olarak da kullanılır.",
  b2Mm:
    "Kod kullanımı — Üst iç başlığın nominal genişliği ve kesitin yatay referansıdır. " +
    "T profil yokken plakanın tamamı kullanılır; T profil varken plaka T üst sacının sağ " +
    "ucundan başlar ve yalnız kalan gerçek genişlik kesit özelliklerine girer.",
  railTProfile:
    "Kod kullanımı — Bu bir standart sınıfı değil, kesit topolojisi seçimidir. 'Var' " +
    "seçilip dört T ölçüsü de pozitif olduğunda t1/b1 iptal edilir, b2 T'nin sağ ucundan " +
    "başlatılır ve ana gövde t3, T yan sacının kapladığı boy kadar kısaltılır. Eksik ölçülü " +
    "yarım bir T profil sessizce hesaba katılmaz.",
  railTProfileTopThkMm:
    "Kod kullanımı — Rayın oturduğu T üst sacının kalınlığıdır. Sac ana kiriş üst " +
    "başlığıyla aynı kotta kabul edilir; alan, ağırlık merkezi ve ataletlere girer. Açık " +
    "bir eleman olduğu için kapalı kutunun Bredt burulma alanına eklenmez.",
  railTProfileTopWidthMm:
    "Kod kullanımı — Ray ekseninde ortalanan T üst sacının gerçek genişliğidir. b2 " +
    "plakasının nereden başlayacağını ve kesitin yataydaki en dış liflerini belirler; " +
    "bu nedenle Cy, Izz ve yatay kesit modüllerini etkiler.",
  railTProfileWebThkMm:
    "Kod kullanımı — Ray eksenindeki T profil düşey sacının kalınlığıdır. Alan ve " +
    "atalet hesabına, ayrıca ray altındaki birleşik düşey kesme alanına girer; açık T " +
    "profilin kapalı-kutu burulma ataletine katkısı sayılmaz.",
  railTProfileWebHeightMm:
    "Kod kullanımı — T düşey sacının üst sac altından aşağı inen boyudur. Ana gövde " +
    "sacı t3 aynı bölgede bu ölçü kadar kısalır; dış yardımcı gövde t4 tam boy kalır ve " +
    "kirişin toplam dış yüksekliği değişmez.",
  t3Mm:
    "Kod kullanımı — Ray altındaki ana gövde sacıdır; A, Iyy/Izz, kesme ve kapalı " +
    "kesit burulmasına girer. FEM 1.001 Ek A-3.4 yan sac buruşma panelinde kalınlık e " +
    "olarak kullanılır; teker basıncını taşıyan sac otomatiği de bu değeri izler.",
  h3Mm:
    "Kod kullanımı — Başlıklar arasındaki gövde bölgesinin nominal yüksekliğidir; " +
    "kesit yüksekliği, Iyy, kesme ve burulma geometrisini belirler. FEM 1.001 Ek A-3.4'te " +
    "boyuna berkitme yoksa yan sac panel genişliği olarak gövdenin tamamı kontrol edilir.",
  t4Mm:
    "Kod kullanımı — Kutunun raydan uzak yardımcı gövde sacı kalınlığıdır; kesit ve " +
    "kapalı-kutu burulma hesabına tam h3 yüksekliğiyle girer. T profil açılsa bile bu sac " +
    "kısaltılmaz; buruşmada ayrı yan paneli temsil eder.",
  t5Mm:
    "Kod kullanımı — Alt ana başlık kalınlığıdır; A, ağırlık merkezi, Iyy/Izz ve " +
    "Bredt kapalı-kutu burulma hesabına girer. Perde ağırlığı hesabında kutuyu oluşturan " +
    "t2/t3/t4/t5 saclarının en ince kalınlığından biri olarak değerlendirilir.",
  b5Mm:
    "Kod kullanımı — Alt ana başlığın genişliğidir. Plaka b2 nominal genişliği içinde " +
    "ortalanır; alan, Cy, Izz ve yatay kesit modüllerini etkiler.",
  t6Mm:
    "Kod kullanımı — Alt başlığın altında bulunan isteğe bağlı ek flanş kalınlığıdır. " +
    "Sıfırsa ek flanş yok sayılır; pozitifse A, ağırlık merkezi ve ataletlere girer fakat " +
    "kapalı kutu çeperi ve perde kalınlığı seçimine katılmaz.",
  b6Mm:
    "Kod kullanımı — Ek alt flanşın genişliğidir ve b2 içinde ortalanır. t6 sıfırsa " +
    "alan katkısı da sıfır olur; pozitif t6 ile Cy, Iyy/Izz ve kesit modüllerini etkiler.",
  aMm:
    "Kod kullanımı — İki gövde sacının karşılıklı yüzleri arasındaki net açıklıktır. " +
    "Kapalı kutunun burulma alanına, perde ölçüsüne ve FEM A-3.4 üst sac paneline girer. " +
    "CMAA 70 md. 3.5.1 L/b oranında kullanılan b de bu net gövde aralığıdır.",
  xMm:
    "Kod kullanımı — b2 plakasının sol referans kenarından ana gövde sacının dış " +
    "yüzüne yatay mesafedir. Ray ekseni y = x + t3/2 olarak kurulur; ray eksantrikliği " +
    "Cy, Izz ve burulma kolunu etkiler.",
  hookTopPositionM:
    "Standart dayanağı — FEM 1.001 Ek A-2.2.3/Şekil A.2.2.1 yatay ivme " +
    "etkisinde sarkaç periyodunu T1 = 2π√(l/g) ile kurar; l kancanın en üst " +
    "konumundaki askı boyudur.\n\nKod kullanımı — Otomatikte ilgili kaldırma yüksekliği " +
    "alınır; özel halat/kanca yerleşiminde gerçek askı boyu farklıysa otomatik kapatılır.",
  bridgeAxleSpacingM:
    "Standart dayanağı — FEM 1.001 md. 2.2.3.3 çapraz yürüyüş katsayısını " +
    "açıklık/dingil oranına bağlar.\n\nKod kullanımı — Bir raydaki ilk ve son köprü teker " +
    "eksenleri arasındaki boyuna mesafedir; otomatikte 6.1 teker ölçü zincirinin toplamı " +
    "alınır ve λK = clamp(0,025·L/a; 0,05…0,20) hesabında payda olur.",
  trolleyWheelSpacingM:
    "Kod kullanımı — Araba savrulma katsayısında kullanılan teker düzeni boyudur ve " +
    "λA = clamp(0,025·p/a; 0,05…0,20) bağıntısının payına girer. Değer, teknik " +
    "resimde bu tanıma karşılık gelen teker eksenleri arasından alınmalıdır; köprü " +
    "açıklığıyla karıştırılmaz.",
  trolleyAxleSpacingM:
    "Kod kullanımı — Arabanın yük doğrultusundaki dingil/teker eksen aralığıdır. " +
    "Savrulma katsayısında λA'nın paydasıdır; gerilme ve sehim modelinde iki teker " +
    "yükünün kiriş üzerindeki mesnetten uzaklığını ve birbirine olan aralığını da belirler.",
  psiHAOverride:
    "Standart dayanağı — FEM 1.001 Ek A-2.2.3/Şekil A.2.2.1, yatay ivmede " +
    "asılı yük ataletini ψh ile büyütür.\n\nKod kullanımı — Otomatikte μA = asılı hareketli " +
    "yük/araba kütlesi alınır; μ≤1 için 2, μ>1 için √(2+μ+1/μ) üst zarfı " +
    "kullanılır. Anahtar kapatılırsa bu kutudaki mühendis değeri hesabı ezer.",
  psiHKOverride:
    "Standart dayanağı — FEM 1.001 Ek A-2.2.3/Şekil A.2.2.1 yatay ivme " +
    "dinamik katsayısıdır.\n\nKod kullanımı — Köprü için μK = asılı hareketli yük / " +
    "(köprü + araba kütlesi) alınır; otomatik zarf ψhA ile aynıdır. Elle değer yalnız " +
    "otomatik kapatıldığında kullanılır.",
  amplifyYcOverride:
    "Standart dayanağı — FEM 1.001 Tablo T.2.3.4, Yükleme Durumu I/II " +
    "kombinasyonlarında yapı sınıfına bağlı γc arttırma katsayısını verir.\n\n" +
    "Kod kullanımı — Otomatikte teknik özellikteki A1…A8 yapı sınıfından okunur; " +
    "anahtar kapatıldığında bu kutudaki değer yük bileşimi katsayısını doğrudan değiştirir.",
  dynTestFactorR1:
    "Standart dayanağı — FEM 1.001 md. 2.3.3(c) ve Kitapçık 8 md. 8.1.1: " +
    "dinamik test birleşiminde SG + ψ·ρ1·SL kullanılır; standart asgari ρ1 = 1,20 verir. " +
    "Kod, dinamik ve statik test birleşimlerinden elverişsiz olanı Durum III için seçer.",
  statTestFactorR2:
    "Standart dayanağı — FEM 1.001 md. 2.3.3(c) ve Kitapçık 8 md. 8.1.2: " +
    "statik test birleşiminde SG + ρ2·SL kullanılır; standart asgari ρ2 = 1,40 verir. " +
    "Ulusal mevzuat veya sözleşme daha yüksek değer istiyorsa bu kutudan girilir.",
  railLeverCMm:
    "Kod kullanımı — Ray ekseninden kirişin esas aktarım/kayma merkezine kabul edilen " +
    "yatay moment koludur. Araba yürütme yatay kuvveti için yerel moment M6 = c·HA " +
    "hesabına girer; genel kesit ölçüsü değildir, detay yerleşiminden alınmalıdır.",
  diaphragmSpacingMm:
    "Standart/kod ayrımı — FEM 1.001 Ek A-3.4'te plaka panel uzunluğu, mesnetli " +
    "kenarlar yani perdeler arasındaki a mesafesidir. ORION aynı değeri yerel ikincil " +
    "eğilme hesabında ve kamber imalat kotlarının/perde adedinin istasyon aralığında da " +
    "kullanır; bu ikinci kullanım kod modelidir.",
  webStiffenerOffsetMm:
    "Standart dayanağı — FEM 1.001 Ek A-3.4'te boyuna berkitme, gövde plakasını " +
    "mesnetli kenarlar arasında ayrı buruşma panellerine böler.\n\nKod kullanımı — Değer üst " +
    "başlıktan berkitme eksenine düşey uzaklıktır; kesit A/I hesabına katılmaz. Sıfır, " +
    "boyuna berkitme yok ve tüm h3 tek panel demektir.",
  wheelContactHMm:
    "Standart dayanağı — DIN 15018 Şekil 9 raydan gelen teker yükünün gövdeye " +
    "yayılımını yerel σz hesabında tanımlar.\n\nKod kullanımı — Bu geometrik yük yayılım " +
    "yüksekliği için etkin boy le = 2h + 40 mm ve etkin alan çarpanı (0,2h + 5)·t " +
    "kurulur; teker çapı veya ray yüksekliği değildir.",
  wheelContactTMm:
    "Standart dayanağı — DIN 15018 Şekil 9 yerel gövde gerilmesini teker yükünün " +
    "yayıldığı etkin boy ve taşıyıcı sac kalınlığıyla ilişkilendirir.\n\nKod kullanımı — " +
    "Otomatikte ana gövde t3 alınır. Yükü gerçekten ayrı bir T yan sacı/takviye taşıyorsa " +
    "otomatik kapatılıp yük yolundaki gerçek kalınlık girilmelidir.",
  sigmaYMaxOverrideNmm2:
    "Kod kullanımı — Yorulma hesabındaki en büyük yerel teker basıncı normal gerilmesi " +
    "için elle ezmedir. Boşken DIN 15018 Şekil 9 modeliyle Durum I teker yükünden " +
    "hesaplanan |σz(I)| değeri kullanılır; yalnız haricî ayrıntılı analiz varsa doldurulmalıdır.",
  sigmaYMinOverrideNmm2:
    "Kod kullanımı — Yorulma gerilme oranındaki en küçük yerel teker basıncı için elle " +
    "ezmedir. Boşken yalnız araba teker yükünden hesaplanan |σz(araba)| kullanılır; " +
    "σy,maks ile birlikte κy ve DIN 15018 Tablo 18 dönüşümünü etkiler.",
  fatigueTensileOverrideNmm2:
    "Kod kullanımı — DIN 15018 Tablo 18 gerilme oranı dönüşümünde gereken malzeme " +
    "kopma dayanımı σB için elle ezmedir. Boşken yorulma malzemesinden S235JR = 360, " +
    "S355JR = 510 N/mm² alınır; sertifika/proje değeri kullanılacaksa buraya girilir.",
  deflectionLimitRatio:
    "Standart/kod ayrımı — CMAA 70 md. 3.5.5.1, araba + nominal yük altında ve " +
    "dinamik katsayı olmadan yaklaşık δ ≤ L/888 sınırı verir; FEM 1.001 tek bir kiriş " +
    "sehim oranı dayatmaz. ORION seçilen L/n hedefini canlı yük sehimiyle karşılaştırır; " +
    "liste sözleşme veya firma hedefini seçebilmek için açıktır.",
  camberExtraDeadLoadKgPerM:
    "Standart dayanağı — CMAA 70 md. 3.5.5.2 kaynaklı kutu kirişte kamberi ölü yük " +
    "sehimi + canlı yük sehiminin yarısı olarak tanımlar.\n\nKod kullanımı — Kesit sacları, perdeler " +
    "ve seçili ray kg/m otomatik eklenir; bu kutuya yalnız yürüme yolu, korkuluk, kablo " +
    "tavası gibi bunların dışında kirişe kalıcı binen yayılı yük yazılır. Başkiriş mesnette " +
    "durduğu için eklenmez.",
};

const GIRDER_INPUT_FIELDS_BASE: FieldDef<GirderInputs>[] = [
  // KESİT ÖLÇÜLERİ — öbekli ve SEMBOL ÖNDE (bkz. `field-groups.ts`). Etiketler
  // "t2 · Üst İç Flanş Kalınlığı" biçimindedir: sol kenarda taranabilir bir
  // sembol sütunu oluşur ve mühendis aradığı sacı okumadan bulur.
  {
    key: "railHeightMm", label: "hr · Ray Yüksekliği", unit: "mm", type: "number",
    fieldGroup: "rail",
  },
  // RAY ALTI SACI, T PROFİL VARKEN İPTALDİR: rayı T'nin üst sacı taşır.
  // Alanlar gizlenir (değerleri korunur, hesaba girmez) — "0 gir" demek
  // kullanıcının girdiğini silmek olurdu.
  {
    key: "t1Mm", label: "t1 · Ray Altı Sacı Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "topFlange", visibleWhen: (inp) => !tProfileOn(inp),
  },
  {
    key: "b1Mm", label: "b1 · Ray Altı Sacı Genişliği", unit: "mm", type: "number",
    fieldGroup: "topFlange", visibleWhen: (inp) => !tProfileOn(inp),
    hint: "Merkezi kirişin ortasında değil, RAY EKSENİNDEDİR (x + t3/2).",
  },
  {
    key: "t2Mm", label: "t2 · Üst İç Flanş Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "topFlange",
  },
  {
    key: "b2Mm", label: "b2 · Üst İç Flanş Genişliği", unit: "mm", type: "number",
    fieldGroup: "topFlange",
    hint: "T profil varken plaka T'nin SAĞ UCUNDAN başlar; sol yanında parça kalmaz.",
  },
  // --- Ray altı T profil (büyük tonajlı vinçler) ---------------------------
  // Anahtar "Var" olunca dört ölçü sorulur; "Yok"ta kutular gizlenir ve
  // kayıtlı değerler korunur.
  {
    key: "railTProfile", label: "Ray Altı T Profil", type: "select",
    options: RAIL_T_PROFILE_OPTIONS, fieldGroup: "tProfile",
    hint:
      "VAR seçilince: ray altı sacı (t1) iptal olur, üst iç flanş T'nin sağ " +
      "ucundan başlar ve ana gövde sacı T'nin yan sacı kadar kısalır. Toplam " +
      "yükseklik değişmez.",
  },
  {
    key: "railTProfileTopThkMm", label: "tT · T Profil Üst Sac Kalınlığı", unit: "mm",
    type: "number", fieldGroup: "tProfile", visibleWhen: tProfileOn,
    hint: "Rayın oturduğu sac; ana kirişin üst sacıyla AYNI SEVİYEDEDİR.",
  },
  {
    key: "railTProfileTopWidthMm", label: "bT · T Profil Üst Sac Genişliği", unit: "mm",
    type: "number", fieldGroup: "tProfile", visibleWhen: tProfileOn,
    hint: "Ray ekseninde ortalanır; b2 bu sacın sağ ucundan başlar.",
  },
  {
    key: "railTProfileWebThkMm", label: "tTy · T Profil Yan Sac Kalınlığı", unit: "mm",
    type: "number", fieldGroup: "tProfile", visibleWhen: tProfileOn,
    hint: "T'nin DİKEY sacı — üst sacın TAM ORTASINDA ve ray ekseninde durur.",
  },
  {
    key: "railTProfileWebHeightMm", label: "hT · T Profil Yan Sac Yüksekliği", unit: "mm",
    type: "number", fieldGroup: "tProfile", visibleWhen: tProfileOn,
    hint: "Ana gövde sacı (t3) tam bu kadar kısalır; toplam yükseklik DEĞİŞMEZ.",
  },
  {
    key: "t3Mm", label: "t3 · Ana Gövde Sacı Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "web", hint: "Rayın altındaki gövde sacı.",
  },
  {
    key: "h3Mm", label: "h3 · Gövde Yüksekliği", unit: "mm", type: "number",
    fieldGroup: "web",
  },
  {
    key: "t4Mm", label: "t4 · Yardımcı Gövde Sacı Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "web", hint: "Dış yan sac; T profil olsa da TAM BOY kalır.",
  },
  {
    key: "t5Mm", label: "t5 · Alt Flanş Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "bottomFlange",
  },
  {
    key: "b5Mm", label: "b5 · Alt Flanş Genişliği", unit: "mm", type: "number",
    fieldGroup: "bottomFlange",
  },
  {
    key: "t6Mm", label: "t6 · Ek Flanş Kalınlığı", unit: "mm", type: "number",
    fieldGroup: "bottomFlange", hint: "Ek flanş yoksa 0.",
  },
  {
    key: "b6Mm", label: "b6 · Ek Flanş Genişliği", unit: "mm", type: "number",
    fieldGroup: "bottomFlange",
  },
  {
    key: "aMm", label: "a · Gövde Sacları Arası Mesafe", unit: "mm", type: "number",
    fieldGroup: "geometry",
  },
  {
    key: "xMm", label: "x · Kenar Mesafesi", unit: "mm", type: "number",
    fieldGroup: "geometry",
    hint: "b2'nin sol kenarından ana gövde sacına; ray ekseni = x + t3/2.",
  },
  {
    key: "hookTopPositionM", label: "Kancanın En Üst Konumu l", unit: "m", type: "number",
    hint:
      "Otomatikken Teknik Özellikler bölümündeki ilgili kaldırma yüksekliğini alır. " +
      "Özel yerleşimlerde anahtar kapatılarak elle değiştirilebilir.",
  },
  {
    key: "bridgeAxleSpacingM", label: "Köprü Dingil Açıklığı", unit: "m", type: "number",
    hint:
      "Otomatikken Vinç Verileri ve Teker Düzenindeki bir ray üzerinde ilk ve " +
      "son teker ekseni arasındaki toplam mesafeyi alır.",
  },
  { key: "trolleyWheelSpacingM", label: "Araba Tekerlek Açıklığı", unit: "m", type: "number" },
  { key: "trolleyAxleSpacingM", label: "Araba Dingil Açıklığı", unit: "m", type: "number" },
  // 7.2 / 7.3'ün üç katsayısı ARTIK ELLE SORULMAZ: otomatik türetilip kutuya
  // yazılır (bkz. derive.ts `deriveGirderInputs`, fields.ts GIRDER_AUTO_FIELDS).
  // Anahtar kapatılınca alan serbest kalır ve mühendisin değeri kullanılır.
  {
    key: "psiHAOverride", label: "Yatay Dinamik Katsayı ψhA (Araba)", type: "number",
    standardRef: "FEM 1.001 A.2.2.1",
    hint:
      "Otomatik: araba kütle oranından türetilir — µA = asılı yük / araba " +
      "ağırlığı; µ ≤ 1 → 2, µ > 1 → √(2 + µ + 1/µ).",
  },
  {
    key: "psiHKOverride", label: "Yatay Dinamik Katsayı ψhK (Köprü)", type: "number",
    standardRef: "FEM 1.001 A.2.2.1",
    hint:
      "Otomatik: köprü kütle oranından türetilir — µK = asılı yük / " +
      "(köprü + araba); µ ≤ 1 → 2, µ > 1 → √(2 + µ + 1/µ).",
  },
  {
    key: "amplifyYcOverride", label: "Arttırma Katsayısı γc", type: "number",
    standardRef: "FEM 1.001 T.2.3.4",
    hint: "Otomatik: çelik yapı sınıfından getirilir (A1 → 1,00 … A8 → 1,20).",
  },
  {
    key: "dynTestFactorR1", label: "Dinamik Test Katsayısı ρ1", type: "number",
    standardRef: "FEM 1.001 §2.3.3",
  },
  {
    key: "statTestFactorR2", label: "Statik Test Katsayısı ρ2", type: "number",
    standardRef: "FEM 1.001 §2.3.3",
  },
  { key: "railLeverCMm", label: "Kayma Merkezi Kolu c", unit: "mm", type: "number" },
  {
    key: "diaphragmSpacingMm", label: "İki Perde Arası l1", unit: "mm",
    type: "select", options: ["1000", "1500", "2000"], numeric: true,
    standardRef: "FEM 1.001 A-3.4",
    hint: "Buruşma kontrolünde panel uzunluğu a bu değerdir (α = a / b).",
  },
  {
    key: "webStiffenerOffsetMm", label: "Boyuna Berkitme (Köşebent) Mesafesi",
    unit: "mm", type: "number", standardRef: "FEM 1.001 A-3.4",
    hint:
      "Gövde sacındaki boyuna berkitmenin ÜST BAŞLIĞA uzaklığı. Kesit " +
      "özelliklerine girmez; yalnız buruşma panelini böler — 0 girilirse " +
      "gövdenin tamamı tek panel olarak kontrol edilir.",
  },
  {
    key: "wheelContactHMm", label: "Teker Basıncı Yayılım Yüksekliği h", unit: "mm",
    type: "number", standardRef: "DIN 15018 Şekil 9",
  },
  {
    key: "wheelContactTMm", label: "Teker Basıncı Taşıyan Sac (Ray T-Profil) Kalınlığı t",
    unit: "mm", type: "number", standardRef: "DIN 15018 Şekil 9",
    hint:
      "Otomatikken Kesit Özelliklerindeki ana gövde sacı t3 kalınlığına eşittir. " +
      "Yükü ayrı bir takviye sacı taşıyorsa anahtar kapatılıp gerçek kalınlık girilebilir.",
  },
  {
    key: "sigmaYMaxOverrideNmm2", label: "σy,maks (Elle)", unit: "N/mm²", type: "number",
    standardRef: "DIN 15018 Şekil 9",
    hint: "Boş bırakılırsa gerilme analizindeki teker basıncından gelir: σy,maks = |σz(I)| / 9,81.",
  },
  {
    key: "sigmaYMinOverrideNmm2", label: "σy,min (Elle)", unit: "N/mm²", type: "number",
    standardRef: "DIN 15018 Şekil 9",
    hint: "Boş bırakılırsa gerilme analizinden gelir: σy,min = |σz(araba)| / 9,81.",
  },
  {
    key: "fatigueTensileOverrideNmm2", label: "Malzeme Kopma Dayanımı σB (Elle)",
    unit: "N/mm²", type: "number",
    hint: "Boş bırakılırsa yorulma malzemesinden türetilir (S235JR → 360, S355JR → 510).",
  },
  {
    key: "deflectionLimitRatio", label: "Sehim Sınırı", type: "select",
    options: ["250", "500", "750", "1000", "1100"], numeric: true,
    optionLabels: { "250": "1/250", "500": "1/500", "750": "1/750", "1000": "1/1000", "1100": "1/1100" },
    standardRef: "CMAA 70 3.5.5.1",
    hint:
      "Sehim yalnız CANLI yükle (araba + nominal kaldırma yükü) hesaplanır; " +
      "darbe katsayısı girmez. CMAA 70 sınırı yaklaşık L/888'dir; bu kutu " +
      "proje/sözleşme hedefini seçtirir.",
  },
  {
    key: "camberExtraDeadLoadKgPerM", label: "Kamber — İlave Sabit Yük",
    unit: "kg/m", type: "number", standardRef: "CMAA 70 3.5.5.2",
    hint:
      "Ters sehim hesabında kirişe kalıcı binen ilave yük: yürüme yolu, " +
      "korkuluk, festun ve kablo tavası. Kesit sacları, perdeler ve seçili " +
      "ray otomatik eklenir; buraya YAZILMAZ. Başkiriş ağırlığı da girmez " +
      "(mesnet üzerinde durur, kirişi eğmez).",
  },
];

export const GIRDER_INPUT_FIELDS: FieldDef<GirderInputs>[] =
  GIRDER_INPUT_FIELDS_BASE.map((def) => ({
    ...def,
    info: GIRDER_INPUT_INFO[def.key],
  }));

const GIRDER_SELECTION_INFO: Partial<Record<keyof GirderSelections & string, string>> = {
  fatigueMaterial:
    "Standart dayanağı — DIN 15018 Tablo 17/18 yorulma izinlerini malzeme " +
    "dayanımıyla birlikte değerlendirir.\n\nKod kullanımı — S235JR, St37; S355JR, " +
    "St52 tablo sütununa bağlanır. Seçim ayrıca σB otomatik değerini (360/510 N/mm²) " +
    "belirler; elle σB girilmişse yalnız o ezme değeri kullanılır.",
  fatigueLoadGroupOverride:
    "Standart dayanağı — DIN 15018 Tablo 17'de B1…B6 yük grubu izin verilen " +
    "yorulma gerilmesini değiştirir.\n\nKod kullanımı — Normalde teknik özellikteki " +
    "H/B sınıfının B bileşeni okunur. Bu kutu yalnız proje için farklı, belgelenmiş bir " +
    "yorulma grubu uygulanacaksa elle ezme olarak kullanılır.",
  fatigueNotchClass:
    "Standart dayanağı — DIN 15018 Tablo 17'de W0…W2 kaynaksız, K0…K4 " +
    "kaynaklı/çentikli detay sınıflarıdır; sınıf ağırlaştıkça izin verilen yorulma " +
    "gerilmesi düşer. Seçim gerçek kaynak birleşimi ve gerilme yönüne göre teknik " +
    "resim detayından yapılmalıdır; uygulama dikiş biçimini tahmin etmez.",
  staticMaterial:
    "Standart dayanağı — FEM 1.001 Tablo T.3.2.1.1 yükleme durumlarına göre " +
    "St37/St44/St52 için statik izin verilen normal ve kayma gerilmelerini verir.\n\n" +
    "Kod kullanımı — Bu seçim Durum I ve III statik kontrollerinin sınırlarını değiştirir; " +
    "yorulma malzemesi ayrı seçilir ve onun yerine geçmez.",
};

const GIRDER_SELECTION_FIELDS_BASE: FieldDef<GirderSelections>[] = [
  {
    key: "fatigueMaterial", label: "Yorulma Malzemesi", type: "select",
    options: FATIGUE_MATERIALS, standardRef: "DIN 15018 Tablo 17",
  },
  {
    key: "fatigueLoadGroupOverride", label: "Yük Grubu (DIN 15018, Elle)",
    type: "select", options: LOAD_GROUPS, standardRef: "DIN 15018 Tablo 17",
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  {
    key: "fatigueNotchClass", label: "Kaynak / Çentik Sınıfı (DIN 15018)", type: "select",
    options: NOTCH_CLASSES, standardRef: "DIN 15018 Tablo 17",
  },
  {
    key: "staticMaterial", label: "Kiriş Malzemesi", type: "select",
    options: GIRDER_STATIC_MATERIALS, standardRef: "FEM 1.001 T.3.2.1.1",
  },
];

export const GIRDER_SELECTION_FIELDS: FieldDef<GirderSelections>[] =
  GIRDER_SELECTION_FIELDS_BASE.map((def) => ({
    ...def,
    info: GIRDER_SELECTION_INFO[def.key],
  }));

// --- BURUŞMA KONTROLÜ -------------------------------------------------------

/**
 * Panel alanları. NORMALDE ELLE GİRİLMEZ: ana kiriş açıkken ölçüler kesitten,
 * kenar gerilmeleri 7.4 gerilme analizinden türetilir (bkz. modules/buckling.ts
 * `bucklingDepsFrom`). Bu alanlar yalnız "Ana Kirişten Otomatik" anahtarı
 * kapatıldığında kullanılır.
 *
 * İŞARET KURALI her gerilme alanının ipucunda tekrarlanır — buruşmada bir
 * işaret hatası doğrudan yanlış Kσ dalına düşürür.
 */
export const BUCKLING_PANEL_FIELDS: FieldDef<BucklingPanelInputs>[] = [
  {
    key: "thicknessMm", label: "Sac Kalınlığı e", unit: "mm", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint: "Otomatik türetmede yan sac için gövde sacı t3, üst sac için üst iç başlık t2.",
  },
  {
    key: "panelWidthMm", label: "Panel Genişliği b", unit: "mm", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Basınç kuvvetlerine DİK ölçü. Yan sacta gövdenin boyuna berkitmeye " +
      "(köşebent) kadar olan yüksekliği, berkitme yoksa gövdenin tamamı h3; " +
      "üst sacta gövde sacları arası net açıklık a.",
  },
  {
    key: "stiffenerSpacingMm", label: "Panel Uzunluğu a (Perde Aralığı)", unit: "mm",
    type: "number", standardRef: "FEM 1.001 A-3.4",
    hint: "Basınç yönündeki ölçü = ana kirişin iki perdesi arası. α = a / b.",
  },
  {
    key: "sigma1", label: "Basınç Kenarı Gerilmesi σ1", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 T.A.3.4.1",
    hint:
      "BASINÇ POZİTİF girilir. σ1 panelin basınç kenarıdır (iki kenarın " +
      "büyüğü). Yükleme Durumu I gerilmesidir ve γc arttırma katsayısını içerir.",
  },
  {
    key: "sigma2", label: "Karşı Kenar Gerilmesi σ2", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 T.A.3.4.1",
    hint:
      "Panelin diğer kenarı; ÇEKME ise NEGATİF girilir. ψ = σ2/σ1 buradan " +
      "çıkar: +1 düzgün basınç, 0 üçgen basınç, −1 saf eğilme. ψ < −1 (çekme " +
      "baskın eğilme) geçerlidir ve Kσ = 23,9 ile karşılanır.",
  },
  {
    key: "tau", label: "Ortalama Kayma Gerilmesi τ", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Panelin ortalama kayma gerilmesi (işareti sonucu etkilemez). Yan sacta " +
      "gövde kayması, üst sacta kapalı kesitin burulma akışından gelen kayma.",
  },
];

export const BUCKLING_EXTRA_FIELDS: FieldDef<BucklingInputs>[] = [
  {
    key: "autoFromGirder", label: "Panelleri Ana Kirişten Otomatik Türet",
    type: "select", options: ["Evet", "Hayır"],
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Açıkken panel ölçüleri kesit geometrisinden, kenar gerilmeleri 7.4 " +
      "gerilme analizinden gelir; yukarıdaki alanlar kullanılmaz. Kapatılırsa " +
      "değerler elle girilir.",
  },
];

// --- BAŞKİRİŞ ---------------------------------------------------------------

export const ENDCARRIAGE_DEP_FIELDS: FieldDef<EndCarriageDeps>[] = [
  { key: "mainHoistTotalLoadKg", label: "Ana Kaldırma Toplam Yükü", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba Ağırlığı", unit: "t", type: "number" },
  { key: "bridgeWeightT", label: "Köprü Toplam Ağırlığı (Kirişler + Başkirişler)", unit: "t", type: "number" },
];

export const ENDCARRIAGE_INPUT_FIELDS: FieldDef<EndCarriageInputs>[] = [
  { key: "wheelSpanAMm", label: "Tekerlekler Arası Mesafe a", unit: "mm", type: "number" },
  { key: "loadOffsetBMm", label: "Kiriş Oturma Noktası b", unit: "mm", type: "number" },
  { key: "topPlateThicknessMm", label: "Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "topPlateWidthMm", label: "Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "sidePlateThicknessMm", label: "Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "sidePlateHeightMm", label: "Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "bottomPlateThicknessMm", label: "Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "bottomPlateWidthMm", label: "Alt Sac Genişliği", unit: "mm", type: "number" },
  { key: "fatigueTensileNmm2", label: "Malzeme Kopma Dayanımı σB", unit: "N/mm²", type: "number" },
];

export const ENDCARRIAGE_SELECTION_FIELDS: FieldDef<EndCarriageSelections>[] = [
  {
    key: "hoistClassOverride", label: "Kaldırma Sınıfı (Elle)",
    type: "select", options: HOIST_CLASSES, standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının H bileşeninden türetilir.",
  },
  { key: "material", label: "Malzeme", type: "select", options: FATIGUE_MATERIALS },
  { key: "fatigueMaterial", label: "Yorulma Malzemesi", type: "select", options: FATIGUE_MATERIALS },
  {
    key: "fatigueLoadGroupOverride", label: "Yük Grubu (DIN 15018, Elle)",
    type: "select", options: LOAD_GROUPS,
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  { key: "fatigueNotchClass", label: "Kaynak / Çentik Sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES },
];
