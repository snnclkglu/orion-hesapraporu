// Bağlantı koruma testi — kontrol ↔ hesap satırı eşlemesinin sessizce bozulmasını engeller.
//
// NEDEN: `presentation/check-anchors.ts` bir kontrolü bir hesap satırına bağlar.
// Bağlantı yanlış olduğunda BUGÜN hiçbir uyarı çıkmaz: sunum katmanı kontrolü
// sessizce bölümün sonundaki "Diğer Kontroller" bloğuna düşürür. Ne derleme
// hatası, ne test hatası — yalnızca rapor okunurluğu sessizce bozulur.
//
// Yaklaşan semantik anahtar göçü tam olarak şu üçlüyü aynı anda değiştirecek:
//   · check-anchors.ts       (kontrol → satır bağlantı haritası)
//   · *Sections.ts           (satır tanımları, checkSuffixes listeleri)
//   · module-adapters.ts     (satır anchorId üretimi)
// Bu üçlü birbirinden kayarsa hata sessiz kalır. Bu dosya o sessizliği kırar.

import { describe, expect, it } from "vitest";
import { MODULE_ADAPTERS } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { runCalc, type CalcResult } from "../engine";
import { checkAnchor } from "../presentation/check-anchors";
import { moduleFamily, type ModuleKey } from "../presentation/module-family";
import { moduleResult as moduleResultOf } from "../presentation/module-access";
import type { AnyCheck } from "../types";

/**
 * Bugün motorun `NEW_WORK_TEMPLATE` ile ürettiği toplam kontrol sayısı — ve
 * bunların TAMAMININ bir bölüme bağlı olduğu gerçeği (218/218, ölçülmüş değer).
 * Şablon TÜM hesap bölümlerini içerir (ana/yardımcı/iki monoray kaldırma, her
 * birinin kanca bloğu ve arabası, köprü, ana kiriş, buruşma, başkiriş), böylece
 * koruma bütün bölümleri kapsar.
 *
 * Sayı bilinçli olarak sabitlenmiştir: kontrol eklendiğinde ya da
 * kaldırıldığında test kırılır ve mühendis, kontrolün bir bölüme bağlandığını
 * onaylamak zorunda kalır. Sayıyı düşünmeden güncellemek bu korumayı işlevsiz
 * bırakır — önce kontrolün raporda göründüğünü doğrulayın, sonra güncelleyin.
 */
// 221 = 212 + 6 + 3:
//   +6  emniyet frenli varyantta ana ve yardımcı kaldırma gruplarının her biri
//       üç kontrol üretir (moment, flanş çapı, hava aralığı). Monoray
//       gruplarında tambur emniyet freni uygulanmadığı için kontrol çıkmaz.
//   +3  teker yükleri bölümü: savrulma açısı (10.3), kılavuz kuvveti denge
//       kontrolü (10.3), boyuna kuvvet bandı (10.4).
const EXPECTED_CHECK_COUNT = 221;

const result: CalcResult = runCalc(NEW_WORK_TEMPLATE);

/**
 * Emniyet freni KOŞULLU bir bölümdür (2.8): yalnız emniyet freni öngörülen
 * kaldırma gruplarında hesaplanır. Yeni iş şablonunda varsayılan "Yok"tur —
 * çoğu vinçte tambur emniyet freni bulunmaz. Koruma kapsamının bu bölümü de
 * içermesi için şablon bir de frenli varyantla koşturulur ve kontrol listeleri
 * birleştirilir; aksi hâlde 2.8'in bağlantıları hiç sınanmazdı.
 */
const resultWithSafetyBrake: CalcResult = runCalc({
  ...NEW_WORK_TEMPLATE,
  specs: { ...NEW_WORK_TEMPLATE.specs, hoistSafetyBrake: "Ana ve Yardımcı Kaldırmada" },
});

/** Modül anahtarı → o modülün sonucu (ortak erişim katmanından). */
function moduleChecks(key: ModuleKey): AnyCheck[] | undefined {
  const base = moduleResultOf(result, key)?.checks;
  if (base === undefined) return undefined;
  const extra = moduleResultOf(resultWithSafetyBrake, key)?.checks ?? [];
  const seen = new Set(base.map((c) => c.id));
  return [...base, ...extra.filter((c) => !seen.has(c.id))];
}

/** Kontrol id'sinin modül önekinden sonraki kısmı ("main.rope.safety" → "rope.safety"). */
function suffixOf(checkId: string, prefix: string): string {
  return checkId.startsWith(prefix) ? checkId.slice(prefix.length) : checkId;
}

describe("bağlantı koruma — kontrol ↔ hesap satırı", () => {
  it("şablon tüm modülleri hesaplar (koruma kapsamı eksiksiz)", () => {
    const missing = MODULE_ADAPTERS.filter((a) => moduleChecks(a.key) === undefined).map(
      (a) => a.key
    );
    expect(
      missing,
      `Şu modüller şablonda hesaplanmıyor: ${missing.join(", ")}.\n` +
        `Bu testin koruma kapsamı bu modüllerde ÇALIŞMAZ. NEW_WORK_TEMPLATE'e ` +
        `ilgili modül girdilerini ekleyin.`
    ).toEqual([]);
  });

  it("her bağlantı, bölümün gerçek bir hesap satırını gösterir", () => {
    const failures: string[] = [];
    for (const adapter of MODULE_ADAPTERS) {
      for (const section of adapter.sections) {
        const rowIds = new Set(section.rows.map((r) => r.anchorId));
        for (const suffix of section.checkSuffixes) {
          const anchor = checkAnchor(adapter.key, section.rawId, suffix);
          if (anchor === undefined) continue; // eşleme yok → ayrı test kapsıyor
          if (!rowIds.has(anchor)) {
            failures.push(
              `${adapter.key} / bölüm ${section.rawId} / kontrol "${suffix}" → ` +
                `"${anchor}" satırı bu bölümde YOK. ` +
                `Mevcut satır kimlikleri: ${[...rowIds].join(", ") || "(satır yok)"}`
            );
          }
        }
      }
    }
    expect(
      failures,
      failures.length === 0
        ? ""
        : `Kontrol ↔ satır bağlantısı kopmuş.\n\n${failures.join("\n")}\n\n` +
            `YAPILACAK: presentation/check-anchors.ts içindeki hedef satır kimliğini, ` +
            `ilgili *Sections.ts dosyasındaki satırın module-adapters.ts'te üretilen ` +
            `anchorId değeriyle eşitleyin. (Araba/köprü ortak sunumunda anchorId ` +
            `HER İKİ modülde de araba satırının kimliğidir.)`
    ).toEqual([]);
  });

  it("bağlantısı tanımlı her kontrol motor tarafından gerçekten üretilir", () => {
    // Bağlantı haritası modül başına değil AİLE başına tanımlıdır (ana/yardımcı
    // kaldırma, araba/köprü yürütme aynı haritayı paylaşır). Motor bazı
    // kontrolleri yalnızca ailenin bir varyantında üretir — ör. araba
    // "gearbox.safety", köprü "gearbox.torque" üretir. Bu yüzden bir sonek,
    // ailenin EN AZ BİR modülünde üretiliyorsa canlıdır; hiçbirinde
    // üretilmiyorsa harita gerçekten ölüdür.
    const producedByFamily = new Map<string, Set<string>>();
    for (const adapter of MODULE_ADAPTERS) {
      const checks = moduleChecks(adapter.key);
      if (!checks) continue;
      const family = moduleFamily(adapter.key);
      let set = producedByFamily.get(family);
      if (!set) producedByFamily.set(family, (set = new Set<string>()));
      for (const c of checks) set.add(suffixOf(c.id, adapter.checkPrefix));
    }

    const stale: string[] = [];
    const seen = new Set<string>();
    for (const adapter of MODULE_ADAPTERS) {
      const family = moduleFamily(adapter.key);
      const produced = producedByFamily.get(family);
      if (!produced) continue;
      for (const section of adapter.sections) {
        for (const suffix of section.checkSuffixes) {
          if (checkAnchor(adapter.key, section.rawId, suffix) === undefined) continue;
          if (produced.has(suffix)) continue;
          // Aynı aileyi iki modül paylaştığında uyarıyı tek kez yaz
          const tag = `${family}|${section.rawId}|${suffix}`;
          if (seen.has(tag)) continue;
          seen.add(tag);
          stale.push(
            `${family} ailesi / bölüm ${section.rawId} / "${suffix}": ` +
              `haritada bağlantı var ama ailenin hiçbir modülü bu kontrolü üretmiyor.`
          );
        }
      }
    }
    expect(
      stale,
      stale.length === 0
        ? ""
        : `Ölü bağlantı (haritada var, motorda yok).\n\n${stale.join("\n")}\n\n` +
            `YAPILACAK: kontrol kaldırıldıysa check-anchors.ts ve *Sections.ts ` +
            `checkSuffixes listesinden de silin; kontrolün id'si değiştiyse ` +
            `haritadaki soneki yeni id'ye göre güncelleyin.`
    ).toEqual([]);
  });

  it("motorun ürettiği hiçbir kontrol rapordan düşmez", () => {
    const orphans: string[] = [];
    for (const adapter of MODULE_ADAPTERS) {
      const checks = moduleChecks(adapter.key);
      if (!checks) continue;
      const covered = new Set<string>();
      for (const section of adapter.sections) {
        for (const suffix of section.checkSuffixes) covered.add(suffix);
      }
      for (const c of checks) {
        const suffix = suffixOf(c.id, adapter.checkPrefix);
        if (!covered.has(suffix)) {
          orphans.push(`${adapter.key}: "${c.id}" (${c.label}) hiçbir bölüme bağlı değil.`);
        }
      }
    }
    expect(
      orphans,
      orphans.length === 0
        ? ""
        : `Raporda görünmeyen kontrol(ler) var.\n\n${orphans.join("\n")}\n\n` +
            `YAPILACAK: kontrolü ait olduğu bölümün *Sections.ts dosyasındaki ` +
            `checkSuffixes listesine ekleyin; ardından check-anchors.ts'te ` +
            `gösterileceği hesap satırını belirtin.`
    ).toEqual([]);
  });

  it("kontrol sayısı sabittir ve tamamı bağlıdır", () => {
    // Toplam da bağlı sayısı da AYNI (birleştirilmiş) kümeden okunur; aksi
    // hâlde koşullu bölümün kontrolleri paya girip paydaya girmezdi.
    const total = MODULE_ADAPTERS.reduce(
      (n, adapter) => n + (moduleChecks(adapter.key)?.length ?? 0),
      0
    );
    const bound = MODULE_ADAPTERS.reduce((n, adapter) => {
      const checks = moduleChecks(adapter.key);
      if (!checks) return n;
      const covered = new Set<string>();
      for (const section of adapter.sections) {
        for (const suffix of section.checkSuffixes) covered.add(suffix);
      }
      return n + checks.filter((c) => covered.has(suffixOf(c.id, adapter.checkPrefix))).length;
    }, 0);

    expect(
      `${bound}/${total}`,
      `Kontrol bağlama oranı değişti. Beklenen ${EXPECTED_CHECK_COUNT}/${EXPECTED_CHECK_COUNT}, ` +
        `bulunan ${bound}/${total}.\n` +
        `YAPILACAK: yeni kontrol eklediyseniz ilgili bölümün checkSuffixes listesine ` +
        `ve check-anchors.ts haritasına ekleyin, sonra bu dosyadaki ` +
        `EXPECTED_CHECK_COUNT değerini bilinçli olarak güncelleyin.`
    ).toBe(`${EXPECTED_CHECK_COUNT}/${EXPECTED_CHECK_COUNT}`);
  });
});
