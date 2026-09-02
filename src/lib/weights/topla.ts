// AĞIRLIK DÖKÜMÜNÜ KURAN TEK FONKSİYON.
//
// SAFTIR: DB/HTTP/React yoktur ve **ASLA FIRLATMAZ**. Sebep ölçülmüş bir
// arızadır: `runCalc` revizyon editöründe bir `useMemo` içinde ve SSR sırasında
// SUNUCUDA koşuyor; oradan erişilebilen tek bir tip hatası revizyon sayfasını
// 500'e düşürüyor (KATALOG-13'ün anlattığı `hook_nr` olayı). Bu yüzden her dal
// `null` + GEREKÇE döner; bilinmeyen bir sayı asla `0` sayılmaz (md. 4).
//
// DÖKÜM SAKLANMAZ, her açılışta yeniden türetilir (HESAP-35). Saklansaydı
// mühendis bir motoru değiştirdikten sonra pencere eski ağırlığı göstermeye
// devam eder ve DOĞRULAMA ARACI YANLIŞ DOĞRULARDI. Snapshot'a giden tek şey
// insanın kararıdır: ezme, not.

import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { DRUM_STEEL_DENSITY_G_CM3 } from "@/lib/calc/derive";
import { loadCellByModel } from "@/lib/calc/load-cell";
import { plateSheaveByDia } from "@/lib/calc/plate-sheave";
import { bearingHousingByModel } from "@/lib/calc/bearing-housing";
import { klimaAgirligiKg, klimaKapasiteAraligi } from "./klima-agirlik";
import type { EqRow } from "@/lib/equipment-list";
import { hiddenEquipmentSlugs, rowSlug } from "@/lib/equipment-list";
import { moduleResult, moduleState } from "@/lib/calc/presentation/module-access";
import {
  MODULE_ORDER,
  isHoistKey,
  isTravelKey,
  type ModuleKey,
} from "@/lib/calc/presentation/module-family";
import { girderArrangement, girdersInBridge, type TechnicalSpecs } from "@/lib/calc/types";
import { travelFestoonDistanceM } from "@/lib/calc/modules/travelGroup";
import type { CabinInputs } from "@/lib/calc/modules/cabin";
import { gantryLegCount } from "@/lib/crane-types";
import {
  arabaPlatformuTahmini,
  ayakMerdiveniTahmini,
  ayakTahmini,
  baskirisBoyuTahmini,
  baskirisTahmini,
  festonTahmini,
  kabinTahmini,
  kopruElektrikTahmini,
  koseYukuTahmini,
  odaTahmini,
  panoTahmini,
  platformTahmini,
  portalTakviyeTahmini,
  sasiTahmini,
  ustMakaraTahmini,
  ustUcBaglantiTahmini,
  type TahminSonucu,
} from "./ledger";
import { bandinGruplari, kalemBandi, kalemGrubu } from "./defter";
import {
  AGIRLIK_SERBEST_ON_EKI,
  AGIRLIK_SERBEST_SINIRI,
  type AgirlikBandi,
  type AgirlikDokumu,
  type AgirlikDokumuDurumu,
  type AgirlikGrubu,
  type AgirlikKalemi,
  type AgirlikKaynagi,
  type AgirlikSpecAnahtari,
} from "./types";

export interface AgirlikDokumuGirdisi {
  input: CalcInput;
  result: CalcResult;
  /**
   * `buildEquipmentGroups` çıktısının DÜZ hâli ve **gizleme UYGULANMAMIŞ**
   * olarak: gizli bölümün satırlarını dökümün kendisi işaretler, çünkü
   * "gizli bölümleri de say" anahtarı onları geri getirebilmelidir.
   */
  satirlar: readonly EqRow[];
  gizliBolumler?: readonly string[];
  durum?: AgirlikDokumuDurumu;
  /**
   * PROJE KÜNYESİNDEKİ VİNÇ TİPİ (`projects.crane_type`) — yalnız portal
   * ayaklarının var olup olmadığını söyler.
   *
   * HESAP-8b ÇİĞNENMEZ: o kural tipin HESAP MOTORUNA girmesini yasaklar
   * (`runCalc`, `activeModules`, `loadRevision`). Döküm bir hesap değil bir
   * DOĞRULAMADIR (HESAP-35) ve motor bu dosyayı hiç görmez; künyeden çıkan
   * sayı da teknik özelliğe ancak mühendisin AÇIK eylemiyle taşınır — ayak
   * grubu ise o düğmenin toplamına zaten girmez (`bantToplaminaGirmez`).
   */
  craneType?: string;
}

/** Bant etiketleri — bandın adı modülün rapor başlığı değil, PARÇANIN adıdır. */
const BANT_ETIKETLERI: Readonly<Record<string, string>> = {
  bridge: "KÖPRÜ",
  trolley: "ANA ARABA",
  auxTrolley: "YARDIMCI ARABA",
  mono1Trolley: "MONORAY 1 ARABASI",
  mono2Trolley: "MONORAY 2 ARABASI",
};

/**
 * TEKNİK ÖZELLİK KUTUSUNA GİRMEYEN GRUPLAR.
 *
 * Ayaklar KÖPRÜ bandındadır (kullanıcı isteği, 02.09.2026, md. 8) ama
 * `bridgeWeightT`e YAZILMAZ: o kutuyu ana kiriş (ölü yük payı) ve teker
 * yükleri okur, ayak ise kirişi TAŞIR, kirişe BİNMEZ. Ayrıntılı gerekçe
 * `AgirlikGrubu.bantToplaminaGirmez` yorumundadır.
 */
const KUTUYA_GIRMEYEN_GRUPLAR: ReadonlySet<string> = new Set(["legs"]);

/**
 * Besleme yönteminin okunur adı — `fields.ts`teki etiket haritasının değil,
 * DÖKÜMÜN kendi kısa karşılığı: çekirdek saftır ve sunum katmanını okumaz.
 */
const BESLEME_ADLARI: Readonly<Record<string, string>> = {
  cableChain: "kablo zinciri",
  conductorBar: "bara",
  cableReel: "kablo sarma tamburu",
};

const BANT_SPEC_ANAHTARLARI: Readonly<Record<string, AgirlikSpecAnahtari>> = {
  bridge: "bridgeWeightT",
  trolley: "mainTrolleyWeightT",
  auxTrolley: "auxTrolleyWeightT",
  mono1Trolley: "mono1TrolleyWeightT",
  mono2Trolley: "mono2TrolleyWeightT",
};

/**
 * Kilosu HESAPTAN gelen satırlar. Geri kalanı katalogtan gelir.
 *
 * Tambur hacminden (`deriveDrumWeightKg`), halat metre ağırlığı × boydan,
 * halat soketi Van Beest defterinden çıkar — üçü de bir ürün seçiminin değil
 * bir hesabın sonucudur ve rozet bunu söylemelidir.
 */
const HESAPTAN_GELEN_SLUGLAR = new Set(["drum", "rope", "ropeLeft", "balanceSocket"]);

/** Klima ağırlığı ancak SERİ tanınıp ısı yükü hesaplanınca türetilebilir. */
const KLIMA_GEREKCESI =
  "Klima ağırlığı için hem katalogdan bir SERİ seçilmeli hem de mahallin ısı " +
  "yükü hesaplanmış olmalı (11.x bölümü); ikisi de varsa ağırlık kendiliğinden gelir.";

/** Katalogda ağırlığı HİÇ yayımlanmayan satırlar — uydurulmaz (md. 4). */
const AGIRLIKSIZ_SLUG_GEREKCESI: Readonly<Record<string, string>> = {
  drumBearingHousing:
    "Seçilen gövde SKF SNL/SE defterinde yok (başka bir seri); ağırlık elle girilebilir.",
  balanceSheave:
    "Girilen çap yayımlanmış kaynaklı sac makara boyları arasında değil; " +
    "ağırlık elle girilebilir.",
  balanceLoadcell:
    "Bu markanın yük hücresi föyünde ağırlık yayımlanmamış (Esit PLC satırlarında var).",
  festoon: "Feston kataloğunda (Conductix · Vasel) ağırlık yayımlanmamış.",
  cabinAc: KLIMA_GEREKCESI,
  roomAc: KLIMA_GEREKCESI,
  panelAc: KLIMA_GEREKCESI,
  "operator-cabin": "Kabin çelik ağırlığı henüz hesaplanmıyor; elle girilebilir.",
  "electrical-room": "Oda çelik ağırlığı henüz hesaplanmıyor; elle girilebilir.",
  "electrical-panel": "Pano ağırlığı henüz hesaplanmıyor; elle girilebilir.",
};

/**
 * İMALAT PARÇALARININ AĞIRLIĞI — katalogdan değil KENDİ HESABINDAN.
 *
 * Kullanıcı isteği (02.09.2026, md. 4): *"Ağırlık tahmin bölümünde çok fazla
 * ekipmanın ağırlığı yok."* Kanca bloğu mili ve kaldırma kirişi bir ÜRÜN değil
 * bir imalattır; hiçbir katalogda yoktur ve "elle girilir" cevabı, ölçüsü zaten
 * hesaplanmış bir parça için gereksizdi. İkisinin de geometrisi bölümün kendi
 * hücrelerinde duruyor.
 *
 * `null` dönmek kural dışı değil KURALDIR: ölçü yoksa uydurulmaz (md. 4).
 */
interface EkAgirlik {
  birimKg: number;
  birimKgUst?: number;
  formul: string;
  gerekce: string;
  kaynak: AgirlikKaynagi;
}

function imalatAgirligi(
  moduleKey: ModuleKey,
  slug: string,
  input: CalcInput,
  result: CalcResult
): EkAgirlik | null {
  // ——— katalogda VAR ama satıra AKMIYOR olanlar
  if (slug === "drumBearingHousing") {
    // SKF SNL/SE gövdesinin kütlesi katalogda YAYIMLIDIR; çıkarım sırasında
    // sütun okunmamıştı. Model kodu revizyonda duruyor, defter onu çözer —
    // böylece ESKİ revizyonlar da ürünü yeniden seçmeden doğru kiloyu alır.
    const sel = moduleState(input, moduleKey)?.selections as
      | { bearingHousingCode?: string }
      | undefined;
    const spec = bearingHousingByModel(sel?.bearingHousingCode);
    if (!spec) return null;
    return {
      birimKg: spec.kg,
      ...(spec.kgUst !== undefined ? { birimKgUst: spec.kgUst } : {}),
      formul: `${spec.model} — SKF gövde kütlesi (taban + kapak)`,
      gerekce:
        spec.kgUst !== undefined
          ? "Katalog aynı gövdeyi iki mil çapı bloğunda farklı kütleyle basmış; " +
            "aralık olarak verilir. Rulman, keçe ve son kapak dâhil değildir."
          : "SKF kataloğundaki gövde kütlesi (taban + kapak). Rulman, keçe, son " +
            "kapak ve konumlandırma halkası dâhil DEĞİLDİR.",
      kaynak: "katalog",
    };
  }
  if (slug === "cabinAc" || slug === "roomAc" || slug === "panelAc") {
    // KLİMA KATALOĞU SERİ DÜZEYİNDEDİR (mühendis "VKS-VP" seçer, "VKS-VP 850"
    // değil); üretici ise ağırlığı ALT MODEL başına yayımlar. Ağırlık bu yüzden
    // HESAPLANAN ISI YÜKÜNDEN türetilir — hangi alt modelin ısmarlanacağını
    // belirleyen sayı odur — ve rozet KATALOG değil TAHMİN yazar.
    const sel = moduleState(input, moduleKey)?.selections as
      | Record<string, unknown>
      | undefined;
    const seri = typeof sel?.[`${slug}Model`] === "string" ? (sel[`${slug}Model`] as string) : "";
    const toplamKw = pozitifVeya(hucre(result, moduleKey, `${slug}.total`));
    // Pano yerleşiminde yük panolara BÖLÜNÜR; kabin ve odada tek mahaldir.
    const bolen =
      slug === "panelAc" ? Math.max(1, pozitifVeya(hucre(result, moduleKey, "panel.count")) ?? 1) : 1;
    const birimKw = toplamKw === null ? null : toplamKw / bolen;
    const kg = klimaAgirligiKg(seri, birimKw);
    if (kg === null) return null;
    const bant = klimaKapasiteAraligi(seri);
    const bandinDisinda =
      bant !== null && birimKw !== null && (birimKw < bant.min || birimKw > bant.max);
    return {
      birimKg: kg,
      formul: `${seri} · ${birimKw!.toFixed(2)} kW soğutma yükü`,
      gerekce:
        `Katalog SERİ düzeyindedir; ağırlık, hesaplanan ısı yükünün karşılık ` +
        `geldiği alt modelden türetildi (üretici NET ağırlıkları, erişim 02.09.2026).` +
        (bandinDisinda
          ? " YÜK SERİNİN YAYIMLANMIŞ BANDININ DIŞINDA — uç modelin ağırlığı kullanıldı."
          : ""),
      kaynak: "tahmin",
    };
  }
  if (slug === "balanceLoadcell") {
    // Yük hücresi OTOMATİK seçilir (`balance.loadcellModelShort`) ve modelin
    // ağırlığı Esit'in ölçü resimlerinde basılıdır; satıra hiç bağlanmamıştı.
    const model = metinHucresi(result, moduleKey, "balance.loadcellModelShort");
    const spec = loadCellByModel(model);
    const kg = pozitifVeya(spec?.weightKg);
    if (kg === null) return null;
    return {
      birimKg: kg,
      formul: `${spec!.brand} ${spec!.model} katalog ağırlığı`,
      gerekce: "Üreticinin ölçü resminde yayımlanan kütle.",
      kaynak: "katalog",
    };
  }
  if (slug === "balanceSheave") {
    // Denge makarası KATALOGDAN SEÇİLMEZ, bölüm yalnız ÇAP sorar; ağırlık aynı
    // yayımlanmış boy tablosundan okunur (`plate-sheave.ts`).
    const sel = moduleState(input, moduleKey)?.selections as
      | { balanceSheaveDiaMm?: number }
      | undefined;
    const spec = plateSheaveByDia(sel?.balanceSheaveDiaMm);
    if (!spec) return null;
    return {
      birimKg: spec.weightKg,
      ...(spec.weightMaxKg !== undefined ? { birimKgUst: spec.weightMaxKg } : {}),
      formul: `Ø${spec.nominalDiaMm} mm kaynaklı sac makara`,
      gerekce:
        spec.weightMaxKg !== undefined
          ? "Bu çapta iki yataklama düzeni yayımlanmış; ağırlık aralık olarak verilir."
          : "Kaynaklı sac makara boy tablosundan.",
      kaynak: "katalog",
    };
  }
  // ——— hiçbir katalogda olmayan imalat parçaları
  if (slug === "shaft") {
    // MİL SİLİNDİR KABUL EDİLİR. Kademeler, gres kanalları ve emniyet
    // delikleri sayılmaz; çıkan sayı bu yüzden bir ÜST SINIRdır ve gerekçe
    // bunu söyler — sessizce yüksek bir kilo, boş bir hücreden kötüdür.
    const inp = moduleState(input, moduleKey)?.inputs as { shaftD1Mm?: number } | undefined;
    const d = pozitifVeya(inp?.shaftD1Mm);
    const L = pozitifVeya(hucre(result, moduleKey, "shaft.length"));
    if (d === null || L === null) return null;
    const kg = ((Math.PI / 4) * (d / 10) ** 2 * (L / 10) * DRUM_STEEL_DENSITY_G_CM3) / 1000;
    return {
      birimKg: kg,
      formul: `π/4 · Ø${d}² · ${Math.round(L)} mm · 7,85 g/cm³`,
      gerekce:
        "Mil düz silindir kabul edildi (kademeler ve delikler düşülmedi); " +
        "gerçek ağırlık bir miktar DAHA AZDIR.",
      kaynak: "hesap",
    };
  }
  if (slug === "liftingBeam") {
    // KESİT İKİ BÖLGELİDİR (açıklık ortası ince, mesnet yakını kalın) ve hangi
    // bölgenin ne kadar sürdüğü hesapta SORULMUYOR. Tek bir sayı uydurmak
    // yerine ARALIK verilir: alt uç baştan sona ince kesit, üst uç baştan sona
    // kalın kesit. Gerçek kiriş ikisinin arasındadır.
    const span = pozitifVeya(hucre(result, moduleKey, "girder.span"));
    const ince = pozitifVeya(hucre(result, moduleKey, "girder.midUnitWeight"));
    const kalin = pozitifVeya(hucre(result, moduleKey, "girder.thickUnitWeight"));
    if (span === null || ince === null) return null;
    const boyM = span / 1000;
    return {
      birimKg: ince * boyM,
      ...(kalin !== null && kalin > ince ? { birimKgUst: kalin * boyM } : {}),
      formul: `${boyM.toFixed(2)} m × ${ince.toFixed(1)}–${(kalin ?? ince).toFixed(1)} kg/m`,
      gerekce:
        "Kesidin iki bölgesi farklı kalınlıktadır ve hangisinin ne kadar sürdüğü " +
        "bölümde sorulmuyor. ALT UÇ baştan sona ince kesit, ÜST UÇ baştan sona " +
        "kalın kesittir; alın sacları, kulaklar ve kaynak dâhil değildir.",
      kaynak: "hesap",
    };
  }
  return null;
}

/** Ürün seçilmiş sayılır mı — katalog satırları boş alanı "-" ile yazar. */
function urunSecili(row: EqRow): boolean {
  const bos = (v: string | undefined) => !v || v.trim() === "" || v.trim() === "-";
  return !bos(row.model) || !bos(row.brand);
}

/**
 * AĞIRLIK NEDEN YOK — üç ayrı cevap, üçü de doğru.
 *
 * Eski tek cümle ("ürünü yeniden seçin") ÜRÜN SEÇİLİYKEN de basılıyordu ve
 * mühendisi olmayan bir işe gönderiyordu: POLAT PCS, SEW R/X ve YILMAZ Planet
 * redüktörlerinin motorsuz ağırlığı katalog sayfasında hiç YAYIMLANMAMIŞTIR,
 * ürünü yeniden seçmek hiçbir şeyi değiştirmez (ölçüm: seed edilen redüktör
 * satırlarının yalnız %38'inde ağırlık var). Ayrım kaynakta yapılır:
 * slug bilinçli boşsa kendi cümlesi, ürün seçiliyse "föyden elle girin",
 * seçili değilse "önce ürünü seçin".
 */
function agirliksizGerekce(slug: string, row: EqRow): string {
  const kendi = AGIRLIKSIZ_SLUG_GEREKCESI[slug];
  if (kendi) return kendi;
  if (!urunSecili(row)) return "Ürün henüz seçilmedi; seçildiğinde katalog ağırlığı gelir.";
  const ad = [row.brand, row.model].filter((v) => v && v.trim() !== "-").join(" ").trim();
  return (
    `${ad ? `«${ad}» için ` : ""}katalogda ağırlık kayıtlı değil — üretici föyünden ` +
    `elle girilebilir. (Bazı redüktör ve kaplin serilerinde ağırlık sütunu hiç yayımlanmaz.)`
  );
}

/** ORTA SÜTUNA basılan iki-üç kelimelik durum (md. 6). */
function kisaDurumMetni(slug: string, row: EqRow): string {
  if (AGIRLIKSIZ_SLUG_GEREKCESI[slug]) return "katalogda yok";
  return urunSecili(row) ? "katalogda yok" : "ürün seçilmedi";
}

/** Aynı grupta birden çok kaldırma grubu varsa etiketleri ayıran kısa ad. */
const KISA_MODUL_ADI: Readonly<Record<string, string>> = {
  main: "Ana",
  aux: "Yardımcı",
  mono1: "Monoray 1",
  mono2: "Monoray 2",
  hookBlock: "Ana",
  auxHookBlock: "Yardımcı",
  mono1HookBlock: "Monoray 1",
  mono2HookBlock: "Monoray 2",
};

function sayiVeya(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pozitifVeya(v: unknown): number | null {
  const n = sayiVeya(v);
  return n !== null && n > 0 ? n : null;
}

/**
 * 0,1 kg'a yuvarlar.
 *
 * Döküm bir ölçüm defteridir, bir golden hesap değil: ana kirişin kesitinden
 * çıkan 9549,0562… kg'ı düzenlenebilir bir kutuya basmak gürültüdür ve
 * mühendisin göreceği ilk şey budur. Yuvarlama KALEM DÜZEYİNDE yapılır ki
 * gruptaki satırlar ekranda gerçekten toplamı versin — toplamı ayrıca
 * yuvarlamak "satırlar tutmuyor" izlenimi bırakırdı.
 */
function yuvarla(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

/** Hücre haritasından sayı — hesaplanmamış modülde `null`. */
function hucre(result: CalcResult, key: ModuleKey, ad: string): number | null {
  const cells = moduleResult(result, key)?.cells;
  return cells ? sayiVeya(cells[ad]) : null;
}

/** Hücre haritasından METİN — hesaplanmamış modülde `undefined`. */
function metinHucresi(result: CalcResult, key: ModuleKey, ad: string): string | undefined {
  const v = moduleResult(result, key)?.cells?.[ad];
  return typeof v === "string" ? v : undefined;
}

function moduleKeyOf(rowKey: string | undefined): ModuleKey | undefined {
  if (!rowKey) return undefined;
  const ayrac = rowKey.indexOf(":");
  if (ayrac <= 0) return undefined;
  const aday = rowKey.slice(0, ayrac);
  return (MODULE_ORDER as readonly string[]).includes(aday)
    ? (aday as ModuleKey)
    : undefined;
}

/**
 * DÖKÜMÜ KURAR. Girdinin herhangi bir yeri bozuksa o kalem `null` döner;
 * fonksiyonun tamamı hiçbir koşulda fırlatmaz.
 */
export function agirlikDokumu(girdi: AgirlikDokumuGirdisi): AgirlikDokumu {
  const { input, result, satirlar, gizliBolumler, durum, craneType } = girdi;
  const specs = input.specs;
  const ayakSayisi = gantryLegCount(craneType);
  const overrides = durum?.overrides ?? {};
  const gizliSay = durum?.gizliBolumleriSay === true;
  const gizliKume = new Set(gizliBolumler ?? []);
  const notlar: string[] = [];

  // Hangi bantlar var — kaynağı MODÜLÜN VARLIĞIDIR, ikinci bir liste değil.
  const varOlan = new Set<ModuleKey>(
    MODULE_ORDER.filter((k) => moduleState(input, k) !== undefined)
  );
  const bantSirasi: string[] = [];
  const bantKalemleri = new Map<string, AgirlikKalemi[]>();
  const ekle = (bant: string, kalem: AgirlikKalemi) => {
    if (!bantKalemleri.has(bant)) {
      bantKalemleri.set(bant, []);
      bantSirasi.push(bant);
    }
    bantKalemleri.get(bant)!.push(kalem);
  };
  const bandiAc = (bant: string) => {
    if (!bantKalemleri.has(bant)) {
      bantKalemleri.set(bant, []);
      bantSirasi.push(bant);
    }
  };

  // Bant sırası: önce KÖPRÜ, sonra arabalar (ana → yardımcı → monoray).
  if (MODULE_ORDER.some((k) => varOlan.has(k) && kalemBandi(specs, k) === "bridge")) {
    bandiAc("bridge");
  }
  for (const k of MODULE_ORDER) {
    if (isTravelKey(k) && k !== "bridge" && varOlan.has(k)) bandiAc(k);
  }

  // ————————————————————————————————— katalog / hesap kalemleri (ekipman satırı)
  const gizliSlugOnbellek = new Map<ModuleKey, Set<string>>();
  const gizliSluglari = (k: ModuleKey) => {
    let s = gizliSlugOnbellek.get(k);
    if (!s) {
      s = hiddenEquipmentSlugs(k, gizliKume);
      gizliSlugOnbellek.set(k, s);
    }
    return s;
  };
  const gizliDusen = new Map<string, number>();

  for (const row of satirlar) {
    // ALTERNATİF SATIR VİNCİN ÜZERİNDE DEĞİLDİR: bir adaydır, bir parça değil.
    if (row.alt !== undefined) continue;
    // Panelden elle eklenen serbest satırın kararlı anahtarı yoktur.
    if (!row.rowKey || row.custom) continue;
    const moduleKey = moduleKeyOf(row.rowKey);
    if (!moduleKey) continue;
    const slug = rowSlug(row.rowKey, moduleKey);
    if (!slug) continue;
    const bant = kalemBandi(specs, moduleKey);
    const grup = kalemGrubu(moduleKey, slug);
    if (!bant || !grup) continue;

    const gizli = gizliSluglari(moduleKey).has(slug);
    if (gizli && !gizliSay) {
      const anahtar = `${bant}.${grup}`;
      gizliDusen.set(anahtar, (gizliDusen.get(anahtar) ?? 0) + 1);
      continue;
    }

    const adet = pozitifVeya(row.qty);
    // KATALOG SUSUYORSA HESABA SORULUR: mil ve kaldırma kirişi bir ürün değil
    // bir imalattır, ölçüleri zaten bölümün hücrelerindedir (md. 4 turu).
    const imalat =
      pozitifVeya(row.weightKg) === null
        ? imalatAgirligi(moduleKey, slug, input, result)
        : null;
    // SATIR EKRANDA TOPLANABİLMELİ: toplam, YUVARLANMIŞ birimden çarpılır.
    // Ham birimden çarpıp ayrıca yuvarlamak "2 ad × 4.774,5 = 9.549,1" gibi
    // kendi kendini yalanlayan bir satır üretiyordu.
    const birimKg = yuvarla(imalat?.birimKg ?? pozitifVeya(row.weightKg));
    const birimKgUst = yuvarla(imalat?.birimKgUst ?? pozitifVeya(row.weightKgUst));
    const kaynak: AgirlikKaynagi =
      imalat?.kaynak ?? (HESAPTAN_GELEN_SLUGLAR.has(slug) ? "hesap" : "katalog");
    ekle(bant, {
      key: `${bant}.${grup}.${row.rowKey}`,
      label: row.component,
      kaynak,
      adet,
      birimKg,
      ...(birimKgUst !== null ? { birimKgUst } : {}),
      kg: birimKg !== null && adet !== null ? yuvarla(birimKg * adet) : null,
      ...(birimKgUst !== null && adet !== null
        ? { kgUst: yuvarla(birimKgUst * adet) as number }
        : {}),
      formul:
        imalat?.formul ??
        (birimKg !== null && adet !== null ? "adet × birim ağırlık" : undefined),
      gerekce: imalat?.gerekce ?? (birimKg !== null ? undefined : agirliksizGerekce(slug, row)),
      ...(birimKg === null ? { kisaDurum: kisaDurumMetni(slug, row) } : {}),
      moduleKey,
      rowKey: row.rowKey,
      ...(gizli ? { gizliBolumden: true } : {}),
    });
  }

  // ————————————————————————————————————————— hesap kalemleri (yapı)
  const kirisDuzeni = girderArrangement(specs);
  const takimBasinaKiris = kirisDuzeni === "dort" ? 2 : girdersInBridge(specs);
  for (const kirisKey of ["girder", "girder2"] as const) {
    if (!varOlan.has(kirisKey)) continue;
    const birim = pozitifVeya(hucre(result, kirisKey, "camber.girderTotalWeight"));
    ekle("bridge", {
      key: `bridge.girder.${kirisKey}`,
      label: kirisKey === "girder2" ? "Ana Kiriş - 2" : "Ana Kiriş",
      kaynak: "hesap",
      adet: takimBasinaKiris,
      birimKg: yuvarla(birim),
      kg: birim !== null ? yuvarla((yuvarla(birim) as number) * takimBasinaKiris) : null,
      formul: "kesit sacları + perdeler + ray, açıklık boyunca",
      gerekce:
        birim !== null
          ? undefined
          : "Kiriş ağırlığı için kesit ölçüleri ve perde aralığı gerekir.",
      moduleKey: kirisKey,
    });
  }

  if (varOlan.has("endCarriage")) {
    const kgPerM = pozitifVeya(hucre(result, "endCarriage", "section.weightPerLength"));
    // BAŞKİRİŞ BOYU BÖLÜMDE SORULMUYOR (yalnız teker aralığı ve kiriş oturma
    // noktası var). Motora yeni bir girdi EKLENMEZ — her eski revizyona şablon
    // varsayılanı sessizce girerdi; boy defterde türetilir ve satırın kaynağı
    // en zayıf halkayı yazar: kg/m HESAPTAN gelse de boy bir TAHMİNdir.
    const ec = moduleState(input, "endCarriage")?.inputs as
      | { wheelSpanAMm?: number }
      | undefined;
    const tekerCapi = (moduleState(input, "bridge")?.selections as
      | { wheelDiaMm?: number }
      | undefined)?.wheelDiaMm;
    const boy = baskirisBoyuTahmini(ec?.wheelSpanAMm, tekerCapi);
    const birim = kgPerM !== null && boy.boyM !== null ? kgPerM * boy.boyM : null;
    ekle("bridge", {
      key: "bridge.endCarriage.beam",
      label: "Başkiriş",
      kaynak: birim === null ? "hesap" : "tahmin",
      adet: 2,
      birimKg: yuvarla(birim),
      kg: birim !== null ? yuvarla((yuvarla(birim) as number) * 2) : null,
      formul:
        kgPerM !== null
          ? `${kgPerM.toFixed(1)} kg/m × (${boy.formul})`
          : `kg/m × (${boy.formul})`,
      gerekce:
        birim === null
          ? kgPerM === null
            ? "Başkiriş kesiti hesaplanmadan metre ağırlığı bilinmez."
            : boy.gerekce
          : `Kesit HESAPTAN, boy TAHMİN: ${boy.gerekce}`,
      moduleKey: "endCarriage",
    });
  }

  // ——————————————————————————————————————————— tahmin defteri kalemleri
  tahminKalemleriniEkle({
    input,
    specs,
    varOlan,
    bantSirasi,
    bantKalemleri,
    ekle,
    ayakSayisi,
    ayakYuksekligiM: durum?.ayakYuksekligiM,
  });

  // ————————————————————————————————— pencereden elle açılan serbest satırlar
  // EN SONA eklenir: kendi grubunun altında, otomatik kalemlerin ardında durur
  // ve sıralaması mühendisin ekleme sırasıdır. Bandı OLMAYAN bir serbest satır
  // bandı DİRİLTMEZ (`ekle` yeni bant açardı) — vinçte olmayan bir bandın
  // altında satır göstermek, kayıtta kalmış eski bir kararı gerçekmiş gibi
  // okuturdu; satır düşer ve notlarda sayılır.
  const serbestler = (durum?.serbest ?? []).slice(0, AGIRLIK_SERBEST_SINIRI);
  let dusenSerbest = 0;
  for (const s of serbestler) {
    // ANAHTAR UZAYI KORUNUR: serbest satır ancak `serbest-` ön ekiyle girer.
    // Ön eksiz bir kimlik, otomatik bir kalemin anahtarını ele geçirip onun
    // ezme ve notunu sessizce devralabilirdi.
    if (!s || typeof s.id !== "string" || !s.id.startsWith(AGIRLIK_SERBEST_ON_EKI)) continue;
    if (!bantKalemleri.has(s.bant)) {
      dusenSerbest += 1;
      continue;
    }
    const grupVar = bandinGruplari(s.bant).some((g) => g.key === s.grup);
    if (!grupVar) {
      dusenSerbest += 1;
      continue;
    }
    const kg = pozitifVeya(s.kg);
    const adet = pozitifVeya(s.adet);
    ekle(s.bant, {
      key: `${s.bant}.${s.grup}.${s.id}`,
      label: s.ad?.trim() || "Adsız kalem",
      kaynak: "elle",
      adet,
      birimKg: kg !== null && adet !== null && adet > 1 ? yuvarla(kg / adet) : yuvarla(kg),
      kg: yuvarla(kg),
      gerekce:
        kg === null
          ? "Elle açılan satır; ağırlığı henüz girilmedi."
          : "Pencereden elle açılan satır — mühendisin o işe özel bilgisi.",
      ...(kg === null ? { kisaDurum: "ağırlık girilmedi" } : {}),
      serbestId: s.id,
    });
  }
  if (dusenSerbest > 0) {
    notlar.push(
      `${dusenSerbest} elle açılmış satır, bağlı olduğu bölüm bu revizyonda ` +
        `bulunmadığı için listede yok.`
    );
  }

  // ————————————————————————————————————————— gruplama ve toplamlar
  const bantlar: AgirlikBandi[] = [];
  for (const bantKey of bantSirasi) {
    const kalemler = bantKalemleri.get(bantKey) ?? [];
    const gruplar: AgirlikGrubu[] = [];
    for (const tanim of bandinGruplari(bantKey)) {
      const grupKalemleri = kalemler.filter((k) =>
        k.key.startsWith(`${bantKey}.${tanim.key}.`)
      );
      const dusen = gizliDusen.get(`${bantKey}.${tanim.key}`) ?? 0;
      if (grupKalemleri.length === 0 && dusen === 0) continue;
      etiketleriAyristir(grupKalemleri);
      const ezmeliKalemler = grupKalemleri.map((k) => ezmeUygula(k, overrides, durum?.notes));
      const grupEzme = pozitifVeya(overrides[`${bantKey}.${tanim.key}`]);
      const bilinen = ezmeliKalemler.filter((k) => k.kg !== null);
      gruplar.push({
        key: `${bantKey}.${tanim.key}`,
        label: tanim.label,
        kalemler: ezmeliKalemler,
        kg:
          grupEzme !== null
            ? grupEzme
            : bilinen.length > 0
              ? yuvarla(bilinen.reduce((t, k) => t + (k.kg as number), 0))
              : null,
        eksikKalemSayisi:
          grupEzme !== null
            ? 0
            : ezmeliKalemler.filter((k) => k.kg === null && !k.kapsandi).length,
        ...(grupEzme !== null ? { ezildi: true } : {}),
        tahminIcerir: ezmeliKalemler.some((k) => k.kaynak === "tahmin"),
        gizliDusenSayisi: dusen,
        ...(KUTUYA_GIRMEYEN_GRUPLAR.has(tanim.key) ? { bantToplaminaGirmez: true } : {}),
      });
    }

    // İKİ AYRI TOPLAM: kutuyla karşılaştırılan (`kg`) ve kutuya girmeyen
    // (`disKg`, bugün yalnız portal ayakları). Tek toplam tutulsaydı ayakların
    // kilosu "Teknik özelliğe yaz" düğmesiyle `bridgeWeightT`e sızardı.
    const iceridekiler = gruplar.filter((g) => !g.bantToplaminaGirmez && g.kg !== null);
    const disaridakiler = gruplar.filter((g) => g.bantToplaminaGirmez && g.kg !== null);
    const bantKg =
      iceridekiler.length > 0
        ? yuvarla(iceridekiler.reduce((t, g) => t + (g.kg as number), 0))
        : null;
    const bantDisKg =
      disaridakiler.length > 0
        ? yuvarla(disaridakiler.reduce((t, g) => t + (g.kg as number), 0))
        : null;
    const specKey = BANT_SPEC_ANAHTARLARI[bantKey];
    const tahminiT = specKey ? sayiVeya(specs[specKey]) : null;
    const tahminiKg = tahminiT !== null && tahminiT > 0 ? tahminiT * 1000 : null;
    bantlar.push({
      key: bantKey,
      label: BANT_ETIKETLERI[bantKey] ?? bantKey,
      ...(specKey ? { specKey } : {}),
      tahminiKg,
      gruplar,
      kg: bantKg,
      disKg: bantDisKg,
      eksikKalemSayisi: gruplar.reduce((t, g) => t + g.eksikKalemSayisi, 0),
      tahminIcerir: gruplar.some((g) => g.tahminIcerir),
      farkOrani:
        tahminiKg !== null && tahminiKg > 0 && bantKg !== null
          ? (bantKg - tahminiKg) / tahminiKg
          : null,
    });
  }

  // VİNCİN TOPLAMI KUTUYA GİRMEYENİ DE SAYAR: portal ayakları vincin
  // parçasıdır; yalnız `bridgeWeightT`e yazılmaz.
  const bantToplamlari = bantlar
    .map((b) => (b.kg === null && b.disKg === null ? null : (b.kg ?? 0) + (b.disKg ?? 0)))
    .filter((v): v is number => v !== null);
  const eksikToplam = bantlar.reduce((t, b) => t + b.eksikKalemSayisi, 0);
  if (eksikToplam > 0) {
    notlar.push(
      `${eksikToplam} kalemin ağırlığı bilinmiyor; toplamlar EN AZ değeridir.`
    );
  }
  // SESSİZ BOŞLUK, ARTIK SESSİZ DEĞİL: hem ekipman satırı hem tahmin kalemi
  // yalnız FESTON dalında doğuyor. Bara ya da kablo sarma tamburu seçilmiş bir
  // köprüde hat ne listede ne toplamda görünüyordu ve eksik sayacına da
  // katkısı yoktu — 30 m açıklıkta bir bara 300–600 kg mertebesindedir.
  // Uydurma bir kg/m yazılmaz (md. 4); mühendis uyarılır ve elle ekleyebilir.
  const beslemeCumlesi = (etiket: string, deger: string | undefined): void => {
    if (!deger || deger === "festoon") return;
    notlar.push(
      `${etiket} beslemesi «${BESLEME_ADLARI[deger] ?? deger}» seçilmiş; bu hattın ` +
        `ağırlığı dökümde YOK (yalnız feston hattı tartılıyor). Gerekiyorsa ilgili ` +
        `gruba elle satır ekleyin.`
    );
  };
  if (bantKalemleri.has("bridge") && varOlan.has("bridge")) {
    beslemeCumlesi("Köprü", specs.bridgePowerSupply);
  }
  const arabaBeslemeleri: readonly [string, string, string | undefined][] = [
    ["trolley", "Ana araba", specs.trolleyPowerSupply],
    ["auxTrolley", "Yardımcı araba", specs.auxTrolleyPowerSupply],
    ["mono1Trolley", "Monoray 1 arabası", specs.mono1TrolleyPowerSupply],
    ["mono2Trolley", "Monoray 2 arabası", specs.mono2TrolleyPowerSupply],
  ];
  for (const [bant, etiket, deger] of arabaBeslemeleri) {
    if (bantKalemleri.has(bant)) beslemeCumlesi(etiket, deger);
  }

  const dusenToplam = [...gizliDusen.values()].reduce((t, n) => t + n, 0);
  if (!gizliSay && dusenToplam > 0) {
    notlar.push(
      `${dusenToplam} satır gizlenmiş alt bölüm nedeniyle listede yok — ` +
        `"Gizli bölümleri de say" ile geri getirilebilir.`
    );
  }

  return {
    bantlar,
    kg:
      bantToplamlari.length > 0
        ? yuvarla(bantToplamlari.reduce((t, v) => t + v, 0))
        : null,
    eksikKalemSayisi: eksikToplam,
    tahminIcerir: bantlar.some((b) => b.tahminIcerir),
    notlar,
  };
}

/**
 * Aynı grupta birden çok kaldırma grubu varsa etiketler ayrışır.
 *
 * Yardımcı kaldırma PAYLAŞIMLI düzende ana arabanın üzerindedir; o zaman tek
 * "Tahrik Grubu" başlığı altında iki motor, iki redüktör ve iki fren durur ve
 * hangisinin hangi kaldırmaya ait olduğu ekrandan okunamaz.
 */
function etiketleriAyristir(kalemler: AgirlikKalemi[]): void {
  const moduller = new Set(kalemler.map((k) => k.moduleKey).filter(Boolean));
  if (moduller.size < 2) return;
  for (const kalem of kalemler) {
    const kisa = kalem.moduleKey ? KISA_MODUL_ADI[kalem.moduleKey] : undefined;
    if (kisa) kalem.label = `${kisa} · ${kalem.label}`;
  }
}

/**
 * ELLE EZME — otomatik değeri KORUYARAK üstüne yazar.
 *
 * Ezilen satır SOLGUN DEĞİL İŞARETLİDİR (`ezildi`) ve özgün kaynağı
 * `kaynakOnce`da durur; geri alma otomatik değere döner. ADET EZİLMEZ:
 * kaynağı ekipman listesidir (HESAP-21) ve ikinci bir adet açmak o kuralın
 * kapattığı kapıyı yeniden açardı.
 */
function ezmeUygula(
  kalem: AgirlikKalemi,
  overrides: Record<string, number>,
  notes: Record<string, string> | undefined
): AgirlikKalemi {
  const not = notes?.[kalem.key];
  const ezme = pozitifVeya(overrides[kalem.key]);
  if (ezme === null) {
    return not ? { ...kalem, gerekce: not } : kalem;
  }
  return {
    ...kalem,
    kaynak: "elle",
    kaynakOnce: kalem.kaynak,
    otomatikKg: kalem.kg,
    kg: ezme,
    kgUst: undefined,
    ezildi: true,
    ...(not ? { gerekce: not } : { gerekce: undefined }),
  };
}

/**
 * TAHMİN KALEMLERİ — hesaptan ve katalogtan gelmeyen parçalar.
 *
 * İki biçimde girer:
 *   · KAPSAYAN kalem — grupta zaten bir katalog satırı vardır ama kilosu
 *     yayımlanmamıştır (feston hattı, kabin, oda, panolar). Tahmin o satırı
 *     KAPSAR ve satır `kapsandi` ile eksik sayılmaz; iki kez toplanmaz.
 *   · YENİ kalem — grupta hiç satır yoktur (platform, köprü elektriği, şasi,
 *     üst makara, araba platformu). Bu parçaların katalog karşılığı da yoktur.
 *
 * SIRA ÖNEMLİDİR: araba platformu şasiden, üst makara kanca bloğundan türer.
 */
function tahminKalemleriniEkle(ctx: {
  input: CalcInput;
  specs: TechnicalSpecs;
  varOlan: ReadonlySet<ModuleKey>;
  bantSirasi: readonly string[];
  bantKalemleri: Map<string, AgirlikKalemi[]>;
  ekle: (bant: string, kalem: AgirlikKalemi) => void;
  /** Künyeden gelen portal ayak adedi; `0` = portal değil. */
  ayakSayisi: number;
  /** Pencereden elle girilen portal ayak yüksekliği [m]. */
  ayakYuksekligiM?: number;
}): void {
  const { input, specs, varOlan, bantSirasi, bantKalemleri, ekle, ayakSayisi } = ctx;

  /** Grupta bilinen kilolar toplamı — sıralı bağımlı tahminler bunu okur. */
  const grupToplami = (bant: string, grup: string): number | null => {
    const kalemler = (bantKalemleri.get(bant) ?? []).filter((k) =>
      k.key.startsWith(`${bant}.${grup}.`)
    );
    const bilinen = kalemler.filter((k) => k.kg !== null);
    return bilinen.length > 0 ? bilinen.reduce((t, k) => t + (k.kg as number), 0) : null;
  };

  /** Aynı gruptaki bir katalog satırını "kapsandı" olarak işaretler. */
  const kapsa = (bant: string, grup: string, slug: string): void => {
    for (const kalem of bantKalemleri.get(bant) ?? []) {
      if (kalem.key === `${bant}.${grup}.${slug}` || kalem.rowKey === slug) {
        kalem.kapsandi = true;
        kalem.gerekce = `${kalem.gerekce ?? ""} Hat tahmini bu satırı kapsıyor.`.trim();
      }
    }
  };

  const tahminKalemi = (
    bant: string,
    grup: string,
    ad: string,
    sonuc: TahminSonucu,
    adet: number | null = 1,
    /**
     * ANAHTARIN SON PARÇASI. Varsayılan `tahmin`, çünkü çoğu grupta tek bir
     * tahmin kalemi vardır ve o anahtar revizyonda saklanan ezmelere bağlıdır
     * — DEĞİŞTİRİLEMEZ. Bir grupta birden çok tahmin varsa (portal ayakları)
     * her satır kendi son parçasını verir.
     */
    sonParca = "tahmin"
  ): void => {
    ekle(bant, {
      key: `${bant}.${grup}.${sonParca}`,
      label: ad,
      kaynak: "tahmin",
      adet,
      birimKg: adet !== null && adet > 1 && sonuc.kg !== null ? yuvarla(sonuc.kg / adet) : sonuc.kg,
      kg: yuvarla(sonuc.kg),
      formul: sonuc.formul,
      gerekce: sonuc.gerekce,
      ...(sonuc.kg === null ? { kisaDurum: "türetilemedi" } : {}),
    });
  };

  // ————————————————————————————————————————————————————— KÖPRÜ
  if (bantKalemleri.has("bridge")) {
    // Platform ve köprü elektriği köprünün TAŞIYICI YAPISINA aittir; köprü
    // yürütmesi kapatılmış (yalnız araba yenilenen) bir raporda da köprü bandı
    // varsa yapı vardır.
    tahminKalemi("bridge", "platform", "Platform ve Korkuluk", platformTahmini(specs));
    tahminKalemi("bridge", "electric", "Köprü Elektrik Tesisatı", kopruElektrikTahmini(specs));

    if (varOlan.has("bridge")) {
      const bridgeInputs = moduleState(input, "bridge")?.inputs as
        | { festoonCablePackageWeightKg?: number }
        | undefined;
      if (specs.bridgePowerSupply === "festoon") {
        tahminKalemi(
          "bridge",
          "festoon",
          "Feston Hattı (ray + taşıyıcılar + kablo)",
          festonTahmini(
            travelFestoonDistanceM(specs, "bridge"),
            bridgeInputs?.festoonCablePackageWeightKg
          )
        );
        kapsa("bridge", "festoon", "bridge:festoon");
      }
    }

    const cabin = moduleState(input, "cabin")?.inputs as CabinInputs | undefined;
    if (bantKalemleri.get("bridge")?.some((k) => k.key.startsWith("bridge.cabin."))) {
      tahminKalemi("bridge", "cabin", "Kabin Çeliği", kabinTahmini(cabin));
      kapsa("bridge", "cabin", "cabin:operator-cabin");
    }
    const odaVar = bantKalemleri
      .get("bridge")
      ?.some((k) => k.key.startsWith("bridge.electricalRoom."));
    if (odaVar) {
      const odaSatiriVar = bantKalemleri
        .get("bridge")
        ?.some((k) => k.rowKey === "cabin:electrical-room");
      if (odaSatiriVar) {
        tahminKalemi("bridge", "electricalRoom", "Oda Çeliği", odaTahmini(cabin));
        kapsa("bridge", "electricalRoom", "cabin:electrical-room");
      }
      const panoSatiri = bantKalemleri
        .get("bridge")
        ?.find((k) => k.rowKey === "cabin:electrical-panel");
      if (panoSatiri) {
        const adet = panoSatiri.adet;
        ekle("bridge", {
          key: "bridge.electricalRoom.panoTahmin",
          label: "Panolar",
          kaynak: "tahmin",
          adet,
          birimKg: yuvarla(panoTahmini(1).kg),
          kg: yuvarla(panoTahmini(adet).kg),
          formul: panoTahmini(adet).formul,
          gerekce: panoTahmini(adet).gerekce,
        });
        kapsa("bridge", "electricalRoom", "cabin:electrical-panel");
      }
    }
  }

  // ————————————————————————————————————————————————————— ARABALAR
  for (const bant of bantSirasi) {
    if (bant === "bridge") continue;
    const sasi = sasiTahmini(specs);
    tahminKalemi(bant, "frame", "Araba Şasisi", sasi);
    tahminKalemi(bant, "platform", "Araba Platformu", arabaPlatformuTahmini(sasi.kg));

    const kancaBloguKg = grupToplami(bant, "hookBlock");
    const ustMakara = ustMakaraTahmini(specs, kancaBloguKg);
    // ÜST MAKARA EŞİĞİN ALTINDA HİÇ ÇIKMAZ: "0 kg'lık bir üst makara bloğu"
    // diye bir parça yok; olmayan bir satır, sıfır yazan bir satırdan iyidir.
    if (ustMakara) tahminKalemi(bant, "topSheave", "Üst Makara Bloğu", ustMakara);

    const travelInputs = moduleState(input, bant as ModuleKey)?.inputs as
      | { festoonCablePackageWeightKg?: number }
      | undefined;
    const beslemeler: Record<string, string | undefined> = {
      trolley: specs.trolleyPowerSupply,
      auxTrolley: specs.auxTrolleyPowerSupply,
      mono1Trolley: specs.mono1TrolleyPowerSupply,
      mono2Trolley: specs.mono2TrolleyPowerSupply,
    };
    if (beslemeler[bant] === "festoon") {
      tahminKalemi(
        bant,
        "festoon",
        "Feston Hattı (ray + taşıyıcılar + kablo)",
        festonTahmini(
          travelFestoonDistanceM(specs, bant as "trolley"),
          travelInputs?.festoonCablePackageWeightKg
        )
      );
      kapsa(bant, "festoon", `${bant}:festoon`);
    }
  }

  // ————————————————————————————————— köşe yükünden türeyenler (EN SONDA)
  //
  // SIRA ZORUNLU: başkiriş de portal ayağı da KÖŞE YÜKÜNE bağlıdır ve köşe
  // yükü köprünün TAŞINAN yapısını (kirişler + platform + elektrik + kabin +
  // oda) ve arabaları toplar. İkisi de bu bloktan önce eklenmiş olmalıdır.
  if (!bantKalemleri.has("bridge")) return;

  /** Bir bandın bilinen kilolarının toplamı; verilen gruplar HARİÇ. */
  const bantToplami = (bant: string, haric: ReadonlySet<string>): number | null => {
    const kalemler = (bantKalemleri.get(bant) ?? []).filter((k) => {
      const parcalar = k.key.split(".");
      return parcalar.length > 2 && !haric.has(parcalar[1]);
    });
    const bilinen = kalemler.filter((k) => k.kg !== null && !k.kapsandi);
    return bilinen.length > 0 ? bilinen.reduce((t, k) => t + (k.kg as number), 0) : null;
  };

  // Kendi kilolarını köşe yükünden alan gruplar girdiye KATILMAZ (döngü olurdu).
  const kendindenTureyen = new Set(["endCarriage", "legs"]);
  const yapiKg = bantToplami("bridge", kendindenTureyen);
  const arabalarKg = bantSirasi
    .filter((b) => b !== "bridge")
    .reduce<number | null>((t, b) => {
      const v = bantToplami(b, new Set());
      return v === null ? t : (t ?? 0) + v;
    }, null);
  const kose = koseYukuTahmini(specs, yapiKg, arabalarKg);

  // ————————————————————————————————————————————————————— BAŞKİRİŞ
  // Bölüm AÇIKSA kalem zaten kesitten geldi; kapalıysa köşe yükünden tahmin
  // edilir. Kullanıcı isteği (02.09.2026, md. 9): başkiriş köprü grubunda ana
  // kirişin altında HER ZAMAN görünsün — yeni işler «09 · Başkiriş» bölümü
  // KAPALI açılır ve grup bugüne dek hiç çizilmiyordu.
  //
  // ANAHTAR AYNI KALIR (`bridge.endCarriage.beam`): farklı bir anahtar
  // kullanılsaydı, bölümü sonradan açan mühendisin elle girdiği kilo ve notu
  // sessizce kopardı.
  const baskirisVar = (bantKalemleri.get("bridge") ?? []).some((k) =>
    k.key.startsWith("bridge.endCarriage.")
  );
  if (!baskirisVar) {
    tahminKalemi(
      "bridge",
      "endCarriage",
      "Başkiriş",
      baskirisTahmini(kose.koseYukuT, 2),
      2,
      "beam"
    );
  }

  // ————————————————————————————————————————————————————— PORTAL AYAKLARI
  if (ayakSayisi > 0) {
    const H = ctx.ayakYuksekligiM;
    const ayaklar = ayakTahmini(kose.koseYukuT, H, ayakSayisi);
    tahminKalemi("bridge", "legs", "Ayaklar", ayaklar, ayakSayisi, "ayak");
    tahminKalemi(
      "bridge",
      "legs",
      "Üst Uç Bağlantı",
      ustUcBaglantiTahmini(kose.koseYukuT),
      ayakSayisi,
      "ustUc"
    );
    tahminKalemi(
      "bridge",
      "legs",
      "Portal Takviyeleri",
      portalTakviyeTahmini(grupToplami("bridge", "girder"), ayaklar.kg),
      1,
      "takviye"
    );
    tahminKalemi(
      "bridge",
      "legs",
      "Ayak Merdiveni ve Sahanlıkları",
      ayakMerdiveniTahmini(H, ayakSayisi),
      1,
      "merdiven"
    );
  }
}

/** Yalnız kaldırma modüllerini süzer — dışa açık küçük yardımcı (test okur). */
export function kaldirmaModulleri(input: CalcInput): ModuleKey[] {
  return MODULE_ORDER.filter((k) => isHoistKey(k) && moduleState(input, k) !== undefined);
}
