import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const editor = readFileSync(
  join(root, "src/app/(app)/offers/[id]/revisions/[revId]/offer-editor.tsx"),
  "utf8"
);
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

describe("teklif editörü yerleşimi", () => {
  it("bölüm rayının boyu kaydırma satırını görünür çerçevenin dışına itemez", () => {
    expect(editor).toContain("lg:grid-rows-[minmax(0,1fr)]");
  });

  it("fiyat satırlarını kap genişliğine göre katlar ve yatay kaydırmayı kapatır", () => {
    expect(editor).toContain("oc-price-editor-table-wrap");
    expect(editor).toContain('data-price-field="description"');
    expect(editor).toContain('data-price-field="actions"');
    expect(css).toMatch(/\.oc-price-editor-table-wrap\s*\{[^}]*container-type:\s*inline-size;/);
    expect(css).toMatch(/\.oc-price-editor-table-wrap\s*\{[^}]*overflow-x:\s*hidden\s*!important;/);
    expect(css).toContain("@container (min-width: 64rem)");
    expect(css).toMatch(/data-price-field="description"[^}]*grid-column:\s*span 3;/);
    expect(css).toMatch(/data-price-field="item"[^}]*grid-column:\s*span 8;/);
  });
});
