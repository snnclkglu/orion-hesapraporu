// HAMMADDE ALIMLARI — sunucu tarafı okuma katmanı.
//
// İKİ DEFTER, TEK DİL. Analiz ekranı geçmişi devralınan çalışma dosyasından
// (`purchase_raw_purchases`), bugünü ise uygulamanın kendi sipariş
// satırlarından okur ve ikisini `AlimSatiri` ortak diline çevirir. Kaynak
// satırda DURUR: dışarıdan gelen bir dosya ile uygulamanın kendi kaydı aynı
// güvende değildir (fiyat arşivinin üç kaynağı ayrı gösterme kuralı, md. 21).
//
// SİPARİŞLER EKRANI AYNI OKUMAYI PAYLAŞIR: "hangi siparişler hammadde" sorusu
// iki yerde ayrı cevaplanırsa, analizdeki toplam ile listedeki toplam bir gün
// ayrışır (md. 16'nın dersi).

import type { SupabaseClient } from "@supabase/supabase-js";
import { tumSatirlar } from "../../drawings/data";
import { loadSiparisler, type Siparis } from "../data";
import {
  alimKategorisi,
  type AlimSatiri,
} from "@/lib/purchasing/hammadde/alim-analizi";

// ═══════════════════════════════════════════════ 1. DEVRALINAN ALIM GEÇMİŞİ

interface AlimKaydi {
  id: string;
  purchased_at: string;
  supplier: string;
  category: string;
  description: string;
  match_key: string;
  quality: string;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  qty_kg: number;
  unit_price_try: number;
  total_try: number;
  usd_rate: number | null;
  eur_rate: number | null;
  total_usd: number | null;
  total_eur: number | null;
  note: string;
}

const ALIM_ALANLARI =
  "id, purchased_at, supplier, category, description, match_key, quality, " +
  "thickness_mm, width_mm, length_mm, qty_kg, unit_price_try, total_try, " +
  "usd_rate, eur_rate, total_usd, total_eur, note";

/**
 * Devralınan alım satırları.
 *
 * TABLO OLMAYABİLİR (md. 21'in "sütun/tablo olmayabilir" kuralı): migration
 * uygulanmadan önce sorgu düşer ve ekran BOŞ ama ÇALIŞIR hâlde açılmalıdır —
 * canlı siparişler yine görünür.
 */
export async function loadAlimGecmisi(supabase: SupabaseClient): Promise<AlimSatiri[]> {
  try {
    const ham = await tumSatirlar<AlimKaydi>((bas, son) =>
      supabase
        .from("purchase_raw_purchases")
        .select(ALIM_ALANLARI)
        .order("purchased_at", { ascending: false })
        .order("id")
        .range(bas, son)
    );
    return ham.map((r) => ({
      id: r.id,
      kaynak: "devralinan" as const,
      gun: String(r.purchased_at).slice(0, 10),
      tedarikci: r.supplier ?? "",
      kategori: r.category ?? "DIGER",
      tanim: r.description ?? "",
      key: r.match_key ?? "",
      kalite: r.quality ?? "",
      kg: Number(r.qty_kg ?? 0),
      tutarTry: r.total_try == null ? null : Number(r.total_try),
      tutarUsd: r.total_usd == null ? null : Number(r.total_usd),
      tutarEur: r.total_eur == null ? null : Number(r.total_eur),
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════ 2. CANLI SİPARİŞLER

/** Hammadde siparişinin ekrana giden yüzü — satırlarıyla birlikte. */
export interface HammaddeSiparisi {
  id: string;
  orderNo: string;
  supplier: string;
  orderedAt: string;
  dueAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  currency: string;
  fxRate: number | null;
  note: string;
  /** KDV HARİÇ toplam, siparişin kendi para biriminde. */
  toplam: number;
  toplamEur: number | null;
  /** Yalnız KİLO birimli satırların toplamı; ötekiler burada sayılmaz. */
  toplamKg: number;
  /** Kilo dışı birimdeki satır sayısı — analize giremeyen kısım. */
  kiloDisiSatir: number;
  satirlar: {
    id: string;
    matchKey: string;
    tanim: string;
    kategori: string;
    itemNo: string;
    miktar: number;
    birim: string;
    birimFiyat: number | null;
    tutar: number | null;
    tutarEur: number | null;
    teslimAlinan: number;
    kalite: string;
    not: string;
  }[];
}

/**
 * HANGİ SİPARİŞ "HAMMADDE"DİR?
 *
 * Cevap SATIRIN ADINDAN okunur (`alimKategorisi`): en az bir satırı sac,
 * profil, ray, boru ya da dolu ailesindeyse sipariş bu ekranda görünür.
 *
 * Havuz anahtarlarıyla eşleştirme YAPILMAZ ve bu bilinçli: plaka siparişinin
 * adı havuzdakinden FARKLIDIR (`SAC 10 X 1500 X 6000 ST37` ↔ `SAC 10 MM
 * S355JR`, md. 24) ve anahtar eşleştirmesi tam da en önemli siparişleri
 * dışarıda bırakırdı.
 */
export function hammaddeSiparisleriniSuz(siparisler: readonly Siparis[]): HammaddeSiparisi[] {
  const cikti: HammaddeSiparisi[] = [];
  for (const s of siparisler) {
    const satirlar = s.satirlar
      .map((l) => {
        const kategori = alimKategorisi(l.sample);
        const tutar = l.unitPrice == null ? null : l.unitPrice * l.qty;
        return {
          id: l.id,
          matchKey: l.matchKey,
          tanim: l.sample,
          kategori,
          itemNo: l.itemNo,
          miktar: l.qty,
          birim: l.unit,
          birimFiyat: l.unitPrice,
          tutar,
          // AVRO KARŞILIĞI SATIRIN KENDİ KURUNDAN: sipariş başlığındaki
          // `fx_rate` "1 avro kaç birim eder"dir (md. 21).
          tutarEur: tutar != null && s.fxRate && s.fxRate > 0 ? tutar / s.fxRate : null,
          teslimAlinan: l.receivedQty,
          kalite: l.quality,
          not: l.note,
        };
      })
      .filter((l) => l.kategori !== "DIGER");

    if (satirlar.length === 0) continue;

    const kiloluk = satirlar.filter((l) => KILO_BIRIMI.has(l.birim.toLocaleUpperCase("tr-TR")));
    cikti.push({
      id: s.id,
      orderNo: s.orderNo,
      supplier: s.supplier,
      orderedAt: s.orderedAt,
      dueAt: s.dueAt,
      receivedAt: s.receivedAt,
      cancelledAt: s.cancelledAt,
      currency: s.currency,
      fxRate: s.fxRate,
      note: s.note,
      toplam: satirlar.reduce((t, l) => t + (l.tutar ?? 0), 0),
      toplamEur: satirlar.every((l) => l.tutarEur == null)
        ? null
        : satirlar.reduce((t, l) => t + (l.tutarEur ?? 0), 0),
      toplamKg: kiloluk.reduce((t, l) => t + l.miktar, 0),
      kiloDisiSatir: satirlar.length - kiloluk.length,
      satirlar,
    });
  }
  return cikti.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

/** "Kg" · "KG" · "KILO" — hepsi aynı birimdir. */
const KILO_BIRIMI = new Set(["KG", "KILO", "KİLO"]);

/**
 * Sipariş satırlarını analiz diline çevirir.
 *
 * YALNIZ KİLO BİRİMLİ SATIR GİRER. Bir boyun kaç kilo olduğunu varsaymak
 * ortalama fiyatı sessizce bozardı; dışarıda kalanlar `kiloDisiSatir` ile
 * sayılır ve ekran bunu açıkça yazar.
 *
 * İPTAL EDİLMİŞ SİPARİŞ ANALİZE GİRMEZ: verilmemiş bir sipariş bir alım
 * değildir.
 */
export function siparisleriAlimaCevir(
  siparisler: readonly HammaddeSiparisi[]
): AlimSatiri[] {
  const cikti: AlimSatiri[] = [];
  for (const s of siparisler) {
    if (s.cancelledAt) continue;
    for (const l of s.satirlar) {
      if (!KILO_BIRIMI.has(l.birim.toLocaleUpperCase("tr-TR"))) continue;
      if (l.tutar == null || l.miktar <= 0) continue;
      cikti.push({
        id: `siparis:${l.id}`,
        kaynak: "siparis",
        gun: s.orderedAt.slice(0, 10),
        tedarikci: s.supplier,
        kategori: l.kategori,
        tanim: l.tanim,
        key: l.matchKey,
        kalite: l.kalite,
        kg: l.miktar,
        // PARA BİRİMİ ÇEVRİLMEZ, OLDUĞU GİBİ TAŞINIR: bir dolar siparişinin
        // TL karşılığını bilmiyoruz (satırda yalnız avro paritesi var) ve
        // uydurulmuş bir TL tutarı, TL grafiğini sessizce şişirirdi.
        tutarTry: s.currency === "TRY" ? l.tutar : null,
        tutarUsd: s.currency === "USD" ? l.tutar : null,
        tutarEur: s.currency === "EUR" ? l.tutar : l.tutarEur,
        siparisNo: s.orderNo,
      });
    }
  }
  return cikti;
}

/** İki defteri birlikte okur — analiz ekranının tek girişi. */
export async function loadAlimlar(supabase: SupabaseClient): Promise<{
  satirlar: AlimSatiri[];
  siparisler: HammaddeSiparisi[];
  /** Kilo dışı birimde olduğu için analize giremeyen sipariş satırı sayısı. */
  kiloDisiSatir: number;
}> {
  const [gecmis, hamSiparisler] = await Promise.all([
    loadAlimGecmisi(supabase),
    loadSiparisler(supabase),
  ]);
  const siparisler = hammaddeSiparisleriniSuz(hamSiparisler);
  const canli = siparisleriAlimaCevir(siparisler);
  return {
    satirlar: [...gecmis, ...canli],
    siparisler,
    kiloDisiSatir: siparisler
      .filter((s) => !s.cancelledAt)
      .reduce((t, s) => t + s.kiloDisiSatir, 0),
  };
}
