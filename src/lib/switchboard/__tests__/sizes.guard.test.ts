// PANO IZGARASI İKİ YERDE YAŞIYOR — ayrışmayı bu test engeller (değişmez md. 8).
//
// `lib/calc/modules/cabin.ts` elektrik ODASI hesabı için kendi ızgarasını
// taşıyor ve o dosya hesap motorunun parçasıdır. `lib/switchboard/sizes.ts`
// ise sipariş edilebilir gövde ızgarasının KANONİK hâlidir. İkisi ayrışırsa
// oda hesabı 900 mm'lik bir panoyu hiç göremez ya da yerleştirici odada
// olmayan bir derinlik önerir.
//
// Sınır TS ↔ TS olduğu için `terms.test.ts`teki metin okuma değil GERÇEK İÇE
// AKTARMA kullanılır: dosya yeniden adlandırılsa bile derleme kırılır.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM_PANEL_DEPTH_MM,
  DEFAULT_ROOM_PANEL_HEIGHT_MM,
  DEFAULT_ROOM_PANEL_WIDTH_MM,
  ROOM_PANEL_BASE_HEIGHT_MM,
  ROOM_PANEL_DEPTH_OPTIONS_MM,
  ROOM_PANEL_HEIGHT_OPTIONS_MM,
  ROOM_PANEL_WIDTH_OPTIONS_MM,
} from "@/lib/calc/modules/cabin";
import {
  HEIGHT_PREFERENCE_MM,
  PANEL_BASE_HEIGHTS_MM,
  PANEL_DEPTHS_MM,
  PANEL_HEIGHTS_MM,
  PANEL_WIDTHS_MM,
  doorConfigFor,
  ceilToGrid,
} from "../sizes";

describe("oda ızgarası kanonik ızgaranın alt kümesidir", () => {
  it("en", () => {
    for (const en of ROOM_PANEL_WIDTH_OPTIONS_MM) {
      expect(PANEL_WIDTHS_MM as readonly number[]).toContain(en);
    }
  });

  it("yükseklik", () => {
    for (const boy of ROOM_PANEL_HEIGHT_OPTIONS_MM) {
      expect(PANEL_HEIGHTS_MM as readonly number[]).toContain(boy);
    }
  });

  it("derinlik", () => {
    for (const d of ROOM_PANEL_DEPTH_OPTIONS_MM) {
      expect(PANEL_DEPTHS_MM as readonly number[]).toContain(d);
    }
  });

  it("baza", () => {
    expect(PANEL_BASE_HEIGHTS_MM as readonly number[]).toContain(ROOM_PANEL_BASE_HEIGHT_MM);
  });

  it("oda öntanımları ızgarada var", () => {
    expect(PANEL_WIDTHS_MM as readonly number[]).toContain(DEFAULT_ROOM_PANEL_WIDTH_MM);
    expect(PANEL_DEPTHS_MM as readonly number[]).toContain(DEFAULT_ROOM_PANEL_DEPTH_MM);
  });

  it("tercih sırasının başı oda öntanımıyla AYNIDIR — rastlantı değil", () => {
    // İki modül aynı vinci anlatıyor; sistem burada 1800 önerirken hesap
    // motorunun 1600 varsayması kullanıcıya iki farklı pano gösterirdi.
    expect(HEIGHT_PREFERENCE_MM[0]).toBe(DEFAULT_ROOM_PANEL_HEIGHT_MM);
  });
});

describe("kapak kuralı", () => {
  it("600'ün altında çift kapak SEÇİLEMEZ", () => {
    expect(doorConfigFor(400, "cift")).toBe("tek");
    expect(doorConfigFor(500, "cift")).toBe("tek");
  });

  it("600 sınırdır ve iki tarafa da aittir", () => {
    expect(doorConfigFor(600, null)).toBe("tek");
    expect(doorConfigFor(600, "cift")).toBe("cift");
  });

  it("600 üstünde öntanım çifttir ama kullanıcı tek seçebilir", () => {
    expect(doorConfigFor(800, null)).toBe("cift");
    expect(doorConfigFor(800, "tek")).toBe("tek");
  });
});

describe("ızgaraya yuvarlama", () => {
  it("bir üst kademeye çıkar", () => {
    expect(ceilToGrid(410, PANEL_DEPTHS_MM)).toBe(500);
    expect(ceilToGrid(500, PANEL_DEPTHS_MM)).toBe(500);
  });

  it("ızgarayı aşan değer için null döner — uydurma bir ölçü verilmez", () => {
    expect(ceilToGrid(1200, PANEL_DEPTHS_MM)).toBeNull();
  });
});
