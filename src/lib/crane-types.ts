// Vinç tipi listesi — TEK KAYNAK.
//
// Liste bir süre "Yeni Hesap Raporu" penceresinin içinde duruyordu; sonra aynı
// listeye üç yer daha ihtiyaç duydu (yönetim panelindeki varsayılan vinç tipi,
// proje bilgisi düzenleme penceresi ve teknik özelliklerdeki topoloji kararı).
// İkinci bir kopya yazmak, listeye eklenen bir tipin bir ekranda görünüp
// diğerinde görünmemesi demekti.
//
// KAYITLI DEĞER SERBEST METİNDİR (`projects.crane_type`). Devralınan ya da elle
// yazılmış bir tip listede olmayabilir; `craneTypeOptions` onu KENDİ SEÇENEĞİ
// olarak korur — aksi hâlde pencere açılır açılmaz kayıtlı tipi sessizce
// listenin ilk elemanına çevirirdi (Satış Takibi'ndeki "kapsam" dersinin
// aynısı).

export const CRANE_TYPES = [
  "Çift Kirişli Gezer Köprülü Vinç",
  "Tek Kirişli Gezer Köprülü Vinç",
  // Şarj / döküm vinci: pota taşıyan ağır hizmet vinci. Ana kaldırma ve
  // yardımcı kaldırma AYRI kirişler üzerinde yürüyebilir; hesapta ikinci bir
  // ana kiriş bölümü açılabilir (bkz. TechnicalSpecs.girderArrangement).
  "Şarj / Döküm Vinci",
  "Portal Vinç",
  "Yarı Portal Vinç",
  "Pergel Vinç",
  "Alttan Askılı Vinç",
  "Konsol Vinç",
] as const;

export type CraneType = (typeof CRANE_TYPES)[number];

export const DEFAULT_CRANE_TYPE: string = CRANE_TYPES[0];

/**
 * Seçim kutusunun seçenekleri. Kayıtlı değer listede yoksa listenin BAŞINA
 * eklenir; hiçbir kayıt seçim kutusu yüzünden değişmez.
 */
export function craneTypeOptions(...current: (string | null | undefined)[]): string[] {
  const out: string[] = [...CRANE_TYPES];
  for (const value of current) {
    const v = (value ?? "").trim();
    if (v && !out.includes(v)) out.unshift(v);
  }
  return out;
}
