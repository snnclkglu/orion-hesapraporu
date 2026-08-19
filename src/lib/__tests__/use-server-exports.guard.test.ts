// `"use server"` DOSYASININ HER DIŞA AKTARIMI ASYNC FONKSİYON OLMAK ZORUNDADIR.
//
// 19.08.2026'da ÜRETİM DERLEMESİ bu yüzden kırıldı: ekipman panelinin server
// action dosyasına bir sabit (`export const DRAWING_NOTE_KEY = "genel"`)
// konmuştu. Next bunu reddediyor ve dosyayı "hiç dışa aktarımı yok" hâline
// düşürüyor; hata mesajı da sabiti değil, YANINDAKİ fonksiyonu bulamadığını
// söylüyor ("Export saveEquipmentNote doesn't exist in target module"), yani
// sebebin adı hiç geçmiyor.
//
// NE `tsc --noEmit` NE DE VİTEST BUNU GÖRÜR — kural Next'in kendi
// derleyicisindedir ve yalnız `next build` sırasında ortaya çıkar. Bu yüzden
// koruma KAYNAK DOSYAYI OKUR (AGENTS md. 8 deseni): bir kural derleyicide
// yaşıyorsa, onu depoda bir test tekrar etmelidir.
//
// TİP dışa aktarımları serbesttir: derlemede silinirler.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function tsDosyalari(dizin: string): string[] {
  const out: string[] = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) {
      if (ad === "node_modules" || ad === "__tests__") continue;
      out.push(...tsDosyalari(yol));
    } else if (/\.tsx?$/.test(ad)) {
      out.push(yol);
    }
  }
  return out;
}

/** Dosyanın ilk anlamlı satırı `"use server"` mü (yorumlar atlanır). */
function serverAction(metin: string): boolean {
  for (const satir of metin.split(/\r?\n/)) {
    const t = satir.trim();
    if (t === "" || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue;
    return /^["']use server["'];?$/.test(t);
  }
  return false;
}

/**
 * Satır bir DEĞER dışa aktarımı mı — ve async fonksiyon DEĞİL mi?
 *
 * Kabul edilen tek biçim `export async function …`. `export type`/`export
 * interface` derlemede silinir; `export {}` yeniden dışa aktarımı da aynı
 * kurala tabidir ve burada yakalanır.
 */
const IZINLI = /^export\s+async\s+function\s/;
const TIP = /^export\s+(type|interface)\s/;
const DISA_AKTARIM = /^export\s/;

describe('"use server" dosyalarının dışa aktarımları', () => {
  const dosyalar = tsDosyalari(SRC).filter((y) => serverAction(readFileSync(y, "utf8")));

  it("kapsam boş değil (koruma gerçekten bir şey tarıyor)", () => {
    // Depoda onlarca server action dosyası var; sıfır bulmak, tarayıcının
    // bozulduğu anlamına gelir.
    expect(dosyalar.length).toBeGreaterThan(5);
  });

  it("yalnız async fonksiyon ve tip dışa aktarılır", () => {
    const ihlaller: string[] = [];
    for (const yol of dosyalar) {
      const satirlar = readFileSync(yol, "utf8").split(/\r?\n/);
      satirlar.forEach((satir, i) => {
        const t = satir.trim();
        if (!DISA_AKTARIM.test(t)) return;
        if (IZINLI.test(t) || TIP.test(t)) return;
        ihlaller.push(`${yol.slice(SRC.length + 1)}:${i + 1} — ${t}`);
      });
    }
    expect(ihlaller, ihlaller.join("\n")).toEqual([]);
  });
});
