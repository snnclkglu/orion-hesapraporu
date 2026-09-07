// ÜRÜN ÖLÇÜ DEFTERİNDE ARAMA — TEK TANIM.
//
// Defteri iki yer okur: yerleşim motoru (`panels.ts`) ve defter ekranı
// (`book.ts`). Arama iki kez yazılsaydı aynı ürün bir yerde "katalog", öteki
// yerde "tahmin" görünürdü — kullanıcı ekranda tahmin rozeti görüp ölçüyü
// yeniden girer, oysa yerleşim zaten katalog değerini kullanıyor olurdu.
// (ELEKTRIK-11 ile aynı ilke: süzgeç ve sıralama tek tanımdır.)
//
// ═══════════════════════════════════ TEDARİKÇİSİ BOŞ SATIR DEFTERİ IŞKALAMAZ
//
// Ölçüldü (0019 + 0026): `PT 2,5` klemensi malzeme listesinde İKİ kere
// geçiyor — 708 adedi "Phoenix Contact" tedarikçisiyle, 262 adedi TEDARİKÇİSİ
// BOŞ. `electricalCatalogLookupKey` ikisine ayrı anahtar üretir
// (`PHOENIXCONTACT|PT25` ve `|PT25`), yani deftere bir kez girilen ölçü
// parçaların dörtte birini ıskalardı.
//
// Yedek arama TİP NUMARASIYLA yapılır ama YALNIZ TEK EŞLEŞMEDE: aynı tip
// numarasını iki farklı üretici taşıyorsa hangisi olduğu bilinmiyordur ve
// tahmin edilmez (değişmez md. 4).

import type { DeviceModel } from "./types";

export type DeviceModelLookup = (lookupKey: string) => DeviceModel | null;

/** Anahtardan tip numarası parçasını alır (`PHOENIXCONTACT|PT25` → `PT25`). */
function tipParcasi(lookupKey: string): string {
  return lookupKey.split("|")[1] ?? "";
}

/**
 * Defterde arama yapan bir işlev üretir.
 *
 * Önce TAM anahtar denenir; bulunamazsa tip numarasıyla yedek arama yapılır.
 * Belirsiz tip numarası (birden çok üretici) `null` döner.
 */
export function deviceModelLookup(models: Iterable<DeviceModel>): DeviceModelLookup {
  const tam = new Map<string, DeviceModel>();
  // `null` değer "bu tip numarası BELİRSİZ" demektir — yok demek değil.
  const tipIndeksi = new Map<string, DeviceModel | null>();

  for (const model of models) {
    tam.set(model.lookupKey, model);
    const tip = tipParcasi(model.lookupKey);
    if (!tip) continue;
    tipIndeksi.set(tip, tipIndeksi.has(tip) ? null : model);
  }

  return (lookupKey: string): DeviceModel | null => {
    const bire = tam.get(lookupKey);
    if (bire) return bire;
    const tip = tipParcasi(lookupKey);
    return tip ? (tipIndeksi.get(tip) ?? null) : null;
  };
}
