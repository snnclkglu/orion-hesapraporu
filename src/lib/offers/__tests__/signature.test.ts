import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isOfferSignaturePath, offerSignaturePath } from "../signature";
import { normalizeOfferSignature } from "../signature-image";

describe("teklif PNG imzası", () => {
  it("depo yolu yalnız kendi teklif ve revizyonuna bağlanır", () => {
    const offer = "11111111-1111-4111-8111-111111111111";
    const revision = "22222222-2222-4222-8222-222222222222";
    const user = "33333333-3333-4333-8333-333333333333";
    const path = offerSignaturePath(offer, revision, user, "44444444-4444-4444-8444-444444444444");
    expect(isOfferSignaturePath(offer, revision, path)).toBe(true);
    expect(isOfferSignaturePath(offer, "55555555-5555-4555-8555-555555555555", path)).toBe(false);
    expect(isOfferSignaturePath(offer, revision, `${offer}/${revision}/../x.png`)).toBe(false);
  });

  it("beyaz zeminli PNG'yi şeffaf standart imza tuvaline dönüştürür", async () => {
    const source = await sharp({
      create: { width: 600, height: 200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: Buffer.from('<svg width="400" height="80"><path d="M10 60 Q 160 5 390 45" fill="none" stroke="#111" stroke-width="8"/></svg>'), left: 100, top: 60 }])
      .png()
      .toBuffer();
    const result = await normalizeOfferSignature(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.png).metadata();
    expect(meta.width).toBe(900);
    expect(meta.height).toBe(300);
    expect(meta.hasAlpha).toBe(true);
  });
});
