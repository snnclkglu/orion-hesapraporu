// TUTAR ISISININ İKİ YÜZÜ AYNI RAMPADAN GELİR.
//
// Ekran rengi `globals.css`teki `.oc-amount` kuralında, belge rengi
// `heat.ts`teki `COST_HEAT_RAMP` sabitinde yaşar. İkisi AYNI sayılardır ve iki
// yerde yazılıdır — değişmez md. 8: bir kural iki yerde yaşıyorsa ayrışmayı
// bir test KAYNAK DOSYAYI okuyarak engeller (`terms.test.ts` deseni).
//
// Ayrışma sessizdir: CSS'teki 0,58'i 0,62'ye çeken bir düzenleme hiçbir testi
// kırmadan ekranı belgeden ayırırdı ve kusur ancak PDF ile ekran yan yana
// konunca görülürdü.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COST_HEAT_RAMP,
  costAmountLevel,
  costHeatArgb,
  costHeatHex,
  oklchToHex,
} from "../heat";

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** `.oc-amount` kuralının gövdesi — koyu tema ikizi (`.dark .oc-amount`) hariç. */
function acikTemaKurali(): string {
  const i = CSS.indexOf(".oc-amount {");
  expect(i, "globals.css'te `.oc-amount` kuralı bulunamadı").toBeGreaterThan(-1);
  const son = CSS.indexOf("}", i);
  return CSS.slice(i, son);
}

describe("tutar ısısı — ekran ve belge aynı rampadan", () => {
  it("`.oc-amount` katsayıları `COST_HEAT_RAMP` ile birebir", () => {
    const kural = acikTemaKurali();
    const { lightness, chroma, hue } = COST_HEAT_RAMP;
    // Sayılar CSS'te `calc(0.58 - 0.1 * var(--oc-level))` biçimindedir; işaret
    // ayrı yazıldığı için mutlak değer aranır ve yön ayrıca sınanır.
    expect(kural).toContain(`${lightness.base} - ${Math.abs(lightness.span)}`);
    expect(kural).toContain(`${chroma.base} + ${chroma.span}`);
    expect(kural).toContain(`${hue.base} - ${Math.abs(hue.span)}`);
    expect(lightness.span).toBeLessThan(0);
    expect(chroma.span).toBeGreaterThan(0);
    expect(hue.span).toBeLessThan(0);
  });

  it("OKLCH → hex bilinen çapaları tutturuyor", () => {
    // Beyaz ve siyah: dönüşümün iki ucu. Kayan noktalı yuvarlama bir bileşende
    // 1 birim sapabilir, o yüzden uçlar tam eşitlikle sınanır.
    expect(oklchToHex(1, 0, 0)).toBe("#FFFFFF");
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
  });

  it("küçük tutar SARI uçta, büyük tutar KIRMIZI uçta", () => {
    const kucuk = costHeatHex(100, 100_000)!;
    const buyuk = costHeatHex(100_000, 100_000)!;
    const oku = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [kr, kg] = oku(kucuk);
    const [br, bg] = oku(buyuk);
    // Sarı uçta yeşil kanal kırmızıya YAKINDIR; kırmızı uçta ondan çok geride.
    expect(kg / kr).toBeGreaterThan(0.7);
    expect(bg / br).toBeLessThan(0.5);
  });

  it("girilmemiş sayının rengi YOKTUR — bilinmeyen `küçük` diye boyanmaz", () => {
    expect(costAmountLevel(null, 100)).toBeNull();
    expect(costHeatHex(null, 100)).toBeNull();
    expect(costHeatArgb(null, 100)).toBeNull();
    // Ölçeğin tabanı yoksa renk de yoktur.
    expect(costHeatHex(50, 0)).toBeNull();
  });

  it("Excel rengi ARGB'dir: alfa ÖNDE ve tam opak", () => {
    const argb = costHeatArgb(50_000, 100_000)!;
    expect(argb).toMatch(/^FF[0-9A-F]{6}$/);
    expect(`#${argb.slice(2)}`).toBe(costHeatHex(50_000, 100_000));
  });
});
