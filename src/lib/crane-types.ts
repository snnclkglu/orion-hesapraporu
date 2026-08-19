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
  // VİNÇ ARABASI BİR VİNÇ DEĞİL, BİR PARÇADIR (kullanıcı kararı, 19.08.2026):
  // müşteri bazen yeni vinç istemez, yalnız mevcut vincin arabasını yeniler.
  // Rapor o zaman kaldırma + araba yürütme bölümlerinden ibarettir; köprü
  // yürütme, teker yükleri, ana kiriş ve başkiriş bölümleri kapatılır.
  // Kapatma kararı YİNE TEKNİK ÖZELLİKLERDEDİR (bkz. `TROLLEY_ONLY_MODULES`);
  // tip yalnız ilk revizyonun kapalı bölüm listesini ÖNERİR, motora girmez.
  "Vinç Arabası",
] as const;

/**
 * "Vinç Arabası" tipiyle açılan raporun İLK revizyonunda kapalı gelen hesap
 * bölümleri — bir ÖNERİdir, kural değil.
 *
 * Vinç tipi bir künye alanıdır ve hesap motoru onu HİÇ OKUMAZ (bkz.
 * `docs/agent/hesap.md` HESAP-8b): bütün topoloji kararları teknik
 * özelliklerdedir. Bu liste de motorun değil, yalnız `createRevision`ın
 * gördüğü bir başlangıç değeridir; mühendis ilk ekranda kutucukları geri
 * açabilir ve kararı revizyonun kendi `inputs.disabledModules` alanında yaşar.
 * Liste burada durur çünkü tek okuyucusu vinç tipidir.
 */
export const TROLLEY_ONLY_DISABLED_MODULES: readonly string[] = [
  "bridge",
  "wheelLoads",
  "girder",
  "girder2",
  "buckling",
  "endCarriage",
];

/** Yalnız araba raporu mu — vinç tipi künyesine bakar. */
export function isTrolleyOnlyCraneType(craneType: string | null | undefined): boolean {
  return (craneType ?? "").trim() === "Vinç Arabası";
}

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
