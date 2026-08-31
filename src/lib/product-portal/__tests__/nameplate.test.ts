import { describe, expect, it } from "vitest";
import {
  NAMEPLATE_SIZE_PRESETS,
  QR_MODULE_MIN_MM,
  READABLE_MIN_MM,
  buildNameplateSvg,
  createNameplateLayout,
  estimatedTextWidth,
  productPortalUrl,
  trackedGlyphs,
} from "../nameplate";
import type { ProductIdentityValues } from "../types";

const identity: ProductIdentityValues = {
  manufacturer: "ORION CRANES",
  manufacturerAddress: "Organize Sanayi Bölgesi, Ankara · TÜRKİYE",
  machineModel: "ORION DGK-100/1485",
  mass: "48,5 t",
  product: "80/20 TON ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
  craneType: "Çift Kirişli Gezer Köprülü Vinç",
  projectCode: "0057-01",
  productionYear: "2026",
  capacity: "80 t / 20 t",
  span: "24 m",
  liftHeight: "18 m",
  dutyClass: "FEM 3m / ISO M6",
  supplyVoltage: "400 VAC",
  controlVoltage: "24 VDC",
  frequency: "50 Hz",
  customer: "Müşteri",
  site: "Ankara",
};

describe("baskı isim plakası", () => {
  it("mm ölçüsünü, kalıcı portal URL'sini ve Q hata düzeltmeli QR geometrisini üretir", () => {
    const url = productPortalUrl("https://portal.orioncranes.com/", "23456789ABCDEFGH");
    const svg = buildNameplateSvg({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01-A",
      publicUrl: url,
      identity,
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      customerLogoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
    // Plakaya KAZINAN adres kısa ve kalıcıdır; portalın iç yolu değişse bile
    // `/qr/<kod>` sabit kalır (bkz. `next.config.ts` rewrite'ı).
    expect(url).toBe("https://portal.orioncranes.com/qr/23456789ABCDEFGH");
    expect(svg).toContain('width="240mm" height="160mm"');
    expect(svg).toContain("0057-01-A");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain("#A41E1E");
    expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("uzun vinç adını kesmeden iki dengeli satıra yerleştirir", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity: { ...identity, product: "100 T x 14,85 m kapasiteli çift kirişli gezer köprülü vinç" },
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    expect(layout.title.lines).toHaveLength(2);
    expect(layout.title.lines.join(" ")).toBe("100 T X 14,85 M KAPASİTELİ ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ");
    expect(layout.qr.moduleMm).toBeGreaterThanOrEqual(QR_MODULE_MIN_MM);
  });

  /*
   * Başlık dikey ayracı GEÇMEMELİDİR. Önceki sürüm sığmayan başlığı olduğu gibi
   * basıyordu ve metin QR kutusunun üstüne yazıyordu.
   */
  it("sığmayan başlığı QR sütununa taşırmaz", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity: { ...identity, product: "A".repeat(400) },
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    expect(layout.fits).toBe(false);
    expect(layout.issues.join(" ")).toMatch(/sığmıyor/i);
    expect(layout.title.lines.length).toBeLessThanOrEqual(2);
    const right = layout.divider ? layout.divider.x : layout.widthMm;
    for (const line of layout.title.lines) {
      // Çizicinin kullandığı ölçüyle: hiçbir satır dikey ayracı geçmemeli.
      const end = layout.title.x + estimatedTextWidth(line, layout.title.size);
      expect(end, line.slice(0, 24)).toBeLessThanOrEqual(right);
    }
  });

  /*
   * YASAL ZORUNLULAR: CE işareti, imalatçı künyesi ve azami çalışma yükü
   * (2006/42/AT Ek I md. 1.7.3 ve 4.3.3) her ölçüde basılmalıdır.
   */
  it("yasal bloğu ve belirgin azami yükü her hazır ölçüde basar", () => {
    for (const preset of NAMEPLATE_SIZE_PRESETS) {
      const layout = createNameplateLayout({
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        serialNo: "0057-01",
        publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
        identity,
        logoDataUrl: "/brand/orion-logo-white.svg",
      });
      expect(layout.legal.ce, preset.label).not.toBeNull();
      expect(layout.legal.ce!.height, preset.label).toBeGreaterThanOrEqual(5);
      expect(layout.capacity, preset.label).not.toBeNull();
      expect(layout.legal.lines.length, preset.label).toBeGreaterThan(0);
      expect(layout.fallback.code, preset.label).toBe("23456789ABCDEFGH");
    }
  });

  it("CE işaretini yalnız açıkça kapatıldığında düşürür", () => {
    const base = {
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    };
    expect(createNameplateLayout(base).legal.ce).not.toBeNull();
    expect(createNameplateLayout({ ...base, ceMark: false }).legal.ce).toBeNull();
  });

  /*
   * Zorunlu alanlar `hiddenFields` ile KAPATILAMAZ; anahtar onlara açılmaz ve
   * kapatılmaya çalışılsa bile değer basılır.
   */
  it("yasal zorunlu alanları gizleme isteğini yok sayar", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      hiddenFields: ["product", "capacity", "manufacturerAddress", "productionYear", "machineModel"],
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    expect(layout.capacity?.value).toBe("80 t / 20 t");
    expect(layout.title.lines.join(" ")).toContain("KÖPRÜLÜ");
    expect(layout.legal.lines.some((line) => line.text.includes("2026"))).toBe(true);
  });

  /*
   * Eksik yasal alan SESSİZ KALMAZ: yerleşim gerekçeyi bildirir.
   */
  it("boş yasal alanları gerekçesiyle bildirir", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity: { ...identity, manufacturerAddress: "", productionYear: "", capacity: "", machineModel: "" },
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    const text = layout.issues.join(" ");
    expect(layout.fits).toBe(false);
    expect(text).toMatch(/adres/i);
    expect(text).toMatch(/üretim yılı/i);
    expect(text).toMatch(/azami çalışma yükü/i);
    expect(text).toMatch(/tip \/ model/i);
  });

  /*
   * HARF ARALIĞI İKİ ÇİZİCİDE DE AYNI OLMALIDIR. @react-pdf `letterSpacing`i
   * okumaz; bu yüzden aralık konumla verilir ve model tek kaynaktır.
   */
  it("aralıklı yazıyı karakter karakter konumlar", () => {
    const glyphs = trackedGlyphs("ABC", 10, 4, 1);
    expect(glyphs.map((g) => g.char)).toEqual(["A", "B", "C"]);
    expect(glyphs[0].x).toBe(10);
    expect(glyphs[1].x).toBeGreaterThan(glyphs[0].x);
    expect(glyphs[2].x - glyphs[1].x).toBeCloseTo(glyphs[1].x - glyphs[0].x, 6);
  });

  it("tek renk kipinde markanın kırmızısını basmaz", () => {
    const base = {
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    };
    expect(buildNameplateSvg(base)).toContain("#A41E1E");
    expect(buildNameplateSvg({ ...base, monochrome: true })).not.toContain("#A41E1E");
  });

  it("okunmaz küçüklükteki ölçüyü uyarıyla bildirir", () => {
    const layout = createNameplateLayout({
      widthMm: 120,
      heightMm: 80,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    const smallest = Math.min(...layout.rows.map((row) => row.valueSize), layout.fallback.urlSize);
    expect(smallest).toBeGreaterThanOrEqual(READABLE_MIN_MM - 0.35);
  });

  it("montaj deliğini ancak ölçüler açıkça verildiğinde çizer", () => {
    const base = {
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    };
    expect(buildNameplateSvg(base).match(/<circle/g)).toBeNull();
    expect(buildNameplateSvg({ ...base, holeDiameterMm: 6, holeInsetMm: 9 }).match(/<circle/g)).toHaveLength(4);
  });
});
