// ÜRÜN ÖLÇÜSÜ ARAMA — üretici katalogunun METİN KATMANINDA ölçü var mı?
//
// Pano yerleşimi (PANO-12) ölçüyü ÜRÜNDEN ister ve tahmin edilmiş bir ölçü
// sipariş edilebilir değildir. Ölçüler `Elektrik Katalogları/` altındaki
// üretici PDF'lerinin içindedir; bu betik onları GÖRÜNÜR kılar — otomatik
// yazmaz, insana gösterir.
//
// UYDURMA YOK: betik yalnız belgede GEÇEN sayıları basar, kaynağıyla (dosya ·
// sayfa) birlikte. Hangi sayının en/boy/derinlik olduğuna insan karar verir;
// ölçü defterine `elle` olarak o girer (değişmez md. 4).
//
//   npx tsx scripts/probe-device-dimensions.ts <pdf> <tip-no> [bağlam]

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { getDocumentProxy } from "unpdf";

/** mm değeri taşıyan satır kalıpları — üreticiler bunları farklı yazar. */
const OLCU_ISARETLERI = [
  "DIMENSION",
  "DIMENSIONS",
  "WIDTH",
  "HEIGHT",
  "DEPTH",
  "ABMESSUNG",
  "BREITE",
  "HÖHE",
  "TIEFE",
  "ÖLÇÜ",
  "GENIŞLIK",
  "YÜKSEKLIK",
  "DERINLIK",
  "MOUNTING",
  "W X H X D",
  "WXHXD",
];

async function main() {
  const [yol, tipNo, baglamHam] = process.argv.slice(2);
  if (!yol || !tipNo) {
    console.error(
      "Kullanım: npx tsx scripts/probe-device-dimensions.ts <pdf> <tip-no> [bağlam satırı]"
    );
    process.exit(1);
  }
  const baglam = Number(baglamHam ?? 6);

  const bytes = new Uint8Array(readFileSync(yol));
  const pdf = await getDocumentProxy(bytes);
  const aranan = tipNo.toUpperCase().replace(/[^A-Z0-9]/g, "");

  console.log(`${basename(yol)} · ${pdf.numPages} sayfa · aranan: ${tipNo}`);

  let bulunanSayfa = 0;
  for (let sayfa = 1; sayfa <= pdf.numPages; sayfa++) {
    const p = await pdf.getPage(sayfa);
    const icerik = await p.getTextContent();
    const satirlar: string[] = [];
    let birikim = "";
    let sonY: number | null = null;

    for (const item of icerik.items as { str?: string; transform?: number[] }[]) {
      const metin = item.str ?? "";
      const y = item.transform?.[5] ?? null;
      // Aynı satır: y yaklaşık aynı. Metin katmanı parça parça gelir.
      if (sonY !== null && y !== null && Math.abs(y - sonY) > 2) {
        if (birikim.trim()) satirlar.push(birikim.trim());
        birikim = "";
      }
      birikim += metin;
      sonY = y;
    }
    if (birikim.trim()) satirlar.push(birikim.trim());

    // `--olcu` verilirse tip numarası değil ÖLÇÜ BÖLÜMÜ aranır: üreticiler
    // ölçüyü çoğu zaman sipariş numarasının yanında değil, gövde sınıfına
    // göre ayrı bir "Dimension drawings" bölümünde verir.
    const duz = satirlar.join(" ").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // `--sayfa:N` verilirse o sayfanın TAMAMI dökülür: ölçü tablosunun
    // sütunlarını sipariş numaralarıyla eşlemek gözle yapılır.
    if (aranan.startsWith("SAYFA")) {
      const istenen = Number(aranan.replace("SAYFA", ""));
      if (sayfa !== istenen) continue;
      console.log(`
── sayfa ${sayfa} (tam döküm)`);
      for (const satir of satirlar) console.log(`   ${satir.slice(0, 190)}`);
      bulunanSayfa++;
      continue;
    }
    if (aranan !== "OLCU" && !duz.includes(aranan)) continue;

    bulunanSayfa++;
    // Ölçü işareti taşıyan satırları ve mm'li sayıları göster.
    const ilginc = satirlar.filter((s) => {
      const b = s.toLocaleUpperCase("tr-TR");
      return (
        OLCU_ISARETLERI.some((i) => b.includes(i)) ||
        /\b\d{2,4}\s*(MM|X)\s*\d{2,4}\b/i.test(s)
      );
    });

    if (ilginc.length === 0) continue;
    console.log(`\n── sayfa ${sayfa}`);
    for (const s of ilginc.slice(0, baglam)) console.log(`   ${s.slice(0, 150)}`);
  }

  console.log(`\nTip numarası ${bulunanSayfa} sayfada geçti.`);
  if (bulunanSayfa === 0) {
    console.log("Metin katmanında bulunamadı — belge taranmış olabilir (OCR gerekir).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
