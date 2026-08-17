// PARÇALARDAN DEĞER DERLEME — teklif satırının tek yazım kuralı.
//
// Devralınan tekliflerde motor satırı böyle yazılıyordu:
//     Motor : GAMAK 22 kW 1500 d/dak, Encoderli, F/S3, IP55, IE3
// Yani üç ayrı bilgi (marka · güç · devir) boşlukla, ek özellikler VİRGÜLLE
// bağlanıyor. Kural belgelere bakılarak çıkarıldı ve tek yerde durur: satır
// hangi ekranda kurulursa kurulsun aynı yazımı üretir.
//
// BOŞ PARÇA SESSİZCE DÜŞER — ayıraç da onunla birlikte. Marka girilmemiş bir
// motor "  22 kW" değil "22 kW" olur; virgülle başlayan bir değer hiç oluşmaz.

import type { OfferPartDef, OfferRow, OfferRowDef } from "./types";

function parcaMetni(def: OfferPartDef, ham: string | undefined): string {
  const v = (ham ?? "").trim();
  if (!v) return "";
  return `${def.prefix ?? ""}${v}${def.suffix ?? ""}`;
}

/**
 * Parçalardan basılacak metni kurar.
 *
 * AYIRAÇ PARÇANIN KENDİ KARARIDIR, yapışkan bir kip değil: `comma` işaretli
 * parça kendinden öncekine VİRGÜLLE, işaretsiz parça BOŞLUKLA eklenir.
 *
 * Bir süre kip yapışkandı ("ilk virgülden sonrası hep virgül") ve bu, iki
 * parçası virgül-boşluk sırasıyla dizilen satırları yazamıyordu: çalışma ortamı
 * satırı `Kapalı Alan, -10 / +40 º C` olmalıyken `Kapalı Alan, -10, / +40 º C`
 * çıkıyordu. Parça başına karar hem bunu çözer hem de mevcut bütün satırların
 * yazımını AYNEN korur (motorun ek özellik kuyruğu, redüktörün emniyet
 * katsayısı) — çünkü orada zaten kuyruğun tamamı işaretlidir.
 */
export function composeValue(parts: readonly OfferPartDef[], values: Record<string, string>): string {
  let sonuc = "";
  for (const def of parts) {
    const metin = parcaMetni(def, values[def.key]);
    if (!metin) continue;
    // İLK dolu parça ayıraçsız başlar: yalnız "Encoderli" yazılmış bir satır
    // ", Encoderli" diye başlayamaz.
    if (!sonuc) sonuc = metin;
    else sonuc += def.comma ? `, ${metin}` : ` ${metin}`;
  }
  return sonuc;
}

/**
 * Satırın basılacak değerini döndürür.
 *
 * ELLE YAZILMIŞ DEĞER KUTSALDIR: `manual` açıkken parçalar ne olursa olsun
 * `value` korunur. Kullanıcı "istediğim satırı elle hızlı değiştirebileyim"
 * dediğinde istediği tam olarak budur — derleme onun yazdığını bir sonraki
 * kaydetmede sessizce geri almamalıdır.
 */
export function rowValue(row: OfferRow, def?: OfferRowDef): string {
  if (row.manual) return row.value ?? "";
  if (!def?.parts?.length) return row.value ?? "";
  return composeValue(def.parts, row.parts ?? {});
}

/**
 * Satırı, derlenmiş değeri `value` alanına yazılmış hâliyle döndürür.
 *
 * Kaydetme yolu bunu çağırır: `value` VERİDİR, sunumda hesaplanan bir şey
 * değil. Böylece PDF, karşılaştırma ve dışa aktarım defteri okumak zorunda
 * kalmaz — belge kendi kendine yeter ve defter yarın değişse yayımlanmış
 * teklif aynı kalır.
 */
export function withComposedValue(row: OfferRow, def?: OfferRowDef): OfferRow {
  const value = rowValue(row, def);
  return value === row.value ? row : { ...row, value };
}

/** Satırın gerçekten bir şey söyleyip söylemediği — boş satır belgeye girmez. */
export function rowHasValue(row: OfferRow): boolean {
  return (row.value ?? "").trim().length > 0;
}

// ————————————————————————————————————————————————————— türetilen parça

/**
 * Ondalıklı sayıyı Türkçe yazımdan okur; okunamıyorsa `null`.
 *
 * Kutuya "18,5" da "18.5" de yazılabilir — ikisi de aynı sayıdır ve kullanıcıyı
 * bir ayıraca zorlamak, hesabın sessizce durması demekti.
 */
export function partSayi(ham: string | undefined): number | null {
  const t = (ham ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sayıyı belgenin yazımıyla basar: ondalık ayıracı VİRGÜLDÜR ve gereksiz
 * sıfır kuyruğu yoktur (37 → "37", 55,5 → "55,5").
 */
export function partMetin(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace(".", ",");
}

/**
 * TÜRETİLEN PARÇALARI hesaplar — bugün yalnız `powerTotal`.
 *
 * Kullanıcı isteği (17.08.2026): *"Sürücü toplam güç, Güç x adet otomatik
 * yazsın."* Defter satırı bu toplamı zaten basıyordu ama sayıyı İNSAN yazıyordu;
 * 18,5 kW'lık dört sürücünün toplamını elle çarpmak, teklifte yapılabilecek en
 * sessiz hatadır — belge kendi içinde tutarlı görünür ve yalnız müşteri
 * hesaplarsa yanlışlık çıkar. Türetilmiş bir sayının ayrışma ihtimali yoktur
 * (TEKLIF-20'nin kalem künyesindeki gerekçesiyle aynı).
 *
 * ADET 1 İSE TOPLAM YAZILMAZ: "18,5 kW x 1 Adet (18,5 kW)" satırında aynı sayı
 * iki kez geçer ve bu bilgi değil gürültüdür (defterin kendi kuralı,
 * `DRIVE_PARTS`). Güç ya da adet okunamıyorsa toplam BOŞALIR — uydurma bir
 * sayı üretmek yerine alan boş kalır (değişmez md. 4).
 */
export function derivedParts(
  parts: readonly OfferPartDef[],
  values: Record<string, string>
): Record<string, string> {
  let sonuc = values;
  for (const def of parts) {
    if (def.derived !== "powerTotal") continue;
    const guc = partSayi(values.power);
    const adet = partSayi(values.count);
    const toplam = guc !== null && adet !== null && adet > 1 ? partMetin(guc * adet) : "";
    if ((values[def.key] ?? "") === toplam) continue;
    sonuc = { ...sonuc, [def.key]: toplam };
  }
  return sonuc;
}
