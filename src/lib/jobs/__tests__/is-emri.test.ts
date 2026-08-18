// İş emri form çekirdeği — sözleşme testleri.
//
// Üç kural da "sonraki değeri" üretir ve üçünün de sessiz bozulma biçimi var:
// öneri geriye düşer, termin bir gün kayar, revizyon başa döner. Turlar bu üç
// kaymayı dondurur.

import { describe, expect, it } from "vitest";
import {
  revizyonHarfi,
  sonrakiIsNo,
  sonrakiRevizyon,
  tarihEkle,
} from "../is-emri";

describe("sonrakiIsNo", () => {
  it("en büyük numaranın bir fazlasını dört haneli verir", () => {
    expect(sonrakiIsNo(["0061", "0063", "0062"])).toBe("0064");
  });

  it("kökü okur — son ekli devralınan numaralar da sayılır", () => {
    expect(sonrakiIsNo(["0043-00-0000", "0057-00"])).toBe("0058");
  });

  it("sayı olmayan kökleri atlar, boş defterde 0001 döner", () => {
    expect(sonrakiIsNo(["DENEME", "", null, undefined])).toBe("0001");
    expect(sonrakiIsNo([])).toBe("0001");
  });

  it("dolgu genişliğini veriden okur — beş haneye geçince geriye düşmez", () => {
    expect(sonrakiIsNo(["10230", "0063"])).toBe("10231");
    expect(sonrakiIsNo(["9999"])).toBe("10000");
  });
});

describe("tarihEkle", () => {
  it("hafta ekler", () => {
    expect(tarihEkle("2026-08-18", 1, "hafta")).toBe("2026-08-25");
    expect(tarihEkle("2026-08-18", 8, "hafta")).toBe("2026-10-13");
  });

  it("ay ekler ve yıl sınırını geçer", () => {
    expect(tarihEkle("2026-08-18", 1, "ay")).toBe("2026-09-18");
    expect(tarihEkle("2026-08-18", 8, "ay")).toBe("2027-04-18");
  });

  it("ayın sonuna kelepçeler — 31 Ocak + 1 ay Mart'a taşmaz", () => {
    expect(tarihEkle("2026-01-31", 1, "ay")).toBe("2026-02-28");
    expect(tarihEkle("2028-01-31", 1, "ay")).toBe("2028-02-29");
    expect(tarihEkle("2026-08-31", 1, "ay")).toBe("2026-09-30");
  });

  it("okunamayan taban boş döner", () => {
    expect(tarihEkle("", 4, "hafta")).toBe("");
    expect(tarihEkle(null, 4, "ay")).toBe("");
  });
});

describe("revizyon harfi", () => {
  it("boş ve geçersiz değer A'dır", () => {
    expect(revizyonHarfi("")).toBe("A");
    expect(revizyonHarfi(null)).toBe("A");
    expect(revizyonHarfi("12")).toBe("A");
    expect(revizyonHarfi("Ç")).toBe("A");
  });

  it("küçük harf büyütülür", () => {
    expect(revizyonHarfi("c")).toBe("C");
    expect(revizyonHarfi(" b ")).toBe("B");
  });

  it("A → B → C ilerler", () => {
    expect(sonrakiRevizyon("A")).toBe("B");
    expect(sonrakiRevizyon("C")).toBe("D");
  });

  it("Z'den sonra başa DÖNMEZ", () => {
    expect(sonrakiRevizyon("Z")).toBe("AA");
    expect(sonrakiRevizyon("AZ")).toBe("BA");
    expect(sonrakiRevizyon("ZZ")).toBe("AAA");
  });

  it("boş değerin sonrakisi B'dir — yeni kayıt A sayılır", () => {
    expect(sonrakiRevizyon("")).toBe("B");
  });
});
