// Maaş çekirdeği — SAF. DB/UI bağımlılığı yoktur, hesap motorundaki
// `src/lib/calc/` ile aynı ruhta: bağıntı burada durur, ekran ve belge onu
// çağırır.
//
// KAYNAK: firmanın bugün kullandığı "ORİON - Personel ve Maaş Listesi" Excel'i.
// Fazla mesai bağıntısı orada bir formüldü ve 566 satırın TAMAMINDA (2024-05 …
// 2026-07) sıfır sapmayla doğrulandı — `__tests__/payroll.test.ts` o
// doğrulamayı dondurur.

/**
 * AYLIK NORMAL ÇALIŞMA SAATİ — firma kabulü, 30 gün × 7,5 saat.
 *
 * Sabit BİR YERDE durur çünkü üç ayrı yerde kullanılır: saatlik ücret,
 * "Çalışma Saati" toplamı (kişi × 225) ve fazla mesai saat maliyeti. Kaynak
 * Excel'de de tek bir sayıydı; üç yere kopyalansaydı biri güncellenip
 * ötekiler unutulurdu.
 */
export const AYLIK_CALISMA_SAATI = 225;

/**
 * Fazla mesai çarpanları (4857 sayılı İş Kanunu md. 41 / md. 47).
 * %50 zamlı = normal saat ücretinin 1,5 katı · %100 zamlı = 2 katı.
 */
export const FAZLA_MESAI_CARPANI = { yuzde50: 1.5, yuzde100: 2 } as const;

/** Bir ayın net maaşından normal saat ücreti. */
export function saatlikUcret(netMaas: number | null | undefined): number {
  const n = Number(netMaas);
  return Number.isFinite(n) && n > 0 ? n / AYLIK_CALISMA_SAATI : 0;
}

/**
 * Fazla mesai tutarı (TL).
 *
 * `netMaas / 225 × (saat50 × 1,5 + saat100 × 2)`
 *
 * Veritabanında da AYNI bağıntı `generated always as … stored` sütununda
 * durur (bkz. `hr_payroll.overtime_amount`): tutar elle girilen bir sayı
 * OLSAYDI saatlerle çelişebilirdi. Buradaki kopya sunum ve önizleme içindir —
 * kullanıcı kaydetmeden önce tutarı görür.
 */
export function fazlaMesaiTutari(
  netMaas: number | null | undefined,
  saat50: number | null | undefined,
  saat100: number | null | undefined
): number {
  const saat = saatlikUcret(netMaas);
  if (!saat) return 0;
  const s50 = Number(saat50) || 0;
  const s100 = Number(saat100) || 0;
  return saat * (s50 * FAZLA_MESAI_CARPANI.yuzde50 + s100 * FAZLA_MESAI_CARPANI.yuzde100);
}

/** Bir ayın toplam ödemesi: net maaş + fazla mesai (+ varsa ek ödemeler). */
export function aylikOdeme(satir: {
  netSalary?: number | null;
  overtimeAmount?: number | null;
  bonus?: number | null;
  perDiem?: number | null;
  deduction?: number | null;
}): number {
  return (
    (Number(satir.netSalary) || 0) +
    (Number(satir.overtimeAmount) || 0) +
    (Number(satir.bonus) || 0) +
    (Number(satir.perDiem) || 0) -
    (Number(satir.deduction) || 0)
  );
}

// ————————————————————————————————————————————————————————————— dönem özeti

export interface PayrollRowLike {
  employeeId: string;
  /** Personelin ait olduğu kategori — özet PERSONEL/YÖNETİM diye ayrışır. */
  category?: string | null;
  netSalary: number | null;
  overtimeHours50: number | null;
  overtimeHours100: number | null;
  overtimeAmount: number | null;
  bonus?: number | null;
  perDiem?: number | null;
  deduction?: number | null;
  /** KİŞİ BAZINDA izin saati (kullanıcı kararı, 13.08.2026). */
  leaveHours?: number | null;
  /** KİŞİ BAZINDA raporlu saat. */
  reportHours?: number | null;
}

export interface PeriodSummary {
  /** Kişi sayısı (maaş satırı olan). */
  count: number;
  /** Normal çalışma saati — kişi × 225. */
  normalHours: number;
  /** Ödenen net maaş toplamı (TL). */
  netTotal: number;
  /** Kişi başı ortalama net maaş (TL); kişi yoksa 0. */
  netAverage: number;
  overtimeHours: number;
  overtimeTotal: number;
  /** Fazla mesainin saat başına maliyeti (TL); mesai yoksa 0. */
  overtimeHourCost: number;
  /** Net + mesai + ek ödemeler − kesinti. */
  grandTotal: number;
  /** KİŞİ SATIRLARINDAN toplanan izin saati (13.08.2026 sonrası tek kaynak). */
  leaveHours: number;
  /** KİŞİ SATIRLARINDAN toplanan raporlu saat. */
  reportHours: number;
}

const BOS_OZET: PeriodSummary = {
  count: 0,
  normalHours: 0,
  netTotal: 0,
  netAverage: 0,
  overtimeHours: 0,
  overtimeTotal: 0,
  overtimeHourCost: 0,
  grandTotal: 0,
  leaveHours: 0,
  reportHours: 0,
};

/**
 * Bir dönemin (ya da bir alt kümenin) özeti.
 *
 * Excel'in "Maaş Özet Tablo" sayfasının birebir karşılığıdır ve HESAPLANIR:
 * o sayfadaki sütunların hepsi maaş satırlarından türetilebilir, yani ikinci
 * bir tabloda saklamak iki kaynak üretirdi (AGENTS SATIS-16, "toplamlar
 * TÜRETİLİR").
 */
export function donemOzeti(rows: readonly PayrollRowLike[]): PeriodSummary {
  if (rows.length === 0) return { ...BOS_OZET };
  let netTotal = 0;
  let overtimeHours = 0;
  let overtimeTotal = 0;
  let grandTotal = 0;
  let leaveHours = 0;
  let reportHours = 0;
  for (const r of rows) {
    netTotal += Number(r.netSalary) || 0;
    overtimeHours += (Number(r.overtimeHours50) || 0) + (Number(r.overtimeHours100) || 0);
    overtimeTotal += Number(r.overtimeAmount) || 0;
    grandTotal += aylikOdeme(r);
    leaveHours += Number(r.leaveHours) || 0;
    reportHours += Number(r.reportHours) || 0;
  }
  const count = rows.length;
  return {
    count,
    normalHours: count * AYLIK_CALISMA_SAATI,
    netTotal,
    netAverage: netTotal / count,
    overtimeHours,
    overtimeTotal,
    overtimeHourCost: overtimeHours > 0 ? overtimeTotal / overtimeHours : 0,
    grandTotal,
    leaveHours,
    reportHours,
  };
}

/**
 * BİR AYIN İZİN VE RAPOR SAATİ — hangi kaynağın konuştuğu dâhil.
 *
 * 13.08.2026'dan itibaren izin ve rapor KİŞİ BAZINDADIR (`hr_payroll`).
 * Devralınan 27 ayın değerleri ise AY DÜZEYİNDE geldi (`hr_periods`) ve
 * kişilere dağıtılamaz — uydurulmuş bir dağıtım, boş bir hücreden çok daha
 * pahalıdır.
 *
 * KURAL: iki kaynak asla TOPLANMAZ, biri diğerinin YERİNE geçer. Kişi
 * satırlarında tek bir saat bile varsa yalnız onlar sayılır; hiç yoksa
 * devralınan ay değeri okunur ve `devralinan: true` ile künyelenir — ekran
 * sayının nereden geldiğini söyleyebilsin.
 */
export function donemIzinRapor(
  rows: readonly PayrollRowLike[],
  legacy?: { leaveHours?: number | null; reportHours?: number | null } | null
): { leaveHours: number; reportHours: number; devralinan: boolean } {
  let leaveHours = 0;
  let reportHours = 0;
  for (const r of rows) {
    leaveHours += Number(r.leaveHours) || 0;
    reportHours += Number(r.reportHours) || 0;
  }
  if (leaveHours > 0 || reportHours > 0) {
    return { leaveHours, reportHours, devralinan: false };
  }
  const eskiIzin = Number(legacy?.leaveHours) || 0;
  const eskiRapor = Number(legacy?.reportHours) || 0;
  if (eskiIzin > 0 || eskiRapor > 0) {
    return { leaveHours: eskiIzin, reportHours: eskiRapor, devralinan: true };
  }
  return { leaveHours: 0, reportHours: 0, devralinan: false };
}

/**
 * Net çalışma saati — Excel'in "Aylık Çalışma Saatleri" sayfasındaki bağıntı:
 *
 *     normal + fazla mesai − izin − rapor
 *
 * İzin ve rapor saatleri AY DÜZEYİNDE tutulur (`hr_periods`), kişi başına
 * değil: firma bugün de öyle tutuyor. Kişi bazlı izin takibi ayrı bir fazdır
 * ve o gün geldiğinde bu bağıntının payandası değişmez, kaynağı değişir.
 */
export function netCalismaSaati(
  normalHours: number,
  overtimeHours: number,
  leaveHours: number | null | undefined,
  reportHours: number | null | undefined
): number {
  return normalHours + overtimeHours - (Number(leaveHours) || 0) - (Number(reportHours) || 0);
}

// ————————————————————————————————————————————————————————————————— dönemler

/** `2026-08-01` → `2026-08`. Dönem anahtarı gün taşımaz. */
export function periodKey(period: string): string {
  return period.slice(0, 7);
}

/** `2026-08` ya da `2026-08-01` → ayın ilk günü (`2026-08-01`). */
export function periodStart(period: string): string {
  return `${period.slice(0, 7)}-01`;
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** `2026-08` → "Ağustos 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${AY_ADLARI[i]} ${y}` : period;
}

/** `2026-08` → "AĞUSTOS 2026" (belge başlıkları). */
export function periodLabelUpper(period: string): string {
  return periodLabel(period).toLocaleUpperCase("tr-TR");
}

/** İki dönem arasındaki bütün ayları (dahil) sırayla üretir. */
export function periodRange(from: string, to: string): string[] {
  const [fy, fm] = periodKey(from).split("-").map(Number);
  const [ty, tm] = periodKey(to).split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  // 600 ay = 50 yıl: bozuk bir aralık sonsuz döngüye dönüşmesin.
  for (let i = 0; i < 600 && (y < ty || (y === ty && m <= tm)); i++) {
    out.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Bir günün ait olduğu dönem (`2026-08-11` → `2026-08`). */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

// ————————————————————————————————————————————————————————— hizmet süresi

/**
 * Bir çalışma döneminin gün sayısı. Bitiş verilmemişse `bugun`e kadar sayılır.
 *
 * Excel "HİZMET SÜRESİ (GÜN)" sütununu giriş–çıkış farkı olarak tutuyordu ve
 * BU TÜRETİLMİŞ bir sayıdır; saklanmaz, sorulduğunda hesaplanır.
 */
export function hizmetGunu(
  start: string | null | undefined,
  end: string | null | undefined,
  bugun: string
): number {
  if (!start) return 0;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${(end || bugun)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Gün → "2 yıl 6 ay" biçiminde okunur süre. */
export function hizmetSuresiMetni(gun: number): string {
  if (gun <= 0) return "—";
  const ay = Math.floor(gun / 30);
  const yil = Math.floor(ay / 12);
  const kalanAy = ay % 12;
  if (yil > 0 && kalanAy > 0) return `${yil} yıl ${kalanAy} ay`;
  if (yil > 0) return `${yil} yıl`;
  if (ay > 0) return `${ay} ay`;
  return `${gun} gün`;
}

/** Doğum tarihinden yaş (tam yıl). */
export function yas(birthDate: string | null | undefined, bugun: string): number | null {
  if (!birthDate) return null;
  const d = Date.parse(`${birthDate}T00:00:00Z`);
  const t = Date.parse(`${bugun}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(t) || t < d) return null;
  return Math.floor((t - d) / (365.2425 * 86_400_000));
}
