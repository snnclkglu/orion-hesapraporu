import { describe, expect, it } from "vitest";
import {
  defaultDrawingQty,
  drawingQtyAfterJobEdit,
} from "@/lib/jobs/drawing-qty";

describe("iş kalemi resim çarpanı varsayılanı", () => {
  it("tek anlamlı iş emri adetlerini otomatik okur", () => {
    expect(defaultDrawingQty("3")).toBe(3);
    expect(defaultDrawingQty("12 Adet")).toBe(12);
    expect(defaultDrawingQty("2 Takım")).toBe(2);
  });

  it("ölçü veya birleşik miktarı yanlış adet saymak yerine 1 ile başlar", () => {
    expect(defaultDrawingQty("10+10")).toBe(1);
    expect(defaultDrawingQty("90x2 180 m")).toBe(1);
    expect(defaultDrawingQty("Muhtelif")).toBe(1);
    expect(defaultDrawingQty("")).toBe(1);
  });

  it("otomatik değeri yeni iş emri adedine uyarlar", () => {
    expect(
      drawingQtyAfterJobEdit({
        previousQty: 3,
        previousQuantityText: "3 Adet",
        nextQuantityText: "5 Adet",
      })
    ).toBe(5);
  });

  it("kullanıcının özel çarpan düzeltmesini iş emri düzenlemesinde korur", () => {
    expect(
      drawingQtyAfterJobEdit({
        previousQty: 7,
        previousQuantityText: "3 Adet",
        nextQuantityText: "5 Adet",
      })
    ).toBe(7);
  });
});
