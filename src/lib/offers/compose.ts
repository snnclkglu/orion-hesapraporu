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
 * `comma` işaretli İLK parçadan itibaren ayıraç virgüle döner ve öyle kalır:
 * belgede ek özellikler her zaman bir kuyruktur, araya karışmaz.
 */
export function composeValue(parts: readonly OfferPartDef[], values: Record<string, string>): string {
  let govde = "";
  let kuyruk: string[] = [];
  let virgulBasladi = false;

  for (const def of parts) {
    if (def.comma) virgulBasladi = true;
    const metin = parcaMetni(def, values[def.key]);
    if (!metin) continue;
    if (virgulBasladi) kuyruk.push(metin);
    else govde = govde ? `${govde} ${metin}` : metin;
  }

  // Gövde boşsa kuyruğun ilki gövde olur: yalnız "Encoderli" yazılmış bir
  // satır ", Encoderli" diye başlayamaz.
  if (!govde && kuyruk.length) {
    govde = kuyruk[0];
    kuyruk = kuyruk.slice(1);
  }
  return kuyruk.length ? `${govde}, ${kuyruk.join(", ")}` : govde;
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
