import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("katalog sayfası sunucu eşlemesi", () => {
  it("ekrandaki İzmit 18x7 NUFLEX seçimini iki sayfalı föye çözer", async () => {
    const query = new URLSearchParams({
      tur: "rope",
      marka: "İzmit A.Ş.",
      model: "Ø22 18x7 NUFLEX IWRC 1770 MPa",
    });
    const response = await GET(new Request(
      `http://orion.test/api/catalog-sheet/lookup?${query}`
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.sheet).toMatchObject({
      id: "rope/zmit-a-18x7-nuflex",
      brand: "İzmit A.Ş.",
      series: "18x7 NUFLEX",
    });
    expect(body.sheet.images).toHaveLength(2);
  });

  it("bilinmeyen ürünü katalog varmış gibi göstermez", async () => {
    const response = await GET(new Request(
      "http://orion.test/api/catalog-sheet/lookup?tur=rope&marka=X&model=Y"
    ));
    expect(response.status).toBe(404);
  });

  it("eksik ürün kimliğini reddeder", async () => {
    const response = await GET(new Request(
      "http://orion.test/api/catalog-sheet/lookup?tur=rope"
    ));
    expect(response.status).toBe(400);
  });
});
