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
  mainHoistSummary: "12 m/dak · 2 × 30 kW",
  trolleyTravelSummary: "35 m/dak · Ø400 × 4 · 2 × 3 kW",
  bridgeTravelSummary: "50 m/dak · Ø500 × 4 · 2 × 5,5 kW",
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
      expect(layout.ce, preset.label).not.toBeNull();
      expect(layout.ce!.height, preset.label).toBeGreaterThanOrEqual(5);
      expect(layout.capacity, preset.label).not.toBeNull();
      expect(layout.legal.lines.length, preset.label).toBeGreaterThan(0);
      expect(layout.fallback.code, preset.label).toBe("23456789ABCDEFGH");
    }
  });

  /*
   * SUSTURULAMAYAN UYARI OKUNMAZ HÂLE GELİR.
   *
   * 02.09.2026'da ölçüldü: üç hazır ölçünün ÜÇÜNDE de "veri satırları
   * sığmıyor" uyarısı ateşleniyordu, yani kartta kalıcı bir kırmızı kutu
   * duruyordu. Sebep yerleşim matematiğiydi — son ayırıcı çizgi son taban
   * çizgisinin yarım adım altındadır ve yükseklik kapısı bunu saymıyordu.
   * Köprü plakalarında artık uyarı YOKTUR; en küçük pano plakasında ise
   * uyarı GERÇEKTİR ve kaç alanın gizleneceğini söyler.
   */
  it("köprü plakaları on üç satırla UYARISIZ yerleşir", () => {
    for (const preset of NAMEPLATE_SIZE_PRESETS.filter((p) => p.widthMm >= 200)) {
      const layout = createNameplateLayout({
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        serialNo: "0057-01",
        publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
        identity,
        logoDataUrl: "/brand/orion-logo-white.svg",
      });
      // Fikstürde ürün adı vinç tipini zaten içerdiği için "VİNÇ TİPİ" satırı
      // düşer; kalan on iki satır üç mekanizma özetini de kapsar.
      expect(layout.rows.length, preset.label).toBe(12);
      expect(layout.issues, preset.label).toEqual([]);
      expect(layout.fits, preset.label).toBe(true);
      // Etiket asla değerden büyük basılmaz (md. 18).
      for (const row of layout.rows) {
        expect(row.labelSize, `${preset.label} · ${row.label}`).toBeLessThanOrEqual(row.valueSize);
      }
    }
  });

  it("sığmayan satır varsa uyarı KAÇ ALANIN gizleneceğini söyler", () => {
    const kucuk = NAMEPLATE_SIZE_PRESETS.find((p) => p.widthMm < 200)!;
    const layout = createNameplateLayout({
      widthMm: kucuk.widthMm,
      heightMm: kucuk.heightMm,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      // Ürün adı vinç tipini İÇERMEZ: "VİNÇ TİPİ" satırı da basılır ve en
      // küçük plaka on üç satırla gerçekten taşar.
      identity: { ...identity, product: "KÖPRÜLÜ VİNÇ SİSTEMİ" },
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    expect(layout.rows.length).toBe(13);
    expect(layout.issues.join(" ")).toMatch(/son \d+ tanesi/);
  });

  it("mekanizma özetleri plakada BİRLEŞİK satır olarak durur (md. 20)", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    const etiketler = layout.rows.map((row) => row.label);
    expect(etiketler).toContain("ANA KALDIRMA");
    expect(etiketler).toContain("ARABA YÜRÜTME");
    expect(etiketler).toContain("KÖPRÜ YÜRÜTME");
    // "KÜTLE" değil "AĞIRLIK" (md. 18).
    expect(etiketler).toContain("AĞIRLIK");
    expect(etiketler).not.toContain("KÜTLE");
    // Seri numarası TEK yerde: satırlarda. QR altındaki kutu kaldırıldı (md. 17).
    expect(etiketler.filter((l) => l === "SERİ NUMARASI")).toHaveLength(1);
  });

  it("QR'ın altında adres YOK, yalnız 16 haneli kod var (md. 16)", () => {
    const svg = buildNameplateSvg({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    expect(svg).toContain("23456789ABCDEFGH");
    expect(svg).not.toContain("portal.orioncranes.com/paylas");
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
    expect(createNameplateLayout(base).ce).not.toBeNull();
    expect(createNameplateLayout({ ...base, ceMark: false }).ce).toBeNull();
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
    const smallest = Math.min(...layout.rows.map((row) => row.valueSize), layout.fallback.codeSize);
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
  /*
   * CE İŞARETİ PLAKANIN İÇİNDE KALIR — bu testin sebebi ölçülmüş bir kusurdur
   * (01.09.2026). `ceMarkPath` yay YARIÇAPLARINI ölçeklemiyordu; SVG büyük
   * yarıçapı küçültmez, ~356°'lik dev bir yay çizer ve işaret plakanın
   * dışına taşıp veri tablosunun etiket sütununu eziyordu. Bileşen ağacına
   * bakmak bunu göstermez; yolun SINIR KUTUSU gösterir.
   */
  it("CE işaretini QR altında, plaka sınırlarını aşmadan çizer", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    const ce = layout.ce;
    expect(ce).not.toBeNull();
    if (!ce) return;
    const sayilar = [...ce.path.matchAll(/[-\d.]+/g)].map((m) => Number(m[0]));
    expect(sayilar.every((n) => Number.isFinite(n))).toBe(true);
    // Yolun içindeki HER sayı plakanın kutusunda kalır: yarıçaplar da
    // koordinatlar da ölçeklenmiş olmalıdır.
    expect(Math.min(...sayilar)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...sayilar)).toBeLessThanOrEqual(layout.widthMm);
    // Yayların yarıçapı işaretin yüksekliğinden büyük olamaz.
    const yariCaplar = [...ce.path.matchAll(/A([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(yariCaplar.length).toBe(4);
    expect(Math.max(...yariCaplar)).toBeLessThanOrEqual(ce.height);
    // İşaret QR'IN ALTINDA ve onunla ORTALANMIŞTIR (02.09.2026, md. 19).
    expect(ce.y).toBeGreaterThan(layout.qr.y + layout.qr.size);
    expect(ce.x + ce.width / 2).toBeCloseTo(layout.qr.x + layout.qr.size / 2, 1);
    // Yasal bandın üstüne taşmaz.
    expect(ce.y + ce.height).toBeLessThanOrEqual(layout.legal.y);
    // Künye yazısı artık soldan TAM GENİŞLİKTE başlar; CE bandın içinde değil.
    expect(layout.legal.x).toBeLessThan(ce.x);
  });

  /*
   * ARALIKLI YAZIDA KELİME ARASI HARF ARASINDAN BÜYÜKTÜR. `estimatedTextWidth`
   * mono dalında `trim()` uyguladığı için tek karakterlik " " sıfır genişlik
   * dönüyordu: "TEKNİK DOKÜMANLAR" bitişik basılıyordu (ölçüldü).
   */
  it("aralıklı yazıda boşluğu bir karakter genişliğinde ilerletir", () => {
    const glyphs = trackedGlyphs("AB CD", 0, 4, 1);
    const harfArasi = glyphs[1].x - glyphs[0].x;
    const kelimeArasi = glyphs[3].x - glyphs[1].x;
    expect(kelimeArasi).toBeGreaterThan(harfArasi * 1.9);
  });

  /*
   * AYIRICI ÇİZGİ DEĞERİN İÇİNDEN GEÇMEZ. Satır adımı yalnız ETİKET puntosuna
   * bakıyordu; oysa satırın yüksekliğini büyük olan DEĞER belirler ve çizgi
   * bir alttaki rakamı kesiyordu.
   */
  it("veri satırlarını çakışmadan ve içerik penceresinde tutar", () => {
    for (const preset of NAMEPLATE_SIZE_PRESETS) {
      const layout = createNameplateLayout({
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        serialNo: "0057-01",
        publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
        identity,
        logoDataUrl: "/brand/orion-logo-white.svg",
      });
      const rows = layout.rows;
      expect(rows.length).toBeGreaterThan(4);
      // Bütün değerler TEK puntodadır; sütun kendi içinde dalgalanmaz.
      expect(new Set(rows.map((row) => row.valueSize)).size).toBe(1);
      rows.forEach((row, index) => {
        // Çizgi kendi satırının altındadır…
        expect(row.ruleY).toBeGreaterThan(row.y);
        const sonraki = rows[index + 1];
        if (!sonraki) return;
        // …ve bir sonraki değerin tepesinin üstünde kalır.
        expect(row.ruleY).toBeLessThan(sonraki.y - sonraki.valueSize * 0.7);
      });
      // Son satır yasal bandın üstünde biter.
      const son = rows[rows.length - 1];
      expect(son.ruleY).toBeLessThanOrEqual(layout.legal.y);
    }
  });

  /*
   * BESLEME SATIRI FREKANSI İKİ KEZ YAZMAZ: `frequency` `supplyVoltage`
   * metninden türetilir ve üretimdeki seçenek metinleri Hz'i zaten taşır.
   */
  it("besleme satırında frekansı tekrar etmez", () => {
    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity: { ...identity, supplyVoltage: "380 VAC, 3 Faz, 50 Hz", frequency: "50 Hz" },
      logoDataUrl: "/brand/orion-logo-white.svg",
    });
    const besleme = layout.rows.find((row) => row.label === "BESLEME");
    expect(besleme?.value).toBe("380 VAC, 3 Faz, 50 Hz");
  });
});
