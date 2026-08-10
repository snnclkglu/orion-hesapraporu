// Üretim durumu — SAF ÇEKİRDEK (DB/HTTP/dosya sistemi yok).
//
// Kullanıcının bu modülden BAŞTAN istediği şey buydu: "parça satın alındı,
// kesildi, talaşlı imalata girdi vs bilgiler alabiliriz". Bu dosya o defterin
// hesabını yapar; nerede saklandığını bilmez.
//
// ÜÇ KARAR BU DOSYANIN OMURGASIDIR:
//
// 1. ANAHTAR PAKETTEN DEĞİL KODDAN TÜRETİLİR. `drawing_packages.item_no`
//    yeniden yazılabilir (`remapItem(rewriteItemNo)`) ve `autoItemNos` ikinci
//    kalem eklendiğinde `0057-00`ı `0057-01`e KAYDIRIR; o alandan türetilen bir
//    ilerleme kaydı bir sabah öksüz kalırdı. `itemNoOf(part_code)` ise kodun
//    kendi önekidir ve ressam kodu yeniden çizmediği sürece değişmez.
//
// 2. KODSUZ SATIRLAR İZLENİR VE BİRLEŞTİRİLİR. Defterin üçte biri ilâ yarısı
//    kodsuzdur (MONORAY 50/121, MTC 86/261) ve kullanıcının İLK saydığı ihtiyaç
//    ("satın alındı") tam olarak orada yaşıyor: civata, somun, segman, keçe,
//    kama. `register_key = 'SATIR:' || bom_seq` AKAN BİR SAYAÇTIR — yeni bir
//    Excel yüklenince kayar — bu yüzden anahtar olamaz. Kararlı anahtar
//    katlanmış açıklamadır (`SATINALMA:<açıklama>`) ve aynı kalemin farklı alt
//    montajlardaki tekrarları TEK KALEME iner: satın alma kararı satır başına
//    değil KALEM başınadır.
//
// 3. ZİNCİR VARSAYAN DARBOĞAZ HESABI YAZILMAZ. Aşama kapsamı veriden
//    türetilemez: kategori sözlüğü paketten pakete değişiyor (MONORAY'da
//    Plazma 28 · Testere 11 · Talaşlı 10 · Lazer 6; MTC'de Plazma 101 ·
//    Testere 25 · Talaşlı 18 · Komple 11) ve "bir önceki aşamadan düşüş"
//    tanımı, MTC'de yalnız üç büküm dosyası olduğu için "büküldü"yü kalıcı
//    darboğaz ilan ederdi. Bunun yerine her parçanın ULAŞTIĞI EN İLERİ AŞAMA
//    histogramı çıkarılır; darboğaz o histogramın (hiç başlanmamışlar hariç)
//    en kalabalık kovasıdır ve başlanmamış sayısı AYRICA yazılır.

import { itemNoOf, parsePartCode } from "./part-code";
import { parseFolderName } from "./folder-name";
import { trBuyuk, trKatla } from "./tr-text";
import type { PartKind } from "./types";

// ---------------------------------------------------------------- sözlük

/**
 * Aşama anahtarları — `drawing_stages.slug` ile BİREBİR aynı.
 *
 * Kodun bildiği liste ile defterin tohumu ayrışırsa hiçbir test kırılmaz ve
 * ekran sessizce yanlış çalışır (bir aşama çipi hiç görünmez ya da bir kayıt
 * adsız kalır). `__tests__/progress.test.ts` bu iki listeyi migration dosyasını
 * okuyarak karşılaştırır — `standard.guard.test.ts` deseninin aynısı.
 */
export const STAGE_SLUGS = [
  "satinalindi",
  "kesildi",
  "bukuldu",
  "talasli",
  "kaynak",
  "boya",
  "montaja_hazir",
] as const;

export type StageSlug = (typeof STAGE_SLUGS)[number];

/** Defterin bir satırı. Ad ve renk oradan gelir; kod yalnız slug'ı bilir. */
export interface StageDef {
  slug: string;
  name: string;
  sort: number;
  colorHue: number;
}

/**
 * Defter henüz kurulmamışken (migration çalıştırılmadan) ekranın çökmemesi
 * için kullanılan yedek liste. Adlar ve tonlar migration'daki tohumun
 * AYNISIDIR; koruma testi ikisini karşılaştırır.
 */
export const FALLBACK_STAGES: StageDef[] = [
  { slug: "satinalindi", name: "Satın alındı", sort: 10, colorHue: 265 },
  { slug: "kesildi", name: "Kesildi", sort: 20, colorHue: 25 },
  { slug: "bukuldu", name: "Büküldü", sort: 30, colorHue: 65 },
  { slug: "talasli", name: "Talaşlı imalat", sort: 40, colorHue: 200 },
  { slug: "kaynak", name: "Kaynak", sort: 50, colorHue: 320 },
  { slug: "boya", name: "Boya", sort: 60, colorHue: 150 },
  { slug: "montaja_hazir", name: "Montaja hazır", sort: 70, colorHue: 105 },
];

/**
 * Ressamın klasör adına yazdığı durum sözcüğü → aşama.
 *
 * BU SÖZLÜK BİLİNÇLİ OLARAK EKSİKTİR. `folder-name.ts` yedi durum sözcüğü
 * tanıyor (KESİLDİ · YAPILDI · BİTTİ · TAMAM · TAMAMLANDI · İMAL EDİLDİ ·
 * BÜKÜLDÜ) ama yalnız İKİSİ tek bir aşamayı işaret ediyor. "TAMAM" hangi
 * aşamadır? Kesim mi, boya mı, montaj mı? Bilmiyoruz — ve tahmin etmek bu
 * modülün en büyük düşmanı olan yanlış alarmı üretir. 175 parçalık bir pakette
 * yanlış bir eşleme, atölyenin bir daha bu ekrana bakmaması demektir.
 *
 * Anahtarlar KATLANMIŞTIR (`trKatla`): noktasız yazılmış `KESILDI` klasörü de
 * tanınır. Ressamın hangi klavyeyle yazdığı bir kimlik sorunu olmamalı.
 */
const IPUCU_ASAMA: Record<string, StageSlug> = {
  [trKatla("KESİLDİ")]: "kesildi",
  [trKatla("BÜKÜLDÜ")]: "bukuldu",
};

/** Kodsuz satın alma kalemlerinin anahtar uzayı öneki. */
export const PURCHASE_PREFIX = "SATINALMA:";

// ------------------------------------------------------------------ tipler

/**
 * Defter satırının bu modülün ihtiyaç duyduğu kadarı.
 *
 * YAPISAL ARAYÜZDÜR: hem `reconcile.ts`in `RegisterPart`ı hem sayfanın
 * `PartRow`dan eşlediği nesne geçer. Tam tipe bağlanmak, çekirdeği sunum
 * katmanının satır şekline bağımlı yapardı.
 */
export interface ProgressPart {
  partCode: string;
  description?: string;
  name?: string;
  assemblyTitle?: string;
  qty?: number | null;
  kind?: PartKind;
  category?: string;
  material?: string;
}

/** İzlenen birim: bir kodlu parça ya da birleştirilmiş bir satın alma kalemi. */
export interface TrackedPart {
  /** İlerleme anahtarı: parça kodu ya da `SATINALMA:<katlanmış açıklama>` */
  key: string;
  /** Kodlu parçada kod, satın alma kaleminde "" */
  partCode: string;
  /** Ekranda görünen ad */
  label: string;
  description: string;
  qty: number | null;
  kind: PartKind;
  category: string;
  material: string;
  /** Gruplama başlığı: kodun ilk segmenti ("0100") ya da "SATIN ALMA" */
  group: string;
  /** Kaç defter satırından birleşti (satın alma kalemlerinde >1 olabilir) */
  sourceRows: number;
}

/** Bir ilerleme kaydı — `drawing_part_progress` satırının çekirdek karşılığı. */
export interface ProgressMark {
  /** Kayıttaki `part_code` sütunu; izlenen birimin ANAHTARIDIR */
  key: string;
  stage: string;
  qtyDone: number;
  doneAt?: string | null;
  note?: string;
  /**
   * Satırın kendi kimliği — YALNIZ revizyon işaretini kaldırmak için.
   *
   * İlerlemenin anahtarı hâlâ (kalem no, parça kodu, aşama) METNİDİR; bu alan
   * o kuralı değiştirmez, tek bir satırı adresleyebilmek içindir.
   */
  id?: string;
  /**
   * Parça yeni revizyonda İMALATI ETKİLEYECEK biçimde değişti; kayıt devroldu
   * ama insan bakmalı. Sac büyüdüyse eskiden kesilen parça artık yanlıştır ve
   * "kesildi" demeyi sürdürmek atölyeye yalan söylemektir.
   */
  reviewRequired?: boolean;
  /** "Adet 2 → 4 · Kalınlık 8 → 10" */
  reviewReason?: string;
}

export type StageState = "yok" | "kismi" | "tamam";

export interface PartProgress {
  key: string;
  /** Aşama slug'ı → durum */
  states: Record<string, StageState>;
  /** Aşama slug'ı → işaretlenen adet (0 = adet girilmemiş, işaret yine var) */
  qtyDone: Record<string, number>;
  /** ULAŞILAN en ileri aşama (yalnız `tamam` sayılır); yoksa "" */
  reached: string;
  /** Herhangi bir işaret var mı (kısmi dâhil) */
  started: boolean;
  /** Kaba ilerleme: tamamlanan aşama / toplam aşama */
  pct: number;
}

export interface StageBucket {
  stage: StageDef;
  /** `reached === slug` olan parça sayısı */
  parts: number;
  /** O aşamada herhangi bir işareti olan parça sayısı (kısmi dâhil) */
  marked: number;
  /** Aynı parçaların toplam adedi (adedi bilinmeyen 1 sayılır) */
  qty: number;
}

export interface PackageProgress {
  total: number;
  notStarted: number;
  started: number;
  /** Aşama sırasına göre kovalar */
  buckets: StageBucket[];
  /** Başlanmışlar arasında en kalabalık kova; hiç işaret yoksa null */
  bottleneck: StageBucket | null;
  /** Son aşamayı tamamlamış parça oranı (0–1) */
  completedRatio: number;
  /** Son aşamayı tamamlamış parça sayısı */
  completed: number;
}

// -------------------------------------------------------------- anahtarlar

/**
 * İzlenen birimin anahtarı.
 *
 * Kodlu parçada kodun kendisi; kodsuz satırda katlanmış açıklama. Katlama
 * ZORUNLUDUR: `CİVATA` ile `CIVATA` aynı kalemdir ve ayrı anahtarlanırsa satın
 * alma iki kez yapılır.
 */
export function progressKeyOf(part: ProgressPart): string {
  const kod = part.partCode?.trim();
  if (kod) return kod;
  const tanim = (part.description || part.name || "").trim();
  return PURCHASE_PREFIX + (tanim ? trKatla(tanim) : "?");
}

/** Anahtar bir satın alma kalemine mi ait? */
export function isPurchaseKey(key: string): boolean {
  return key.startsWith(PURCHASE_PREFIX);
}

/**
 * Defterin KODLARINDAN türetilen kalem numarası.
 *
 * Paketin `item_no` alanı okunmaz — o alan `remapItem(rewriteItemNo)` ile
 * yeniden yazılabilir ve `autoItemNos` onu kaydırabilir. Kodların kendi öneki
 * ise ressam kodu yeniden çizmediği sürece sabittir. En çok geçen önek
 * seçilir: bir pakette yabancı bir kod satırı olabilir (BOM_KALEM_FARKI gerçek
 * bir bulgudur) ve azınlık bütün defteri kaydırmamalıdır.
 */
export function registerItemNo(parts: readonly ProgressPart[], fallback = ""): string {
  const sayac = new Map<string, number>();
  for (const p of parts) {
    const kalem = itemNoOf(p.partCode);
    if (!kalem) continue;
    sayac.set(kalem, (sayac.get(kalem) ?? 0) + 1);
  }
  let enCok = "";
  let enCokSayi = 0;
  for (const [kalem, n] of sayac) {
    if (n > enCokSayi) {
      enCokSayi = n;
      enCok = kalem;
    }
  }
  return enCok || fallback.trim();
}

/**
 * Bir ilerleme anahtarının kalem numarası.
 *
 * Kodlu anahtarda kodun kendi önekidir. Satın alma kaleminde kod yoktur;
 * orada defterin türetilmiş kalem numarası kullanılır — bu, bilinçli olarak
 * kabul edilmiş tek kayma noktasıdır ve ekranda "eşleşmeyen üretim kaydı"
 * olarak görünür kılınır.
 */
export function progressItemNo(key: string, registerItem = ""): string {
  return itemNoOf(key) || registerItem.trim();
}

/** Kodun ilk segmenti — ekranda grup başlığı ("0100", "0802"). */
export function groupOf(partCode: string): string {
  return parsePartCode(partCode)?.segments[0] ?? "";
}

// ------------------------------------------------------------ izlenen defter

export interface TrackedRegister {
  /** Kodlu parçalar, defterdeki sırayla */
  coded: TrackedPart[];
  /** Birleştirilmiş satın alma kalemleri */
  purchases: TrackedPart[];
  /** İkisi birlikte */
  all: TrackedPart[];
  /** Defterin kodlarından türetilen kalem numarası */
  itemNo: string;
}

/**
 * Defteri izlenebilir birimlere çevirir.
 *
 * Kodlu parça = bir birim. Kodsuz satırlar katlanmış açıklamaya göre
 * BİRLEŞTİRİLİR ve adetleri TOPLANIR: MTC'de "SOMUN M16 DIN934 (GALVANİZLİ)"
 * dört ayrı montajda geçiyor ve satın alma bunu tek kalem olarak sipariş eder.
 * Kaynak satır sayısı `sourceRows`ta durur ki ekran "4 satırdan birleşti"
 * diyebilsin — birleştirme sessiz bir kayıp olmamalı.
 */
export function trackedParts(
  parts: readonly ProgressPart[],
  fallbackItemNo = ""
): TrackedRegister {
  const coded: TrackedPart[] = [];
  const alimlar = new Map<string, TrackedPart>();

  for (const p of parts) {
    const key = progressKeyOf(p);
    const tanim = (p.description || p.name || "").trim();

    if (p.partCode?.trim()) {
      coded.push({
        key,
        partCode: p.partCode.trim(),
        label: tanim || p.assemblyTitle?.trim() || p.partCode.trim(),
        description: tanim,
        qty: p.qty ?? null,
        kind: p.kind ?? "bilinmiyor",
        category: p.category ?? "",
        material: p.material ?? "",
        group: groupOf(p.partCode) || "—",
        sourceRows: 1,
      });
      continue;
    }

    const varOlan = alimlar.get(key);
    if (varOlan) {
      // Adet TOPLANIR — kodlu parçadan farklı olarak. Kodlu satırlar aynı
      // parçanın iki SAYFADAKİ kaydıdır (eşleştirme en büyüğünü alır); kodsuz
      // satırlar ise AYRI montajlardaki gerçek ihtiyaçlardır. Adedi olmayan
      // satır toplamı bozmaz, yalnız kaynak sayısını artırır.
      if (p.qty != null) varOlan.qty = (varOlan.qty ?? 0) + p.qty;
      varOlan.sourceRows += 1;
      if (!varOlan.material && p.material) varOlan.material = p.material;
      if (!varOlan.category && p.category) varOlan.category = p.category;
      continue;
    }

    alimlar.set(key, {
      key,
      partCode: "",
      label: tanim || "(tanımsız satır)",
      description: tanim,
      qty: p.qty ?? null,
      kind: p.kind ?? "satinalma",
      category: p.category ?? "",
      material: p.material ?? "",
      group: "SATIN ALMA",
      sourceRows: 1,
    });
  }

  const purchases = [...alimlar.values()];
  return {
    coded,
    purchases,
    all: [...coded, ...purchases],
    itemNo: registerItemNo(parts, fallbackItemNo),
  };
}

// ------------------------------------------------------------- parça özeti

/** İşaretleri anahtara göre indeksler — ekran ve özet aynı haritayı paylaşır. */
export function marksByKey(marks: readonly ProgressMark[]): Map<string, ProgressMark[]> {
  const harita = new Map<string, ProgressMark[]>();
  for (const m of marks) {
    const liste = harita.get(m.key);
    if (liste) liste.push(m);
    else harita.set(m.key, [m]);
  }
  return harita;
}

/**
 * Bir parçanın aşama durumu.
 *
 * BİR İŞARET SATIRININ VARLIĞI "işaretlendi" demektir; `qtyDone` yalnız KISMİ
 * ilerlemeyi anlatır. Adedi bilinmeyen parçada (MTC'de 6, MONORAY'da 9 satır)
 * tek işaret tamam sayılır — "kaç tanesi" sorusunun cevabı yoksa soruyu
 * sormamak, kaydı belirsiz bırakmaktan iyidir.
 *
 * ULAŞILAN AŞAMA GERİYE GİTMEZ: yalnız `boya` işaretli bir parçanın ulaştığı
 * aşama `boya`dır. Atölye geriye dönüp `kesildi`yi doldurmaz ve bunu bir eksik
 * saymak, doğru olanı yapan kullanıcıyı cezalandırmak olurdu.
 */
export function partProgress(
  part: Pick<TrackedPart, "key" | "qty">,
  marks: readonly ProgressMark[],
  stages: readonly StageDef[]
): PartProgress {
  const states: Record<string, StageState> = {};
  const qtyDone: Record<string, number> = {};
  for (const s of stages) states[s.slug] = "yok";

  for (const m of marks) {
    const adet = Number.isFinite(m.qtyDone) ? Math.max(0, Math.trunc(m.qtyDone)) : 0;
    qtyDone[m.stage] = adet;
    const kismi = part.qty != null && part.qty > 0 && adet > 0 && adet < part.qty;
    states[m.stage] = kismi ? "kismi" : "tamam";
  }

  const sirali = [...stages].sort((a, b) => a.sort - b.sort);
  let reached = "";
  let tamamSayisi = 0;
  for (const s of sirali) {
    if (states[s.slug] === "tamam") {
      reached = s.slug;
      tamamSayisi += 1;
    }
  }

  return {
    key: part.key,
    states,
    qtyDone,
    reached,
    started: marks.length > 0,
    pct: sirali.length ? Math.round((tamamSayisi / sirali.length) * 100) : 0,
  };
}

// ------------------------------------------------------------- paket özeti

/**
 * Paketin üretim özeti.
 *
 * Kovalar ULAŞILAN aşamaya göredir: her parça EN ÇOK BİR kovaya girer, yani
 * kovaların toplamı + başlanmamışlar = izlenen parça sayısıdır. Aşama başına
 * "kaç parça işaretli" sorusunun ayrı cevabı `marked` alanındadır ve o
 * çakışabilir (kesilmiş bir parça hem `kesildi` hem `boya` işaretli olabilir).
 */
export function packageProgress(
  parts: readonly TrackedPart[],
  marks: readonly ProgressMark[],
  stages: readonly StageDef[]
): PackageProgress {
  const sirali = [...stages].sort((a, b) => a.sort - b.sort);
  const harita = marksByKey(marks);

  const buckets: StageBucket[] = sirali.map((stage) => ({
    stage,
    parts: 0,
    marked: 0,
    qty: 0,
  }));
  const kovaSlug = new Map(buckets.map((b) => [b.stage.slug, b]));

  let notStarted = 0;
  let completed = 0;
  const sonSlug = sirali.length ? sirali[sirali.length - 1].slug : "";

  for (const p of parts) {
    const ilerleme = partProgress(p, harita.get(p.key) ?? [], sirali);
    if (!ilerleme.started) {
      notStarted += 1;
      continue;
    }
    for (const s of sirali) {
      if (ilerleme.states[s.slug] === "yok") continue;
      const kova = kovaSlug.get(s.slug);
      if (kova) kova.marked += 1;
    }
    const kova = ilerleme.reached ? kovaSlug.get(ilerleme.reached) : null;
    if (kova) {
      kova.parts += 1;
      kova.qty += p.qty ?? 1;
    }
    if (ilerleme.reached === sonSlug && sonSlug) completed += 1;
  }

  // DARBOĞAZ = başlanmışlar arasında en kalabalık kova. Başlanmamışlar
  // BİLİNÇLİ OLARAK HARİÇTİR: onlar bir darboğaz değil, henüz sıraya girmemiş
  // iştir ve toplamı çoğu zaman her şeyi ezerdi.
  let bottleneck: StageBucket | null = null;
  for (const b of buckets) {
    if (b.parts === 0) continue;
    if (!bottleneck || b.parts > bottleneck.parts) bottleneck = b;
  }

  const total = parts.length;
  return {
    total,
    notStarted,
    started: total - notStarted,
    buckets,
    bottleneck,
    completed,
    completedRatio: total ? completed / total : 0,
  };
}

// ------------------------------------------------------------------- öneri

/** Öneri motorunun bir dosyadan ihtiyaç duyduğu kadarı. */
export interface SuggestionFile {
  /** Dosya adı hariç yol: "DXF/0043-00-0100 - ANA KIRIS - KESİLDİ/S355JR-8MM" */
  folder: string;
  /** Çözülmüş parça kodu; boşsa dosya öneriye giremez */
  partCode: string;
  fileName?: string;
  /** Dosya adındaki "(n ADET)" — defterde adet yoksa yedek kaynak */
  qty?: number | null;
}

export interface StageSuggestion {
  /** Önerilen aşama slug'ı */
  stage: string;
  /** Ressamın YAZDIĞI hâliyle durum sözcüğü: "KESİLDİ" */
  hintWord: string;
  /** İpucunun okunduğu klasörün tam yolu */
  folderPath: string;
  /** Klasörün KENDİ kodu — kapsam DIŞIDIR, montaj kesilmez */
  folderCode: string;
  /** Önerilen bütün anahtarlar (zaten işaretliler dâhil) */
  keys: string[];
  /** Henüz o aşamada işareti olmayanlar — uygulanacak olanlar bunlardır */
  pending: string[];
  /** Zaten işaretli olanlar */
  alreadyMarked: string[];
  /** Anahtar → önerilen adet (defterden, yoksa dosya adından; ikisi de yoksa null) */
  qtyByKey: Record<string, number | null>;
  /** Defter ile dosya adı adette çeliştiyse — öneride DEFTER kazanır */
  qtyConflicts: { key: string; register: number; fileName: number }[];
}

/**
 * Klasör adındaki durum sonekinden ÖN DOLDURMA ÖNERİSİ.
 *
 * `DXF/0043-00-0100 - ANA KIRIS - KESİLDİ/` gerçek bir klasördür: atölye
 * durumu bir yere yazma ihtiyacı duymuş ve elindeki tek yer klasör adıydı. Bu
 * bir KANIT DEĞİL BİR İPUCUDUR ve kod hiçbir zaman kendiliğinden yazmaz —
 * ekran önerir, insan onaylar.
 *
 * ÜÇ İNCE KARAR:
 *
 * · İPUCU KÖKTE DEĞİL İÇ SEGMENTTEDİR. `reconcile.ts` yalnız `snap.folder`a
 *   (kök klasöre) bakar ve MTC'nin kökü `0043-00-0000_MTC PASLANMAZ` olduğu
 *   için URETIM_IPUCU bulgusu o pakette HİÇ basılmıyor. Burada her dosyanın
 *   HER klasör segmenti gezilir.
 *
 * · KAPSAM KLASÖRÜN KENDİ KODU DEĞİL, İÇİNDEKİ DOSYALARDIR. `0043-00-0100`
 *   klasörünün altında 20 DXF var ve bunlar montajın 24 alt parçasının tam
 *   20'si — eksik dördü testere ve talaşlı imalat kalemleri. Ressam tam olarak
 *   PLAZMA KESİLEN sacları oraya koymuş. Klasörün kendi kodunu (montajı)
 *   "kesildi" işaretlemek yanlış olurdu: montaj kesilmez.
 *
 * · BELİRSİZ SÖZCÜK ÖNERİ ÜRETMEZ. `IPUCU_ASAMA` sözlüğü yalnız tek anlamlı
 *   sözcükleri taşır; "TAMAM" hangi aşamadır sorusunun cevabı yoktur.
 */
export function suggestStagesFromFolders(input: {
  files: readonly SuggestionFile[];
  parts: readonly TrackedPart[];
  marks?: readonly ProgressMark[];
  stages?: readonly StageDef[];
}): StageSuggestion[] {
  const { files, parts } = input;
  const marks = input.marks ?? [];

  const defterAdet = new Map<string, number | null>();
  const defterAnahtar = new Set<string>();
  for (const p of parts) {
    defterAnahtar.add(p.key);
    if (p.partCode) defterAdet.set(p.partCode, p.qty);
  }

  const isaretli = new Set(marks.map((m) => `${m.key}|${m.stage}`));

  interface Toplayici {
    stage: StageSlug;
    hintWord: string;
    folderPath: string;
    folderCode: string;
    kodlar: Map<string, number | null>;
  }
  const toplayicilar = new Map<string, Toplayici>();

  for (const f of files) {
    const kod = f.partCode?.trim();
    if (!kod) continue;
    const segmentler = (f.folder ?? "").split("/").filter(Boolean);

    for (let i = 0; i < segmentler.length; i++) {
      const segment = segmentler[i];
      const ipucu = durumSozcugu(segment);
      if (!ipucu) continue;
      const asama = IPUCU_ASAMA[trKatla(ipucu)];
      if (!asama) continue;

      const yol = segmentler.slice(0, i + 1).join("/");
      const anahtar = `${yol}|${asama}`;
      let t = toplayicilar.get(anahtar);
      if (!t) {
        t = {
          stage: asama,
          hintWord: trBuyuk(ipucu),
          folderPath: yol,
          folderCode: parseFolderName(segment).value?.code ?? "",
          kodlar: new Map(),
        };
        toplayicilar.set(anahtar, t);
      }
      if (!t.kodlar.has(kod)) t.kodlar.set(kod, f.qty ?? null);
    }
  }

  const oneriler: StageSuggestion[] = [];
  for (const t of toplayicilar.values()) {
    const keys: string[] = [];
    const pending: string[] = [];
    const alreadyMarked: string[] = [];
    const qtyByKey: Record<string, number | null> = {};
    const qtyConflicts: StageSuggestion["qtyConflicts"] = [];

    for (const [kod, dosyaAdedi] of t.kodlar) {
      // Klasörün KENDİ kodu kapsam dışı: montaj kesilmez.
      if (kod === t.folderCode) continue;
      // Defterde karşılığı olmayan koda öneri yazılmaz — deftere girmemiş bir
      // parçayı işaretlemek, olmayan bir satırı üretim listesine sokardı.
      if (!defterAnahtar.has(kod)) continue;

      const defterAdedi = defterAdet.get(kod) ?? null;
      if (defterAdedi != null && dosyaAdedi != null && defterAdedi !== dosyaAdedi) {
        qtyConflicts.push({ key: kod, register: defterAdedi, fileName: dosyaAdedi });
      }
      // ÇELİŞKİDE DEFTER KAZANIR: dosya adındaki adet ressamın not düştüğü bir
      // sayı, defterinki Inventor'ın ürettiği. Küçüğü seçmek "temkinli" değil
      // KEYFÎ olurdu.
      qtyByKey[kod] = defterAdedi ?? dosyaAdedi;

      keys.push(kod);
      if (isaretli.has(`${kod}|${t.stage}`)) alreadyMarked.push(kod);
      else pending.push(kod);
    }

    if (keys.length === 0) continue;

    oneriler.push({
      stage: t.stage,
      hintWord: t.hintWord,
      folderPath: t.folderPath,
      folderCode: t.folderCode,
      keys,
      pending,
      alreadyMarked,
      qtyByKey,
      qtyConflicts,
    });
  }

  return oneriler.sort((a, b) => a.folderPath.localeCompare(b.folderPath, "tr"));
}

/**
 * Klasör segmentindeki durum sözcüğü.
 *
 * Önce `parseFolderName` denenir — kodlu bir segmentte durum sonekini o zaten
 * ayırıyor ve mükerrer bir kural yazmanın anlamı yok. Kod taşımayan bir
 * segmentte (`ANA KIRIS - KESİLDİ` ya da yalnız `KESİLDİ`) son " - " parçası
 * alınır. Sözlük süzgeci çağıranda olduğu için burada gevşek olmak güvenlidir.
 */
function durumSozcugu(segment: string): string {
  const cozulmus = parseFolderName(segment).value;
  if (cozulmus?.statusHint) return cozulmus.statusHint;
  const parcalar = segment.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  return parcalar.length ? parcalar[parcalar.length - 1] : "";
}

// ------------------------------------------------------- eşleşmeyen kayıtlar

/**
 * Hiçbir defter satırıyla eşleşmeyen ilerleme kayıtları.
 *
 * `SATINALMA:<açıklama>` anahtarı, ressam Excel'deki tanımı düzeltince (yazım
 * hatası, birim ekleme) öksüz kalır. Bu kabul edilmiş bir kaymadır ve SESSİZCE
 * KAYBOLMAMALIDIR: İş Takibi'ndeki "eşleşmemiş kalem" deseninin aynısıyla
 * ekranda ayrıca sayılır.
 */
export function orphanMarks(
  parts: readonly TrackedPart[],
  marks: readonly ProgressMark[]
): ProgressMark[] {
  const bilinen = new Set(parts.map((p) => p.key));
  return marks.filter((m) => !bilinen.has(m.key));
}
