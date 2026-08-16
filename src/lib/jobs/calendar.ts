// Takvim çekirdeği — SAF (DB/HTTP/Date.now yok; "bugün" parametredir).
//
// PANODAKİ "takvim ızgarası yok" kararı PANONUN kararıydı (oradaki soru
// "yaklaşan ne var"dı ve şerit yetiyordu); İşler'in takvim görünümünü
// kullanıcı AÇIKÇA istedi (16.08.2026) — burada soru "bu AYIN yükü ne".
// Izgara masaüstünde ay tablosudur; telefonda ay AJANDAYA katlanır
// (küçültülmüş ızgara değil — md. 15 ruhu).
//
// Tarih matematiği METİN üzerindedir ("YYYY-MM-DD" karşılaştırılabilir):
// Date nesnesi yalnız hafta gününü bulmak için ve UTC sabitiyle kurulur —
// yerel saat dilimi ay sınırında gün kaydırırdı.

export interface CalendarEntry {
  /** "YYYY-MM-DD" */
  date: string;
  kind: "atolye" | "teslim" | "gorev" | "termin" | "sevk";
  label: string;
  href: string;
}

export const CALENDAR_KIND_LABELS: Record<CalendarEntry["kind"], string> = {
  atolye: "Atölye Çıkış",
  teslim: "Teslim",
  gorev: "Görev",
  termin: "Termin",
  sevk: "Sevk",
};

const AY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Ay kaydırma: "2026-01" - 1 → "2025-12". */
export function monthShift(ay: string, delta: number): string {
  const m = AY_RE.exec(ay);
  if (!m) return ay;
  const toplam = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const yil = Math.floor(toplam / 12);
  const ayNo = (toplam % 12) + 1;
  return `${String(yil).padStart(4, "0")}-${String(ayNo).padStart(2, "0")}`;
}

export function monthLabel(ay: string): string {
  const m = AY_RE.exec(ay);
  if (!m) return ay;
  const AYLAR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  return `${AYLAR[Number(m[2]) - 1]} ${m[1]}`;
}

function isoGun(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Ayın ızgarası: PAZARTESİ başlangıçlı tam haftalar. Komşu ayın dolgu
 * günleri de ISO tarih taşır (soluk basılır) — boş hücre, "ayın 1'i hangi
 * sütunda" sorusunu okuyucuya bırakırdı.
 */
export function monthGrid(ay: string): string[][] {
  const m = AY_RE.exec(ay);
  if (!m) return [];
  const yil = Number(m[1]);
  const ayNo = Number(m[2]);

  // UTC sabit: yerel saat dilimi gece yarısı sınırında günü kaydırabilir.
  const ilkGun = new Date(Date.UTC(yil, ayNo - 1, 1));
  // JS pazar=0; pazartesi başlangıçlı ofset.
  const ofset = (ilkGun.getUTCDay() + 6) % 7;

  const haftalar: string[][] = [];
  const imlec = new Date(Date.UTC(yil, ayNo - 1, 1 - ofset));
  // Ay en fazla 6 haftaya yayılır; ay bitince döngü durur.
  for (let h = 0; h < 6; h++) {
    const hafta: string[] = [];
    for (let g = 0; g < 7; g++) {
      hafta.push(
        isoGun(imlec.getUTCFullYear(), imlec.getUTCMonth() + 1, imlec.getUTCDate())
      );
      imlec.setUTCDate(imlec.getUTCDate() + 1);
    }
    haftalar.push(hafta);
    const sonraki = isoGun(
      imlec.getUTCFullYear(),
      imlec.getUTCMonth() + 1,
      imlec.getUTCDate()
    );
    if (monthOf(sonraki) !== ay && h >= 3) break;
  }
  return haftalar;
}

/** Girdileri güne dağıtır; yalnız verilen ayın girdileri döner. */
export function entriesByDay(
  entries: readonly CalendarEntry[],
  ay: string
): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    if (monthOf(e.date) !== ay) continue;
    const liste = out.get(e.date);
    if (liste) liste.push(e);
    else out.set(e.date, [e]);
  }
  return out;
}

/** Ajanda (telefon): ayın günleri tarih sırasıyla, yalnız dolu günler. */
export function agendaDays(
  entries: readonly CalendarEntry[],
  ay: string
): { date: string; entries: CalendarEntry[] }[] {
  const gunler = entriesByDay(entries, ay);
  return [...gunler.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({ date, entries: list }));
}
