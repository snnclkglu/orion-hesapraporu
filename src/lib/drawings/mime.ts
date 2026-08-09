// Uzantı → içerik tipi ve açılış davranışı.
//
// NEDEN GEREKLİ: tarayıcı `File.type` alanını YALNIZ tanıdığı türler için
// doldurur. `.pdf` ve `.xlsx` gelir; `.dwg`, `.dxf`, `.stp` BOŞ gelir ve depo
// öntanımlı bir tip yazar. Sonuç: kesimciye gidecek DXF tarayıcıda metin gibi
// açılır ya da uzantısız iner — dosya doğru, adı yanlış.
//
// İkinci sebep depo anahtarının OPAK olması (`{package_id}/{file_id}`). Bu
// bilinçli bir karar: Türkçe "İ" (U+0130) taşıyan gerçek yolu anahtar yapmak
// imzalı bağlantıda sessiz hatalar üretiyordu. Ama bedeli, indirilen dosyanın
// adının bir UUID olması — o yüzden gerçek ad indirme anında geri verilir.

/** Uzantıdan içerik tipi. Bilinmeyen uzantı ikili sayılır — tahmin edilmez. */
const TIPLER: Record<string, string> = {
  pdf: "application/pdf",
  dwg: "image/vnd.dwg",
  dxf: "image/vnd.dxf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xls: "application/vnd.ms-excel",
  stp: "model/step",
  step: "model/step",
  igs: "model/iges",
  iges: "model/iges",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain; charset=utf-8",
};

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/**
 * Yüklemede yazılacak içerik tipi.
 *
 * Tarayıcının verdiği tip VARSA ona güvenilir; yoksa uzantıdan bulunur. İkisi
 * de yoksa `application/octet-stream` — "bilmiyorum" demek, yanlış bir şey
 * söylemekten iyidir.
 */
export function contentTypeFor(fileName: string, browserType?: string): string {
  if (browserType) return browserType;
  return TIPLER[extOf(fileName)] ?? "application/octet-stream";
}

/**
 * Tarayıcıda AÇILMALI mı yoksa İNMELİ mi?
 *
 * PDF açılır — üretime inen resim odur ve mühendis ona bakmak ister. Geri
 * kalan her şey İNER: DXF kesim tezgâhına, DWG Inventor'a, XLSX satınalmaya
 * gider. Hiçbiri tarayıcıda işe yaramaz ve yeni sekmede açılmaya çalışılınca
 * ya boş sayfa ya metin çöplüğü çıkar.
 */
export function opensInBrowser(fileName: string): boolean {
  const e = extOf(fileName);
  return e === "pdf" || e === "png" || e === "jpg" || e === "jpeg";
}
