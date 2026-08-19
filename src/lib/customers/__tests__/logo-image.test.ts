// MÜŞTERİ LOGOSUNUN ÖLÇÜMÜ — "PNG" bir beyandır, kanıt değil.
//
// Fikstürler UYDURULMAZ, ÜRETİLİR: her biri sharp ile gerçekten kodlanmış bir
// görüntüdür. Elle yazılmış bayt dizileriyle 16 bitlik ya da interlaced bir
// PNG'nin normalleştirilip normalleştirilmediği görülemezdi.

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeCustomerLogo } from "../logo-image";

/** Saydam zeminli, iki renkli küçük bir logo taslağı. */
function tuval(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: {
        create: {
          width: Math.max(1, Math.round(width / 2)),
          height: Math.max(1, Math.round(height / 2)),
          channels: 4,
          background: { r: 12, g: 74, b: 140, alpha: 1 },
        },
      },
      top: 0,
      left: 0,
    },
  ]);
}

describe("normalizeCustomerLogo", () => {
  it("PNG'yi kabul eder ve ölçüsünü korur", async () => {
    const png = await tuval(400, 160).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(png);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.width).toBe(400);
    expect(sonuc.height).toBe(160);
    const meta = await sharp(sonuc.png).metadata();
    expect(meta.format).toBe("png");
  });

  it("SAYDAMLIK KORUNUR — beyaza düzleştirilmez", async () => {
    const png = await tuval(120, 60).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(png);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    const meta = await sharp(sonuc.png).metadata();
    expect(meta.channels).toBe(4);
  });

  it("16 BİTLİK PNG 8 bite iner (react-pdf çözücüsü 16 biti kaldırmaz)", async () => {
    const derin = await tuval(200, 80).toColourspace("rgb16").png().toBuffer();
    expect((await sharp(derin).metadata()).bitsPerSample).toBe(16);

    const sonuc = await normalizeCustomerLogo(derin);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect((await sharp(sonuc.png).metadata()).bitsPerSample).toBe(8);
  });

  it("INTERLACED PNG düz taramaya çevrilir", async () => {
    const interlaced = await tuval(200, 80).png({ progressive: true }).toBuffer();
    expect((await sharp(interlaced).metadata()).isProgressive).toBe(true);

    const sonuc = await normalizeCustomerLogo(interlaced);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect((await sharp(sonuc.png).metadata()).isProgressive).toBe(false);
  });

  it("PALETLİ PNG paletsize çevrilir", async () => {
    const paletli = await tuval(200, 80).png({ palette: true }).toBuffer();
    expect((await sharp(paletli).metadata()).isPalette).toBe(true);

    const sonuc = await normalizeCustomerLogo(paletli);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect((await sharp(sonuc.png).metadata()).isPalette).toBe(false);
  });

  it("çok geniş logo 900 piksele iner, oranı bozulmaz", async () => {
    const buyuk = await tuval(1800, 600).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(buyuk);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.width).toBe(900);
    expect(sonuc.height).toBe(300);
  });

  it("küçük logo BÜYÜTÜLMEZ", async () => {
    const kucuk = await tuval(180, 60).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(kucuk);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.width).toBe(180);
  });

  it("PNG olmayan dosya REDDEDİLİR (uzantı değil biçim ölçülür)", async () => {
    const jpeg = await tuval(200, 80).jpeg().toBuffer();
    const sonuc = await normalizeCustomerLogo(jpeg);
    expect(sonuc.ok).toBe(false);
    if (sonuc.ok) return;
    expect(sonuc.error).toContain("PNG");
  });

  it("görüntü olmayan baytlar REDDEDİLİR", async () => {
    const sonuc = await normalizeCustomerLogo(Buffer.from("bu bir logo değil", "utf8"));
    expect(sonuc.ok).toBe(false);
  });

  it("piksel bombası REDDEDİLİR — kova sınırı baytı, bu sınır pikseli sayar", async () => {
    // 8000 piksel genişliğinde düz bir görüntü birkaç KB'a sıkışır: bayt
    // sınırından geçer, bellekte ise onlarca MB'a açılır.
    const bomba = await sharp({
      create: { width: 8000, height: 200, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const sonuc = await normalizeCustomerLogo(bomba);
    expect(sonuc.ok).toBe(false);
    if (sonuc.ok) return;
    expect(sonuc.error).toContain("büyük");
  });
});
