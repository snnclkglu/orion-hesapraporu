// Uçtan uca entegrasyon: runCalc(V5_TEMPLATE) — modüller arası bağımlılıklar
// motorda TÜRETİLİR (ör. ana kiriş, araba modülünün hesapladığı gerçek hız ve
// ivmelenme süresini alır). Bu test türetilmiş zincirin, golden testlerdeki
// statik V5 deps sabitleriyle aynı sonucu verdiğini kanıtlar.

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "../defaults";
import { runCalc } from "../engine";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

describe("engine entegrasyonu — V5 şablonu", () => {
  const result = runCalc(V5_TEMPLATE);

  it("tüm modüller hesaplanır", () => {
    for (const key of [
      "mainHoist", "auxHoist", "hookBlock", "trolley", "bridge",
      "girder", "buckling", "endCarriage",
    ] as const) {
      expect(result[key], key).toBeDefined();
    }
  });

  it("türetilmiş deps ile ana kiriş, Excel 07 sayfasıyla birebir eşleşir", () => {
    const dump = loadFormulaCells("08_07_ANA_KİRİŞ.txt").filter(
      (c) => !isDecorative(c) && !(typeof c.value === "string" && c.value.startsWith("#"))
    );
    const failures: string[] = [];
    for (const dc of dump) {
      const { ok, message } = compareCell(dc.value, result.girder!.cells[dc.cell]);
      if (!ok) failures.push(`${dc.cell}: ${message}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("V5'in bilinen kontrol durumu korunur", () => {
    const failing = result.allChecks.filter((c) => !c.pass).map((c) => c.id).sort();
    // Excel V5'in gerçek durumu: redüktör torku (Excel'de de û), köprü freni
    // (Excel'de seçilmemiş, û) + Excel'de tik hücresi olmayan ek kontroller.
    expect(failing).toContain("main.gearbox.torque");
    expect(failing).toContain("bridge.brake.torque");
    // Beklenmedik yeni bir Excel-sadık kontrol kırılması olmamalı.
    // Bilinen V5 durumu: redüktör torku (Excel'de de û), köprü freni (seçilmemiş),
    // makara rulmanı ömrü (2707 < 6300 saat — Excel aynı sayıları gösterir ama
    // tik hücresi olmadığından işaretlemez).
    const excelFaithfulFails = result.allChecks.filter((c) => !c.pass && !c.nonExcel);
    expect(excelFaithfulFails.map((c) => c.id).sort()).toEqual(
      ["bridge.brake.torque", "hookBlock.sheaveBearing.life", "main.gearbox.torque"].sort()
    );
  });
});
