import { describe, expect, it } from "vitest";
import {
  alphaSuffix,
  defaultPortalPayload,
  identityValues,
  resolveIdentityFields,
  suggestedSerialNo,
  unitCountFromQuantity,
  withProductPortalDefaults,
} from "../identity";
import { PRODUCT_IDENTITY_FIELDS, type IdentitySource, type ProductIdentityField, type ProductIdentityValues } from "../types";

const automatic = Object.fromEntries(
  PRODUCT_IDENTITY_FIELDS.map((key) => [key, `auto:${key}`])
) as ProductIdentityValues;
const sources = Object.fromEntries(
  PRODUCT_IDENTITY_FIELDS.map((key) => [key, { kind: "project", label: "Proje" }])
) as Record<ProductIdentityField, IdentitySource>;

describe("vinç ünitesi seri kuralı", () => {
  it("tek adet için ek koymaz, çoklu üretimde A/B/C ekler", () => {
    expect(suggestedSerialNo("0057-01", 1, 1)).toBe("0057-01");
    expect(suggestedSerialNo("0057-01", 1, 3)).toBe("0057-01-A");
    expect(suggestedSerialNo("0057-01", 2, 3)).toBe("0057-01-B");
    expect(suggestedSerialNo("0057-01", 3, 3)).toBe("0057-01-C");
    expect(alphaSuffix(27)).toBe("AA");
  });

  it("serbest adet metnini yalnız açık pozitif tam sayıysa okur", () => {
    expect(unitCountFromQuantity("2 Adet")).toBe(2);
    expect(unitCountFromQuantity(" 12 adet ")).toBe(12);
    expect(unitCountFromQuantity("yaklaşık iki")).toBeNull();
    expect(unitCountFromQuantity("0")).toBeNull();
  });
});
describe("otomatik alan + override", () => {
  it("elle yazılan boş değer dahil kullanıcının kararını korur", () => {
    const fields = resolveIdentityFields(automatic, sources, {
      capacity: "80 t",
      frequency: "",
    });
    const values = identityValues(fields);
    expect(values.capacity).toBe("80 t");
    expect(values.frequency).toBe("");
    expect(values.span).toBe("auto:span");
    expect(fields.find((field) => field.key === "capacity")?.overridden).toBe(true);
  });

  it("eksik JSONB kaydını 240 × 160 ve boş bilinmeyenlerle taşır", () => {
    const payload = withProductPortalDefaults({
      overrides: { product: "Özel Vinç" },
      documents: [
        { id: "report", sourceKind: "report" },
        { id: "equipment", sourceKind: "equipment" },
      ],
    });
    expect(payload.plate).toEqual({ widthMm: 240, heightMm: 160 });
    expect(payload.overrides.product).toBe("Özel Vinç");
    expect(payload.portal.title).toBe("Teknik Dokümanlar");
    expect(payload.documents[0]?.reportLevel).toBe("detayli");
    expect(payload.documents[1]?.equipmentDetail).toBe("standart");
  });

  it("başlangıçta kaynak belgeleri ve destek adresini taşır", () => {
    const payload = defaultPortalPayload({ serialBase: " 0057-01 ", supportEmail: "servis@orion.test" });
    expect(payload.serialBase).toBe("0057-01");
    expect(payload.portal.supportEmail).toBe("servis@orion.test");
    expect(payload.documents).toEqual([]);
  });
});

/*
 * Kartta klasör `<Select value={folderKey}>` ile gösterilir; seçeneklerde
 * karşılığı olmayan bir değerde kutu SESSİZCE BOŞALIR ve kullanıcı belgenin
 * hangi klasöre gideceğini göremeden yayımlar (30.08.2026 ekran görüntüsü:
 * üç belgenin ikisinde Klasör boştu). Yeni kayıtları şema engelliyor; bu
 * ayıklama ESKİ payload'lar içindir.
 */
describe("eski payload · klasör anahtarı ayıklaması", () => {
  it("tanınmayan klasör anahtarını 'Diğer Belgeler'e düşürür", () => {
    const payload = withProductPortalDefaults({
      documents: [
        { id: "a", sourceKind: "electrical", folderKey: "artik-yok", folderTitle: "Artık Yok", folderSort: 999 },
      ],
    });
    expect(payload.documents[0]?.folderKey).toBe("diger");
    expect(payload.documents[0]?.folderTitle).toBe("Diğer Belgeler");
    expect(payload.documents[0]?.folderSort).toBe(90);
  });

  it("geçerli klasörü olduğu gibi bırakır ve başlık/sıra alanlarını listeyle eşitler", () => {
    const payload = withProductPortalDefaults({
      documents: [
        { id: "b", sourceKind: "report", folderKey: "hesap-raporlari", folderTitle: "ESKİ AD", folderSort: 7 },
      ],
    });
    expect(payload.documents[0]?.folderKey).toBe("hesap-raporlari");
    expect(payload.documents[0]?.folderTitle).toBe("Hesap Raporları");
    expect(payload.documents[0]?.folderSort).toBe(10);
  });
});
