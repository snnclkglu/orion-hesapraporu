// MEKANİZMA SINIFININ GÖSTERİM KARŞILIĞI — ISO M-sınıfı → FEM grubu.
//
// NEDEN AYRI DOSYA: bu eşleme `pdf/report.tsx` içinde özel bir sabitti ve orası
// @react-pdf'i, diyagramları ve bütün rapor gövdesini içeri alır. Vinç kimlik
// plakası aynı satırı ("FEM 3m / ISO M6") basmak zorundadır ama bir metin alanı
// için o ağırlığı proje sayfasına taşıyamaz. Eşlemeyi kopyalamak, bir gün
// ikisinin ayrışması demekti (değişmez md. 8) — burada TEK tanım vardır ve
// `report.tsx` ile plaka aynı dosyadan okur.
//
// DİKKAT — `calc/hook-table.ts` içindeki `DIN15020_GROUP_BY_MECHANISM_CLASS` ile
// KARIŞTIRMA. O eşleme DIN 15020'nin kanca seçimi içindir ve M1–M4'ü bilerek
// 1Bm'de toplar (standardın "1Bm'den hafif çalışma dikkate alınmaz" hükmü).
// Buradaki eşleme GÖSTERİMDİR: kapakta ve plakada okunan FEM grubudur.

/** Ana kaldırma mekanizması için FEM grubu ve ISO sınıfı eşlemesi. */
export const FEM_GROUP_BY_ISO_CLASS: Record<string, string> = {
  M1: "1Bm", M2: "1Bm", M3: "1Am", M4: "2m",
  M5: "2m", M6: "3m", M7: "4m", M8: "5m",
};

/** Kapak ve plakadaki tek satırlık çalışma sınıfı gösterimi. */
export function mechanismClassText(isoClass: string): string {
  const key = String(isoClass ?? "").trim();
  if (!key) return "";
  const femGroup = FEM_GROUP_BY_ISO_CLASS[key];
  return femGroup ? `FEM ${femGroup} / ISO ${key}` : `ISO ${key}`;
}
