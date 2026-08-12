// Satın alma talebi PDF'i — duman testi.
//
// react-pdf'te YATAY sayfa, Türkçe karakter ve on sütunlu tablo bir arada ilk
// kez burada kullanılıyor; üçünün birlikte çalıştığı ancak belge gerçekten
// üretilip GERİ OKUNARAK doğrulanabilir. Betik iki ölçüde koşar: gerçekçi bir
// liste (40 kalem) ve BÜYÜME sınaması (400 kalem) — başlık satırı her sayfada
// tekrar ediyor mu, kategori bandı sayfa dibinde yalnız kalıyor mu.
//
//   npx tsx scripts/test-purchase-request.ts
//
// Çıktı `.smoke/` altına yazılır (gitignore'lu).

import { mkdirSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import {
  renderPurchaseRequestPdf,
  type PurchaseRequestRow,
} from "../src/lib/pdf/purchase-request";

const KATEGORILER = [
  "Bağlantı Elemanı",
  "Rulman",
  "Redüktör",
  "Keçe ve Sızdırmazlık",
  "Halat ve Zincir",
];

/** Gerçekçi satırlar — canlı havuzdaki tanımların birebir kalıbı. */
function satirlar(n: number): PurchaseRequestRow[] {
  const ornekler = [
    { t: "CIVATA M16X120 DIN 931 GALVANİZLİ", m: "8.8", k: "Bağlantı Elemanı" },
    { t: "SOMUN M16 DIN 934 GALVANİZLİ", m: "8", k: "Bağlantı Elemanı" },
    { t: "RULMAN 6205-Z", m: "", k: "Rulman" },
    { t: "RULMAN 22214", m: "", k: "Rulman" },
    { t: "KEÇE Ø50XØ62X7", m: "", k: "Keçe ve Sızdırmazlık" },
    { t: "YILMAZ REDÜKTÖR DR373-3E90L-4D - İ57,79 - MOTOR 1,5KW", m: "", k: "Redüktör" },
    { t: "ÇELİKHALAT SAPAN Ø36 L=3800", m: "", k: "Halat ve Zincir" },
  ];
  return Array.from({ length: n }, (_, i) => {
    const o = ornekler[i % ornekler.length];
    return {
      sinif: o.k,
      tanim: `${o.t}${i >= ornekler.length ? ` (${i})` : ""}`,
      isNolari: i % 3 === 0 ? ["0057-00", "0053-01"] : ["0057-00"],
      parcaKodlari: i % 4 === 0 ? [`0057-00-0${700 + (i % 9)}-0${i % 9}`] : [],
      kullanildigiYer: i % 5 === 0 ? "1 TON KANCA BLOĞU" : "",
      malzeme: o.m,
      adet: (i % 7) * 12 + 4,
      birim: "Adet",
      toplamAgirlikKg: i % 3 === 0 ? (i % 11) * 3.5 : null,
      not: i % 9 === 0 ? "%100 GARANTİLİ" : "",
    };
  }).sort((a, b) => KATEGORILER.indexOf(a.sinif) - KATEGORILER.indexOf(b.sinif));
}

async function uret(ad: string, n: number) {
  const rows = satirlar(n);
  const pdf = await renderPurchaseRequestPdf({
    rows,
    meta: {
      docCode: "ORC-SA-2026-08-12",
      generatedAt: "12.08.2026",
      preparedBy: "SİNAN ÇOLAKOĞLU",
      filterText: "kategori: Bağlantı Elemanı, Rulman · durum: Bekliyor",
      scopeText: `Süzgeçli liste — ${n} kalem`,
    },
    company: {
      company: "ORION CRANES",
      address: "İSTANBUL",
      phone: "+90 212 000 00 00",
      email: "info@orioncranes.com",
      web: "orioncranes.com",
    },
  });

  mkdirSync(".smoke", { recursive: true });
  const yol = `.smoke/${ad}.pdf`;
  writeFileSync(yol, pdf);

  // GERİ OKUNUR: dosyanın yazılması belgenin DOĞRU olduğunu göstermez.
  // Türkçe karakterlerin gömülü fontla çıktığı ancak metni çözerek anlaşılır.
  const belge = await getDocumentProxy(new Uint8Array(pdf));
  const { text, totalPages } = await extractText(belge, { mergePages: true });

  const eksik = ["SATIN ALMA TALEBİ", "Kullanıldığı Yer", "GALVANİZLİ", "Kalite"].filter(
    (s) => !text.includes(s)
  );
  console.log(
    `${yol.padEnd(34)} ${String(pdf.length).padStart(8)} bayt · ${totalPages} sayfa · ` +
      (eksik.length === 0 ? "metin TAM" : `EKSİK: ${eksik.join(", ")}`)
  );
  if (eksik.length > 0) process.exitCode = 1;

  // FİYAT SÜTUNU OLMAMALI: belge tedarikçiye teklif istemek için gider ve
  // elimizdeki fiyatı göstermek pazarlığı baştan kaybettirirdi.
  if (/Birim Fiyat|Teklif Fiyat|€/.test(text)) {
    console.error("  HATA: belgede fiyat izi var — talep belgesi fiyatsız olmalı.");
    process.exitCode = 1;
  }
}

async function main() {
  await uret("satin-alma-talebi-40", 40);
  // BÜYÜME SINAMASI: 400 kalem çok sayfaya yayılır; başlık satırı `fixed`
  // olduğu için her sayfada tekrar etmeli.
  await uret("satin-alma-talebi-400", 400);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
