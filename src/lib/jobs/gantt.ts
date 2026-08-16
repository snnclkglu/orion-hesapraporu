// Zaman çizelgesi çekirdeği — SAF.
//
// EKSEN KAYDIRMAZ: pencere, süzülmüş işlerin en erken başlangıcından en geç
// bitişine uzanır ve her çubuk kap genişliğine ORANLANIR. Böylece görünüm
// telefonda da masaüstünde de aynı düzendir — yatay kaydırılan bir tuval
// yoktur (md. 15). Gün hassasiyeti yüzdeye çevrilir; okunacak şey tarih
// değil ÖRTÜŞMEdir, tarih zaten satırda yazar.
//
// Başlangıç = iş emri tarihi (yoksa kayıt); bitiş = teslim tarihi (yoksa en
// geç termin, o da yoksa "bugün"e kadar sürer — biten bir şey UYDURULMAZ,
// çubuk açık uçlu işaretlenir).

export interface GanttRowInput {
  id: string;
  start: string | null;
  end: string | null;
  /** Bitişi olmayan iş için pencerenin sağ kenarı: bugün. */
}

export interface GanttBar {
  id: string;
  start: string;
  end: string;
  /** Bitiş veriden mi geldi, yoksa "bugüne kadar sürüyor" mu? */
  openEnded: boolean;
  /** [0..100] — pencere içi konum ve genişlik. */
  leftPct: number;
  widthPct: number;
}

function gunSayisi(a: string, b: string): number {
  const ms =
    Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface GanttModel {
  min: string;
  max: string;
  bars: GanttBar[];
}

export function buildGantt(
  rows: readonly GanttRowInput[],
  today: string
): GanttModel | null {
  const bars: { id: string; start: string; end: string; openEnded: boolean }[] = [];
  for (const r of rows) {
    const start = r.start;
    if (!start) continue; // tarihi hiç olmayan iş çizilmez, listede kalır
    const openEnded = !r.end;
    const end = r.end ?? (today > start ? today : start);
    bars.push({ id: r.id, start, end: end < start ? start : end, openEnded });
  }
  if (bars.length === 0) return null;

  let min = bars[0].start;
  let max = bars[0].end;
  for (const b of bars) {
    if (b.start < min) min = b.start;
    if (b.end > max) max = b.end;
  }
  const pencere = Math.max(1, gunSayisi(min, max));

  return {
    min,
    max,
    bars: bars.map((b) => {
      const left = (gunSayisi(min, b.start) / pencere) * 100;
      // En az %1,5 genişlik: tek günlük iş görünmez bir çizgiye inmesin.
      const width = Math.max(1.5, (gunSayisi(b.start, b.end) / pencere) * 100);
      return {
        ...b,
        leftPct: Math.min(left, 98.5),
        widthPct: Math.min(width, 100 - Math.min(left, 98.5)),
      };
    }),
  };
}

/** Bugün imleci: pencere içindeyse [0..100], değilse null. */
export function todayMarker(model: GanttModel, today: string): number | null {
  if (today < model.min || today > model.max) return null;
  const pencere = Math.max(1, gunSayisi(model.min, model.max));
  return (gunSayisi(model.min, today) / pencere) * 100;
}
