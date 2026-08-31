// TÜRETİM ÇEKİRDEĞİ — saf; React, DB ve HTTP yok.
//
// "STANDART VİNÇTE NEREDEYSE OTOMATİK" (kullanıcı isteği, 30.08.2026). Şablon
// vince özel bölümleri bilerek BOŞ doğurur (KITAP-5) ve mühendis her kılavuzda
// aynı cümleleri yeniden yazar. Oysa o cümlelerin ÇOĞUNUN kaynağı zaten
// uygulamanın içindedir: gerilim hesap raporunda, frenler ekipman listesinde,
// bakım çizelgesi ekipman listesi + kural defterinde.
//
// ÜÇÜNCÜ İÇERİK TÜRÜ (KITAP-7'nin genişlemesi):
//   ŞABLON METNİ    `fromTemplate` — her vinçte aynı, "Standarda Dön"
//   OTOMATİK TABLO  `kind: "auto"` — taslakta canlı, yayımda donmuş
//   TÜRETİLMİŞ BLOK `derived`      — bu vincin verisinden ÜRETİLMİŞ, somut
//                                    metin/tablo; "Kaynaktan Tazele"
//
// TÜRETİLMİŞ BLOK MATERYALİZEDİR, CANLI DEĞİL. Üretildiği anda payload'a
// somut metin olarak yazılır. Canlı olsaydı yayımda ayrıca dondurulması
// gerekirdi; oysa snapshot zaten belgenin tamamıdır ve `issueManualRevision`
// hiç değişmedi.
//
// KAYNAK YETERSİZSE KURAL `null` DÖNER VE BLOK HİÇ DOĞMAZ (değişmez md. 4).
// Yarım bir cümle ya da tek sütunu dolu bir tablo, boş bir bölümden kötüdür:
// okuyan onu tamamlanmış sanar.
//
// `edited` KAZANIR (KITAP-4'ün aynı yasası): mühendis türetilmiş bir bloğa
// dokunduğu anda tazeleme onu bir daha ezmez ve toplu işlem korunanı SAYAR.

import { blockHasContent } from "./payload";
import {
  MAINTENANCE_RULE_BOOK,
  maintenanceScheduleTable,
  type MaintenanceRule,
} from "./maintenance-rules";
import {
  LUBRICATION_POINT_BOOK,
  lubricationClassNote,
  lubricationTable,
  type LubricationPoint,
} from "./lubrication-rules";
import type { ManualEquipmentRow, ManualSourceData } from "./sources";
import type { ManualBlock, ManualPayload, ManualSection } from "./types";

/** Kimliksiz blok — kimliği `applyAutofill` verir (şablon kopyalamanın deseni). */
type Kimliksiz<T> = T extends unknown ? Omit<T, "id"> : never;
export type DerivedBlock = Kimliksiz<ManualBlock>;

export interface AutofillContext {
  /** Kaldırma grubu DA burada: `sources.hoistGroup` (tek alan, tek gerçek). */
  sources: ManualSourceData;
  /** Birleştirilmiş bakım kuralları (kod + panel defteri). */
  maintenanceRules?: readonly MaintenanceRule[];
  /** Birleştirilmiş yağlama noktaları (kod + panel defteri). */
  lubricationPoints?: readonly LubricationPoint[];
}

export interface AutofillRule {
  /** Kararlı kimlik — bloğun `derived` alanında bu durur. */
  id: string;
  /** Hangi şablon bölümüne düşer; bölüm belgede yoksa kural atlanır. */
  sectionKey: string;
  /** Arayüzdeki "Kaynak: …" satırı. */
  sourceLabel: string;
  build(ctx: AutofillContext): DerivedBlock[] | null;
}

// ————————————————————————————————————————————————————— küçük yardımcılar

const takiliEkipman = (ctx: AutofillContext): ManualEquipmentRow[] =>
  (ctx.sources.equipment ?? []).filter((r) => !r.alternative);

/** Etiket-değer listesinden ilk uyan değeri döndürür; yoksa boş. */
function deger(
  liste: readonly { label: string; value: string }[] | undefined,
  desen: RegExp
): string {
  return liste?.find((r) => desen.test(r.label))?.value.trim() ?? "";
}

// ————————————————————————————————————————————————————————— kural defteri

export const MANUAL_AUTOFILL_RULES: readonly AutofillRule[] = [
  {
    id: "anaParcalar",
    sectionKey: "tanim.anaParcalar",
    sourceLabel: "Ekipman listesi (hesap raporundan)",
    build(ctx) {
      // Ekipman listesinin GRUPLARI vincin ana parça ailelerinin ta kendisidir
      // (Ana Kaldırma, Araba, Köprü…). İkinci bir "ana parçalar" listesi tutmak
      // ikisinin ayrışması demekti.
      const gruplar: string[] = [];
      for (const e of takiliEkipman(ctx)) {
        if (!gruplar.includes(e.group)) gruplar.push(e.group);
      }
      if (gruplar.length < 2) return null;
      return [
        { kind: "text", text: "Vinç aşağıdaki ana gruplardan oluşur:" },
        { kind: "list", items: gruplar },
      ];
    },
  },

  {
    id: "besleme",
    sectionKey: "kullanim.genel",
    sourceLabel: "Karakteristik özellikler (hesap raporundan)",
    build(ctx) {
      const k = ctx.sources.characteristics;
      const besleme = deger(k, /besleme|şebeke|ana gerilim|^gerilim/i);
      const kumanda = deger(k, /kumanda gerilimi|kontrol gerilimi/i);
      const frekans = deger(k, /frekans/i);
      if (!besleme) return null;

      const parcalar = [`Vinç ${besleme}`];
      if (frekans) parcalar.push(frekans);
      const cumle =
        parcalar.join(" / ") +
        " şebekeden beslenir" +
        (kumanda ? `; kumanda gerilimi ${kumanda}'dır.` : ".");
      return [{ kind: "text", text: cumle }];
    },
  },

  {
    id: "siniflandirmaCumlesi",
    sectionKey: "tanim.teknik.siniflandirma",
    sourceLabel: "Sınıflandırma (hesap raporundan)",
    build(ctx) {
      const s = ctx.sources.classes ?? [];
      if (s.length === 0) return null;
      // Cümle tabloyu TEKRAR ETMEZ, ÇERÇEVELER: okuyan sınıflandırmanın hangi
      // standarda göre yapıldığını tablodan öğrenemez.
      return [
        {
          kind: "text",
          text:
            "Vincin sınıflandırması FEM 1.001 ve DIN 15018'e göre yapılmıştır. " +
            "Aşağıdaki çizelgedeki gruplar vincin öngörülen kullanım süresini ve " +
            "yük kolektifini tanımlar; bu değerlerin dışında bir kullanım vincin " +
            "hesaplanan servis ömrünü kısaltır.",
        },
      ];
    },
  },

  {
    id: "frenListesi",
    sectionKey: "kullanim.frenler",
    sourceLabel: "Ekipman listesi (hesap raporundan)",
    build(ctx) {
      const frenler = takiliEkipman(ctx).filter((e) => /fren/i.test(e.component));
      if (frenler.length === 0) return null;
      const markaVar = frenler.some((f) => f.brand || f.model);
      return [
        {
          kind: "text",
          text:
            "Vinçte aşağıdaki frenler bulunur. Fren balatası ve hava aralığı " +
            "bakım çizelgesindeki aralıklarla denetlenir; balatalara yağ " +
            "bulaşmamasına dikkat edilmelidir.",
        },
        {
          kind: "table",
          table: {
            head: markaVar ? ["Yer", "Marka", "Model", "Adet"] : ["Yer", "Adet"],
            rows: frenler.map((f) =>
              markaVar
                ? [f.group, f.brand, f.model, f.qty]
                : [f.group, f.qty]
            ),
          },
        },
      ];
    },
  },

  {
    id: "limitListesi",
    sectionKey: "kullanim.limitSivicler",
    sourceLabel: "Elektrik projesi malzeme listesi",
    build(ctx) {
      const parcalar = ctx.sources.electricalParts ?? [];
      const limitler = parcalar.filter((p) =>
        /limit\s*switch|endschalter|limit şalter|limit siviç/i.test(p.designation)
      );
      if (limitler.length === 0) return null;
      // Aygıt etiketi belgedeki HÂLİYLE basılır: bakımcı elektrik projesinde o
      // etiketi arayacaktır ve normalize edilmiş bir etiket orada yoktur.
      return [
        {
          kind: "text",
          text:
            "Aşağıdaki limit şalterleri elektrik projesinden okunmuştur. " +
            "Şalterlerin YERİ ve devreye etkisi vince özeldir ve elektrik " +
            "projesindeki devre şemasından izlenir.",
        },
        {
          kind: "table",
          table: {
            head: ["Aygıt Etiketi", "Tanım", "Marka", "Tip"],
            rows: limitler.map((p) => [p.deviceTag, p.designation, p.supplier, p.typeNo]),
          },
        },
      ];
    },
  },

  {
    id: "bakimTakvimi",
    sectionKey: "bakim",
    sourceLabel: "Ekipman listesi + bakım kural defteri",
    build(ctx) {
      const ekipman = takiliEkipman(ctx);
      const table = maintenanceScheduleTable(ekipman, {
        hoistGroup: ctx.sources.hoistGroup,
        rules: ctx.maintenanceRules ?? MAINTENANCE_RULE_BOOK,
      });
      if (table.rows.length === 0) return null;
      return [{ kind: "table", table }];
    },
  },

  {
    id: "yaglamaTablosu",
    sectionKey: "yaglama",
    sourceLabel: "Ekipman listesi + yağlama nokta defteri",
    build(ctx) {
      const ekipman = takiliEkipman(ctx);
      const noktalar = ctx.lubricationPoints ?? LUBRICATION_POINT_BOOK;
      const table = lubricationTable(ekipman, { points: noktalar });
      if (table.rows.length === 0) return null;

      const siniflar = lubricationClassNote(ekipman, { points: noktalar });
      const bloklar: DerivedBlock[] = [];
      if (siniflar.length > 0) {
        bloklar.push({
          kind: "text",
          text:
            "Aşağıdaki noktalarda kullanılacak yağ SINIFLARI şunlardır; ürün " +
            "adı ve sipariş kodu kullanılan ekipmanın üretici kataloğundan " +
            "alınır ve tabloya yazılır:",
        });
        bloklar.push({ kind: "list", items: siniflar });
      }
      bloklar.push({ kind: "table", table });
      return bloklar;
    },
  },
];

// ————————————————————————————————————————————————————————— uygulama

export interface DerivedGroup {
  rule: AutofillRule;
  blocks: DerivedBlock[];
}

/** Bütün kuralları koşturur; hangi bölüme ne düşeceğini söyler (saf, ağaçsız). */
export function manualDerivedBlocks(
  ctx: AutofillContext,
  rules: readonly AutofillRule[] = MANUAL_AUTOFILL_RULES
): DerivedGroup[] {
  const out: DerivedGroup[] = [];
  for (const rule of rules) {
    const blocks = rule.build(ctx);
    if (blocks && blocks.length > 0) out.push({ rule, blocks });
  }
  return out;
}

export interface ApplyAutofillOptions {
  /** Yalnız bu bölüm anahtarı tazelensin. */
  yalnizBolum?: string;
  /** Yalnız bu blok tazelensin — `edited` bilerek YOK SAYILIR. */
  yalnizBlok?: string;
  rules?: readonly AutofillRule[];
}

export interface ApplyAutofillResult {
  payload: ManualPayload;
  /** Yazılan (yeni ya da tazelenen) blok sayısı. */
  uretilen: number;
  /** `edited` olduğu için DOKUNULMAYAN blok sayısı. */
  korunan: number;
}

/**
 * TÜRETİLMİŞ BLOKLARI AĞACA UYGULAR.
 *
 * YERLEŞİM: bir kuralın ilk uygulamasında, bölümdeki BOŞ ŞABLON BLOĞU (aynı
 * türden, dokunulmamış `bosluk()`) varsa türetilmiş blok ONUN YERİNE geçer ve
 * kimliğini devralır. Aksi hâlde belgede biri hiç basılmayan iki blok kalır ve
 * editörde kullanıcı hangisini dolduracağını bilemezdi. Böyle bir yer tutucu
 * yoksa blok bölümün SONUNA eklenir.
 *
 * KAYNAK KÜÇÜLÜRSE FAZLA BLOK DÜŞER: ekipman listesinden bir grup çıktığında
 * ona ait türetilmiş blok da gitmelidir, yoksa belge olmayan bir parçanın
 * bakımını anlatmaya devam ederdi. `edited` blok bu temizlikte de KORUNUR.
 */
export function applyAutofill(
  payload: ManualPayload,
  ctx: AutofillContext,
  opts: ApplyAutofillOptions = {}
): ApplyAutofillResult {
  const kapsam = (opts.rules ?? MANUAL_AUTOFILL_RULES).filter(
    (r) => !opts.yalnizBolum || r.sectionKey === opts.yalnizBolum
  );
  if (kapsam.length === 0) return { payload, uretilen: 0, korunan: 0 };

  // BOŞ ÜRETİM DE BİR SONUÇTUR. Kaynağından düşen bir kural (frenler ekipman
  // listesinden çıktı) `null` döner; o kuralın ESKİ blokları da temizlenmelidir,
  // yoksa belge olmayan bir parçanın bakımını anlatmaya devam ederdi.
  const uretim = new Map<string, DerivedBlock[]>();
  for (const r of kapsam) uretim.set(r.id, r.build(ctx) ?? []);

  // Bir bölümde BİRDEN ÇOK kural olabilir; hepsi işlenir. Yalnız ilkini almak,
  // ikinci kuralın sessizce hiç çalışmaması demekti.
  const bolumKurallari = new Map<string, AutofillRule[]>();
  for (const r of kapsam) {
    const liste = bolumKurallari.get(r.sectionKey) ?? [];
    liste.push(r);
    bolumKurallari.set(r.sectionKey, liste);
  }

  let uretilen = 0;
  let korunan = 0;

  // KİMLİK ÇAKIŞMASI OLAMAZ: var olan bütün kimlikler önce toplanır ve üretici
  // onların üstünden atlar. Saf çekirdek `crypto.randomUUID` KULLANMAZ — testte
  // her koşuda başka kimlik üretmek karşılaştırmayı imkânsız kılardı
  // (`makeIdFactory`in aynı gerekçesi).
  const alinmis = new Set<string>();
  const kimlikTopla = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      for (const b of s.blocks) alinmis.add(b.id);
      kimlikTopla(s.children);
    }
  };
  kimlikTopla(payload.sections);
  let sayac = 0;
  const yeniKimlik = () => {
    let aday = `t${++sayac}`;
    while (alinmis.has(aday)) aday = `t${++sayac}`;
    alinmis.add(aday);
    return aday;
  };

  const bolumeUygula = (s: ManualSection): ManualSection => {
    const kurallar = s.key ? bolumKurallari.get(s.key) : undefined;
    if (!kurallar) return s;

    let bloklar = [...s.blocks];
    const devralinan = new Set<string>();
    let degisti = false;

    for (const kural of kurallar) {
      const yeniler = uretim.get(kural.id) ?? [];
      const eskiler = bloklar.filter((b) => b.derived === kural.id);

      // Tek blok tazelemesi: yalnız o bloğu taşıyan kural çalışır.
      if (opts.yalnizBlok && !eskiler.some((b) => b.id === opts.yalnizBlok)) continue;

      yeniler.forEach((yeni, i) => {
        const eski = eskiler[i];

        if (eski) {
          if (opts.yalnizBlok && eski.id !== opts.yalnizBlok) return;
          // TEKİL TAZELEMEDE `edited` BİLEREK YOK SAYILIR: kullanıcı o düğmeye
          // basarak "benim düzenlemem gitsin, kaynağı geri getir" demiştir.
          if (eski.edited && !opts.yalnizBlok) {
            korunan += 1;
            return;
          }
          const yer = bloklar.findIndex((b) => b.id === eski.id);
          bloklar[yer] = { ...yeni, id: eski.id, derived: kural.id } as ManualBlock;
          uretilen += 1;
          degisti = true;
          return;
        }

        if (opts.yalnizBlok) return;

        // Boş şablon yer tutucusunu DEVRAL.
        const yerTutucu = bloklar.findIndex(
          (b) =>
            b.fromTemplate &&
            !b.edited &&
            !b.derived &&
            b.kind === yeni.kind &&
            !blockHasContent(b) &&
            !devralinan.has(b.id)
        );
        if (yerTutucu >= 0) {
          devralinan.add(bloklar[yerTutucu].id);
          bloklar[yerTutucu] = {
            ...yeni,
            id: bloklar[yerTutucu].id,
            derived: kural.id,
          } as ManualBlock;
        } else {
          bloklar.push({ ...yeni, id: yeniKimlik(), derived: kural.id } as ManualBlock);
        }
        uretilen += 1;
        degisti = true;
      });

      // Kaynak küçüldü ya da tamamen düştü: fazla kalan bloklar temizlenir.
      if (!opts.yalnizBlok && eskiler.length > yeniler.length) {
        for (const fazla of eskiler.slice(yeniler.length)) {
          if (fazla.edited) {
            korunan += 1;
            continue;
          }
          bloklar = bloklar.filter((b) => b.id !== fazla.id);
          degisti = true;
        }
      }
    }

    return degisti ? { ...s, blocks: bloklar } : s;
  };

  const gez = (liste: readonly ManualSection[]): ManualSection[] =>
    liste.map((s) => ({ ...bolumeUygula(s), children: gez(s.children) }));

  return { payload: { ...payload, sections: gez(payload.sections) }, uretilen, korunan };
}

/** Belgedeki türetilmiş blokların kural kimlikleri — Kaynaklar paneli okur. */
export function manualDerivedIds(sections: readonly ManualSection[]): string[] {
  const out = new Set<string>();
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      for (const b of s.blocks) if (b.derived) out.add(b.derived);
      gez(s.children);
    }
  };
  gez(sections);
  return [...out];
}
