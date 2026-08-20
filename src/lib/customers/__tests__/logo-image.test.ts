// MÜŞTERİ LOGOSUNUN ÖLÇÜMÜ — "PNG" bir beyandır, kanıt değil.
//
// Fikstürler UYDURULMAZ, ÜRETİLİR: her biri sharp ile gerçekten kodlanmış bir
// görüntüdür. Elle yazılmış bayt dizileriyle 16 bitlik ya da interlaced bir
// PNG'nin normalleştirilip normalleştirilmediği görülemezdi.

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CUSTOMER_LOGO_CANVAS, normalizeCustomerLogo } from "../logo-image";

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
      top: Math.round(height / 4),
      left: Math.round(width / 4),
    },
  ]);
}

describe("normalizeCustomerLogo", () => {
  it("PNG'yi kabul eder ve standart PDF tuvaline ortalar", async () => {
    const png = await tuval(400, 160).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(png);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.width).toBe(CUSTOMER_LOGO_CANVAS.width);
    expect(sonuc.height).toBe(CUSTOMER_LOGO_CANVAS.height);
    // Fikstürün görünür dikdörtgeni tuvalin yarısıdır; saydam dış
    // boşluk PDF'deki fiziksel boyutu artık etkileyemez.
    expect(sonuc.contentWidth).toBe(200);
    expect(sonuc.contentHeight).toBe(80);
    const meta = await sharp(sonuc.png).metadata();
    expect(meta.format).toBe("png");
  });

  it("BEYAZ dış boşluğu kırpar; görünür amblemi ölçer", async () => {
    const png = await sharp({
      create: { width: 500, height: 240, channels: 4, background: "#ffffff" },
    })
      .composite([
        {
          input: {
            create: { width: 240, height: 80, channels: 4, background: "#b01f24" },
          },
          left: 130,
          top: 80,
        },
      ])
      .png()
      .toBuffer();
    const sonuc = await normalizeCustomerLogo(png);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.contentWidth).toBe(240);
    expect(sonuc.contentHeight).toBe(80);
    expect([sonuc.width, sonuc.height]).toEqual([
      CUSTOMER_LOGO_CANVAS.width,
      CUSTOMER_LOGO_CANVAS.height,
    ]);
  });

  it("RENKLİ kurumsal zemin kırpılmaz", async () => {
    const png = await sharp({
      create: { width: 420, height: 180, channels: 4, background: "#153b6f" },
    })
      .composite([
        {
          input: { create: { width: 120, height: 50, channels: 4, background: "#ffffff" } },
          left: 150,
          top: 65,
        },
      ])
      .png()
      .toBuffer();
    const sonuc = await normalizeCustomerLogo(png);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.contentWidth).toBe(420);
    expect(sonuc.contentHeight).toBe(180);
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

  it("çok geniş logo standart tuvale sığar, oranı bozulmaz", async () => {
    const buyuk = await tuval(1800, 600).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(buyuk);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.width).toBe(900);
    expect(sonuc.height).toBe(240);
    expect(sonuc.contentWidth / sonuc.contentHeight).toBe(3);
  });

  it("küçük logo da aynı fiziksel yuvaya hazırlanır", async () => {
    const kucuk = await tuval(180, 60).png().toBuffer();
    const sonuc = await normalizeCustomerLogo(kucuk);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect([sonuc.width, sonuc.height]).toEqual([900, 240]);
    expect([sonuc.contentWidth, sonuc.contentHeight]).toEqual([90, 30]);
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
