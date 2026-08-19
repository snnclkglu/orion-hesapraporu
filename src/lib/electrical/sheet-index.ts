// SAYFA DİZİNİ — elektrik projesinin içindekiler tablosu.
//
// KAYNAK PDF'İN YER İMİ AĞACIDIR, metni değil. EPLAN dışa aktarımı dört kök
// üretir: "Page tree" (yapı ağacı), "Page list" (SAYFA SIRASIYLA düz liste),
// "Device list" ve "Device tree". Dizin için doğru olan "Page list"tir:
// tam sayfa adedince satır taşır ve her satır bir sayfaya birebir düşer.
//
// BAŞLIK BİÇİMİ: `=185T+LVD01/1 Ana Dağıtım-1`
//   `=` tesis · `+` konum · `/` sonrası pafta no + boşluk + sayfa adı
// Bir kısmı eksik olabilir (kapak sayfasında konum yoktur) ve bu bir hata
// değildir — eksik alan BOŞ kalır (değişmez md. 4).
//
// NEDEN METİNDEN OKUMUYORUZ: sayfa adı antette de yazıyor ama orada bir
// IZGARANIN içindedir ve "Location" ile "Project name" hücreleri aynı taban
// çizgisini paylaşır (aynı ders `drawings/titleblock.ts`te ölçülmüştü).
// Yer imi ise dizinin KENDİSİDİR; çizim bürosu onu zaten doğru yazmış.

import type { ElectricalSheet } from "./types";

/** "Page list" kökünün Türkçe/İngilizce/Almanca yazımları. */
const SAYFA_LISTESI_ADLARI = ["page list", "sayfa listesi", "seitenliste"];

export function isPageListRoot(title: string): boolean {
  const t = title.trim().toLocaleLowerCase("tr-TR");
  return SAYFA_LISTESI_ADLARI.includes(t);
}

/**
 * Tek bir yer imi başlığını sayfa dizini satırına çevirir.
 *
 * @param page 1 tabanlı sayfa numarası — ÇAĞIRAN çözer (yer imi hedefinden ya
 *   da listedeki sıradan); başlık onu taşımaz.
 */
export function parseSheetTitle(title: string, page: number): ElectricalSheet {
  const ham = (title ?? "").trim();
  const out: ElectricalSheet = { page, installation: "", location: "", sheetNo: "", title: "" };
  if (!ham) return out;

  // `/` kimlik ile sayfa adını ayırır. Sayfa adının kendisinde de `/` olabilir
  // (`Ana Dağıtım/230VAC Kumanda Besleme`), o yüzden İLK `/` alınır.
  const kesme = ham.indexOf("/");
  const kimlik = kesme < 0 ? "" : ham.slice(0, kesme);
  const kalan = (kesme < 0 ? ham : ham.slice(kesme + 1)).trim();

  for (const m of kimlik.matchAll(/([=+])([^=+]*)/g)) {
    const deger = m[2].trim();
    if (m[1] === "=") out.installation ||= deger;
    else out.location ||= deger;
  }

  // Pafta no ile sayfa adı bir BOŞLUKLA ayrılır: `12 Ana Besleme/ CU320 …`.
  // Numara `0` da olabilir (kapak) ve `1.2` gibi noktalı da — bu yüzden sayı
  // değil METİN olarak saklanır ve şekli dayatılmaz.
  const m = /^([0-9][0-9.]*)\s+(.*)$/.exec(kalan);
  if (m) {
    out.sheetNo = m[1];
    out.title = m[2].trim();
  } else {
    out.title = kalan;
  }
  return out;
}

/**
 * Dizini panolara göre öbekler — el kitabının elektrik eki bu düzende basılır.
 *
 * Öbek sırası BELGEDEKİ İLK GEÇİŞ sırasıdır; alfabetik dizim okuyanı projeden
 * koparırdı (`materialRows` ile aynı gerekçe).
 */
export function groupSheetsByLocation(
  sheets: readonly ElectricalSheet[]
): { location: string; sheets: ElectricalSheet[] }[] {
  const out: { location: string; sheets: ElectricalSheet[] }[] = [];
  for (const s of sheets) {
    const son = out[out.length - 1];
    if (son && son.location === s.location) son.sheets.push(s);
    else out.push({ location: s.location, sheets: [s] });
  }
  return out;
}
