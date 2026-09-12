import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { normalizeImage } from "./server";
const sample = "artifacts/account-mobile/example.heic";
it.runIf(existsSync(sample))(
  "libheif gerçek HEIC örneğini ölçülü, metadata içermeyen WebP'ye çevirir",
  async () => {
    const file = new File(
      [new Uint8Array(readFileSync(sample))],
      "example.heic",
      { type: "image/heic" },
    );
    const converted = await normalizeImage(file, 1600);
    const image = await sharp(converted).metadata();
    expect(image.format).toBe("webp");
    expect(image.width).toBeGreaterThan(0);
    expect(image.width).toBeLessThanOrEqual(1600);
    expect(image.height).toBeLessThanOrEqual(1600);
    expect(image.exif).toBeUndefined();
  },
  15000,
);
