// AYGIT SIRASI — türetilmiş sıra + kullanıcının sabitlemeleri (PANO-23 · PANO-38).
//
// ═══════════════════════════════════════════ SIRA BİR KOMŞULUKTUR, İNDEKS DEĞİL
//
// İlk sürüm sabitlemeyi MUTLAK İNDEKS olarak saklıyordu ve iki liste birbirini
// saymak zorundaydı: ekran indeksi ÇİZİM sırasından türetiyor, çözücü kendi
// `sirala()` sırasını sayıyordu. First-fit (PANO-37 md. 5) cihazları önceki
// raylara taşıdığı gün iki liste ayrıştı — ölçüldü (0026, 12.09.2026):
// kullanıcı bir sürücüyü bir şalterin yanına bıraktı, çözücü onu 15. indekse
// koydu ve 15. indeks giriş şalterlerinin ortasıydı; orada YENİ BİR PLAKA RAYI
// açıldı, 806 mm yığın büyüdü, pano taştı.
//
// Yeni sabitleme bir KOMŞU + YÖN'dür: "U30, U20'nin SONRASINA". Komşu anahtarı
// iki tarafta da aynı anlama gelir; hiçbir listeyi saymaz.
//
// ═══════════════════════════════════════════ TÜR SINIRI AŞILMAZ
//
// DIN rayına oturan cihaz plakaya vidalanan cihazın yanına SIRALANAMAZ — fizik
// ikisini ayrı raylara koyar (PANO-37). Komşusu farklı türden olan sabitleme
// UYGULANMAZ ve aygıt "komşusu bulunamadı" ile işaretlenir; eylem katmanı
// zaten böyle bir kaydı reddeder (Plan S3), buradaki denetim ikinci kapıdır.
//
// ═══════════════════════════════════════════ BÖLGESİZ AYGIT ÖNE GEÇMEZ
//
// `ZONE_ORDER.indexOf(null)` -1'dir ve ilk sürüm bunu sıralamada kullanıyordu:
// bölgesi boş bir termostat (0026 `S162`) bütün sürücülerin ÖNÜNE geçiyor ve
// ilk DIN rayını panonun EN ÜSTÜNDE açıyordu; first-fit yüzünden bütün DIN
// cihazları o raya doluyordu — "sürücüler en üstte" kuralı fiilen bozuktu.
// Bölgesiz aygıt yerleştiricinin varsaydığı bölgeye (`kumanda`) sayılır.

import { ZONE_ORDER, isMainSwitch } from "../mount";
import { naturalCompare } from "../panels";
import type { DeviceBox, Zone } from "../types";

/** Aygıtın yerleştirmede sayılan bölgesi — bölgesiz aygıt `kumanda`dır. */
export function bolgeOf(d: DeviceBox): Zone {
  return (d.zone ?? "kumanda") as Zone;
}

/** Aygıtın ray türü — plakaya vidalanan `plaka`, gerisi `din`. */
export function turOf(d: DeviceBox): "din" | "plaka" {
  return d.mountType === "plaka" ? "plaka" : "din";
}

/** Sabitleme olmadan türetilen sıra: bölge → ana şalter → renk → doğal kod. */
export function siralaTuretilmis(devices: DeviceBox[]): DeviceBox[] {
  return [...devices].sort((a, b) => {
    const za = ZONE_ORDER.indexOf(bolgeOf(a));
    const zb = ZONE_ORDER.indexOf(bolgeOf(b));
    if (za !== zb) return za - zb;

    // Ana şalter kendi bandının EN BAŞINDA durur: kapak kolu oradan çıkar ve
    // altındaki dağıtım bankasına giden bara en kısa yolu görür.
    const ma = isMainSwitch(a) ? 0 : 1;
    const mb = isMainSwitch(b) ? 0 : 1;
    if (ma !== mb) return ma - mb;

    if (a.colorGroup !== b.colorGroup) return a.colorGroup.localeCompare(b.colorGroup);
    const n = naturalCompare(a.label, b.label);
    if (n !== 0) return n;
    return a.sort - b.sort;
  });
}

export interface SiralamaSonucu {
  sira: DeviceBox[];
  /** Komşusu bulunamayan ya da türü uymayan sabitlemeler — ekran söyler. */
  uygulanamayan: { key: string; sebep: string }[];
}

/**
 * Nihai sıra: türetilmiş sıra → eski biçim indeks sabitlemeleri (tür içinde)
 * → komşuya bağlı sabitlemeler.
 *
 * DETERMİNİZM (PANO-11): sabitlemeler doğal kod sırasıyla uygulanır; aynı
 * komşuyu isteyen iki aygıttan kodu küçük olan komşuya daha yakın oturur.
 * Zincir (A→B, B→C) için birkaç geçiş yapılır; her geçiş bir öncekinden
 * bağımsız değildir ama geçiş sırası sabittir, sonuç da sabittir.
 */
export function sirala(devices: DeviceBox[]): SiralamaSonucu {
  let sira = siralaTuretilmis(devices);
  const uygulanamayan: { key: string; sebep: string }[] = [];

  // ── 1. ESKİ BİÇİM: mutlak indeks, KENDİ TÜRÜNÜN listesinde ─────────────
  //
  // 12.09.2026 öncesi kayıtlar. İndeks bütün liste yerine aynı türden
  // aygıtların listesinde sayılır ki bir plaka sürücüsü DIN şalterlerinin
  // arasına düşüp orada yeni ray açmasın. Aynı türde eski davranış aynıdır.
  const eskiler = sira
    .filter((d) => d.pinnedOrder !== null && d.anchorKey === null)
    .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0) || naturalCompare(a.label, b.label));
  if (eskiler.length > 0) {
    const turler: ("din" | "plaka")[] = ["plaka", "din"];
    const parcalar = new Map<"din" | "plaka", DeviceBox[]>();
    for (const t of turler) parcalar.set(t, sira.filter((d) => turOf(d) === t));
    for (const t of turler) {
      const liste = parcalar.get(t) ?? [];
      const sabit = eskiler.filter((d) => turOf(d) === t);
      if (sabit.length === 0) continue;
      const serbest = liste.filter((d) => d.pinnedOrder === null || d.anchorKey !== null);
      const sonuc: (DeviceBox | null)[] = new Array(liste.length).fill(null);
      for (const d of sabit) {
        let i = Math.max(0, Math.min(liste.length - 1, d.pinnedOrder ?? 0));
        while (sonuc[i] !== null) i = (i + 1) % liste.length;
        sonuc[i] = d;
      }
      let j = 0;
      for (let i = 0; i < sonuc.length; i++) if (sonuc[i] === null) sonuc[i] = serbest[j++] ?? null;
      parcalar.set(t, sonuc.filter((d): d is DeviceBox => d !== null));
    }
    // TÜRLER YUVA DOLDURARAK BİRLEŞİR: türetilmiş sıradaki her konum kendi
    // türünün bir sonraki aygıtını alır. Böylece plaka ve DIN aygıtları
    // birbirine göre yerlerini korur, yalnız tür içindeki sıra değişir.
    const kalan = new Map(parcalar);
    const birlesik: DeviceBox[] = [];
    // Yuva doldurma: türetilmiş sıradaki her konum kendi türünün sırasını tüketir.
    const imlec = new Map<"din" | "plaka", number>([["din", 0], ["plaka", 0]]);
    for (const d of sira) {
      const t = turOf(d);
      const liste = kalan.get(t) ?? [];
      const i = imlec.get(t) ?? 0;
      birlesik.push(liste[i]);
      imlec.set(t, i + 1);
    }
    sira = birlesik;
  }

  // ── 2. KOMŞUYA BAĞLI SABİTLEME ────────────────────────────────────────────
  const bagli = sira
    .filter((d) => d.anchorKey !== null && d.anchorSide !== null)
    .sort((a, b) => naturalCompare(a.label, b.label) || a.sort - b.sort);
  if (bagli.length === 0) return { sira, uygulanamayan };

  const anahtarlar = new Map(sira.map((d) => [d.key, d]));
  for (const d of bagli) {
    const komsu = anahtarlar.get(d.anchorKey as string);
    if (!komsu) {
      uygulanamayan.push({ key: d.key, sebep: "Komşusu bu panoda değil" });
      continue;
    }
    if (komsu.key === d.key) {
      uygulanamayan.push({ key: d.key, sebep: "Aygıt kendi komşusu olamaz" });
      continue;
    }
    if (turOf(komsu) !== turOf(d)) {
      uygulanamayan.push({
        key: d.key,
        sebep: `${turOf(d) === "din" ? "Ray" : "Plaka"} cihazı ${turOf(komsu) === "din" ? "ray" : "plaka"} cihazının yanına sıralanamaz`,
      });
      continue;
    }
  }
  const uygulanacak = bagli.filter((d) => !uygulanamayan.some((u) => u.key === d.key));

  // Zincirler için birkaç geçiş: "B, A'nın sonrasına" ve "C, B'nin sonrasına"
  // — tek geçişte C, B'nin ESKİ yerinin yanına oturabilir. Geçiş sayısı sabit
  // ve küçüktür; hiçbir aygıt bir geçişte iki kez taşınmaz.
  const GECIS = 3;
  for (let g = 0; g < GECIS; g++) {
    let degisti = false;
    for (const d of uygulanacak) {
      const eskiYer = sira.indexOf(d);
      const komsuYer = sira.findIndex((x) => x.key === d.anchorKey);
      if (eskiYer < 0 || komsuYer < 0) continue;
      const hedefHam = d.anchorSide === "once" ? komsuYer : komsuYer + 1;
      // Zaten yerinde mi?
      if (hedefHam === eskiYer || hedefHam === eskiYer + 1) continue;
      const kopya = sira.filter((x) => x !== d);
      const hedef = hedefHam > eskiYer ? hedefHam - 1 : hedefHam;
      kopya.splice(Math.max(0, Math.min(kopya.length, hedef)), 0, d);
      sira = kopya;
      degisti = true;
    }
    if (!degisti) break;
  }

  return { sira, uygulanamayan };
}
