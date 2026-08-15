#!/usr/bin/env node

// SAC · PROFİL · RAY ALIM GEÇMİŞİ — migration ÜRETİCİSİ.
//
// Kaynak: `Sac-Profil-Ray Satınalma Fiyatları ve İstatistik Eski Veri.xlsx`
// (workspace kökünde). Çıktı:
// `supabase/migrations/20260815000006_import_raw_purchases.sql`.
//
//   node scripts/generate-raw-purchase-import.mjs
//
// ═══════════════════════════════════════════ KURALLAR (sarf aktarımının aynısı)
//
// 1. **KAYIP YOK.** Dosyadaki 447 dolu satırın TAMAMI aktarılır; iş
//    benzerliğine göre dedupe YAPILMAZ. Aynı gün aynı firmadan iki kez alınmış
//    olabilir ve ikisi de gerçektir.
// 2. **ÜRETİCİ DETERMİNİSTİKTİR.** İkinci koşuda bayt bayt aynı dosya çıkar:
//    sıra kaynak satır sırasıdır, sayılar sabit basamakla yazılır.
// 3. **TEDARİKÇİ UYDURULMAZ, EŞLEŞTİRİLİR.** Dosyadaki 13 ad `match_key`
//    (`trKatla`) ile deftere sorulur; karşılığı olmayan TEK ad (AĞIR
//    HADDECİLİK) `WHERE NOT EXISTS` ile açılır — `ON CONFLICT DO NOTHING`
//    kullanılmaz, çünkü çakışan bir aday bile TD sayacını tüketir.
//    Kısaltılmış yazımlar için ELLE EŞLEME defteri vardır (aşağıda): "KARÇEL"
//    defterde "KARÇEL KARDEMİR ÇELİK"tir ve otomatik bir benzerlik ölçüsü bunu
//    ya kaçırır ya da yanlış firmaya bağlar.
// 4. **SAYILAR BİR SÖZLEŞMEDİR.** Üretici toplamları hesaplar ve migration'ın
//    başına yazar; ileride biri "bu rakam nereden geldi" derse cevabı orada.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const SOURCE_FILE = "Sac-Profil-Ray Satınalma Fiyatları ve İstatistik Eski Veri.xlsx";
const SHEET_NAME = "Ana Veri Girişi";
const OUTPUT_FILE = "20260815000006_import_raw_purchases.sql";
const IMPORT_SOURCE = "excel-raw-purchases-2026-08";

const EXPECTED_HEADERS = [
  "TARİH", "YIL", "TEDARİKÇİ", "KATEGORİ", "TANIM", "KALİTE",
  "KALINLIK", "EN", "BOY", "MİKTAR (KG)", "BİRİM FİYAT", "TOPLAM FİYAT",
  "USD KUR", "EUR KUR", "BİRİM FİYAT", "TOPLAM FİYAT", "BİRİM FİYAT", "TOPLAM FİYAT",
];

/**
 * DOSYADAKİ AD → DEFTERDEKİ AD.
 *
 * Yalnız FARKLI olanlar yazılır; birebir aynı olanlar (CECELİ DEMİR, EAG
 * DEMİR…) `match_key` ile kendiliğinden bulunur. Eşleme 15.08.2026'da canlı
 * defterle tek tek doğrulandı.
 */
const TEDARIKCI_ESLEME = {
  "KARÇEL": "KARÇEL KARDEMİR ÇELİK",
  "RZK ÇELİK": "ARCELORMİTTAL RZK ÇELİK",
  "TAŞ ÇELİK": "TAŞÇELİK DEMİR ÇELİK",
  "FZK METAL": "FZK TEKNİK METAL",
  "ANKARA PROFİL BORU": "ANKARA PROFİL BORU TİCARET VE SANAYİ LTD.ŞTİ.",
};

/** Kategori ASCII'ye iner (`check` kısıtı ve kod tarafı ASCII konuşur). */
const KATEGORI_ESLEME = { "PROFİL": "PROFIL", "SAC": "SAC", "RAY": "RAY" };

const KATLAMA = {
  i: "I", ı: "I", İ: "I", I: "I",
  ç: "C", Ç: "C", ğ: "G", Ğ: "G",
  ö: "O", Ö: "O", ş: "S", Ş: "S", ü: "U", Ü: "U",
};

/** `src/lib/drawings/tr-text.ts:trKatla` ile BİREBİR aynı — ayrışırsa eşleşme kayar. */
function trKatla(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/[iıİIçÇğĞöÖşŞüÜ]/g, (h) => KATLAMA[h] ?? h)
    .toUpperCase();
}

function trBuyuk(text) {
  return String(text ?? "").toLocaleUpperCase("tr-TR");
}

function q(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function num(value, basamak) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "null";
  return Number(value).toFixed(basamak);
}

function hucre(cell) {
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return null;
  }
  return v;
}

function metin(cell) {
  const v = hucre(cell);
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function sayi(cell) {
  const v = hucre(cell);
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function gun(cell) {
  const v = hucre(cell);
  if (v instanceof Date) {
    // Excel tarihleri UTC gece yarısında gelir; yerel saate çevirmek günü bir
    // gün geriye kaydırabilir (`bugunIstanbul` dersinin aynısı).
    return v.toISOString().slice(0, 10);
  }
  return null;
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const sourcePath = path.resolve(
    process.argv[2] ?? path.join(repoRoot, "..", SOURCE_FILE)
  );
  const outputPath = path.resolve(
    process.argv[3] ?? path.join(repoRoot, "supabase", "migrations", OUTPUT_FILE)
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(sourcePath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sayfa bulunamadı: ${SHEET_NAME}`);

  // BAŞLIKLAR DOĞRULANIR: kaynak dosya değişirse sütunlar kayar ve sessizce
  // yanlış sayı aktarılır — o hata ancak aylar sonra fark edilir.
  const baslik = ws.getRow(1);
  for (let c = 1; c <= EXPECTED_HEADERS.length; c++) {
    const bulunan = metin(baslik.getCell(c));
    if (bulunan !== EXPECTED_HEADERS[c - 1]) {
      throw new Error(
        `Sütun ${c} başlığı beklenenden farklı: "${bulunan}" ≠ "${EXPECTED_HEADERS[c - 1]}"`
      );
    }
  }

  const satirlar = [];
  const atlanan = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const tanim = trBuyuk(metin(row.getCell(5)));
    const tedarikci = trBuyuk(metin(row.getCell(3)));
    const kg = sayi(row.getCell(10));
    if (!tanim && !tedarikci && !kg) continue;

    const tarih = gun(row.getCell(1));
    const kategoriHam = metin(row.getCell(4));
    const kategori = KATEGORI_ESLEME[kategoriHam] ?? trKatla(kategoriHam);
    const birimFiyat = sayi(row.getCell(11));
    const toplam = sayi(row.getCell(12));

    // EKSİK SATIR SESSİZCE DÜŞMEZ, SAYILIR (md. 18/3): kaç satırın neden
    // aktarılmadığı migration'ın başında yazar.
    if (!tarih || !tanim || !kg || kg <= 0 || birimFiyat == null) {
      atlanan.push({ r, tanim, sebep: !tarih ? "tarihsiz" : !tanim ? "tanımsız" : !kg ? "miktarsız" : "fiyatsız" });
      continue;
    }

    satirlar.push({
      r,
      purchased_at: tarih,
      supplier: TEDARIKCI_ESLEME[tedarikci] ? trBuyuk(TEDARIKCI_ESLEME[tedarikci]) : tedarikci,
      supplier_key: trKatla(TEDARIKCI_ESLEME[tedarikci] ?? tedarikci),
      category: kategori,
      description: tanim,
      match_key: trKatla(tanim),
      quality: trBuyuk(metin(row.getCell(6))),
      thickness_mm: sayi(row.getCell(7)),
      width_mm: sayi(row.getCell(8)),
      length_mm: sayi(row.getCell(9)),
      qty_kg: kg,
      unit_price_try: birimFiyat,
      total_try: toplam ?? kg * birimFiyat,
      usd_rate: sayi(row.getCell(13)),
      eur_rate: sayi(row.getCell(14)),
      ham: {
        tarih: metin(row.getCell(1)) || tarih,
        yil: sayi(row.getCell(2)),
        tedarikci,
        kategori: kategoriHam,
        tanim,
        kalite: metin(row.getCell(6)),
        birimFiyatUsd: sayi(row.getCell(15)),
        toplamUsd: sayi(row.getCell(16)),
        birimFiyatEur: sayi(row.getCell(17)),
        toplamEur: sayi(row.getCell(18)),
      },
    });
  }

  // ————————————————————————————————— sözleşme sayıları
  const toplamKg = satirlar.reduce((t, s) => t + s.qty_kg, 0);
  const toplamTry = satirlar.reduce((t, s) => t + s.total_try, 0);
  const toplamEur = satirlar.reduce(
    (t, s) => t + (s.eur_rate ? s.total_try / s.eur_rate : 0),
    0
  );
  const toplamUsd = satirlar.reduce(
    (t, s) => t + (s.usd_rate ? s.total_try / s.usd_rate : 0),
    0
  );
  const tedarikciler = [...new Set(satirlar.map((s) => s.supplier))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
  const kategoriler = [...new Set(satirlar.map((s) => s.category))].sort();
  const tarihler = satirlar.map((s) => s.purchased_at).sort();

  // DÖVİZ TÜRETMESİ DOSYAYLA KARŞILAŞTIRILIR: generated sütunlar dosyadaki
  // hazır değerleri yeniden üretmeli, yoksa bölme yönü ters demektir.
  let sapan = 0;
  for (const s of satirlar) {
    if (!s.eur_rate || s.ham.birimFiyatEur == null) continue;
    const bizim = s.unit_price_try / s.eur_rate;
    if (Math.abs(bizim - s.ham.birimFiyatEur) > 1e-6) sapan++;
  }

  const dizeler = satirlar.map((s) => {
    const yuk = JSON.stringify(s.ham);
    return (
      `  (${q(s.purchased_at)}::date, ${q(s.supplier)}, ${q(s.supplier_key)}, ` +
      `${q(s.category)}, ${q(s.description)}, ${q(s.match_key)}, ${q(s.quality)}, ` +
      `${num(s.thickness_mm, 2)}, ${num(s.width_mm, 2)}, ${num(s.length_mm, 2)}, ` +
      `${num(s.qty_kg, 3)}, ${num(s.unit_price_try, 6)}, ${num(s.total_try, 4)}, ` +
      `${num(s.usd_rate, 6)}, ${num(s.eur_rate, 6)}, ` +
      `${q(`${IMPORT_SOURCE}:${s.r}`)}, ${q(yuk)}::jsonb)`
    );
  });

  const yeniFirmalar = tedarikciler.map((ad) => `    (${q(ad)}, ${q(trKatla(ad))})`);

  const sql = `-- SAC · PROFİL · RAY ALIM GEÇMİŞİ — DEVRALINAN VERİ.
--
-- ÜRETİLMİŞTİR: \`node scripts/generate-raw-purchase-import.mjs\`.
-- ELLE DÜZENLENMEZ; kaynak dosya değişirse betik yeniden koşturulur.
--
-- Kaynak: ${SOURCE_FILE} → "${SHEET_NAME}"
--
-- ═══════════════════════════════════════════ SAYILAR BİR SÖZLEŞMEDİR
--
--   satır          : ${satirlar.length}   (atlanan ${atlanan.length})
--   tarih aralığı  : ${tarihler[0]} → ${tarihler[tarihler.length - 1]}
--   tedarikçi      : ${tedarikciler.length}
--   kategori       : ${kategoriler.join(" · ")}
--   toplam miktar  : ${toplamKg.toFixed(2)} kg
--   toplam tutar   : ${toplamTry.toFixed(2)} ₺  ·  ${toplamUsd.toFixed(2)} $  ·  ${toplamEur.toFixed(2)} €
--
-- Döviz karşılıkları GENERATED sütundur (TL ÷ o günün kuru) ve dosyanın kendi
-- hazır sütunlarıyla satır satır karşılaştırıldı: ${sapan} sapma.
--
-- İDEMPOTENT: her satır \`source_ref\` ile tektir, betik ikinci kez
-- koşturulduğunda satır ÇOĞALMAZ.

-- ═══════════════════════════════════════════ 1. TEDARİKÇİLER
--
-- Dosyadaki adlar deftere \`match_key\` ile sorulur; karşılığı OLMAYAN açılır.
-- \`ON CONFLICT DO NOTHING\` KULLANILMAZ: çakışan bir aday bile TD sayacını
-- tüketir ve defter birkaç haftada boşluklarla dolardı.
with incoming_supplier (name, match_key) as (
  values
${yeniFirmalar.join(",\n")}
)
insert into public.purchase_suppliers (name, match_key)
select incoming.name, incoming.match_key
from incoming_supplier incoming
where not exists (
  select 1 from public.purchase_suppliers existing
  where existing.match_key = incoming.match_key
);

-- ═══════════════════════════════════════════ 2. ALIM SATIRLARI
with incoming (
  purchased_at, supplier, supplier_key, category, description, match_key, quality,
  thickness_mm, width_mm, length_mm, qty_kg, unit_price_try, total_try,
  usd_rate, eur_rate, source_ref, legacy_payload
) as (
  values
${dizeler.join(",\n")}
)
insert into public.purchase_raw_purchases (
  purchased_at, supplier, supplier_id, category, description, match_key, quality,
  thickness_mm, width_mm, length_mm, qty_kg, unit_price_try, total_try,
  usd_rate, eur_rate, source_ref, legacy_payload
)
select
  incoming.purchased_at,
  incoming.supplier,
  s.id,
  incoming.category,
  incoming.description,
  incoming.match_key,
  incoming.quality,
  incoming.thickness_mm,
  incoming.width_mm,
  incoming.length_mm,
  incoming.qty_kg,
  incoming.unit_price_try,
  incoming.total_try,
  incoming.usd_rate,
  incoming.eur_rate,
  incoming.source_ref,
  incoming.legacy_payload
from incoming
left join public.purchase_suppliers s on s.match_key = incoming.supplier_key
where not exists (
  select 1 from public.purchase_raw_purchases existing
  where existing.source_ref = incoming.source_ref
);
`;

  await fs.writeFile(outputPath, sql, "utf8");

  console.log(`Aktarılacak satır : ${satirlar.length}`);
  console.log(`Atlanan satır     : ${atlanan.length}`);
  for (const a of atlanan.slice(0, 10)) console.log(`   satır ${a.r}: ${a.sebep} — ${a.tanim}`);
  console.log(`Tedarikçi         : ${tedarikciler.length} → ${tedarikciler.join(", ")}`);
  console.log(`Kategori          : ${kategoriler.join(", ")}`);
  console.log(`Toplam            : ${toplamKg.toFixed(2)} kg · ${toplamTry.toFixed(2)} ₺ · ${toplamEur.toFixed(2)} €`);
  console.log(`Döviz sapması     : ${sapan}`);
  console.log(`Yazıldı           : ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
