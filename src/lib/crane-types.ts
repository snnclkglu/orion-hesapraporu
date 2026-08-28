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
 * Yalnız TEKLİF hesap raporunda sunulan ilave tipler.
 *
 * "Yer Vinci" bina içinde zemine/kaideye sabitlenen bir kaldırma grubudur:
 * araba yürütmesi, köprü yürütmesi ve köprü taşıyıcı yapısı yoktur. Mühendislik
 * arşivinin genel tip listesine eklenmez; kayıt başka bağlama taşınmışsa
 * `craneTypeOptions` mevcut serbest metni yine korur.
 */
export const GROUND_CRANE_TYPE = "Yer Vinci" as const;
export const OFFER_CRANE_TYPES = [...CRANE_TYPES, GROUND_CRANE_TYPE] as const;

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

/**
 * Sabit yer vincinde köprü/yapı tarafında bulunmayan bölümler.
 *
 * Yürütme modülleri bu listeden değil `specs.travelArrangement = "fixed"`
 * topolojisinden düşer. Liste yalnız köprü kapalıyken de bağımsız çalışabilen
 * buruşma ve başkiriş gibi yapı bölümlerinin şablondan sızmasını önler.
 */
export const GROUND_CRANE_DISABLED_MODULES: readonly string[] = [
  ...TROLLEY_ONLY_DISABLED_MODULES,
];

/** Yalnız araba raporu mu — vinç tipi künyesine bakar. */
export function isTrolleyOnlyCraneType(craneType: string | null | undefined): boolean {
  return (craneType ?? "").trim() === "Vinç Arabası";
}

/** Zemine/kaideye sabit, hiçbir yürütme ekseni olmayan teklif vinci mi. */
export function isGroundCraneType(craneType: string | null | undefined): boolean {
  return (craneType ?? "").trim() === GROUND_CRANE_TYPE;
}

/**
 * Vinç tipinin yalnız V0 doğarken yazdığı revizyon TOHUMU.
 *
 * Tip hesap motoruna girmez. Bu saf yardımcı tipten, revizyonun kendi teknik
 * topoloji ve kapalı bölüm verisini üretir; motor daha sonra yalnız bu snapshot'ı
 * okur. Şablonun değerleri ezilmez, kapalı listeler birleştirilir.
 */
export function applyCraneTypeRevisionPreset(
  revNo: number,
  craneType: string | null | undefined,
  inherited: Record<string, unknown>
): Record<string, unknown> {
  if (revNo !== 0) return inherited;

  const trolleyOnly = isTrolleyOnlyCraneType(craneType);
  const groundCrane = isGroundCraneType(craneType);
  if (!trolleyOnly && !groundCrane) return inherited;

  const previous = Array.isArray(inherited.disabledModules)
    ? inherited.disabledModules.filter((key): key is string => typeof key === "string")
    : [];
  const prescribed = trolleyOnly
    ? TROLLEY_ONLY_DISABLED_MODULES
    : GROUND_CRANE_DISABLED_MODULES;

  const storedSpecs =
    inherited.specs &&
    typeof inherited.specs === "object" &&
    !Array.isArray(inherited.specs)
      ? (inherited.specs as Record<string, unknown>)
      : {};

  return {
    ...inherited,
    ...(groundCrane
      ? { specs: { ...storedSpecs, travelArrangement: "fixed" } }
      : {}),
    disabledModules: [...new Set([...previous, ...prescribed])],
  };
}

export type CraneType = (typeof OFFER_CRANE_TYPES)[number];

export const DEFAULT_CRANE_TYPE: string = CRANE_TYPES[0];

/**
 * Seçim kutusunun seçenekleri. Kayıtlı değer listede yoksa listenin BAŞINA
 * eklenir; hiçbir kayıt seçim kutusu yüzünden değişmez.
 */
export function craneTypeOptions(...current: (string | null | undefined)[]): string[] {
  return optionsWithCurrent(CRANE_TYPES, current);
}

/** Teklif hesap raporu seçimleri; "Yer Vinci" burada görünür. */
export function offerCraneTypeOptions(
  ...current: (string | null | undefined)[]
): string[] {
  return optionsWithCurrent(OFFER_CRANE_TYPES, current);
}

function optionsWithCurrent(
  base: readonly string[],
  current: readonly (string | null | undefined)[]
): string[] {
  const out: string[] = [...base];
  for (const value of current) {
    const v = (value ?? "").trim();
    if (v && !out.includes(v)) out.unshift(v);
  }
  return out;
}
