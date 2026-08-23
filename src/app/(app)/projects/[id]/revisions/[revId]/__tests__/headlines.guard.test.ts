// UYGUNLUK ÖZETİ ŞERİDİ — kapsam koruması.
//
// NEDEN: şerit bölümün BAŞINDA "bu bölüm uygun mu?" sorusunu cevaplar
// (kullanıcı kararı, 23.08.2026: *"kontrolü çok kolaylaştırıyor"*). Kolaylığın
// kaynağı TEKDÜZE YERDİR — mühendis cevabı her bölümde aynı noktada bulur.
// Bu yüzden bir bölüme yeni kontrol eklenip şeride eklenmezse, o kontrol
// SESSİZCE şeridin dışında kalır ve tekdüzelik bozulur: ne derleme hatası
// çıkar ne de test kırılır. Bu dosya o sessizliği kırar.
//
// Üç şey ayrı ayrı doğrulanır:
//   1. Şerideki her sonek, bölümün `checkSuffixes` bildiriminde VAR MI
//      (yoksa satır motorda hiç bulunamaz, şerit boş çizilir).
//   2. Sayısal yargı üreten HER bölümün şeridi var mı ve şerit o bölümün
//      BÜTÜN yargılarını taşıyor mu.
//   3. Etiketler dolu mu, "band" şeridinin başlığı var mı ve başlık raporun
//      KONTROL DİZİNİYLE aynı adı taşımıyor mu.

import { describe, expect, it } from "vitest";
import { MODULE_ADAPTERS, headlineItems } from "../module-adapters";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { moduleResult } from "@/lib/calc/presentation/module-access";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";

/**
 * ŞERİDE GİRMEYEN KONTROLLER — iki sayısı olmayanlar.
 *
 * Şerit "hesaplanan ⟨işaret⟩ sınır" diye okunur. Bir ONAY ya da VARLIK
 * kontrolü ("ölçü onaylandı", "tahvil oranı seçilmiş", "fren boşluğu bandda")
 * orada "0 ≥ 1" diye görünür ve hiçbir şey anlatmaz; kararın kendisi zaten
 * kutunun yanındadır. KAPSAM bilgilendirmeleri de ("rüzgâr modellenmiyor",
 * "tepki yapıya aktarılmaz") bir yargı değil, bir nottur.
 */
const BAND_DISI_SONEKLER = new Set([
  "measurements.confirmed",
  "loads.measurements.confirmed",
  "gearbox.selected",
  "safety.airGap",
  "buffer.speedThreshold",
  "buffer.scope",
  "skew.balance",
  "loadCaseII.scope",
]);

/**
 * ŞERİDİ OLMAYAN BÖLÜMLER — gerekçesiyle.
 *
 * Kabin / elektrik odası / pano (11.x): kontrolleri bir mühendislik yargısı
 * değil KATALOG DURUMUDUR ("ürün seçilmiş mi", "katalogda sınır yayımlanmış
 * mı"). Ürün seçilmemişken sınır 0'dır ve şerit "1,39 ≤ 0,00 kW" diye bağırır;
 * bu, olmayan bir hesap hatasını varmış gibi gösterirdi. Bölümün kendi
 * kontrol satırları yerinde durmaya devam eder.
 */
const SERITSIZ_BOLUMLER = new Set(["cabin:11.1", "cabin:11.2", "cabin:11.3"]);

/** Raporun sonundaki KONTROL DİZİNİNİN adı — şerit başlığı bu olamaz. */
const RAPOR_DIZIN_BASLIGI = "Kontrol Özeti";

const sonuc = runCalc({
  ...NEW_WORK_TEMPLATE,
  specs: {
    ...NEW_WORK_TEMPLATE.specs,
    hoistSafetyBrake: "Ana ve Yardımcı Kaldırmada",
    girderArrangement: "dort",
  },
});

/** Bölümün şeride girmesi gereken kontrol sonekleri. */
const bandSonekleri = (suffixes: readonly string[]) =>
  suffixes.filter((s) => !BAND_DISI_SONEKLER.has(s));

describe("uygunluk özeti şeridi — kapsam koruması", () => {
  it("şerideki her sonek bölümün checkSuffixes bildiriminde vardır", () => {
    const bozuk: string[] = [];
    for (const a of MODULE_ADAPTERS) {
      for (const s of a.sections) {
        if (!s.headline) continue;
        for (const h of s.headline.checks) {
          if (!s.checkSuffixes.includes(h.suffix)) {
            bozuk.push(`${a.key}:${s.rawId} → ${h.suffix}`);
          }
        }
      }
    }
    expect(bozuk, bozuk.join("\n")).toEqual([]);
  });

  it("sayısal yargı üreten her bölümün şeridi vardır", () => {
    const eksik: string[] = [];
    for (const a of MODULE_ADAPTERS) {
      for (const s of a.sections) {
        const anahtar = `${a.key}:${s.rawId}`;
        if (SERITSIZ_BOLUMLER.has(anahtar)) continue;
        if (bandSonekleri(s.checkSuffixes).length === 0) continue;
        if (!s.headline) eksik.push(anahtar);
      }
    }
    expect(
      eksik,
      "YAPILACAK: bu bölümlere şerit ekleyin (module-adapters.ts *_HEADLINES) " +
        `ya da gerekçesiyle SERITSIZ_BOLUMLER listesine yazın:\n${eksik.join("\n")}`
    ).toEqual([]);
  });

  it("şerit bölümün BÜTÜN sayısal yargılarını taşır", () => {
    const eksik: string[] = [];
    for (const a of MODULE_ADAPTERS) {
      for (const s of a.sections) {
        if (!s.headline) continue;
        const seritte = new Set(s.headline.checks.map((h) => h.suffix));
        for (const suffix of bandSonekleri(s.checkSuffixes)) {
          if (!seritte.has(suffix)) eksik.push(`${a.key}:${s.rawId} → ${suffix}`);
        }
      }
    }
    expect(
      eksik,
      "Şerit eksik kalırsa bölümün başındaki özet YANILTIR — hepsi ✓ görünürken " +
        `aşağıdaki kontrol dışarıda kalır:\n${eksik.join("\n")}`
    ).toEqual([]);
  });

  it("etiketler dolu, band şeridinin başlığı var ve dizin adıyla çakışmaz", () => {
    const bozuk: string[] = [];
    for (const a of MODULE_ADAPTERS) {
      for (const s of a.sections) {
        const h = s.headline;
        if (!h) continue;
        const anahtar = `${a.key}:${s.rawId}`;
        if (!h.computedLabel.trim() || !h.limitLabel.trim()) {
          bozuk.push(`${anahtar}: boş etiket`);
        }
        if (h.placement === "band" && !h.title?.trim()) {
          bozuk.push(`${anahtar}: band şeridinin başlığı yok`);
        }
        if (h.title === RAPOR_DIZIN_BASLIGI) {
          bozuk.push(`${anahtar}: başlık rapor dizininin adıyla aynı`);
        }
        for (const c of h.checks) {
          if (c.computedLabel !== undefined && !c.computedLabel.trim()) {
            bozuk.push(`${anahtar}/${c.suffix}: boş computedLabel`);
          }
          if (c.limitLabel !== undefined && !c.limitLabel.trim()) {
            bozuk.push(`${anahtar}/${c.suffix}: boş limitLabel`);
          }
        }
      }
    }
    expect(bozuk, bozuk.join("\n")).toEqual([]);
  });

  it("şerit satırları motorun ÜRETTİĞİ kontrollere oturur", () => {
    // Yeni iş şablonunda üretilen her modül için şeridin en az bir satırı
    // çözülmelidir; hiç çözülmüyorsa sonek yanlış yazılmış demektir.
    const bos: string[] = [];
    for (const a of MODULE_ADAPTERS) {
      const mr = moduleResult(sonuc, a.key as ModuleKey);
      if (!mr) continue;
      for (const s of a.sections) {
        if (!s.headline) continue;
        // Koşullu bölümler (feston, tampon "yok", emniyet freni) bu fikstürde
        // hiç kontrol üretmez; onları eleyip yalnız üretenlere bakıyoruz.
        const uretilen = s.checkSuffixes.filter((suf) =>
          mr.checks.some((c) => c.id === `${a.checkPrefix}${suf}`)
        );
        if (bandSonekleri(uretilen).length === 0) continue;
        if (headlineItems(a.checkPrefix, s, mr.checks).length === 0) {
          bos.push(`${a.key}:${s.rawId}`);
        }
      }
    }
    expect(bos, bos.join("\n")).toEqual([]);
  });
});
