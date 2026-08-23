// KASNAK FRENİ ÖLÇÜ DEFTERİ KATALOGLA AYRIŞMASIN — kural iki yerde yaşıyor
// (değişmez md. 8).
//
// `drum-brake.ts` içindeki `DRUM_BRAKES`, üretici kataloğunun (`cat_equipment`,
// kind `brake`, SIBRE TE) kopyasıdır. Kopyalanmasının gerekçesi orada yazılı:
// hesap çekirdeği SAFTIR (md. 7), veritabanına bakamaz; fren bölümünün ölçü
// resmi ise hesap motorunun içinden çizilir.
//
// Bedeli, aynı sayıların iki yerde yaşamasıdır. Bu test o boşluğu kapatır:
// tohum SQL'ini OKUR ve gömülü tablonun her satırını orada arar. Katalog
// düzeltilirse (ya da gömülü tablo elle değiştirilirse) burada konuşur.
// SQL'İ OKUMAK BİLİNÇLİDİR (`rope-table.test.ts` deseni): beklenen değerleri
// bu dosyaya yazmak üçüncü bir kopya üretmekten başka bir şey yapmazdı.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DRUM_BRAKES,
  drumBrakeSpec,
  drumBrakeWeightText,
  parseDrumBrakeModel,
} from "../drum-brake";

const SEED = path.join(
  process.cwd(),
  "supabase/migrations/20260824000006_brake_te_geometry.sql"
);

type Attrs = Record<string, unknown>;

/** Tohumdaki SIBRE TE satırları — model → attrs. */
function katalogTE(): Map<string, Attrs> {
  const sql = readFileSync(SEED, "utf8");
  const out = new Map<string, Attrs>();
  const kalip = /\('brake',\s*'([^']*)',\s*'([^']*)',\s*'(\{.*?\})'::jsonb/g;
  for (const m of sql.matchAll(kalip)) {
    const [, marka, model, ham] = m;
    if (marka !== "SIBRE") continue;
    const attrs = JSON.parse(ham) as Attrs;
    if (attrs.series !== "TE") continue;
    out.set(model, attrs);
  }
  return out;
}

const KATALOG = katalogTE();
/** Ölçü tablosu taşıyan satırlar — TE 160 ayrı ölçü resmidir, ölçüsü yoktur. */
const OLCULU = [...KATALOG].filter(([, a]) => a.dim_a_mm !== undefined);

const HARFLER = [
  ["a", "dim_a_mm"], ["b", "dim_b_mm"], ["c", "dim_c_mm"], ["e", "dim_e_mm"],
  ["f", "dim_f_mm"], ["g", "dim_g_mm"], ["h", "dim_h_mm"], ["j", "dim_j_mm"],
  ["k", "dim_k_mm"], ["l", "dim_l_mm"], ["m", "dim_m_mm"], ["n", "dim_n_mm"],
  ["p", "dim_p_mm"], ["q", "dim_q_mm"], ["r", "dim_r_mm"], ["boreD", "mount_bore_mm"],
] as const;

describe("kasnak freni ölçü defteri katalogla ayrışmaz", () => {
  it("tohumda gerçekten TE serisi var (fikstür bozulmamış)", () => {
    expect(KATALOG.size).toBeGreaterThan(20);
    expect(OLCULU.length).toBe(DRUM_BRAKES.length);
  });

  it("defterin HER satırı katalogda AYNI sayılarla vardır", () => {
    for (const b of DRUM_BRAKES) {
      const a = KATALOG.get(b.model);
      expect(a, `${b.model} katalogda yok`).toBeDefined();
      expect(a!.drum_diameter_mm, `${b.model} kasnak çapı`).toBe(b.drumDiaMm);
      expect(a!.thruster_type, `${b.model} itici`).toBe(b.thruster);
      expect(a!.min_torque_nm, `${b.model} en küçük tork`).toBe(b.minTorqueNm);
      expect(a!.max_torque_nm, `${b.model} en büyük tork`).toBe(b.maxTorqueNm);
      expect(a!.weight_kg, `${b.model} fren ağırlığı`).toBe(b.brakeWeightKg);
      expect(a!.thruster_weight_kg, `${b.model} itici ağırlığı`).toBe(b.thrusterWeightKg);
      expect(a!.thruster_weight_max_kg, `${b.model} itici ağırlığı üst sınır`)
        .toBe(b.thrusterWeightMaxKg);
      expect(a!.total_weight_kg, `${b.model} toplam ağırlık`).toBe(b.totalWeightKg);
      expect(a!.total_weight_max_kg, `${b.model} toplam ağırlık üst sınır`)
        .toBe(b.totalWeightMaxKg);
      expect(a!.thruster_force_n, `${b.model} itici kuvveti`).toBe(b.thrusterForceN);
      expect(a!.thruster_stroke_mm, `${b.model} itici stroku`).toBe(b.thrusterStrokeMm);
      expect(a!.thruster_power_w, `${b.model} itici gücü`).toBe(b.thrusterPowerW);
      expect(a!.thruster_current_a, `${b.model} itici akımı`).toBe(b.thrusterCurrentA);
      for (const [alan, attr] of HARFLER) {
        expect(a![attr], `${b.model} ${attr}`).toBe(b.dims[alan]);
      }
    }
  });

  it("katalogtaki ölçülü HER satırın defterde karşılığı vardır", () => {
    // Ters yön: katalog büyürse defter sessizce eksik kalmasın.
    const defter = new Set(DRUM_BRAKES.map((b) => b.model));
    const eksik = OLCULU.map(([model]) => model).filter((m) => !defter.has(m));
    expect(eksik, eksik.join(", ")).toEqual([]);
  });
});

describe("ölçüler kendi içinde tutarlı", () => {
  it("toplam ağırlık = fren + itici (katalogun kg* sütunu İTİCİ HARİÇTİR)", () => {
    for (const b of DRUM_BRAKES) {
      expect(b.totalWeightKg, b.model).toBe(b.brakeWeightKg + b.thrusterWeightKg);
      if (b.thrusterWeightMaxKg !== undefined) {
        expect(b.totalWeightMaxKg, b.model).toBe(b.brakeWeightKg + b.thrusterWeightMaxKg);
        expect(b.thrusterWeightMaxKg).toBeGreaterThan(b.thrusterWeightKg);
      } else {
        expect(b.totalWeightMaxKg, b.model).toBeUndefined();
      }
    }
  });

  it("E ve G kasnak eksenine kadardır: E > G ve plaka takımın içinde başlar", () => {
    for (const b of DRUM_BRAKES) {
      // Kol plakanın sol kenarından DIŞARI taşar; ikisinin farkı o paydır.
      expect(b.dims.e, b.model).toBeGreaterThan(b.dims.g);
      // Taban plakası (E − G) noktasında başlar ve toplam boyu aşmaz.
      expect(b.dims.e - b.dims.g + b.dims.c, b.model).toBeLessThan(b.dims.a);
    }
  });

  it("plandaki genişlikler İÇ İÇEDİR: F ≥ P ≥ Q > J", () => {
    for (const b of DRUM_BRAKES) {
      expect(b.dims.f, `${b.model} F ≥ P`).toBeGreaterThanOrEqual(b.dims.p);
      expect(b.dims.p, `${b.model} P ≥ Q`).toBeGreaterThanOrEqual(b.dims.q);
      expect(b.dims.q, `${b.model} Q > J`).toBeGreaterThan(b.dims.j);
    }
  });

  it("kasnak, pabuç mafsallarının arasına sığar (K > D/2)", () => {
    for (const b of DRUM_BRAKES) {
      expect(b.dims.k, b.model).toBeGreaterThan(b.drumDiaMm / 2);
    }
  });

  it("A · B · H İTİCİYE, kalan ölçüler yalnız FREN BOYUNA bağlıdır", () => {
    // Şemanın bütün düzeni bu ayrıma dayanır: aynı kasnak çapında itici
    // değişince yalnız üç ölçü değişmelidir.
    const boylar = new Map<number, typeof DRUM_BRAKES[number][]>();
    for (const b of DRUM_BRAKES) {
      const liste = boylar.get(b.drumDiaMm) ?? [];
      liste.push(b);
      boylar.set(b.drumDiaMm, liste);
    }
    const ortak = HARFLER.filter(([alan]) => !["a", "b", "h"].includes(alan));
    for (const [dia, liste] of boylar) {
      const ilk = liste[0];
      for (const b of liste.slice(1)) {
        expect(b.brakeWeightKg, `Ø${dia} fren ağırlığı`).toBe(ilk.brakeWeightKg);
        for (const [alan] of ortak) {
          expect(b.dims[alan], `Ø${dia} ${alan} iticiye göre değişmemeli`)
            .toBe(ilk.dims[alan]);
        }
      }
    }
    // …ve gerçekten DEĞİŞEN bir örnek vardır (aksi hâlde test hiçbir şeyi
    // korumaz): TE 315'te 23/5 ile 50/6 farklı A/B/H taşır.
    const kucuk = drumBrakeSpec("TE315/23/5")!;
    const buyuk = drumBrakeSpec("TE315/50/6")!;
    expect(buyuk.dims.a).toBeGreaterThan(kucuk.dims.a);
    expect(buyuk.dims.b).toBeGreaterThan(kucuk.dims.b);
    expect(buyuk.dims.h).toBeGreaterThan(kucuk.dims.h);
  });
});

describe("model kodu ayrıştırma", () => {
  it("üç yazımı da aynı ürüne düşürür", () => {
    for (const yazim of [
      "TE315/50/6",
      "TE 315/50/6",
      "TE 315 Ed 50/6",
      "TE 315 50/6",
      "SIBRE TE315 Ed 50/6",
      "SİBRE TE315/50/6",
      "te315/50/6",
    ]) {
      expect(drumBrakeSpec(yazim)?.model, yazim).toBe("TE315/50/6");
    }
  });

  it("V5 şablonundaki eski yazımları da tanır", () => {
    expect(drumBrakeSpec("SIBRE TE250 Ed 50/6")?.model).toBe("TE250/50/6");
    expect(drumBrakeSpec("TE200 Ed 23/5")?.model).toBe("TE200/23/5");
  });

  it("ölçüsü olmayan ya da kasnak freni olmayan seçim null döner", () => {
    // TE 160 AYRI bir ölçü resmidir (kompakt konsol): katalogda yalnız A/B/C/H
    // yayımlanır ve harfleri TE resminin harfleriyle aynı anlamı taşımaz.
    expect(parseDrumBrakeModel("TE160/23/5")).toEqual({ drumDiaMm: 160, thruster: "Ed 23/5" });
    expect(drumBrakeSpec("TE160/23/5")).toBeNull();
    for (const yok of ["SHI 105", "DYF08", "USB5-05 D250 23/5", "", null, undefined, "TE"]) {
      expect(drumBrakeSpec(yok), String(yok)).toBeNull();
    }
    // Katalogda olmayan bir birleşim de null döner (uydurma ölçü üretilmez).
    expect(drumBrakeSpec("TE200/301/6")).toBeNull();
  });
});

describe("ağırlık metni", () => {
  it("katalog aralık veriyorsa ARALIK basar, tek sayıya indirmez", () => {
    expect(drumBrakeWeightText(73, 76)).toBe("73 – 76");
    expect(drumBrakeWeightText(73, 76, 2)).toBe("146 – 152");
    expect(drumBrakeWeightText(29, undefined)).toBe("29");
    expect(drumBrakeWeightText(29, undefined, 2)).toBe("58");
    // Üst sınır alt sınıra eşitse aralık yazılmaz.
    expect(drumBrakeWeightText(40, 40)).toBe("40");
  });
});
