// Belge kimliği ve İNDİRME DOSYA ADI — tek kaynak.
//
// Dosya adları belge belge farklı düzenlerdeydi (`0055-V1.pdf`,
// `0055-V1-ekipman-listesi.pdf`, `0075 - Muhtelif Vinçler - İş Emri.pdf`) ve
// indirilenler klasöründe hangi dosyanın ne olduğu ancak açılınca anlaşılıyordu.
// Firma kuralı: **İŞ ADI - DOKÜMAN KODU - VERSİYON**, tamamı BÜYÜK HARF, sonda
// belgenin türü/seviyesi.
//
// Büyük harf `tr-TR` ile yapılır: `toUpperCase()` "i" harfini "I" yapar ve
// "İşin adı" → "ISIN ADI" olurdu.

/** `ORC-HR-0055-R01` · `ORC-EQ-0055-R01` — belge kimliği. */
export function docCode(kind: "HR" | "EQ", docNo: string, revNo: number): string {
  return `ORC-${kind}-${docNo}-R${String(revNo).padStart(2, "0")}`;
}

/**
 * Windows/macOS dosya adında kullanılamayan karakterler.
 * Nokta ve tire KALIR: doküman kodunun bir parçasıdırlar.
 */
function safe(part: string): string {
  return part.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parçaları " - " ile birleştirip büyük harfe çevirir ve `.pdf`/`.xlsx` uzantısını
 * ekler. Boş parçalar düşer — versiyonu olmayan belge (iş emri) sessizce
 * kısalır, ada boşluk ya da çift ayraç girmez.
 */
export function downloadFileName(
  parts: readonly (string | null | undefined)[],
  ext: "pdf" | "xlsx" = "pdf"
): string {
  const name = parts
    .map((p) => safe((p ?? "").toString()))
    .filter(Boolean)
    .join(" - ")
    .toLocaleUpperCase("tr-TR");
  return `${name || "ORION"}.${ext}`;
}

/** Rapor seviyesinin dosya adındaki karşılığı. */
export const REPORT_LEVEL_LABELS: Record<string, string> = {
  detayli: "Detaylı",
  standart: "Standart",
  ozet: "Özet",
};
