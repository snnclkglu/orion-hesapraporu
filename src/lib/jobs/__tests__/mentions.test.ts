// Anma çekirdeği — bölme ve kimlik çıkarma sözleşmesi.

import { describe, expect, it } from "vitest";
import { extractMentionIds, splitMentions } from "../mentions";

const PEOPLE = [
  { id: "p1", fullName: "Sinan Çolakoğlu" },
  { id: "p2", fullName: "Salih Ergüven" },
  { id: "p3", fullName: "Salih" },
];

describe("splitMentions", () => {
  it("anmayı bulur ve çevresini düz metin bırakır", () => {
    const out = splitMentions("Kontrol @Sinan Çolakoğlu yapsın.", PEOPLE);
    expect(out).toEqual([
      { text: "Kontrol " },
      { text: "@Sinan Çolakoğlu", personId: "p1" },
      { text: " yapsın." },
    ]);
  });

  it("Türkçe katlamayla eşleşir — küçük yazılmış anma da bulunur", () => {
    const out = splitMentions("@sinan çolakoğlu bakar mısın", PEOPLE);
    expect(out[0]).toEqual({ text: "@sinan çolakoğlu", personId: "p1" });
  });

  it("uzun ad kısa adı yener", () => {
    // "Salih" ayrı bir kişi; "@Salih Ergüven" uzun ada bağlanmalı.
    const out = splitMentions("@Salih Ergüven termine baksın", PEOPLE);
    expect(out[0]).toEqual({ text: "@Salih Ergüven", personId: "p2" });
  });

  it("eşleşmeyen @ düz metin kalır", () => {
    const out = splitMentions("posta@ornek.com adresi", PEOPLE);
    expect(out).toEqual([{ text: "posta@ornek.com adresi" }]);
  });

  it("boş gövde boş liste döner", () => {
    expect(splitMentions("", PEOPLE)).toEqual([]);
  });
});

describe("extractMentionIds", () => {
  it("son metinden çıkarır ve tekilleştirir", () => {
    const body = "@Sinan Çolakoğlu ve @sinan çolakoğlu ile @Salih Ergüven";
    expect(extractMentionIds(body, PEOPLE)).toEqual(["p1", "p2"]);
  });

  it("anma silinmişse kimlik de düşer", () => {
    expect(extractMentionIds("artık kimse anılmıyor", PEOPLE)).toEqual([]);
  });
});
