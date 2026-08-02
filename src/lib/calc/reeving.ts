// Halat donanımı (reeving) — tek gerçek kaynak.
//
// Donanım bilgisi bugüne kadar kaldırma grubu girdilerinde, kanca bloğu
// bağımlılıklarında, otomatik türetmelerde, şema üreticisinde ve ekipman
// listesinde birbirinden bağımsız yaşıyordu. Bu dosya donanımı BİRİNCİ SINIF
// bir kavram hâline getirir: donanımın tanımı (kaç kol, kaç tahrikli kol,
// kaç sabit makara, tek makara verimi) burada durur; tüm türetilmiş
// büyüklükler (mekanik avantaj, halat verimi, makara ve rulman adetleri)
// buradan okunur.
//
// Modül saftır: yan etkisi, DB/UI bağımlılığı yoktur.
//
// Dayanak: FEM 1.001 4.2.2 (halat yükü ve donanım verimi), CMAA 70 5.2.9.1.1
// (makara yataklama verimi). Halat verimi klasik makara dizisi bağıntısıdır:
//
//   η = (η_m^s / i) · (1 − η_m^i) / (1 − η_m)
//
// burada i mekanik avantaj, s verim zincirindeki sabit (yönlendirme) makara
// adedi, η_m tek makara verimidir. Parantezli terim, yükü taşıyan i adet kolun
// verim serisinin (1 + η_m + … + η_m^(i−1)) kapalı biçimidir.

/** Donanımın tanımı — kullanıcı/katalog tarafından belirlenen büyüklükler. */
export interface Reeving {
  /** Tambura sarılan (tahrikli) halat kolu sayısı */
  drivenFalls: number;
  /** Kanca bloğunu taşıyan toplam halat kolu sayısı */
  totalFalls: number;
  /** Verim zincirindeki sabit/yönlendirme makarası adedi */
  fixedSheaveCount: number;
  /** Tek makara verimi η_m (0 < η_m < 1) */
  sheaveEfficiency: number;
}

/** Donanımdan türetilen büyüklükler. */
export interface ReevingDerived {
  /** Gösterim etiketi, "tahrikli/toplam" biçiminde (ör. "2/4") */
  label: string;
  /** Mekanik avantaj i = n_toplam / n_tahrik */
  mechanicalAdvantage: number;
  /** Halat donanımı verimi η */
  ropeEfficiency: number;
  /** Kanca bloğundaki hareketli makara adedi = n_toplam / 2 */
  blockSheaveCount: number;
  /** Üst (sabit) makara adedi = (n_toplam − n_tahrik) / 2 */
  topSheaveCount: number;
  /** Blok makaralarının rulman adedi = 2 × hareketli makara */
  sheaveBearingCount: number;
  /** Tamburda sonlanan halat ucu adedi = n_tahrik */
  drumRopeEnds: number;
}

/** Doğrulama bulgusu — alan adı, Türkçe mesaj ve ağırlık. */
export interface ReevingIssue {
  alan: string;
  mesaj: string;
  agirlik: "hata" | "uyari";
}

/** η_m'nin 1'e eşit sayıldığı sayısal tolerans (bölme sıfıra gitmesin). */
const ETA_TOLERANCE = 1e-12;

/** Sayı geçerliyse kendisini, değilse yedek değeri döndürür. */
function positiveOr(v: number, fallback: number): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Sayı geçerliyse kendisini, değilse yedek değeri döndürür (negatif serbest). */
function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Verim serisinin toplamı: S = 1 + η + η² + … + η^(i−1) = (1 − η^i)/(1 − η).
 * η → 1 sınırında bölme sıfıra gider; bu durumda seri toplamı doğrudan i'dir.
 */
function efficiencySeries(eta: number, i: number): number {
  if (Math.abs(1 - eta) < ETA_TOLERANCE) return i;
  return (1 - eta ** i) / (1 - eta);
}

/** Donanım etiketi — "tahrikli/toplam" (ör. 2 tahrikli, 4 toplam → "2/4"). */
export function reevingLabel(r: Pick<Reeving, "drivenFalls" | "totalFalls">): string {
  const total = positiveOr(r.totalFalls, 1);
  const driven = Math.min(total, positiveOr(r.drivenFalls, 1));
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));
  return `${fmt(driven)}/${fmt(total)}`;
}

/**
 * Donanımdan türetilen büyüklükleri hesaplar.
 *
 * Geçerli (tam sayı, pozitif) girdilerde değerler ham girdilerden birebir
 * hesaplanır — mekanik avantaj ve halat verimi hiçbir yuvarlamaya uğramaz.
 * Geçersiz girdiler yalnız çökmeyi önlemek için güvenli yedeklere düşürülür;
 * bunları raporlamak `validateReeving`'in işidir.
 */
export function deriveReeving(r: Reeving): ReevingDerived {
  const totalFalls = positiveOr(r.totalFalls, 1);
  const drivenFalls = Math.min(totalFalls, positiveOr(r.drivenFalls, 1));
  const fixedSheaveCount = Math.max(0, finiteOr(r.fixedSheaveCount, 0));
  // Geçersiz verim kayıpsız kabul edilir; hata mesajı doğrulamadan gelir.
  const eta = positiveOr(r.sheaveEfficiency, 1);

  const mechanicalAdvantage = totalFalls / drivenFalls;
  const ropeEfficiency =
    ((eta ** fixedSheaveCount) / mechanicalAdvantage) *
    efficiencySeries(eta, mechanicalAdvantage);

  // Makara adetleri tam sayı büyüklüklerdir; tek sayılı donanımda yukarı
  // yuvarlanır (kanca bloğu mili geometrisiyle aynı kabul).
  const blockSheaveCount = Math.max(1, Math.round(totalFalls / 2));
  const topSheaveCount = Math.max(0, Math.round((totalFalls - drivenFalls) / 2));

  return {
    label: reevingLabel({ drivenFalls, totalFalls }),
    mechanicalAdvantage,
    ropeEfficiency,
    blockSheaveCount,
    topSheaveCount,
    sheaveBearingCount: 2 * blockSheaveCount,
    drumRopeEnds: Math.max(1, Math.round(drivenFalls)),
  };
}

/**
 * Donanım tanımını denetler. "hata" ağırlıklı bulgular hesabı geçersiz kılar;
 * "uyari" ağırlıklılar hesap yürür ama tasarım gözden geçirilmelidir.
 */
export function validateReeving(r: Reeving): ReevingIssue[] {
  const issues: ReevingIssue[] = [];
  const hata = (alan: string, mesaj: string) => issues.push({ alan, mesaj, agirlik: "hata" });
  const uyari = (alan: string, mesaj: string) => issues.push({ alan, mesaj, agirlik: "uyari" });

  // --- Toplam halat kolu sayısı
  const totalOk = Number.isFinite(r.totalFalls);
  if (!totalOk) {
    hata("totalFalls", "Toplam halat kolu sayısı sayısal bir değer olmalı.");
  } else {
    if (r.totalFalls < 1) hata("totalFalls", "Toplam halat kolu sayısı en az 1 olmalı.");
    if (!Number.isInteger(r.totalFalls))
      hata("totalFalls", "Toplam halat kolu sayısı tam sayı olmalı.");
    else if (r.totalFalls >= 1 && r.totalFalls % 2 !== 0)
      uyari(
        "totalFalls",
        "Toplam halat kolu sayısı tek — kanca bloğunda tam makara sayısı çıkmıyor."
      );
  }

  // --- Tahrikli halat kolu sayısı
  const drivenOk = Number.isFinite(r.drivenFalls);
  if (!drivenOk) {
    hata("drivenFalls", "Tahrikli halat kolu sayısı sayısal bir değer olmalı.");
  } else {
    if (r.drivenFalls < 1) hata("drivenFalls", "Tahrikli halat kolu sayısı en az 1 olmalı.");
    if (!Number.isInteger(r.drivenFalls))
      hata("drivenFalls", "Tahrikli halat kolu sayısı tam sayı olmalı.");
  }
  if (totalOk && drivenOk && r.drivenFalls > r.totalFalls) {
    hata(
      "drivenFalls",
      "Tahrikli halat kolu sayısı toplam halat kolu sayısını aşamaz."
    );
  }

  // --- Mekanik avantaj
  if (totalOk && drivenOk && r.drivenFalls > 0 && r.totalFalls > 0) {
    const i = r.totalFalls / r.drivenFalls;
    if (Number.isFinite(i) && !Number.isInteger(i)) {
      uyari(
        "drivenFalls",
        "Mekanik avantaj (toplam / tahrikli) tam sayı çıkmıyor — donanım simetrik değil."
      );
    }
  }

  // --- Sabit makara adedi
  if (!Number.isFinite(r.fixedSheaveCount)) {
    hata("fixedSheaveCount", "Sabit makara adedi sayısal bir değer olmalı.");
  } else {
    if (r.fixedSheaveCount < 0)
      hata("fixedSheaveCount", "Sabit makara adedi negatif olamaz.");
    else if (!Number.isInteger(r.fixedSheaveCount))
      uyari("fixedSheaveCount", "Sabit makara adedi tam sayı olmalı.");
  }

  // --- Tek makara verimi
  if (!Number.isFinite(r.sheaveEfficiency)) {
    hata("sheaveEfficiency", "Makara verimi sayısal bir değer olmalı.");
  } else if (r.sheaveEfficiency <= 0 || r.sheaveEfficiency >= 1) {
    hata(
      "sheaveEfficiency",
      "Makara verimi 0 ile 1 arasında olmalı (tipik değer 0,98 – 0,985)."
    );
  }

  return issues;
}

/** Yaygın donanım seçeneği — arayüz açılır listesi için. */
export interface CommonReeving {
  /** "tahrikli/toplam" etiketi */
  label: string;
  drivenFalls: number;
  totalFalls: number;
}

/**
 * Vinç imalatında yaygın donanımlar. Etiket her zaman
 * `reevingLabel` çıktısıyla aynıdır; liste yalnız hazır seçim sunar,
 * serbest giriş engellenmez.
 */
export const COMMON_REEVINGS: readonly CommonReeving[] = [
  { label: "2/2", drivenFalls: 2, totalFalls: 2 },
  { label: "2/4", drivenFalls: 2, totalFalls: 4 },
  { label: "4/4", drivenFalls: 4, totalFalls: 4 },
  { label: "4/8", drivenFalls: 4, totalFalls: 8 },
  { label: "6/6", drivenFalls: 6, totalFalls: 6 },
  { label: "8/8", drivenFalls: 8, totalFalls: 8 },
] as const;

/** Etiketten yaygın donanım seçeneğini bulur; tanınmayan etiket için undefined. */
export function commonReevingByLabel(label: string): CommonReeving | undefined {
  return COMMON_REEVINGS.find((c) => c.label === label);
}
