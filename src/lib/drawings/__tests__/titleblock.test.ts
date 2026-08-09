// Antet ve montaj parça tablosu okuyucusu — GERÇEK altı resme karşı.
//
// Fikstürdeki sayılar iki gerçek teslim klasöründen ÖLÇÜLMÜŞTÜR. Bir gerileme
// olduğunda hangi yönde olduğu tek bakışta görünsün diye dondurulmuşlardır.
//
// Bu dosyanın en önemli testi "değerleri doğru okuyor mu" değil, YANLIŞ ALARM
// ÜRETMİYOR MU'dur: `MONORAY_PORTRE` fikstürü antet çerçevesinin hemen
// solundaki `+0,5` ölçü yazılarını, her fikstür de şablonun telif cümlesini
// bilerek taşır. Prototip bu iki tuzağa 240 dosyanın 25'inde ve 3'ünde
// düşüyordu.

import { describe, expect, it } from "vitest";
import {
  ANTET_TANIYICI,
  buildLines,
  readSheetBom,
  readTitleBlock,
  readTitleBlockFromText,
  type TextSpan,
} from "../titleblock";
import {
  FIXTURE_SHEETS,
  MONORAY_MONTAJ,
  MONORAY_PARCA,
  MONORAY_PORTRE,
  MTC_BOS_MUSTERI,
  MTC_MONTAJ_A0,
  MTC_PARCA,
} from "./fixtures/content";

/** Kararlı karıştırma: rastgelelik testin kendisini kırılgan yapardı. */
function karistir(spans: readonly TextSpan[]): TextSpan[] {
  const out = spans.slice();
  let tohum = 20260810;
  for (let i = out.length - 1; i > 0; i--) {
    tohum = (tohum * 1103515245 + 12345) % 2147483648;
    const j = tohum % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("antet — etiket bulma", () => {
  it("altı gerçek resmin hepsinde şablon tanınıyor", () => {
    for (const s of FIXTURE_SHEETS) {
      const r = readTitleBlock(s.spans);
      expect(r.recognizedBy, s.file).toBe(ANTET_TANIYICI);
      // 14 etiketten en az 13'ü; eksik olan yalnız `Metarial` (montaj
      // resimlerinde malzeme hücresi hiç basılmıyor).
      expect(r.labelsFound, s.file).toBeGreaterThanOrEqual(13);
      expect(r.labelsTotal).toBe(14);
    }
  });

  it("montaj resimlerinde 13, parça resimlerinde 14 etiket bulunur", () => {
    expect(readTitleBlock(MONORAY_PARCA.spans).labelsFound).toBe(14);
    expect(readTitleBlock(MTC_PARCA.spans).labelsFound).toBe(14);
    expect(readTitleBlock(MONORAY_PORTRE.spans).labelsFound).toBe(14);
    expect(readTitleBlock(MTC_BOS_MUSTERI.spans).labelsFound).toBe(14);
    expect(readTitleBlock(MONORAY_MONTAJ.spans).labelsFound).toBe(13);
    expect(readTitleBlock(MTC_MONTAJ_A0.spans).labelsFound).toBe(13);
  });

  it("span verilmezse boş döner ve tanıyıcı yazılmaz", () => {
    const r = readTitleBlock([]);
    expect(r.recognizedBy).toBe("");
    expect(r.labelsFound).toBe(0);
    expect(r.titleBlock.drawingNo).toBe("");
  });

  it("beş etiket bulunamayan sayfada geometrik yol hiç çalışmaz", () => {
    // Başka bir CAD'in şablonu böyle görünür: tanıdık tek bir sözcük var.
    const spans: TextSpan[] = [
      { text: "Ölçek/Scale", x: 100, y: 50, w: 30, h: 4 },
      { text: "1 : 10", x: 100, y: 42, w: 12, h: 4 },
      { text: "BAŞKA BİR ŞABLON", x: 40, y: 80, w: 60, h: 6 },
    ];
    const r = readTitleBlock(spans);
    expect(r.recognizedBy).toBe("");
    expect(r.titleBlock.scale).toBe("");
  });
});

describe("antet — dondurulmuş değerler", () => {
  it("MONORAY parça resmi (A4 yatay)", () => {
    const t = readTitleBlock(MONORAY_PARCA.spans).titleBlock;
    expect(t).toEqual({
      drawingNo: "0057-00-0510-01",
      projectNo: "0057-00",
      jobName: "SAC15x240x285",
      parentProject: "SASE",
      customer: "ASTORA.Ş.",
      weightKg: 4.1,
      weightNA: false,
      qty: null,
      material: "S235JR",
      scale: "1 : 2,5",
      sheetSize: "A4",
      sheetNo: "1",
      drawnBy: "TUNCAYÇELİKER",
      approvedBy: "SİNANÇOLAKOĞLU",
      dateIso: "2026-06-18",
      approvedDateIso: "2026-06-18",
      revision: "",
    });
  });

  it("MONORAY montajı (A1) — malzeme hücresi yok, adet dolu", () => {
    const t = readTitleBlock(MONORAY_MONTAJ.spans).titleBlock;
    expect(t.drawingNo).toBe("0057-00-0510");
    expect(t.jobName).toBe("ŞASEKOMPLE");
    expect(t.parentProject).toBe("PERGELVINC(1,5TON)");
    expect(t.weightKg).toBe(35.463);
    expect(t.qty).toBe(1);
    expect(t.sheetSize).toBe("A1");
    expect(t.scale).toBe("1 : 2");
    // Montaj resminde malzeme YAZMIYOR; uydurulmaz.
    expect(t.material).toBe("");
  });

  it("MTC ana kiriş (A0) — en büyük sayfa aynı okuyucuyla okunur", () => {
    const t = readTitleBlock(MTC_MONTAJ_A0.spans).titleBlock;
    expect(t.drawingNo).toBe("0043-00-0100");
    expect(t.projectNo).toBe("0043-00");
    expect(t.jobName).toBe("ANAKİRİŞ");
    expect(t.parentProject).toBe("15Tx24MKÖPRÜLÜTAVANVİNÇ");
    expect(t.customer).toBe("MTCPASLANMAZ");
    expect(t.weightKg).toBe(1498.457);
    expect(t.qty).toBe(2);
    expect(t.scale).toBe("1 : 25");
    expect(t.sheetSize).toBe("A0");
    expect(t.dateIso).toBe("2026-01-27");
  });

  it("MTC parça resmi — DXF kutusuyla karşılaştırılabilir nominal taşır", () => {
    const t = readTitleBlock(MTC_PARCA.spans).titleBlock;
    expect(t.drawingNo).toBe("0043-00-0100-01");
    expect(t.jobName).toBe("SAC8x475x8270");
    expect(t.weightKg).toBe(31.388);
    expect(t.material).toBe("S355JR");
    expect(t.scale).toBe("1 : 50");
  });

  it("boş hücre BOŞ kalır — müşteri ve malzeme uydurulmaz", () => {
    const t = readTitleBlock(MTC_BOS_MUSTERI.spans).titleBlock;
    expect(t.customer).toBe("");
    expect(t.material).toBe("");
    // Buna karşılık dolu olanlar okunuyor: alan boş çünkü VERİ yok, okuyucu
    // kör olduğu için değil.
    expect(t.drawingNo).toBe("0043-00-0050");
    expect(t.jobName).toBe("BARAAKIMALMAKOLU");
    expect(t.weightKg).toBe(10.861);
    expect(t.drawnBy).toBe("ÖMERPOYRAZ");
    // TEK HANELİ GÜN: "3.06.2026"
    expect(t.dateIso).toBe("2026-06-03");
  });

  it("ağırlık değeri etiketin taban çizgisinden 1,6 punto yukarıda olsa da okunur", () => {
    // Bu resimde `0,338kg` `Ağ/Wt :` ile aynı taban çizgisinde BASILMAMIŞ.
    // Satır gruplamasına güvenen sürüm bu dosyada ağırlığı hiç bulamıyordu.
    const t = readTitleBlock(MONORAY_PORTRE.spans).titleBlock;
    expect(t.weightKg).toBe(0.338);
    expect(t.weightNA).toBe(false);
  });

  it("ondalık ayracı ne olursa olsun sayıya çevrilir", () => {
    expect(readTitleBlock(MONORAY_PARCA.spans).titleBlock.weightKg).toBeCloseTo(4.1, 6);
    expect(readTitleBlock(MTC_MONTAJ_A0.spans).titleBlock.weightKg).toBeCloseTo(1498.457, 6);
    expect(readTitleBlock(MTC_PARCA.spans).titleBlock.weightKg).toBeCloseTo(31.388, 6);
  });

  it("çizen ve onaylayan alanlarına TARİH sızmaz", () => {
    for (const s of FIXTURE_SHEETS) {
      const t = readTitleBlock(s.spans).titleBlock;
      expect(t.drawnBy, s.file).not.toMatch(/\d{1,2}[.,]\d{1,2}[.,]\d{4}/);
      expect(t.approvedBy, s.file).not.toMatch(/\d{1,2}[.,]\d{1,2}[.,]\d{4}/);
      expect(t.approvedBy, s.file).toBe("SİNANÇOLAKOĞLU");
    }
  });
});

describe("antet — YANLIŞ ALARM koruması", () => {
  it("fikstür gerçekten tuzak taşıyor (yoksa bu bölüm hiçbir şey kanıtlamaz)", () => {
    const olcular = MONORAY_PORTRE.spans.map((s) => s.text).join("|");
    expect(olcular).toContain("+0,5");
    expect(olcular).toContain("-0,5");
    const telif = MONORAY_PARCA.spans.map((s) => s.text).join(" ");
    expect(telif).toContain("rezerved");
  });

  it("ölçü yazıları ve telif cümlesi hiçbir alana yazılmaz", () => {
    const tuzak =
      /\+0,5|-0,5|rezerved|Copying|Doküman|yasaktır|İmza|İsim|Signature|Unspecified|Verilmeyen/i;
    for (const s of FIXTURE_SHEETS) {
      const t = readTitleBlock(s.spans).titleBlock;
      for (const [alan, deger] of Object.entries(t)) {
        if (typeof deger !== "string" || deger === "") continue;
        expect(deger, `${s.file} · ${alan}`).not.toMatch(tuzak);
      }
    }
  });

  it("revizyon hücresi boşken revizyon BOŞ kalır", () => {
    // `Rev / Rev` etiketinin altındaki ilk hücre çoğu resimde alt başlık
    // satırıdır ("İsim / Name") ya da onay tarihidir. Şekil denetimi ikisini
    // de eler: 240 gerçek resmin 240'ında revizyon boş çıkıyor.
    for (const s of FIXTURE_SHEETS) {
      expect(readTitleBlock(s.spans).titleBlock.revision, s.file).toBe("");
    }
  });

  it("`Designation` içindeki `Design` pafta boyu sanılmaz", () => {
    const basliklar = MONORAY_PARCA.spans.map((s) => s.text).join(" ");
    expect(basliklar).toContain("Designation");
    expect(readTitleBlock(MONORAY_PARCA.spans).titleBlock.sheetSize).toBe("A4");
  });
});

describe("antet — SIRA ve ÖLÇEK bağımsızlığı", () => {
  it("span dizisi karıştırılınca sonuç bit bit aynı kalır", () => {
    for (const s of FIXTURE_SHEETS) {
      const duz = readTitleBlock(s.spans);
      const karisik = readTitleBlock(karistir(s.spans));
      expect(karisik.titleBlock, s.file).toEqual(duz.titleBlock);
      expect(karisik.labelsFound, s.file).toBe(duz.labelsFound);
    }
  });

  it("parça tablosu da span sırasından bağımsızdır", () => {
    for (const s of FIXTURE_SHEETS) {
      expect(readSheetBom(karistir(s.spans)), s.file).toEqual(readSheetBom(s.spans));
    }
  });

  it("A4 ile A0 aynı alanları verir — eşikler orana bağlı", () => {
    const a4 = readTitleBlock(MTC_PARCA.spans).titleBlock;
    const a0 = readTitleBlock(MTC_MONTAJ_A0.spans).titleBlock;
    expect(MTC_PARCA.pageWidth).toBe(842);
    expect(MTC_MONTAJ_A0.pageWidth).toBe(3370);
    for (const alan of ["drawingNo", "projectNo", "customer", "scale", "sheetSize"] as const) {
      expect(a4[alan], alan).not.toBe("");
      expect(a0[alan], alan).not.toBe("");
    }
    expect(a4.customer).toBe(a0.customer);
    expect(a4.projectNo).toBe(a0.projectNo);
  });
});

describe("montaj parça tablosu", () => {
  it("MTC ana kirişi 24 satır verir", () => {
    const bom = readSheetBom(MTC_MONTAJ_A0.spans);
    expect(bom).toHaveLength(24);
    expect(bom[0]).toEqual({
      pos: "1",
      partCode: "0043-00-0100-01",
      designation: "SAC 8x475x8270",
      material: "S355JR",
      qty: 1,
      massKg: 31.4,
      totalMassKg: null,
      page: 1,
    });
    expect(bom[18]).toMatchObject({
      pos: "19",
      partCode: "0043-00-0100-19",
      material: "S355JR",
      qty: 2,
      massKg: 104.6,
    });
    expect(bom[23]).toMatchObject({ pos: "24", designation: "MERKEZLEME PİMİ Ø45x55", qty: 4 });
    // Pozisyonlar 1…24, boşluksuz: tablo bir yerinden kopmamış.
    expect(bom.map((r) => r.pos)).toEqual(Array.from({ length: 24 }, (_, i) => String(i + 1)));
  });

  it("MONORAY montajında `Toplam Ağırlık` AYRI bir sütundur", () => {
    const bom = readSheetBom(MONORAY_MONTAJ.spans);
    expect(bom).toHaveLength(12);
    // Birim 4,100 kg · toplam 4 kg — aynı sütuna düşselerdi ayırt edilemezlerdi.
    expect(bom[0]).toMatchObject({ partCode: "0057-00-0510-01", massKg: 4.1, totalMassKg: 4 });
    expect(bom[6]).toMatchObject({ partCode: "0057-00-0510-07", qty: 4, massKg: 0.557, totalMassKg: 2 });
    // KODSUZ satırlar da okunur: cıvata ve rondela ürün ağacında yok.
    expect(bom[10]).toMatchObject({ designation: "CİVATA M8x22 DIN933", partCode: "", qty: 8 });
    expect(bom[11]).toMatchObject({ designation: "YAYLI RONDELA M8 DIN127", material: "FSt" });
  });

  it("aynı pakette iki farklı sütun kümesi bir arada yaşar", () => {
    expect(readSheetBom(MONORAY_MONTAJ.spans).some((r) => r.totalMassKg !== null)).toBe(true);
    expect(readSheetBom(MTC_MONTAJ_A0.spans).every((r) => r.totalMassKg === null)).toBe(true);
  });

  it("parça resminin kendi tek satırlık listesi de okunur", () => {
    const bom = readSheetBom(MONORAY_PARCA.spans);
    expect(bom).toHaveLength(1);
    expect(bom[0]).toMatchObject({ partCode: "0057-00-0510-01", massKg: 4.1, qty: 1 });
  });

  it("ağırlık hücresi parça kodu sanılmaz", () => {
    // Kodu olmayan satırlarda hizalama bir sütun kayabiliyor; şekil denetimi
    // `0,0` gibi bir değeri parça kodu olarak KABUL ETMEZ.
    for (const s of FIXTURE_SHEETS) {
      for (const r of readSheetBom(s.spans)) {
        if (!r.partCode) continue;
        expect(r.partCode, `${s.file} · ${r.pos}`).not.toMatch(/[,]|kg/i);
        expect(r.partCode.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("sayfa numarası taşınır", () => {
    expect(readSheetBom(MONORAY_PARCA.spans, 3)[0].page).toBe(3);
  });

  it("tablo yoksa boş dizi döner", () => {
    expect(readSheetBom([])).toEqual([]);
    expect(readSheetBom([{ text: "SADECE BİR YAZI", x: 10, y: 10, w: 40, h: 5 }])).toEqual([]);
  });
});

describe("geometrisiz düşük irtifa yolu", () => {
  it("belirteçler KARIŞIK SIRAYLA verilince aynı sonucu döndürür", () => {
    // Belirteç = antette bir HÜCREYİ dolduran metin. Hücrelerin sırası
    // değişince sonuç değişmemeli: bu yol komşuluğa değil ŞEKLE bakar.
    const belirtecler = [
      "ResimNo / Drawing No:", "0057-00-0510-01", "Ağ/Wt :", "4,100 kg",
      "Ölçek/Scale", "1 : 2,5", "Tasarım Design", "A4", "18.06.2026",
      "Firma Adı / Customer:", "ASTOR A.Ş.", "18.06.2026",
    ];
    const duz = readTitleBlockFromText(belirtecler.join(" "));
    const ters = readTitleBlockFromText(belirtecler.slice().reverse().join(" "));
    const karisik = readTitleBlockFromText(
      [8, 1, 10, 3, 5, 7, 0, 2, 4, 6, 9, 11].map((i) => belirtecler[i]).join(" ")
    );
    expect(ters).toEqual(duz);
    expect(karisik).toEqual(duz);
    expect(duz.weightKg).toBe(4.1);
    expect(duz.drawingNo).toBe("0057-00-0510-01");
    expect(duz.scale).toBe("1 : 2,5");
    expect(duz.sheetSize).toBe("A4");
    expect(duz.dateIso).toBe("2026-06-18");
  });

  it("birimin SAYIYA BİTİŞİK olması tek komşuluk şartıdır", () => {
    // Bu yolun bilinen sınırı: `kg` sayının sağında olmalı. Gerçek metinde
    // ikisi tek bir hücrede geliyor, ama sınır yazıya dökülmezse bir gün
    // sessizce ihlal edilir.
    expect(readTitleBlockFromText("Ağ/Wt : 4,100 kg").weightKg).toBe(4.1);
    expect(readTitleBlockFromText("kg 4,100 Ağ/Wt :").weightKg).toBeNull();
  });

  it("değer TEK DEĞİLSE hiç okunmaz — yanlışını seçmektense boş bırakır", () => {
    expect(readTitleBlockFromText("1 : 5 ölçek ama başka yerde 1 : 25 de yazıyor").scale).toBe("");
    expect(readTitleBlockFromText("4,100 kg ve 9,269 kg").weightKg).toBeNull();
  });

  it("gerçek sayfa metninde ağırlık, ölçek ve tarih çıkar", () => {
    const metin = MONORAY_PARCA.spans.map((s) => s.text).join(" ");
    const t = readTitleBlockFromText(metin);
    expect(t.weightKg).toBe(4.1);
    expect(t.scale).toBe("1 : 2,5");
    expect(t.sheetSize).toBe("A4");
    expect(t.dateIso).toBe("2026-06-18");
    // Geometri olmadan müşteri/malzeme okunamaz ve UYDURULMAZ.
    expect(t.customer).toBe("");
    expect(t.material).toBe("");
  });

  it("boş metin boş sonuç verir", () => {
    expect(readTitleBlockFromText("").drawingNo).toBe("");
  });
});

describe("satır modeli", () => {
  it("aynı taban çizgisindeki komşu hücreler tek satırda toplanır", () => {
    const satirlar = buildLines(MONORAY_PARCA.spans);
    const antetSatiri = satirlar.find((l) => l.text.includes("Ağ/Wt"));
    expect(antetSatiri).toBeDefined();
    // Bu "satır" bir ANLAM BİRİMİ DEĞİL, bir ızgara satırıdır: içinde dört
    // ayrı alanın etiketi var. Düz dizge yolunun neden çalışmadığının kanıtı.
    expect(antetSatiri!.text).toContain("Rev");
    expect(antetSatiri!.text).toContain("Açıklama");
    expect(antetSatiri!.text).toContain("Ad/Qty");
  });

  it("boş span dizisi boş satır listesi verir", () => {
    expect(buildLines([])).toEqual([]);
  });
});
