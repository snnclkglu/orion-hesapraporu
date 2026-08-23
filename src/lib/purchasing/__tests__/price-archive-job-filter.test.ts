// Fiyat Arşivi iş numarası sözleşmesi SQL, sunucu sorgusu ve URL arayüzünde
// birlikte yaşar. Bir katman unutulursa filtre görünür ama çalışmaz ya da
// bağlantı yenilenince kaybolur; kaynakları birlikte okuyarak bunu kilitleriz.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kok = process.cwd();
const migration = readFileSync(
  join(kok, "supabase/migrations/20260824000005_price_archive_job_filter.sql"),
  "utf8"
);
const data = readFileSync(join(kok, "src/app/(app)/purchasing/data.ts"), "utf8");
const page = readFileSync(join(kok, "src/app/(app)/purchasing/fiyatlar/page.tsx"), "utf8");
const archive = readFileSync(
  join(kok, "src/app/(app)/purchasing/fiyatlar/price-archive.tsx"),
  "utf8"
);

describe("Fiyat Arşivi — iş numarası arama ve süzgeç sözleşmesi", () => {
  it("SQL dizini iş numarasını hem arama metnine hem ayrı diziye alıyor", () => {
    expect(migration).toContain("coalesce(string_agg(distinct o.item_no, ' '), '')");
    expect(migration).toContain("as isler");
    expect(migration).toContain("public.purchase_price_job_options");
  });

  it("sunucu sorgusu çoklu iş seçimini bütün arşivde uyguluyor", () => {
    expect(data).toContain('q.overlaps("isler", sorgu.isNumaralari as string[])');
    expect(data).toContain('.from("purchase_price_job_options").select("is_no")');
  });

  it("iş seçimi URL'den okunuyor ve arayüz aynı parametreyi yazıyor", () => {
    expect(page).toContain("const isNumaralari = liste(sp.is)");
    expect(archive).toContain('baslik="İş Numarası"');
    expect(archive).toContain('adresYaz({ is: v.join(",") || undefined })');
    expect(archive).toContain("Ürün, Tedarikçi veya İş No Ara");
  });
});
