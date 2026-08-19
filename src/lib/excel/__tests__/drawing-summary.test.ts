// TEKNİK RESSAM ÖZETİ — genişletilmiş içerik (kullanıcı isteği, 19.08.2026).
//
// Özet, ressamın çizim için ihtiyaç duyduğu her ölçüyü taşımalıdır ve o ölçüler
// motorun KENDİ hücrelerinden gelmelidir — ikinci bir hesap yazılmaz. Bu dosya
// beş bağı kilitler:
//   1. Kapsam: her kaldırma/yürütme/kanca bloğu ve her ana kiriş takımı KENDİ
//      çizelgesini alır (eskiden yalnız ana araba, köprü ve iki tambur vardı).
//   2. Çizim detayları: yiv dibi et kalınlığı, hatve, cidar, namlu boyu, mil
//      ölçü zinciri ve ray altı T profil özete GİRER.
//   3. Kamber kotları hesap raporundaki 7.7 ile AYNI saf fonksiyondan gelir.
//   4. Şemalar bölüme bağlıdır ve hesap raporundakiyle aynı üreticidendir.
//   5. Notlar bölümü EN SONDADIR, satır sonlarını korur, boş notta hiç açılmaz.

import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE, V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { buildSummarySections, type SummarySection } from "@/lib/excel/equipment";
import { girderCamberProfile } from "@/lib/diagrams/select";

const V5 = V5_TEMPLATE;
const V5_RESULT = runCalc(V5);
const SUMMARY = buildSummarySections(V5, V5_RESULT);

const sectionNamed = (list: SummarySection[], name: string) =>
  list.find((s) => s.name === name);
const labels = (sec: SummarySection | undefined) => (sec?.rows ?? []).map((r) => r.label);
const valueOf = (sec: SummarySection | undefined, label: string) =>
  (sec?.rows ?? []).find((r) => r.label === label)?.value;

describe("kapsam — her bölümün kendi çizelgesi", () => {
  it("kaldırma grubu başına bir tambur çizelgesi", () => {
    // V5'te ana + yardımcı kaldırma var; ikisinin de tamburu ayrı basılır.
    expect(sectionNamed(SUMMARY, "Tambur · Ana Kaldırma")).toBeDefined();
    expect(sectionNamed(SUMMARY, "Tambur · Yardımcı Kaldırma")).toBeDefined();
  });

  it("yürütme grubu başına bir çizelge", () => {
    expect(sectionNamed(SUMMARY, "Yürütme · Ana Araba Yürütme")).toBeDefined();
    expect(sectionNamed(SUMMARY, "Yürütme · Köprü Yürütme")).toBeDefined();
  });

  it("kanca bloğu ve ana kiriş kesiti kendi bölümlerinde", () => {
    expect(sectionNamed(SUMMARY, "Ana Kanca Bloğu")).toBeDefined();
    expect(sectionNamed(SUMMARY, "Ana Kiriş Kesiti")).toBeDefined();
  });

  it("kapalı bölümün çizelgesi HİÇ açılmaz", () => {
    // Köprüsüz (yalnız araba) bir girdi setinde köprü çizelgesi olmamalı.
    const arabaOnly: CalcInput = { ...V5 };
    delete (arabaOnly as unknown as Record<string, unknown>).bridge;
    delete (arabaOnly as unknown as Record<string, unknown>).girder;
    const sections = buildSummarySections(arabaOnly, runCalc(arabaOnly));
    expect(sectionNamed(sections, "Yürütme · Köprü Yürütme")).toBeUndefined();
    expect(sectionNamed(sections, "Ana Kiriş Kesiti")).toBeUndefined();
    expect(sectionNamed(sections, "Yürütme · Ana Araba Yürütme")).toBeDefined();
  });
});

describe("çizim detayları", () => {
  const drum = sectionNamed(SUMMARY, "Tambur · Ana Kaldırma");

  it("yiv dibi et kalınlığı ve türevleri özettedir", () => {
    const l = labels(drum);
    expect(l).toContain("Yiv dibi et kalınlığı s₀");
    expect(l).toContain("Yiv derinliği");
    expect(l).toContain("Cidar kalınlığı s");
    expect(l).toContain("Yiv adımı (hatve) p");
    expect(l).toContain("Sarım sayısı z");
    expect(l).toContain("Namlu boyu (yanaklar arası)");
  });

  it("cidar kalınlığı = yiv dibi eti + halat çapı / 2", () => {
    // Bağıntı `derive.ts`teki tambur ağırlığı türetmesinin aynısıdır;
    // ikinci bir yöntem yazılmadığını sayı üzerinden kilitler.
    const inp = V5.mainHoist!.inputs;
    const sel = V5.mainHoist!.selections;
    const beklenen = inp.drumWallThicknessMm + sel.ropeDiaMm / 2;
    // Değer TR biçiminde basılır (binlik nokta, ondalık virgül); karşılaştırma
    // biçimden değil SAYIDAN yapılır.
    const trSayi = (v: unknown) =>
      Number(String(v).replace(/\./g, "").replace(",", "."));
    expect(trSayi(valueOf(drum, "Cidar kalınlığı s"))).toBeCloseTo(beklenen, 1);
    expect(valueOf(drum, "Yiv dibi et kalınlığı s₀")).toBe(inp.drumWallThicknessMm);
  });

  it("tambur mili ölçü zinciri A…G eksiksizdir", () => {
    const l = labels(drum);
    for (const harf of ["A (redüktör tarafı)", "B", "C (sol yiv)", "D (yivsiz orta)",
      "E (sağ yiv)", "F", "G (yatak tarafı)"]) {
      expect(l, harf).toContain(`Mil ölçüsü ${harf}`);
    }
  });

  it("yürütme çizelgesi teker milini ve tahriki taşır", () => {
    const l = labels(sectionNamed(SUMMARY, "Yürütme · Ana Araba Yürütme"));
    expect(l).toContain("Teker mili çapı");
    expect(l).toContain("Teker mili mesnet ölçüsü a");
    expect(l).toContain("Tahrikli teker adedi");
    expect(l).toContain("Redüktör oranı");
  });

  it("ray altı T profil YALNIZ profil varken basılır", () => {
    const kesit = sectionNamed(SUMMARY, "Ana Kiriş Kesiti");
    const tLabels = labels(kesit).filter((x) => x.toLowerCase().includes("t profil"));
    // V5'te T profil kapalı — ölçüler korunur ama kesite girmez (HESAP-8c).
    expect(tLabels).toEqual([]);

    const tProfilli: CalcInput = {
      ...V5,
      girder: {
        ...V5.girder!,
        inputs: {
          ...V5.girder!.inputs,
          railTProfile: "Var",
          railTProfileWebThkMm: 20,
          railTProfileWebHeightMm: 120,
          railTProfileTopThkMm: 25,
          railTProfileTopWidthMm: 220,
        },
      },
    };
    const acikKesit = sectionNamed(
      buildSummarySections(tProfilli, runCalc(tProfilli)),
      "Ana Kiriş Kesiti"
    );
    expect(labels(acikKesit).some((x) => x.toLowerCase().includes("t profil"))).toBe(true);
  });

  it("perde aralığı ve adedi kesit çizelgesindedir", () => {
    const l = labels(sectionNamed(SUMMARY, "Ana Kiriş Kesiti"));
    expect(l).toContain("Perde aralığı l₁");
    expect(l).toContain("Perde adedi");
  });
});

describe("ters sehim (kamber) kotları", () => {
  const camber = sectionNamed(SUMMARY, "Ana Kiriş Ters Sehim Kotları");

  it("her istasyon bir satırdır ve mesnet kotu notta durur", () => {
    const profile = girderCamberProfile("girder", V5, V5_RESULT);
    expect(profile).not.toBeNull();
    expect(camber?.rows.length).toBe(profile!.stations.length);
    // Kotlar hesap raporundaki 7.7 ile AYNI fonksiyondan gelir; ikinci bir
    // yöntem yazılsaydı atölyede iki farklı sayı dolaşırdı.
    expect(camber?.rows[0].label.startsWith(profile!.stations[0].code)).toBe(true);
    expect(camber?.rows[0].note).toMatch(/^mesnette /);
  });
});

describe("şemalar", () => {
  it("kesit, tambur ve teker mili bölümleri kendi çizimini taşır", () => {
    expect(sectionNamed(SUMMARY, "Ana Kiriş Kesiti")?.diagram).toBeDefined();
    expect(sectionNamed(SUMMARY, "Tambur · Ana Kaldırma")?.diagram).toBeDefined();
    expect(sectionNamed(SUMMARY, "Yürütme · Ana Araba Yürütme")?.diagram).toBeDefined();
  });

  it("şema taşıyan her bölümün çizimi ölçülebilir bir kutudur", () => {
    for (const sec of SUMMARY) {
      if (!sec.diagram) continue;
      expect(sec.diagram.width, sec.name).toBeGreaterThan(0);
      expect(sec.diagram.height, sec.name).toBeGreaterThan(0);
      expect(sec.diagram.els.length, sec.name).toBeGreaterThan(0);
    }
  });
});

describe("notlar", () => {
  it("boş notta bölüm HİÇ açılmaz", () => {
    expect(sectionNamed(SUMMARY, "Notlar")).toBeUndefined();
    expect(
      sectionNamed(buildSummarySections(V5, V5_RESULT, undefined, "   "), "Notlar")
    ).toBeUndefined();
  });

  it("not EN SONDADIR ve satır sonlarını korur", () => {
    const metin = ["Kabin merdiveni solda.", "Ray kaynağı montajda."].join("\n");
    const sections = buildSummarySections(V5, V5_RESULT, undefined, metin);
    const son = sections[sections.length - 1];
    expect(son.name).toBe("Notlar");
    expect(son.kind).toBe("notes");
    expect(son.rows).toEqual([]);
    expect(son.text).toBe(metin);
  });
});

describe("yeni iş şablonu — özet NaN üretmez", () => {
  it("bütün değerler basılabilir (sayı ya da metin)", () => {
    const sections = buildSummarySections(NEW_WORK_TEMPLATE, runCalc(NEW_WORK_TEMPLATE));
    for (const sec of sections) {
      for (const r of sec.rows) {
        expect(typeof r.value === "number" || typeof r.value === "string", `${sec.name}/${r.label}`).toBe(true);
        if (typeof r.value === "number") {
          expect(Number.isFinite(r.value), `${sec.name}/${r.label}`).toBe(true);
        } else {
          // Eksik değer "-" olur; "NaN" ya da "undefined" ASLA basılmaz.
          expect(r.value, `${sec.name}/${r.label}`).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });
});
