// Sipariş numarası önerisi.
//
// Kural bir kullanıcı cümlesinden çıktı (13.08.2026): *"Sipariş No bölümüne bu
// tedarikçi koduna göre benzersiz yeni bir kod önerelim. Ama isterse kullanıcı
// elle değiştirebilsin."*
//
// Testlerin çoğu "önerme" değil "YANLIŞ ÖNERME" durumlarını kapatır: aynı
// numaranın iki siparişe verilmesi telefonda çözülemeyen bir karışıklıktır ve
// hatası sessizdir — ekran her iki kayıtta da aynı numarayı doğru gösterir.

import { describe, expect, it } from "vitest";
import { siparisNoCakisiyorMu, siparisNoOner } from "../order-no";

describe("siparisNoOner", () => {
  it("kod yoksa öneri de yoktur", () => {
    expect(siparisNoOner("", ["TD0001-01"])).toBe("");
    expect(siparisNoOner(null, [])).toBe("");
    expect(siparisNoOner("   ", [])).toBe("");
  });

  it("ilk sipariş 01'dir", () => {
    expect(siparisNoOner("TD0007", [])).toBe("TD0007-01");
  });

  it("sıra MEVCUT NUMARALARDAN okunur, kayıt sayısından değil", () => {
    // İki kayıt var ama numaralar 03'e kadar gitmiş (biri silinmiş ya da
    // iptal edilmiş olabilir): öneri 03'ü tekrar kullanmaz.
    expect(siparisNoOner("TD0007", ["TD0007-01", "TD0007-03"])).toBe("TD0007-04");
  });

  it("başka firmanın numarası sırayı kaydırmaz", () => {
    expect(siparisNoOner("TD0007", ["TD0008-09", "TD0011-42"])).toBe("TD0007-01");
  });

  it("kod bir başka kodun ÖNEKİ olsa da karışmaz", () => {
    // `TD001` ile `TD0011` yan yana durabilir; gevşek bir "başlıyorsa" kuralı
    // ikincisinin numaralarını birincisine sayardı.
    expect(siparisNoOner("TD001", ["TD0011-05"])).toBe("TD001-01");
  });

  it("küçük harfle yazılmış numara da sayılır", () => {
    expect(siparisNoOner("td0007", ["td0007-02"])).toBe("TD0007-03");
  });

  it("99'dan sonra basamak büyür, kırpılmaz", () => {
    expect(siparisNoOner("TD0007", ["TD0007-99"])).toBe("TD0007-100");
  });

  it("numaranın devamı olmayan metinler sayılmaz", () => {
    // "TD0007-01-R2" bir revizyon yazımıdır ve sıra sayısı değildir.
    expect(siparisNoOner("TD0007", ["TD0007-01-R2", "TD0007"])).toBe("TD0007-01");
  });

  it("tarih verilince önek AY+YIL taşır (md. 9)", () => {
    // TD0053 + 08(ağustos) + 26(2026) + 01.
    expect(siparisNoOner("TD0053", [], "2026-08-14")).toBe("TD00530826" + "01");
    expect(siparisNoOner("TD0053", ["TD00530826" + "01"], "2026-08-14")).toBe("TD00530826" + "02");
  });

  it("yeni ayda sıra 01'den başlar", () => {
    // Ağustostaki numaralar eylül önerisini kaydırmaz.
    expect(siparisNoOner("TD0053", ["TD00530826" + "05"], "2026-09-01")).toBe("TD00530926" + "01");
  });
});

describe("siparisNoCakisiyorMu", () => {
  const mevcut = ["TD0007-01", "TD0008-01"];

  it("boş numara çakışmaz — numarasız sipariş meşrudur", () => {
    expect(siparisNoCakisiyorMu("", mevcut)).toBe(false);
    expect(siparisNoCakisiyorMu(null, mevcut)).toBe(false);
  });

  it("var olan numara çakışır", () => {
    expect(siparisNoCakisiyorMu("TD0007-01", mevcut)).toBe(true);
    expect(siparisNoCakisiyorMu("td0007-01", mevcut)).toBe(true);
  });

  it("siparişin KENDİ numarası çakışma sayılmaz", () => {
    // Düzenleme penceresini açıp numarayı değiştirmeden kaydetmek hata
    // vermemelidir.
    expect(siparisNoCakisiyorMu("TD0007-01", mevcut, "TD0007-01")).toBe(false);
  });

  it("yeni numara serbesttir", () => {
    expect(siparisNoCakisiyorMu("TD0007-02", mevcut)).toBe(false);
  });
});
