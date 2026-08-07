// Duman testi: golden V5 şablonu ile tam (detaylı) rapor PDF'i gerçekten
// üretilebiliyor mu? Motor koşturulur, ReportDocument buffer'a render edilir;
// boyut kontrolü + göz kontrolü için .smoke/report-sample.pdf yazılır.
//
// Ayrıca raporun GÖRÜNMEYEN yapısal özellikleri burada kilitlenir: içindekiler
// bağlantıları ve bölüm başlangıç sayfaları. Bunlar PDF metninden okunamaz
// (fontlar alt küme olarak gömülür), bu yüzden nesne düzeyinde doğrulanır.

import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { ReportDocument, renderReportPdf, type ReportProps } from "@/lib/pdf/report";

const input = V5_TEMPLATE;
const result = runCalc(input);
const props: ReportProps = {
  project: {
    doc_no: "412",
    name: "İsdemir Amonyum Sülfat Vinci",
    customer: "İsdemir",
    crane_type: "Çift kirişli gezer köprülü vinç",
  },
  revision: { rev_no: 3, label: "V3", issued_at: "2026-07-01T00:00:00.000Z" },
  preparedBy: "Sinan Çolakoğlu",
  input,
  result,
};

// Rapor render'ı pahalıdır (iki geçiş, ~60 sayfa); testler tek çıktıyı paylaşır.
let cached: Promise<Buffer> | undefined;
const report = () => (cached ??= renderReportPdf(props));

describe("hesap raporu PDF duman testi", () => {
  it("V5 şablonundan detaylı rapor üretir (>20KB) ve örneği .smoke/ altına yazar", async () => {
    const buf = await report();

    expect(buf.length).toBeGreaterThan(20 * 1024);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");

    const outDir = path.join(process.cwd(), ".smoke");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "report-sample.pdf"), buf);
  }, 180_000);

  it("içindekiler satırları belge içi bağlantı üretir (tıklayınca bölüme gider)", async () => {
    const buf = await report();
    const raw = buf.toString("latin1");
    // İç bağlantı = /Link ek açıklaması + /GoTo eylemi + adlandırılmış hedef
    expect(raw).toContain("/Dests");
    expect((raw.match(/\/GoTo/g) ?? []).length).toBeGreaterThan(3);
    expect((raw.match(/\/Link/g) ?? []).length).toBeGreaterThan(3);
  }, 180_000);

  it("her bölümün başlangıç sayfası toplanır (içindekiler sayfa numarası basabilsin)", async () => {
    const pageOf: Record<string, number> = {};
    // Üretimdeki (renderReportPdf) kuralın AYNISI: son yazan kazanır. react-pdf
    // sayfa bölerken dinamik düğümleri her aday sayfa için yeniden çalıştırır;
    // kesin numara yerleşim bittikten sonraki son geçişten gelir.
    const collect = (anchor: string, page: number) => {
      pageOf[anchor] = page;
    };
    await renderToBuffer(<ReportDocument {...props} collect={collect} />);

    // Özet ve teknik özellikler kapak + içindekilerden sonra başlar.
    expect(pageOf["bolum-ozet"]).toBeGreaterThanOrEqual(3);
    expect(pageOf["bolum-specs"]).toBeGreaterThanOrEqual(3);
    // V5 şablonunun sekiz hesap bölümünün hepsi bir sayfaya oturmuş olmalı.
    for (const key of [
      "main", "hookBlock", "aux", "trolley", "bridge", "girder", "buckling", "endCarriage",
    ]) {
      expect(pageOf[`bolum-${key}`], `${key} bölümünün sayfası`).toBeGreaterThan(3);
    }
    // Sayfa numaraları bölüm sırasıyla artmalı (bölümler karışmamış).
    const sirali = ["main", "hookBlock", "aux", "trolley", "bridge", "girder", "buckling", "endCarriage"]
      .map((k) => pageOf[`bolum-${k}`]);
    expect([...sirali].sort((a, b) => a - b)).toEqual(sirali);
  }, 240_000);

  // ---- madde 24: kontrol özeti belgenin EN SONUNDA, sayfa numaralarıyla
  it("kontrol özeti en sondadır ve her hesap bölümünün sayfası toplanır", async () => {
    const pageOf: Record<string, number> = {};
    const collect = (anchor: string, page: number) => {
      pageOf[anchor] = page;
    };
    await renderToBuffer(<ReportDocument {...props} collect={collect} />);

    const sectionPages = Object.entries(pageOf).filter(([a]) => a.startsWith("sec-"));
    // Bölüm başına çapa gerçekten kuruluyor mu (kontrol satırının sol sütunu
    // bu çapadan besleniyor)
    expect(sectionPages.length).toBeGreaterThan(20);

    const kontroller = pageOf["bolum-kontroller"];
    expect(kontroller).toBeDefined();
    // Kontrol özeti bütün hesap bölümlerinden SONRA gelir
    for (const [anchor, page] of sectionPages) {
      expect(page, `${anchor} kontrol özetinden önce olmalı`).toBeLessThanOrEqual(kontroller);
    }
    expect(kontroller).toBeGreaterThan(pageOf["bolum-endCarriage"]);
  }, 240_000);
});
