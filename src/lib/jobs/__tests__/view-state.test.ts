// İşler görünüm durumu + süzgeç çekirdeği — sözleşme testleri.
//
// Adres sözleşmesi iki tüketicilidir (tablo + Excel ucu); buradaki turlar
// ikisinin ortak dilini dondurur: gidiş-dönüş kayıpsızdır, bozuk değer
// varsayılana düşer, varsayılan adrese yazılmaz.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOB_SORT,
  configToState,
  parseJobSort,
  readJobsViewState,
  resolveYear,
  savedViewConfigSchema,
  serializeJobSort,
  stateToConfig,
  writeJobsViewState,
  type JobsViewState,
} from "../view-state";
import {
  describeJobFilters,
  jobYear,
  matchesJobFilters,
  naturalDesc,
  sortJobs,
  type JobListRow,
} from "../filter";

function row(over: Partial<JobListRow> = {}): JobListRow {
  return {
    job_no: "0055",
    title: "AMONYUM SÜLFAT TESİSİ VİNCİ",
    customer: "İSKENDERUN DEMİR VE ÇELİK A.Ş.",
    customerShort: "İSDEMİR",
    status: "active",
    work_order_date: "2026-05-11",
    created_at: "2026-05-11T09:00:00Z",
    itemCount: 1,
    craneCount: 1,
    ...over,
  };
}

describe("adres sözleşmesi", () => {
  it("boş adres varsayılanları verir", () => {
    const s = readJobsViewState(new URLSearchParams());
    expect(s.view).toBe("tablo");
    expect(s.yil).toBeUndefined();
    expect(s.musteri).toEqual([]);
    expect(s.durum).toEqual([]);
    expect(s.q).toBe("");
    expect(s.sirala).toEqual(DEFAULT_JOB_SORT);
    expect(s.grup).toBe("durum");
    expect(s.ay).toBeUndefined();
  });

  it("gidiş-dönüş kayıpsızdır", () => {
    const state: JobsViewState = {
      view: "pano",
      yil: "2025",
      musteri: ["ASTOR ENERJİ A.Ş.", "LITEC MAKİNA SAN. VE TİC. A.Ş."],
      durum: ["active", "passive"],
      q: "vinç",
      sirala: { key: "date", desc: false },
      grup: "musteri",
      ay: "2026-08",
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(writeJobsViewState(state))) {
      if (v) p.set(k, v);
    }
    expect(readJobsViewState(p)).toEqual(state);
  });

  it("varsayılan değerler adrese YAZILMAZ", () => {
    const s = readJobsViewState(new URLSearchParams());
    const out = writeJobsViewState(s);
    expect(Object.values(out).every((v) => v === undefined)).toBe(true);
  });

  it("bozuk değer varsayılana düşer, fırlatmaz", () => {
    const p = new URLSearchParams(
      "view=uzay&yil=abc&sirala=yok.desc&grup=x&ay=2026-13"
    );
    const s = readJobsViewState(p);
    expect(s.view).toBe("tablo");
    expect(s.yil).toBeUndefined();
    expect(s.sirala).toEqual(DEFAULT_JOB_SORT);
    expect(s.grup).toBe("durum");
    expect(s.ay).toBeUndefined();
  });

  it("sıralama yalnız varsayılandan sapınca yazılır", () => {
    expect(serializeJobSort(DEFAULT_JOB_SORT)).toBeUndefined();
    expect(serializeJobSort({ key: "date", desc: true })).toBe("date.desc");
    expect(parseJobSort("title.asc")).toEqual({ key: "title", desc: false });
    // Yön eksikse büyükten küçüğe okunur (varsayılan yönle tutarlı).
    expect(parseJobSort("date")).toEqual({ key: "date", desc: true });
  });
});

describe("resolveYear", () => {
  it("seçim her zaman kazanır", () => {
    expect(resolveYear("2024", ["2026", "2024"], "2026")).toBe("2024");
    expect(resolveYear("tumu", ["2026"], "2026")).toBe("tumu");
  });
  it("seçim yoksa bu yıl; bu yıl defterde yoksa tümü", () => {
    expect(resolveYear(undefined, ["2026", "2025"], "2026")).toBe("2026");
    expect(resolveYear(undefined, ["2024", "2025"], "2026")).toBe("tumu");
  });
});

describe("matchesJobFilters", () => {
  const base = { yil: "tumu", musteri: [], durum: [], q: "" };

  it("yıl iş emri tarihinden, o yoksa kayıt tarihinden okunur", () => {
    expect(jobYear(row())).toBe("2026");
    expect(jobYear(row({ work_order_date: null, created_at: "2024-01-05T00:00:00Z" }))).toBe("2024");
    expect(matchesJobFilters(row(), { ...base, yil: "2026" })).toBe(true);
    expect(matchesJobFilters(row(), { ...base, yil: "2025" })).toBe(false);
  });

  it("müşteri süzgeci TAM UNVANLA eşleşir", () => {
    expect(
      matchesJobFilters(row(), {
        ...base,
        musteri: ["İSKENDERUN DEMİR VE ÇELİK A.Ş."],
      })
    ).toBe(true);
    expect(matchesJobFilters(row(), { ...base, musteri: ["ASTOR"] })).toBe(false);
  });

  it("durum süzgeci bilinmeyen değeri güvenli varsayılana indirger", () => {
    expect(matchesJobFilters(row({ status: "garip" }), { ...base, durum: ["active"] })).toBe(true);
    expect(matchesJobFilters(row(), { ...base, durum: ["completed"] })).toBe(false);
  });

  it("arama Türkçe katlamayla ve parça parça eşleşir", () => {
    // Küçük yazılan "isdemir" BÜYÜK saklanan kısaltmayı bulur.
    expect(matchesJobFilters(row(), { ...base, q: "isdemir" })).toBe(true);
    expect(matchesJobFilters(row(), { ...base, q: "ISDEMIR" })).toBe(true);
    // Çok parçalı sorgu: her parça AYNI satırın birleşik metninde geçmeli.
    expect(matchesJobFilters(row(), { ...base, q: "isdemir sülfat" })).toBe(true);
    expect(matchesJobFilters(row(), { ...base, q: "isdemir pergel" })).toBe(false);
  });
});

describe("sortJobs", () => {
  const rows = [
    row({ job_no: "0053", title: "B", itemCount: 3 }),
    row({ job_no: "0057", title: "A", itemCount: 1 }),
    row({ job_no: "0055", title: "C", itemCount: 2 }),
  ];

  it("iş no sayısal-doğal sıralanır", () => {
    const out = sortJobs(rows, { key: "job_no", desc: true });
    expect(out.map((r) => r.job_no)).toEqual(["0057", "0055", "0053"]);
  });

  it("sayısal alan sayı olarak karşılaştırılır", () => {
    const out = sortJobs(rows, { key: "itemCount", desc: false });
    expect(out.map((r) => r.itemCount)).toEqual([1, 2, 3]);
  });

  it("doğal yön: metin artan, sayı/tarih azalan", () => {
    expect(naturalDesc("title")).toBe(false);
    expect(naturalDesc("customer")).toBe(false);
    expect(naturalDesc("status")).toBe(false);
    expect(naturalDesc("job_no")).toBe(true);
    expect(naturalDesc("date")).toBe(true);
  });
});

describe("kayıtlı görünüm sözleşmesi (v1)", () => {
  it("durum → config → durum turu kayıpsızdır (ay hariç — bilinçli)", () => {
    const state: JobsViewState = {
      view: "takvim",
      yil: "tumu",
      musteri: ["ASTOR ENERJİ A.Ş."],
      durum: ["active"],
      q: "vinç",
      sirala: { key: "customer", desc: false },
      grup: "yil",
      ay: "2026-08",
    };
    const back = configToState(stateToConfig(state));
    expect(back).toEqual({ ...state, ay: undefined });
  });

  it("bilinmeyen alan sessizce düşer, bozuk kayıt null döner", () => {
    const parsed = savedViewConfigSchema.safeParse({
      v: 1,
      view: "pano",
      gelecektenBirAlan: 42,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("gelecektenBirAlan" in parsed.data).toBe(false);
    }
    expect(configToState({ v: 2, view: "pano" })).toBeNull();
    expect(configToState("çöp")).toBeNull();
  });
});

describe("describeJobFilters", () => {
  it("künye insan okunur bir özet basar", () => {
    expect(
      describeJobFilters({ yil: "2026", musteri: [], durum: ["active"], q: "vinç" })
    ).toBe('2026 · Aktif · Arama: "vinç"');
    expect(describeJobFilters({ yil: "tumu", musteri: [], durum: [], q: "" })).toBe(
      "Tüm Yıllar"
    );
  });
});
