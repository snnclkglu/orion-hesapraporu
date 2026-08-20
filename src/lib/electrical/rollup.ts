// MALZEME LİSTESİNİN TOPLANMIŞ HÂLLERİ — saf.
//
// Ham liste AYGIT BAŞINADIR (`=185T+LVD01-F31` bir satır, `-F32` başka bir
// satır) ve öyle olmalıdır: elektrikçi panoda hangi klemensin hangi şalter
// olduğunu oradan okur. Ama SATIN ALMA ve EL KİTABININ YEDEK PARÇA EKİ aynı
// ürünün kaç adet geçtiğini sorar. İki soru, iki görünüm, TEK KAYNAK.
//
// ADET TOPLAMI `null` OLABİLİR ve bu bir sıfır değildir: hiçbir satırın adeti
// okunamadıysa toplam BİLİNMİYORDUR (değişmez md. 4). Bir kısmı okunduysa
// okunanların toplamı verilir — eksik bir toplam, hiç toplam olmamasından
// iyidir ve satır sayısı (`lines`) yanında durduğu için eksiklik görünür.

import { electricalCategory } from "./category";
import { cleanElectricalPart } from "./parts-list";
import type { ElectricalMaterialRow, ElectricalPart, ElectricalRollupRow } from "./types";

/** Adetleri toplar; hiçbiri okunamadıysa `null`. */
function topla(parts: readonly ElectricalPart[]): number | null {
  let toplam = 0;
  let okundu = false;
  for (const ham of parts) {
    const p = cleanElectricalPart(ham);
    if (!p) continue;
    if (p.qty === null) continue;
    toplam += p.qty;
    okundu = true;
  }
  return okundu ? toplam : null;
}

/** Panel (`location`) ya da tedarikçi (`supplier`) dökümü. */
export function rollupBy(
  parts: readonly ElectricalPart[],
  alan: "location" | "supplier" | "installation"
): ElectricalRollupRow[] {
  const gruplar = new Map<string, ElectricalPart[]>();
  for (const ham of parts) {
    const p = cleanElectricalPart(ham);
    if (!p) continue;
    const k = (p[alan] ?? "").trim();
    const liste = gruplar.get(k);
    if (liste) liste.push(p);
    else gruplar.set(k, [p]);
  }
  const out: ElectricalRollupRow[] = [];
  for (const [k, liste] of gruplar) {
    out.push({
      key: k,
      // Boş anahtar bir ETİKET DEĞİLDİR; sunum katmanı "—" basar, veri boş kalır.
      label: alan === "location" && k ? `+${k}` : k,
      lines: liste.length,
      qty: topla(liste),
    });
  }
  // Sıra ADETTEN büyükten küçüğe; eşitlikte ada göre. Panel dökümünde "en çok
  // malzeme hangi panoda" ilk okunan sorudur.
  return out.sort((a, b) => (b.qty ?? -1) - (a.qty ?? -1) || a.key.localeCompare(b.key, "tr"));
}

/**
 * Aynı ürünün bütün satırlarını tek satıra indirir — sipariş edilebilir liste.
 *
 * Anahtar `partNo`dur (projenin kendi malzeme kodu); yoksa `supplier|typeNo`ya
 * düşer. İkisi de yoksa TANIM anahtar olur. Dört ürün alanı da boşsa kayıt
 * aygıt görünümünde kalır ama sipariş edilebilir bir malzeme sayılmaz.
 */
export function materialRows(parts: readonly ElectricalPart[]): ElectricalMaterialRow[] {
  const gruplar = new Map<string, ElectricalPart[]>();
  const sira: string[] = [];
  for (const ham of parts) {
    const p = cleanElectricalPart(ham);
    if (!p) continue;
    // Aygıt listesinde ürün atanmamış bir fonksiyon bulunabilir (EPLAN'da
    // qty=0 ve dört ürün alanı boş). Aygıt görünümünde kalır; sipariş
    // edilebilir MALZEME listesinde boş bir satır değildir.
    if (![p.designation, p.typeNo, p.supplier, p.partNo].some((v) => v.trim())) continue;
    const k =
      p.partNo.trim() ||
      (p.typeNo.trim() ? `${p.supplier.trim()}|${p.typeNo.trim()}` : "") ||
      p.designation.trim();
    if (!gruplar.has(k)) {
      gruplar.set(k, []);
      sira.push(k);
    }
    gruplar.get(k)!.push(p);
  }
  // Sıra BELGEDEKİ ilk geçiş sırasıdır: liste elektrik projesinin kendi
  // düzenini izler, alfabetik bir yeniden dizim okuyanı belgeden koparırdı.
  return sira.map((k) => {
    const liste = gruplar.get(k)!;
    const ilk = liste[0];
    const konumlar: string[] = [];
    for (const p of liste) {
      const c = p.location.trim();
      if (c && !konumlar.includes(c)) konumlar.push(c);
    }
    return {
      key: k,
      partNo: ilk.partNo,
      typeNo: ilk.typeNo,
      supplier: ilk.supplier,
      designation: ilk.designation,
      category: electricalCategory(ilk),
      qty: topla(liste),
      locations: konumlar,
    };
  });
}
