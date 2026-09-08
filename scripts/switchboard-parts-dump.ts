// MALZEME SATIRI DÖKÜMÜNÜ OKUMA — betiklerin ortak geçidi.
//
// ═══════════════════════════════════════════ NEDEN ORTAK BİR OKUYUCU
//
// Pano betikleri (`switchboard-dimension-gap`, `switchboard-dimension-plan`,
// `seed-device-models`) `electrical_parts` satırlarının ham SQL dökümünü
// okuyor. Uygulama o satırları OKURKEN temizliyor (`cleanElectricalPart`,
// ELEKTRIK-14) — ham dökümü olduğu gibi kullanan bir betik uygulamanın hiç
// görmediği bir veriyle çalışır.
//
// Ölçüldü (0026-01, iki satır): EPLAN antedi tip numarasına, tedarikçiye ve
// malzeme koduna sızmış durumda —
//   type_no  = "RXG22BD İMZA 100T TAVAN VİNCİ İNFEED OTOMASYON Parts list : …"
//   supplier = "SE ASTOR"
// Uygulama bunu `RXG22BD` + `SE` olarak okur ve kimliği
// `SCHNEIDERELECTRIC|RXG22BD` çıkar. Ham dökümü temizlemeyen bir betik ise
// `SEASTOR|RXG22BDIMZA100TTAVAN…` gibi ÇALIŞMA ANINDA HİÇ ARANMAYAN bir
// anahtar üretir; ölçü defterine yazılan böyle bir satır sessizce ölü kalırdı.

import { readFileSync } from "node:fs";
import { cleanElectricalPart } from "@/lib/electrical/parts-list";
import type { ElectricalPart } from "@/lib/electrical/types";

export interface PartsDump {
  parts: ElectricalPart[];
  /** Dökümdeki proje doküman numaraları (varsa). */
  projects: string[];
  /** Antet bulaşması yüzünden temizlenen satır sayısı — görünür kalmalı. */
  cleaned: number;
  /** Okuma sınırında tamamen düşürülen satır (`REVISION` gibi). */
  dropped: number;
}

function satirdan(r: Record<string, unknown>): ElectricalPart {
  return {
    deviceTag: String(r.device_tag ?? ""),
    installation: String(r.installation ?? ""),
    location: String(r.location ?? ""),
    device: String(r.device ?? ""),
    // NULL SIFIR DEĞİLDİR: okunamayan adet bilinmiyordur (değişmez md. 4).
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
    designation: String(r.designation ?? ""),
    typeNo: String(r.type_no ?? ""),
    supplier: String(r.supplier ?? ""),
    partNo: String(r.part_no ?? ""),
    page: Number(r.page ?? 0),
  };
}

/**
 * Ham SQL dökümünü UYGULAMANIN GÖRDÜĞÜ hâle getirir.
 *
 * `is` verilirse yalnız o doküman numarasıyla başlayan satırlar okunur. Döküm
 * bütün projeleri birden taşıyor ve iki işi birlikte çözmek anlamsız bir
 * dizilim üretir — 0019'un yirmi iki panosu ile 0026'nın dördü aynı elektrik
 * odasında değil.
 */
export function readPartsDump(yol: string, is?: string): PartsDump {
  const tumu = JSON.parse(readFileSync(yol, "utf8")) as Record<string, unknown>[];
  const ham = is ? tumu.filter((r) => String(r.doc_no ?? "").startsWith(is)) : tumu;
  const parts: ElectricalPart[] = [];
  let cleaned = 0;
  let dropped = 0;

  for (const r of ham) {
    const kaba = satirdan(r);
    const temiz = cleanElectricalPart(kaba);
    if (!temiz) {
      dropped++;
      continue;
    }
    if (
      temiz.typeNo !== kaba.typeNo ||
      temiz.supplier !== kaba.supplier ||
      temiz.partNo !== kaba.partNo ||
      temiz.designation !== kaba.designation
    ) {
      cleaned++;
    }
    parts.push(temiz);
  }

  const projects = [...new Set(ham.map((r) => String(r.doc_no ?? "")).filter(Boolean))];
  return { parts, projects, cleaned, dropped };
}
