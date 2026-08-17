// Kişisel yapılacaklar çekirdeğinin davranışını DONDURUR: sıralama üç
// basamaklı kuraldır (tarih → sort → ad), tamamlananlar yedi günlük pencerede
// yeniden eskiye, ajanda çevirisi yalnız vadeli açıkları taşır.

import { describe, expect, it } from "vitest";
import {
  todoAjandaTarihleri,
  todoSirala,
  todoTamamlanan,
  type TodoRow,
} from "@/lib/todos";

const BUGUN = "2026-08-17";

function madde(kismi: Partial<TodoRow> & { id: string }): TodoRow {
  return {
    title: "MADDE",
    note: "",
    dueDate: null,
    doneAt: null,
    sort: 0,
    ...kismi,
  };
}

describe("todoSirala", () => {
  it("tarihliler tarih sırasıyla önce, tarihsizler sort sırasıyla sonda", () => {
    const rows = [
      madde({ id: "tarihsiz-2", sort: 2 }),
      madde({ id: "yarin", dueDate: "2026-08-18" }),
      madde({ id: "tarihsiz-1", sort: 1 }),
      madde({ id: "geciken", dueDate: "2026-08-11" }),
      madde({ id: "bugun", dueDate: "2026-08-17" }),
    ];
    expect(todoSirala(rows).map((r) => r.id)).toEqual([
      "geciken",
      "bugun",
      "yarin",
      "tarihsiz-1",
      "tarihsiz-2",
    ]);
  });

  it("tamamlanmış madde açık listeye girmez", () => {
    const rows = [
      madde({ id: "acik" }),
      madde({ id: "bitti", doneAt: "2026-08-16T10:00:00Z" }),
    ];
    expect(todoSirala(rows).map((r) => r.id)).toEqual(["acik"]);
  });

  it("aynı tarihte sort, aynı sort'ta Türkçe ad sırası karar verir", () => {
    const rows = [
      madde({ id: "c", dueDate: "2026-08-20", sort: 1, title: "ÇELİK" }),
      madde({ id: "b", dueDate: "2026-08-20", sort: 1, title: "CIVATA" }),
      madde({ id: "a", dueDate: "2026-08-20", sort: 0, title: "ZINCIR" }),
    ];
    expect(todoSirala(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("todoTamamlanan", () => {
  it("yalnız son yedi günde biteni verir, yeniden eskiye", () => {
    const rows = [
      madde({ id: "dun", doneAt: "2026-08-16T09:00:00Z" }),
      madde({ id: "bugun", doneAt: "2026-08-17T08:00:00Z" }),
      madde({ id: "eski", doneAt: "2026-08-01T08:00:00Z" }),
      madde({ id: "acik" }),
    ];
    expect(todoTamamlanan(rows, BUGUN).map((r) => r.id)).toEqual([
      "bugun",
      "dun",
    ]);
  });
});

describe("todoAjandaTarihleri", () => {
  it("yalnız vadeli açık maddeleri Yapılacak türüyle çevirir", () => {
    const rows = [
      madde({ id: "vadeli", title: "TEKLİF HAZIRLA", dueDate: "2026-08-19" }),
      madde({ id: "tarihsiz" }),
      madde({ id: "bitti", dueDate: "2026-08-19", doneAt: "2026-08-16T10:00:00Z" }),
    ];
    const tarihler = todoAjandaTarihleri(rows);
    expect(tarihler).toHaveLength(1);
    expect(tarihler[0]).toMatchObject({
      date: "2026-08-19",
      kind: "Yapılacak",
      label: "TEKLİF HAZIRLA",
      href: "/",
    });
  });
});
