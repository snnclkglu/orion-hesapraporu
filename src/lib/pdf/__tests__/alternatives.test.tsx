// Alternatif (seçenekli) ekipmanların çıktılara taşınması — madde 23 / 25.
//
// Üç yüzey aynı veriyi okur: editör rozeti, PDF raporunun "SEÇENEKLER" bloğu ve
// ekipman listesi ("— Seçenek n" satırları). Bu dosya üçünün ortak kaynağını ve
// en kritik güvenceyi kilitler:
//
//   BOŞ DURUM — alternatifi olmayan bölümde HİÇBİR ŞEY değişmez. Bu, özelliğin
//   var olmayan revizyonların çıktısını sessizce oynatmayacağının garantisidir
//   ve hem yapı (altOptionNodes) hem bayt (PDF uzunluğu) düzeyinde sınanır.

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { moduleState } from "@/lib/calc/presentation/module-access";
import {
  MODULE_ADAPTERS,
  altOptionPass,
  buildModuleDeps,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { altsFromRevision, altKeyFor, splitAltKey, type RevisionAlts } from "@/lib/revision-load";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import { ReportDocument, altOptionNodes, type ReportProps } from "@/lib/pdf/report";

const input = V5_TEMPLATE;
const result = runCalc(input);
const deps = buildModuleDeps(input, result);

/**
 * 2.1 Halat bölümü için üç seçenek. Hepsi GERÇEK katalog satırıdır
 * (supabase/migrations/20260719000005_catalog_seed.sql, kind='rope'):
 * Ø18 → 226 kN (V5 şablonunun seçimi), Ø20 → 279 kN, Ø16 → 179 kN.
 * Sayı uydurulmamıştır; uygunluk kararını motorun kendisi verir.
 */
const ROPE_OPTIONS: Record<string, unknown>[] = [
  {
    ropeBrand: "Hasçelik", ropeDiaMm: 18, ropeConstruction: "6x36",
    ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 226,
    ropeWeightKgPerM: 1.33,
  },
  {
    ropeBrand: "İzmit A.Ş.", ropeDiaMm: 20, ropeConstruction: "6x36",
    ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 279,
    ropeWeightKgPerM: 1.64,
  },
  {
    ropeBrand: "İzmit A.Ş.", ropeDiaMm: 16, ropeConstruction: "6x36",
    ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 179,
    ropeWeightKgPerM: 1.05,
  },
];

const ALTS: RevisionAlts = { "main-2.1": { active: 0, options: ROPE_OPTIONS } };

const ropeSection = () => {
  const adapter = MODULE_ADAPTERS.find((a) => a.key === "main")!;
  return adapter.sections.find((s) => s.rawId === "2.1")!;
};

// --------------------------------------------------------------- yükleyici

describe("altsFromRevision — bozuk snapshot raporu düşürmez", () => {
  it("geçerli kaydı olduğu gibi okur", () => {
    expect(altsFromRevision({ alts: ALTS })["main-2.1"].options).toHaveLength(3);
  });

  it("alternatifi olmayan revizyonda boş harita döner", () => {
    expect(altsFromRevision(null)).toEqual({});
    expect(altsFromRevision({})).toEqual({});
  });

  it("seçeneği olmayan / bozuk girdileri atar, active'i sınırlara kelepçeler", () => {
    const loaded = altsFromRevision({
      alts: {
        bos: { active: 0, options: [] },
        bozuk: { active: 0, options: "hayır" },
        tasan: { active: 9, options: [{ a: 1 }, { a: 2 }] },
        eksi: { active: -3, options: [{ a: 1 }] },
      } as unknown as RevisionAlts,
    });
    expect(Object.keys(loaded).sort()).toEqual(["eksi", "tasan"]);
    expect(loaded.tasan.active).toBe(1);
    expect(loaded.eksi.active).toBe(0);
  });

  it("anahtar biçimi üç yüzeyde de aynıdır", () => {
    expect(altKeyFor("main", "2.1")).toBe("main-2.1");
    expect(splitAltKey("main-2.1")).toEqual({ moduleKey: "main", sectionRawId: "2.1" });
    expect(splitAltKey("bozuk")).toBeNull();
  });
});

// ------------------------------------------------- uygunluk (tek kaynak)

describe("altOptionPass — alternatifin uygunluğu motordan okunur", () => {
  it("kopma yükü yeten halat uygun, yetmeyen uygun değil", () => {
    const section = ropeSection();
    const state = moduleState(input, "main")!;
    const verdicts = ROPE_OPTIONS.map((o) =>
      altOptionPass("main", section, input.specs, state.inputs, state.selections, o, deps)
    );
    // Ø18 (şablonun seçimi) ve daha kalın Ø20 emniyet katsayısını sağlar;
    // Ø16 sağlamaz. Eşik burada tanımlanmaz, FEM kontrolünden gelir.
    expect(verdicts).toEqual([true, true, false]);
  });

  it("kontrolü olmayan bölümde karar bilinmezdir (uydurma 'uygun' basılmaz)", () => {
    const adapter = MODULE_ADAPTERS.find((a) => a.key === "main")!;
    const section = adapter.sections.find((s) => s.checkSuffixes.length === 0);
    if (!section) return; // V5'te böyle bir bölüm yoksa kural boşta kalır
    const state = moduleState(input, "main")!;
    expect(
      altOptionPass("main", section, input.specs, state.inputs, state.selections, {}, deps)
    ).toBeNull();
  });
});

// ------------------------------------------------------ PDF: boş durum

describe("PDF raporu — SEÇENEKLER bloğu", () => {
  it("alternatifi olan bölümde her seçenek için bir satır üretir", () => {
    const state = moduleState(input, "main")!;
    const nodes = altOptionNodes("main", ropeSection(), state, ALTS["main-2.1"], input.specs, deps);
    expect(nodes).toHaveLength(3);
  });

  it("hiçbir bölüm alternatifsizken satır üretmez (bugünkü çıktı korunur)", () => {
    for (const adapter of MODULE_ADAPTERS) {
      const state = moduleState(input, adapter.key);
      if (!state) continue;
      for (const section of adapter.sections) {
        // 1) hiç kayıt yok  2) boş harita  3) TEK seçenekli kayıt
        expect(
          altOptionNodes(adapter.key, section, state, undefined, input.specs, deps)
        ).toHaveLength(0);
        const tek = { active: 0, options: [{ ...(state.selections as object) }] };
        expect(
          altOptionNodes(adapter.key, section, state, tek, input.specs, deps),
          `${adapter.key}/${section.rawId} tek seçenekle satır üretti`
        ).toHaveLength(0);
      }
    }
  });

  it("tek seçenekli alternatif PDF'i BAYT olarak değiştirmez", async () => {
    const base: ReportProps = {
      project: {
        doc_no: "412",
        name: "İsdemir Amonyum Sülfat Vinci",
        customer: "İsdemir",
        crane_type: "Çift kirişli gezer köprülü vinç",
      },
      revision: { rev_no: 3, label: "V3", issued_at: "2026-07-01T00:00:00.000Z" },
      preparedBy: "Sinan Çolakoğlu",
      input,
      result,
      // Bloğun yalnız modül sayfalarında olduğu seviye yeter; "detayli" iki kat
      // uzun sürer ve aynı kodu koşturur.
      level: "standart",
    };
    const altsiz = await renderToBuffer(<ReportDocument {...base} />);
    const tekSecenek = await renderToBuffer(
      <ReportDocument
        {...base}
        alts={{ "main-2.1": { active: 0, options: [ROPE_OPTIONS[0]] } }}
      />
    );
    expect(tekSecenek.length).toBe(altsiz.length);
  }, 240_000);
});

// ------------------------------------------ Ekipman listesi: alt satırlar

describe("ekipman listesi — alternatif satırlar", () => {
  const groupRows = (alts?: RevisionAlts) =>
    buildEquipmentGroups(input, undefined, alts).flatMap((g) => g.rows);

  it("aktif seçim ana satır, alternatifler hemen altında", () => {
    const rows = groupRows(ALTS);
    const i = rows.findIndex((r) => r.rowKey === "main:rope");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(rows[i].alt).toBeUndefined();
    expect(rows[i].component).toBe("Çelik Halat");
    expect(rows[i + 1].alt).toBe(2);
    expect(rows[i + 2].alt).toBe(3);
    expect(rows[i + 1].component).toContain("Seçenek 2");
    expect(rows[i + 2].component).toContain("Seçenek 3");
    // Alternatifin özelliği kendi seçeneğinden gelir
    expect(rows[i + 1].spec).toContain("279");
  });

  it("alternatif satır ana satırın row_key'ini ÇALMAZ (madde 34 notları)", () => {
    const rows = groupRows(ALTS);
    const keys = rows.map((r) => r.rowKey).filter(Boolean) as string[];
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of rows.filter((x) => x.alt)) {
      expect(r.rowKey).not.toBe("main:rope");
      expect(r.rowKey).toMatch(/^main:rope#2\.1-[23]$/);
    }
  });

  it("notlar yalnız ana satıra bağlanır", () => {
    const rows = buildEquipmentGroups(input, { "main:rope": "Galvanizli" }, ALTS)
      .flatMap((g) => g.rows)
      .filter((r) => r.rowKey?.startsWith("main:rope"));
    expect(rows[0].note).toBe("Galvanizli");
    expect(rows.slice(1).every((r) => (r.note ?? "") === "")).toBe(true);
  });

  it("alternatifsiz / boş harita / tek seçenek → çıktı birebir aynı", () => {
    const altsiz = JSON.stringify(groupRows());
    expect(JSON.stringify(groupRows({}))).toBe(altsiz);
    expect(
      JSON.stringify(groupRows({ "main-2.1": { active: 0, options: [ROPE_OPTIONS[0]] } }))
    ).toBe(altsiz);
  });

  it("ana satırdan FARKSIZ alternatif satır basılmaz", () => {
    // İki seçenek de aynı halatı gösteriyorsa liste çoğaltılmaz.
    const rows = groupRows({
      "main-2.1": { active: 0, options: [ROPE_OPTIONS[0], { ...ROPE_OPTIONS[0] }] },
    });
    expect(rows.filter((r) => r.alt)).toHaveLength(0);
  });
});
