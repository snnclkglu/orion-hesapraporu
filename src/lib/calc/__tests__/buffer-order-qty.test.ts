// Tamponun SİPARİŞ ADEDİ — kurulu adet × 2.
//
// İki ayrı soru vardır ve karıştırılırsa liste sessizce EKSİK adet basar:
//   · "Kurulu Tampon Adedi" HESABIN sorusudur — bir çarpmada yükü kaç tampon
//     paylaşır (KAT0170 s.6 yerleşimi).
//   · Ekipman listesindeki adet SİPARİŞİN sorusudur — vinç tamponu HER İKİ
//     UÇTA taşır, bir uçtaki düzen ötekinde birebir tekrarlanır.
//
// Liste eskiden sabit 2 basıyordu (kullanıcı bildirimi, 24.08.2026): kutuda ne
// seçilirse seçilsin satır değişmiyordu.

import { describe, expect, it } from "vitest";
import {
  BUFFER_ENDS_PER_AXIS,
  activeBufferCountForImpact,
  bufferOrderQty,
  installedBufferCountOr,
} from "../modules/travelGroup";

describe("bufferOrderQty", () => {
  it("kurulu adedi iki uca çoğaltır", () => {
    expect(bufferOrderQty(1)).toBe(2);
    expect(bufferOrderQty(2)).toBe(4);
    expect(bufferOrderQty(4)).toBe(8);
  });

  it("ESKİ REVİZYONDA alan yoktur — varsayılan kurulu adet 2'dir", () => {
    // Sıfır ya da tanımsız bir kutu "tampon yok" demek değildir; alan
    // eklenmeden önceki kayıtlarda hiç bulunmaz ve düzen varsayılan 2'dir.
    expect(bufferOrderQty(undefined)).toBe(4);
    expect(bufferOrderQty(0)).toBe(4);
    expect(bufferOrderQty(-3)).toBe(4);
  });

  it("arayüzün desteklemediği ara değerler tekilleştirilir", () => {
    // Kutu yalnız 1/2/4 sunar; kayıtta başka bir sayı varsa en yakın
    // desteklenen düzene indirilir (`installedBufferCountOr`).
    expect(bufferOrderQty(3)).toBe(bufferOrderQty(2));
    expect(bufferOrderQty(6)).toBe(bufferOrderQty(4));
  });

  it("adet HESABIN aktif tampon sayısından AYRIDIR", () => {
    // Dört tamponlu düzende tek çarpmada yalnız iki tampon çalışır; sipariş
    // ise sekiz tampondur. İki sayı birbirinin yerine geçemez.
    expect(activeBufferCountForImpact(4)).toBe(2);
    expect(bufferOrderQty(4)).toBe(8);
  });

  it("çarpan tek yerdedir", () => {
    expect(BUFFER_ENDS_PER_AXIS).toBe(2);
    for (const n of [1, 2, 4] as const) {
      expect(bufferOrderQty(n)).toBe(installedBufferCountOr(n) * BUFFER_ENDS_PER_AXIS);
    }
  });
});
