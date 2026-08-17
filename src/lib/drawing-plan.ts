// TEKNİK RESİM TAKİBİ — ana grup numaralandırmasının SAF çekirdeği.
//
// Ressam çizime oturmadan önce mühendise tek bir soru sorar: "bu grup kaç
// olacak?" Cevap projenin başında verilir, resimlerin teslim edilmesini
// beklemez — bu yüzden defter Teknik Resimler modülünden (`/drawings`)
// TAMAMEN AYRIDIR ve ona hiçbir yerden bağlanmaz (kullanıcı kararı).
//
// Numaranın anatomisi:
//
//     0055-00 - 0100
//     └ iş kalemi  └ ana grup kodu
//
// Kalem numarası buraya KOPYALANMAZ; `job_items.item_no` (yoksa
// `projects.doc_no`) tek kaynaktır ve `autoItemNos` onu kaydırabilir
// (AGENTS IS-14).
//
// BANT KURALI FİRMANINDIR ve tek yerde tanımlıdır. Bant bir sütun DEĞİL koddan
// türeyen bir sonuçtur — iki yerde tutulsaydı biri güncellenip diğeri
// unutulurdu.
//
// ADIM 100'DÜR (kullanıcı kararı, 11.08.2026). Bir süre 50 idi çünkü devralınan
// antedlerde ara numaralar vardı (`0019-00-0950`); firma bu numaralandırmayı
// yüzlüklere sabitledi. Aradaki numaralar YASAK DEĞİLDİR — elle yazılmış bir
// "0950" kendi bandında görünmeye devam eder (bkz. `bandOfCode`) — yalnız
// seçim listesinde önerilmez.
//
// ARABA İKİYE BÖLÜNMÜŞTÜR. Bir vinçte iki araba olabilir ve ikisinin resimleri
// ressam için ayrı iki takımdır: ANA ARABA 1500–2200, YARDIMCI ARABA
// 2300–2900. Aradaki 2201–2299 boşluğu bilinçlidir; iki takımın numaraları
// birbirine karışmasın diye bırakılmıştır.

/** Ana grup bandı — kod aralığından TÜRETİLİR, saklanmaz. */
export type DrawingBand = "kopru" | "anaAraba" | "yardimciAraba" | "ekstra";

export interface DrawingBandDef {
  band: DrawingBand;
  label: string;
  /** "Grup Ekle" düğmesinin kısa etiketi ("+ Ana Araba") */
  shortLabel: string;
  /** Bandın ilk kodu (dahil) */
  first: number;
  /** Bandın son kodu (dahil) */
  last: number;
  /** Kullanıcıya gösterilen aralık metni */
  rangeText: string;
}

/** Bant tanımları — listeleme ve dropdown sırası budur. */
export const DRAWING_BANDS: readonly DrawingBandDef[] = [
  {
    band: "kopru",
    label: "Köprü Grubu",
    shortLabel: "Köprü Grubu",
    first: 100,
    last: 1450,
    rangeText: "0100–1400",
  },
  {
    band: "anaAraba",
    label: "Ana Araba Grubu",
    shortLabel: "Ana Araba",
    first: 1500,
    last: 2200,
    rangeText: "1500–2200",
  },
  {
    band: "yardimciAraba",
    label: "Yardımcı Araba Grubu",
    shortLabel: "Yardımcı Araba",
    first: 2300,
    last: 2950,
    rangeText: "2300–2900",
  },
  {
    band: "ekstra",
    label: "Ekstra Gruplar",
    shortLabel: "Ekstra Grup",
    first: 3000,
    last: 3950,
    rangeText: "3000–3900",
  },
];

export const DRAWING_BAND_LABELS: Record<DrawingBand, string> = {
  kopru: "Köprü Grubu",
  anaAraba: "Ana Araba Grubu",
  yardimciAraba: "Yardımcı Araba Grubu",
  ekstra: "Ekstra Gruplar",
};

/** Dropdown adımı — bkz. dosya başlığındaki gerekçe. */
const CODE_STEP = 100;

/** Dört haneli kod metni: 100 → "0100". */
export function formatDrawingCode(value: number): string {
  return String(value).padStart(4, "0");
}

/** Kod metni geçerli mi (tam dört rakam)? */
export function isDrawingCode(code: string): boolean {
  return /^[0-9]{4}$/.test(code.trim());
}

/**
 * Kodun bandı. Aralık dışındaki bir kod (ör. elle girilmiş "0050") EN YAKIN
 * bandın adını almaz — `null` döner ve ekranda "Bant dışı" olarak listelenir.
 * Sessizce bir banda yerleştirmek numarayı yanlış grubun altında gösterirdi.
 */
export function bandOfCode(code: string): DrawingBand | null {
  if (!isDrawingCode(code)) return null;
  const n = Number(code);
  for (const b of DRAWING_BANDS) {
    if (n >= b.first && n <= b.last) return b.band;
  }
  return null;
}

/** Bandın dropdown'da sunulan bütün kodları (metin, artan). */
export function codesOfBand(band: DrawingBand): string[] {
  const def = DRAWING_BANDS.find((b) => b.band === band);
  if (!def) return [];
  const out: string[] = [];
  for (let n = def.first; n <= def.last; n += CODE_STEP) out.push(formatDrawingCode(n));
  return out;
}

/**
 * Banttaki ilk BOŞ kod — "Grup Ekle" düğmesinin varsayılanı.
 *
 * Bant tamamen doluysa `null` döner; uydurma bir kod (ör. bandın dışına taşan
 * bir sayı) üretmek numarayı yanlış grubun aralığına sokardı.
 */
export function nextFreeCode(band: DrawingBand, used: Iterable<string>): string | null {
  const dolu = new Set([...used].map((c) => c.trim()));
  for (const code of codesOfBand(band)) {
    if (!dolu.has(code)) return code;
  }
  return null;
}

/**
 * Tam resim numarası: `0055-00` + `0100` → `0055-00-0100`.
 *
 * Kalem numarası yoksa (proje hiçbir iş kalemine bağlanmamış ve doküman no da
 * boşsa) YALNIZ kod döner — uydurma bir kök yazmak, ressamın antedine yanlış
 * bir iş numarası geçirirdi.
 */
export function fullDrawingNo(itemNo: string | null | undefined, code: string): string {
  const kok = (itemNo ?? "").trim();
  const kod = code.trim();
  if (!kok) return kod;
  return `${kok}-${kod}`;
}

// --------------------------------------------------------------- durum defteri

/**
 * Bir ana grubun çizim durumu.
 *
 * Bir süre tek bir "çizildi" kutusuydu ve ara durumlar bilinçli olarak
 * dışarıda bırakılmıştı. Kullanılınca görüldü ki mühendisin ilerlemeyi takip
 * ettiği yer TAM DA BURASI: paket teslim edilene kadar Teknik Resimler modülü
 * hiçbir şey bilmiyor, o aylar boyunca "ne durumda" sorusunun tek cevabı bu
 * defter. Liste KAPALIDIR (serbest metin değil) çünkü yüzde bu değerlerden
 * hesaplanır — serbest metin bir sayıya çevrilemezdi.
 */
export type DrawingPlanStatus =
  | "bekliyor"
  | "ciziliyor"
  | "kontrol"
  | "revize"
  | "cizildi";

export interface DrawingStatusDef {
  status: DrawingPlanStatus;
  label: string;
  /**
   * Tamamlanma yüzdesine katkı — TAM SAYI, 0–100.
   *
   * Ağırlıklar FİRMA KABULÜDÜR, ölçüm değil: çizilmekte olan bir grup yarı
   * yolda, kontroldeki grup neredeyse bitmiş sayılır. "Revize" çiziliyorun
   * ÜSTÜNDEDİR çünkü grup bir kez çizilmiştir — ama kontrolün altındadır,
   * çünkü tekrar çizim masasına dönmüştür.
   *
   * ONDALIK DEĞİL TAM SAYI: 0,5 + 0,8 kayan noktada 1,3000000000000003 eder ve
   * dört gruplu bir defterde yüzde %58 yerine %57 çıkıyordu. Yüzde ekranda
   * duran bir sayıdır; bir ikili gösterim ayrıntısı yüzünden bir puan
   * kaymamalıdır.
   */
  weight: number;
}

export const DRAWING_PLAN_STATUSES: readonly DrawingStatusDef[] = [
  { status: "bekliyor", label: "Bekliyor", weight: 0 },
  { status: "ciziliyor", label: "Çiziliyor", weight: 50 },
  { status: "revize", label: "Revize Ediliyor", weight: 60 },
  { status: "kontrol", label: "Kontrol Ediliyor", weight: 80 },
  { status: "cizildi", label: "Çizildi", weight: 100 },
];

export const DRAWING_PLAN_STATUS_LABELS: Record<DrawingPlanStatus, string> =
  Object.fromEntries(
    DRAWING_PLAN_STATUSES.map((s) => [s.status, s.label])
  ) as Record<DrawingPlanStatus, string>;

/** Varsayılan durum — yeni satır ve tanınmayan değer buraya düşer. */
export const DEFAULT_DRAWING_STATUS: DrawingPlanStatus = "bekliyor";

/**
 * Veritabanından/istemciden gelen metni bilinen bir duruma çevirir.
 *
 * Tanınmayan değer SESSİZCE "bekliyor" olur ve satır DÜŞÜRÜLMEZ: yazılmış bir
 * grup numarasını bir yazım hatası yüzünden ekrandan silmek, onu yok saymak
 * olurdu (`groupDrawingPlan`taki "Bant Dışı" kuralının aynısı).
 */
export function toDrawingStatus(value: unknown): DrawingPlanStatus {
  const v = String(value ?? "").trim();
  return DRAWING_PLAN_STATUSES.some((s) => s.status === v)
    ? (v as DrawingPlanStatus)
    : DEFAULT_DRAWING_STATUS;
}

/** Durumun yüzdeye katkısı (0–100). */
export function drawingStatusWeight(status: DrawingPlanStatus): number {
  return DRAWING_PLAN_STATUSES.find((s) => s.status === status)?.weight ?? 0;
}

export interface DrawingPlanProgress {
  /** Ağırlıklı tamamlanma yüzdesi (0–100, tam sayı) */
  percent: number;
  /** "Çizildi" işaretli grup adedi */
  done: number;
  /** Toplam grup adedi */
  total: number;
}

/**
 * Projenin teknik resim tamamlanma yüzdesi — OTOMATİK.
 *
 * Elle girilen bir yüzde ilk haftadan sonra kimsenin güncellemediği bir sayı
 * olurdu; burada yüzde satırların kendisinden çıkar ve bir grup eklendiği anda
 * kendiliğinden düşer.
 *
 * %100 YALNIZ HER SATIR "ÇİZİLDİ" İKEN ÇIKAR — yuvarlama bunu bozamaz.
 * Elli çizilmiş grubun yanında bir grup hâlâ kontroldeyse oran %99,6 eder ve
 * yuvarlanınca %100 görünürdü: "bitti" diyen bir sayı, bitmemiş bir işin
 * üstünü örter. Bu durumda yüzde %99'da kelepçelenir.
 */
export function drawingPlanProgress(
  rows: readonly { status: DrawingPlanStatus }[]
): DrawingPlanProgress {
  const total = rows.length;
  if (total === 0) return { percent: 0, done: 0, total: 0 };
  const toplam = rows.reduce((acc, r) => acc + drawingStatusWeight(r.status), 0);
  const done = rows.filter((r) => r.status === "cizildi").length;
  const ham = Math.round(toplam / total);
  return {
    percent: done === total ? 100 : Math.min(ham, 99),
    done,
    total,
  };
}

/**
 * Ana grup adı önerileri — bant başına.
 *
 * LİSTE KAPALI DEĞİLDİR (`SALE_SCOPES` ile aynı ilke, lib/tags.ts): mühendis
 * kutuya doğrudan yazabilir ve yazdığı ad korunur; öneriler yalnız hızlandırır.
 * Öneriler gerçek projelerin resim antedlerinden derlendi (0019, 0043, 0055,
 * 0057).
 */
export const DRAWING_GROUP_PRESETS: Record<DrawingBand, readonly string[]> = {
  kopru: [
    "KÖPRÜ YÜRÜTME GRUBU",
    "VİNÇ ÇELİK YAPI",
    "ANA KİRİŞ",
    "BAŞKİRİŞ",
    "ELEKTRİK ODASI TARAFI PLATFORM",
    "KARŞI TARAF PLATFORM",
    "YÜRÜTME TARAFI PLATFORM",
    "BAKIM PLATFORMU",
    "MERDİVEN VE KORKULUK",
    "ANA ARABA FESTON HATTI",
    "YARDIMCI ARABA FESTON HATTI",
    "FESTON HATTI",
    "ENERJİ BESLEME HATTI",
    "OPERATÖR KABİNİ",
    "ELEKTRİK ODASI & KLİMALAR",
    "ELEKTRİK GRUBU",
    "ELEKTRİK PANOSU",
    "SABİT YAŞAM HATTI",
    "TAMPON GRUBU",
  ],
  anaAraba: [
    "ANA ARABA KOMPLESİ",
    "ARABA KOMPLE",
    "ARABA YÜRÜTME GRUBU",
    "ARABA ŞASİ",
    "TAMBUR GRUBU",
    "TAMBUR TAHRİK GRUBU",
    "TAHRİK GRUBU",
    "ÜST MAKARA GRUBU",
    "TRAVERS GRUBU",
    "KANCA BLOĞU",
    "EMNİYET FRENİ",
    "ARABA PLATFORM",
    "ARABA BAKIM PLATFORMU",
    "KALDIRMA KİRİŞİ",
    "ARABA ELEKTRİK PANOSU",
  ],
  yardimciAraba: [
    "YARDIMCI ARABA KOMPLESİ",
    "YARDIMCI ARABA YÜRÜTME GRUBU",
    "YARDIMCI ARABA ŞASİ",
    "YARDIMCI TAMBUR GRUBU",
    "YARDIMCI TAMBUR TAHRİK GRUBU",
    "YARDIMCI ÜST MAKARA GRUBU",
    "YARDIMCI TRAVERS GRUBU",
    "YARDIMCI KANCA BLOĞU",
    "YARDIMCI ARABA PLATFORM",
    "YARDIMCI ARABA ELEKTRİK PANOSU",
  ],
  ekstra: [
    "MEKANİK KEPÇE",
    "KEPÇE",
    "MIKNATIS GRUBU",
    "KALDIRMA APARATI",
    "MONORAY GRUBU",
    "YEDEK PARÇA",
  ],
};

/** Defter satırı — tablo sütunlarıyla birebir. */
export interface DrawingPlanRow {
  id: string;
  code: string;
  name: string;
  status: DrawingPlanStatus;
  /**
   * Grubu ÇİZEN kişinin kimliği (`profiles.id`); atanmamışsa `null`.
   *
   * SERBEST METİN DEĞİL BİR BAĞ: ad yazılsaydı aynı kişi "Alkım", "Alkım
   * Kelleci" ve "A. Kelleci" olarak üç ayrı kişi gibi görünür ve "bu kişi
   * neler çiziyor" sorusu hiç cevaplanamazdı (İş Takibi'ndeki parça adı
   * dersinin aynısı, AGENTS WORKLOG-17).
   */
  drawnBy: string | null;
  /**
   * Çizenin görünen adı — okuma katmanı defterden ÇÖZER, ekran uydurmaz.
   *
   * Kimlik yanında adın da taşınması bilinçlidir: salt-okunur kipte kartın
   * elinde kişi listesi olmayabilir (ya da kişinin rolü sonradan değişip
   * listeden düşmüş olabilir) ve o zaman ekranda dolu bir alan boş görünürdü.
   */
  drawnByName: string;
  note: string;
}

/** "Çizen" seçicisinin bir satırı — ad + rol, sıra `loadDrawingAuthors`ta. */
export interface DrawingAuthor {
  id: string;
  name: string;
  role: string;
}

export interface DrawingPlanBandGroup {
  band: DrawingBand | null;
  label: string;
  rows: DrawingPlanRow[];
}

/**
 * Satırları banda göre böler ve kod sırasına dizer.
 *
 * Kod METİN olarak sıralanır: dört hane sabit olduğu için sözlük sırası
 * sayısal sıradır ve baştaki sıfır kaybolmaz. Bandı çözülemeyen satırlar
 * DÜŞÜRÜLMEZ, sona "Bant dışı" başlığıyla eklenir — yazılmış bir numarayı
 * ekrandan gizlemek, onu yok saymak olurdu.
 */
export function groupDrawingPlan(rows: readonly DrawingPlanRow[]): DrawingPlanBandGroup[] {
  const gruplar: DrawingPlanBandGroup[] = DRAWING_BANDS.map((b) => ({
    band: b.band,
    label: b.label,
    rows: [],
  }));
  const disarida: DrawingPlanRow[] = [];

  for (const row of rows) {
    const band = bandOfCode(row.code);
    const grup = band ? gruplar.find((g) => g.band === band) : undefined;
    if (grup) grup.rows.push(row);
    else disarida.push(row);
  }

  for (const g of gruplar) g.rows.sort((a, b) => a.code.localeCompare(b.code));
  disarida.sort((a, b) => a.code.localeCompare(b.code));

  const sonuc = gruplar.filter((g) => g.rows.length > 0);
  if (disarida.length > 0) {
    sonuc.push({ band: null, label: "Bant Dışı", rows: disarida });
  }
  return sonuc;
}
