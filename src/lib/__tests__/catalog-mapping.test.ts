// Katalog eşleme koruma testi — "Katalogdan Seç" ile motorun sözleşmesi.
//
// NEDEN: `applyCatalogPick` katalog satırını selection alanlarına çevirirken
// eşlenemeyen alanı SESSİZCE atlar. Bir attrs anahtarı katalog tarafında
// değişirse (ör. seed betiği `allowed_radial_output_kn` yerine başka bir ad
// yazarsa) seçim yine "başarılı" görünür, ama engelleyici bir kontrolü besleyen
// alan eski değerinde kalır. Bu dosya o sessizliği kırar: eşlemenin beklediği
// anahtarlar ile katalog dosyalarının ürettiği anahtarlar burada karşılaşır.

import { describe, expect, it } from "vitest";
import {
  CATALOG_KINDS,
  applyCatalogPick,
  attrValueLabel,
  catalogKindConfig,
  catalogRowSummary,
  getCatalogMapping,
  isUnverifiedRow,
  lockedFacetValues,
  type CatalogRow,
} from "../catalog-mapping";

/** Seed betiğinin bir YILMAZ H serisi redüktör için ürettiği satır. */
const HOIST_GEARBOX: CatalogRow = {
  id: "x",
  brand: "Yılmaz Redüktör",
  model: "HT0823",
  attrs: {
    series: "H",
    application: "kaldirma",
    frame_size: "08",
    stages: 2,
    ratio: 52.57,
    ratio_range: "1:25…90",
    output_torque_nm: 22_000,
    output_speed_rpm: 26.6,
    input_speed_rpm: 1400,
    allowed_radial_output_kn: 60,
    weight_kg: 775,
    output_shaft_mm: 120,
    input_shaft_mm: 55,
  },
};

/** Seed betiğinin bir YILMAZ D serisi (yürütme) redüktör için ürettiği satır. */
const TRAVEL_GEARBOX: CatalogRow = {
  id: "y",
  brand: "Yılmaz Redüktör",
  model: "DT472",
  attrs: {
    series: "D",
    application: "yurutme",
    ratio: 12.5,
    output_torque_nm: 850,
    output_speed_rpm: 116,
    input_speed_rpm: 1450,
    allowed_radial_output_kn: 5.5,
    output_shaft_mm: 50,
    input_shaft_mm: 24,
  },
};

/** FLENDER MD 20.1'in tip/boyut tablosundan gelen satırı; kesin oran değildir. */
const FLENDER_GEARBOX: CatalogRow = {
  id: "flender-h3-15",
  brand: "FLENDER",
  model: "H3-15",
  attrs: {
    series: "H3",
    application: "kaldirma",
    frame_size: "15",
    stages: 3,
    gear_unit_type: "Helical",
    ratio_range: "1:22.4…90",
    output_torque_nm: 153_000,
    source_page: "16-17",
  },
};

describe("kaldırma redüktörü (2.3)", () => {
  const mapping = getCatalogMapping("main", "2.3")!;

  it("yalnız kaldırma grubunu gösterir", () => {
    expect(mapping.lockedFacets).toEqual({ application: "kaldirma" });
  });

  it("engelleyici kontrolleri besleyen alanların hepsini doldurur", () => {
    const sel = applyCatalogPick(mapping, HOIST_GEARBOX);
    // gearbox.torque (engelleyici) — Nm → kNm
    expect(sel.gearboxNominalTorqueKnm).toBe(22);
    // gearbox.radial (engelleyici) — katalogdan gelmezse eski değer kalırdı
    expect(sel.gearboxAllowedRadialKn).toBe(60);
    // gearbox.ratio (uyarı)
    expect(sel.gearboxRatio).toBe(52.57);
    // kaplin bölümlerinin mil çapları
    expect(sel.gearboxOutputShaftMm).toBe(120);
    expect(sel.gearboxInputShaftMm).toBe(55);
    expect(sel.gearboxModel).toBe("Yılmaz Redüktör HT0823");
  });

  it("katalogda olmayan alanı yazmaz (elle girilen değer korunur)", () => {
    const bare: CatalogRow = { ...HOIST_GEARBOX, attrs: { ratio: 30 } };
    const sel = applyCatalogPick(mapping, bare);
    expect(sel).not.toHaveProperty("gearboxAllowedRadialKn");
    expect(sel).not.toHaveProperty("gearboxOutputShaftMm");
  });

  it("oran aralığı olan FLENDER tipinde elle girilen kesin oranı değiştirmez", () => {
    const sel = applyCatalogPick(mapping, FLENDER_GEARBOX);
    expect(sel.gearboxModel).toBe("FLENDER H3-15");
    expect(sel.gearboxNominalTorqueKnm).toBe(153);
    expect(sel).not.toHaveProperty("gearboxRatio");
    expect(catalogRowSummary("gearbox", FLENDER_GEARBOX)).toContain("i=1:22.4…90");
  });
});

describe("yürütme redüktörü (5.5)", () => {
  const mapping = getCatalogMapping("bridge", "5.5")!;

  it("yalnız yürütme grubunu gösterir", () => {
    expect(mapping.lockedFacets).toEqual({ application: "yurutme" });
  });

  it("çıkış torkunu kNm'ye çevirir, giriş milini metne yazar", () => {
    const sel = applyCatalogPick(mapping, TRAVEL_GEARBOX);
    expect(sel.gearboxOutputTorqueKnm).toBeCloseTo(0.85, 10);
    expect(sel.gearboxInputShaftText).toBe("24 mm");
    expect(sel.gearboxModel).toBe("Yılmaz Redüktör DT472");
  });

  it("araba ve köprü aynı eşlemeyi paylaşır", () => {
    expect(getCatalogMapping("trolley", "5.5")).toBe(mapping);
  });
});

describe("redüktör seçici yapılandırması", () => {
  it("kilitli filtre, facet listesinde de tanımlıdır", () => {
    // Kilitli filtre sunucuda uygulanır ve adım listesinden çıkarılır; ama
    // yapılandırmada bulunmazsa kilitsiz bir bölümde (varsa) hiç görünmez.
    const attrs = CATALOG_KINDS.gearbox.facets.map((f) => f.attr);
    expect(attrs).toContain("application");
    for (const rawId of ["2.3", "5.5"] as const) {
      const m = rawId === "2.3"
        ? getCatalogMapping("main", rawId)!
        : getCatalogMapping("bridge", rawId)!;
      for (const key of Object.keys(m.lockedFacets ?? {})) {
        expect(attrs).toContain(key);
      }
    }
  });

  it("kullanım grubu kodları Türkçe karşılığıyla gösterilir", () => {
    expect(attrValueLabel("application", "kaldirma")).toBe("Kaldırma");
    expect(attrValueLabel("application", "yurutme")).toBe("Yürütme");
  });

  it("tablo sütunları katalogda karşılığı olan anahtarları gösterir", () => {
    const cols = CATALOG_KINDS.gearbox.columns.map((c) => c.attr);
    for (const c of cols) {
      if (c === "model" || c === "brand") continue;
      expect(Object.keys(HOIST_GEARBOX.attrs)).toContain(c);
    }
  });
});

// --------------------------------------------------------------------- motor
//
// [Madde 12] Motor kataloğu shaft_diameter_mm alanıyla yeniden üretildi; seed
// betiği bunu `shaft_mm` olarak yazar. Bu alan HİÇ eşlenmiyordu:
// applyCatalogPick sessizce atlıyor, mühendisin eski mil çapı kalıyordu — ve o
// çap kaplin mili çapını (maks(motorShaftMm, gearboxInputShaftMm)) yani
// motorCoupling.bore kontrolünü besliyor.

/** Seed betiğinin bir INNOMATICS (Siemens 1LE1603) motoru için ürettiği satır. */
const MOTOR_ROW: CatalogRow = {
  id: "m",
  brand: "INNOMATICS",
  model: "1LE1603-1DB4",
  attrs: {
    power_kw: 15,
    poles: 4,
    rpm: 1475, // katalogun GERÇEK yüklü devri — senkron 1500 DEĞİL
    torque_nm: 97,
    frame_size: "160L",
    efficiency_pct: 92.1,
    efficiency_class: "IE3",
    weight_kg: 127,
    shaft_mm: 42,
    series: "1LE1603 Performance Line",
    ip_class: "IP55",
  },
};

describe.each([
  ["kaldırma motoru (2.4)", "main", "2.4"],
  ["yürütme motoru (5.4)", "bridge", "5.4"],
  ["araba yürütme motoru (5.4)", "trolley", "5.4"],
] as const)("%s", (_name, moduleKey, rawId) => {
  const mapping = getCatalogMapping(moduleKey, rawId)!;

  it("motor mil çapını doldurur", () => {
    const sel = applyCatalogPick(mapping, MOTOR_ROW);
    expect(sel.motorShaftMm).toBe(42);
  });

  it("devri katalogtaki GERÇEK değeriyle yazar (senkron devire yuvarlamaz)", () => {
    // 1475 → 1500 yuvarlaması gerekli çevrim oranını, gerçekleşen hızı ve
    // gerekli gücü %1,7 kaydırırdı; bu bir hesap hatasıdır.
    const sel = applyCatalogPick(mapping, MOTOR_ROW);
    expect(sel.motorRpm).toBe(1475);
  });

  it("güç ve markayı doldurur", () => {
    const sel = applyCatalogPick(mapping, MOTOR_ROW);
    expect(sel.motorPowerKw).toBe(15);
    expect(sel.motorBrand).toBe("INNOMATICS");
  });

  it("katalogda mil çapı yoksa elle girilen değeri korur", () => {
    const bare: CatalogRow = { ...MOTOR_ROW, attrs: { power_kw: 15, rpm: 1475 } };
    expect(applyCatalogPick(mapping, bare)).not.toHaveProperty("motorShaftMm");
  });
});

describe("motor seçici yapılandırması", () => {
  it("mil çapı ve verim sınıfı tabloda görünür", () => {
    const cols = CATALOG_KINDS.motor.columns.map((c) => c.attr);
    expect(cols).toContain("shaft_mm");
    expect(cols).toContain("efficiency_class");
  });

  it("verim sınıfı bir süzgeç adımıdır", () => {
    expect(CATALOG_KINDS.motor.facets.map((f) => f.attr)).toContain("efficiency_class");
  });

  it("tablo sütunları seed satırında karşılığı olan anahtarları gösterir", () => {
    for (const c of CATALOG_KINDS.motor.columns.map((x) => x.attr)) {
      if (c === "model" || c === "brand") continue;
      expect(Object.keys(MOTOR_ROW.attrs)).toContain(c);
    }
  });
});

// -------------------------------------------------------------------- kaplin
//
// [Madde 13, 14, 15] Kaplin kataloğu 47 seri dosyasına bölündü; seri artık
// meta'dan değil SATIRIN kendi alanından okunuyor ve kaplin tipi bölüme göre
// kilitleniyor.

/** JAURE MT alt serisi — madde 14: MTS ayrı seçilebilmeli. */
const MTS_COUPLING: CatalogRow = {
  id: "c1",
  brand: "JAURE",
  model: "MTS 50",
  attrs: {
    coupling_type: "gear",
    series: "MTS",
    size: 50,
    nominal_torque_nm: 1150,
    max_torque_nm: 2300,
    max_speed_rpm: 9000,
    max_shaft_dia_mm: 50,
    outer_dia_mm: 96,
    weight_kg: 4.68,
  },
};

/** ÖZGÜN TİP J — madde 13: ÖZGÜN'ün tambur kaplini. */
const OZGUN_J_COUPLING: CatalogRow = {
  id: "c2",
  brand: "OZGUN",
  model: "J6",
  attrs: {
    coupling_type: "drum",
    series: "J",
    nominal_torque_nm: 22_600,
    max_torque_nm: 45_200,
    max_shaft_dia_mm: 130,
    min_shaft_dia_mm: 55,
    max_radial_load_n: 59_400,
    weight_kg: 55,
    outer_dia_mm: 380,
  },
};

/** JAURE TCBR — fıçı tipi; O DA tambur kaplinidir, listede kalmalı. */
const JAURE_TCBR_COUPLING: CatalogRow = {
  id: "c3",
  brand: "JAURE",
  model: "TCBR 160",
  attrs: {
    coupling_type: "barrel",
    series: "TCBR",
    nominal_torque_nm: 29_100,
    max_radial_load_n: 46_000,
    max_shaft_dia_mm: 130,
    max_speed_rpm: 130,
    hub_dia_mm: 78,
    weight_kg: 260,
  },
};

describe("tambur kaplini (2.7)", () => {
  const mapping = getCatalogMapping("main", "2.7")!;

  it("yalnız tambur kaplinlerini gösterir", () => {
    expect(mapping.lockedFacets).toBeDefined();
    const types = lockedFacetValues(mapping.lockedFacets!.coupling_type);
    // ÖZGÜN'de tambur kaplini TİP J'dir ("drum"); SIBRE ABC-V de "drum",
    // JAURE TCBR ise "barrel" kodludur — üçü de aynı bölümün ürünüdür.
    expect(types).toContain("drum");
    expect(types).toContain("barrel");
    // Motor tarafının kaplinleri buraya girmemeli.
    expect(types).not.toContain("pin");
    expect(types).not.toContain("flexible");
  });

  it("engelleyici radyal yük kontrolünü besleyen alanı doldurur", () => {
    const sel = applyCatalogPick(mapping, OZGUN_J_COUPLING);
    expect(sel.drumCouplingTorqueNm).toBe(22_600);
    // drumCoupling.radial kontrolü bu alandan okur; eşlenmezse eski değer kalır
    expect(sel.drumCouplingRadialN).toBe(59_400);
    expect(sel.drumCouplingDmaxMm).toBe(130);
    expect(sel.drumCouplingModel).toBe("J6");
  });

  it("JAURE TCBR de aynı alanları doldurur (fıçı tipi dışlanmaz)", () => {
    const sel = applyCatalogPick(mapping, JAURE_TCBR_COUPLING);
    expect(sel.drumCouplingRadialN).toBe(46_000);
    expect(sel.drumCouplingTorqueNm).toBe(29_100);
  });
});

describe.each([
  ["motor — redüktör kaplini (2.6)", "main", "2.6"],
  ["motor — dişli kutusu kaplini (5.6)", "bridge", "5.6"],
] as const)("%s", (_name, moduleKey, rawId) => {
  const mapping = getCatalogMapping(moduleKey, rawId)!;

  it("tambur kaplinlerini listeden çıkarır", () => {
    const types = lockedFacetValues(mapping.lockedFacets!.coupling_type);
    expect(types).toContain("gear");
    expect(types).toContain("flexible");
    expect(types).toContain("pin");
    expect(types).toContain("disc");
    // Fren kasnağını kaplinin üzerinde taşıyan ÖZGÜN B serisi de motor
    // kaplinidir; bölüm 2.5'in kasnak çapı oradan gelir.
    expect(types).toContain("brake");
    expect(types).not.toContain("drum");
    expect(types).not.toContain("barrel");
  });

  it("kaplin alanlarını doldurur", () => {
    const sel = applyCatalogPick(mapping, MTS_COUPLING);
    expect(sel.motorCouplingTorqueNm).toBe(1150);
    expect(sel.motorCouplingDmaxMm).toBe(50);
    expect(sel.motorCouplingModel).toBe("MTS 50");
  });
});

describe("kaplin seçici yapılandırması", () => {
  it("seri bir süzgeç adımıdır ve alt seriler ayrı ayrı görünür", () => {
    // Madde 14: MTS/MTF/MTG… tek "MT" başlığı altında toplanmaz; süzgeç
    // satırın kendi `series` alanını okuduğu için her alt seri ayrı değerdir.
    expect(CATALOG_KINDS.coupling.facets.map((f) => f.attr)).toContain("series");
    expect(MTS_COUPLING.attrs.series).toBe("MTS");
  });

  it("kaplin tipi de bir süzgeç adımıdır (kilitsiz bölümler için)", () => {
    expect(CATALOG_KINDS.coupling.facets.map((f) => f.attr)).toContain("coupling_type");
  });

  it("kaplin tipi kodlarının hepsi Türkçe karşılığıyla gösterilir", () => {
    for (const code of ["gear", "pin", "flexible", "drum", "barrel", "brake", "disc", "chain"]) {
      expect(attrValueLabel("coupling_type", code)).not.toBe(code);
    }
  });
});

// -------------------------------------------------------------------- tampon
//
// [Madde 20, 21] Tampon kataloğu YENİ bir kind'dır. 5.8 bölümünün seçim
// alanları travelGroup.ts'in tampon hesabının doğrudan girdisidir; eksik
// eşleme burada `buffer.energy` / `buffer.load` kontrollerini eski değerle
// besler.

/** Seed betiğinin SIBRE SP hidrolik tamponu için ürettiği satır. */
const HYDRAULIC_BUFFER: CatalogRow = {
  id: "b1",
  brand: "SIBRE",
  model: "SP 65 FF 100",
  attrs: {
    type: "hidrolik",
    series: "SP 65",
    stroke_mm: 100,
    energy_kj: 17,
    max_force_kn: 200,
    diameter_mm: 108,
    weight_kg: 19.2,
    mounting: "FF",
    damping_efficiency: 0.85,
    force_matrix: [{ capacity_kj: 1, impact_force_kn: 12 }],
    metering_pins: [{ design_mass_t_max: 5, metering_pin_code: "102" }],
  },
};

/** Kauçuk tampon: katalog J basar, seed kJ'ye çevirir; strok h·%/100'dür. */
const RUBBER_BUFFER: CatalogRow = {
  id: "b2",
  brand: "Conductix-Wampfler",
  model: "017111-250N",
  attrs: {
    type: "kauçuk",
    program: "0170",
    diameter_mm: 250,
    height_mm: 200,
    energy_j: 12_500,
    energy_kj: 12.5,
    max_force_kn: 400,
    max_compression_pct: 50,
    stroke_mm: 100,
    weight_kg: 21,
    form: "silindirik",
    energy_curve: [[0, 0], [50, 12_719]],
    force_curve: [[0, 0], [50, 392.3]],
  },
};

/** Üretici teyidi olmayan firma Excel'i satırı. */
const UNVERIFIED_BUFFER: CatalogRow = {
  id: "b3",
  brand: "Marka Belirsiz (Firma Excel'i)",
  model: "Type 21 HD/050",
  attrs: {
    type: "bilinmiyor",
    stroke_mm: 50,
    energy_kj: 10,
    max_force_kn: 250,
    source: "firma Excel'i",
    unverified: true,
  },
};

describe.each([
  ["köprü tamponu (5.8)", "bridge"],
  ["araba tamponu (5.8)", "trolley"],
] as const)("%s", (_name, moduleKey) => {
  const mapping = getCatalogMapping(moduleKey, "5.8")!;

  it("tampon kataloğuna bağlıdır", () => {
    expect(mapping.kind).toBe("buffer");
  });

  it("hidrolik tamponda hesabın okuduğu alanların hepsini doldurur", () => {
    const sel = applyCatalogPick(mapping, HYDRAULIC_BUFFER);
    expect(sel.bufferModel).toBe("SIBRE SP 65 FF 100");
    // buffer.driveEnergy (D·s) ve buffer.reactionForce strok'tan hesaplanır
    expect(sel.bufferStrokeMm).toBe(100);
    // buffer.energy kontrolü (engelleyici)
    expect(sel.bufferEnergyKj).toBe(17);
    // buffer.load kontrolü (engelleyici)
    expect(sel.bufferLoadKn).toBe(200);
    // Aynı strokun SIBRE iğne tablosu da seçimle gelir; kod hesapta otomatik seçilir.
    expect(sel.bufferMeteringPins).toEqual(HYDRAULIC_BUFFER.attrs.metering_pins);
  });

  it("kauçuk tamponda kJ'ye çevrilmiş enerjiyi ve türetilmiş stroğu yazar", () => {
    const sel = applyCatalogPick(mapping, RUBBER_BUFFER);
    // Kaynak katalog 12.500 J basar; ortak anahtar kJ'dir.
    expect(sel.bufferEnergyKj).toBe(12.5);
    // s = h · sıkışma% / 100 = 200 · 50 / 100
    expect(sel.bufferStrokeMm).toBe(100);
    expect(sel.bufferLoadKn).toBe(400);
    expect(sel.bufferMaxCompressionPct).toBe(50);
    expect(sel.bufferEnergyCurve).toEqual(RUBBER_BUFFER.attrs.energy_curve);
    expect(sel.bufferForceCurve).toEqual(RUBBER_BUFFER.attrs.force_curve);
  });

  it("katalogda olmayan alanı yazmaz", () => {
    const bare: CatalogRow = { ...HYDRAULIC_BUFFER, attrs: { type: "hidrolik" } };
    const sel = applyCatalogPick(mapping, bare);
    expect(sel).not.toHaveProperty("bufferEnergyKj");
    expect(sel).not.toHaveProperty("bufferLoadKn");
    expect(sel).not.toHaveProperty("bufferStrokeMm");
  });
});

describe("tampon seçici yapılandırması", () => {
  const config = catalogKindConfig("buffer");

  it("tip ve strok süzgeç adımıdır, enerji 'en az' süzgecidir", () => {
    expect(config.facets.map((f) => f.attr)).toEqual(["type", "stroke_mm"]);
    expect(config.minFilter?.attr).toBe("energy_kj");
  });

  it("tablo sütunları seed satırında karşılığı olan anahtarları gösterir", () => {
    const keys = new Set([
      ...Object.keys(HYDRAULIC_BUFFER.attrs),
      ...Object.keys(RUBBER_BUFFER.attrs),
    ]);
    for (const c of config.columns.map((x) => x.attr)) {
      if (c === "model" || c === "brand") continue;
      expect([...keys]).toContain(c);
    }
  });

  it("tampon tipleri Türkçe karşılığıyla gösterilir", () => {
    expect(attrValueLabel("type", "hidrolik")).toBe("Hidrolik");
    expect(attrValueLabel("type", "kauçuk")).toBe("Kauçuk");
    expect(attrValueLabel("type", "hücresel")).toBe("Hücresel");
  });

  it("üretici teyidi olmayan satır işaretlidir", () => {
    expect(isUnverifiedRow(UNVERIFIED_BUFFER)).toBe(true);
    expect(isUnverifiedRow(HYDRAULIC_BUFFER)).toBe(false);
  });
});

// ------------------------------------------------------- kilitli süzgeç guard

describe("kilitli süzgeçler", () => {
  const LOCKED_SECTIONS = [
    ["main", "2.3"],
    ["main", "2.6"],
    ["main", "2.7"],
    ["bridge", "5.5"],
    ["bridge", "5.6"],
  ] as const;

  it("kilitli her filtre kendi türünün facet listesinde tanımlıdır", () => {
    // Kilitli filtre sunucuda uygulanır ve adım listesinden çıkarılır; ama
    // yapılandırmada bulunmazsa kilitsiz bir bölümde hiç görünmez.
    for (const [moduleKey, rawId] of LOCKED_SECTIONS) {
      const m = getCatalogMapping(moduleKey, rawId)!;
      const attrs = catalogKindConfig(m.kind).facets.map((f) => f.attr);
      for (const key of Object.keys(m.lockedFacets ?? {})) {
        expect(attrs, `${moduleKey}/${rawId}`).toContain(key);
      }
    }
  });

  it("kilitli değerlerin hepsi Türkçe bir etiket çözer (rozet ölü kalmaz)", () => {
    for (const [moduleKey, rawId] of LOCKED_SECTIONS) {
      const m = getCatalogMapping(moduleKey, rawId)!;
      for (const [attr, value] of Object.entries(m.lockedFacets ?? {})) {
        for (const v of lockedFacetValues(value)) {
          expect(attrValueLabel(attr, v), `${attr}=${v}`).not.toBe(v);
        }
      }
    }
  });
});
