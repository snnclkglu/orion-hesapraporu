import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { availableBrands, normalizedBrands } from "../brands";
import { CATALOG_KINDS, selectionCatalogFilter } from "../catalog-scope";
import { loadSelectionCatalog } from "../catalog-client";
import { catalogCompatible } from "../compatibility";
import { manufacturerConditionsMatch, hoistServiceBrakeSupported } from "../manufacturer";
import { externalReviewRequirement, readSelectionTrace, selectionReviewComplete, selectionReviewHash } from "../trace";
import { contentHash, type EquipmentRow } from "../types";
import { requestFixture } from "./fixtures";
import { solveSelection } from "../orchestrator";
import { selectionCalcInput } from "../solver";
import { runCalc } from "@/lib/calc/engine";
import { ARABA_GRUPLARI } from "@/lib/weights/defter";
import { diffRevisions } from "@/lib/revision-diff";
import pilot from "../fixtures/catalog-pilot.json";

const row = (kind: string, brand: string, attrs: Record<string, unknown>): EquipmentRow => ({ id: `${kind}:${brand}`, kind, brand, model: "TEST", attrs });

describe("görev, montaj ve üretici belgesi", () => {
  it("kaldırma ve yürütme fren markalarını kendi fiziksel ailesinde gösterir", () => {
    const request = requestFixture(); request.active = ["main", "bridge"]; request.specs.hoistBrakeType = "Eldro Fren"; request.specs.travelBrakeType = "Elektromanyetik Fren";
    const rows = [row("brake", "KASNAK", { brake_type: "drum" }), row("brake", "EM", { brake_type: "em" })];
    expect(availableBrands(rows, "hoistBrake", request)).toEqual(["KASNAK"]);
    expect(availableBrands(rows, "travelBrake", request)).toEqual(["EM"]);
    expect(normalizedBrands({ brake: "ESKİ", hoistBrake: "YENİ" })).toEqual({ hoistBrake: "YENİ", travelBrake: "ESKİ" });
  });
  it("kasnaklı frene düz kaplin bağlamaz; katalogdaki çap seçeneklerini kontrol eder", () => {
    const request = requestFixture(); request.specs.hoistBrakeType = "Eldro Fren";
    Object.assign(request.modules.main.selections, { brakeWheelDiaMm: 250, motorRpm: 1450 });
    const coupling = row("coupling", "TEST", { max_speed_rpm: 3000 });
    expect(catalogCompatible(request, request.modules, "main", "2.6", coupling)).toBe(false);
    coupling.attrs.brake_dia_options_mm = [250, 315];
    expect(catalogCompatible(request, request.modules, "main", "2.6", coupling)).toBe(true);
    coupling.attrs.brake_dia_options_mm = [315];
    expect(catalogCompatible(request, request.modules, "main", "2.6", coupling)).toBe(false);
  });
  it("açık motor besleme sınırına aykırı ürünü ve yay bilgisi olmayan kaldırma EM frenini eler", () => {
    const specs = requestFixture().specs; specs.supplyVoltage = "3 × 400 V / 50 Hz";
    expect(manufacturerConditionsMatch(row("motor", "TEST", { voltage_v: 400, frequency_hz: 60 }), specs)).toBe(false);
    expect(manufacturerConditionsMatch(row("motor", "TEST", { voltages_v: [230, 400], frequency_hz: 50 }), specs)).toBe(true);
    expect(hoistServiceBrakeSupported(row("brake", "TEST", { brake_type: "em" }))).toBe(false);
    expect(hoistServiceBrakeSupported({ ...row("brake", "Dereli", { brake_type: "em" }), model: "DYF04" })).toBe(true);
    specs.supplyVoltage = "380 VAC, 3 Faz, 50 Hz";
    expect(manufacturerConditionsMatch(row("motor", "TEST", { voltage_v: 400 }), specs)).toBe(false);
  });
  it("yeni doğrulama kaydında metin tek başına yetmez; termik sınır doğru birimde yeterli olmalı", () => {
    const request = requestFixture(); const input = selectionCalcInput(request, request.modules);
    const trace = solveSelection(request, []).trace;
    trace.issues = [{ code: "thermal.main", module: "main", state: "missing", message: "Termik" }];
    trace.review = { inputHash: selectionReviewHash(input), notes: { "thermal.main": "Çalışma çevrimi incelendi." }, reviewedAt: new Date().toISOString() };
    expect(selectionReviewComplete(trace, input)).toBe(false);
    const metric = externalReviewRequirement(trace.issues[0], input)!;
    trace.review.evidence = { "thermal.main": { source: "Üretici katalog belgesi", reference: "Rev 02 / s.12", method: "manufacturer", value: metric.required - 0.01, unit: metric.unit } };
    expect(selectionReviewComplete(trace, input)).toBe(false);
    trace.review.evidence["thermal.main"].value = metric.required;
    trace.review.evidence["thermal.main"].unit = "W";
    expect(selectionReviewComplete(trace, input)).toBe(false);
    trace.review.evidence["thermal.main"].unit = "kW";
    expect(selectionReviewComplete(trace, input)).toBe(true);
    expect(readSelectionTrace(JSON.parse(JSON.stringify(trace)))?.review?.evidence).toEqual(trace.review.evidence);
    const updatedProof = structuredClone(trace);
    updatedProof.review!.evidence!["thermal.main"].value = metric.required + 1;
    const revisionDiff = diffRevisions(
      { inputs: { autoSelection: trace }, selections: {}, results: null },
      { inputs: { autoSelection: updatedProof }, selections: {}, results: null },
    );
    expect(revisionDiff.fields.some(field => field.key === "autoSelectionSummary")).toBe(true);
    input.specs.mainCapacityT *= 2;
    expect(selectionReviewComplete(trace, input)).toBe(false);
  });
});

describe("ölçü ve kütle", () => {
  it("büyük teker milini küçültür; ortak motorun mil kontrolleri yine geçer ve kilit korunur", () => {
    const request = requestFixture(); request.active = ["bridge"]; request.sizeDesigns = true;
    Object.assign(request.modules.bridge.inputs, { shaftDiaMm: 400 });
    const proposal = solveSelection(request, []);
    expect((proposal.modules.bridge.inputs as Record<string, number>).shaftDiaMm).toBeLessThan(400);
    expect(runCalc(selectionCalcInput({ ...request, specs: proposal.specs }, proposal.modules)).bridge!.checks.filter(check => check.id.includes(".shaft.")).every(check => check.pass)).toBe(true);
    const repeated = solveSelection({ ...request, specs: proposal.specs, modules: proposal.modules }, []);
    expect((repeated.modules.bridge.inputs as Record<string, number>).shaftDiaMm).toBe((proposal.modules.bridge.inputs as Record<string, number>).shaftDiaMm);
    request.locks = ["bridge.inputs.shaftDiaMm"];
    expect((solveSelection(request, []).modules.bridge.inputs as Record<string, number>).shaftDiaMm).toBe(400);
  });
  it("ölçülen grup kütleleri tasarım döngüsüne girer; kaynak ezmeleri değiştirilmez", () => {
    const request = requestFixture(); request.sizeDesigns = true; request.locks = ["main"];
    request.weightBreakdown = { overrides: Object.fromEntries(ARABA_GRUPLARI.map(group => [`trolley.${group.key}`, 100])), notes: { "trolley.drum": "Atölye tartım tutanağı 12" } };
    const before = structuredClone(request.weightBreakdown);
    const low = solveSelection(request, pilot as EquipmentRow[]);
    for (const key of Object.keys(request.weightBreakdown.overrides!)) request.weightBreakdown.overrides![key] = 1000;
    const high = solveSelection(request, pilot as EquipmentRow[]);
    expect(high.specs.mainTrolleyWeightT).toBeGreaterThan(low.specs.mainTrolleyWeightT);
    expect(low.trace.weightSourceHash).toBe(contentHash(before));
    expect(request.weightBreakdown.notes).toEqual(before.notes);
    expect(high.trace.issues.some(issue => issue.code === "mass.convergence")).toBe(false);
  });
});

describe("filtreli, sürümlü katalog aktarımı", () => {
  it("aynı türde iki görev marka tercihini birleştirir, seçilmemiş görevi kısıtlamaz", () => {
    const request = requestFixture(); request.active = ["main", "bridge"]; request.brands = { hoistBrake: "A", travelBrake: "B" };
    expect(selectionCatalogFilter(request).find(f => f.kind === "brake")?.brands).toEqual(["A", "B"]);
    delete request.brands.travelBrake;
    expect(selectionCatalogFilter(request).find(f => f.kind === "brake")?.brands).toBeNull();
    expect(selectionCatalogFilter({ active: ["electrical"], brands: {} })).toEqual([]);
    request.brands = { hoistGearbox: "A", travelGearbox: "B" };
    expect(selectionCatalogFilter(request).filter(f => f.kind === "gearbox")).toEqual([{ kind: "gearbox", brands: ["A"], application: "kaldirma" }, { kind: "gearbox", brands: ["B"], application: "yurutme" }]);
  });
  it("SQL ve TypeScript aynı ürün türü kapsamını taşır", () => {
    const sql = readFileSync("supabase/migrations/20260909000003_auto_selection_catalog_scope.sql", "utf8");
    const kinds = [...sql.match(/not in \(([^)]+)\)/)![1].matchAll(/'([^']+)'/g)].map(match => match[1]);
    expect(kinds).toEqual([...CATALOG_KINDS]);
    const latest = readFileSync("supabase/migrations/20260909000004_auto_selection_catalog_application.sql", "utf8");
    expect([...latest.match(/not in \(([^)]+)\)/)![1].matchAll(/'([^']+)'/g)].map(match => match[1])).toEqual([...CATALOG_KINDS]);
  });
  it("tam aktarımı önbelleğe alır fakat başka rapor için yetkiyi yeniden denetler", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ version: 7001 })).mockResolvedValueOnce(Response.json({ rows: [row("motor", "A", {})], total: 1, page: 0, version: 7001 }));
    const filter = [{ kind: "motor" as const, brands: ["A"] }]; const signal = new AbortController().signal;
    const rows = await loadSelectionCatalog("r1", 7001, filter, signal, undefined, fetcher);
    fetcher.mockResolvedValueOnce(Response.json({ version: 7001 }));
    expect(await loadSelectionCatalog("r2", 7001, filter, signal, undefined, fetcher)).toBe(rows);
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockResolvedValueOnce(Response.json({ error: "Yetki yok" }, { status: 403 }));
    await expect(loadSelectionCatalog("r3", 7001, filter, signal, undefined, fetcher)).rejects.toThrow("Yetki yok");
  });
  it.each(["version", "missing", "duplicate", "cancel"])("%s halinde eksik katalogla çalışmaz", async scenario => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ version: scenario === "version" ? 8 : 7 }))
      .mockImplementationOnce(async () => { if (scenario === "cancel") controller.abort(); return Response.json({ rows: scenario === "duplicate" ? [row("motor", "A", {}), row("motor", "A", {})] : [row("motor", "A", {})], total: scenario === "cancel" ? 1 : 2, page: 0, version: 7 }); });
    await expect(loadSelectionCatalog("r", 7, [{ kind: "motor", brands: [scenario] }], controller.signal, undefined, fetcher)).rejects.toThrow();
  });
});
