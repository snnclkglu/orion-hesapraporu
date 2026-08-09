// DXF başlığı okuyucusu — üç gerçek AutoCAD sürümüne karşı.
//
// Fikstürdeki baytlar GERÇEKTİR (windows-1254, base64). Kod sayfası testinin
// anlamı ancak gerçek baytla vardır: uydurulmuş bir UTF-8 dizgesi, dosyaların
// `ANSI_1254` beyan ettiği gerçeğini hiç sınamazdı.

import { describe, expect, it } from "vitest";
import {
  decodeDxf,
  decoderLabelFor,
  emptyDxfHeader,
  readDxf,
  readDxfBytes,
  sniffCodePage,
} from "../dxf-header";
import { DXF_AC1015, DXF_AC1018, DXF_AC1032, FIXTURE_DXF, dxfBytes } from "./fixtures/content";

/** Sağa hizalı kodlarla, CRLF'li küçük bir DXF kurar. */
function dxfMetni(satirlar: string[], sonu = "\r\n"): string {
  return satirlar.join(sonu) + sonu;
}

const BASLIK = [
  "  0", "SECTION", "  2", "HEADER",
  "  9", "$ACADVER", "  1", "AC1018",
  "  9", "$DWGCODEPAGE", "  3", "ANSI_1254",
  "  9", "$EXTMIN", " 10", "0.0", " 20", "0.0", " 30", "0.0",
  "  9", "$EXTMAX", " 10", "100.0", " 20", "50.0", " 30", "0.0",
  "  9", "$INSUNITS", " 70", "     4",
  "  0", "ENDSEC",
];

describe("gerçek dosyalar", () => {
  it("üç sürüm de okunuyor", () => {
    for (const f of FIXTURE_DXF) {
      const h = readDxfBytes(dxfBytes(f));
      expect(h.version, f.file).toBe(f.version);
      expect(h.unitsCode, f.file).toBe("4");
      expect(h.unitsMm, f.file).toBe(true);
      expect(h.codePage, f.file).toBe("ANSI_1254");
      expect(h.extentsXMm, f.file).not.toBeNull();
      expect(h.extentsYMm, f.file).not.toBeNull();
      expect(h.note, f.file).toBe("");
    }
    expect(FIXTURE_DXF.map((f) => f.version)).toEqual(["AC1018", "AC1032", "AC1015"]);
  });

  it("sürüm etiketleri insan diline çevriliyor", () => {
    expect(readDxfBytes(dxfBytes(DXF_AC1018)).versionLabel).toBe("AutoCAD 2004");
    expect(readDxfBytes(dxfBytes(DXF_AC1032)).versionLabel).toBe("AutoCAD 2018");
    expect(readDxfBytes(dxfBytes(DXF_AC1015)).versionLabel).toBe("AutoCAD 2000");
  });

  it("MTC ana kiriş sacı: DXF kutusu NOMİNAL ölçüyle örtüşüyor", () => {
    // Aynı fikstürdeki MTC_MONTAJ_A0 tablosunda bu parça `SAC 8x475x8270`
    // yazıyor. Kesim kutusunun nominalle karşılaştırılabildiğinin kanıtı budur.
    const h = readDxfBytes(dxfBytes(DXF_AC1018));
    expect(h.extentsXMm!).toBeCloseTo(8270, 3);
    expect(h.extentsYMm!).toBeCloseTo(475, 3);
  });

  it("diğer iki dosyanın kutusu dondurulmuş", () => {
    const a = readDxfBytes(dxfBytes(DXF_AC1032));
    expect(a.extentsXMm!).toBeCloseTo(572.7736, 3);
    expect(a.extentsYMm!).toBeCloseTo(55, 6);
    const b = readDxfBytes(dxfBytes(DXF_AC1015));
    expect(b.extentsXMm!).toBeCloseTo(645.5469, 3);
    expect(b.extentsYMm!).toBeCloseTo(44.5, 6);
  });

  it("katman listesi ve varlık histogramı okunuyor", () => {
    // Bu derlemenin gerçeği: neredeyse her şey katman 0'da. Değerli olan
    // extents; katman/histogram bilgi değeri düşük ama kayda geçer.
    expect(readDxfBytes(dxfBytes(DXF_AC1018)).layers).toEqual(["0"]);
    expect(readDxfBytes(dxfBytes(DXF_AC1032)).entityCounts).toEqual({ POLYLINE: 1, VERTEX: 11 });
    expect(readDxfBytes(dxfBytes(DXF_AC1015)).entityCounts).toEqual({ LINE: 12 });
  });
});

describe("kod sayfası", () => {
  it("ilk kilobaytlardan koklanıyor", () => {
    for (const f of FIXTURE_DXF) {
      expect(sniffCodePage(dxfBytes(f)), f.file).toBe("ANSI_1254");
    }
  });

  it("ANSI_1254 windows-1254'e çevriliyor, bilinmeyen UTF-8'e düşüyor", () => {
    expect(decoderLabelFor("ANSI_1254")).toBe("windows-1254");
    expect(decoderLabelFor("ansi_1252")).toBe("windows-1252");
    expect(decoderLabelFor("")).toBe("utf-8");
    expect(decoderLabelFor("BİLİNMEYEN")).toBe("utf-8");
  });

  it("GERÇEK bir Türkçe tablo adı doğru çözülüyor", () => {
    // `gyhjıuıo` bu dosyada gerçekten var (ressamın deneme bloğu) ve içinde
    // noktasız `ı` (0xFD) geçiyor. UTF-8 ile çözülse `gyhj�u�o` olurdu.
    const { text, codePage } = decodeDxf(dxfBytes(DXF_AC1015));
    expect(codePage).toBe("ANSI_1254");
    expect(text).toContain("gyhjıuıo");
    expect(text).not.toContain("�");
  });

  it("UTF-8 ile çözmek aynı baytları bozar (karşı kanıt)", () => {
    const bozuk = new TextDecoder("utf-8").decode(dxfBytes(DXF_AC1015));
    expect(bozuk).not.toContain("gyhjıuıo");
  });

  it("kod sayfası beyan edilmemişse UTF-8 ile okunur", () => {
    const metin = dxfMetni(BASLIK.filter((s, i, a) => a[i - 1] !== "$DWGCODEPAGE" && s !== "$DWGCODEPAGE" && s !== "  3"));
    const bayt = new TextEncoder().encode(metin);
    expect(sniffCodePage(bayt)).toBe("");
    expect(readDxfBytes(bayt).version).toBe("AC1018");
  });
});

describe("biçim dayanıklılığı", () => {
  it("CRLF ve LF satır sonu aynı sonucu verir", () => {
    const crlf = readDxf(dxfMetni(BASLIK, "\r\n"));
    const lf = readDxf(dxfMetni(BASLIK, "\n"));
    expect(lf).toEqual(crlf);
    expect(crlf.extentsXMm).toBe(100);
    expect(crlf.extentsYMm).toBe(50);
  });

  it("sağa hizalı grup kodları trim ediliyor", () => {
    // Kaynak dosyalarda kodlar `  0` · ` 70` · `  9` diye yazılıyor.
    expect(readDxf(dxfMetni(BASLIK)).unitsCode).toBe("4");
  });

  it("İLK ENDSEC'ten sonrası HEADER'a karışmaz", () => {
    const metin = dxfMetni([
      ...BASLIK,
      "  0", "SECTION", "  2", "OBJECTS",
      "  9", "$ACADVER", "  1", "SAHTE_SURUM",
      "  9", "$EXTMAX", " 10", "999999.0", " 20", "999999.0",
      "  0", "ENDSEC", "  0", "EOF",
    ]);
    const h = readDxf(metin);
    expect(h.version).toBe("AC1018");
    expect(h.extentsXMm).toBe(100);
  });

  it("tanımsız extent (±1.0E+20) null olur", () => {
    const metin = dxfMetni([
      "  0", "SECTION", "  2", "HEADER",
      "  9", "$ACADVER", "  1", "AC1015",
      "  9", "$INSUNITS", " 70", "     4",
      "  9", "$EXTMIN", " 10", "1.0E+20", " 20", "1.0E+20", " 30", "1.0E+20",
      "  9", "$EXTMAX", " 10", "-1.0E+20", " 20", "-1.0E+20", " 30", "-1.0E+20",
      "  0", "ENDSEC",
    ]);
    const h = readDxf(metin);
    expect(h.version).toBe("AC1015");
    expect(h.extentsXMm).toBeNull();
    expect(h.extentsYMm).toBeNull();
  });

  it("birim bilinmiyorsa ölçü YAZILMAZ", () => {
    // "Muhtemelen mm'dir" demek kesimciye yanlış boyda parça göstermektir.
    const metin = dxfMetni([
      "  0", "SECTION", "  2", "HEADER",
      "  9", "$ACADVER", "  1", "AC1015",
      "  9", "$INSUNITS", " 70", "     0",
      "  9", "$EXTMIN", " 10", "0.0", " 20", "0.0",
      "  9", "$EXTMAX", " 10", "10.0", " 20", "5.0",
      "  0", "ENDSEC",
    ]);
    const h = readDxf(metin);
    expect(h.unitsMm).toBe(false);
    expect(h.extentsXMm).toBeNull();
  });

  it("inç beyan eden dosya milimetreye çevrilir", () => {
    const metin = dxfMetni([
      "  0", "SECTION", "  2", "HEADER",
      "  9", "$INSUNITS", " 70", "     1",
      "  9", "$EXTMIN", " 10", "0.0", " 20", "0.0",
      "  9", "$EXTMAX", " 10", "1.0", " 20", "2.0",
      "  0", "ENDSEC",
    ]);
    const h = readDxf(metin);
    expect(h.unitsMm).toBe(false);
    expect(h.extentsXMm).toBeCloseTo(25.4, 6);
    expect(h.extentsYMm).toBeCloseTo(50.8, 6);
  });

  it("ortadan kesilmiş dosya FIRLATMAZ, eldekini verir", () => {
    const tam = dxfMetni(BASLIK);
    const kesik = tam.slice(0, Math.floor(tam.length * 0.6));
    expect(() => readDxf(kesik)).not.toThrow();
    expect(readDxf(kesik).version).toBe("AC1018");
  });

  it("çöp girdi boş sonuç ve DXF_OKUNAMADI verir", () => {
    expect(readDxf("")).toEqual({ ...emptyDxfHeader(), note: "DXF_OKUNAMADI" });
    expect(readDxf("bu bir DXF değil\r\nsadece metin\r\n").note).toBe("DXF_OKUNAMADI");
    expect(readDxfBytes(new Uint8Array([1, 2, 3]))).toMatchObject({ note: "DXF_OKUNAMADI" });
  });

  it("STYLE tablosundaki adlar KATMAN sanılmaz", () => {
    const metin = dxfMetni([
      ...BASLIK,
      "  0", "SECTION", "  2", "TABLES",
      "  0", "TABLE", "  2", "STYLE",
      "  0", "STYLE", "  2", "Ölçülendirme Yazı Stili",
      "  0", "ENDTAB",
      "  0", "TABLE", "  2", "LAYER",
      "  0", "LAYER", "  5", "10", "  2", "KESIM",
      "  0", "ENDTAB",
      "  0", "ENDSEC",
    ]);
    expect(readDxf(metin).layers).toEqual(["KESIM"]);
  });
});

describe("5 MB sınırı", () => {
  it("büyük dosyada BAŞLIK yine okunur, yalnız katman/histogram atlanır", () => {
    // Brifingdeki "temiz şekilde vazgeç" kuralı bilgi kaybıydı: gözlenen en
    // büyük DXF 553 KB ve başlık bölümü ortalama 6,5 KB. Büyük bir genel
    // görünüş dosyası gelirse ölçüsünü kaybetmek yerine ayrıntıyı bırakırız.
    const dolgu = dxfMetni(
      Array.from({ length: 300_000 }, () => ["  0", "LINE", "  8", "0"]).flat()
    );
    const metin = dxfMetni([
      ...BASLIK,
      "  0", "SECTION", "  2", "TABLES",
      "  0", "TABLE", "  2", "LAYER", "  0", "LAYER", "  2", "KESIM", "  0", "ENDTAB",
      "  0", "ENDSEC",
      "  0", "SECTION", "  2", "ENTITIES",
    ]) + dolgu + dxfMetni(["  0", "ENDSEC", "  0", "EOF"]);

    expect(metin.length).toBeGreaterThan(5 * 1024 * 1024);
    const h = readDxf(metin);
    expect(h.note).toBe("DXF_KISMI_OKUNDU");
    expect(h.version).toBe("AC1018");
    expect(h.extentsXMm).toBe(100);
    expect(h.layers).toEqual([]);
    expect(h.entityCounts).toEqual({});
  });

  it("sınırın altındaki dosyada ayrıntı okunur", () => {
    const metin = dxfMetni([
      ...BASLIK,
      "  0", "SECTION", "  2", "TABLES",
      "  0", "TABLE", "  2", "LAYER", "  0", "LAYER", "  2", "KESIM", "  0", "ENDTAB",
      "  0", "ENDSEC",
      "  0", "SECTION", "  2", "ENTITIES",
      "  0", "LWPOLYLINE", "  8", "0",
      "  0", "LWPOLYLINE", "  8", "0",
      "  0", "CIRCLE", "  8", "0",
      "  0", "ENDSEC", "  0", "EOF",
    ]);
    const h = readDxf(metin);
    expect(h.note).toBe("");
    expect(h.layers).toEqual(["KESIM"]);
    expect(h.entityCounts).toEqual({ LWPOLYLINE: 2, CIRCLE: 1 });
  });
});
