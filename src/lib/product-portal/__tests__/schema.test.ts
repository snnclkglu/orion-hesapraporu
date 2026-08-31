import { describe, expect, it } from "vitest";
import { saveSchema, schemaError } from "../schema";
import { PORTAL_FOLDER_OPTIONS, PRODUCT_IDENTITY_FIELDS } from "../types";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_UNIT = "33333333-3333-4333-8333-333333333333";

function draft(patch: Partial<Parameters<typeof saveSchema.parse>[0]> = {}) {
  return {
    projectId: UUID_A,
    revisionId: UUID_B,
    serialBase: "0026-01",
    plate: { widthMm: 240, heightMm: 160 },
    overrides: {},
    hiddenFields: [],
    portal: { title: "Teknik Dokümanlar", note: "", supportEmail: "" },
    documents: [],
    units: [{ id: UUID_UNIT, serialNo: "0026-01" }],
    ...patch,
  };
}

/*
 * BU DOSYA BİR REGRESYONUN BEKÇİSİDİR.
 *
 * `overrides` Zod 4'te enum anahtarlı tükenmiş bir `z.record` olarak yazılmıştı;
 * 14 alanın hepsini istiyordu. Kart yalnız ELLE düzenlenen alanları gönderdiği
 * için "Taslağı Kaydet" hiçbir koşulda çalışmadı ve kullanıcı İngilizce bir Zod
 * mesajı gördü (30.08.2026). Şema `actions.ts` içinde yaşadığından — o dosya
 * `"use server"` taşır ve testten import edilemez — hatayı yakalayacak bir sınama
 * da yazılamamıştı. Şema artık saf `schema.ts` içindedir; aşağıdaki üç durum
 * kaydın kısmi olmasını kalıcı olarak zorlar.
 */
describe("taslak kaydetme şeması · kimlik override'ları", () => {
  it("hiç elle düzenleme yokken (boş overrides) kaydı KABUL EDER", () => {
    const result = saveSchema.safeParse(draft({ overrides: {} }));
    expect(result.success).toBe(true);
  });

  it("tek bir alan elle düzenlendiğinde kaydı KABUL EDER", () => {
    const result = saveSchema.safeParse(draft({ overrides: { product: "ELLE YAZILDI" } }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.overrides).toEqual({ product: "ELLE YAZILDI" });
  });

  it("bütün alanlar doluyken de kabul eder", () => {
    const overrides = Object.fromEntries(PRODUCT_IDENTITY_FIELDS.map((key) => [key, key]));
    expect(saveSchema.safeParse(draft({ overrides })).success).toBe(true);
  });

  it("tanınmayan bir kimlik alanını reddeder", () => {
    const result = saveSchema.safeParse(draft({ overrides: { uydurmaAlan: "x" } }));
    expect(result.success).toBe(false);
  });
});

/*
 * Klasör anahtarı yalnız desene değil LİSTEYE uymalıdır: listede olmayan bir
 * anahtar kartta `<Select>` kutusunu BOŞ gösterir ve kullanıcı belgenin hangi
 * klasöre gideceğini göremeden yayımlar (30.08.2026 ekran görüntüsü).
 */
describe("taslak kaydetme şeması · klasör anahtarı", () => {
  const document = {
    id: "auto:report",
    sourceKind: "report" as const,
    sourceId: UUID_A,
    sourceLabel: "Yayımlanmış hesap raporu arşivi",
    sourceRevisionLabel: "V1",
    reportLevel: "detayli" as const,
    title: "Hesap Raporu · Detaylı · V1",
    folderKey: "hesap-raporlari",
    folderTitle: "Hesap Raporları",
    folderSort: 10,
    fileSort: 10,
    accessMode: "view_watermarked" as const,
    included: true,
    automatic: true,
    ready: true,
  };

  it("listedeki her klasörü kabul eder", () => {
    for (const folder of PORTAL_FOLDER_OPTIONS) {
      const result = saveSchema.safeParse(
        draft({ documents: [{ ...document, folderKey: folder.key, folderTitle: folder.title, folderSort: folder.sort }] })
      );
      expect(result.success, folder.key).toBe(true);
    }
  });

  it("desene uyan ama listede olmayan anahtarı REDDEDER", () => {
    const result = saveSchema.safeParse(draft({ documents: [{ ...document, folderKey: "uydurma-klasor" }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(schemaError(result.error)).toContain("Klasör");
  });
});

describe("şema hatası mesajı", () => {
  it("hangi alanın reddedildiğini Türkçe söyler", () => {
    const result = saveSchema.safeParse(draft({ portal: { title: "", note: "", supportEmail: "" } }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = schemaError(result.error);
      expect(message).toMatch(/^[^]*: değer geçersiz\.$/);
      expect(message).not.toMatch(/Invalid input/i);
    }
  });

  it("boş ünite listesini reddeder ve üniteleri işaret eder", () => {
    const result = saveSchema.safeParse(draft({ units: [] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(schemaError(result.error)).toContain("Fiziksel üniteler");
  });
});
