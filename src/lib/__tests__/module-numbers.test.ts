// ÜST DÜZEY BÖLÜM NUMARALARI — `moduleDisplayNumbers`.
//
// "NUMARA BİR AD DEĞİL BİR SIRADIR" kuralının (kullanıcı kararı, 16.08.2026)
// üst düzey karşılığı. Alt bölüm numaraları `hidden-sections.test.ts`te
// kilitli; bu dosya MODÜL numarasını kilitler: rapordan düşen bir bölüm
// kendinden sonrakileri bir öne çeker, hiçbir numara atlanmaz.
//
// Gerekçe belgenin kendisindedir: müşteriye giden PDF'te "05 … 07" dizisi,
// okuyucuya eksik sayfa aldığını düşündürür; oysa 06 diye bir bölüm hiç
// basılmamıştır.

import { describe, expect, it } from "vitest";
import {
  MODULE_ADAPTERS,
  moduleDisplayNumbers,
  renumberTitle,
  adapterTitle,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { MODULE_ORDER, type ModuleKey } from "@/lib/calc/presentation/module-family";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { TROLLEY_ONLY_DISABLED_MODULES } from "@/lib/crane-types";

const SPECS = NEW_WORK_TEMPLATE.specs;

/** Verilen bölümler basılıyorken numara haritası. */
function numbersFor(printed: readonly ModuleKey[]) {
  const set = new Set<ModuleKey>(printed);
  return moduleDisplayNumbers((k) => set.has(k));
}

describe("moduleDisplayNumbers", () => {
  it("01 Teknik Özellikler'dir; ilk basılan bölüm 02'dir", () => {
    const nos = numbersFor(["main", "hookBlock", "trolley"]);
    expect(nos.main).toBe(2);
    expect(nos.hookBlock).toBe(3);
    expect(nos.trolley).toBe(4);
  });

  it("basılmayan bölüm numara HARCAMAZ", () => {
    // Kanca bloğu düşerse ana araba onun numarasını alır — arada boşluk kalmaz.
    const nos = numbersFor(["main", "trolley", "bridge"]);
    expect(nos.hookBlock).toBeUndefined();
    expect(nos.main).toBe(2);
    expect(nos.trolley).toBe(3);
    expect(nos.bridge).toBe(4);
  });

  it("araba-only raporda dizi boşluksuzdur", () => {
    const off = new Set<string>(TROLLEY_ONLY_DISABLED_MODULES);
    const printed = MODULE_ORDER.filter(
      (k) => !off.has(k) && ["main", "hookBlock", "trolley"].includes(k)
    );
    const nos = numbersFor(printed);
    for (const k of TROLLEY_ONLY_DISABLED_MODULES) {
      expect(nos[k as ModuleKey], k).toBeUndefined();
    }
    expect(Object.values(nos).sort((a, b) => a - b)).toEqual([2, 3, 4]);
  });

  it("hangi bölümler basılırsa basılsın numaralar 2'den birer birer artar", () => {
    // Her bölümü tek tek düşürerek tara: dizi her zaman kesintisiz olmalı.
    for (const dusen of MODULE_ORDER) {
      const printed = MODULE_ORDER.filter((k) => k !== dusen);
      const seri = Object.values(numbersFor(printed)).sort((a, b) => a - b);
      expect(seri.length, dusen).toBe(printed.length);
      expect(new Set(seri).size, `${dusen} — yinelenen numara`).toBe(seri.length);
      seri.forEach((n, i) => {
        expect(n, `${dusen} — atlanan numara`).toBe(i + 2);
      });
    }
  });

  it("renumberTitle başlığın YALNIZ numarasını değiştirir", () => {
    const adapter = MODULE_ADAPTERS.find((a) => a.key === "bridge")!;
    const baslik = adapterTitle(adapter, SPECS);
    expect(renumberTitle(baslik, 6)).toBe(baslik.replace(/^\d+/, "06"));
    // Ad kısmı korunur; yalnız baştaki iki hane değişir.
    expect(renumberTitle(baslik, 6).slice(2)).toBe(baslik.slice(2));
  });
});
