import { describe, expect, it } from "vitest";
import {
  MANUAL_AUTOFILL_RULES,
  applyAutofill,
  manualDerivedBlocks,
  manualDerivedIds,
  type AutofillContext,
} from "../autofill";
import {
  MAINTENANCE_RULE_BOOK,
  maintenanceScheduleTable,
  mergeMaintenanceRules,
} from "../maintenance-rules";
import {
  LUBRICATION_POINT_BOOK,
  lubricationClassNote,
  lubricationTable,
  mergeLubricationPoints,
} from "../lubrication-rules";
import { allBlocks, manualFromTemplate, printedManual } from "../payload";
import { MANUAL_TEMPLATE, type TemplateSection } from "../template";
import type { ManualEquipmentRow } from "../sources";
import type { ManualPayload, ManualSection } from "../types";

// ————————————————————————————————————————————————————————— fikstür

function ekipman(): ManualEquipmentRow[] {
  const grup = (group: string, adlar: [string, string, string][]) =>
    adlar.map(([component, brand, model]) => ({
      component,
      brand,
      model,
      model2: "",
      qty: "1",
      group,
    })) as ManualEquipmentRow[];

  return [
    ...grup("Ana Kaldırma", [
      ["Motor", "SIEMENS", "1LE1001"],
      ["Redüktör", "YILMAZ", "MRD 90"],
      ["Fren", "EMG", "EBD 250"],
      ["Tambur", "", ""],
      ["Çelik halat", "GÜVEN", "6x36 WS"],
      ["Halat makarası", "", ""],
      ["Kanca", "PEWAG", "RSN 16"],
      ["Tambur rulman yatağı", "SKF", "SNL 520"],
      ["Motor kaplini", "", ""],
    ]),
    // SEÇENEK SATIRI: takılı değil, çizelgeye girmemeli.
    {
      component: "Redüktör — Seçenek 2",
      brand: "BONFIGLIOLI",
      model: "HDP 90",
      qty: "1",
      group: "Ana Kaldırma",
      alternative: true,
    },
    ...grup("Araba", [
      ["Motor", "SIEMENS", "1LA7"],
      ["Redüktör", "YILMAZ", "MRD 60"],
      ["Fren", "EMG", "EBD 100"],
      ["Tekerlek", "", ""],
      ["Teker rulmanı", "SKF", "22215"],
    ]),
    ...grup("Köprü", [
      ["Motor", "SIEMENS", "1LA7"],
      ["Redüktör", "YILMAZ", "MRD 70"],
      ["Fren", "EMG", "EBD 100"],
      ["Tekerlek", "", ""],
      ["Tampon", "", ""],
    ]),
  ];
}

function ctx(over: Partial<AutofillContext> = {}): AutofillContext {
  return {
    sources: {
      equipment: ekipman(),
      classes: [
        { label: "Çelik Yapı Sınıfı", value: "A8" },
        { label: "Kaldırma Mekanizma Grubu", value: "M8" },
      ],
      characteristics: [
        { label: "Besleme Gerilimi", value: "400 V" },
        { label: "Frekans", value: "50 Hz" },
        { label: "Kumanda Gerilimi", value: "24 V DC" },
      ],
      hoistGroup: "M8",
    },
    ...over,
  };
}

function bulKey(sections: readonly ManualSection[], key: string): ManualSection {
  for (const s of sections) {
    if (s.key === key) return s;
    const alt = bulKey(s.children, key);
    if (alt) return alt;
  }
  return null as unknown as ManualSection;
}

function taze(): ManualPayload {
  return manualFromTemplate({ craneType: "Gezer Köprü Vinci" });
}

// ————————————————————————————————————————————————————— defter kilitleri

describe("kural defterleri", () => {
  // Kural şablonun `key`ine atıf yapar; bölüm yeniden adlandırılırsa kural
  // sessizce hiçbir şey üretmez ve kimse fark etmez (değişmez md. 8).
  it("her türetim kuralının hedef bölümü ŞABLONDA VARDIR", () => {
    const anahtarlar = new Set<string>();
    const gez = (liste: readonly TemplateSection[]) => {
      for (const s of liste) {
        anahtarlar.add(s.key);
        if (s.children) gez(s.children);
      }
    };
    gez(MANUAL_TEMPLATE);
    const kopuk = MANUAL_AUTOFILL_RULES.map((r) => r.sectionKey).filter(
      (k) => !anahtarlar.has(k)
    );
    expect(kopuk).toEqual([]);
  });

  it("kural kimlikleri EŞSİZDİR", () => {
    const idler = MANUAL_AUTOFILL_RULES.map((r) => r.id);
    expect(new Set(idler).size).toBe(idler.length);
    const bakim = MAINTENANCE_RULE_BOOK.map((r) => r.id);
    expect(new Set(bakim).size).toBe(bakim.length);
    const yag = LUBRICATION_POINT_BOOK.map((r) => r.id);
    expect(new Set(yag).size).toBe(yag.length);
  });

  // DAYANAKSIZ KURAL OLMAZ: bir bakım aralığı bir mühendislik kararıdır ve
  // nereden geldiği defterde yazmalıdır.
  it("her kod kuralının DAYANAĞI doludur", () => {
    const dayanaksiz = MAINTENANCE_RULE_BOOK.filter((r) => !r.basis.trim()).map((r) => r.id);
    expect(dayanaksiz).toEqual([]);
    const yagsiz = LUBRICATION_POINT_BOOK.filter((r) => !r.basis.trim()).map((r) => r.id);
    expect(yagsiz).toEqual([]);
  });

  it("her kod kuralı geçerli kişi/sıklık/durum kodu taşır", () => {
    for (const r of MAINTENANCE_RULE_BOOK) {
      expect(["F", "E", "MA", "I"]).toContain(r.person);
      expect(["d", "w", "2w", "m", "2m", "y", "2y"]).toContain(r.freq);
      expect(["R", "AR", "LR"]).toContain(r.state);
    }
  });
});

// ——————————————————————————————————————————————————————— bakım çizelgesi

describe("maintenanceScheduleTable", () => {
  it("şablondaki ALTI SÜTUNU korur", () => {
    const t = maintenanceScheduleTable(ekipman());
    expect(t.head).toEqual(["No.", "Parça", "Görev", "Kişi", "Sıklık", "Çalışma Durumu"]);
  });

  it("her ekipman grubu için satır üretir", () => {
    const t = maintenanceScheduleTable(ekipman());
    for (const grup of ["Ana Kaldırma", "Araba", "Köprü"]) {
      expect(t.rows.some((r) => r[1].startsWith(`${grup} ·`))).toBe(true);
    }
    // Kaynak belgedeki çizelge 235 satırdı; üretilen de o mertebede olmalı.
    expect(t.rows.length).toBeGreaterThan(50);
  });

  it("SEÇENEK SATIRI çizelgeye GİRMEZ", () => {
    const t = maintenanceScheduleTable(ekipman());
    expect(t.rows.some((r) => r[1].includes("Seçenek"))).toBe(false);
  });

  it("parça adı KAYNAKTAN gelir, kuralın genel adından değil", () => {
    const t = maintenanceScheduleTable(ekipman());
    expect(t.rows.some((r) => r[1] === "Ana Kaldırma · Tambur rulman yatağı")).toBe(true);
  });

  it("minGroup kuralı yalnız yeterli grupta çıkar", () => {
    const agir = maintenanceScheduleTable(ekipman(), { hoistGroup: "M8" });
    const hafif = maintenanceScheduleTable(ekipman(), { hoistGroup: "M4" });
    const desen = /AĞIR HİZMET/;
    expect(agir.rows.some((r) => desen.test(r[2]))).toBe(true);
    expect(hafif.rows.some((r) => desen.test(r[2]))).toBe(false);
  });

  it("grup bilinmiyorsa minGroup kuralı ÇIKMAZ — varsayılmaz", () => {
    const t = maintenanceScheduleTable(ekipman());
    expect(t.rows.some((r) => /AĞIR HİZMET/.test(r[2]))).toBe(false);
  });

  it("ekipman yoksa yalnız GENEL satırlar kalır", () => {
    const t = maintenanceScheduleTable([]);
    expect(t.rows.length).toBe(MAINTENANCE_RULE_BOOK.filter((r) => !r.match && !r.minGroup).length);
    expect(t.rows.every((r) => r[0].startsWith("1."))).toBe(true);
  });

  it("BOZUK DESEN çizelgeyi düşürmez — düz metin araması olur", () => {
    const t = maintenanceScheduleTable(ekipman(), {
      rules: [
        {
          id: "bozuk",
          match: "([",
          part: "X",
          task: "Kontrol et",
          person: "F",
          freq: "d",
          state: "R",
          basis: "test",
        },
      ],
    });
    expect(t.rows).toEqual([]);
  });
});

describe("mergeMaintenanceRules", () => {
  it("panel satırı kod kuralının ÜZERİNE BİNER", () => {
    const birlesik = mergeMaintenanceRules(MAINTENANCE_RULE_BOOK, [
      { id: "frenBalata", freq: "w" } as never,
    ]);
    expect(birlesik.find((r) => r.id === "frenBalata")?.freq).toBe("w");
    // Üzerine binmek SİLMEZ: kuralın öteki alanları korunur.
    expect(birlesik.find((r) => r.id === "frenBalata")?.part).toBe("Fren");
  });

  it("disabled kuralı çizelgeden DÜŞÜRÜR", () => {
    const birlesik = mergeMaintenanceRules(MAINTENANCE_RULE_BOOK, [
      { id: "frenBalata", disabled: true } as never,
    ]);
    expect(birlesik.some((r) => r.id === "frenBalata")).toBe(false);
  });

  it("yeni kimlik EK KURALDIR ve sona eklenir", () => {
    const birlesik = mergeMaintenanceRules(MAINTENANCE_RULE_BOOK, [
      {
        id: "firmaOzel",
        part: "Kabin klimasi",
        task: "Filtre değiştir",
        person: "MA",
        freq: "2m",
        state: "AR",
        basis: "Firma kararı",
      },
    ]);
    expect(birlesik.at(-1)?.id).toBe("firmaOzel");
    expect(birlesik).toHaveLength(MAINTENANCE_RULE_BOOK.length + 1);
  });
});

// ————————————————————————————————————————————————————————— yağlama

describe("lubricationTable", () => {
  it("MARKA SÜTUNLARI BOŞ DOĞAR — uydurma ürün adı yazılmaz", () => {
    const t = lubricationTable(ekipman());
    expect(t.head).toEqual(["No", "Yağlanacak Yer", "Shell", "Mobil", "B.P."]);
    expect(t.rows.length).toBeGreaterThan(0);
    for (const r of t.rows) expect([r[2], r[3], r[4]]).toEqual(["", "", ""]);
  });

  it("nokta ancak karşılığı olan ekipman varsa açılır", () => {
    const t = lubricationTable(ekipman());
    expect(t.rows.some((r) => r[1] === "Ana Kaldırma · Dişli kutusu")).toBe(true);
    // Vinçte denge makarası yok — o satır da yok.
    expect(t.rows.some((r) => r[1].includes("Denge makarası"))).toBe(false);
  });

  it("SEÇENEK SATIRI yağlama tablosuna da girmez", () => {
    const yalnizSecenek = ekipman().filter((e) => e.alternative);
    expect(lubricationTable(yalnizSecenek).rows).toEqual([]);
  });

  it("köprü notu yağ SINIFLARINI verir, ürün adı vermez", () => {
    const siniflar = lubricationClassNote(ekipman());
    expect(siniflar.length).toBeGreaterThan(0);
    expect(siniflar.join(" ")).not.toMatch(/Shell|Mobil|Omala|Mobilgear/i);
    expect(siniflar.some((s) => /NLGI/.test(s))).toBe(true);
  });

  it("ekipman yoksa tablo ve not BOŞ döner", () => {
    expect(lubricationTable([]).rows).toEqual([]);
    expect(lubricationClassNote([])).toEqual([]);
  });

  it("panel defteri noktanın üzerine biner", () => {
    const birlesik = mergeLubricationPoints(LUBRICATION_POINT_BOOK, [
      { id: "reduktor", place: "Redüktör yağ haznesi" } as never,
    ]);
    const t = lubricationTable(ekipman(), { points: birlesik });
    expect(t.rows.some((r) => r[1].includes("Redüktör yağ haznesi"))).toBe(true);
  });
});

// ————————————————————————————————————————————————————————— türetim

describe("manualDerivedBlocks", () => {
  it("dolu kaynakta blok üretir", () => {
    const gruplar = manualDerivedBlocks(ctx());
    const idler = gruplar.map((g) => g.rule.id);
    expect(idler).toContain("anaParcalar");
    expect(idler).toContain("besleme");
    expect(idler).toContain("frenListesi");
    expect(idler).toContain("bakimTakvimi");
    expect(idler).toContain("yaglamaTablosu");
  });

  // KAYNAKSIZ BELGEDE YALNIZ GENEL BAKIM SATIRLARI KALIR ve bu bir kusur
  // değildir: günlük kullanım öncesi kontrol, kaynaklı yapı muayenesi ve acil
  // stop denemesi ekipman listesinden BAĞIMSIZ olarak her vinçte geçerlidir.
  // Ekipmana bağlı hiçbir kural üretim yapmaz.
  it("KAYNAK YOKSA yalnız ekipmandan bağımsız çizelge üretilir", () => {
    const gruplar = manualDerivedBlocks({ sources: {} });
    expect(gruplar.map((g) => g.rule.id)).toEqual(["bakimTakvimi"]);
    const tablo = gruplar[0].blocks[0];
    expect(tablo.kind === "table" && tablo.table.rows.every((r) => r[0].startsWith("1."))).toBe(
      true
    );
  });

  it("elektrik projesi yoksa limit tablosu doğmaz", () => {
    expect(manualDerivedBlocks(ctx()).some((g) => g.rule.id === "limitListesi")).toBe(false);
  });

  it("elektrik projesi varsa limit tablosu doğar", () => {
    const c = ctx();
    c.sources.electricalParts = [
      {
        deviceTag: "=185T+LVD01-S31",
        installation: "",
        location: "LVD01",
        device: "S31",
        qty: 1,
        designation: "LIMIT SWITCH 2NC",
        typeNo: "3SE5112",
        supplier: "Siemens",
        partNo: "SIE.3SE5112",
        page: 12,
      },
      {
        deviceTag: "=185T+LVD01-F31",
        installation: "",
        location: "LVD01",
        device: "F31",
        qty: 3,
        designation: "CIRCUIT BREAKER 400V",
        typeNo: "5SL6210-7",
        supplier: "Siemens",
        partNo: "SIE.5SL6210-7",
        page: 12,
      },
    ];
    const grup = manualDerivedBlocks(c).find((g) => g.rule.id === "limitListesi")!;
    const tablo = grup.blocks[1];
    expect(tablo.kind === "table" && tablo.table.rows).toHaveLength(1);
    expect(tablo.kind === "table" && tablo.table.rows[0][0]).toBe("=185T+LVD01-S31");
  });

  // KITAP-5'İN KARDEŞİ: şablona vince özel sayı girmez; türetim ise bu vincin
  // verisinden gelir ve KAYNAKTA OLMAYAN BİR SAYI ÜRETEMEZ. Standart atıfları
  // (FEM 1.001, DIN 15018) sayı değil KAYNAK GÖSTERİMİDİR ve muaftır.
  it("türetilen METİNDE kaynakta olmayan sayı yoktur", () => {
    const c = ctx();
    const kaynakMetni = JSON.stringify(c.sources);
    const standartAtfi = /(?:FEM|DIN|ISO|EN|ANSI|NLGI|VG)\s*[\d.\-/]+/gi;

    for (const g of manualDerivedBlocks(c)) {
      for (const b of g.blocks) {
        if (b.kind !== "text" && b.kind !== "list") continue;
        const metin = b.kind === "text" ? b.text : b.items.join(" ");
        const kalan = metin.replace(standartAtfi, " ");
        for (const sayi of kalan.match(/\d+(?:[.,]\d+)?/g) ?? []) {
          expect({ kural: g.rule.id, sayi, metin }).toEqual({
            kural: g.rule.id,
            sayi: kaynakMetni.includes(sayi) ? sayi : `KAYNAKTA YOK: ${sayi}`,
            metin,
          });
        }
      }
    }
  });
});

// —————————————————————————————————————————————————————— ağaca uygulama

describe("applyAutofill", () => {
  it("BOŞ ŞABLON YER TUTUCUSUNU DEVRALIR, ikinci blok bırakmaz", () => {
    const once = taze();
    const oncekiSayi = bulKey(once.sections, "kullanim.genel").blocks.length;
    expect(oncekiSayi).toBe(1);

    const { payload } = applyAutofill(once, ctx());
    const sonra = bulKey(payload.sections, "kullanim.genel");
    expect(sonra.blocks).toHaveLength(1);
    expect(sonra.blocks[0].derived).toBe("besleme");
    // Yer tutucunun KİMLİĞİ korunur.
    expect(sonra.blocks[0].id).toBe(bulKey(once.sections, "kullanim.genel").blocks[0].id);
  });

  it("`derived` ile `fromTemplate` AYNI BLOKTA BULUNMAZ", () => {
    const { payload } = applyAutofill(taze(), ctx());
    const kirli = allBlocks(payload.sections).filter((b) => b.derived && b.fromTemplate);
    expect(kirli).toEqual([]);
  });

  it("bakım ve yağlama bölümleri artık BASILIR", () => {
    // Şablonda `bakim` bölümünde AÇIKLAMA çizelgesi (F/E/MA/I…) doludur ama
    // asıl bakım çizelgesi boştur ve süzgeçte düşer.
    const once = printedManual(taze());
    expect(bulKey(once.sections, "bakim").blocks.filter((b) => b.kind === "table")).toHaveLength(1);
    expect(bulKey(once.sections, "bakim").blocks.some((b) => b.derived)).toBe(false);

    const { payload } = applyAutofill(taze(), ctx());
    const sonra = printedManual(payload);
    const bakim = bulKey(sonra.sections, "bakim");
    const tablo = bakim.blocks.find((b) => b.derived === "bakimTakvimi");
    expect(tablo?.kind).toBe("table");
    expect(tablo?.kind === "table" && tablo.table.rows.length).toBeGreaterThan(50);
    expect(bulKey(sonra.sections, "yaglama").blocks.some((b) => b.derived)).toBe(true);
  });

  it("İKİNCİ UYGULAMA blok ÇOĞALTMAZ", () => {
    const bir = applyAutofill(taze(), ctx()).payload;
    const iki = applyAutofill(bir, ctx()).payload;
    expect(allBlocks(iki.sections).length).toBe(allBlocks(bir.sections).length);
  });

  it("`edited` blok TOPLU tazelemede KORUNUR ve sayılır", () => {
    const bir = applyAutofill(taze(), ctx()).payload;
    const bolum = bulKey(bir.sections, "kullanim.genel");
    bolum.blocks[0] = { ...bolum.blocks[0], edited: true, kind: "text", text: "Elle yazıldı" };

    const sonuc = applyAutofill(bir, ctx());
    const sonra = bulKey(sonuc.payload.sections, "kullanim.genel").blocks[0];
    expect(sonra.kind === "text" && sonra.text).toBe("Elle yazıldı");
    expect(sonuc.korunan).toBeGreaterThan(0);
  });

  it("TEKİL tazeleme `edited`i BİLEREK yok sayar", () => {
    const bir = applyAutofill(taze(), ctx()).payload;
    const bolum = bulKey(bir.sections, "kullanim.genel");
    const blokId = bolum.blocks[0].id;
    bolum.blocks[0] = { ...bolum.blocks[0], edited: true, kind: "text", text: "Elle yazıldı" };

    const sonuc = applyAutofill(bir, ctx(), { yalnizBlok: blokId });
    const sonra = bulKey(sonuc.payload.sections, "kullanim.genel").blocks[0];
    expect(sonra.kind === "text" && sonra.text).toMatch(/400 V/);
  });

  it("KAYNAK KÜÇÜLÜNCE fazla türetilmiş blok DÜŞER", () => {
    const dolu = applyAutofill(taze(), ctx()).payload;
    expect(bulKey(dolu.sections, "kullanim.frenler").blocks.some((b) => b.derived)).toBe(true);

    // Frenler kaynaktan çıktı: bölümde artık türetilmiş blok kalmamalı.
    const frensiz = ctx();
    frensiz.sources.equipment = ekipman().filter((e) => !/fren/i.test(e.component));
    const sonra = applyAutofill(dolu, frensiz).payload;
    expect(bulKey(sonra.sections, "kullanim.frenler").blocks.some((b) => b.derived)).toBe(false);
  });

  it("yalnizBolum seçeneği başka bölüme dokunmaz", () => {
    const { payload } = applyAutofill(taze(), ctx(), { yalnizBolum: "bakim" });
    expect(manualDerivedIds(payload.sections)).toEqual(["bakimTakvimi"]);
  });

  it("bölüm belgede yoksa kural sessizce atlanır (KITAP-4: bölüm EKLENMEZ)", () => {
    const kirpik = taze();
    kirpik.sections = kirpik.sections.filter((s) => s.key !== "bakim");
    const { payload } = applyAutofill(kirpik, ctx());
    expect(manualDerivedIds(payload.sections)).not.toContain("bakimTakvimi");
  });
});
