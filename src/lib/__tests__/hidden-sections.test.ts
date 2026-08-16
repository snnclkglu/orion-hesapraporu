// Alt bölüm gizleme — çekirdek sözleşmeler.
//
// Kullanıcı bir alt bölümü (ör. 5.7 Teker — Redüktör Kaplini) başlığındaki
// kutucukla gizleyebilir: bölüm hesaba girmeye devam eder ama editör özetleri,
// PDF raporu ve ekipman listesi onu taşımaz. Bu dosya üç bağı kilitler:
//   1. `hiddenSectionsFromRevision` — JSONB'den güvenli okuma
//   2. `hiddenSectionCheckIds` — gizli bölüm → kontrol kimlikleri eşlemesi
//   3. `diffRevisions` — gizleme kararı karşılaştırmada kaybolmaz

import { describe, expect, it } from "vitest";
import {
  hiddenSectionsFromRevision,
  sectionHideKeyFor,
  sectionNoteKeyFor,
} from "@/lib/revision-load";
import { diffRevisions } from "@/lib/revision-diff";
import { fieldLabel } from "@/lib/calc/labels";
import { hiddenSectionCheckIds } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

describe("sectionHideKeyFor", () => {
  it("not/alternatif anahtarlarıyla aynı uzayı kullanır", () => {
    // Üç kayıt da aynı bölümü işaret eder; anahtar biçimleri ayrışamaz.
    expect(sectionHideKeyFor("trolley", "5.7")).toBe("trolley-5.7");
    expect(sectionHideKeyFor("trolley", "5.7")).toBe(sectionNoteKeyFor("trolley", "5.7"));
  });
});

describe("hiddenSectionsFromRevision", () => {
  it("geçerli anahtarları okur, bozukları ve yinelenenleri atar", () => {
    const out = hiddenSectionsFromRevision({
      hiddenSections: [
        "trolley-5.7",
        "trolley-5.7",        // yinelenen
        "main-2.8",
        "",                   // boş
        "-5.7",               // modül anahtarı yok
        "trolley-",           // bölüm id'si yok
        "bolumsuz",           // ayraç yok
        42 as unknown as string, // tip dışı
      ],
    });
    expect(out.sort()).toEqual(["main-2.8", "trolley-5.7"]);
  });

  it("alan yokken, null iken ya da dizi değilken boş döner", () => {
    expect(hiddenSectionsFromRevision(null)).toEqual([]);
    expect(hiddenSectionsFromRevision({})).toEqual([]);
    expect(hiddenSectionsFromRevision({ hiddenSections: null })).toEqual([]);
    expect(
      hiddenSectionsFromRevision({ hiddenSections: "trolley-5.7" as unknown as string[] })
    ).toEqual([]);
  });
});

describe("hiddenSectionCheckIds", () => {
  it("gizli bölümün kontrol soneklerini adaptör önekiyle birleştirir", () => {
    const ids = hiddenSectionCheckIds(["trolley-5.7"]);
    // 5.7'nin checkSuffixes bildirimi: wheelCoupling.torque + wheelCoupling.bore
    expect([...ids].sort()).toEqual([
      "trolley.wheelCoupling.bore",
      "trolley.wheelCoupling.torque",
    ]);
  });

  it("aynı ham bölüm başka modülde gizlenmemişse onun kontrollerine dokunmaz", () => {
    // Araba 5.7 gizli, köprü 5.7 açık: köprünün kontrol kimlikleri kümede yok.
    const ids = hiddenSectionCheckIds(new Set(["trolley-5.7"]));
    expect(ids.has("bridge.wheelCoupling.torque")).toBe(false);
  });

  it("boş listede boş küme döner", () => {
    expect(hiddenSectionCheckIds([]).size).toBe(0);
  });
});

describe("diffRevisions — gizlenen alt bölümler", () => {
  const snap = (hidden?: string[]) => ({
    inputs: { specs: {}, hiddenSections: hidden ?? [] } as Record<string, unknown>,
    selections: {},
    results: null,
  });

  it("gizleme değişimini ayrı bir fark satırı olarak gösterir", () => {
    const diff = diffRevisions(snap([]), snap(["trolley-5.7"]));
    const row = diff.fields.find((f) => f.key === "hiddenSections");
    expect(row).toBeDefined();
    expect(row?.a).toBe("—");
    expect(row?.b).toBe("trolley-5.7");
    // Karşılaştırma ekranı anahtarı insan okunur etiketle basar.
    expect(fieldLabel("hiddenSections").label).toBe("Gizlenen Alt Bölümler");
  });

  it("liste aynıyken (sıra farklı olsa da) satır üretmez", () => {
    const a = snap(["main-2.8", "trolley-5.7"]);
    const b = snap(["trolley-5.7", "main-2.8"]);
    const diff = diffRevisions(a, b);
    expect(diff.fields.find((f) => f.key === "hiddenSections")).toBeUndefined();
  });
});
