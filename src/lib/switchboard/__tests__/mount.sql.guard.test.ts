// MONTAJ TİPİ ÜÇ YERDE YAŞIYOR — ayrışmayı bu test engeller (değişmez md. 8).
//
// `MountType` birliği TypeScript'te, `mount_type` kısıtı SQL'de, `z.enum`
// listeleri sunucu eylemlerinde. Bir gün birine yeni bir üye eklenip ötekine
// eklenmezse hata SESSİZDİR: ekran cihazı yeni tipiyle gösterir, kullanıcı
// "Kaydet" der ve veritabanı kısıtı düşer — ya da daha kötüsü, kısıt geniş
// kalır ve veritabanına TypeScript'in tanımadığı bir değer yazılır.
//
// Test KAYNAK DOSYAYI OKUR (`terms.test.ts` deseni): karşılaştırılan şey iki
// ayrı yerdeki metnin kendisidir, birinden türetilmiş bir kopya değil.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOUNT_LABEL } from "../mount";

/** Depo kökü — çalışma dizininde boşluk var, `process.cwd()` ile alınır. */
const KOK = process.cwd();

/**
 * Kısıtı EN SON genişleten migration'ın metni.
 *
 * Ada göre aranmaz: montaj tipi bir kez daha genişlerse (09.09.2026'da `zemin`
 * eklendi) ada bağlı bir arama ESKİ dosyayı okur ve test yeni tipi eksik
 * sanarak düşer. Damga sırası en yeni olan, kısıtı yazan son dosyadır.
 */
function migrationMetni(): string {
  const dizin = join(KOK, "supabase", "migrations");
  const dosyalar = readdirSync(dizin)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  const dosya = dosyalar.find((f) =>
    readFileSync(join(dizin, f), "utf8").includes("_mount_type_check")
  );
  expect(dosya, "montaj tipi migration'ı bulunamadı").toBeTruthy();
  return readFileSync(join(dizin, dosya as string), "utf8");
}

/** `mount_type in ('a', 'b', …)` listesini SQL metninden çıkarır. */
function sqlListesi(metin: string): string[][] {
  const cikti: string[][] = [];
  const kalip = /mount_type in \(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = kalip.exec(metin)) !== null) {
    cikti.push(m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")));
  }
  return cikti;
}

describe("montaj tipi TS ile SQL arasında ayrışmaz", () => {
  const tsTipleri = Object.keys(MOUNT_LABEL).sort();

  it("migration İKİ tabloyu birden genişletir", () => {
    const listeler = sqlListesi(migrationMetni());
    expect(listeler).toHaveLength(2);
  });

  it("SQL listesi `MountType` birliğiyle AYNIDIR", () => {
    for (const liste of sqlListesi(migrationMetni())) {
      expect([...liste].sort()).toEqual(tsTipleri);
    }
  });

  it("sunucu eylemlerindeki Zod listeleri de aynıdır", () => {
    const metin = readFileSync(
      join(KOK, "src", "app", "(app)", "projects", "[id]", "pano", "actions.ts"),
      "utf8"
    );
    const kalip = /z\.enum\(\[([^\]]*)\]\)/g;
    const bulunan: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = kalip.exec(metin)) !== null) {
      const uyeler = m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      // Yalnız montaj tipi listesi ilgilendiriyor; dosyada başka enum'lar da var.
      if (uyeler.includes("din")) bulunan.push(uyeler);
    }
    expect(bulunan.length).toBeGreaterThan(0);
    for (const liste of bulunan) expect([...liste].sort()).toEqual(tsTipleri);
  });

  it("veri katmanının kabul listesi de aynıdır", () => {
    const metin = readFileSync(join(KOK, "src", "lib", "switchboard-data.ts"), "utf8");
    const m = metin.match(/MOUNT_TIPLERI: MountType\[\] = \[([^\]]*)\]/);
    expect(m, "`MOUNT_TIPLERI` bulunamadı").toBeTruthy();
    const uyeler = (m as RegExpMatchArray)[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    expect([...uyeler].sort()).toEqual(tsTipleri);
  });

  it("tohum betiği de aynı listeyi kullanır", () => {
    const metin = readFileSync(join(KOK, "scripts", "seed-device-models.ts"), "utf8");
    const m = metin.match(/MOUNT_TIPLERI = \[([^\]]*)\]/);
    expect(m, "betikteki `MOUNT_TIPLERI` bulunamadı").toBeTruthy();
    const uyeler = (m as RegExpMatchArray)[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    expect([...uyeler].sort()).toEqual(tsTipleri);
  });
});
