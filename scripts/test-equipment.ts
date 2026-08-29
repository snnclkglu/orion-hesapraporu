// Gerçek üretim testi — V5 şablonuyla ekipman workbook'u üretir, diske yazar,
// exceljs ile geri okuyup sayfa adlarını ve satır sayılarını raporlar.
// Kullanım: npx tsx scripts/test-equipment.ts [çıktı-yolu.xlsx]

import ExcelJS from "exceljs";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import {
  buildCatalogSheetUrls, buildEquipmentGroups, buildEquipmentWorkbook, buildSummarySections,
  mergeExtras,
  type EquipmentDrawingPlan, type EquipmentExtraRow, type EquipmentNotes,
} from "../src/lib/excel/equipment";
import { orderAttachmentsForAppendix } from "../src/lib/equipment-attachments";
import { collectCatalogSheetPages } from "../src/lib/pdf/catalog-sheet-images";
import { renderEquipmentPdf } from "../src/lib/pdf/equipment-report";
import { summarySpecsForReport } from "../src/lib/pdf/report";
import { pdfEkleriYerlestir } from "../src/lib/pdf/merge";
import type { RevisionAlts } from "../src/lib/revision-load";
import { baslikDuzeni } from "../src/lib/tr-text";
import { DEFAULT_REPORT_SETTINGS } from "../src/lib/settings";

/**
 * Alternatif (seçenekli) halat fikstürü — madde 23/25. Üç seçenek de GERÇEK
 * katalog satırıdır (supabase/migrations/20260719000005_catalog_seed.sql,
 * kind='rope'); ilki V5 şablonunun seçimidir ve AKTİF olduğundan ana satırda
 * kalır, diğer ikisi "— Seçenek 2/3" satırları olarak altına düşer.
 */
const ALTS: RevisionAlts = {
  "main-2.1": {
    active: 0,
    options: [
      {
        ropeBrand: "Hasçelik", ropeDiaMm: 18, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 226,
        ropeWeightKgPerM: 1.33,
      },
      {
        ropeBrand: "İzmit A.Ş.", ropeDiaMm: 20, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 279,
        ropeWeightKgPerM: 1.64,
      },
      {
        ropeBrand: "İzmit A.Ş.", ropeDiaMm: 16, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 179,
        ropeWeightKgPerM: 1.05,
      },
    ],
  },
};

const EXTRAS: EquipmentExtraRow[] = [
  { group: "Ek Ekipman", component: "Uzaktan kumanda", brand: "HBC", model: "radiomatic", spec: "6 fonksiyon, 433 MHz", qty: "1" },
  { group: "Ana Kaldırma", component: "Aşırı yük sensörü", brand: "-", model: "-", spec: "kapasite %110 kesme", qty: "1" },
];

// "Ek Özellikler" notları (madde 34) — bir satır dolu, gerisi boş bırakılır ki
// boş notun sütunu/hizayı bozmadığı da görülsün.
const NOTES: EquipmentNotes = {
  "main:rope": "Galvanizli, müşteri onayına tabi",
  "bridge:wheel": "Ray DIN 536 A65 kabulüyle",
};

/**
 * Teknik Resim Takibi fikstürü — gerçek iş emirlerinin (0019, 0055) resim
 * antedlerinden. Üç bandın da temsil edilmesi bilinçli: köprü, araba ve
 * ekstra grupların özette AYRI başlıklar altında çıkması sınanıyor.
 */
// DÖRT BANT: köprü · ana araba · yardımcı araba · ekstra. Vinçte iki araba
// olabilir ve ikisi ayrı numara takımıdır (`lib/drawing-plan.ts`).
const DRAWING_PLAN: EquipmentDrawingPlan = {
  itemNo: "0055-01",
  rows: [
    { id: "1", code: "0100", name: "KÖPRÜ YÜRÜTME GRUBU", status: "cizildi", drawnBy: null, drawnByName: "", note: "" },
    { id: "2", code: "0200", name: "ANA KİRİŞ", status: "kontrol", drawnBy: null, drawnByName: "", note: "" },
    { id: "3", code: "0300", name: "BAŞKİRİŞ", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
    { id: "4", code: "1500", name: "ANA ARABA KOMPLESİ", status: "ciziliyor", drawnBy: null, drawnByName: "", note: "" },
    { id: "5", code: "1600", name: "ARABA YÜRÜTME GRUBU", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
    { id: "6", code: "2300", name: "YARDIMCI ARABA KOMPLESİ", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
    { id: "7", code: "3000", name: "MEKANİK KEPÇE", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
  ],
};

/**
 * "Ek Belge" fikstürü — mühendisin kendi elindeki katalog yaprağı. Bir satırda
 * İKİ ek var: ek kapağının çapası yalnız İLKİNDE olmalı (adlandırılmış hedef
 * ikizlenirse bağlantı hangi yaprağa gideceğini bilemez).
 */
const ATTACHMENTS = {
  "main:gearbox": [
    { fileName: "YILMAZ HT0823 olcu.pdf", pageCount: 2 },
    { fileName: "Baglanti detayi.pdf", pageCount: 1 },
  ],
  "bridge:wheel": [{ fileName: "Teker resmi.pdf", pageCount: 1 }],
};

const META = {
  docNo: "0055-01", // doküman no = iş kalemi numarası
  projectName: "İSDEMİR - Amonyum Sülfat Vinci (V5 şablon)",
  customer: "İSDEMİR",
  revLabel: "V5 şablon testi",
  revNo: 0,
  date: new Date().toLocaleDateString("tr-TR"),
  preparedBy: "Alkım Kelleci",
  checkedBy: "Sinan Çolakoğlu",
};

/**
 * Künye ayarları — varsayılanlarda adres/telefon BOŞTUR ve sayfa dibindeki
 * firma bloğu gerçek uzunluğunda görülmez. Duman testi bu yüzden canlıdaki
 * değerlerle koşar.
 */
const SETTINGS = {
  ...DEFAULT_REPORT_SETTINGS,
  address: "Malıköy, 1. Cd. No:20, 06909 Başkent Organize Sanayi Bölgesi/Sincan/Ankara",
  phone: "(0312) 511 48 06",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

async function main() {
  const outPath =
    process.argv[2] ?? path.join(tmpdir(), "orion-equipment-test.xlsx");
  mkdirSync(path.dirname(outPath), { recursive: true });

  const calcResult = runCalc(V5_TEMPLATE);
  const workbook = buildEquipmentWorkbook(V5_TEMPLATE, calcResult, META, {
    extras: EXTRAS,
    notes: NOTES,
    alts: ALTS,
    attachments: ATTACHMENTS,
    drawingPlan: DRAWING_PLAN,
  });
  await workbook.xlsx.writeFile(outPath);

  const size = statSync(outPath).size;
  console.log(`Dosya: ${outPath}`);
  console.log(`Boyut: ${size} bayt (${(size / 1024).toFixed(1)} KB)`);
  if (size <= 8 * 1024) {
    console.error("HATA: dosya boyutu 8KB altinda — icerik eksik olabilir.");
    process.exitCode = 1;
  }

  // Geri oku ve doğrula
  const readBack = new ExcelJS.Workbook();
  await readBack.xlsx.readFile(outPath);
  const expected = ["Ekipman Listesi", "Teknik Ressam Özeti"];
  const names = readBack.worksheets.map((ws) => ws.name);
  console.log(`Sayfalar: ${names.join(" | ")}`);
  for (const name of expected) {
    if (!names.includes(name)) {
      console.error(`HATA: "${name}" sayfası bulunamadı.`);
      process.exitCode = 1;
    }
  }
  for (const ws of readBack.worksheets) {
    let dataRows = 0;
    ws.eachRow({ includeEmpty: false }, () => {
      dataRows += 1;
    });
    console.log(`  "${ws.name}": ${ws.rowCount} satır (dolu: ${dataRows})`);
    if (dataRows < 15) {
      console.error(`HATA: "${ws.name}" beklenenden az satır içeriyor (${dataRows}).`);
      process.exitCode = 1;
    }
  }

  // Yeni sütun başlıkları + ek satır doğrulaması
  const eqWs = readBack.getWorksheet("Ekipman Listesi");
  if (eqWs) {
    // Başlık satırı numarası künye bloğunun boyuna göre değişir → "Ekipman"
    // hücresini arayarak bulunur (sabit satır no bayatlıyordu). Sıra numarası
    // eklendiği için ekipman adı artık B sütunundadır.
    let headerRowNo = -1;
    for (let r = 1; r <= 20; r++) {
      if (String(eqWs.getRow(r).getCell(2).value ?? "") === "Ekipman") {
        headerRowNo = r;
        break;
      }
    }
    const headerRow = eqWs.getRow(headerRowNo > 0 ? headerRowNo : 8);
    const headers = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => String(headerRow.getCell(c).value ?? ""));
    console.log(`Başlıklar: ${headers.join(" | ")}`);
    // Madde 34: "Ek Özellikler" Özellikler ile Adet arasında; "Ek Belge"
    // (11.08.2026) onun sağında, adetten önce.
    const expectedHeaders = [
      "#", "Ekipman", "Marka", "Model", "Özellikler", "Ek Özellikler", "Ek Belge", "Adet",
    ];
    if (expectedHeaders.join("|") !== headers.join("|")) {
      console.error("HATA: ekipman başlıkları beklenenle eşleşmiyor.");
      process.exitCode = 1;
    }

    // Sayfanın tamamını tara: satır metinleri + not sütunu + adet sütunu
    const ekipmanSutunu: string[] = [];
    const notluSatirlar: { ekipman: string; not: string }[] = [];
    let bosNotSayisi = 0;
    let adetKaymasi = 0;
    eqWs.eachRow((row, r) => {
      if (r <= headerRowNo) return;
      const ekipman = String(row.getCell(2).value ?? "");
      if (ekipman === "") return;
      // Grup başlığı ve altbilgi satırları A:G BİRLEŞİKTİR; exceljs birleşik
      // aralıktaki her hücreye ana hücrenin değerini verir, bu yüzden "değer
      // var mı" ölçütü yetmez — birleşik satırlar veri değildir, elenir.
      if (row.getCell(8).isMerged) return;
      const adet = row.getCell(8).value;
      if (adet === null || adet === undefined || adet === "") return;
      ekipmanSutunu.push(ekipman);
      const not = String(row.getCell(6).value ?? "");
      if (not === "") bosNotSayisi += 1;
      else notluSatirlar.push({ ekipman, not });
      // Adet hücresi sayı, sayı metni ("1" — panelden gelen ek satırlar) ya da
      // "-" olmalı; buraya bir açıklama metni düşerse sütunlar kaymış demektir.
      if (typeof adet !== "number" && !/^(-|\d+([.,]\d+)?)$/.test(String(adet))) {
        adetKaymasi += 1;
      }
    });

    // 1) Ek satır (mergeExtras) — başlık düzeninden geçer: "Uzaktan Kumanda"
    if (!ekipmanSutunu.some((v) => v.includes("Uzaktan Kumanda"))) {
      console.error("HATA: ek satır (Uzaktan Kumanda) çıktıda yok.");
      process.exitCode = 1;
    } else {
      console.log("Ek satır (Uzaktan Kumanda) çıktıda mevcut ✓");
    }

    // 2) Madde 33 — başlık düzeni: her sözcüğün baş harfi büyük
    const kucukBaslangicli = ekipmanSutunu.filter((v) =>
      /(^|\s)\p{Ll}/u.test(v.replace(/\s(ve|ile|için|veya|ya|ki|da|de)\s/gu, " X "))
    );
    if (kucukBaslangicli.length > 0) {
      console.error(`HATA: başlık düzeni uygulanmamış satır(lar): ${kucukBaslangicli.join(" / ")}`);
      process.exitCode = 1;
    } else {
      console.log(`Başlık düzeni ✓ (${ekipmanSutunu.length} satır) — ör. ${ekipmanSutunu.slice(0, 4).join(" · ")}`);
    }

    // 3) Madde 34 — notlar doğru satırda, boş notlar sütunu bozmuyor
    if (notluSatirlar.length !== Object.keys(NOTES).length) {
      console.error(
        `HATA: not sayısı beklenenle eşleşmiyor (${notluSatirlar.length} ≠ ${Object.keys(NOTES).length}).`
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Ek Özellikler ✓ ${notluSatirlar.map((n) => `${n.ekipman} → "${n.not}"`).join(" | ")}`
      );
    }
    if (bosNotSayisi === 0) {
      console.error("HATA: boş notlu satır yok — boş sütun davranışı sınanamadı.");
      process.exitCode = 1;
    }
    if (adetKaymasi > 0) {
      console.error(`HATA: ${adetKaymasi} satırda adet sütunu kaymış (boş not sütunu bozuyor).`);
      process.exitCode = 1;
    } else {
      console.log(`Boş not (${bosNotSayisi} satır) sütun hizasını bozmuyor ✓`);
    }

    // 4) Madde 23/25 — alternatifler listede, ana satırın hemen ALTINDA
    const secenekli = ekipmanSutunu.filter((v) => v.includes("Seçenek"));
    if (secenekli.length !== 2) {
      console.error(`HATA: alternatif satır sayısı 2 değil (${secenekli.length}).`);
      process.exitCode = 1;
    } else {
      const anaIndex = ekipmanSutunu.findIndex((v) => v === "Çelik Halat");
      const ilkAlt = ekipmanSutunu.findIndex((v) => v.includes("Seçenek"));
      if (anaIndex < 0 || ilkAlt !== anaIndex + 1) {
        console.error("HATA: alternatif satır ana satırın hemen altında değil.");
        process.exitCode = 1;
      } else {
        console.log(`Alternatifler ✓ ${secenekli.join(" | ")}`);
      }
    }
  }

  // Alternatif satırların KENDİ row_key'i olmalı (madde 34 notları ana satıra
  // bağlıdır; alternatif onu ÇALARSA not yanlış ekipmana yapışır).
  const altliGruplar = buildEquipmentGroups(V5_TEMPLATE, NOTES, ALTS);
  const tumSatirlar = altliGruplar.flatMap((g) => g.rows);
  const anahtarlar = tumSatirlar.map((r) => r.rowKey).filter(Boolean) as string[];
  const tekrar = anahtarlar.filter((k, i) => anahtarlar.indexOf(k) !== i);
  if (tekrar.length > 0) {
    console.error(`HATA: row_key çakışması: ${[...new Set(tekrar)].join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`row_key benzersiz ✓ (${anahtarlar.length} anahtar)`);
  }
  const altSatirlar = tumSatirlar.filter((r) => r.alt);
  const notluAlt = altSatirlar.filter((r) => (r.note ?? "") !== "");
  if (notluAlt.length > 0) {
    console.error("HATA: alternatif satır ana satırın notunu çalmış.");
    process.exitCode = 1;
  } else {
    console.log(`Alternatif satırlar ana satırın notunu çalmıyor ✓ (${altSatirlar.length} satır)`);
  }

  // Boş durum: alternatif verilmezse çıktı BİREBİR eskisi gibi olmalı
  const altsiz = JSON.stringify(buildEquipmentGroups(V5_TEMPLATE, NOTES));
  const bosAlt = JSON.stringify(buildEquipmentGroups(V5_TEMPLATE, NOTES, {}));
  const tekSecenek = JSON.stringify(
    buildEquipmentGroups(V5_TEMPLATE, NOTES, {
      "main-2.1": { active: 0, options: [ALTS["main-2.1"].options[0]] },
    })
  );
  if (altsiz !== bosAlt || altsiz !== tekSecenek) {
    console.error("HATA: alternatifi olmayan bölümde çıktı değişti.");
    process.exitCode = 1;
  } else {
    console.log("Boş durum ✓ (alternatifsiz / boş harita / tek seçenek → aynı çıktı)");
  }

  // PDF üretimi (müşteri + tam) — react-pdf hata vermeden buffer üretmeli
  const groups = mergeExtras(
    buildEquipmentGroups(V5_TEMPLATE, NOTES, ALTS, ATTACHMENTS),
    EXTRAS
  );
  // Grup adları da başlık düzeninden geçmeli (madde 33).
  // Ölçüt "her sözcük büyük harfle başlar" DEĞİLDİR: `baslikDuzeni` bağlaçları
  // ("ve", "ile") bilinçli olarak küçük bırakır — "Kabin ve Elektrik Odası"
  // doğru yazımdır. Doğru ölçüt, adın kendi düzeninde SABİT olmasıdır.
  const bozukGrup = groups.filter((g) => g.name !== baslikDuzeni(g.name));
  if (bozukGrup.length > 0) {
    console.error(`HATA: grup adı başlık düzeninde değil: ${bozukGrup.map((g) => g.name).join(" / ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Grup adları ✓ ${groups.map((g) => g.name).join(" · ")}`);
  }
  // Teknik Ressam Özeti'nin SONUNDA ana grup numaralandırması (11.08.2026):
  // köprü ve araba grupları alt alta, kalem numarası kökü ile birlikte.
  const summary = buildSummarySections(
    V5_TEMPLATE,
    calcResult,
    DRAWING_PLAN,
    ["Kabin merdiveni sol tarafta olacak.", "Ray kaynağı montajda yapılacak."].join("\n")
  );
  // Teknik özellik yaprağı (ressam paketi) — hesap raporunun özet tablosuyla
  // AYNI kaynaktan.
  const SPEC_TABLE = {
    ...summarySpecsForReport(V5_TEMPLATE),
    specs: V5_TEMPLATE.specs,
  };
  const planBolumleri = summary.filter((s) => s.name.startsWith("Teknik Resim No"));
  if (planBolumleri.length !== 4) {
    console.error(
      `HATA: teknik resim numaralandırması özete girmedi (${planBolumleri.length} bölüm).`
    );
    process.exitCode = 1;
  } else {
    const numaralar = planBolumleri.flatMap((s) => s.rows.map((r) => String(r.value)));
    if (!numaralar.includes("0055-01-0100") || !numaralar.includes("0055-01-1500")) {
      console.error(`HATA: tam resim numarası kurulmamış: ${numaralar.join(" · ")}`);
      process.exitCode = 1;
    } else {
      console.log(
        `Teknik resim numaralandırması ✓ ${planBolumleri
          .map((s) => `${s.name} (${s.rows.length})`)
          .join(" · ")}`
      );
    }
  }

  const outDir = path.join(process.cwd(), ".test-output");
  mkdirSync(outDir, { recursive: true });

  // Standart liste: ekipman adı uygulamanın katalog sayfasına köprülenir.
  const sheetUrls = buildCatalogSheetUrls(groups, "https://ornek.orioncranes.com");
  console.log(`Katalog sayfası bağlantısı olan ürün: ${sheetUrls.size}`);
  if (sheetUrls.size === 0) {
    console.error("HATA: hiçbir ürüne katalog sayfası bağlanmadı — eşleme kopmuş olabilir.");
    process.exitCode = 1;
  }

  const pdfCustomer = await renderEquipmentPdf({ meta: META, groups, sheetUrls, settings: SETTINGS });
  const pdfFull = await renderEquipmentPdf({ meta: META, groups, summary, specTable: SPEC_TABLE, sheetUrls, settings: SETTINGS });
  const pCustPath = path.join(outDir, "ekipman-listesi-musteri.pdf");
  const pFullPath = path.join(outDir, "ekipman-listesi-tam.pdf");
  writeFileSync(pCustPath, pdfCustomer);
  writeFileSync(pFullPath, pdfFull);

  // Detaylı liste: aynı liste + arkasına katalog sayfaları (webp → jpeg).
  const sheetPages = await collectCatalogSheetPages(groups);
  const yaprak = sheetPages.reduce((n, p) => n + p.images.length, 0);
  console.log(`Ek katalog sayfası: ${sheetPages.length} ürün grubu · ${yaprak} yaprak`);
  if (sheetPages.length === 0) {
    console.error(
      "HATA: detaylı listeye hiç katalog sayfası girmedi — " +
        "`python scripts/catalog-sheets.py` koşulmamış olabilir."
    );
    process.exitCode = 1;
  }
  // Sayfa yönü artık görüntüden okunuyor: yatay taranmış bir katalog sayfası
  // dikey A4'e sığdırılınca ölçü tablosu okunmuyordu (kullanıcı bildirimi).
  const yon = { portrait: 0, landscape: 0 };
  for (const p of sheetPages) for (const im of p.images) yon[im.orientation] += 1;
  console.log(`Ek yaprak yönü: ${yon.portrait} dikey · ${yon.landscape} yatay`);
  if (yon.portrait + yon.landscape !== yaprak) {
    console.error("HATA: her yaprağın yönü belirlenmemiş.");
    process.exitCode = 1;
  }

  // Ek belgeler: kapaklar react-pdf'te basılır, gerçek sayfalar pdf-lib ile
  // kapağın ARDINA konur. Sıra `orderAttachmentsForAppendix`ten gelir ve
  // `pdfEkleriYerlestir` tam onu bekler — sözleşme burada uçtan uca sınanır.
  const attachmentRows = Object.entries(ATTACHMENTS).flatMap(([rowKey, list]) =>
    list.map((a, i) => ({
      id: `${rowKey}-${i}`,
      rowKey,
      fileName: a.fileName,
      storagePath: `test/${rowKey}-${i}.pdf`,
      pageCount: a.pageCount,
      sort: i,
    }))
  );
  const ordered = orderAttachmentsForAppendix(groups, attachmentRows);
  console.log(`Ek belge kapağı: ${ordered.length} — ${ordered.map((a) => a.component).join(" · ")}`);
  if (ordered.length !== attachmentRows.length) {
    console.error("HATA: ek belgelerin bir kısmı listede karşılık bulamadı.");
    process.exitCode = 1;
  }

  const pdfDetailed = await renderEquipmentPdf({
    meta: META, groups, summary, specTable: SPEC_TABLE, sheetPages, settings: SETTINGS,
    attachmentCovers: ordered.map((a) => ({
      rowKey: a.rowKey,
      component: a.component,
      fileName: a.fileName,
      pageCount: a.pageCount,
    })),
  });

  // Sahte ek dosyaları — gerçek yükleme yerine pdf-lib ile üretilir; sınanan
  // şey sayfa AKTARIMI ve bağlantıların yaşaması, belgenin içeriği değil.
  const ekler = await Promise.all(
    ordered.map(async (a) => {
      const belge = await PDFDocument.create();
      for (let i = 0; i < a.pageCount; i += 1) belge.addPage([595, 842]);
      return { ad: a.fileName, bytes: await belge.save() };
    })
  );
  const kapakOncesi = (await PDFDocument.load(pdfDetailed, { updateMetadata: false }))
    .getPageCount();
  const birlesik = await pdfEkleriYerlestir(new Uint8Array(pdfDetailed), ekler);
  const beklenenSayfa = kapakOncesi + ekler.reduce((n, _e, i) => n + ordered[i].pageCount, 0);
  const sonBelge = await PDFDocument.load(birlesik.bytes, { updateMetadata: false });
  console.log(
    `Detaylı deste: ${kapakOncesi} → ${sonBelge.getPageCount()} sayfa ` +
      `(${birlesik.eklenen} ek · ${birlesik.eklenenSayfa} sayfa)`
  );
  if (sonBelge.getPageCount() !== beklenenSayfa || birlesik.atlananlar.length > 0) {
    console.error(
      `HATA: ek yerleştirme beklenen sayfa sayısını vermedi (${sonBelge.getPageCount()} ≠ ${beklenenSayfa}).`
    );
    process.exitCode = 1;
  }
  // İÇ BAĞLANTILAR YAŞADI MI: @react-pdf'in `View id` çapaları katalogun
  // `/Names /Dests` ağacındadır. Birleştirme bu ağacı taşımazsa "ekipman adına
  // tıkla" bağlantılarının HEPSİ sessizce ölür.
  const adAgaci = String(
    sonBelge.context.lookup(sonBelge.catalog.get(PDFName.of("Names"))) ?? ""
  );
  if (!adAgaci.includes("ek-belge-") || !adAgaci.includes("katalog-")) {
    console.error("HATA: birleştirmeden sonra iç bağlantı çapaları kayboldu.");
    process.exitCode = 1;
  } else {
    console.log("İç bağlantı çapaları birleştirmeden sağ çıktı ✓");
  }

  const pDetailPath = path.join(outDir, "ekipman-listesi-detayli.pdf");
  writeFileSync(pDetailPath, birlesik.bytes);

  for (const [label, p, min] of [
    ["müşteri", pCustPath, 4],
    ["tam", pFullPath, 4],
    // Detaylı dosya taranmış sayfalar taşır; 200 KB altındaysa ek boş demektir.
    ["detaylı", pDetailPath, 200],
  ] as const) {
    const sz = statSync(p).size;
    console.log(`PDF (${label}): ${p} — ${(sz / 1024).toFixed(1)} KB`);
    if (sz <= min * 1024) {
      console.error(`HATA: PDF (${label}) çok küçük — üretim başarısız olabilir.`);
      process.exitCode = 1;
    }
  }

  console.log(process.exitCode ? "SONUÇ: BAŞARISIZ" : "SONUÇ: BAŞARILI");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
