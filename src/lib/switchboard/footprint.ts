// CİHAZ ÖLÇÜSÜ — önce defter, sonra kural tabanlı TAHMİN (PANO-5 · PANO-12).
//
// Sıra üçtür ve tersine çevrilemez:
//   1. Kullanıcının o aygıta yazdığı düzeltme (`PlacementOverride`)
//   2. Ürün ölçü defteri (`electrical_device_models`) — ÖLÇÜLMÜŞ değer
//   3. Kural tabanlı tahmin — yalnız AÇIK BİR İŞARET varsa
//
// Üçü de sonuç veremezse ölçü BOŞ kalır ve cihaz "ölçüsüz" kuyruğuna düşer.
// Bu, `0` yazmaktan daha az kullanışlı değil DAHA GÜVENLİdir: sıfır enli bir
// cihaz panoya sığar görünür ve pano sahada yetmez (değişmez md. 4).
//
// TAHMİN DEFTERE YAZILMAZ. Defter olgu tablosudur; tahmin çalışma anında
// üretilir, `dimSource: "tahmin"` taşır ve ekranda taralı çizilir. Kullanıcı
// bir tahmini onayladığında deftere `elle` olarak girer — bu AYRI bir iddiadır.

import { trKatla } from "@/lib/drawings/tr-text";
import { MODULE_PITCH_MM } from "./sizes";
import type { DeviceModel, DimSource, PlacementOverride } from "./types";

export interface FootprintSource {
  category: string;
  designation: string;
  typeNo: string;
  supplier: string;
  partNo: string;
}

export interface Footprint {
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  source: DimSource | null;
  clearanceTopMm: number | null;
  clearanceBottomMm: number | null;
}

const BOS: Footprint = {
  widthMm: null,
  heightMm: null,
  depthMm: null,
  source: null,
  clearanceTopMm: null,
  clearanceBottomMm: null,
};

/**
 * KLEMENS GENİŞLİĞİ KESİTE BAĞLIDIR ve 0019'da yerleşimi belirleyen asıl
 * kalemdir: 726 aygıt satırının 1201 parçası Phoenix Contact'tır, yani
 * panoların büyük kısmı klemenstir. Bir klemensi 17,5 mm modül saymak
 * LVD10'u üç kat büyütürdü.
 *
 * Değerler Phoenix Contact UT/UK ailesinin yayımlanmış vida bağlantılı
 * ölçüleridir; başka üreticide birkaç onda mm oynar ve bu tahmin sınırının
 * içindedir.
 */
const KLEMENS_GENISLIGI_MM: readonly { kesit: number; enMm: number }[] = [
  { kesit: 1.5, enMm: 4.2 },
  { kesit: 2.5, enMm: 5.2 },
  { kesit: 4, enMm: 6.2 },
  { kesit: 6, enMm: 8.2 },
  { kesit: 10, enMm: 10.2 },
  { kesit: 16, enMm: 12.2 },
  { kesit: 35, enMm: 16.2 },
  { kesit: 50, enMm: 22.2 },
];

/** Klemens yüksekliği/derinliği ray üstünden [mm] — aile geneli. */
const KLEMENS_YUKSEKLIK_MM = 60;
const KLEMENS_DERINLIK_MM = 60;

/**
 * Defterden ve düzeltmeden gelen ölçüyü birleştirir; boş kalan alanı tahminle
 * doldurur.
 *
 * KAYNAK EN ZAYIF HALKAYA GÖRE VERİLİR: en'i defterden, boyu tahminden gelen
 * bir cihaz "tahmin"dir. Aksi hâlde sipariş sayacı bir cihazı doğrulanmış
 * sayar ve gövde ölçüsü yanlış çıkardı.
 */
export function footprintFor(
  item: FootprintSource,
  model: DeviceModel | null,
  override: PlacementOverride | null
): Footprint {
  const tahmin = estimateFootprint(item);

  const en = ilkSayi(override?.widthMm, model?.widthMm, tahmin.widthMm);
  const boy = ilkSayi(override?.heightMm, model?.heightMm, tahmin.heightMm);
  const derinlik = ilkSayi(override?.depthMm, model?.depthMm, tahmin.depthMm);

  if (en.deger === null || boy.deger === null || derinlik.deger === null) {
    return {
      ...BOS,
      widthMm: en.deger,
      heightMm: boy.deger,
      depthMm: derinlik.deger,
      clearanceTopMm: model?.clearanceTopMm ?? null,
      clearanceBottomMm: model?.clearanceBottomMm ?? null,
    };
  }

  const kaynaklar: DimSource[] = [en.kaynak, boy.kaynak, derinlik.kaynak].filter(
    (k): k is DimSource => k !== null
  );

  return {
    widthMm: en.deger,
    heightMm: boy.deger,
    depthMm: derinlik.deger,
    source: enZayifKaynak(kaynaklar),
    clearanceTopMm: model?.clearanceTopMm ?? null,
    clearanceBottomMm: model?.clearanceBottomMm ?? null,
  };
}

type Secim = { deger: number | null; kaynak: DimSource | null };

function ilkSayi(
  elle: number | null | undefined,
  defter: number | null | undefined,
  tahminDeger: number | null
): Secim {
  if (typeof elle === "number" && elle > 0) return { deger: elle, kaynak: "elle" };
  if (typeof defter === "number" && defter > 0) return { deger: defter, kaynak: "katalog" };
  if (tahminDeger !== null && tahminDeger > 0) return { deger: tahminDeger, kaynak: "tahmin" };
  return { deger: null, kaynak: null };
}

/** `tahmin` < `katalog` < `elle`: en zayıfı kazanır. */
function enZayifKaynak(kaynaklar: DimSource[]): DimSource {
  if (kaynaklar.includes("tahmin")) return "tahmin";
  if (kaynaklar.includes("katalog")) return "katalog";
  return "elle";
}

/**
 * KURAL TABANLI TAHMİN — yalnız açık bir işaret varsa.
 *
 * Tahmin bir doldurma değil bir ÖLÇÜMDÜR: "3POLE" yazan bir şalterin eni
 * gerçekten 3 × 17,5 mm'dir, çünkü modüler cihazın adımı standarttır. İşaret
 * yoksa tahmin de yoktur — sürücünün, HMI'nin ve kameranın ölçüsü ailesinden
 * çıkarılamaz ve bunlar bilerek boş bırakılır (PANO-5).
 */
export function estimateFootprint(item: FootprintSource): Footprint {
  const metin = trKatla(`${item.designation} | ${item.typeNo} | ${item.partNo}`);

  // ── Klemens: kesit okunabiliyorsa ────────────────────────────────────────
  if (item.category === "Fiş, Priz, Klemens ve Bağlantı") {
    const kesit = kesitOku(metin);
    if (kesit === null) return BOS;
    const satir = KLEMENS_GENISLIGI_MM.find((k) => k.kesit >= kesit);
    if (!satir) return BOS;
    return tahminKutu(satir.enMm, KLEMENS_YUKSEKLIK_MM, KLEMENS_DERINLIK_MM);
  }

  // ── Modüler cihaz: kutup sayısı okunabiliyorsa ───────────────────────────
  if (
    item.category === "Şalterler ve Devre Kesiciler" ||
    item.category === "Sigortalar ve Sigorta Yuvaları"
  ) {
    const kutup = kutupOku(metin);
    if (kutup === null) return BOS;
    return tahminKutu(kutup * MODULE_PITCH_MM, 85, 70);
  }

  // ── Kontaktör: en yaygın S00/S0 gövdesi ──────────────────────────────────
  if (item.category === "Kontaktörler") {
    return tahminKutu(45, 80, 85);
  }

  // ── Motor koruma şalteri: 3RV/GV2 gövdesi ────────────────────────────────
  if (item.category === "Motor Koruma ve Termik Röleler") {
    return tahminKutu(45, 100, 100);
  }

  // ── Röle: arayüz rölesi ince, güvenlik rölesi geniştir ───────────────────
  if (item.category === "Kumanda ve Güvenlik Röleleri") {
    const guvenlik = ["SAFETY", "GUVENLIK", "3SK", "PNOZ", "PREVENTA"].some((i) =>
      metin.includes(i)
    );
    return guvenlik ? tahminKutu(22.5, 100, 120) : tahminKutu(6.2, 80, 80);
  }

  // ── Anahtarlamalı güç kaynağı (trafo/reaktör DEĞİL — `mount.ts` ayırır) ──
  if (item.category === "Güç Kaynakları ve Trafolar") {
    if (["TRANSFORMER", "TRAFO", "REACTOR", "REAKTOR"].some((i) => metin.includes(i))) {
      return BOS;
    }
    return tahminKutu(50, 125, 125);
  }

  // ── PLC / uzak I/O modülü: S7-1500 ve ET200 adımı ────────────────────────
  if (item.category === "PLC ve Uzak I/O") {
    return tahminKutu(35, 147, 130);
  }

  // ── Endüstriyel haberleşme (switch, AP, gateway) ─────────────────────────
  if (item.category === "Endüstriyel Haberleşme") {
    return tahminKutu(60, 125, 125);
  }

  // ── Ölçüm cihazı: pano tipi gösterge 96 x 96 kesitlidir ──────────────────
  if (item.category === "Ölçüm ve Enstrümantasyon") {
    return tahminKutu(96, 96, 100);
  }

  // ── Kapak elemanları: 22 mm delik standardı ──────────────────────────────
  if (
    item.category === "Kumanda Elemanları" ||
    item.category === "Sinyal ve İkaz Elemanları"
  ) {
    return tahminKutu(30, 30, 60);
  }

  // Sürücü, HMI, kamera, motor, kablo: ailesinden ölçü çıkarılamaz.
  return BOS;
}

function tahminKutu(enMm: number, boyMm: number, derinlikMm: number): Footprint {
  return {
    widthMm: enMm,
    heightMm: boyMm,
    depthMm: derinlikMm,
    source: "tahmin",
    clearanceTopMm: null,
    clearanceBottomMm: null,
  };
}

/**
 * Kutup sayısı: `3POLE` · `3 POLE` · `4P` · `1+N`.
 *
 * `1+N` İKİ MODÜLDÜR: nötr kutbu da bir modül yer kaplar. Tek modül saymak
 * bir dağıtım bankasında düzinelerce mm kaybettirirdi.
 */
export function kutupOku(metin: string): number | null {
  if (/\b1\s*\+\s*N\b/.test(metin)) return 2;
  if (/\b3\s*\+\s*N\b/.test(metin)) return 4;
  const m = metin.match(/\b([1-4])\s*-?\s*(?:POLE|POLES|POL|P)\b/);
  if (m) return Number(m[1]);
  return null;
}

/** Klemens kesiti: `2,5MM2` · `2.5 MM²` · `UT 4` · `UK 10`. */
export function kesitOku(metin: string): number | null {
  const mm2 = metin.match(/\b(\d+(?:[.,]\d+)?)\s*MM(?:2|²)\b/);
  if (mm2) return Number(mm2[1].replace(",", "."));
  const seri = metin.match(/\b(?:UT|UK|ST|PT|UTTB|UKK)\s*-?\s*(\d+(?:[.,]\d+)?)\b/);
  if (seri) return Number(seri[1].replace(",", "."));
  return null;
}
