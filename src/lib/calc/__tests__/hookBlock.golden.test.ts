// Kanca bloğu — TARİHSEL DOĞRULAMA.
//
// Bu bir ŞARTNAME DEĞİLDİR: uygulamanın hesap yöntemi doğrudan standartlara
// dayanır (DIN 15400 / FEM 1.001 / CMAA 70 / DIN 15018) ve ilk portun çıkış
// noktası olan hesap tablosuna uymak zorunda değildir. Buradaki karşılaştırma
// yalnızca "ilk portta şu sayı çıkıyordu" bilgisini bir regresyon ağı olarak
// canlı tutar; öncelik her zaman uygulamanın kendi yöntemindedir.
//
// TOLERANS gevşetilmiştir (1e-4 göreli): π hassasiyeti (eski tabloda kesilmiş
// π sabiti kullanılıyordu) ve yöntem iyileştirmeleri küçük ama sıfır olmayan
// farklar üretir. Bilinçli olarak SAPILAN büyüklükler ayrıca karşılaştırmadan
// çıkarılır ve `SAPMA` sözlüğünde gerekçeleriyle belgelenir.
//
// Akış: döküm hücresi → HOOKBLOCK_ALIASES → semantik anahtar → motor değeri.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_HOOKBLOCK_DEPS,
  V5_HOOKBLOCK_INPUTS,
  V5_HOOKBLOCK_SELECTIONS,
} from "../defaults/hookBlock";
import { computeHookBlock } from "../modules/hookBlock";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";
import { HOOKBLOCK_ALIASES } from "./legacy/alias-hookblock";
import { tickFromCheck } from "./legacy/excel-alias";

/** Tarihsel karşılaştırmanın göreli toleransı (bkz. dosya başı açıklaması). */
const TOLERANS = 1e-4;

/**
 * Motorda KARŞILIĞI OLMAYAN döküm hücreleri ve neden kapsam dışı oldukları.
 * Üç gruba ayrılır: girdi/bağımlılık yankıları, gösterim ikizleri ve eski
 * tabloda hata değeri üreten bozuk zincir.
 */
const KAPSAM_DISI: Record<string, string> = {
  // --- Girdi / bağımlılık yankısı: motor bu değerleri hesaplamaz, alır
  L12: "Halat çapı — kaldırma grubundan gelen bağımlılığın yankısı",
  L33: "Tambur devri — kaldırma grubundan gelen bağımlılığın yankısı",
  L51: "Halat yükü T — kaldırma grubundan gelen bağımlılığın yankısı",

  // --- Gösterim ikizi: başka bir büyüklüğün birebir kopyası
  I172: "σmax gösterim ikizi (fatigue.sigmaMax ile aynı büyüklük)",
  I183: "τmax gösterim ikizi (fatigue.tauMax ile aynı büyüklük)",

  // --- Kontrol sonucu: motorda hücre değil, Check.pass alanı
  P132: "Statik gerilme kontrolünün işaret hücresi → hookBlock.girder.static",
  N172: "Yorulma normal gerilme kontrolünün işaret hücresi → hookBlock.fatigue.sigma",
  N183: "Yorulma kesme gerilmesi kontrolünün işaret hücresi → hookBlock.fatigue.tau",
  N188: "Bileşik yorulma kontrolünün işaret hücresi → hookBlock.fatigue.combined",

  // --- Eski tablonun bozuk yorulma zinciri (silinmiş malzeme seçimi):
  //     döküm bu hücrelerde sayı değil hata metni taşır, karşılaştırılamaz.
  L134: "Statik izin gerilmesi — silinmiş malzeme seçimine bağlı bozuk zincir",
  L154: "zul σ D(-1) — silinmiş malzeme seçimine bağlı bozuk zincir",
  L155: "zul σ D(-1) birim dönüşümü — bozuk zincire bağlı",
  L157: "zul σ Dz(0) — bozuk zincire bağlı",
  L169: "zul σ Dz(x) — bozuk zincire bağlı",
  L172: "zul σ Dz(x) gösterimi — bozuk zincire bağlı",
  L177: "zul τ (W0) — silinmiş malzeme seçimine bağlı bozuk zincir",
  L178: "zul τ birim dönüşümü — bozuk zincire bağlı",
  L180: "zul τ D(x) — bozuk zincire bağlı",
  L183: "zul τ D(x) gösterimi — bozuk zincire bağlı",
  I188: "Bileşik yorulma oranı — bozuk zincire bağlı",
};

/**
 * BİLİNÇLİ SAPMALAR: eşlemesi vardır ama motor kasıtlı olarak farklı bir sonuç
 * üretir. Karşılaştırmadan çıkarılır; her satır "eski değer → yeni değer" ve
 * mühendislik gerekçesini taşır.
 */
const SAPMA: Record<string, string> = {
  // --- §4.4 Mil: eski tablo kendi içinde tutarsızdı
  L58: "Ra 15000 → 3750 kg. Eski tablo mesnet tepkisi yerine milin TOPLAM yükünü " +
    "yazıyordu (Ra + Rb = 2·ΣP → denge sağlanmıyordu). Tepkiler artık ortak kiriş " +
    "çözücüsüyle (beam.ts) moment dengesinden bulunur.",
  L59: "Rb 15000 → 3750 kg. Eski tablo Ra'yı kopyalıyordu; artık bağımsız çözülür.",
  L62: "Mmaks 37500 → 18750 kg·cm. Moment, makara adedi ve konumlarına göre " +
    "(A/B/D ölçü zinciri) kiriş çözücüsüyle bulunur; tekil makara varsayımı yoktur.",
  L65: "σ 1390,89 → 695,44 kg/cm². Yeniden çözülen momente bağlı.",
  L66: "τ 452,04 → 113,01 kg/cm². Yeniden çözülen mesnet tepkisine bağlı " +
    "(ortalama kayma kabulü V/A korunmuştur).",
  L67: "σbil 1596,11 → 722,46 kg/cm². Yeniden çözülen σ ve τ'ya bağlı; " +
    "C45 izin gerilmesinin (1180) altında kaldığı için kontrol artık GEÇER.",

  // --- §4.6 ψ: serbest sayı değil, kaldırma sınıfının tablo satırı
  L124: "ψ 1,708 → 1,531. Eski tabloda k = 1,4 ve l = 0,0088 elle girilmiş iki " +
    "serbest sayıydı; bunlar DIN 15018 Tablo 2'nin H4 satırıdır. Oysa teknik " +
    "özelliklerdeki kaldırma sınıfı H3'tür (H3/B4) → k = 1,3 · l = 0,0066. " +
    "DİKKAT: bu değişiklik ψ'yi ~%10 DÜŞÜRÜR, yani EMNİYETSİZ yöndedir. " +
    "Veri kendi içinde çelişiyordu; motor teknik özellikleri esas alır. " +
    "Gerçekten H4 isteniyorsa teknik özelliklerdeki sınıf H4 yapılmalı ya da " +
    "k/l elle ezilmelidir.",
  L130: "σ 20,0066 → 17,9334 kg/cm². ψ'nin kaldırma sınıfından türetilmesine bağlı.",
  L131: "τ 5,4464 → 4,8820 kg/cm². ψ'nin kaldırma sınıfından türetilmesine bağlı.",
  L132: "σbil 22,1191 → 19,8269 kg/cm². ψ'nin kaldırma sınıfından türetilmesine bağlı.",
};

const result = computeHookBlock(
  V5_SPECS,
  "hookBlock",
  V5_HOOKBLOCK_INPUTS,
  V5_HOOKBLOCK_SELECTIONS,
  V5_HOOKBLOCK_DEPS
);

const dumpCells = loadFormulaCells("05_04_KANCA_BLOĞU.txt").filter(
  (c) => !isDecorative(c)
);

describe("kanca bloğu — tarihsel doğrulama", () => {
  it("her döküm hücresi ya eşlemede ya da gerekçeli kapsam dışıdır", () => {
    const eksik = dumpCells
      .map((c) => c.cell)
      .filter((cell) => !(cell in HOOKBLOCK_ALIASES) && !(cell in KAPSAM_DISI));
    expect(
      eksik,
      `Şu hücreler ne eşlemede ne de KAPSAM_DISI sözlüğünde: ${eksik.join(", ")}.\n` +
        `YAPILACAK: motorda karşılığı varsa alias-hookblock.ts'e semantik anahtarını ` +
        `ekleyin; yoksa KAPSAM_DISI'na tek cümlelik gerekçesiyle yazın.`
    ).toEqual([]);

    const cakisan = Object.keys(KAPSAM_DISI).filter((cell) => cell in HOOKBLOCK_ALIASES);
    expect(cakisan, `Hem eşlemede hem kapsam dışında: ${cakisan.join(", ")}`).toEqual([]);
  });

  it("KAPSAM_DISI ve SAPMA sözlükleri bayatlamamıştır", () => {
    const dumpSet = new Set(dumpCells.map((c) => c.cell));

    const olu = Object.keys(KAPSAM_DISI).filter((cell) => !dumpSet.has(cell));
    expect(
      olu,
      `KAPSAM_DISI'nda olup dökümde bulunmayan hücreler: ${olu.join(", ")}`
    ).toEqual([]);

    const eslemesiz = Object.keys(SAPMA).filter((cell) => !(cell in HOOKBLOCK_ALIASES));
    expect(
      eslemesiz,
      `SAPMA listesindeki şu hücrelerin eşlemesi yok: ${eslemesiz.join(", ")}. ` +
        `Sapma, motorda KARŞILIĞI OLAN bir büyüklük için tanımlanır.`
    ).toEqual([]);
  });

  it("sapma listesindeki hücreler gerçekten farklı hesaplanır", () => {
    const ayni: string[] = [];
    for (const cell of Object.keys(SAPMA)) {
      const dc = dumpCells.find((c) => c.cell === cell);
      expect(dc, `${cell} SAPMA listesinde ama dökümde yok`).toBeDefined();
      const { ok } = compareCell(dc!.value, result.cells[HOOKBLOCK_ALIASES[cell]], TOLERANS);
      if (ok) ayni.push(cell);
    }
    expect(
      ayni,
      `Şu hücreler SAPMA listesinde ama motor eski değeri üretiyor: ${ayni.join(", ")}.\n` +
        `Sapma geri alındıysa listeden çıkarın — bayat sapma kaydı koruma değeri taşımaz.`
    ).toEqual([]);
  });

  it("sapma dışındaki tüm eşlenmiş hücreler motor değerleriyle uyuşur", () => {
    const karsilastirilan = Object.keys(HOOKBLOCK_ALIASES).filter((c) => !(c in SAPMA));
    // Kapsam daralmasın: eşlemenin büyük bölümü karşılaştırılmaya devam etmeli.
    expect(karsilastirilan.length).toBeGreaterThanOrEqual(38);

    const hatalar: string[] = [];
    for (const cell of karsilastirilan) {
      const dc = dumpCells.find((c) => c.cell === cell);
      if (!dc) {
        hatalar.push(`${cell}: eşlemede var ama dökümde yok`);
        continue;
      }
      const key = HOOKBLOCK_ALIASES[cell];
      const { ok, message } = compareCell(dc.value, result.cells[key], TOLERANS);
      if (!ok) hatalar.push(`${cell} → ${key}: ${message}`);
    }
    expect(hatalar, hatalar.join("\n")).toEqual([]);
  });

  it("motor hiçbir tarihsel hücre adresini anahtar olarak üretmez", () => {
    const hucreBiçimi = /^[A-Z]{1,2}\d{1,4}$/;
    const kirli = Object.keys(result.cells).filter((k) => hucreBiçimi.test(k));
    expect(kirli, `Hücre adresi biçiminde anahtarlar: ${kirli.join(", ")}`).toEqual([]);

    const semantikOlmayan = Object.keys(result.cells).filter(
      (k) => k.split(".").length !== 2
    );
    expect(
      semantikOlmayan,
      `Şema dışı anahtarlar (<blok>.<büyüklük> olmalı): ${semantikOlmayan.join(", ")}`
    ).toEqual([]);
  });
});

describe("kanca bloğu — mühendislik sonuçları", () => {
  const byId = (id: string) => result.checks.find((c) => c.id === id);

  it("makara rulmanı ömrü yetersiz kalır (bilinen V5 durumu)", () => {
    expect(byId("hookBlock.sheaveBearing.life")?.pass).toBe(false);
    expect(result.values.sheaveBearingLifeHours).toBeCloseTo(2707.132407049, 6);
    expect(result.values.requiredLifeMin).toBe(6300);
  });

  it("mil modeli donanımdan gelen makara adediyle çözülür", () => {
    // 2/2 donanım → kanca bloğunda 1 makara → mesnet başına T
    expect(result.values.sheaveCount).toBe(1);
    expect(result.values.reactionAKg).toBeCloseTo(3750, 6);
    expect(result.values.reactionBKg).toBeCloseTo(3750, 6);
    expect(result.values.shaftMomentKgCm).toBeCloseTo(18750, 6);
    // Gerçek mesnet tepkisiyle bileşik gerilme C45 izninin altında kalır
    expect(result.values.shaftCombinedStress).toBeCloseTo(722.4637296245103, 6);
    expect(byId("hookBlock.shaft.stress")?.pass).toBe(true);
  });

  it("kanca kapasitesi DIN 15400 Tablo 3'ten okunur", () => {
    // Nr 10 / sınıf S / M6 (2m) → 20 t
    expect(result.values.hookCapacityFromTable).toBe(true);
    expect(result.values.hookCapacityKg).toBe(20000);
    expect(result.values.hookDinGroup).toBe("2m");
    expect(byId("hookBlock.hook.capacity")?.pass).toBe(true);
    expect(byId("hookBlock.sheave.dia")?.pass).toBe(true);
    expect(byId("hookBlock.hookBearing.static")?.pass).toBe(true);
  });

  it("ψ katsayısı kaldırma sınıfından (DIN 15018 Tablo 2) türetilir", () => {
    // Teknik özellikler: "H3/B4" → H3 satırı → k = 1,3 · l = 0,0066
    expect(result.values.hoistClassUsed).toBe("H3");
    expect(result.values.dynamicFactorOverridden).toBe(false);
    expect(result.values.dynamicFactorK).toBe(1.3);
    expect(result.values.dynamicFactorL).toBe(0.0066);
    expect(result.values.dynamicFactor).toBeCloseTo(1.531, 9);
  });

  it("ψ katsayısı gerekçeli olarak elle ezilebilir", () => {
    const ezilmis = computeHookBlock(
      V5_SPECS,
      "hookBlock",
      { ...V5_HOOKBLOCK_INPUTS, dynamicFactorKOverride: 1.4, dynamicFactorLOverride: 0.0088 },
      V5_HOOKBLOCK_SELECTIONS,
      V5_HOOKBLOCK_DEPS
    );
    expect(ezilmis.values.dynamicFactorOverridden).toBe(true);
    expect(ezilmis.values.dynamicFactor).toBeCloseTo(1.708, 9);
    // Ezme, ilk portun ψ değerini birebir geri getirir
    expect(ezilmis.cells["girder.bendingStress"]).toBeCloseTo(20.0066494789861, 9);
    expect(ezilmis.cells["girder.shearStress"]).toBeCloseTo(5.44642857142857, 9);
    expect(ezilmis.cells["girder.combinedStress"]).toBeCloseTo(22.1191495298991, 9);
  });

  it("yorulma zinciri DIN 15018 Tablo 17/18'den kurulur", () => {
    // S235JR → St37, çentik K3, yük grubu B6 → 45 N/mm²
    expect(result.values.fatigueSigmaD1Nmm2).toBe(45);
    expect(result.values.fatigueTauW0Nmm2).toBe(120); // St37 / W0 / B6
    expect(result.values.fatigueSigmaDz0KgCm2).toBeCloseTo(((45 * 100) / 9.81) * 5 / 3, 6);
    expect(result.values.kappa).toBeCloseTo(0.466666666666667, 9);
  });

  it("statik ve yorulma kontrolleri sağlanır", () => {
    // Eski tabloda bu kontroller hata değeri üreten hücrelerdi; motorda sonuç
    // Check.pass alanından gelir. Tik gösterimi yalnız bu test katmanında üretilir.
    for (const id of [
      "hookBlock.girder.static",
      "hookBlock.fatigue.sigma",
      "hookBlock.fatigue.tau",
      "hookBlock.fatigue.combined",
    ]) {
      expect(byId(id)?.pass, id).toBe(true);
      expect(tickFromCheck(result.checks, id), id).toBe("ü");
    }
  });

  it("her kontrol dayanağını ve etkisini bildirir", () => {
    const eksik = result.checks.filter(
      (c) => c.kind === undefined || c.severity === undefined
    );
    expect(
      eksik.map((c) => c.id),
      "kind/severity alanı eksik kontroller"
    ).toEqual([]);
    // Montaj uyumu bilgilendirmedir, tasarımı reddetmez
    const bore = byId("hookBlock.sheaveBearing.bore");
    expect(bore?.kind).toBe("bilgi");
    expect(bore?.severity).toBe("uyari");
  });
});
