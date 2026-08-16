// Pano gruplama sözleşmesi.

import { describe, expect, it } from "vitest";
import { boardGroups, isDragEnabled, type BoardRowLike } from "../board";

function row(over: Partial<BoardRowLike> = {}): BoardRowLike {
  return {
    id: "j1",
    job_no: "0055",
    title: "VİNÇ",
    customer: "İSKENDERUN DEMİR VE ÇELİK A.Ş.",
    customerShort: "İSDEMİR",
    status: "active",
    work_order_date: "2026-05-11",
    created_at: "2026-05-11T09:00:00Z",
    itemCount: 1,
    craneCount: 1,
    jobLeader: "",
    ...over,
  };
}

describe("boardGroups", () => {
  it("durum: dört sütun enum sırasıyla HEP görünür, boş sütun düşmez", () => {
    const out = boardGroups([row()], "durum");
    expect(out.map((c) => c.key)).toEqual(["active", "passive", "completed", "archived"]);
    expect(out[0].rows).toHaveLength(1);
    expect(out[1].rows).toHaveLength(0);
  });

  it("müşteri: kısaltma etiket, boş grup düşer, ada göre sıralı", () => {
    const out = boardGroups(
      [
        row({ id: "a", customer: "B FİRMASI", customerShort: "B" }),
        row({ id: "b", customer: "A FİRMASI", customerShort: "A" }),
      ],
      "musteri"
    );
    expect(out.map((c) => c.label)).toEqual(["A", "B"]);
  });

  it("lider: boş lider 'Atanmamış' torbasına düşer ve torba EN SONDADIR", () => {
    const out = boardGroups(
      [
        row({ id: "a", jobLeader: "" }),
        row({ id: "b", jobLeader: "SİNAN ÇOLAKOĞLU" }),
      ],
      "lider"
    );
    expect(out.map((c) => c.label)).toEqual(["SİNAN ÇOLAKOĞLU", "Atanmamış"]);
  });

  it("yıl: en yeni solda", () => {
    const out = boardGroups(
      [
        row({ id: "a", work_order_date: "2024-01-01" }),
        row({ id: "b", work_order_date: "2026-01-01" }),
      ],
      "yil"
    );
    expect(out.map((c) => c.label)).toEqual(["2026", "2024"]);
  });

  it("sürükleme yalnız durumda", () => {
    expect(isDragEnabled("durum")).toBe(true);
    expect(isDragEnabled("musteri")).toBe(false);
    expect(isDragEnabled("lider")).toBe(false);
    expect(isDragEnabled("yil")).toBe(false);
  });
});
