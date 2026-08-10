// Revizyon devri — KORUMA TESTİ.
//
// En değerli iddia yine SESSİZLİKtir: tanımı düzeltilmiş bir parça "gözden
// geçirilmeli" işareti ALMAZ. Alsaydı her revizyonda her kayıt işaretlenir ve
// işaret anlamını yitirirdi — atölye ilk günden sonra sarı satırlara bakmayı
// bırakırdı.

import { describe, expect, it } from "vitest";
import { packageDiff, type DiffPart } from "../diff";
import {
  carryDecisions,
  carrySummary,
  carrySummaryText,
  yonelmeEki,
  type ProgressRef,
} from "../revision";

function parca(over: Partial<DiffPart> = {}): DiffPart {
  return {
    registerKey: "KOD:0057-00-1000-05",
    partCode: "0057-00-1000-05",
    description: "KANCA ASKI SACI",
    qty: 4,
    material: "S235JR",
    weightKg: 12.5,
    thicknessMm: 8,
    cutLengthMm: null,
    category: "Lazer",
    ...over,
  };
}

function kayit(partCode: string, stage = "kesildi"): ProgressRef {
  return { id: `p-${partCode}-${stage}`, itemNo: "0057-00", partCode, stage };
}

/**
 * Devir kararı için gereken ikiliyi kurar: FARK ve YENİ TARAFIN parçaları.
 *
 * İkincisi farktan türetilemez — değişmeyen parça farkın hiçbir listesinde
 * durmaz — ve bunu denemek gerçek bir hataydı: aynı anahtardan bir satır
 * eksilince hâlâ defterde duran parça "karşılıksız" ilan ediliyordu.
 */
function devir(eski: DiffPart[], yeni: DiffPart[]) {
  return [packageDiff({ files: [], parts: eski }, { files: [], parts: yeni }), yeni] as const;
}

describe("devir kararı — üç sonuç", () => {
  it("değişmeyen parçanın kaydı AYNEN taşınır", () => {
    const p = parca();
    const kararlar = carryDecisions([kayit(p.partCode)], ...devir([p], [p]));
    expect(kararlar).toHaveLength(1);
    expect(kararlar[0].outcome).toBe("ayni");
    expect(kararlar[0].reason).toBe("");
  });

  it("ADET değişince kayıt taşınır AMA işaretlenir", () => {
    // Sac büyüdüyse eskiden kesilen parça artık yanlıştır; "kesildi" demeyi
    // sürdürmek atölyeye yalan söylemektir. Silmek de yanlış — belki hâlâ
    // kullanılabilir, kararı insan verir.
    const eski = parca({ qty: 4 });
    const yeni = parca({ qty: 2 });
    const [k] = carryDecisions([kayit(eski.partCode)], ...devir([eski], [yeni]));
    expect(k.outcome).toBe("gozdenGecir");
    expect(k.changedFields).toEqual(["adet"]);
    expect(k.reason).toBe("Adet 4 → 2");
  });

  it("KALINLIK · MALZEME · KESİM BOYU · KATEGORİ de işaretler", () => {
    const alanlar: [Partial<DiffPart>, string][] = [
      [{ thicknessMm: 10 }, "kalinlik"],
      [{ material: "S355JR" }, "malzeme"],
      [{ cutLengthMm: 240 }, "kesimBoyu"],
      [{ category: "Plazma" }, "kategori"],
    ];
    for (const [degisiklik, alan] of alanlar) {
      const eski = parca();
      const yeni = parca(degisiklik);
      const [k] = carryDecisions([kayit(eski.partCode)], ...devir([eski], [yeni]));
      expect(k.outcome, alan).toBe("gozdenGecir");
      expect(k.changedFields, alan).toContain(alan);
    }
  });

  it("YALNIZ TANIMI düzeltilmiş parça İŞARET ALMAZ", () => {
    // Bu maddenin kalbi. `tanim` imalatı etkilemez: "LIMIT" → "LİMİT" bir
    // yazım düzeltmesidir ve kesilmiş parçayı yanlış yapmaz.
    const eski = parca({ description: "KANCA ASKI SACI" });
    const yeni = parca({ description: "KANCA ASKI SACI (REV B)" });
    const [f, yeniTaraf] = devir([eski], [yeni]);
    // Fark bunu GÖRÜR — devir kararı görmezden gelir. İkisi ayrı sorudur.
    expect(f.ozet.degisenParca).toBe(1);
    const [k] = carryDecisions([kayit(eski.partCode)], f, yeniTaraf);
    expect(k.outcome).toBe("ayni");
  });

  it("AĞIRLIK değişikliği de işaret ÜRETMEZ — türetilmiş bir sayıdır", () => {
    const eski = parca({ weightKg: 12.5 });
    const yeni = parca({ weightKg: 12.8 });
    const [k] = carryDecisions([kayit(eski.partCode)], ...devir([eski], [yeni]));
    expect(k.outcome).toBe("ayni");
  });

  it("yeni revizyonda OLMAYAN parçanın kaydı KARŞILIKSIZ kalır, silinmez", () => {
    const eski = parca();
    const [k] = carryDecisions([kayit(eski.partCode)], ...devir([eski], []));
    expect(k.outcome).toBe("karsiliksiz");
    expect(k.reason).toContain("defterinde yok");
  });

  it("aynı kalem BİRDEN ÇOK montajda geçiyorsa, biri düşünce KARŞILIKSIZ SAYILMAZ", () => {
    // Kodsuz satırlarda çokluk KURALDIR: MTC'de aynı somun dört ayrı montajda
    // geçiyor ve defterde dört satırı var; üretim kaydı ise BİR tanedir.
    // Karar farkın listelerinden türetilseydi (silinenlerde varsa karşılıksız)
    // dörtten biri düştüğünde hâlâ üç satırla defterde duran somun
    // "karşılıksız" ilan edilirdi — modülün en büyük düşmanı olan yanlış
    // alarmın tam örneği. Karar bu yüzden YENİ TARAFIN KENDİSİNE bakar.
    const somun = (over: Partial<DiffPart> = {}) =>
      parca({ partCode: "", description: "SOMUN M16 DIN934", qty: 1, ...over });
    const eski = [
      somun({ registerKey: "SATIR:1" }),
      somun({ registerKey: "SATIR:2" }),
      somun({ registerKey: "SATIR:3" }),
      somun({ registerKey: "SATIR:4" }),
    ];
    const yeni = eski.slice(0, 3);
    const [f, yeniTaraf] = devir(eski, yeni);
    // Fark GERÇEKTEN bir satırı silinmiş sayıyor — sorun farkta değil kararda.
    expect(f.ozet.silinenParca).toBe(1);
    const [k] = carryDecisions([kayit("SATINALMA:SOMUN M16 DIN934", "satinalindi")], f, yeniTaraf);
    expect(k.outcome).toBe("ayni");
  });

  it("SATIN ALMA kalemi tanımından eşleşir (`SATINALMA:` ↔ `TANIM:`)", () => {
    // İki önek iki ayrı dosyada üretiliyor; eşleşme koparsa devir bütün satın
    // alma kayıtlarını sessizce "karşılıksız" sayardı.
    const eski = parca({ partCode: "", description: "PUL RONDELA M8 DIN125", qty: 8 });
    const yeni = parca({ partCode: "", description: "PUL RONDELA M8 DIN125", qty: 4 });
    const [k] = carryDecisions([kayit("SATINALMA:PUL RONDELA M8 DIN125", "satinalindi")], ...devir([eski], [yeni]));
    expect(k.outcome).toBe("gozdenGecir");
    expect(k.reason).toBe("Adet 8 → 4");
  });
});

describe("devir özeti — sessiz devir olmaz", () => {
  it("üç sonucu da tek cümlede sayar", () => {
    const ozet = carrySummary([
      { progress: kayit("a"), outcome: "ayni", reason: "", changedFields: [] },
      { progress: kayit("b"), outcome: "ayni", reason: "", changedFields: [] },
      { progress: kayit("c"), outcome: "gozdenGecir", reason: "Adet 2 → 4", changedFields: ["adet"] },
      { progress: kayit("d"), outcome: "karsiliksiz", reason: "", changedFields: [] },
    ]);
    expect(ozet).toEqual({ tasinan: 2, gozdenGecir: 1, karsiliksiz: 1, toplam: 4 });
    expect(carrySummaryText(ozet, 2)).toBe(
      "3 üretim kaydı R02'ye taşındı · 1'i gözden geçirilmeli · 1'i karşılıksız kaldı."
    );
  });

  it("taşınacak kayıt yoksa bunu açıkça söyler", () => {
    expect(carrySummaryText(carrySummary([]), 2)).toBe("Taşınacak üretim kaydı yoktu.");
  });

  it("her şey temizse yalnız taşınanı söyler", () => {
    const ozet = carrySummary([
      { progress: kayit("a"), outcome: "ayni", reason: "", changedFields: [] },
    ]);
    expect(carrySummaryText(ozet, 3)).toBe("1 üretim kaydı R03'e taşındı.");
  });

  it("yönelme eki rakamın değil OKUNUŞUNUN peşinden gider", () => {
    // "R02'ye" ama "R03'e": 2 "iki"dir ve ünlüyle biter, 3 "üç"tür. Uygulamanın
    // tamamı Türkçe; her zaman "'ye" demek atölyenin okuduğu her cümlede bir
    // yazım hatası bırakırdı. Belirleyici SON OKUNAN sözcüktür (42 → "iki").
    expect(yonelmeEki(1)).toBe("e"); // bir
    expect(yonelmeEki(2)).toBe("ye"); // iki
    expect(yonelmeEki(3)).toBe("e"); // üç
    expect(yonelmeEki(6)).toBe("ya"); // altı
    expect(yonelmeEki(9)).toBe("a"); // dokuz
    expect(yonelmeEki(10)).toBe("a"); // on
    expect(yonelmeEki(12)).toBe("ye"); // on iki
    expect(yonelmeEki(20)).toBe("ye"); // yirmi
    expect(yonelmeEki(40)).toBe("a"); // kırk
    expect(yonelmeEki(42)).toBe("ye"); // kırk iki
  });
});
