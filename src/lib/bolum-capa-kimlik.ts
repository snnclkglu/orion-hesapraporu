// ÇIPA KİMLİĞİ — saf, kancasız, `"use client"` YOK.
//
// `lib/bolum-capa.ts` bir istemci modülüdür (kanca içerir). Bir SUNUCU
// bileşeninin ondan `capaKimligi`yi içe aktarıp ÇAĞIRMASI çalışmaz: `"use client"`
// sınırının ötesinden gelen dışa aktarımlar sunucuda birer istemci başvurusudur,
// işlev değil. Açılış panosunun yerleşim çerçevesi (`panel/panel-view.tsx`) bir
// sunucu bileşenidir ve çıpa sarmalayıcılarını O basıyor.
//
// Öneki iki yerde yazmak (değişmez md. 8'in yasakladığı ayrışma) yerine saf
// kısım buraya alındı; `bolum-capa.ts` bunu yeniden dışa verir, yani çağrı
// yerlerinin hiçbiri değişmedi.

/** Çıpa kimliklerinin öneki — sayfa içindeki başka `id`lerle çakışmasın. */
export const CAPA_ONEKI = "bolum-";

export function capaKimligi(id: string): string {
  return `${CAPA_ONEKI}${id}`;
}
