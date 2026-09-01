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
import {
  arabaPlatformuTahmini,
  baskirisBoyuTahmini,
  festonTahmini,
  kabinTahmini,
  kopruElektrikTahmini,
  odaTahmini,
  panoTahmini,
  platformTahmini,
  sasiTahmini,
  ustMakaraTahmini,
  type TahminSonucu,
} from "./ledger";
import { bandinGruplari, kalemBandi, kalemGrubu } from "./defter";
import {
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
}

/** Bant etiketleri — bandın adı modülün rapor başlığı değil, PARÇANIN adıdır. */
const BANT_ETIKETLERI: Readonly<Record<string, string>> = {
  bridge: "KÖPRÜ",
  trolley: "ANA ARABA",
  auxTrolley: "YARDIMCI ARABA",
  mono1Trolley: "MONORAY 1 ARABASI",
  mono2Trolley: "MONORAY 2 ARABASI",
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

/** Katalogda ağırlığı HİÇ yayımlanmayan satırlar — uydurulmaz (md. 4). */
const AGIRLIKSIZ_SLUG_GEREKCESI: Readonly<Record<string, string>> = {
  drumBearingHousing: "SKF SNL/SE yatak kataloğunda ağırlık yayımlanmamış.",
  festoon: "Feston kataloğunda (Conductix · Vasel) ağırlık yayımlanmamış.",
  cabinAc: "Klima kataloğunda (TMS) ağırlık yayımlanmamış.",
  roomAc: "Klima kataloğunda (TMS) ağırlık yayımlanmamış.",
  panelAc: "Klima kataloğunda (TMS) ağırlık yayımlanmamış.",
  balanceSheave: "Denge makarası imalattır; ağırlığı elle girilir.",
  balanceLoadcell: "Yük hücresi kataloğunda ağırlık yayımlanmamış.",
  shaft: "Kanca bloğu mili imalattır; ağırlığı elle girilir.",
  liftingBeam: "Kaldırma kirişi imalattır; ağırlığı elle girilir.",
  "operator-cabin": "Kabin çelik ağırlığı henüz hesaplanmıyor; elle girilebilir.",
  "electrical-room": "Oda çelik ağırlığı henüz hesaplanmıyor; elle girilebilir.",
  "electrical-panel": "Pano ağırlığı henüz hesaplanmıyor; elle girilebilir.",
};

const VARSAYILAN_GEREKCE =
  "Katalog ağırlığı bu revizyonda kayıtlı değil — ürünü yeniden seçin ya da elle girin.";

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
  const { input, result, satirlar, gizliBolumler, durum } = girdi;
  const specs = input.specs;
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
    // SATIR EKRANDA TOPLANABİLMELİ: toplam, YUVARLANMIŞ birimden çarpılır.
    // Ham birimden çarpıp ayrıca yuvarlamak "2 ad × 4.774,5 = 9.549,1" gibi
    // kendi kendini yalanlayan bir satır üretiyordu.
    const birimKg = yuvarla(pozitifVeya(row.weightKg));
    const birimKgUst = yuvarla(pozitifVeya(row.weightKgUst));
    const kaynak: AgirlikKaynagi = HESAPTAN_GELEN_SLUGLAR.has(slug) ? "hesap" : "katalog";
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
      formul: birimKg !== null && adet !== null ? "adet × birim ağırlık" : undefined,
      gerekce:
        birimKg !== null
          ? undefined
          : (AGIRLIKSIZ_SLUG_GEREKCESI[slug] ?? VARSAYILAN_GEREKCE),
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
  tahminKalemleriniEkle({ input, specs, varOlan, bantSirasi, bantKalemleri, ekle });

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
      });
    }

    const bilinenGruplar = gruplar.filter((g) => g.kg !== null);
    const bantKg =
      bilinenGruplar.length > 0
        ? yuvarla(bilinenGruplar.reduce((t, g) => t + (g.kg as number), 0))
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
      eksikKalemSayisi: gruplar.reduce((t, g) => t + g.eksikKalemSayisi, 0),
      tahminIcerir: gruplar.some((g) => g.tahminIcerir),
      farkOrani:
        tahminiKg !== null && tahminiKg > 0 && bantKg !== null
          ? (bantKg - tahminiKg) / tahminiKg
          : null,
    });
  }

  const bilinenBantlar = bantlar.filter((b) => b.kg !== null);
  const eksikToplam = bantlar.reduce((t, b) => t + b.eksikKalemSayisi, 0);
  if (eksikToplam > 0) {
    notlar.push(
      `${eksikToplam} kalemin ağırlığı bilinmiyor; toplamlar EN AZ değeridir.`
    );
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
      bilinenBantlar.length > 0
        ? yuvarla(bilinenBantlar.reduce((t, b) => t + (b.kg as number), 0))
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
}): void {
  const { input, specs, varOlan, bantSirasi, bantKalemleri, ekle } = ctx;

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
    adet: number | null = 1
  ): void => {
    ekle(bant, {
      key: `${bant}.${grup}.tahmin`,
      label: ad,
      kaynak: "tahmin",
      adet,
      birimKg: adet !== null && adet > 1 && sonuc.kg !== null ? yuvarla(sonuc.kg / adet) : sonuc.kg,
      kg: yuvarla(sonuc.kg),
      formul: sonuc.formul,
      gerekce: sonuc.gerekce,
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
}

/** Yalnız kaldırma modüllerini süzer — dışa açık küçük yardımcı (test okur). */
export function kaldirmaModulleri(input: CalcInput): ModuleKey[] {
  return MODULE_ORDER.filter((k) => isHoistKey(k) && moduleState(input, k) !== undefined);
}
