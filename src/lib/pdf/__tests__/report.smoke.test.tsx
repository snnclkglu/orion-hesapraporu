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
import {
  ReportDocument,
  renderReportPdf,
  summarySpecsForReport,
  type ReportProps,
} from "@/lib/pdf/report";

const input = V5_TEMPLATE;
const result = runCalc(input);
const props: ReportProps = {
  project: {
    doc_no: "412",
    name: "İsdemir Amonyum Sülfat Vinci",
    customer: "İsdemir",
    crane_type: "Çift kirişli gezer köprülü vinç",
    crane_location: "İskenderun Üretim Sahası",
  },
  revision: { rev_no: 3, label: "V3", issued_at: "2026-07-01T00:00:00.000Z" },
  preparedBy: "Sinan Çolakoğlu",
  reportBrand: {
    name: "Karçel Kardemir Çelik Yapı İmalat San. ve Tic. Ltd. Şti.",
    logo: fs.readFileSync(path.join(process.cwd(), "public", "brand", "orion-logo-ink.png")),
  },
  endCustomerLogo: fs.readFileSync(
    path.join(process.cwd(), "public", "brand", "orion-symbol-ink.png")
  ),
  input,
  result,
};

// Rapor render'ı pahalıdır (iki geçiş, ~60 sayfa); testler tek çıktıyı paylaşır.
let cached: Promise<Buffer> | undefined;
const report = () => (cached ??= renderReportPdf(props));

describe("hesap raporu PDF duman testi", () => {
  it("özet teknik tablosu kapasiteyle başlar; yok alanları ve çarpma oranlarını basmaz", () => {
    const summary = summarySpecsForReport({
      ...input,
      specs: {
        ...input.specs,
        showFestoonDetailsInReport: true,
        trolleyPowerSupply: "festoon",
        bridgePowerSupply: "conductorBar",
        trolleyBufferType: "hidrolik",
        bridgeBufferType: "kaucuk",
      },
    });
    const keys = summary.defs.map((f) => f.key);
    const labels = new Map(summary.defs.map((f) => [f.key, f.label]));
    const bridgeWeight = keys.indexOf("bridgeWeightT");

    expect(keys[0]).toBe("mainCapacityT");
    expect(keys).not.toContain("monorailCount");
    expect(keys).not.toContain("trolleyBufferImpactSpeedPct");
    expect(keys).not.toContain("bridgeBufferImpactSpeedPct");
    expect(keys.slice(bridgeWeight + 1, bridgeWeight + 3)).toEqual([
      "summaryAttachmentWeightT",
      "summaryCraneTotalWeightT",
    ]);
    expect(labels.get("summaryAttachmentWeightT")).toBe("Kepçe Ağırlığı");
    expect(summary.source.summaryCraneTotalWeightT).toBeCloseTo(22.75, 9);
    expect(labels.get("trolleySpeedMpm")).toBe("Ana Araba Yürütme Hızı");
    expect(labels.get("bridgeSpeedMpm")).toBe("Köprü Yürütme Hızı");
    expect(labels.get("trolleyPowerSupply")).toBe("Ana Araba Enerji Besleme Sistemi");
    expect(labels.get("bridgeBufferType")).toBe("Köprü Tampon Tipi");
  });

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

// ---------------------------------------------------------------- Seviyeler
//
// Kullanıcı kararı, 12.08.2026 — üç seviye artık İÇERİKÇE de ayrışır:
//   · Kontrol Özeti YALNIZ detaylı raporda,
//   · Özet raporda İçindekiler, Ek (Kaynaklar) ve gizlilik koşulları YOK,
//   · Gizlilik koşulları detaylıda TAM, standartta KISA metinle basılır.
// Kural PDF'in METNİNDEN ölçülür (job-list.test.tsx deseni): bileşen ağacına
// bakmak, seviyenin gerçekten belgeye yansıdığını göstermez.

/** Sayfa sayfa çözülmüş metin; harf aralıklı kicker'lar için boşluklar da atılır. */
async function pagesOf(buf: Buffer): Promise<{ pages: string[]; all: string; squeezed: string }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc);
  const pages = (Array.isArray(text) ? text : [text]).map((p) => p.replace(/\s+/g, " "));
  const all = pages.join(" ");
  return { pages, all, squeezed: all.replace(/\s+/g, "") };
}

// Her seviye bir kez render edilir (detaylı ~90 sayfa); testler çıktıyı paylaşır.
const levelBuf = new Map<string, Promise<Buffer>>();
const atLevel = (level: "detayli" | "standart" | "ozet") => {
  let p = levelBuf.get(level);
  if (!p) {
    p = renderToBuffer(<ReportDocument {...props} level={level} />) as Promise<Buffer>;
    levelBuf.set(level, p);
  }
  return p;
};

describe("rapor seviyeleri — bölüm kapsamı", () => {
  it("kapak vinç yerini ve tam kaldırma/yük sınıfını gösterir", async () => {
    const ozet = await pagesOf(await atLevel("ozet"));
    expect(ozet.all).toContain("İskenderun Üretim Sahası".toLocaleUpperCase("tr-TR"));
    expect(ozet.all).toContain(input.specs.hoistLoadClass);
    expect(ozet.all).toContain("KARÇEL KARDEMİR ÇELİK YAPI İMALAT");
    expect(ozet.all).not.toContain("RAPORU HAZIRLAYAN FİRMA");
    expect(ozet.all.toLocaleLowerCase("tr-TR")).not.toContain("partner");
  }, 300_000);

  it("kontrol özeti yalnız DETAYLI raporda basılır", async () => {
    const detayli = await pagesOf(await atLevel("detayli"));
    const standart = await pagesOf(await atLevel("standart"));
    const ozet = await pagesOf(await atLevel("ozet"));

    expect(detayli.squeezed).toContain("KONTROLÖZETİ");
    expect(standart.squeezed).not.toContain("KONTROLÖZETİ");
    expect(ozet.squeezed).not.toContain("KONTROLÖZETİ");
  }, 300_000);

  it("özet rapor içindekiler, Ek ve gizlilik koşulları taşımaz", async () => {
    const ozet = await pagesOf(await atLevel("ozet"));

    expect(ozet.squeezed).not.toContain("İÇİNDEKİLER");
    expect(ozet.squeezed).not.toContain("KAYNAKLARVESTANDARTLAR");
    expect(ozet.squeezed).not.toContain("GİZLİLİKVEKULLANIMKOŞULLARI");
    // Kapak + özet: belge iki sayfadır, dizinden kısa.
    expect(ozet.pages.length).toBeLessThanOrEqual(3);
  }, 300_000);

  it("standart rapor içindekiler ve Ek taşır, gizlilik metni KISADIR", async () => {
    const standart = await pagesOf(await atLevel("standart"));

    expect(standart.squeezed).toContain("İÇİNDEKİLER");
    expect(standart.squeezed).toContain("KAYNAKLARVESTANDARTLAR");
    expect(standart.squeezed).toContain("GİZLİLİKVEKULLANIMKOŞULLARI");
    // Kısa metinde olan / olmayan paragraflar
    expect(standart.all).toContain("Mülkiyet ve Gizlilik.");
    expect(standart.all).toContain("Teknik Geçerlilik.");
    expect(standart.all).toContain("KARÇEL KARDEMİR ÇELİK YAPI İMALAT");
    expect(standart.all).toContain("Taraflar arasındaki sözleşme ve gizlilik anlaşmaları saklıdır.");
    expect(standart.all).not.toContain("Teknik bilginin kullanımı.");
    expect(standart.all).not.toContain("know-how içermektedir");
  }, 300_000);

  it("detaylı raporda gizlilik metni TAM basılır", async () => {
    const detayli = await pagesOf(await atLevel("detayli"));

    for (const lead of [
      "Mülkiyet.",
      "Kullanım ve gizlilik.",
      "Teknik bilginin kullanımı.",
      "Teknik Geçerlilik.",
    ]) {
      expect(detayli.all, `«${lead}» paragrafı`).toContain(lead);
    }
    expect(detayli.all).toContain("ORION VİNÇ MÜHENDİSLİK SAN. VE TİC. LTD. ŞTİ.");
    expect(detayli.all).toContain("ve KARÇEL KARDEMİR ÇELİK YAPI İMALAT");
    expect(detayli.all).toContain("mevzuattan doğan hakları saklıdır.");
  }, 300_000);

  // ---- kullanıcı kararı: "Ek ve bu yazı 1 sayfayı geçmesin"
  it("Ek ile gizlilik koşulları TEK sayfaya sığar ve belgenin son sayfasıdır", async () => {
    for (const level of ["detayli", "standart"] as const) {
      const { pages } = await pagesOf(await atLevel(level));
      const son = pages.length - 1;
      const squeezedPage = (i: number) => pages[i].replace(/\s+/g, "");

      // Kaynak listesi, gizlilik başlığı ve metnin SON cümlesi aynı yaprakta
      expect(squeezedPage(son), `${level}: Ek son sayfada`).toContain("KAYNAKLARVESTANDARTLAR");
      expect(squeezedPage(son), `${level}: gizlilik başlığı son sayfada`).toContain(
        "GİZLİLİKVEKULLANIMKOŞULLARI"
      );
      expect(pages[son], `${level}: gizlilik metni son sayfada bitiyor`).toContain(
        "gizlilik anlaşmaları saklıdır"
      );
      // Ek yalnız BİR yaprak: önceki sayfaya taşmamış
      expect(squeezedPage(son - 1), `${level}: Ek ikinci yaprağa taşmamalı`).not.toContain(
        "KAYNAKLARVESTANDARTLAR"
      );
    }
  }, 300_000);
});
