import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyCatalogPick, getCatalogMapping, type CatalogRow } from "../catalog-mapping";
import { findCatalogSheet } from "../catalog-sheets";
import { NEW_WORK_TEMPLATE } from "../calc/defaults";
import { buildEquipmentGroups } from "../equipment-list";

const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20260912220000_yilmaz_v_catalog.sql"), "utf8");
const rows: CatalogRow[] = [...sql.matchAll(/\('gearbox', 'YILMAZ REDÜKTÖR', '([^']+)', '((?:[^']|'')+)'::jsonb/g)].map((m, i) => ({
  id: `vr-${i}`, brand: "YILMAZ REDÜKTÖR", model: m[1], attrs: JSON.parse(m[2].replace(/''/g, "'")),
}));

describe("YILMAZ VR: gövde ve tahvil seçimi", () => {
  it("yedi gövdenin 84 benzersiz oranı yalnız kaldırmaya eklenir", () => {
    expect(rows).toHaveLength(84);
    expect(new Set(rows.map(r => r.model)).size).toBe(7);
    expect(new Set(rows.map(r => `${r.model}|${r.attrs.ratio}`)).size).toBe(84);
    expect(rows.every(r => r.attrs.application === "kaldirma" && r.attrs.input_speed_rpm === 1400)).toBe(true);
    expect(sql).not.toMatch(/delete from|update public\.cat_equipment/i);
    expect(sql).not.toContain("app_settings");
  });

  it("VR473'ün orana özgü momentini kullanır, gövde maksimumunu bütün oranlara vermez", () => {
    const group = rows.filter(r => r.model === "VR473.1K");
    expect(group.map(r => r.attrs.ratio)).toEqual([28.45, 34.28, 41.5, 47.37, 54.35, 61.85, 70.59, 81, 95.87, 101.48, 121.49, 138.35]);
    expect(group[0].attrs.output_torque_nm).toBe(1160);
    expect(group.at(-1)!.attrs.output_torque_nm).toBe(1480);
    expect(group[0].attrs.frame_max_nominal_torque_nm).toBe(1480);
    const selected = applyCatalogPick(getCatalogMapping("main", "2.3")!, group[0]);
    expect(selected.gearboxNominalTorqueKnm).toBeCloseTo(1.16);
    expect(selected.gearboxAllowedRadialKn).toBe(18.52);
    expect(selected.gearboxRatio).toBe(28.45);
    expect(selected).not.toHaveProperty("motorRpm");
    expect(selected).not.toHaveProperty("motorPowerKw");
  });

  it("motorlu ağırlığı ve çoklu kamayı düz mil sanmaz; eski ürün değerlerini temizler", () => {
    for (const row of rows) {
      expect(row.attrs).not.toHaveProperty("weight_kg");
      expect(row.attrs).not.toHaveProperty("input_shaft_mm");
      expect(row.attrs).not.toHaveProperty("output_shaft_mm");
      expect(row.attrs.output_spline).toMatch(/DIN 5480/);
      expect(Number(row.attrs.geared_motor_weight_min_kg)).toBeGreaterThan(0);
      const selected = { gearboxWeightKg: 775, gearboxInputShaftMm: 50, gearboxOutputShaftMm: 100, gearboxOutputFeature: "03",
        ...applyCatalogPick(getCatalogMapping("main", "2.3")!, row) };
      expect(selected.gearboxWeightKg).toBeNull();
      expect(selected.gearboxInputShaftMm).toBeNull();
      expect(selected.gearboxOutputShaftMm).toBeNull();
      expect(selected.gearboxOutputFeature).toBe("");
    }
  });

  it("her seçimi anma momenti tablosuna ve kendi 1K ölçü sayfasına bağlar", () => {
    for (const row of rows) {
      const sheet = findCatalogSheet("gearbox", row.brand, row.model, { inputRpm: 1400 });
      expect(sheet, row.model).toBeDefined();
      expect(sheet!.images).toHaveLength(2);
      expect(sheet!.printedPages).toContain(`V0601-0920 s.${342 + Number(row.model[2])}`);
      expect(sheet!.printedPages).toContain(`V0500-1018 s.${Number(row.model[2]) <= 6 ? 356 : 357}`);
    }
  });

  it("ekipman listesine 1K kimliği ve gerçek çoklu kama tanımı gider", () => {
    const input = structuredClone(NEW_WORK_TEMPLATE);
    const row = rows.find(r => r.model === "VR473.1K")!;
    Object.assign(input.mainHoist!.selections, applyCatalogPick(getCatalogMapping("main", "2.3")!, row));
    const equipment = buildEquipmentGroups(input).flatMap(g => g.rows).find(r => r.catalogModel === "VR473.1K")!;
    expect(equipment).toBeDefined();
    expect(equipment.spec).toContain("W50x2x30x24x8f DIN 5480");
    expect(equipment.spec).not.toContain("çıkış mili Ø");
    expect(equipment.model).not.toContain(".03");
    expect(equipment.catalogInputRpm).toBe(1400);
  });

  it("VR'den başka redüktöre geçince çoklu kama tanımı temizlenir", () => {
    const selected = applyCatalogPick(getCatalogMapping("main", "2.3")!, {
      id: "h", brand: "YILMAZ REDÜKTÖR", model: "HT0823", attrs: { series: "H" },
    });
    expect(selected.gearboxOutputSpline).toBe("");
  });
});
