// PAKET BAŞINA SATIN ALMA ÖZETİ — saf çekirdek (DB/HTTP yok).
//
// Kullanıcı kararı (12.08.2026): Teknik Resimler'e satın almanın KÜÇÜK BİR
// ÖZETİ konur. *"Mühendis ya da ressam bu ekipman satın alınmış mı diye
// bakabilsin ve teslim süresini görebilsin. Fiyat ve kimden alındığı gibi
// bilgilere gerek yok."*
//
// ————————————————————————————————— BU BİR EKRAN DEĞİL, BİR PENCEREDİR
//
// 12.08.2026'da paket içi Satın Alma SEKMESİ kaldırılmıştı ve gerekçesi
// duruyor: satınalmacı projeleri tek tek ele almaz, `/purchasing` o işi
// modeller. Geri gelen şey o ekran DEĞİLDİR — burada hiçbir işlem yoktur:
// sipariş açılmaz, teklif girilmez, işaret konmaz. Tek soruyu cevaplar:
// **"geldi mi, ne zaman gelir?"** İki ekranın "hangisi doğru" çelişkisi de bu
// yüzden doğmaz; yazan taraf hâlâ tektir.
//
// DOSYA `lib/drawings/` ALTINDA DEĞİL: burada tutulan bilgi satın almanındır
// (sipariş, termin, teslim) ve `terms.ts`in tarih bağıntılarını kullanır.
// Teknik resim çekirdeğini satın almaya bağımlı yapmak, iki modülün bağını
// yanlış yöne çevirirdi.

import { gunFarki } from "./terms";

/** Kalemin satın alma zincirindeki yeri. SIRA ANLAMLIDIR. */
export type SatinAlmaDurumu = "bekliyor" | "siparis" | "kismi" | "teslim";

export const DURUM_SIRASI: readonly SatinAlmaDurumu[] = [
  "bekliyor",
  "siparis",
  "kismi",
  "teslim",
];

export const DURUM_ETIKETLERI: Record<SatinAlmaDurumu, string> = {
  bekliyor: "Sipariş bekliyor",
  siparis: "Sipariş verildi",
  kismi: "Kısmi teslim",
  teslim: "Teslim alındı",
};

/** `drawing_purchase_summary(uuid)` fonksiyonunun bir satırı. */
export interface SiparisOzeti {
  partKey: string;
  matchKey: string;
  orderedQty: number;
  receivedQty: number;
  firstOrderedAt: string | null;
  nextDueAt: string | null;
  lastReceivedAt: string | null;
  orderCount: number;
  openOrderCount: number;
}

/** Defterdeki satın alma kaleminin bu ekranın ihtiyaç duyduğu kadarı. */
export interface OzetKalemi {
  key: string;
  tanim: string;
  sinif: string;
  malzeme: string;
  parcaKodu: string;
  /** Kalemin bağlı olduğu ana grubun adı; çözülemezse "". */
  kullanildigiYer?: string;
  adet: number | null;
}

/** `drawing_part_progress`teki "satın alındı" işareti. */
export interface SatinAlmaIsareti {
  key: string;
  doneAt: string | null;
}

export interface OzetSatiri {
  key: string;
  tanim: string;
  sinif: string;
  malzeme: string;
  parcaKodu: string;
  /**
   * KULLANILDIĞI YER — kalemin bağlı olduğu ana grubun adı; çözülemezse "".
   *
   * Kullanıcı bildirimi (13.08.2026): *"Satın alma bunların hangi grup
   * içerisinde olduğunu görmek istiyor."* Mühendis ve ressam `/purchasing`
   * bölümünü görmüyor (md. 18) — "bu cıvata neyin cıvatası" sorusunu bu
   * ekranda soruyorlar. Ad ÜRÜN AĞACININ item yolundan çözülür; ağaç yoksa
   * alan boş kalır ve sütun "—" gösterir, uydurma bir grup adı yazılmaz.
   */
  kullanildigiYer: string;
  /** Pakette GEREKEN adet (defterden). Sipariş adediyle karıştırılmaz. */
  gereken: number | null;
  durum: SatinAlmaDurumu;
  siparisAdedi: number | null;
  teslimAdedi: number | null;
  siparisTarihi: string | null;
  termin: string | null;
  teslimTarihi: string | null;
  siparisSayisi: number;
  acikSiparis: number;
  /** Termini GEÇMİŞ ve teslimi tamamlanmamış kalemde gün sayısı; yoksa 0. */
  gecikmeGun: number;
  /**
   * Sipariş KAYDI yok ama "satın alındı" işareti var.
   *
   * Devralınan ve elle konmuş işaretler böyledir. Satırı düşürmek "sipariş
   * verilmemiş" demek olurdu ki yanlıştır; sipariş gibi göstermek de eksik
   * bilgiyi tam gösterirdi. Ekran bunu AÇIKÇA yazar.
   */
  yalnizIsaret: boolean;
}

export interface PaketOzeti {
  satirlar: OzetSatiri[];
  toplam: number;
  bekleyen: number;
  siparisVerilen: number;
  teslimAlinan: number;
  geciken: number;
  /** Bugünden sonraki en yakın açık termin; yoksa `null`. */
  enYakinTermin: string | null;
}

function sayi(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

/**
 * Kalem başına durumu çıkarır.
 *
 * SIRA "EN İYİMSER OLANI EN SONA": önce teslim, sonra kısmi, sonra sipariş.
 * Ters sırada yazılsaydı kısmi teslim "sipariş verildi"de kalır ve atölye
 * gelen 60 cıvatayı hiç görmezdi.
 *
 * TESLİM KARARI İKİ TANIKLIDIR: hem adet tamamlanmış olmalı hem de açık
 * sipariş kalmamalı. Yalnız adede bakmak, satınalmacının satır adedini
 * güncellediği ama siparişi kapatmadığı hâlde "geldi" derdi; yalnız kapanışa
 * bakmak da kısmi teslimi yutardı.
 */
function durumCoz(o: SiparisOzeti | undefined, isaretVar: boolean): SatinAlmaDurumu {
  if (!o) return isaretVar ? "siparis" : "bekliyor";
  const siparis = sayi(o.orderedQty);
  const teslim = sayi(o.receivedQty);
  if (siparis > 0 && teslim >= siparis && o.openOrderCount === 0) return "teslim";
  // Sipariş satırı adet taşımadan kapanmış olabilir (`received_at` dolu,
  // `received_qty` sıfır): kapanmış siparişten başka tanık istemek, gelmiş
  // malzemeyi yolda göstermekti.
  if (o.openOrderCount === 0 && o.lastReceivedAt) return "teslim";
  if (teslim > 0) return "kismi";
  return "siparis";
}

/**
 * Defter kalemlerini sipariş kayıtlarıyla ve işaretlerle birleştirir.
 *
 * EŞLEŞME ÖNCE `part_key` İLE, SONRA `match_key` İLE. Anahtar paket yeniden
 * eşleştirildiğinde değişebilir (`part_key` KİMLİK DEĞİL BAĞdır — bkz.
 * migration 20260812000002); katlanmış tanım ise kalemin kendisidir. Tek
 * anahtara güvenmek, revizyondan sonra bütün siparişleri görünmez yapardı.
 */
export function paketSatinAlmaOzeti(
  kalemler: readonly OzetKalemi[],
  ozetler: readonly SiparisOzeti[],
  isaretler: readonly SatinAlmaIsareti[],
  bugun?: string
): PaketOzeti {
  const anahtarla = new Map<string, SiparisOzeti>();
  const tanimla = new Map<string, SiparisOzeti>();
  for (const o of ozetler) {
    if (o.partKey) anahtarla.set(o.partKey, birlestir(anahtarla.get(o.partKey), o));
    if (o.matchKey) tanimla.set(o.matchKey, birlestir(tanimla.get(o.matchKey), o));
  }
  const isaretHaritasi = new Map(isaretler.map((i) => [i.key, i]));

  const satirlar: OzetSatiri[] = kalemler.map((k) => {
    const o = anahtarla.get(k.key) ?? tanimla.get(k.key);
    const isaret = isaretHaritasi.get(k.key);
    const durum = durumCoz(o, Boolean(isaret));

    // GECİKME YALNIZ AÇIK TERMİNDE ANLAMLIDIR. Teslim alınmış bir kalemin
    // geçmiş termini bir gecikme değil bir geçmiştir; kırmızı göstermek
    // ekranı yanlış alarmla doldururdu (md. 18/3).
    const kalanGun = durum === "teslim" ? null : gunFarki(o?.nextDueAt ?? null, bugun);
    const gecikmeGun = kalanGun != null && kalanGun < 0 ? -kalanGun : 0;

    return {
      key: k.key,
      tanim: k.tanim,
      sinif: k.sinif,
      malzeme: k.malzeme,
      parcaKodu: k.parcaKodu,
      kullanildigiYer: k.kullanildigiYer ?? "",
      gereken: k.adet,
      durum,
      siparisAdedi: o ? sayi(o.orderedQty) : null,
      teslimAdedi: o ? sayi(o.receivedQty) : null,
      // İşaretin günü bir sipariş kaydı yokken TEK tarihtir; onu da atmak
      // "ne zaman ısmarlandı" sorusunu tamamen cevapsız bırakırdı.
      siparisTarihi: o?.firstOrderedAt ?? isaret?.doneAt ?? null,
      termin: o?.nextDueAt ?? null,
      teslimTarihi: o?.lastReceivedAt ?? null,
      siparisSayisi: o?.orderCount ?? 0,
      acikSiparis: o?.openOrderCount ?? 0,
      gecikmeGun,
      yalnizIsaret: !o && Boolean(isaret),
    };
  });

  const acikTerminler = satirlar
    .filter((s) => s.durum !== "teslim" && s.termin)
    .map((s) => s.termin as string)
    .sort();

  return {
    satirlar,
    toplam: satirlar.length,
    bekleyen: satirlar.filter((s) => s.durum === "bekliyor").length,
    siparisVerilen: satirlar.filter((s) => s.durum === "siparis" || s.durum === "kismi").length,
    teslimAlinan: satirlar.filter((s) => s.durum === "teslim").length,
    geciken: satirlar.filter((s) => s.gecikmeGun > 0).length,
    enYakinTermin: acikTerminler[0] ?? null,
  };
}

/**
 * Aynı kaleme iki satır düştüğünde (aynı `match_key`, farklı `part_key`)
 * toplamları birleştirir. SQL zaten grupluyor; bu, iki anahtar uzayının
 * kesiştiği yerde sayıların ikiye katlanmasını değil TOPLANMASINI sağlar.
 */
function birlestir(a: SiparisOzeti | undefined, b: SiparisOzeti): SiparisOzeti {
  if (!a) return b;
  return {
    partKey: a.partKey || b.partKey,
    matchKey: a.matchKey || b.matchKey,
    orderedQty: sayi(a.orderedQty) + sayi(b.orderedQty),
    receivedQty: sayi(a.receivedQty) + sayi(b.receivedQty),
    firstOrderedAt: enKucuk(a.firstOrderedAt, b.firstOrderedAt),
    nextDueAt: enKucuk(a.nextDueAt, b.nextDueAt),
    lastReceivedAt: enBuyuk(a.lastReceivedAt, b.lastReceivedAt),
    orderCount: a.orderCount + b.orderCount,
    openOrderCount: a.openOrderCount + b.openOrderCount,
  };
}

function enKucuk(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function enBuyuk(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
