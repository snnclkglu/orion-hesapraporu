import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("public catalog PDF proxy exemption", () => {
  it("lets an unauthenticated catalog download reach its route handler", async () => {
    const request = new NextRequest(
      "https://orion.test/api/catalog-sheet/download?tur=rope&marka=İzmit%20A.Ş.&model=18x7"
    );

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
