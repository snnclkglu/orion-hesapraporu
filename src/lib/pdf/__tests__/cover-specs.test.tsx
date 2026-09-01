// KAPAK KÜNYE TABLOSU — üç belgenin ortak satırı (BELGE-13).
//
// Hesap raporu, ekipman listesi ve işletme-bakım el kitabı aynı
// `SharedReportCover`ı basar; oradaki bir yerleşim hatası üçünde birden
// görünür ve kullanıcı 01.09.2026'da tam olarak onu bildirdi:
// *"bakım kitapçığı kapağında tabloda sorun var."*
//
// İki kusur üst üste binmişti ve ikisi de KAĞITTA ölçüldü:
//   1. Dikey kapakta sütun kapsayıcısı `flex: 1` taşıyordu; sütun yönlü bir
//      kapta bu "eşit genişlik" değil ANA EKSENDE `flexBasis: 0` demektir ve
//      kapsayıcının belirli yüksekliği olmadığı için sütun büyüyemiyor,
//      satırlar paylarına kadar eziliyordu (adım 12,75 pt, içerik SIFIR).
//   2. `alignItems: "baseline"` yerleşimin enine ölçüsünü çökertiyordu.
// Sonuç: 13 pt'lik değer yazısı kendi satırından 6,75 pt yukarı taşıyor ve bir
// ÜSTTEKİ ayırıcı çizgiyi kesiyordu. Ayrıca iki `Text` de esnemediği için
// (yoga'da `flexShrink` öntanımı 0) uzun bir değer satırın sağından taşıyordu.
//
// SINANAN ŞEY BİÇİM DEĞİL SÖZLEŞMEDİR ve KAYNAK DOSYA OKUNARAK sınanır
// (`terms.test.ts` deseni, değişmez md. 8): bileşen ağacına bakmak yerleşimi
// göstermez, ama bu üç kararın kaybolmadığını gösterir. Kâğıdın kendisi
// `scripts/test-manual-pdf.ts`in kapak fikstürüyle gözle denetlenir.

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { SharedReportCover, type ReportCoverSpec } from "@/lib/pdf/report";

const KAYNAK = readFileSync(
  path.join(process.cwd(), "src/lib/pdf/report.tsx"),
  "utf8"
);

/** Kullanıcının 0026-01 vincinin gerçek kapak satırları. */
const OZELLIKLER: ReportCoverSpec[] = [
  { label: "VİNÇ TİPİ", value: "ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ" },
  { label: "KAPASİTE", value: "100 t" },
  { label: "AÇIKLIK", value: "14,85 m" },
  { label: "KALDIRMA YÜKSEKLİĞİ", value: "8,8 m" },
  { label: "FEM SINIFI", value: "FEM 2M / ISO M5" },
  { label: "YÜK GRUBU", value: "H2/B3" },
  { label: "ÇELİK KONSTRÜKSİYON SINIFI", value: "A5" },
  { label: "KANCA TİPİ", value: "DIN 15402 ÇİFT AĞIZ KANCA" },
];

function kunyeSatiriStili(): string {
  const bas = KAYNAK.indexOf("  specRow: {");
  expect(bas).toBeGreaterThan(0);
  // `specRow` → `specValue` bloğunun tamamı; ayrım "içindekiler" başlığındadır.
  return KAYNAK.slice(bas, KAYNAK.indexOf("  // ---- içindekiler", bas));
}

describe("kapak künye tablosu", () => {
  it("satırı BASELINE'da hizalamaz — enine ölçü çökerdi", () => {
    expect(kunyeSatiriStili()).not.toContain('alignItems: "baseline"');
    expect(kunyeSatiriStili()).toContain('alignItems: "flex-end"');
  });

  it("değer sütunu KELEPÇELİDİR: etiket esnemez, değer kalanı alır", () => {
    const stil = kunyeSatiriStili();
    expect(stil).toMatch(/specLabel:[^}]*flexShrink: 0/);
    expect(stil).toMatch(/specValue:\s*\{\s*\n\s*flex: 1,/);
  });

  it("`flex: 1` sütun kapsayıcısına YALNIZ yatay kapakta verilir", () => {
    // Dikey kapakta kap SÜTUN yönlüdür; oradaki `flex: 1` yüksekliği sıfırlar.
    expect(KAYNAK).toContain('landscape ? { flex: 1 } : { width: "100%" }');
  });

  it("uzun değerli sekiz satırlık kapağı gerçekten basar", async () => {
    const buf = await renderToBuffer(
      <Document>
        <SharedReportCover
          footerDocLine="ORION CRANES · TEST"
          docCode="ORC-BK-0026-01-R01"
          bandLines={["V1", "01.09.2026"]}
          reportName="İŞLETME VE BAKIM EL KİTABI"
          projectName="100 T X 14,85 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ"
          craneLocation="FIRIN HOLÜ"
          specs={OZELLIKLER}
          meta={{
            customer: "ASTOR A.Ş.",
            date: "01.09.2026",
            preparedBy: "—",
            checkedBy: "—",
            revision: "R01",
          }}
        />
      </Document>
    );
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.byteLength).toBeGreaterThan(10_000);
  });
});
