// Dosya adı çözümleme — İKİ GERÇEK PAKETİN 628 DOSYASINA karşı.
//
// Bu testin en önemli maddesi ilk maddesidir: hiçbir dosya adı FIRLATMAZ.
// Modülün sözü "tanıyamazsam bile kaybetmem"dir; bir ayrıştırma istisnası o
// sözü bozar ve 454 dosyalık bir yüklemeyi ortasından keser.
//
// İkinci önemli madde çeşitliliktir. Tek klasörle yazılmış her kural
// ikincisinde kırıldı: tireli ↔ alt çizgili klasör adı, S'li ↔ S'siz malzeme,
// tam ↔ ondalıklı kalınlık, kod-ad-adet ↔ kod-adet-ad sırası. Fikstür ikisini
// birden taşıdığı için bu artık kalıcı bir koruma.

import { describe, expect, it } from "vitest";
import { parseBomFileName, parseFile, pathHints } from "../file-name";
import { MONORAY, MTC } from "./fixtures/packages";

const TUM_DOSYALAR = [...MONORAY.files, ...MTC.files];

describe("parseFile — gerçek paketlere karşı", () => {
  it("628 dosyanın hiçbiri fırlatmaz", () => {
    expect(TUM_DOSYALAR).toHaveLength(628);
    for (const f of TUM_DOSYALAR) {
      expect(() => parseFile({ relPath: f.path, size: f.size, checksum: f.hash })).not.toThrow();
    }
  });

  it("hariç tutulanlar dışındaki her dosyanın kodu çözülür", () => {
    const cozulemeyen = TUM_DOSYALAR
      .map((f) => parseFile({ relPath: f.path }))
      .filter((p) => p.lifecycle !== "haric" && !p.partCode)
      .map((p) => p.relPath);
    expect(cozulemeyen).toEqual([]);
  });

  it("MTC'deki 10 .bak dosyası hariç tutulur", () => {
    const haric = MTC.files
      .map((f) => parseFile({ relPath: f.path }))
      .filter((p) => p.ext === "bak");
    expect(haric).toHaveLength(10);
    expect(haric.every((p) => p.lifecycle === "haric")).toBe(true);
  });

  it("_Sheet çalışma dosyaları hariç tutulur ve kodları yine çözülür", () => {
    const sheet = MONORAY.files
      .map((f) => parseFile({ relPath: f.path }))
      .filter((p) => /_Sheet/i.test(p.fileName));
    expect(sheet.map((p) => p.fileName).sort()).toEqual([
      "0057-00-1000-03_Sheet.dwg",
      "0057-00-1000_Sheet.dwg",
    ]);
    expect(sheet.every((p) => p.lifecycle === "haric")).toBe(true);
    expect(sheet.map((p) => p.partCode).sort()).toEqual(["0057-00-1000", "0057-00-1000-03"]);
  });

  it("İPTAL klasöründeki dosyalar iptal olarak işaretlenir", () => {
    const iptal = TUM_DOSYALAR
      .map((f) => parseFile({ relPath: f.path }))
      .filter((p) => p.lifecycle === "iptal");
    // MONORAY: DWG/İPTAL'de 2 dwg + 2 pdf, EXCEL/İPTAL'de 1 xlsx.
    // MTC: EXCEL/İPTAL'de 2 xlsx. İPTAL bir klasör adı değil bir DURUM'dur ve
    // paketin herhangi bir yerinde belirebilir — sayım bunu dondurur.
    expect(iptal).toHaveLength(7);
    expect(iptal.filter((p) => p.role === "bom")).toHaveLength(3);
  });

  it("3B modeller model3d rolü alır", () => {
    const uc = MTC.files.map((f) => parseFile({ relPath: f.path })).filter((p) => p.role === "model3d");
    expect(uc.map((p) => p.partCode).sort()).toEqual(["0043-00-0200", "0043-00-0801"]);
  });

  it("BÜKÜM klasöründeki PDF'ler bukum rolü alır (kökte de, DXF altında da)", () => {
    const bukum = TUM_DOSYALAR.map((f) => parseFile({ relPath: f.path })).filter((p) => p.role === "bukum");
    // MONORAY: DXF/BUKUM PDF altında 3, MTC: kökte BUKUM PDF altında 1
    expect(bukum).toHaveLength(4);
  });
});

describe("parseFile — sıradan bağımsız parça çözümleme", () => {
  const c = (relPath: string) => parseFile({ relPath });

  it("malzeme · kalınlık · kod · adet sırası", () => {
    const p = c("DXF/S235JR-10MM/S235JR - 10MM - 0057-00-0510-04 - (2 ADET).dxf");
    expect(p).toMatchObject({
      partCode: "0057-00-0510-04",
      material: "S235JR",
      thicknessMm: 10,
      qty: 2,
      role: "kesim",
      recognizedBy: "dosya.parcali",
    });
  });

  it("kod · ad · adet sırası", () => {
    expect(c("İSLEME RESİMLERİ/0043-00-0300-01 - TEKER - (4 ADET).pdf")).toMatchObject({
      partCode: "0043-00-0300-01",
      label: "TEKER",
      qty: 4,
    });
  });

  it("kod · adet · ad sırası — aynı sonuç", () => {
    expect(c("İSLEME RESİMLERİ/0043-00-0600-01 - (2 ADET) - KANCA ASKI SACI.dwg")).toMatchObject({
      partCode: "0043-00-0600-01",
      label: "KANCA ASKI SACI",
      qty: 2,
    });
  });

  it("kod · ad (adet yok)", () => {
    expect(c("DWG/0043-00-0100 - ANA KIRIS BIRLESTIRME SAC DETAYLARI.dwg")).toMatchObject({
      partCode: "0043-00-0100",
      label: "ANA KIRIS BIRLESTIRME SAC DETAYLARI",
      qty: null,
    });
  });

  it("yalnız kod", () => {
    expect(c("DWG/0057-00-0510-01.dwg")).toMatchObject({
      partCode: "0057-00-0510-01",
      label: "",
      qty: null,
      role: "model",
    });
  });

  it("S deseni olmayan malzeme ve ondalıklı kalınlık", () => {
    // "BDS - 3,6MM" — malzemeye desen dayatmak bu dosyayı düşürürdü.
    expect(c("DXF/BDS-3,6MM/BDS - 3,6MM - 0043-00-0400-02 - (2 ADET).dxf")).toMatchObject({
      partCode: "0043-00-0400-02",
      material: "BDS",
      thicknessMm: 3.6,
      qty: 2,
    });
  });

  it("beş haneli iş öneki yazım hatası normalize edilir", () => {
    const p = c("DXF/S355JR-35MM/S355JR - 35MM - 00057-00-0700-02 - (1 ADET).dxf");
    expect(p.partCode).toBe("0057-00-0700-02");
    expect(p.codeNormalized).toBe(true);
  });

  it("altı segmentli derin kod", () => {
    expect(c("DXF/S235JR-4MM/S235JR - 4MM - 0043-00-0802-00-02-06 - (1 ADET).dxf").partCode).toBe(
      "0043-00-0802-00-02-06"
    );
  });
});

describe("klasör malzeme beyanı çelişkisi — DOSYA ADI KAZANIR", () => {
  // İKİ PAKETTE DE aynı durum var: klasör S235JR diyor, dosya adı S355JR.
  // BOM dosya adını doğruluyor. Klasöre güvenmek yanlış sacı kestirirdi.
  it("MONORAY: S235JR-6MM klasöründe S355JR dosyası", () => {
    const p = parseFile({
      relPath: "DXF/S235JR-6MM/S355JR - 6MM - 0057-00-0600-00-01-02 - (1 ADET).dxf",
    });
    expect(p.material).toBe("S355JR");
    expect(p.folderMaterial).toBe("S235JR");
  });

  it("MTC: aynı desen tekrarlanıyor", () => {
    const p = parseFile({
      relPath: "DXF/S235JR-6MM/S355JR - 6MM - 0043-00-0100-05 - (30 ADET).dxf",
    });
    expect(p.material).toBe("S355JR");
    expect(p.folderMaterial).toBe("S235JR");
    expect(p.qty).toBe(30);
  });

  it("dosya adında malzeme yoksa klasör beyanı kullanılır", () => {
    const p = parseFile({ relPath: "DXF/S235JR-8MM/0043-00-9999-01.dxf" });
    expect(p.material).toBe("S235JR");
    expect(p.thicknessMm).toBe(8);
  });
});

describe("pathHints", () => {
  it("BDS-3,6MM klasörü ondalıklı kalınlık verir", () => {
    expect(pathHints(["DXF", "BDS-3,6MM"])).toMatchObject({ material: "BDS", thicknessMm: 3.6 });
  });

  it("İPTAL noktasız yazılsa da tanınır", () => {
    expect(pathHints(["DWG", "IPTAL"]).lifecycle).toBe("iptal");
    expect(pathHints(["DWG", "İPTAL"]).lifecycle).toBe("iptal");
  });
});

describe("parseBomFileName", () => {
  it("DEPO dosyası", () => {
    expect(parseBomFileName("2.0057-00-0500_DEPO_31.07.2026.xlsx")).toEqual({
      code: "0057-00-0500",
      kind: "depo",
      date: "2026-07-31",
      revPrefix: 2,
    });
  });

  it("ÜRÜN AĞACI dosyası", () => {
    expect(parseBomFileName("1.0043-01-0000_URUN AGACI_25.02.2026.xlsx")).toMatchObject({
      code: "0043-01-0000",
      kind: "urun_agaci",
      date: "2026-02-25",
      revPrefix: 1,
    });
  });

  it("tarih ayracı virgül olabilir", () => {
    expect(parseBomFileName("1.0043-00-0050_DEPO_04,06,2026.xlsx").date).toBe("2026-06-04");
  });

  it("tanınmayan ad okumayı engellemez — yalnız bilgi eksilir", () => {
    expect(parseBomFileName("liste.xlsx")).toEqual({
      code: "",
      kind: "bilinmiyor",
      date: null,
      revPrefix: null,
    });
  });

  it("fikstürdeki sekiz Excel'in yedisinin kodu çözülür", () => {
    const excels = [...MONORAY.files, ...MTC.files].filter((f) => f.path.endsWith(".xlsx"));
    expect(excels).toHaveLength(9);
    const cozulen = excels
      .map((f) => parseBomFileName(f.path.split("/").pop() ?? ""))
      .filter((b) => b.code);
    expect(cozulen).toHaveLength(9);
  });
});
