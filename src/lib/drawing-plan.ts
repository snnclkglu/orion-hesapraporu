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
// (AGENTS md. 14).
//
// BANT KURALI FİRMANINDIR ve tek yerde tanımlıdır: köprünün grupları 1500'ün
// altında, arabanınkiler 1500–3000 arasında, kepçe/mıknatıs gibi ekler
// 3000'den sonra numaralanır. Bant bir sütun DEĞİL koddan türeyen bir sonuçtur
// — iki yerde tutulsaydı biri güncellenip diğeri unutulurdu.
//
// ADIM 50'DİR, 100 değil. Gerçek projelerde ara numaralar kullanılıyor
// (0019-00-0950 "ELEKTRİK GRUBU", 0800 ile 1000 arasına sıkışmış); dropdown
// yalnız yüzlükleri gösterseydi mühendis o numarayı hiç veremezdi.

/** Ana grup bandı — kod aralığından TÜRETİLİR, saklanmaz. */
export type DrawingBand = "kopru" | "araba" | "ekstra";

export interface DrawingBandDef {
  band: DrawingBand;
  label: string;
  /** Bandın ilk kodu (dahil) */
  first: number;
  /** Bandın son kodu (dahil) */
  last: number;
  /** Kullanıcıya gösterilen aralık metni */
  rangeText: string;
}

/** Bant tanımları — listeleme ve dropdown sırası budur. */
export const DRAWING_BANDS: readonly DrawingBandDef[] = [
  { band: "kopru", label: "Köprü Grubu", first: 100, last: 1450, rangeText: "0100–1450" },
  { band: "araba", label: "Araba Grubu", first: 1500, last: 2950, rangeText: "1500–2950" },
  { band: "ekstra", label: "Ekstra Gruplar", first: 3000, last: 3950, rangeText: "3000–3950" },
];

export const DRAWING_BAND_LABELS: Record<DrawingBand, string> = {
  kopru: "Köprü Grubu",
  araba: "Araba Grubu",
  ekstra: "Ekstra Gruplar",
};

/** Dropdown adımı — bkz. dosya başlığındaki gerekçe. */
const CODE_STEP = 50;

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

/**
 * Ana grup adı önerileri — bant başına.
 *
 * LİSTE KAPALI DEĞİLDİR (`SALE_SCOPES` ile aynı ilke, lib/tags.ts): mühendis
 * "Diğer" ile serbest metin yazabilir ve kayıttaki değer listede yoksa seçici
 * onu kendi seçeneği olarak korur. Öneriler gerçek projelerin resim
 * antedlerinden derlendi (0019, 0043, 0055, 0057).
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
  araba: [
    "ARABA KOMPLE",
    "ANA ARABA KOMPLESİ",
    "YARDIMCI ARABA KOMPLESİ",
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
  drawn: boolean;
  note: string;
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
