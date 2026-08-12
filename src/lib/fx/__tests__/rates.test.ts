// Döviz kuru çekirdeği.
//
// EN ÖNEMLİ İDDİA: aylık parite ortalaması, ortalamaların oranı DEĞİLDİR.
// Bu fark küçüktür ve tam da bu yüzden sessizce yanlış yazılabilir; test onu
// SAYIYLA dondurur.

import { describe, expect, it } from "vitest";
import {
  aylikOrtalama,
  degisimYuzde,
  donemTamlik,
  eksikGunAraligi,
  gunAraligi,
  gunEkle,
  haftaSonu,
  type FxDaily,
} from "../rates";
import { frankfurterUrl, tcmbAyristir, tcmbUrl } from "../source";

const gun = (date: string, usdTry: number, eurTry: number, source: "TCMB" | "ECB" = "TCMB"): FxDaily => ({
  date,
  source,
  usdTry,
  eurTry,
});

describe("aylık ortalama", () => {
  it("gün gün ortalar ve kaç günden çıktığını söyler", () => {
    const m = aylikOrtalama([
      gun("2026-08-03", 47.0, 54.0),
      gun("2026-08-04", 48.0, 56.0),
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].period).toBe("2026-08");
    expect(m[0].usdTry).toBeCloseTo(47.5, 10);
    expect(m[0].eurTry).toBeCloseTo(55.0, 10);
    expect(m[0].dayCount).toBe(2);
    expect(m[0].firstDay).toBe("2026-08-03");
    expect(m[0].lastDay).toBe("2026-08-04");
  });

  it("PARİTE ORTALAMASI, ORTALAMALARIN PARİTESİ DEĞİLDİR", () => {
    // Günlük parite: 54/47 = 1,148936… ve 56/48 = 1,166666…
    // Doğru ortalama:            (1,148936 + 1,166666) / 2 = 1,157801…
    // YANLIŞ olan (ort/ort):      55 / 47,5                = 1,157894…
    const m = aylikOrtalama([
      gun("2026-08-03", 47.0, 54.0),
      gun("2026-08-04", 48.0, 56.0),
    ])[0];
    const dogru = (54 / 47 + 56 / 48) / 2;
    const yanlis = 55 / 47.5;
    expect(m.eurUsd).toBeCloseTo(dogru, 12);
    expect(m.eurUsd).not.toBeCloseTo(yanlis, 6);
    // USD/EUR paritenin TERSİDİR, ayrıca ortalanan bir seri değil.
    expect(m.usdEur).toBeCloseTo(1 / dogru, 12);
  });

  it("ayları ayırır ve sıralar", () => {
    const m = aylikOrtalama([
      gun("2026-08-03", 47, 54),
      gun("2026-07-31", 46, 53),
      gun("2026-07-30", 46, 53),
    ]);
    expect(m.map((x) => x.period)).toEqual(["2026-07", "2026-08"]);
    expect(m[0].dayCount).toBe(2);
  });

  it("bozuk gözlem ortalamaya GİRMEZ", () => {
    // Sıfır ya da negatif bir kur ortalamayı sessizce aşağı çekerdi.
    const m = aylikOrtalama([
      gun("2026-08-03", 47, 54),
      gun("2026-08-04", 0, 56),
      gun("2026-08-05", 48, -1),
    ]);
    expect(m[0].dayCount).toBe(1);
    expect(m[0].usdTry).toBe(47);
  });

  it("kaynakları künyeye yazar — karışık ay iki kaynak gösterir", () => {
    const m = aylikOrtalama([
      gun("2026-08-03", 47, 54, "TCMB"),
      gun("2026-08-04", 48, 56, "ECB"),
    ])[0];
    expect(m.sources).toEqual(["TCMB", "ECB"]);
  });
});

describe("eksik gün aralığı", () => {
  it("son kayıtlı günün ERTESİNDEN bugüne", () => {
    expect(eksikGunAraligi("2026-08-08", "2026-08-12")).toEqual({
      from: "2026-08-09",
      to: "2026-08-12",
    });
  });

  it("hiç kayıt yoksa tabandan başlar", () => {
    expect(eksikGunAraligi(null, "2024-01-10")).toEqual({
      from: "2024-01-01",
      to: "2024-01-10",
    });
  });

  it("güncelse null döner — boş bir istek atılmaz", () => {
    expect(eksikGunAraligi("2026-08-12", "2026-08-12")).toBeNull();
    expect(eksikGunAraligi("2026-08-20", "2026-08-12")).toBeNull();
  });

  it("pencere kelepçelidir: aylarca açılmayan uygulama tek istekte boğulmaz", () => {
    const a = eksikGunAraligi("2024-01-01", "2026-08-12");
    expect(a).not.toBeNull();
    expect(a!.from).toBe("2024-01-02");
    // 62 günlük tavan: 2024-01-02 + 61 gün
    expect(a!.to).toBe("2024-03-03");
  });
});

describe("gün yardımcıları", () => {
  it("gün ekleme ay ve yıl sınırını geçer", () => {
    expect(gunEkle("2026-08-31", 1)).toBe("2026-09-01");
    expect(gunEkle("2026-12-31", 1)).toBe("2027-01-01");
    expect(gunEkle("2024-02-28", 1)).toBe("2024-02-29"); // artık yıl
  });

  it("aralık iki ucu da kapsar", () => {
    expect(gunAraligi("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12",
    ]);
  });

  it("hafta sonu bilinir — TCMB'ye gereksiz istek atılmaz", () => {
    expect(haftaSonu("2026-08-08")).toBe(true); // cumartesi
    expect(haftaSonu("2026-08-09")).toBe(true); // pazar
    expect(haftaSonu("2026-08-10")).toBe(false); // pazartesi
  });
});

describe("dönem tamlığı", () => {
  it("yarım ay yarım görünür", () => {
    // 2026-08'in ilk 7 iş gününde 7 gözlem varsa ve bugün 11 Ağustos ise,
    // ayın bugüne kadarki iş günü 6'dır (3,4,5,6,7,10,11 → 7 gün).
    const m = aylikOrtalama(
      ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11"]
        .map((d) => gun(d, 47, 54))
    )[0];
    expect(donemTamlik(m, "2026-08-11")).toBeCloseTo(1, 6);
  });

  it("kapanmış ay tam sayılır", () => {
    const gunler = gunAraligi("2026-07-01", "2026-07-31").filter((g) => !haftaSonu(g));
    const m = aylikOrtalama(gunler.map((d) => gun(d, 47, 54)))[0];
    expect(donemTamlik(m, "2026-08-11")).toBe(1);
  });
});

describe("değişim yüzdesi", () => {
  it("önceki dönem yoksa null", () => {
    expect(degisimYuzde(54, null)).toBeNull();
    expect(degisimYuzde(54, 0)).toBeNull();
  });

  it("artış pozitif, azalış negatif", () => {
    expect(degisimYuzde(55, 50)).toBeCloseTo(10, 10);
    expect(degisimYuzde(45, 50)).toBeCloseTo(-10, 10);
  });
});

describe("kaynak adresleri ve ayrıştırma", () => {
  it("TCMB adresi gg/aa/yyyy sırasını taşır", () => {
    // Klasör yyyyaa, dosya ggaayyyy — sıra karışırsa 404 alınır ve gün
    // sessizce "tatil" sayılırdı.
    expect(tcmbUrl("2026-08-11")).toBe("https://www.tcmb.gov.tr/kurlar/202608/11082026.xml");
    expect(tcmbUrl("2024-01-02")).toBe("https://www.tcmb.gov.tr/kurlar/202401/02012024.xml");
  });

  it("Frankfurter adresi avro tabanlı aralık ister", () => {
    expect(frankfurterUrl("2026-08-01", "2026-08-11")).toBe(
      "https://api.frankfurter.dev/v1/2026-08-01..2026-08-11?base=EUR&symbols=TRY,USD"
    );
  });

  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="11.08.2026">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><Isim>ABD DOLARI</Isim>
    <ForexBuying>47.6505</ForexBuying><ForexSelling>47.7364</ForexSelling>
  </Currency>
  <Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit><Isim>EURO</Isim>
    <ForexBuying>54.9693</ForexBuying><ForexSelling>55.0683</ForexSelling>
  </Currency>
  <Currency CrossOrder="3" Kod="JPY" CurrencyCode="JPY">
    <Unit>100</Unit><ForexBuying>32.1</ForexBuying><ForexSelling>32.3</ForexSelling>
  </Currency>
</Tarih_Date>`;

  it("bültenden doğru para biriminin alış/satışını okur", () => {
    expect(tcmbAyristir(XML, "USD")).toEqual({ alis: 47.6505, satis: 47.7364 });
    expect(tcmbAyristir(XML, "EUR")).toEqual({ alis: 54.9693, satis: 55.0683 });
  });

  it("bulunamayan para birimi NULL döner — sıfır YAZILMAZ", () => {
    // `null` çağıranda HATA'ya döner ("biçim değişmiş olabilir"), tatile
    // değil: eksikliği kalıcı olarak gizlemek en kötü sonuçtur.
    expect(tcmbAyristir("<Tarih_Date></Tarih_Date>", "USD")).toBeNull();
    expect(
      tcmbAyristir(`<Currency Kod="USD"><ForexBuying></ForexBuying></Currency>`, "USD")
    ).toBeNull();
  });

  it("satış boşsa alış kullanılır — uydurulmuş bir marj eklenmez", () => {
    expect(
      tcmbAyristir(`<Currency Kod="USD"><ForexBuying>47.0</ForexBuying></Currency>`, "USD")
    ).toEqual({ alis: 47, satis: 47 });
  });
});
