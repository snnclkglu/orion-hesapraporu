// Excel çıktılarının ORTAK MARKA KATMANI: kömür başlık bandı, mono künye
// satırı, kırmızı ince ayraç, tablo başlığı ve otomatik sütun genişliği.
//
// NEDEN TEK DOSYA: bu dörtlü (colLetter + writeTitleBlock + styleHeaderRow +
// autoWidth) üç ayrı Excel üreticisinde birebir kopyalanmıştı ve DÖRDÜNCÜSÜ
// (parça defteri) marka bandını hiç basmıyordu. Kullanıcı aynı paketin
// dosyalarını yan yana açıyor; birinin markasız olması ekranda GÖRÜNEN bir
// sapmaydı. Marka bir "fizik" değildir ama AGENTS.md md. 5'in gerekçesi aynen
// geçerlidir: tek tanım, dört çağrı yeri.
//
// PARAMETRE OLANLAR modülden modüle gerçekten değişenlerdir: başlık öneki,
// künye satırının parçaları, ayracın altındaki etiket/değer satırları ve sütun
// genişliği sınırları.
// PARAMETRE OLMAYANLAR renkler, yazı tipleri, satır yükseklikleri ve blok
// düzenidir — marka tam da orada başlar. Çağıran taraf bunları seçebilseydi
// dosyalar yine ayrışırdı, yalnız ayrışma bir kopyala-yapıştır yerine bir
// argüman üzerinden olurdu.

import ExcelJS from "exceljs";

// --- renkler -----------------------------------------------------------------
// design-system/readme.md ile birebir. ExcelJS ARGB ister: alfa ÖNDE durur,
// "FF" tam opak demektir — CSS'teki #RRGGBB doğrudan yapıştırılamaz.

/** Kömür — başlık bandının zemini */
export const CHARCOAL = "FF262626";
/** Kağıt 100 — kömür zemin üzerindeki metin */
export const PAPER = "FFF4F1EF";
/** Kağıt 150 — toplam satırı */
export const PAPER_150 = "FFF1EEEC";
/** Kağıt 200 — tablo başlığı ve grup başlığı */
export const PAPER_200 = "FFE7E4E2";
/** Orion Kırmızısı — YALNIZ ince ayraç ve uyarı vurgusu */
export const ORION_RED = "FFA41E1E";
/** Nötr gri — altbilgi ve ikincil (alternatif) satır metni */
export const MUTED_GRAY = "FF6F6A64";
/** Tablo çizgisi — hücre kenarlığı */
export const HAIRLINE = "FF9CA3AF";

// --- yazı tipleri ------------------------------------------------------------
// PDF tarafındaki ayrımın aynısı: görünen metin Archivo, her sayı/kod/etiket
// mono. Excel bu iki aileyi kullanıcının makinesinde bulamazsa kendi
// varsayılanına düşer; bu kabul edilmiş bir kayıptır, gömme seçeneği yoktur.

export const TITLE_FONT = "Archivo";
export const MONO_FONT = "IBM Plex Mono";

// --- dolgular ----------------------------------------------------------------

/** Başlık bandı (kömür) */
export const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: CHARCOAL },
};
/** Kırmızı ince ayraç — marka omurgasının tablodaki karşılığı */
export const RED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: ORION_RED },
};
/** Tablo başlığı / grup başlığı (Kağıt 200) */
export const COL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: PAPER_200 },
};
/** Toplam satırı (Kağıt 150) */
export const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: PAPER_150 },
};

// --- modül önekleri ----------------------------------------------------------

/**
 * Başlık bandının modül kimliği: bir modülün BÜTÜN çıktıları aynı dizgeyi
 * basar. Ayrı ayrı yazıldığında aynı paketin iki dosyası iki farklı ad
 * gösteriyordu.
 *
 * Kısa marka işareti ("ORION") bilinçlidir; tam unvan (`COMPANY_NAME`,
 * lib/app.ts) altbilgide ve PDF'in doküman satırında durur. Bant tek satırdır
 * ve başlığın kendisiyle yarışmamalıdır.
 */
export const MODULE_PREFIX = {
  workLog: "ORION — İŞ TAKİBİ",
  drawings: "ORION — TEKNİK RESİMLER",
} as const;

// --- yardımcılar -------------------------------------------------------------

/**
 * Sütun numarası → Excel harfi (1 → "A", 26 → "Z", 27 → "AA").
 *
 * `String.fromCharCode(64 + n)` kestirmesi 26 sütuna kadar doğru görünür,
 * 27'de "[" üretir ve merge adresi sessizce bozulur. Parça defteri 13, teknik
 * resim çıktıları 11 sütunla çalışıyor; sınır uzak değil.
 */
export function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export interface TitleBlockOptions {
  /**
   * Başlığın önüne konan modül kimliği (`MODULE_PREFIX`). Verilmezse başlık
   * ham yazılır — müşteriye giden ekipman listesi böyledir: orada marka adı
   * altbilgide ve PDF eşinde logoda durur, başlık satırı belgenin KENDİ adıdır.
   */
  prefix?: string;
  /**
   * Künye satırının parçaları. Boş olanlar düşer, kalanlar " · " ile birleşir:
   * her modül kendi elemesini yapmasın diye eleme burada.
   */
  meta?: readonly (string | number | null | undefined)[];
  /**
   * Kırmızı ayracın ALTINA etiket/değer olarak basılan ek künye satırları
   * (ekipman listesinde müşteri · hazırlayan · kontrol). Her satır tablo
   * başlığını bir aşağı iter; döndürülen satır numarası bunu zaten içerir.
   */
  details?: readonly (readonly [label: string, value: string])[];
}

/**
 * Marka bandını basar: kömür başlık + mono künye + kırmızı ince ayraç
 * (+ isteğe bağlı etiket/değer satırları). TABLO BAŞLIĞININ satır numarasını
 * döndürür — çağıran taraf satır saymaz, döneni kullanır.
 *
 * Bant ile tablo arasında bir boş satır bırakılır: başlık satırı bandın
 * dibine yapıştığında iki ayrı şey tek blok gibi okunuyordu.
 */
export function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  colCount: number,
  options: TitleBlockOptions = {}
): number {
  // Tek sütunluk bir sayfada bile bandın basılması gerekir; 0/negatif sütun
  // hem merge adresini hem dolgu döngüsünü boşa düşürürdü.
  const cols = Math.max(colCount, 1);
  const last = colLetter(cols);

  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell("A1");
  t.value = options.prefix ? `${options.prefix} · ${title}` : title;
  t.font = { name: TITLE_FONT, bold: true, size: 14, color: { argb: PAPER } };
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(`A2:${last}2`);
  const k = ws.getCell("A2");
  k.value = (options.meta ?? [])
    .map((part) => (typeof part === "number" ? String(part) : part))
    .filter((part): part is string => !!part && part.trim() !== "")
    .join(" · ");
  k.font = { name: MONO_FONT, size: 9, color: { argb: PAPER } };
  k.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 16;

  // Birleşik hücrelerin kenar kolonları merge sonrası boyasız kalmasın.
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= cols; c++) ws.getRow(r).getCell(c).fill = HEADER_FILL;
  }

  ws.mergeCells(`A3:${last}3`);
  for (let c = 1; c <= cols; c++) ws.getRow(3).getCell(c).fill = RED_FILL;
  ws.getRow(3).height = 3;

  const details = options.details ?? [];
  details.forEach(([label, value], index) => {
    const row = ws.getRow(4 + index);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  // 3 satırlık bant + künye satırları + bir boş satır.
  return 4 + details.length + 1;
}

/** Tablo başlığı: Kağıt 200 zemin, Archivo yarı-koyu, ince alt çizgi. */
export function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.height = 18;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = COL_FILL;
    cell.font = { name: TITLE_FONT, bold: true, size: 10 };
    cell.border = { bottom: { style: "thin", color: { argb: HAIRLINE } } };
  }
}

/**
 * Otomatik sütun genişliği: her sütunun en uzun metnine göre, `min`..`max`
 * arasında kelepçelenerek.
 *
 * BİRLEŞİK HÜCRELER ÖLÇÜME GİRMEZ: künye, grup başlığı ve altbilgi tek kolona
 * sığmak zorunda değildir; ölçüme katılsalardı ilk sütun tek başına sayfayı
 * doldururdu.
 *
 * Varsayılan sınırlar tablo çıktılarınındır; uzun serbest metin taşıyan
 * sayfalar (ekipman özellikleri, künye) kendi sınırını verir.
 */
export function autoWidth(ws: ExcelJS.Worksheet, min = 9, max = 46): void {
  ws.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      if (cell.isMerged) return;
      const len = String(cell.value ?? "").length + 2;
      if (len > width) width = len;
    });
    col.width = Math.min(width, max);
  });
}
