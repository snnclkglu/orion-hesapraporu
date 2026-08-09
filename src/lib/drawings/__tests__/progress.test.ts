// Üretim durumu — KORUMA TESTİ.
//
// İki gerçek paket baştan sona işlenir ve ölçülen sayılar DONDURULUR. En
// değerli iddialar yine SESSİZLİK iddialarıdır: MONORAY hiç öneri üretmez,
// belirsiz bir durum sözcüğü hiç öneri üretmez ve klasörün kendi kodu (montaj)
// hiçbir zaman "kesildi" önerisine girmez. Yanlış alarm bu modülün en büyük
// düşmanıdır — 175 parçalık bir pakette bir kez yanlış işaretlemek, atölyenin
// bir daha bu ekrana bakmaması demektir.
//
// Son bölüm bir SÖZLÜK KORUMASIDIR: `progress.ts`in bildiği aşamalar ile
// migration'ın tohumladığı aşamalar ayrışırsa hiçbir test kırılmaz ve ekran
// sessizce yanlış çalışır (`standard.guard.test.ts` deseninin aynısı).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBomFileName, parseFile } from "../file-name";
import { parseFolderName } from "../folder-name";
import { readSheet } from "../excel";
import { reconcile, type PackageSnapshot, type ReconcileResult } from "../reconcile";
import {
  FALLBACK_STAGES,
  PURCHASE_PREFIX,
  STAGE_SLUGS,
  orphanMarks,
  packageProgress,
  partProgress,
  progressItemNo,
  progressKeyOf,
  suggestStagesFromFolders,
  trackedParts,
  type ProgressMark,
  type SuggestionFile,
} from "../progress";
import { MONORAY, MTC, type FixturePackage } from "./fixtures/packages";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";

function anlikGoruntu(pkg: FixturePackage, sheets: FixtureSheet[]): PackageSnapshot {
  const files = pkg.files.map((f) =>
    parseFile({ relPath: f.path, size: f.size, checksum: f.hash })
  );
  const bom = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );
  return { folderName: pkg.folder, folder: parseFolderName(pkg.folder).value, files, bom };
}

/** Öneri motorunun beklediği dosya görünümü — sayfa da `FileRow`u böyle eşler. */
function oneriDosyalari(snap: PackageSnapshot): SuggestionFile[] {
  return snap.files
    .filter((f) => f.lifecycle !== "haric")
    .map((f) => ({ folder: f.folder, partCode: f.partCode, fileName: f.fileName, qty: f.qty }));
}

const monorayAnlik = anlikGoruntu(MONORAY, MONORAY_SHEETS);
const mtcAnlik = anlikGoruntu(MTC, MTC_SHEETS);
const monoray: ReconcileResult = reconcile(monorayAnlik);
const mtc: ReconcileResult = reconcile(mtcAnlik);

const monorayDefter = trackedParts(monoray.parts);
const mtcDefter = trackedParts(mtc.parts);

describe("izlenen defter — kodlu parçalar ve birleştirilmiş satın alma kalemleri", () => {
  it("MONORAY: 121 defter satırı → 71 kodlu parça + 49 satın alma kalemi", () => {
    // 50 kodsuz satır 49 kaleme iner: tek birleşme "CİVATA M6x20 DIN933"tir ve
    // iki ayrı montajda 4'er adet geçiyor. Satın alma kararı satır başına
    // değil KALEM başınadır — bu yüzden birleşme DOĞRUDUR.
    expect(monoray.parts).toHaveLength(121);
    expect(monorayDefter.coded).toHaveLength(71);
    expect(monorayDefter.purchases).toHaveLength(49);
    expect(monorayDefter.all).toHaveLength(120);

    const civata = monorayDefter.purchases.find((p) => p.label.startsWith("CİVATA M6x20"))!;
    expect(civata.sourceRows).toBe(2);
    expect(civata.qty).toBe(8);
  });

  it("MTC: 261 defter satırı → 175 kodlu parça + 68 satın alma kalemi", () => {
    expect(mtc.parts).toHaveLength(261);
    expect(mtcDefter.coded).toHaveLength(175);
    expect(mtcDefter.purchases).toHaveLength(68);

    // 86 kodsuz satırın 18'i tekrardır ve hepsi AYNI kalemin farklı alt
    // montajlardaki kaydıdır — 11 kalem birden çok satırdan birleşir.
    const birlesenler = mtcDefter.purchases.filter((p) => p.sourceRows > 1);
    expect(birlesenler).toHaveLength(11);
    expect(mtcDefter.purchases.reduce((t, p) => t + p.sourceRows, 0)).toBe(86);
  });

  it("MTC: SOMUN M16 DIN934 dört satırdan tek kaleme iner, adet 61 olur", () => {
    // 2 + 4 + 4 + 51. Dört ayrı montaj, tek sipariş kalemi.
    const somun = mtcDefter.purchases.find((p) => p.label.startsWith("SOMUN M16 DIN934"))!;
    expect(somun.sourceRows).toBe(4);
    expect(somun.qty).toBe(61);
    expect(somun.key.startsWith(PURCHASE_PREFIX)).toBe(true);
  });

  it("adedi bilinmeyen parçalar defterde kalır — MONORAY 9, MTC 6", () => {
    // Adet yokluğu bir dışlama sebebi değildir: tek işaret o parçayı tamam
    // sayar (bkz. `partProgress`).
    expect(monorayDefter.coded.filter((p) => p.qty == null)).toHaveLength(9);
    expect(mtcDefter.coded.filter((p) => p.qty == null)).toHaveLength(6);
  });
});

describe("anahtar — paketten değil KODDAN türetilir", () => {
  it("kalem numarası kodun kendi önekidir", () => {
    expect(progressItemNo("0043-00-0100-05")).toBe("0043-00");
    expect(progressItemNo("0057-00-0600-00-01-04")).toBe("0057-00");
    expect(mtcDefter.itemNo).toBe("0043-00");
    expect(monorayDefter.itemNo).toBe("0057-00");
  });

  it("paketin item_no'su kaysa bile anahtar DEĞİŞMEZ", () => {
    // `autoItemNos` ikinci kalem eklendiğinde 0043-00'ı 0043-01'e kaydırır ve
    // `remapItem(rewriteItemNo)` paketin alanını yeniden yazar. Anahtar o
    // alandan okunsaydı atölyenin bütün işaretleri bir sabah öksüz kalırdı.
    const kaymis = trackedParts(mtc.parts, "0043-01");
    expect(kaymis.itemNo).toBe("0043-00");
    expect(progressItemNo("0043-00-0100-05", "0043-01")).toBe("0043-00");
  });

  it("kodsuz kalemin anahtarı SATINALMA: önekiyle başlar, SATIR: içermez", () => {
    // `register_key = 'SATIR:' || bom_seq` AKAN BİR SAYAÇTIR: yeni bir Excel
    // yüklenince kayar. Atölye işareti onunla anahtarlansaydı her yüklemede
    // başka bir cıvataya taşınırdı.
    for (const p of mtcDefter.purchases) {
      expect(p.key.startsWith(PURCHASE_PREFIX)).toBe(true);
      expect(p.key).not.toContain("SATIR:");
    }
    // Kodsuz kalemde kalem numarası defterin kodlarından TÜRETİLİR.
    expect(progressItemNo(mtcDefter.purchases[0].key, mtcDefter.itemNo)).toBe("0043-00");
  });

  it("anahtar Türkçe KATLANIR — CİVATA ile CIVATA tek kalemdir", () => {
    const a = progressKeyOf({ partCode: "", description: "CİVATA M6x20 DIN933" });
    const b = progressKeyOf({ partCode: "", description: "civata m6x20 din933" });
    expect(a).toBe(b);
  });
});

describe("öneri — klasör adındaki durum soneki bir KANIT DEĞİL İPUCUDUR", () => {
  const monorayOneriler = suggestStagesFromFolders({
    files: oneriDosyalari(monorayAnlik),
    parts: monorayDefter.all,
  });
  const mtcOneriler = suggestStagesFromFolders({
    files: oneriDosyalari(mtcAnlik),
    parts: mtcDefter.all,
  });

  it("MTC: tam BİR öneri — ANA KIRIS klasöründeki 20 parça", () => {
    // `reconcile.ts` yalnız KÖK klasörün durum sonekine bakar ve MTC'nin kökü
    // `0043-00-0000_MTC PASLANMAZ` olduğu için URETIM_IPUCU bulgusu bu pakette
    // HİÇ basılmıyor. İpucu iç segmentte duruyor; motor her segmenti gezer.
    expect(mtcOneriler).toHaveLength(1);
    const o = mtcOneriler[0];
    expect(o.stage).toBe("kesildi");
    expect(o.folderPath).toBe("DXF/0043-00-0100 - ANA KIRIS - KESİLDİ");
    // Ressamın YAZDIĞI hâl gösterilir — katlanmış hâli değil.
    expect(o.hintWord).toBe("KESİLDİ");
    expect(o.keys).toHaveLength(20);
    expect(o.pending).toHaveLength(20);
    expect(o.alreadyMarked).toEqual([]);
  });

  it("kapsam KLASÖRÜN İÇİNDEKİ dosyalardır; montajın kendisi kesilmez", () => {
    const o = mtcOneriler[0];
    const beklenen = [
      ...Array.from({ length: 12 }, (_, i) => `0043-00-0100-${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 8 }, (_, i) => `0043-00-0100-${String(i + 16).padStart(2, "0")}`),
    ];
    expect([...o.keys].sort()).toEqual(beklenen);

    // Klasörün KENDİ kodu öneride yer almaz.
    expect(o.folderCode).toBe("0043-00-0100");
    expect(o.keys).not.toContain("0043-00-0100");

    // SESSİZLİK: -13/-14/-15 Testere (boya kesilen profil), -24 Talaşlı
    // İmalat. Ressam plazma kesilen sacları o klasöre koymuş; ötekiler orada
    // YOK ve öneri onları uydurmaz.
    for (const eksik of ["-13", "-14", "-15", "-24"]) {
      expect(o.keys).not.toContain(`0043-00-0100${eksik}`);
    }
  });

  it("önerilen adet DEFTERDEN gelir ve dosya adıyla 20/20 tutuyor", () => {
    const o = mtcOneriler[0];
    expect(o.qtyByKey["0043-00-0100-05"]).toBe(30);
    expect(o.qtyByKey["0043-00-0100-12"]).toBe(8);
    expect(o.qtyByKey["0043-00-0100-17"]).toBe(8);
    for (const iki of ["-01", "-02", "-20", "-22", "-23"]) {
      expect(o.qtyByKey[`0043-00-0100${iki}`]).toBe(2);
    }
    expect(Object.values(o.qtyByKey).filter((n) => n === 4)).toHaveLength(12);

    // İkinci kaynağın (dosya adındaki "(n ADET)") güvenilirliği donuyor:
    // yirmi dosyanın yirmisinde defterle birebir aynı.
    expect(o.qtyConflicts).toEqual([]);
    const defterAdet = new Map(mtcDefter.coded.map((p) => [p.key, p.qty]));
    for (const k of o.keys) expect(defterAdet.get(k)).toBe(o.qtyByKey[k]);
  });

  it("SESSİZLİK: MONORAY hiç öneri üretmez", () => {
    // Bu pakette hiçbir klasör adında durum soneki yok. Sessizlik burada
    // doğruluktur; "hiçbir şey bulamadım" bir kusur değil bir cevaptır.
    expect(monorayOneriler).toEqual([]);
  });

  it("SESSİZLİK: belirsiz durum sözcüğü öneri üretmez", () => {
    // `folder-name.ts` yedi durum sözcüğü tanıyor ama yalnız KESİLDİ ve
    // BÜKÜLDÜ tek bir aşamayı işaret ediyor. "TAMAM" hangi aşamadır? Tahmin
    // etmek 175 parçayı yanlış işaretlemek demektir.
    const sentetik: SuggestionFile[] = [
      { folder: "DXF/0043-00-0400 - X - TAMAM", partCode: "0043-00-0400-01", qty: 2 },
      { folder: "DXF/0043-00-0400 - X - BİTTİ", partCode: "0043-00-0400-02", qty: 2 },
      { folder: "DXF/0043-00-0400 - X - İMAL EDİLDİ", partCode: "0043-00-0400-03", qty: 2 },
    ];
    expect(
      suggestStagesFromFolders({ files: sentetik, parts: mtcDefter.all })
    ).toEqual([]);
  });

  it("noktasız yazım (KESILDI) aynı öneriyi üretir", () => {
    // Ressam Türkçe klavye kullanmadan yazmış olabilir; niyet açıktır.
    // `trKatla` olmasaydı sistem "bunu görmedim" derdi.
    const noktasiz = oneriDosyalari(mtcAnlik).map((f) => ({
      ...f,
      folder: f.folder.replace("KESİLDİ", "KESILDI"),
    }));
    const o = suggestStagesFromFolders({ files: noktasiz, parts: mtcDefter.all });
    expect(o).toHaveLength(1);
    expect(o[0].stage).toBe("kesildi");
    expect(o[0].keys).toHaveLength(20);
    expect(o[0].hintWord).toBe("KESILDI");
  });

  it("zaten işaretli parçalar öneride kalır ama uygulanacak sayı düşer", () => {
    const oncekiler: ProgressMark[] = [
      { key: "0043-00-0100-01", stage: "kesildi", qtyDone: 2 },
      { key: "0043-00-0100-02", stage: "kesildi", qtyDone: 2 },
    ];
    const o = suggestStagesFromFolders({
      files: oneriDosyalari(mtcAnlik),
      parts: mtcDefter.all,
      marks: oncekiler,
    })[0];
    expect(o.keys).toHaveLength(20);
    expect(o.alreadyMarked.sort()).toEqual(["0043-00-0100-01", "0043-00-0100-02"]);
    expect(o.pending).toHaveLength(18);
  });

  it("defterde karşılığı olmayan koda öneri yazılmaz", () => {
    const yabanci: SuggestionFile[] = [
      { folder: "DXF/0099-00-0100 - X - KESİLDİ", partCode: "0099-00-0100-01", qty: 1 },
    ];
    expect(suggestStagesFromFolders({ files: yabanci, parts: mtcDefter.all })).toEqual([]);
  });
});

describe("özet — ULAŞILAN aşama histogramı", () => {
  it("boş tahta sessiz başlar: darboğaz yok, oran sıfır", () => {
    const bos = packageProgress(mtcDefter.coded, [], FALLBACK_STAGES);
    expect(bos.total).toBe(175);
    expect(bos.notStarted).toBe(175);
    expect(bos.started).toBe(0);
    expect(bos.bottleneck).toBeNull();
    expect(bos.completedRatio).toBe(0);
  });

  it("MTC önerisi uygulanınca 20 parça kesildi kovasına girer", () => {
    const oneri = suggestStagesFromFolders({
      files: oneriDosyalari(mtcAnlik),
      parts: mtcDefter.all,
    })[0];
    const marks: ProgressMark[] = oneri.pending.map((k) => ({
      key: k,
      stage: oneri.stage,
      qtyDone: oneri.qtyByKey[k] ?? 0,
    }));

    const ozet = packageProgress(mtcDefter.coded, marks, FALLBACK_STAGES);
    expect(ozet.total).toBe(175);
    expect(ozet.notStarted).toBe(155);
    expect(ozet.buckets.find((b) => b.stage.slug === "kesildi")!.parts).toBe(20);
    // Darboğaz BAŞLANMAMIŞLARI SAYMAZ: 155 her zaman kazanırdı ve "darboğaz
    // henüz başlanmamış iştir" hiçbir şey söylemeyen bir cümledir.
    expect(ozet.bottleneck!.stage.slug).toBe("kesildi");
    expect(ozet.bottleneck!.parts).toBe(20);
    expect(ozet.completed).toBe(0);
  });

  it("kısmi adet parçayı kovaya SOKMAZ, tamamlanınca sokar", () => {
    const parca = mtcDefter.coded.find((p) => p.key === "0043-00-0100-05")!;
    expect(parca.qty).toBe(30);

    const kismi = partProgress(parca, [{ key: parca.key, stage: "kesildi", qtyDone: 12 }], FALLBACK_STAGES);
    expect(kismi.states.kesildi).toBe("kismi");
    expect(kismi.reached).toBe("");
    expect(kismi.started).toBe(true);

    const tam = partProgress(parca, [{ key: parca.key, stage: "kesildi", qtyDone: 30 }], FALLBACK_STAGES);
    expect(tam.states.kesildi).toBe("tamam");
    expect(tam.reached).toBe("kesildi");
  });

  it("adedi bilinmeyen parçada tek işaret TAMAM sayılır", () => {
    const belirsiz = { key: "X", qty: null };
    const p = partProgress(belirsiz, [{ key: "X", stage: "boya", qtyDone: 0 }], FALLBACK_STAGES);
    expect(p.states.boya).toBe("tamam");
    expect(p.reached).toBe("boya");
  });

  it("ULAŞILAN aşama geriye gitmez — atölye eksik doldurmaya zorlanmaz", () => {
    // Yalnız `boya` işaretli bir parçanın ulaştığı aşama `boya`dır. Bunu
    // "kesildi eksik" diye cezalandırmak, doğru olanı yapan kullanıcıyı
    // cezalandırmak olurdu. Bilinçli hoşgörü, testle belgelenir.
    const p = partProgress({ key: "X", qty: 4 }, [{ key: "X", stage: "boya", qtyDone: 4 }], FALLBACK_STAGES);
    expect(p.reached).toBe("boya");
    expect(p.states.kesildi).toBe("yok");
    expect(p.pct).toBe(Math.round((1 / 7) * 100));
  });

  it("son aşama tamamlanınca oran yükselir", () => {
    const ilkUc = mtcDefter.coded.slice(0, 3);
    const marks = ilkUc.map((p) => ({ key: p.key, stage: "montaja_hazir", qtyDone: p.qty ?? 0 }));
    const ozet = packageProgress(mtcDefter.coded, marks, FALLBACK_STAGES);
    expect(ozet.completed).toBe(3);
    expect(ozet.completedRatio).toBeCloseTo(3 / 175, 6);
  });
});

describe("eşleşmeyen üretim kaydı sessizce kaybolmaz", () => {
  it("defterde karşılığı olmayan işaret ayrıca sayılır", () => {
    // `SATINALMA:<açıklama>` anahtarı, ressam Excel'deki tanımı düzeltince
    // öksüz kalır. İş Takibi'ndeki eşleşmemiş kalem deseninin aynısı: kayıt
    // DÜŞÜRÜLMEZ, ekranda ayrıca görünür.
    const marks: ProgressMark[] = [
      { key: "0043-00-0100-05", stage: "kesildi", qtyDone: 30 },
      { key: `${PURCHASE_PREFIX}SOMUN M16 DIN 934`, stage: "satinalindi", qtyDone: 61 },
    ];
    const oksuz = orphanMarks(mtcDefter.all, marks);
    expect(oksuz).toHaveLength(1);
    expect(oksuz[0].key).toContain("SOMUN M16 DIN 934");
  });
});

// --------------------------------------------------------------- sözlük koruması

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260810000002_drawing_progress.sql"),
  "utf-8"
);

/** Tohum `insert` bloğundaki (slug, ad, sıra, ton) dörtlüleri. */
function tohumAsamalar(): { slug: string; name: string; sort: number; hue: number }[] {
  const bas = MIGRATION.indexOf("insert into public.drawing_stages");
  const son = MIGRATION.indexOf("on conflict (slug)", bas);
  expect(bas).toBeGreaterThan(-1);
  expect(son).toBeGreaterThan(bas);
  const blok = MIGRATION.slice(bas, son);
  return [...blok.matchAll(/\('([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/g)].map((m) => ({
    slug: m[1],
    name: m[2],
    sort: Number(m[3]),
    hue: Number(m[4]),
  }));
}

describe("aşama sözlüğü ↔ migration", () => {
  const tohum = tohumAsamalar();

  it("koddaki her aşama migration'ın tohumunda vardır", () => {
    const tohumSlug = tohum.map((t) => t.slug);
    expect(STAGE_SLUGS.filter((s) => !tohumSlug.includes(s))).toEqual([]);
  });

  it("migration'daki her aşama kodda tanımlıdır", () => {
    expect(tohum.length).toBeGreaterThan(0);
    expect(tohum.filter((t) => !STAGE_SLUGS.includes(t.slug as never))).toEqual([]);
  });

  it("yedek liste migration'ın tohumuyla BİREBİR aynıdır", () => {
    // Defter henüz kurulmamışken ekran `FALLBACK_STAGES` ile çalışır. İkisi
    // ayrışırsa migration uygulandığı gün adlar ve renkler yerinden oynardı.
    expect(FALLBACK_STAGES.map((s) => [s.slug, s.name, s.sort, s.colorHue])).toEqual(
      tohum.map((t) => [t.slug, t.name, t.sort, t.hue])
    );
  });

  it("slug'lar ASCII'dir ve tekildir", () => {
    for (const t of tohum) expect(t.slug).toMatch(/^[a-z0-9_]+$/);
    expect(new Set(tohum.map((t) => t.slug)).size).toBe(tohum.length);
    expect(new Set(tohum.map((t) => t.name)).size).toBe(tohum.length);
  });

  it("komşu tonlar en az 40 derece ayrıdır", () => {
    // Aşama çipleri bir parça satırında YAN YANA durur; ayırt edilebilirlik
    // veriyle değil KURALLA garanti edilir (`nextDistinctHue` ile aynı ruh).
    const tonlar = tohum.map((t) => t.hue).sort((a, b) => a - b);
    for (let i = 0; i < tonlar.length; i++) {
      const a = tonlar[i];
      const b = tonlar[(i + 1) % tonlar.length];
      const d = Math.abs(b - a);
      expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(40);
    }
  });

  it("ipucu sözlüğünün hedeflediği aşamalar defterde vardır", () => {
    // `IPUCU_ASAMA` içeriden görünmez; hedefleri gerçek fikstür üzerinden
    // sınanır — üretilen her önerinin aşaması tohumda olmalıdır.
    const tohumSlug = tohum.map((t) => t.slug);
    const oneriler = suggestStagesFromFolders({
      files: oneriDosyalari(mtcAnlik),
      parts: mtcDefter.all,
    });
    expect(oneriler.length).toBeGreaterThan(0);
    for (const o of oneriler) expect(tohumSlug).toContain(o.stage);
  });

  it("stage_id metin sütununu YERİNDEN ETMEZ", () => {
    // Asıl anahtar metindir: defter satırı silinse bile atölye kaydı yaşamalı.
    expect(MIGRATION).toContain("add column if not exists stage_id");
    expect(MIGRATION).toContain("on delete set null");
    // Mevcut migration DEĞİŞTİRİLMEDİ: metin sütunu hâlâ orada tanımlı.
    const oncekiMigration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260810000001_drawing_packages.sql"),
      "utf-8"
    );
    expect(oncekiMigration).toContain("stage text not null");
  });
});
