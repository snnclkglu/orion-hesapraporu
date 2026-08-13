// AÇILIŞ PANOSU — arama ve zaman şeridinin SAF çekirdeği.
//
// Bu dosya veritabanı bilmez ve "bugün"ü kendisi okumaz: tarih ÇAĞIRANDAN
// gelir (`bugun: "YYYY-MM-DD"`). Gerekçe hesap motorununkiyle aynı — sunucuda
// ve istemcide aynı girdi aynı çıktıyı vermelidir; `new Date()` çağıran saf bir
// fonksiyon, sunucu Frankfurt'ta akşam altıyken tarayıcıda henüz öğlense iki
// farklı "yarın" üretir ve hidrasyon uyuşmaz.

import { trKatla } from "@/lib/drawings/tr-text";

// ————————————————————————————————————————————————————————————— ARAMA

/**
 * Aranabilir kayıt türleri. SIRA ANLAMLIDIR: sonuç listesi bu düzende
 * gruplanır ve düzen "aranan şeyin ne olma ihtimali yüksek" sırasıdır —
 * atölyede en çok iş numarası, mühendislikte rapor adı aranıyor.
 */
export const PANEL_KINDS = ["job", "item", "customer", "project", "package", "group"] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

export const PANEL_KIND_LABELS: Record<PanelKind, string> = {
  job: "İşler",
  item: "İş Kalemleri",
  customer: "Müşteriler",
  project: "Hesap Raporları",
  package: "Teknik Resim Paketleri",
  group: "Ana Gruplar",
};

/** Arama defterinin bir satırı. */
export interface PanelHit {
  kind: PanelKind;
  /** Ekranda solda duran kimlik: iş no, kalem no, resim kodu… */
  code: string;
  /** Ekranda sağda duran ad */
  label: string;
  /** İkinci satır — müşteri, durum, paket adı gibi bağlam */
  hint?: string;
  href: string;
}

/**
 * Eşleşme KATLANMIŞ metin üzerindedir (`trKatla`), `toLowerCase` değil.
 *
 * Sebep bu uygulamada defalarca ölçüldü: adlar BÜYÜK HARFLE saklanıyor
 * (md. 14) ve kullanıcı küçük harfle yazıyor. Düz `toLowerCase` Türkçe'nin
 * noktalı/noktasız i ayrımını çözemez — "isdemir" yazan biri "İSDEMİR"i
 * bulamaz. `trKatla` iki yazımı da tek biçime indirir.
 */
function katla(value: string): string {
  return trKatla(value ?? "");
}

/**
 * Sorguyu boşluklara böler ve HER PARÇANIN geçmesini şart koşar.
 *
 * "astor pergel" iki ayrı alanda geçebilir (müşteri + ürün) ve kullanıcı onları
 * bitişik yazmak zorunda kalmamalıdır. Tek bir birleşik dizgede aramak
 * "pergel astor" sırasını kaybettirirdi.
 */
export function panelEslesir(hit: PanelHit, sorgu: string): boolean {
  const parcalar = katla(sorgu).split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return false;
  const alan = katla(`${hit.code} ${hit.label} ${hit.hint ?? ""}`);
  return parcalar.every((p) => alan.includes(p));
}

/**
 * Sonuç sıralaması — SKOR DEĞİL, ÜÇ BASAMAKLI BİR KURAL.
 *
 * Bir puanlama işlevi (kaç kez geçti, ne kadar yakın) burada ölçülemez bir
 * şey üretirdi; kullanıcı "neden bu üstte" diye sorduğunda cevap
 * verilebilmelidir:
 *   1. KİMLİĞİN BAŞINDAN eşleşen önce gelir — "0057" yazan iş numarası arıyor.
 *   2. Sonra adın başından eşleşenler.
 *   3. Geri kalanı tür sırasında, kendi içinde kimliğe göre.
 */
export function panelSirala(hits: readonly PanelHit[], sorgu: string): PanelHit[] {
  const ilk = katla(sorgu).split(/\s+/).filter(Boolean)[0] ?? "";
  const derece = (h: PanelHit) => {
    if (ilk && katla(h.code).startsWith(ilk)) return 0;
    if (ilk && katla(h.label).startsWith(ilk)) return 1;
    return 2;
  };
  return [...hits].sort(
    (a, b) =>
      derece(a) - derece(b) ||
      PANEL_KINDS.indexOf(a.kind) - PANEL_KINDS.indexOf(b.kind) ||
      a.code.localeCompare(b.code, "tr", { numeric: true })
  );
}

/** Tür başlıklarıyla gruplanmış sonuç — ekran bunu basar. */
export interface PanelGroup {
  kind: PanelKind;
  hits: PanelHit[];
}

/**
 * Aramayı çalıştırır ve türe göre gruplar.
 *
 * `limit` GRUP BAŞINADIR, toplam değil: "0" yazan biri elli iş kalemi
 * görmemeli ama tek bir müşteriyi de kaybetmemeli. Kesilen grup ekranda kaç
 * tane daha olduğunu söyler (`toplam`), sessizce kırpmaz.
 */
export function panelAra(
  defter: readonly PanelHit[],
  sorgu: string,
  limit = 6
): { gruplar: PanelGroup[]; toplam: number } {
  const q = sorgu.trim();
  if (q.length < 2) return { gruplar: [], toplam: 0 };

  const gecenler = panelSirala(
    defter.filter((h) => panelEslesir(h, q)),
    q
  );
  const gruplar: PanelGroup[] = [];
  for (const kind of PANEL_KINDS) {
    const hits = gecenler.filter((h) => h.kind === kind);
    if (hits.length > 0) gruplar.push({ kind, hits: hits.slice(0, limit) });
  }
  return { gruplar, toplam: gecenler.length };
}

// ————————————————————————————————————————————————————— ZAMAN ŞERİDİ

/** Yaklaşan bir tarih — kaynağı ne olursa olsun aynı biçimde basılır. */
export interface PanelDate {
  /** "YYYY-MM-DD" */
  date: string;
  /** "Termin", "Sevk", "Teslim", "Ödeme" gibi kısa tür adı */
  kind: string;
  label: string;
  hint?: string;
  href: string;
  /** Geçmiş bir tarih mi (gecikme) — ekran onu ayrı boyar */
  overdue?: boolean;
}

/** İki "YYYY-MM-DD" arasındaki gün farkı; saat dilimi taşımaz. */
export function gunFarki(bugun: string, tarih: string): number {
  const a = Date.parse(`${bugun}T00:00:00Z`);
  const b = Date.parse(`${tarih}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/**
 * Tarihin insan okunur adı: "Bugün" · "Yarın" · "Perşembe" · "28.08".
 *
 * HAFTA ADI YALNIZ BİR HAFTA İÇİNDE kullanılır. "Perşembe" iki hafta sonrası
 * için de doğrudur ama okuyan onu BU haftanın perşembesi sanar — bir termin
 * ekranında bu, yedi günlük bir yanılgıdır.
 */
export function gunAdi(bugun: string, tarih: string): string {
  const fark = gunFarki(bugun, tarih);
  if (!Number.isFinite(fark)) return tarih;
  if (fark === 0) return "Bugün";
  if (fark === 1) return "Yarın";
  if (fark === -1) return "Dün";
  if (fark > 1 && fark < 7) {
    const d = new Date(`${tarih}T00:00:00Z`);
    return GUNLER[d.getUTCDay()];
  }
  const [y, a, g] = tarih.split("-");
  return y && a && g ? `${g}.${a}` : tarih;
}

/** Zaman şeridinin bir bandı: aynı güne düşen kayıtlar bir arada. */
export interface PanelDay {
  date: string;
  /** "Bugün" · "Yarın" · "Perşembe" · "28.08" */
  label: string;
  overdue: boolean;
  items: PanelDate[];
}

/**
 * Tarihleri güne göre bantlar ve pencereye kırpar.
 *
 * GEÇMİŞ TARİHLER DE GİRER ve bu bilinçlidir: "termini üç gün önce geçmiş"
 * bilgisi, "yarın termin var"dan daha acildir. `gecmisGun` penceresi dar
 * tutulur (varsayılan 30) — altı ay önce kapanmamış bir kayıt bir hatırlatma
 * değil bir arşiv sorunudur ve bu şeridi kullanılamaz yapardı.
 */
export function panelTakvim(
  kayitlar: readonly PanelDate[],
  bugun: string,
  { ileriGun = 30, gecmisGun = 30 }: { ileriGun?: number; gecmisGun?: number } = {}
): PanelDay[] {
  const bantlar = new Map<string, PanelDay>();
  for (const k of kayitlar) {
    const fark = gunFarki(bugun, k.date);
    if (!Number.isFinite(fark) || fark > ileriGun || fark < -gecmisGun) continue;
    const band = bantlar.get(k.date) ?? {
      date: k.date,
      label: gunAdi(bugun, k.date),
      overdue: fark < 0,
      items: [],
    };
    band.items.push({ ...k, overdue: fark < 0 });
    bantlar.set(k.date, band);
  }
  return [...bantlar.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ————————————————————————————————————————————————————————— SİNYALLER

/**
 * "Dikkat isteyenler" satırı — SAYI + NEREYE GİDİLECEĞİ.
 *
 * Sinyal bir BİLDİRİM DEĞİLDİR: okunmaz, kapatılmaz, birikmez. Veriden
 * TÜRETİLİR ve sebebi ortadan kalkınca kendiliğinden kaybolur. Bildirim
 * defteri (okundu/okunmadı) ayrı bir yapıdır ve bunun yanına gelir.
 */
export interface PanelSignal {
  key: string;
  count: number;
  /** "Termini geçmiş açık sipariş" — sayıdan SONRA okunur, cümleyi o tamamlar */
  label: string;
  href: string;
  /** `uyari` kehribar, `bilgi` sakin. KIRMIZI YOKTUR: bu uygulamada kırmızı
   *  "kontrol sağlanmadı" demektir (AGENTS md. 4) ve bir liste sayacı değildir. */
  tone: "uyari" | "bilgi";
}

/** Sıfır sayan sinyal LİSTEYE GİRMEZ — "0 gecikme" bir uyarı değil gürültüdür. */
export function panelSinyalleri(hepsi: readonly PanelSignal[]): PanelSignal[] {
  return hepsi
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.tone === b.tone ? b.count - a.count : a.tone === "uyari" ? -1 : 1));
}
