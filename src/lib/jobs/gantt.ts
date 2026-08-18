// Zaman çizelgesi çekirdeği — SAF.
//
// PENCERE AYLARA OTURUR (kullanıcı bildirimi, 18.08.2026: *"zaman
// gösteriminden bir şey anlaşılmıyor. Bizim işlerimiz genelde aylar
// sürüyor."*). Eskiden pencere işlerin ham min-maks aralığıydı ve eksende
// HİÇBİR İŞARET YOKTU: çubuklar bir çizgide yüzüyor, "bu iş hangi ay
// başlıyor" sorusu ancak satırın ucundaki tarihe bakılarak cevaplanıyordu.
// Artık pencere ay sınırlarına yuvarlanır ve `months` ile ay ay bölünür;
// görünüm o bölmeleri başlık ve ızgara çizgisi olarak basar. İşin süresi de
// AY cinsinden hesaplanır — okunacak birim gün değil aydır.
//
// EKSEN YİNE KAYDIRMAZ: her çubuk kap genişliğine ORANLANIR, yatay kaydırılan
// bir tuval yoktur (md. 15).
//
// Başlangıç = iş emri tarihi (yoksa kayıt); bitiş = teslim tarihi (yoksa
// "bugün"e kadar sürer — biten bir şey UYDURULMAZ, çubuk açık uçlu işaretlenir).

export interface GanttRowInput {
  id: string;
  start: string | null;
  end: string | null;
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
  /** Süre — ay cinsinden, bir ondalıkla ("aylar süren iş" ölçeği). */
  aySuresi: number;
}

/** Eksendeki bir ay dilimi — başlık ve ızgara çizgisi bundan çıkar. */
export interface GanttMonth {
  /** "YYYY-MM" */
  ay: string;
  /** Dilimin sol kenarı ve genişliği, [0..100]. */
  leftPct: number;
  widthPct: number;
}

function gunSayisi(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Ayın ilk günü: "2026-08-17" → "2026-08-01". */
function ayBasi(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Bir sonraki ayın ilk günü — dilim genişliği bu farktan çıkar. */
function sonrakiAyBasi(iso: string): string {
  const yil = Number(iso.slice(0, 4));
  const ay = Number(iso.slice(5, 7));
  const y = ay === 12 ? yil + 1 : yil;
  const a = ay === 12 ? 1 : ay + 1;
  return `${String(y).padStart(4, "0")}-${String(a).padStart(2, "0")}-01`;
}

export interface GanttModel {
  /** Pencere — AY SINIRINA yuvarlanmış hâli. */
  min: string;
  max: string;
  bars: GanttBar[];
  months: GanttMonth[];
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

  let ham = bars[0].start;
  let hamSon = bars[0].end;
  for (const b of bars) {
    if (b.start < ham) ham = b.start;
    if (b.end > hamSon) hamSon = b.end;
  }
  // Pencere AY SINIRINA yuvarlanır: eksenin ilk ve son dilimi yarım kalmaz,
  // yani "Ocak" başlığı gerçekten ocağın 1'inden başlar.
  const min = ayBasi(ham);
  const max = sonrakiAyBasi(hamSon);
  const pencere = Math.max(1, gunSayisi(min, max));

  const months: GanttMonth[] = [];
  for (let imlec = min; imlec < max; imlec = sonrakiAyBasi(imlec)) {
    const sonrasi = sonrakiAyBasi(imlec);
    months.push({
      ay: imlec.slice(0, 7),
      leftPct: (gunSayisi(min, imlec) / pencere) * 100,
      widthPct: (gunSayisi(imlec, sonrasi) / pencere) * 100,
    });
  }

  return {
    min,
    max,
    months,
    bars: bars.map((b) => {
      const left = (gunSayisi(min, b.start) / pencere) * 100;
      // En az %1,5 genişlik: tek günlük iş görünmez bir çizgiye inmesin.
      const width = Math.max(1.5, (gunSayisi(b.start, b.end) / pencere) * 100);
      return {
        ...b,
        leftPct: Math.min(left, 98.5),
        widthPct: Math.min(width, 100 - Math.min(left, 98.5)),
        // Ay = 30,44 gün (ortalama). Takvim ayı saymak yerine sabit bir bölen
        // kullanılır: okunacak şey "yaklaşık kaç ay sürüyor"dur, ayın kaç gün
        // çektiği değil.
        aySuresi: Math.round((gunSayisi(b.start, b.end) / 30.44) * 10) / 10,
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
