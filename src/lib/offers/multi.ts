// ÇOK MARKALI DEĞER — "SIEMENS/ABB", "SEW/FLENDER", "Yılmaz R./Flender".
//
// Kullanıcı isteği (17.08.2026): *"Ekipmanlara ekstra marka ekleme özelliği
// olsun. Örneğin redüktör Yılmaz Redüktör ve Flender olarak ikisini
// belirtebileyim. Bunun gibi diğer ekipmanlarda da istersem ekleyebileyim."*
//
// İhtiyaç gerçektir ve firmanın kendi belgelerinde ZATEN VAR: devralınan on
// dört teklifte `Motor : SIEMENS/ABB 110 kW`, `Redüktör : SEW/FLENDER`,
// `Motor : ELK/GAMAK 30 kW` ve `Güç Kaynağı : Omron / Phoenix` satırları
// geçiyor. Yani "iki marka birden" bir istisna değil, teklifin normal bir
// yazımıdır: müşteriye "bu ekipmanı şu iki markadan biriyle veririz" denir.
//
// DEĞER YİNE TEK METİNDİR, dizi DEĞİL. Bu bilinçli bir seçimdir:
//   · `composeValue`, PDF, `printedRows` ve karşılaştırma hiç değişmez;
//   · yayımlanmış tekliflerin payload'ı bir şekil değişikliği yaşamaz
//     (revizyon bir SNAPSHOT'tır — dizi olsaydı `withDefaults` eski belgeleri
//     yeni şekle taşımak zorunda kalır ve teslim edilmiş bir belgenin metnini
//     yeniden üretirdi);
//   · defter (`offer_options`) tek marka saklamaya devam eder — "SEW/FLENDER"
//     diye bir MARKA yoktur, iki marka vardır.
// Çokluk yalnız EKRANIN kipidir: kutular ayrı çizilir, değer birleşik saklanır.
//
// AYIRAÇ BOŞLUKSUZDUR (`/`). Belgelerde iki yazım da var ("SIEMENS/ABB" ve
// "Omron / Phoenix"); boşluksuzu seçildi çünkü marka satırın BAŞINDA durur ve
// ardından boşlukla bağlanan başka parçalar gelir: "SIEMENS / ABB 110 kW"
// okunduğunda ABB ile 110 kW'ın aynı öbeğe ait olup olmadığı belirsizleşir,
// "SIEMENS/ABB 110 kW" ise iki markayı tek alan olarak okutur.

/** Çok değerli alanın ayıracı. */
export const MULTI_SEP = "/";

/**
 * Birleşik değeri parçalarına ayırır. Boş dilim DÜŞER ("A//B" → ["A","B"]) ama
 * dizinin kendisi hiç boşalmaz: en az bir (boş) kutu her zaman çizilmelidir,
 * yoksa alan ekranda görünmez olur.
 */
export function splitMulti(value: string): string[] {
  const parcalar = (value ?? "")
    .split(MULTI_SEP)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return parcalar.length > 0 ? parcalar : [""];
}

/** Kutuları tek değere birleştirir; boş kutular sessizce düşer. */
export function joinMulti(values: readonly string[]): string {
  return values
    .map((v) => (v ?? "").trim())
    .filter((v) => v !== "")
    .join(MULTI_SEP);
}

/**
 * İLK değer — kademeli listelerin ebeveyni budur.
 *
 * Seri/tip listesi markanın ÇOCUĞUDUR (`childOf: "brand"`). Marka
 * "SEW/FLENDER" olduğunda defterde o adla bir madde YOKTUR ve seri listesi
 * bomboş kalırdı; ilk markaya bakılır, yani "SEW/FLENDER" için SEW'in serileri
 * önerilir. İkinci marka bir ALTERNATİFTİR ve teklifte seri çoğunlukla
 * birincisinin yazımıyla anılır.
 */
export function firstMulti(value: string): string {
  return splitMulti(value)[0] ?? "";
}

/**
 * Bu liste çok değerli mi.
 *
 * MARKA LİSTELERİ ÇOKTUR, ölçü ve tanım listeleri değil: "Ø400 / Ø500" bir
 * tekerlek çapı değil iki farklı tekerlektir, "14 iş günü / 20 iş günü" ise bir
 * geçerlilik süresi değil bir belirsizliktir. Kural anahtarın önekinden çıkar
 * (`offerListGroup` ile aynı düzen) — böylece bugün var olan ve yarın eklenecek
 * BÜTÜN marka alanları kendiliğinden çok markalı olur ve alan alan işaretlemek
 * gerekmez.
 */
export function isMultiValueList(listKey: string | undefined): boolean {
  return (listKey ?? "").startsWith("brand.");
}
