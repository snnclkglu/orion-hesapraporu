// TESLİM KAPSAMI VE PAKETLER — saf; React, DB ve HTTP yok.
//
// KAPSAM BİR DURUM DEĞİL, BİR İŞLEMDİR. Paket uygulamak ağaç üzerinde
// `section.hidden` ve otomatik blokların `variant` alanını YAZAR; ikinci bir
// görünürlük deposu AÇMAZ. `printedManual` tek süzgeç olarak kalır (KITAP-6).
// İki depo olsaydı gizlenen bölüm ekrandan düşer ama belgeye girmeye devam
// ederdi — bu bölümde olabilecek en pahalı hata budur.
//
// EKİN BELGEYE GİRİP GİRMEYECEĞİ DE AYNI YOLDAN GEÇER: `manualAppendixOrder`
// zaten `printedManual`'ı okur, yani ek bölümünü gizlemek eki de düşürür.
// Bu yüzden paketin "ek seçimi" diye ayrı bir alanı yoktur ve KITAP-8'in
// birleştirme sözleşmesine hiç dokunulmaz.
//
// DEFTER KODDADIR, VERİTABANINDA DEĞİL. Paket şablonun `key`lerine atıf yapar;
// veritabanında dursaydı bir bölüm anahtarı yeniden adlandırıldığında satırlar
// sessizce ölür ve hiçbir test bunu yakalayamazdı. Kodda durunca tek bir test
// her anahtarın şablonda gerçekten var olduğunu doğrular (değişmez md. 8).
// Üç paket vardır, üç yüz değil.

import { trKatla } from "@/lib/drawings/tr-text";
import { sectionToggleHidden } from "./edit-ops";
import type {
  ManualAppendixKind,
  ManualAppendixOption,
  ManualAutoSource,
  ManualPackageKey,
  ManualPayload,
  ManualSection,
} from "./types";
import { MANUAL_PACKAGES } from "./types";

export interface ManualPackageDef {
  key: ManualPackageKey;
  title: string;
  /** Bir cümlelik "bu paket kime verilir". */
  summary: string;
  /** GİZLENECEK gövde bölümlerinin şablon anahtarları. */
  hiddenSections: readonly string[];
  /** GÖRÜNECEK ek türleri; listede olmayan ek bölümü gizlenir. */
  appendices: readonly ManualAppendixKind[];
  /** Eklerin biçim ayarları (rapor seviyesi, föy sayısı). */
  appendixOptions: readonly ManualAppendixOption[];
  /** Otomatik blok ayrıntı basamağı: kaynak → varyant. */
  autoVariants: Partial<Record<ManualAutoSource, string>>;
}

/**
 * PAKET DEFTERİ.
 *
 * Üç basamak, artan kapsam. Gövde bölümleri paketten pakete neredeyse aynıdır
 * — asıl fark EKLERDE ve ekipman listesinin ayrıntısındadır, çünkü kullanıcının
 * tarif ettiği ayrım tam olarak buydu: aynı vinç, farklı teslim paketi.
 */
export const MANUAL_PACKAGE_BOOK: readonly ManualPackageDef[] = [
  {
    key: "standart",
    title: "Standart",
    summary:
      "Rutin gezer köprü teslimi: işletme ve bakım gövdesi, elektrik projesi eki. Mekanik hesap, katalog ve şartname ekleri verilmez.",
    hiddenSections: ["yedek.elektrik"],
    appendices: ["elektrikProje"],
    appendixOptions: [],
    autoVariants: { ekipman: "standart" },
  },
  {
    key: "detayli",
    title: "Detaylı",
    summary:
      "Şartnameli sanayi teslimi: gövdede mekanik ekipman listesi ve elektrik malzeme özeti (teknik özellik sütunuyla), ekte hesap raporu ÖZETİ, MEKANİK ve elektrik katalog föyleri, elektrik projesi ve şartname.",
    hiddenSections: [],
    /* MEKANİK KATALOG EKİ DE AÇIKTIR (kullanıcı kararı, 01.09.2026:
       *"Detaylı paketinde elektrik ve mekanik ekipman listeleri olsun"*).
       Önceki defterde elektriğin katalog sayfaları basılıyor, mekaniğinki
       basılmıyordu; simetrisiz bir kapsamdı ve kullanıcının tarif ettiği
       eksik tam olarak buydu. Gövdedeki iki liste (`yedek.ekipman` ·
       `yedek.elektrik`) bu pakette zaten görünürdü. */
    appendices: [
      "mekanikHesap",
      "mekanikKatalog",
      "elektrikProje",
      "elektrikKatalog",
      "sartname",
    ],
    appendixOptions: [
      { kind: "mekanikHesap", option: "ozet" },
      { kind: "elektrikKatalog", option: "2" },
    ],
    autoVariants: { ekipman: "detayli" },
  },
  {
    key: "tamTeknik",
    title: "Tam Teknik",
    summary:
      "Tam teslim paketi: yedi ekin tamamı, DETAYLI hesap raporu ve ürün başına dört teknik föy; ekipman listesi katalog sütunuyla basılır.",
    hiddenSections: [],
    appendices: [
      "mekanikHesap",
      "mekanikProje",
      "mekanikKatalog",
      "elektrikHesap",
      "elektrikProje",
      "elektrikKatalog",
      "sartname",
    ],
    appendixOptions: [
      { kind: "mekanikHesap", option: "detayli" },
      { kind: "elektrikKatalog", option: "4" },
    ],
    autoVariants: { ekipman: "kataloglu" },
  },
];

export function manualPackageDef(key: ManualPackageKey): ManualPackageDef {
  const def = MANUAL_PACKAGE_BOOK.find((p) => p.key === key);
  // Defter kodda ve `ManualPackageKey` ondan türüyor; bulunamaması ancak
  // defterin kendisi bozulursa olur ve o hâlde sessizce standarda düşmek,
  // müşteriye yanlış kapsamlı bir belge göndermekten iyidir.
  return def ?? MANUAL_PACKAGE_BOOK[0];
}

export function isManualPackageKey(v: unknown): v is ManualPackageKey {
  return typeof v === "string" && (MANUAL_PACKAGES as readonly string[]).includes(v);
}

// ————————————————————————————————————————————— paketin bölüm üzerindeki sözü

/**
 * Paketin bu bölüm hakkındaki sözü: `true` gizli, `false` görünür, `null` sözü
 * yok.
 *
 * ANAHTARI OLMAYAN BÖLÜME PAKET KARIŞMAZ. Kullanıcının kendi eklediği serbest
 * bir bölümü paket gizleseydi, kullanıcı yazdığı şeyin nereye gittiğini bir
 * daha bilemezdi.
 */
export function packageWantsHidden(
  def: ManualPackageDef,
  section: ManualSection
): boolean | null {
  if (section.appendix) return !def.appendices.includes(section.appendix);
  if (!section.key) return null;
  // Ek KAPSAYICISI ("ekler") kendi başına gizlenmez: bütün ekleri gizliyse
  // süzgeç onu zaten düşürür ve kapsayıcıyı ayrıca gizlemek, bir ek geri
  // açıldığında kapsayıcının kapalı kalmasına yol açardı.
  if (section.children.some((c) => c.appendix)) return null;
  return def.hiddenSections.includes(section.key);
}

export interface ApplyPackageResult {
  payload: ManualPayload;
  /** Kullanıcının kararıyla PAKETTEN SAPAN ve korunan bölüm anahtarları. */
  korunan: string[];
  /** Gerçekten değişen bölüm + blok sayısı. */
  degisen: number;
}

export interface ApplyPackageOptions {
  /** Uygulama anı (ISO). Saf çekirdek saat okumaz; çağıran verir. */
  at?: string;
  /** "Paketi Baştan Uygula": sapmalar yok sayılır ve `keptSections` temizlenir. */
  sapmalariYokSay?: boolean;
}

/**
 * PAKETİ AĞACA UYGULAR.
 *
 * Paket blok SİLMEZ, yalnız görünürlük ve ayrıntı basamağı yazar — gizlemek
 * silmek değildir ve paket değiştirmek geri alınabilir olmalıdır (KITAP-6).
 */
export function applyManualPackage(
  payload: ManualPayload,
  key: ManualPackageKey,
  opts: ApplyPackageOptions = {}
): ApplyPackageResult {
  const def = manualPackageDef(key);
  const korunanKume = opts.sapmalariYokSay
    ? new Set<string>()
    : new Set(payload.scope.keptSections);

  const korunan: string[] = [];
  let degisen = 0;

  const gez = (sections: readonly ManualSection[]): ManualSection[] =>
    sections.map((s) => {
      const istenen = packageWantsHidden(def, s);
      let hidden = s.hidden;

      if (istenen !== null) {
        const suanki = Boolean(s.hidden);
        if (istenen !== suanki) {
          if (s.key && korunanKume.has(s.key)) {
            korunan.push(s.key);
          } else {
            hidden = istenen;
            degisen += 1;
          }
        }
      }

      const blocks = s.blocks.map((b) => {
        if (b.kind !== "auto") return b;
        // ELLE DEĞİŞTİRİLEN VARYANT EZİLMEZ (KITAP-4'ün aynı yasası).
        if (b.edited) return b;
        const istenenVaryant = def.autoVariants[b.source];
        if ((b.variant ?? "") === (istenenVaryant ?? "")) return b;
        degisen += 1;
        const kalan = { ...b };
        delete kalan.variant;
        return istenenVaryant ? { ...kalan, variant: istenenVaryant } : kalan;
      });

      return { ...s, hidden, blocks, children: gez(s.children) };
    });

  const sections = temizle(gez(payload.sections));

  // EK SEÇENEKLERİ: elle değiştirilen ayar paketten korunur.
  const elle = payload.scope.appendixOptions.filter((o) => o.edited);
  const appendixOptions: ManualAppendixOption[] = [
    ...def.appendixOptions
      .filter((o) => !elle.some((e) => e.kind === o.kind))
      .map((o) => ({ ...o })),
    ...elle.map((o) => ({ ...o })),
  ];

  return {
    payload: {
      ...payload,
      sections,
      scope: {
        packageKey: key,
        appliedAt: opts.at ?? "",
        keptSections: opts.sapmalariYokSay ? [] : [...payload.scope.keptSections],
        appendixOptions,
      },
    },
    korunan,
    degisen,
  };
}

/** Kapalı olmayan bölümden `hidden` anahtarını SİLER — snapshot gürültüsü olmasın. */
function temizle(sections: readonly ManualSection[]): ManualSection[] {
  return sections.map((s) => {
    const { hidden, ...kalan } = s;
    const cocuk = temizle(s.children);
    return hidden ? { ...kalan, hidden: true, children: cocuk } : { ...kalan, children: cocuk };
  });
}

// ——————————————————————————————————————————————————————— sapma yönetimi

/**
 * BÖLÜM GÖRÜNÜRLÜĞÜNÜ ÇEVİRİR VE SAPMAYI KAYDEDER.
 *
 * Görünürlüğü değiştiren TEK giriş budur: `sectionToggleHidden` ağacı çevirir,
 * burası paketin ne dediğine bakıp sapma listesini günceller. İkisi ayrı ayrı
 * çağrılsaydı sapma bir yerde kaydedilir bir yerde kaydedilmez olurdu.
 *
 * KENDİ KENDİNİ ONARIR: kullanıcı bir bölümü gizleyip sonra tekrar gösterirse
 * bölüm paketin dediği yere geri döner ve anahtar sapma listesinden ÇIKAR.
 * Aksi hâlde bir kere dokunulan bölüm sonsuza dek paketin dışında kalırdı.
 */
export function manualToggleSection(
  payload: ManualPayload,
  sectionId: string
): ManualPayload {
  const sections = sectionToggleHidden(payload.sections, sectionId);
  const bulunan = bul(sections, sectionId);
  if (!bulunan?.key || !payload.scope.packageKey) {
    return { ...payload, sections };
  }

  const def = manualPackageDef(payload.scope.packageKey);
  const istenen = packageWantsHidden(def, bulunan);
  const kume = new Set(payload.scope.keptSections);
  if (istenen === null || istenen === Boolean(bulunan.hidden)) {
    kume.delete(bulunan.key);
  } else {
    kume.add(bulunan.key);
  }

  return {
    ...payload,
    sections,
    scope: { ...payload.scope, keptSections: [...kume] },
  };
}

function bul(sections: readonly ManualSection[], id: string): ManualSection | null {
  for (const s of sections) {
    if (s.id === id) return s;
    const alt = bul(s.children, id);
    if (alt) return alt;
  }
  return null;
}

/** Ek seçeneğini ELLE değiştirir — paket bir daha ezmez. */
export function manualSetAppendixOption(
  payload: ManualPayload,
  kind: ManualAppendixKind,
  option: string
): ManualPayload {
  const kalan = payload.scope.appendixOptions.filter((o) => o.kind !== kind);
  return {
    ...payload,
    scope: {
      ...payload.scope,
      appendixOptions: [...kalan, { kind, option, edited: true }],
    },
  };
}

/** Ekin seçeneği; paket ya da elle ayar yoksa `undefined`. */
export function manualAppendixOption(
  payload: ManualPayload,
  kind: ManualAppendixKind
): string | undefined {
  return payload.scope.appendixOptions.find((o) => o.kind === kind)?.option;
}

export interface ManualScopeDrift {
  sections: { key: string; title: string; paket: boolean; belge: boolean }[];
  appendices: ManualAppendixOption[];
}

/**
 * PAKETTEN NEREDE SAPILDI — Kapsam panelindeki "sizin kararınız" listesi.
 *
 * Serbest kapsamda (paket uygulanmamış belgede) sapma diye bir şey yoktur:
 * karşılaştırılacak bir söz yok demektir, boş liste döner.
 */
export function manualScopeDrift(payload: ManualPayload): ManualScopeDrift {
  if (!payload.scope.packageKey) return { sections: [], appendices: [] };
  const def = manualPackageDef(payload.scope.packageKey);

  const sections: ManualScopeDrift["sections"] = [];
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      const istenen = packageWantsHidden(def, s);
      if (istenen !== null && s.key && istenen !== Boolean(s.hidden)) {
        sections.push({
          key: s.key,
          title: s.title,
          paket: !istenen,
          belge: !s.hidden,
        });
      }
      gez(s.children);
    }
  };
  gez(payload.sections);

  return {
    sections,
    appendices: payload.scope.appendixOptions.filter((o) => o.edited),
  };
}

// ————————————————————————————————————————————————————————— paket önerisi

/**
 * VİNÇ TİPİNDEN PAKET ÖNERİSİ — zorlamaz, öntanım verir.
 *
 * `trKatla` ile karşılaştırılır: tarayıcıda `/şarj/i` deseni "ŞARJ"ı bulmaz
 * (Türkçe ı/I tuzağı), ve bu karşılaştırma hem sunucuda hem istemcide koşar.
 */
export function suggestManualPackage(craneType: string): ManualPackageKey {
  const k = trKatla(craneType ?? "");
  if (!k) return "standart";
  // Sıvı metal, cüruf ve şarj vinçleri tam teknik teslim ister: bu vinçler
  // şartnameli ihalelerle satılır ve hesap raporu da eklerle birlikte verilir.
  if (/SARJ|POTA|DOKUM|CURUF|GRAYFER/.test(k)) return "tamTeknik";
  if (/PORTAL|GANTRY|KONSOL|PERGEL/.test(k)) return "detayli";
  return "standart";
}
