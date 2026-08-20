// Elektrik projesi okuyucusunun GERÇEK bir dosya üzerinde duman testi.
//
// Fikstür repoda DEĞİLDİR (12 MB'lık bir müşteri belgesi): yol argümandan
// gelir. Birim testleri (`src/lib/electrical/__tests__`) küçük, elle yazılmış
// span fikstürleriyle koşar; bu betik ise okuyucunun 157 sayfalık bir EPLAN
// dışa aktarımında ne bulduğunu GÖSTERİR — sayı doğru mu, insan bakar.
//
//   npx tsx scripts/test-electrical-read.ts "…/185-40T Şarj Vinci Elektrik Projeleri_rev3.pdf"

import { readFileSync } from "node:fs";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";
import { materialRows, rollupBy } from "@/lib/electrical/rollup";

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/test-electrical-read.ts <pdf yolu>");
    process.exit(1);
  }

  const bytes = new Uint8Array(readFileSync(yol));
  const t0 = Date.now();
  const okuma = await readElectricalPdf(bytes);
  const sure = Date.now() - t0;

  console.log(`Sayfa: ${okuma.pageCount}  ·  okuma ${sure} ms  ·  not: ${okuma.note || "—"}`);
  console.log("Künye:", okuma.titleBlock);
  console.log(`Sayfa dizini: ${okuma.sheets.length} satır`);
  console.log(okuma.sheets.slice(0, 3));
  console.log(`Malzeme listesi sayfaları: ${okuma.partsPages.join(", ") || "—"}`);
  console.log(`Satır: ${okuma.parts.length}`);
  console.log(okuma.parts.slice(0, 4));

  const adetsiz = okuma.parts.filter((p) => p.qty === null).length;
  console.log(`Adeti okunamayan satır: ${adetsiz}`);

  const malzeme = materialRows(okuma.parts);
  console.log(`Benzersiz malzeme: ${malzeme.length}`);
  console.log(
    "Panel dökümü:",
    rollupBy(okuma.parts, "location")
      .slice(0, 8)
      .map((r) => `${r.label}=${r.qty ?? "?"}`)
      .join("  ")
  );
  console.log(
    "Tedarikçi dökümü:",
    rollupBy(okuma.parts, "supplier")
      .slice(0, 8)
      .map((r) => `${r.label}=${r.qty ?? "?"}`)
      .join("  ")
  );
  const kategoriAdetleri = new Map<string, number>();
  for (const satir of malzeme) {
    kategoriAdetleri.set(satir.category, (kategoriAdetleri.get(satir.category) ?? 0) + 1);
  }
  console.log(
    "Kategori dökümü:",
    [...kategoriAdetleri].map(([kategori, n]) => `${kategori}=${n}`).join("  ")
  );
  console.log(`Diğer kategorisindeki malzeme: ${kategoriAdetleri.get("Diğer") ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
