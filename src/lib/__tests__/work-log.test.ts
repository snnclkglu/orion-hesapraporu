// İş Takibi toplama çekirdeği testleri.
//
// Sınanan şey ARİTMETİK DEĞİL, panonun söylediği cümlelerin doğruluğudur:
// pay toplamı bire eşit mi, boş ay grafikten düşüyor mu, karşılaştırma dönemi
// gerçekten eşit uzunlukta mı, hafta pazartesi başlıyor mu. Bunlar sessizce
// bozulduğunda ekran yine "çalışır" ama yanlış sayı gösterir.

import { describe, expect, it } from "vitest";
import {
  bucketKey,
  bucketLabel,
  breakdown,
  cellKey,
  downloadName,
  fmtDateLong,
  isWeekend,
  periodRange,
  pivot,
  previousPeriod,
  shiftDay,
  summarize,
  timeSeries,
  todayIso,
  weekStart,
  type WorkLogRow,
} from "@/lib/work-log";

function row(p: Partial<WorkLogRow> & { date: string; people: number; hours: number }): WorkLogRow {
  return {
    id: `${p.date}-${p.partName ?? ""}-${p.categoryName ?? ""}-${p.people}`,
    itemNo: "0025-00",
    jobId: "job-25",
    jobItemId: "item-25",
    jobNo: "0025",
    jobTitle: "Kütük Holü Vinci",
    customer: "İZMİR DEMİR ÇELİK SANAYİ A.Ş.",
    customerShort: "İDÇ",
    customerHue: 120,
    productName: "20 t x 30 m Vinç",
    partId: "part-anakiris",
    partName: "Ana Kiriş",
    categoryId: "cat-celik",
    categoryName: "Çelik İmalat",
    categoryHue: 25,
    partCode: "0200",
    note: "",
    ...p,
    manHours: p.people * p.hours,
  } as WorkLogRow;
}

describe("breakdown", () => {
  const rows = [
    row({ date: "2026-01-05", people: 2, hours: 8 }), // Ana Kiriş 16
    row({ date: "2026-01-06", people: 2, hours: 8, partId: "p2", partName: "Kabin" }), // 16
    row({ date: "2026-01-07", people: 1, hours: 8, partId: "p2", partName: "Kabin" }), // 8
  ];

  it("adam·saate göre büyükten küçüğe sıralar (kayıt sayısına değil)", () => {
    const b = breakdown(rows, "part");
    expect(b.map((x) => x.label)).toEqual(["Kabin", "Ana Kiriş"]);
    expect(b[0].manHours).toBe(24);
    expect(b[0].records).toBe(2);
    expect(b[1].manHours).toBe(16);
  });

  it("eşitlikte ad sırası belirler — sonuç her açılışta aynıdır", () => {
    const tie = [
      row({ date: "2026-01-05", people: 3, hours: 8, partId: "pk", partName: "Kabin" }), // 24
      row({ date: "2026-01-06", people: 3, hours: 8 }), // Ana Kiriş 24
    ];
    expect(breakdown(tie, "part").map((x) => x.label)).toEqual(["Ana Kiriş", "Kabin"]);
  });

  it("payların toplamı bire eşittir", () => {
    const b = breakdown(rows, "part");
    expect(b.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
  });

  it("boş kırılımda çöker değil boş döner", () => {
    expect(breakdown([], "item")).toEqual([]);
  });

  it("eşleşmemiş kayıt kendi kovasına düşer, düşürülmez", () => {
    const orphan = row({ date: "2026-02-01", people: 5, hours: 8, jobNo: "", jobId: null });
    const b = breakdown([...rows, orphan], "job");
    expect(b.some((x) => x.label === "—")).toBe(true);
    expect(b.reduce((s, x) => s + x.manHours, 0)).toBe(16 + 16 + 8 + 40);
  });

  it("ipucu ilk DOLU değerde sabitlenir — boş olan kazanmaz", () => {
    const withProduct = row({ date: "2026-03-01", people: 1, hours: 8 });
    const withoutProduct = row({ date: "2026-03-02", people: 1, hours: 8, productName: "" });
    expect(breakdown([withoutProduct, withProduct], "item")[0].hint).toBe("20 t x 30 m Vinç");
  });
});

describe("zaman ekseni", () => {
  it("hafta PAZARTESİ başlar — pazar bir önceki haftaya yazılır", () => {
    // 2026-08-09 pazar, 2026-08-10 pazartesi
    expect(weekStart("2026-08-09")).toBe("2026-08-03");
    expect(weekStart("2026-08-10")).toBe("2026-08-10");
    expect(weekStart("2026-08-03")).toBe("2026-08-03");
  });

  it("kova anahtarı sıralanabilir (ISO tabanlı)", () => {
    expect(bucketKey("2026-01-05", "month")).toBe("2026-01");
    expect(bucketKey("2026-01-05", "day")).toBe("2026-01-05");
    expect(["2026-01", "2025-12"].sort()).toEqual(["2025-12", "2026-01"]);
  });

  it("ay etiketi Türkçe kısaltmadır", () => {
    expect(bucketLabel("2026-01", "month")).toBe("Oca 26");
    expect(bucketLabel("2025-12", "month")).toBe("Ara 25");
  });

  it("kayıtsız aylar seriye BOŞ sütun olarak girer", () => {
    const rows = [
      row({ date: "2025-11-10", people: 2, hours: 8 }),
      row({ date: "2026-02-10", people: 2, hours: 8 }),
    ];
    const s = timeSeries(rows, "month", "category");
    expect(s.map((p) => p.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(s[1].total).toBe(0);
    expect(s[1].records).toBe(0);
  });

  it("yıl sınırında ay adımı doğru atlar", () => {
    const rows = [
      row({ date: "2025-12-31", people: 1, hours: 8 }),
      row({ date: "2026-01-01", people: 1, hours: 8 }),
    ];
    expect(timeSeries(rows, "month").map((p) => p.key)).toEqual(["2025-12", "2026-01"]);
  });

  it("seri kırılımı toplamı sütun toplamına eşittir", () => {
    const rows = [
      row({ date: "2026-01-05", people: 3, hours: 8 }),
      row({
        date: "2026-01-06",
        people: 2,
        hours: 8,
        categoryId: "cat-talasli",
        categoryName: "Talaşlı İmalat",
      }),
    ];
    const [point] = timeSeries(rows, "month", "category");
    const sum = Object.values(point.parts).reduce((s, v) => s + v, 0);
    expect(sum).toBe(point.total);
    expect(point.total).toBe(40);
  });

  it("günlük kovada tek gün tek sütundur", () => {
    const rows = [
      row({ date: "2026-01-05", people: 3, hours: 8 }),
      row({ date: "2026-01-05", people: 1, hours: 4, partId: "p2", partName: "Kabin" }),
    ];
    const s = timeSeries(rows, "day");
    expect(s).toHaveLength(1);
    expect(s[0].total).toBe(28);
  });
});

describe("pivot", () => {
  const rows = [
    row({ date: "2026-01-05", people: 3, hours: 8 }),
    row({
      date: "2026-01-06",
      people: 2,
      hours: 8,
      partId: "p2",
      partName: "Kabin",
      categoryId: "cat-talasli",
      categoryName: "Talaşlı İmalat",
    }),
  ];

  it("hücrelerin toplamı genel toplama eşittir", () => {
    const p = pivot(rows, "part", "category");
    const sum = [...p.cells.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(p.total);
    expect(p.total).toBe(40);
  });

  it("boş kesişim haritada YOKTUR (tabloda tire olarak çizilir)", () => {
    const p = pivot(rows, "part", "category");
    expect(p.cells.get(cellKey("part-anakiris", "cat-talasli"))).toBeUndefined();
    expect(p.cells.get(cellKey("part-anakiris", "cat-celik"))).toBe(24);
  });
});

describe("dönemler", () => {
  it("ön tanımlı dönemler ay sonlarını doğru bulur", () => {
    expect(periodRange("thisMonth", "2026-02-09")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    // 2024 artık yıl
    expect(periodRange("thisMonth", "2024-02-09").to).toBe("2024-02-29");
    expect(periodRange("lastMonth", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("son 3 ay İÇİNDE BULUNULAN ayı da kapsar", () => {
    expect(periodRange("last3", "2026-08-09")).toEqual({ from: "2026-06-01", to: "2026-08-31" });
    expect(periodRange("last6", "2026-02-09")).toEqual({ from: "2025-09-01", to: "2026-02-28" });
  });

  it("sınırsız dönemin karşılaştırması yoktur", () => {
    expect(previousPeriod({ from: "", to: "" })).toBeNull();
  });

  it("önceki dönem EŞİT uzunlukta ve bitişiktir", () => {
    const prev = previousPeriod({ from: "2026-02-01", to: "2026-02-28" });
    expect(prev).toEqual({ from: "2026-01-04", to: "2026-01-31" });
    // 28 gün, hemen öncesinde bitiyor
    const days =
      (new Date(`${prev!.to}T00:00:00Z`).getTime() -
        new Date(`${prev!.from}T00:00:00Z`).getTime()) /
        86_400_000 +
      1;
    expect(days).toBe(28);
  });
});

describe("özet", () => {
  it("çalışılan gün sayısı ve günlük ortalama", () => {
    const rows = [
      row({ date: "2026-01-05", people: 3, hours: 8 }), // 24
      row({ date: "2026-01-05", people: 1, hours: 8, partId: "p2", partName: "Kabin" }), // 8
      row({ date: "2026-01-06", people: 2, hours: 8 }), // 16
    ];
    const s = summarize(rows);
    expect(s.manHours).toBe(48);
    expect(s.days).toBe(2);
    expect(s.dailyAverage).toBe(24);
    expect(s.peakDate).toBe("2026-01-05");
    expect(s.peakManHours).toBe(32);
  });

  it("işe bağlanmamış kayıtlar ayrıca sayılır", () => {
    const rows = [
      row({ date: "2026-01-05", people: 3, hours: 8 }),
      row({ date: "2026-01-06", people: 3, hours: 8, jobId: null, jobNo: "" }),
    ];
    expect(summarize(rows).unmatched).toBe(1);
  });

  it("boş kümede bölme hatası vermez", () => {
    const s = summarize([]);
    expect(s.dailyAverage).toBe(0);
    expect(s.manHours).toBe(0);
  });
});

describe("tarih yardımcıları", () => {
  it("gün kaydırma ay ve yıl sınırını aşar", () => {
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("hafta sonu tespiti", () => {
    expect(isWeekend("2026-08-08")).toBe(true); // cumartesi
    expect(isWeekend("2026-08-09")).toBe(true); // pazar
    expect(isWeekend("2026-08-10")).toBe(false); // pazartesi
  });

  it("uzun tarih gün adını Türkçe verir", () => {
    expect(fmtDateLong("2026-08-10")).toBe("10.08.2026 · Pazartesi");
  });

  it("bugün YEREL takvim gününü verir (UTC'ye kaymaz)", () => {
    // Yerel saatle 23:30 — UTC+3'te UTC günü henüz bir öncekidir.
    const local = new Date(2026, 7, 9, 23, 30, 0);
    expect(todayIso(local)).toBe("2026-08-09");
  });
});

describe("indirilen dosya adı", () => {
  it("tarih ve saat taşır, saatte iki nokta bulunmaz", () => {
    const name = downloadName("ORION İş Takibi", "xlsx", new Date(2026, 7, 9, 14, 32));
    expect(name).toBe("ORION İş Takibi 09.08.2026 14-32.xlsx");
    expect(name).not.toContain(":");
  });

  it("tek haneli gün/ay/saat sıfırla doldurulur", () => {
    expect(downloadName("X", "xlsx", new Date(2026, 0, 3, 5, 7))).toBe("X 03.01.2026 05-07.xlsx");
  });
});
