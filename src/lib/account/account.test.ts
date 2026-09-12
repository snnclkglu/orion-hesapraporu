import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeImage } from "./server";
import { profileSchema, feedbackSchema } from "./model";
import { teamSchemas } from "../tasks/teams";
describe("Hesap verisi sınırları", () => {
  it("öz-servis rol veya başka kullanıcı kimliği kabul etmez", () => {
    const input = { name: "DENİZ", phone: "", note: "", version: 1 };
    expect(profileSchema.safeParse({ ...input, role: "admin" }).success).toBe(
      false,
    );
    expect(
      profileSchema.safeParse({ ...input, userId: crypto.randomUUID() })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...input, note: "a".repeat(501) }).success,
    ).toBe(false);
  });
  it("geri bildirim yönetim alanı ve dördüncü ek kabul etmez", () => {
    const input = {
      id: crypto.randomUUID(),
      body: "Önerim",
      category: "idea",
      section: "Panel",
      files: 0,
    };
    expect(
      feedbackSchema.safeParse({ ...input, read_at: new Date().toISOString() })
        .success,
    ).toBe(false);
    expect(feedbackSchema.safeParse({ ...input, files: 4 }).success).toBe(
      false,
    );
  });
  it("ekip rolünü uygulama yöneticisine çeviremez", () => {
    expect(
      teamSchemas.member.safeParse({
        id: crypto.randomUUID(),
        version: 1,
        user_id: crypto.randomUUID(),
        role: "admin",
      }).success,
    ).toBe(false);
  });
});
describe("Fotoğraf doğrulama", () => {
  it("gerçek biçimi denetler; sahte JPEG içindeki SVG'yi reddeder", async () => {
    await expect(
      normalizeImage(
        new File(
          ['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'],
          "photo.jpg",
          { type: "image/jpeg" },
        ),
        256,
      ),
    ).rejects.toThrow();
  });
  it("yönü uygular, metadata'yı kaldırır ve avatarı sınırlar", async () => {
    const source = await sharp({
      create: { width: 80, height: 40, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const file = new File([new Uint8Array(source)], "photo.jpg", {
      type: "image/jpeg",
    });
    const prepared = await normalizeImage(file, 1600);
    const meta = await sharp(prepared).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(80);
    expect(meta.exif).toBeUndefined();
    const avatar = await normalizeImage(file, 256, {
      zoom: 99,
      x: -10,
      y: 100,
    });
    const result = await sharp(avatar).metadata();
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    expect(avatar.length).toBeLessThan(100000);
  });
  it("10 MB sınırını dosya çözümlemeden uygular", async () => {
    await expect(
      normalizeImage(new File([new Uint8Array(10485761)], "large.png"), 256),
    ).rejects.toThrow("10 MB");
  });
});
