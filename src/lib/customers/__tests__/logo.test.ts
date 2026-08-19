// MÜŞTERİ LOGOSU — yol kuralı ve "belgeyi düşürmeyen" indirme.
//
// Buradaki sözün tamamı şudur: bir müşteri logosu yüzünden teklif PDF'i
// DÜŞMEZ. Her hata yolu `null`a iner, hiçbiri fırlatmaz.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerLogoPath, isCustomerLogoPath, loadCustomerLogo } from "../logo";

const MUSTERI = "3f2b1a90-1111-4c22-9a3d-0d5b7e6f0011";
const YUKLEME = "8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

interface SahteSecenek {
  logoPath?: string;
  musteriHatasi?: boolean;
  indirilen?: Blob | null;
  indirmeHatasi?: boolean;
  indirmeFirlatir?: boolean;
  sorguFirlatir?: boolean;
}

function sahteIstemci(o: SahteSecenek): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (o.sorguFirlatir) throw new Error("ağ koptu");
            return {
              data: o.musteriHatasi ? null : { logo_path: o.logoPath ?? "" },
              error: o.musteriHatasi ? { message: "yetki yok" } : null,
            };
          },
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: async () => {
          if (o.indirmeFirlatir) throw new Error("depo yanıt vermedi");
          return {
            data: o.indirmeHatasi ? null : (o.indirilen ?? null),
            error: o.indirmeHatasi ? { message: "bulunamadı" } : null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

describe("customerLogoPath / isCustomerLogoPath", () => {
  it("yol müşteri klasörü + yükleme kimliği + .png'dir", () => {
    expect(customerLogoPath(MUSTERI, YUKLEME)).toBe(`${MUSTERI}/${YUKLEME}.png`);
    expect(isCustomerLogoPath(MUSTERI, customerLogoPath(MUSTERI, YUKLEME))).toBe(true);
  });

  it("BAŞKA müşterinin klasörü kabul edilmez", () => {
    const baskasi = "aaaaaaaa-2222-4c22-9a3d-0d5b7e6f0011";
    expect(isCustomerLogoPath(MUSTERI, customerLogoPath(baskasi, YUKLEME))).toBe(false);
  });

  it("alt klasör, dizin çıkışı ve PNG dışı uzantı reddedilir", () => {
    expect(isCustomerLogoPath(MUSTERI, `${MUSTERI}/alt/${YUKLEME}.png`)).toBe(false);
    expect(isCustomerLogoPath(MUSTERI, `${MUSTERI}/../${YUKLEME}.png`)).toBe(false);
    expect(isCustomerLogoPath(MUSTERI, `${MUSTERI}/${YUKLEME}.jpg`)).toBe(false);
    expect(isCustomerLogoPath(MUSTERI, `${MUSTERI}/${YUKLEME}`)).toBe(false);
    expect(isCustomerLogoPath(MUSTERI, "")).toBe(false);
    expect(isCustomerLogoPath("", `${MUSTERI}/${YUKLEME}.png`)).toBe(false);
  });
});

describe("loadCustomerLogo", () => {
  it("müşteri yoksa okuma bile denenmez", async () => {
    // İstemci kasten BOZUKtur: bir çağrı yapılsaydı test fırlatarak düşerdi.
    const bozuk = {
      from: () => {
        throw new Error("çağrılmamalıydı");
      },
    } as unknown as SupabaseClient;
    await expect(loadCustomerLogo(bozuk, null)).resolves.toBeNull();
  });

  it("logo alanı boşsa null döner", async () => {
    await expect(loadCustomerLogo(sahteIstemci({ logoPath: "" }), MUSTERI)).resolves.toBeNull();
  });

  it("defter okunamazsa null döner", async () => {
    await expect(
      loadCustomerLogo(sahteIstemci({ musteriHatasi: true }), MUSTERI)
    ).resolves.toBeNull();
  });

  it("dosya inmezse null döner — belge logosuz basılır", async () => {
    await expect(
      loadCustomerLogo(
        sahteIstemci({ logoPath: customerLogoPath(MUSTERI, YUKLEME), indirmeHatasi: true }),
        MUSTERI
      )
    ).resolves.toBeNull();
  });

  it("depo FIRLATSA BİLE null döner, hata dışarı sızmaz", async () => {
    await expect(
      loadCustomerLogo(
        sahteIstemci({ logoPath: customerLogoPath(MUSTERI, YUKLEME), indirmeFirlatir: true }),
        MUSTERI
      )
    ).resolves.toBeNull();
    await expect(loadCustomerLogo(sahteIstemci({ sorguFirlatir: true }), MUSTERI)).resolves.toBeNull();
  });

  it("boş nesne (0 bayt) logo sayılmaz", async () => {
    const bos = new Blob([], { type: "image/png" });
    await expect(
      loadCustomerLogo(
        sahteIstemci({ logoPath: customerLogoPath(MUSTERI, YUKLEME), indirilen: bos }),
        MUSTERI
      )
    ).resolves.toBeNull();
  });

  it("dosya inerse BUFFER döner (imzalı adres değil)", async () => {
    const baytlar = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const logo = await loadCustomerLogo(
      sahteIstemci({
        logoPath: customerLogoPath(MUSTERI, YUKLEME),
        indirilen: new Blob([baytlar], { type: "image/png" }),
      }),
      MUSTERI
    );
    expect(Buffer.isBuffer(logo)).toBe(true);
    expect(Array.from(logo!)).toEqual(Array.from(baytlar));
  });
});
