// Gerçek üretim testi — V5 şablonuyla ekipman workbook'u üretir, diske yazar,
// exceljs ile geri okuyup sayfa adlarını ve satır sayılarını raporlar.
// Kullanım: npx tsx scripts/test-equipment.ts [çıktı-yolu.xlsx]

import ExcelJS from "exceljs";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import {
  buildEquipmentGroups, buildEquipmentWorkbook, buildSummarySections, mergeExtras,
  type EquipmentExtraRow, type EquipmentNotes,
} from "../src/lib/excel/equipment";
import { renderEquipmentPdf } from "../src/lib/pdf/equipment-report";
import type { RevisionAlts } from "../src/lib/revision-load";

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

const META = {
  docNo: "TEST-V5",
  projectName: "İSDEMİR - Amonyum Sülfat Vinci (V5 şablon)",
  customer: "İSDEMİR",
  revLabel: "V5 şablon testi",
  revNo: 0,
  date: new Date().toLocaleDateString("tr-TR"),
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
    // hücresini arayarak bulunur (sabit satır no bayatlıyordu).
    let headerRowNo = -1;
    for (let r = 1; r <= 20; r++) {
      if (String(eqWs.getRow(r).getCell(1).value ?? "") === "Ekipman") {
        headerRowNo = r;
        break;
      }
    }
    const headerRow = eqWs.getRow(headerRowNo > 0 ? headerRowNo : 8);
    const headers = [1, 2, 3, 4, 5, 6].map((c) => String(headerRow.getCell(c).value ?? ""));
    console.log(`Başlıklar: ${headers.join(" | ")}`);
    // Madde 34: "Ek Özellikler" Özellikler ile Adet arasında yer alır.
    const expectedHeaders = ["Ekipman", "Marka", "Model", "Özellikler", "Ek Özellikler", "Adet"];
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
      const ekipman = String(row.getCell(1).value ?? "");
      if (ekipman === "") return;
      // Grup başlığı ve altbilgi satırları A:F BİRLEŞİKTİR; exceljs birleşik
      // aralıktaki her hücreye ana hücrenin değerini verir, bu yüzden "değer
      // var mı" ölçütü yetmez — birleşik satırlar veri değildir, elenir.
      if (row.getCell(6).isMerged) return;
      const adet = row.getCell(6).value;
      if (adet === null || adet === undefined || adet === "") return;
      ekipmanSutunu.push(ekipman);
      const not = String(row.getCell(5).value ?? "");
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
  const groups = mergeExtras(buildEquipmentGroups(V5_TEMPLATE, NOTES, ALTS), EXTRAS);
  // Grup adları da başlık düzeninden geçmeli (madde 33)
  const bozukGrup = groups.filter((g) => /(^|\s)\p{Ll}/u.test(g.name));
  if (bozukGrup.length > 0) {
    console.error(`HATA: grup adı başlık düzeninde değil: ${bozukGrup.map((g) => g.name).join(" / ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Grup adları ✓ ${groups.map((g) => g.name).join(" · ")}`);
  }
  const summary = buildSummarySections(V5_TEMPLATE, calcResult);
  const outDir = path.join(process.cwd(), ".test-output");
  mkdirSync(outDir, { recursive: true });

  const pdfCustomer = await renderEquipmentPdf({ meta: META, groups });
  const pdfFull = await renderEquipmentPdf({ meta: META, groups, summary });
  const pCustPath = path.join(outDir, "ekipman-listesi-musteri.pdf");
  const pFullPath = path.join(outDir, "ekipman-listesi-tam.pdf");
  writeFileSync(pCustPath, pdfCustomer);
  writeFileSync(pFullPath, pdfFull);
  for (const [label, p] of [["müşteri", pCustPath], ["tam", pFullPath]] as const) {
    const sz = statSync(p).size;
    console.log(`PDF (${label}): ${p} — ${(sz / 1024).toFixed(1)} KB`);
    if (sz <= 4 * 1024) {
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
