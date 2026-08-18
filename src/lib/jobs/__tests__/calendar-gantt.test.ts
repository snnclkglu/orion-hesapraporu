// Takvim + zaman çizelgesi çekirdek sözleşmeleri.

import { describe, expect, it } from "vitest";
import {
  agendaDays,
  entriesByDay,
  monthGrid,
  monthLabel,
  monthOf,
  monthShift,
  type CalendarEntry,
} from "../calendar";
import { buildGantt, todayMarker } from "../gantt";

describe("monthShift / monthLabel", () => {
  it("yıl sınırından geçer", () => {
    expect(monthShift("2026-01", -1)).toBe("2025-12");
    expect(monthShift("2026-12", 1)).toBe("2027-01");
    expect(monthShift("2026-08", 0)).toBe("2026-08");
  });
  it("Türkçe ay adı basar", () => {
    expect(monthLabel("2026-08")).toBe("Ağustos 2026");
  });
});

describe("monthGrid", () => {
  it("pazartesi başlar, tam haftalar döner", () => {
    // Ağustos 2026: 1'i cumartesi → ilk hafta 27 Temmuz pazartesiyle başlar.
    const g = monthGrid("2026-08");
    expect(g[0][0]).toBe("2026-07-27");
    expect(g[0][5]).toBe("2026-08-01");
    // Her hafta 7 gün.
    for (const h of g) expect(h).toHaveLength(7);
    // Son hafta ayın son gününü içerir.
    const duz = g.flat();
    expect(duz).toContain("2026-08-31");
  });

  it("bozuk ay boş döner", () => {
    expect(monthGrid("çöp")).toEqual([]);
  });
});

describe("entriesByDay / agendaDays", () => {
  const entries: CalendarEntry[] = [
    { date: "2026-08-05", kind: "teslim", label: "0055", href: "/jobs/a" },
    { date: "2026-08-05", kind: "gorev", label: "görev", href: "/jobs/a/gorevler" },
    { date: "2026-09-01", kind: "termin", label: "0057", href: "/jobs/b" },
  ];

  it("yalnız verilen ayın girdileri dağıtılır", () => {
    const m = entriesByDay(entries, "2026-08");
    expect(m.get("2026-08-05")).toHaveLength(2);
    expect(m.has("2026-09-01")).toBe(false);
  });

  it("ajanda yalnız dolu günleri tarih sırasıyla verir", () => {
    const g = agendaDays(entries, "2026-08");
    expect(g).toHaveLength(1);
    expect(g[0].date).toBe("2026-08-05");
  });

  it("monthOf ayı kırpar", () => {
    expect(monthOf("2026-08-05")).toBe("2026-08");
  });
});

describe("buildGantt", () => {
  const today = "2026-08-16";

  // PENCERE AY SINIRINA YUVARLANIR (18.08.2026): eksenin ilk ve son dilimi
  // yarım kalmasın diye min ayın 1'ine, maks bir SONRAKİ ayın 1'ine oturur.
  // Ay başlıkları ancak böyle gerçekten o ayı gösterir.
  it("pencere AY SINIRINA oturur; oranlar [0..100]", () => {
    const m = buildGantt(
      [
        { id: "a", start: "2026-01-15", end: "2026-06-30" },
        { id: "b", start: "2026-04-01", end: "2026-12-31" },
      ],
      today
    );
    expect(m).not.toBeNull();
    expect(m!.min).toBe("2026-01-01");
    expect(m!.max).toBe("2027-01-01");
    const a = m!.bars.find((b) => b.id === "a")!;
    expect(a.leftPct).toBeGreaterThan(0);
    expect(a.leftPct).toBeLessThan(5);
    expect(a.widthPct).toBeGreaterThan(40);
    expect(a.widthPct).toBeLessThan(50);
  });

  it("eksen AY AY bölünür — dilimler bitişik ve tam", () => {
    const m = buildGantt([{ id: "a", start: "2026-01-10", end: "2026-03-20" }], today)!;
    expect(m.months.map((x) => x.ay)).toEqual(["2026-01", "2026-02", "2026-03"]);
    // Dilimler birbirini takip eder ve toplamı %100'dür.
    const toplam = m.months.reduce((t, x) => t + x.widthPct, 0);
    expect(toplam).toBeCloseTo(100, 6);
    expect(m.months[0].leftPct).toBe(0);
    expect(m.months[1].leftPct).toBeCloseTo(m.months[0].widthPct, 6);
  });

  it("süre AY cinsinden okunur — işler aylar sürer", () => {
    const m = buildGantt([{ id: "a", start: "2026-01-01", end: "2026-07-01" }], today)!;
    // 181 gün / 30,44 ≈ 5,9 ay
    expect(m.bars[0].aySuresi).toBeGreaterThan(5.5);
    expect(m.bars[0].aySuresi).toBeLessThan(6.5);
  });

  it("bitişi olmayan iş BUGÜNE kadar sürer ve açık uçlu işaretlenir", () => {
    const m = buildGantt([{ id: "a", start: "2026-08-01", end: null }], today);
    const a = m!.bars[0];
    expect(a.end).toBe(today);
    expect(a.openEnded).toBe(true);
  });

  it("başlangıcı olmayan iş çizilmez; hiç çizilecek yoksa null", () => {
    expect(buildGantt([{ id: "a", start: null, end: null }], today)).toBeNull();
  });

  it("tek günlük iş görünür kalır (asgari genişlik)", () => {
    const m = buildGantt(
      [
        { id: "a", start: "2026-01-01", end: "2026-01-01" },
        { id: "b", start: "2026-01-01", end: "2026-12-31" },
      ],
      today
    );
    const a = m!.bars.find((b) => b.id === "a")!;
    expect(a.widthPct).toBeGreaterThanOrEqual(1.5);
  });

  it("bugün imleci pencere dışında null", () => {
    const m = buildGantt(
      [{ id: "a", start: "2024-01-01", end: "2024-06-30" }],
      today
    )!;
    expect(todayMarker(m, today)).toBeNull();
    const m2 = buildGantt(
      [{ id: "a", start: "2026-08-01", end: "2026-08-31" }],
      today
    )!;
    const isaret = todayMarker(m2, today);
    expect(isaret).toBeGreaterThan(0);
    expect(isaret).toBeLessThan(100);
  });
});
