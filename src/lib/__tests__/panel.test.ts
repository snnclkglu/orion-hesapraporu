// AÇILIŞ PANOSU ÇEKİRDEĞİ — arama eşleşmesi ve zaman şeridi.
//
// En değerli iddialar burada da SESSİZLİK iddialarıdır: tek harfte sonuç
// çıkmaz, sıfır sayan sinyal listeye girmez, pencere dışındaki tarih banda
// düşmez. Bir açılış sayfasında gürültü, eksik bilgiden daha pahalıdır —
// kullanıcı ona bir daha bakmaz.

import { describe, expect, it } from "vitest";
import {
  AGENDA_KINDS,
  PANEL_KINDS,
  gunAdi,
  gunFarki,
  panelAra,
  panelEslesir,
  panelSinyalleri,
  panelTakvim,
  takvimTurler,
  type PanelDate,
  type PanelHit,
  type PanelSignal,
} from "../panel";

const hit = (over: Partial<PanelHit> = {}): PanelHit => ({
  kind: "job",
  code: "0057",
  label: "MUHTELİF VİNÇLER",
  hint: "ASTOR A.Ş. · Aktif",
  href: "/jobs/1",
  ...over,
});

describe("arama eşleşmesi — TÜRKÇE KATLAMA", () => {
  it("küçük harfle yazılan sorgu BÜYÜK saklanan adı bulur", () => {
    // Adlar büyük harfle saklanıyor (AGENTS IS-14) ve kullanıcı küçük yazar.
    expect(panelEslesir(hit(), "muhtelif")).toBe(true);
  });

  it("noktalı/noktasız i ayrımı sorgulayanı YANILTMAZ", () => {
    // Düz `toLowerCase` ile "isdemir" yazan biri "İSDEMİR"i bulamıyordu.
    const isdemir = hit({ label: "İSDEMİR AMONYUM SÜLFAT VİNCİ" });
    expect(panelEslesir(isdemir, "isdemir")).toBe(true);
    expect(panelEslesir(isdemir, "İSDEMİR")).toBe(true);
    expect(panelEslesir(hit({ label: "KIRIK MİL" }), "kirik")).toBe(true);
  });

  it("boşluklu sorguda her parça AYRI ALANDA geçebilir", () => {
    // "astor pergel" — biri müşteride, öbürü üründe.
    const satir = hit({ label: "PERGEL VİNÇ", hint: "ASTOR A.Ş." });
    expect(panelEslesir(satir, "astor pergel")).toBe(true);
    expect(panelEslesir(satir, "pergel astor")).toBe(true);
  });

  it("parçalardan biri geçmiyorsa eşleşme YOKTUR", () => {
    expect(panelEslesir(hit(), "astor kepçe")).toBe(false);
  });
});

describe("panelAra", () => {
  const defter: PanelHit[] = [
    hit({ kind: "job", code: "0057", label: "MUHTELİF VİNÇLER" }),
    hit({ kind: "item", code: "0057-03", label: "PERGEL VİNÇ", href: "/jobs/1" }),
    hit({ kind: "item", code: "0057-06", label: "PERGEL VİNÇ", href: "/jobs/1" }),
    hit({ kind: "customer", code: "ASTOR", label: "ASTOR A.Ş.", href: "/jobs" }),
    hit({ kind: "group", code: "0043-00-1000", label: "ELEKTRİK PANOSU", href: "/drawings/x" }),
  ];

  it("TEK HARFTE sonuç vermez", () => {
    // "0" yazan biri altmış iki iş görmemeli; arama iki karakterde başlar.
    expect(panelAra(defter, "0").gruplar).toEqual([]);
    expect(panelAra(defter, " ").gruplar).toEqual([]);
  });

  it("sonuçlar TÜR SIRASINDA gruplanır", () => {
    const { gruplar } = panelAra(defter, "00");
    const sira = gruplar.map((g) => g.kind);
    expect(sira).toEqual([...sira].sort((a, b) => PANEL_KINDS.indexOf(a) - PANEL_KINDS.indexOf(b)));
  });

  it("KİMLİĞİN BAŞINDAN eşleşen üste çıkar", () => {
    // "0057-03" yazan kalem numarası arıyor; iş satırı da "0057" taşıyor ama
    // aranan kimliğin kendisi kalemdir.
    const { gruplar } = panelAra(defter, "0057-03");
    expect(gruplar[0].hits[0].code).toBe("0057-03");
  });

  it("grup başına kırpar ve KAÇ TANE OLDUĞUNU söyler", () => {
    const cok = Array.from({ length: 9 }, (_, i) =>
      hit({ kind: "item", code: `0057-0${i}`, label: "PERGEL VİNÇ" })
    );
    const { gruplar, toplam } = panelAra(cok, "pergel", 6);
    expect(gruplar[0].hits).toHaveLength(6);
    // Kırpma sessiz olmaz: toplam gerçek sayıyı taşır.
    expect(toplam).toBe(9);
  });

  it("eşleşme yoksa grup da yoktur", () => {
    expect(panelAra(defter, "kepçe").gruplar).toEqual([]);
    expect(panelAra(defter, "kepçe").toplam).toBe(0);
  });
});

describe("gün adı", () => {
  const bugun = "2026-08-13"; // Perşembe

  it("bugün, yarın ve dün ADIYLA anılır", () => {
    expect(gunAdi(bugun, "2026-08-13")).toBe("Bugün");
    expect(gunAdi(bugun, "2026-08-14")).toBe("Yarın");
    expect(gunAdi(bugun, "2026-08-12")).toBe("Dün");
  });

  it("hafta içinde GÜN ADI, sonrasında TARİH", () => {
    // "Perşembe" iki hafta sonrası için de doğrudur ama okuyan onu BU
    // haftanın perşembesi sanar — bir termin ekranında bu yedi günlük bir
    // yanılgıdır, o yüzden bir haftadan uzağı tarih olarak basılır.
    expect(gunAdi(bugun, "2026-08-17")).toBe("Pazartesi");
    expect(gunAdi(bugun, "2026-08-20")).toBe("20.08");
    expect(gunAdi(bugun, "2026-09-01")).toBe("01.09");
  });

  it("gün farkı saat diliminden ETKİLENMEZ", () => {
    expect(gunFarki("2026-08-13", "2026-08-20")).toBe(7);
    expect(gunFarki("2026-08-13", "2026-08-06")).toBe(-7);
    // Yaz saati geçişi olan bir aralıkta da tam gün döner.
    expect(gunFarki("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("panelTakvim", () => {
  const bugun = "2026-08-13";
  const t = (date: string, label = "0057-03"): PanelDate => ({
    date,
    kind: "Termin",
    label,
    href: "/sales",
  });

  it("aynı güne düşenler TEK BANTTA toplanır ve tarih sırasına dizilir", () => {
    const gunler = panelTakvim([t("2026-08-20"), t("2026-08-14", "A"), t("2026-08-14", "B")], bugun);
    expect(gunler.map((g) => g.date)).toEqual(["2026-08-14", "2026-08-20"]);
    expect(gunler[0].items).toHaveLength(2);
  });

  it("GEÇMİŞ tarih girer ve GECİKME olarak işaretlenir", () => {
    // "termini üç gün önce geçmiş", "yarın termin var"dan daha aciltir.
    const gunler = panelTakvim([t("2026-08-10")], bugun);
    expect(gunler[0].overdue).toBe(true);
    expect(gunler[0].items[0].overdue).toBe(true);
  });

  it("PENCERE DIŞI tarih hiç görünmez", () => {
    // Altı ay önce kapanmamış bir kayıt bir hatırlatma değil bir arşiv
    // sorunudur ve şeridi kullanılamaz yapardı.
    expect(panelTakvim([t("2027-01-01"), t("2025-01-01")], bugun)).toEqual([]);
  });

  it("bozuk tarih satırı DÜŞÜRÜR, panoyu değil", () => {
    expect(panelTakvim([t("belirsiz"), t("2026-08-14")], bugun)).toHaveLength(1);
  });
});

describe("panelSinyalleri", () => {
  const s = (over: Partial<PanelSignal>): PanelSignal => ({
    key: "k",
    count: 1,
    label: "kayıt",
    href: "/",
    tone: "bilgi",
    ...over,
  });

  it("SIFIR sayan sinyal listeye GİRMEZ", () => {
    // "0 gecikme" bir uyarı değil gürültüdür; olmayan bir sorun ekranda yer
    // kaplamamalıdır.
    expect(panelSinyalleri([s({ count: 0 }), s({ key: "b", count: 3 })])).toHaveLength(1);
  });

  it("uyarılar önce, kendi içinde BÜYÜK SAYI önce", () => {
    const liste = panelSinyalleri([
      s({ key: "bilgi-cok", count: 40, tone: "bilgi" }),
      s({ key: "uyari-az", count: 2, tone: "uyari" }),
      s({ key: "uyari-cok", count: 9, tone: "uyari" }),
    ]);
    expect(liste.map((x) => x.key)).toEqual(["uyari-cok", "uyari-az", "bilgi-cok"]);
  });
});

describe("takvimTurler — ajanda tür çipleri", () => {
  const d = (kind: string): PanelDate => ({
    date: "2026-08-14",
    kind,
    label: "X",
    href: "/",
  });

  it("kanonik sıra korunur ve ödeme türü listede YOKTUR", () => {
    // Sıra AGENDA_KINDS'tan gelir; "Ödeme" bilinçli olarak dışarıda
    // (14.08.2026 kararı — ödendi bilgisi takip edilmiyor).
    expect(AGENDA_KINDS).not.toContain("Ödeme");
    const turler = takvimTurler([d("Yapılacak"), d("Termin"), d("Görev")]);
    expect(turler).toEqual(["Termin", "Görev", "Yapılacak"]);
  });

  it("kayıtta OLMAYAN türe çip çıkmaz (sıfır kuralı)", () => {
    expect(takvimTurler([d("Sevk")])).toEqual(["Sevk"]);
  });

  it("bilinmeyen tür kaybolmaz, sona eklenir", () => {
    // Yeni bir kaynak türü eklendiğinde çekirdek güncellenmeden de çip
    // üretilir — sessiz kayıp yerine sondaki görünürlük tercih edildi.
    expect(takvimTurler([d("Revizyon"), d("Termin")])).toEqual([
      "Termin",
      "Revizyon",
    ]);
  });

  it("boş listede boş döner", () => {
    expect(takvimTurler([])).toEqual([]);
  });
});
