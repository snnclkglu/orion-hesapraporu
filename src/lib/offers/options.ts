// DEFTER MADDESİ ÇÖZÜMLEME — kademeli listenin ebeveynini bulmak.
//
// Kural arayüzde değil BURADA durur çünkü bir DOMAİN kuralıdır: "seri, markanın
// çocuğudur ve marka çok değerliyse ebeveyn İLK markadır". Editörün içinde
// yazılıydı ve orada sınanamıyordu — kademeli listenin çalıştığını görmek için
// açılır kutuyu açmak gerekiyor, açılır kutu ise gizli bir tarayıcı sekmesinde
// odak olayı almıyor (ölçüldü, 17.08.2026). Kuralı saf tutmak, onu testle
// doğrulanabilir yapar.

import { trKatla } from "@/lib/drawings/tr-text";
import { firstMulti } from "./multi";

/** `offer_options` satırının çözümleme için gereken en küçük şekli. */
export interface OfferOptionLike {
  id: string;
  value: string;
}

/**
 * Ebeveyn maddeyi bulur.
 *
 * Eşleşme KATLANMIŞ metinledir (`trKatla`): defterdeki "SİBRE" ile kutuya
 * yazılan "sibre " tek maddedir (`offer_options.match_key` ile birebir aynı
 * kural). Çok değerli markada İLK marka okunur — "SEW/FLENDER" diye bir marka
 * yoktur, SEW vardır ve seri listesi onun çocuklarıdır.
 */
export function parentOption<T extends OfferOptionLike>(
  secenekler: readonly T[],
  ebeveynDeger: string
): T | undefined {
  const ad = firstMulti(ebeveynDeger ?? "");
  if (!ad) return undefined;
  const anahtar = trKatla(ad);
  return secenekler.find((o) => trKatla(o.value) === anahtar);
}
