// EL KİTABI SNAPSHOT'ININ OKUNMASI, NUMARALANMASI VE SÜZÜLMESİ — saf.
//
// ÜÇ İŞ, TEK DOSYA çünkü üçü de aynı ağacı dolaşır ve ayrı yazılsalardı
// "gizli bölüm numaralanır mı" sorusu iki yerde ayrı cevaplanırdı:
//
//   `withManualDefaults` — serbest biçimli JSONB'yi güvenle bugüne taşır
//   `numberManual`       — 1 · 1.1 · 1.1.1 ve EK-A · EK-B numaraları
//   `printedManual`      — gizlenenleri DÜŞÜREN tek süzgeç
//
// SÜZGEÇ TEKTİR ve PDF ile ekran özeti onu birlikte çağırır (TEKLIF-4'ün
// dersi): iki yerde yazılsaydı gizlenen bölüm ekrandan düşer ama belgeye
// girmeye devam ederdi — bu bölümde olabilecek en pahalı hata budur.
//
// NUMARA SÜZGEÇTEN SONRA VERİLİR. Gizlenen 3. bölümün ardından 4. bölüm
// belgede 3 olur; aksi hâlde içindekiler "1, 2, 4" diye giderdi ve okuyan
// eksik bir bölüm arardı.

import {
  MANUAL_TEMPLATE,
  MANUAL_TEMPLATE_VERSION,
  type TemplateBlock,
  type TemplateSection,
} from "./template";
import { MANUAL_DOC_TITLE, suggestCoverTitle } from "./naming";
import {
  MANUAL_APPENDIX_KINDS,
  MANUAL_AUTO_SOURCES,
  MANUAL_NOTE_LEVELS,
  MANUAL_PACKAGES,
  type ManualAppendixKind,
  type ManualAppendixOption,
  type ManualPackageKey,
  type ManualScope,
  type ManualAutoSource,
  type ManualBlock,
  type ManualIdentity,
  type ManualNoteLevel,
  type ManualPartnerLogos,
  type ManualPayload,
  type ManualSection,
  type ManualTable,
} from "./types";

// ————————————————————————————————————————————————————————— kimlik üretimi

/**
 * Blok/bölüm kimliği üreticisi.
 *
 * `crypto.randomUUID` KULLANILMAZ: çekirdek saftır ve testte üretilen bir
 * belgenin her koşuda başka kimlikler taşıması karşılaştırmayı imkânsız
 * kılardı. Sayaç ÇAĞIRAN tarafından verilir; şablondan kopyalama tek bir
 * sayaçla ilerler ve aynı şablon her zaman aynı kimlikleri üretir.
 */
export function makeIdFactory(prefix = "b"): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

// —————————————————————————————————————————————————————— şablondan kopya

function templateBlockToBlock(t: TemplateBlock, id: string): ManualBlock | null {
  const taban = { id, fromTemplate: true as const };
  switch (t.kind) {
    case "text":
      return { ...taban, kind: "text", text: t.text ?? "", ...(t.margin ? { margin: t.margin } : {}) };
    case "list":
      return {
        ...taban,
        kind: "list",
        items: [...(t.items ?? [])],
        ...(t.ordered ? { ordered: true } : {}),
        ...(t.result ? { result: t.result } : {}),
      };
    case "note":
      return {
        ...taban,
        kind: "note",
        level: t.level ?? "not",
        text: t.text ?? "",
        ...(t.title ? { title: t.title } : {}),
      };
    case "table":
      return {
        ...taban,
        kind: "table",
        table: {
          head: [...(t.head ?? [])],
          rows: (t.rows ?? []).map((r) => [...r]),
          ...(t.caption ? { caption: t.caption } : {}),
        },
      };
    case "auto":
      if (!t.source) return null;
      return { ...taban, kind: "auto", source: t.source, ...(t.emptyText ? { emptyText: t.emptyText } : {}) };
    case "image":
      // ŞABLON GÖRSELİ VARLIK ANAHTARIYLA gelir, yüklenmiş bir kimlikle
      // değil: baytları repodadır ve her kılavuza hazır düşer.
      if (!t.assetKey) return null;
      return {
        ...taban,
        kind: "image",
        assetKey: t.assetKey,
        ...(t.caption ? { caption: t.caption } : {}),
        ...(t.widthPct ? { widthPct: t.widthPct } : {}),
        ...(t.fullWidth !== undefined ? { fullWidth: t.fullWidth } : {}),
      };
    default:
      return null;
  }
}

function templateToSection(t: TemplateSection, id: () => string): ManualSection {
  return {
    id: id(),
    key: t.key,
    title: t.title,
    blocks: (t.blocks ?? [])
      .map((b) => templateBlockToBlock(b, id()))
      .filter((b): b is ManualBlock => b !== null),
    children: (t.children ?? []).map((c) => templateToSection(c, id)),
    ...(t.appendix ? { appendix: t.appendix } : {}),
  };
}

export const BOS_KIMLIK: ManualIdentity = {
  manufacturer: "",
  product: "",
  craneType: "",
  serialNo: "",
  productionYear: "",
  customer: "",
  site: "",
  manufacturerAddress: "",
  customerDocNo: "",
  customerRevision: "",
  preparedOn: "",
  revisedOn: "",
  copyright: "",
};

/**
 * Şablondan YENİ bir el kitabı gövdesi kurar.
 *
 * Künye alanları ÇAĞIRANDAN gelir (proje, müşteri, vinç tipi); şablon onları
 * bilmez ve uydurmaz. Verilmeyen alan BOŞ kalır (değişmez md. 4).
 */
/**
 * SERBEST KAPSAM — hiçbir paket uygulanmamış hâl.
 *
 * Yeni belge de burada doğar: paketi `createManual` vinç tipinden ÖNERİR ve
 * uygular; şablonun kendisi bir kapsam dayatmaz.
 */
export const BOS_KAPSAM: ManualScope = {
  packageKey: "",
  appliedAt: "",
  keptSections: [],
  appendixOptions: [],
};

export function manualFromTemplate(kimlik: Partial<ManualIdentity> = {}): ManualPayload {
  const id = makeIdFactory("s");
  return {
    v: 1,
    docTitle: "",
    coverTitle: "",
    partnerLogos: {},
    identity: { ...BOS_KIMLIK, ...kimlik },
    scope: { ...BOS_KAPSAM },
    sections: MANUAL_TEMPLATE.map((t) => templateToSection(t, id)),
    templateVersion: MANUAL_TEMPLATE_VERSION,
  };
}

/** Proje künyesinden yeni/yeniden açılan ilk el kitabı taslağını kurar. */
export function manualFromProjectTemplate({
  customer = "",
  product = "",
  craneType = "",
  coverTitle = "",
}: {
  customer?: string;
  product?: string;
  craneType?: string;
  coverTitle?: string;
}): ManualPayload {
  const payload = manualFromTemplate({ customer, product, craneType });
  payload.docTitle = MANUAL_DOC_TITLE;
  payload.coverTitle = coverTitle.trim() || suggestCoverTitle(product, craneType);
  return payload;
}

/**
 * “Yeni Revizyon” için saf karar çekirdeği.
 *
 * Son revizyon varsa onun snapshot'ı kopyalanır ve yayımdaki donmuş otomatik
 * tablolar yeniden canlı hâle gelir. Bütün revizyonlar silinmişse el kitabı
 * üst kaydı hâlâ vardır; bu geçerli durumda proje künyesiyle şablondan yeni
 * bir V1 doğar. Kullanıcı, silinen ilk taslaktan sonra kilitli kalmaz.
 */
export function manualDraftForNextRevision(
  previous: { revNo: number; payload: unknown } | null,
  project: {
    customer?: string;
    product?: string;
    craneType?: string;
    coverTitle?: string;
  }
): { revNo: number; payload: ManualPayload; copiedFromPrevious: boolean } {
  if (!previous) {
    return {
      revNo: 1,
      payload: manualFromProjectTemplate(project),
      copiedFromPrevious: false,
    };
  }

  const payload = withManualDefaults(previous.payload);
  const cozulmus = (sections: ManualSection[]): ManualSection[] =>
    sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (block.kind !== "auto") return block;
        const { frozen, ...liveBlock } = block;
        void frozen;
        return liveBlock;
      }),
      children: cozulmus(section.children),
    }));
  payload.sections = cozulmus(payload.sections);

  return {
    revNo: Math.max(0, Number(previous.revNo) || 0) + 1,
    payload,
    copiedFromPrevious: true,
  };
}

// ——————————————————————————————————————————————— JSONB'den güvenli okuma

const metin = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Partner logo yuvalarını güvenle okur.
 *
 * Yalnız sözleşmedeki İKİ konum kabul edilir. Boş/boşluk kimlikleri logo
 * değildir; sayılar ve bilinmeyen alanlar da taşınmaz. Kimliğin depoda
 * gerçekten bulunup bulunmadığını bu saf çekirdek değil, görsel yükleyici
 * çözer.
 */
function partnerLogolariOku(v: unknown): ManualPartnerLogos {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const centerImageId = metin(o.centerImageId).trim();
  const rightImageId = metin(o.rightImageId).trim();
  return {
    ...(centerImageId ? { centerImageId } : {}),
    ...(rightImageId ? { rightImageId } : {}),
  };
}

/**
 * Uyarı düzeyini güvenle okur.
 *
 * ESKİ AD KORUNUR: dört basamaklı ilk sürümde en alt düzeyin adı "bilgi"ydi;
 * beşe çıkarken "not" oldu. Eşleme burada durur ki o adla kaydedilmiş bir
 * kılavuz açıldığında kutusu kaybolmasın (`withManualDefaults`in "bozuk düğüm
 * düşer, belge düşmez" ilkesi).
 */
function notDuzeyi(v: unknown): ManualNoteLevel {
  const ham = metin(v);
  if (ham === "bilgi") return "not";
  return MANUAL_NOTE_LEVELS.includes(ham as ManualNoteLevel) ? (ham as ManualNoteLevel) : "not";
}
const bayrak = (v: unknown): boolean => v === true;

function blokOku(v: unknown, id: () => string): ManualBlock | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const taban = {
    id: metin(o.id) || id(),
    ...(bayrak(o.fromTemplate) ? { fromTemplate: true as const } : {}),
    ...(bayrak(o.edited) ? { edited: true as const } : {}),
    ...(bayrak(o.hidden) ? { hidden: true as const } : {}),
    // Tanınmayan kural kimliği ALAN OLARAK düşer ama BLOK KALIR: içeriği zaten
    // somut metindir ve onu düşürmek bir bakım talimatının kaybolması demekti.
    ...(metin(o.derived) ? { derived: metin(o.derived) } : {}),
  };
  switch (o.kind) {
    case "text":
      return { ...taban, kind: "text", text: metin(o.text), ...(metin(o.margin) ? { margin: metin(o.margin) } : {}) };
    case "list":
      return {
        ...taban,
        kind: "list",
        items: Array.isArray(o.items) ? o.items.map(metin) : [],
        ...(bayrak(o.ordered) ? { ordered: true as const } : {}),
        ...(metin(o.result) ? { result: metin(o.result) } : {}),
      };
    case "note":
      return {
        ...taban,
        kind: "note",
        // Tanınmayan düzey EN ZARARSIZINA düşer. Eski kayıtlardaki "bilgi"
        // de buraya gelir: düzey listesi beşe çıkarken adı "not" oldu
        // (bkz. `MANUAL_NOTE_LEVELS`) ve bir kılavuzu açılmaz yapmaktansa
        // kutuyu bir basamak aşağı almak doğrudur.
        level: notDuzeyi(o.level),
        text: metin(o.text),
        ...(metin(o.title) ? { title: metin(o.title) } : {}),
      };
    case "table":
      return { ...taban, kind: "table", table: tabloOku(o.table) };
    case "image": {
      const imageId = metin(o.imageId);
      const assetKey = metin(o.assetKey);
      // KAYNAĞI OLMAYAN GÖRSEL BLOĞU, karşılığı olmayan bir kutudur.
      // `assetKey` ÖNCELİKLİ DEĞİL, ikisi de kabul edilir ama biri şart.
      if (!imageId && !assetKey) return null;
      const pct = Number(o.widthPct);
      return {
        ...taban,
        kind: "image",
        ...(imageId ? { imageId } : {}),
        ...(assetKey ? { assetKey } : {}),
        ...(metin(o.caption) ? { caption: metin(o.caption) } : {}),
        ...(Number.isFinite(pct) && pct >= 10 && pct <= 100 ? { widthPct: pct } : {}),
        ...(typeof o.fullWidth === "boolean" ? { fullWidth: o.fullWidth } : {}),
      };
    }
    case "diagram": {
      const d = o.diagram as Record<string, unknown> | undefined;
      const w = Number(d?.width);
      const h = Number(d?.height);
      // ÖLÇÜSÜ OLMAYAN ŞEMA ÇİZİLEMEZ ve yerleşim onu ölçemez; blok DÜŞER.
      if (!d || !Array.isArray(d.els) || !(w > 0) || !(h > 0)) return null;
      const pctD = Number(o.widthPct);
      return {
        ...taban,
        kind: "diagram",
        diagramKey: metin(o.diagramKey),
        // MODEL DOĞRULANMAZ, TAŞINIR: çizim modeline eklenen yeni bir eleman
        // türü eski kılavuzları açılmaz yapmamalıdır (`types.ts` gerekçesi).
        diagram: {
          width: w,
          height: h,
          els: d.els,
          ...(Number.isFinite(Number(d.x0)) ? { x0: Number(d.x0) } : {}),
          ...(Number.isFinite(Number(d.y0)) ? { y0: Number(d.y0) } : {}),
        },
        ...(metin(o.caption) ? { caption: metin(o.caption) } : {}),
        ...(Number.isFinite(pctD) && pctD >= 10 && pctD <= 100 ? { widthPct: pctD } : {}),
        ...(typeof o.fullWidth === "boolean" ? { fullWidth: o.fullWidth } : {}),
      };
    }
    case "auto": {
      const source = o.source as ManualAutoSource;
      if (!MANUAL_AUTO_SOURCES.includes(source)) return null;
      const frozen = o.frozen ? tabloOku(o.frozen) : null;
      return {
        ...taban,
        kind: "auto",
        source,
        ...(frozen && (frozen.head.length || frozen.rows.length) ? { frozen } : {}),
        ...(metin(o.emptyText) ? { emptyText: metin(o.emptyText) } : {}),
        // Varyant SERBEST METİNDİR ve burada doğrulanmaz: kaynağa göre
        // anlamı değişir ve tanınmayan değeri çözücü öntanıma indirir.
        // Burada reddetmek, gelecekte eklenecek bir basamağı taşıyan
        // belgenin eski bir sürümde sessizce sıfırlanması demekti.
        ...(metin(o.variant) ? { variant: metin(o.variant) } : {}),
      };
    }
    default:
      return null;
  }
}

/**
 * KAPSAMI OKUR — eski belgelerde YOKTUR ve olmaması bir kusur değildir.
 *
 * Boş `packageKey` "serbest kapsam" demektir: hiçbir paket uygulanmamıştır ve
 * ağaca hiçbir şey yazılmaz. Bu yüzden kapsam modeli eklendikten sonra da eski
 * bir kılavuz BİREBİR aynı belgeyi basar (`payload-legacy.test.ts` bunu
 * dondurulmuş çıktıyla kanıtlar).
 *
 * Tanınmayan paket adı boşa düşer; tanınmayan ek türü satırdan düşer. Kapsamı
 * bozuk diye belgeyi açmamak, bu bölümde yapılabilecek en kötü şeydir.
 */
function kapsamOku(v: unknown): ManualScope {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const ad = metin(o.packageKey);
  const packageKey: ManualPackageKey | "" = (MANUAL_PACKAGES as readonly string[]).includes(ad)
    ? (ad as ManualPackageKey)
    : "";

  const appendixOptions: ManualAppendixOption[] = Array.isArray(o.appendixOptions)
    ? o.appendixOptions
        .map((ham): ManualAppendixOption | null => {
          if (!ham || typeof ham !== "object" || Array.isArray(ham)) return null;
          const r = ham as Record<string, unknown>;
          const kind = r.kind as ManualAppendixKind;
          if (!MANUAL_APPENDIX_KINDS.includes(kind)) return null;
          return {
            kind,
            ...(metin(r.option) ? { option: metin(r.option) } : {}),
            ...(bayrak(r.edited) ? { edited: true as const } : {}),
          };
        })
        .filter((o2): o2 is ManualAppendixOption => o2 !== null)
    : [];

  return {
    packageKey,
    appliedAt: metin(o.appliedAt),
    // SAPMA LİSTESİ ANCAK PAKET VARSA ANLAMLIDIR: paketsiz bir belgede
    // "paketten sapma" diye bir şey yoktur ve listeyi taşımak, sonradan bir
    // paket uygulandığında hiç verilmemiş kararların korunması demekti.
    keptSections: packageKey && Array.isArray(o.keptSections)
      ? o.keptSections.map(metin).filter(Boolean)
      : [],
    appendixOptions,
  };
}

function tabloOku(v: unknown): ManualTable {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { head: [], rows: [] };
  const o = v as Record<string, unknown>;
  return {
    head: Array.isArray(o.head) ? o.head.map(metin) : [],
    rows: Array.isArray(o.rows)
      ? o.rows.filter(Array.isArray).map((r) => (r as unknown[]).map(metin))
      : [],
    ...(metin(o.caption) ? { caption: metin(o.caption) } : {}),
  };
}

function bolumOku(v: unknown, id: () => string): ManualSection | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const ek = o.appendix as ManualAppendixKind;
  return {
    id: metin(o.id) || id(),
    ...(metin(o.key) ? { key: metin(o.key) } : {}),
    title: metin(o.title),
    ...(bayrak(o.hidden) ? { hidden: true as const } : {}),
    ...(bayrak(o.titleEdited) ? { titleEdited: true as const } : {}),
    blocks: Array.isArray(o.blocks)
      ? o.blocks.map((b) => blokOku(b, id)).filter((b): b is ManualBlock => b !== null)
      : [],
    children: Array.isArray(o.children)
      ? o.children.map((c) => bolumOku(c, id)).filter((c): c is ManualSection => c !== null)
      : [],
    ...(MANUAL_APPENDIX_KINDS.includes(ek) ? { appendix: ek } : {}),
  };
}

/**
 * Serbest biçimli JSONB'yi bugünün modeline taşır (`revision-load.ts` deseni).
 *
 * Bozuk/tanınmayan düğüm DÜŞER, belge düşmez: bir alanın bozulması yüzünden
 * teslim edilmiş bir kılavuzun hiç açılmaması en kötü sonuçtur.
 */
export function withManualDefaults(raw: unknown): ManualPayload {
  const id = makeIdFactory("r");
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const kimlikHam = (o.identity && typeof o.identity === "object" ? o.identity : {}) as Record<string, unknown>;
  const kimlik = { ...BOS_KIMLIK };
  for (const k of Object.keys(BOS_KIMLIK) as (keyof ManualIdentity)[]) kimlik[k] = metin(kimlikHam[k]);

  const sections = Array.isArray(o.sections)
    ? o.sections.map((s) => bolumOku(s, id)).filter((s): s is ManualSection => s !== null)
    : [];

  const surum = Number(o.templateVersion);
  return {
    v: 1,
    docTitle: metin(o.docTitle),
    coverTitle: metin(o.coverTitle),
    ...(metin(o.coverImageId) ? { coverImageId: metin(o.coverImageId) } : {}),
    partnerLogos: partnerLogolariOku(o.partnerLogos),
    identity: kimlik,
    scope: kapsamOku(o.scope),
    sections,
    templateVersion: Number.isFinite(surum) ? surum : 0,
  };
}

// ——————————————————————————————————————————————————————————— süzgeç

/** Bloğun BASILACAK bir şeyi var mı? Boş bir paragraf belgede kusurdur. */
export function blockHasContent(b: ManualBlock): boolean {
  switch (b.kind) {
    case "text":
      return b.text.trim() !== "";
    case "list":
      return b.items.some((i) => i.trim() !== "");
    case "note":
      return b.text.trim() !== "" || (b.title ?? "").trim() !== "";
    case "table":
      return b.table.rows.length > 0;
    case "image":
      // Kaynağı olmayan görsel `withManualDefaults`ta zaten düşer; burada
      // yalnız süzgecin tam olması için sınanır.
      return Boolean(b.imageId || b.assetKey);
    case "diagram":
      // Ölçüsüz şema okuyucuda düşer; burada da elemansız model basılmaz.
      return b.diagram.els.length > 0;
    case "auto":
      // Otomatik blok içeriğini çözüldüğünde alır; burada kararı `frozen`
      // varsa o verir, yoksa blok AYAKTA kalır ve çözücü boşsa düşürür.
      return b.frozen ? b.frozen.rows.length > 0 : true;
  }
}

/**
 * Gizlenenleri ve boşları DÜŞÜREN tek süzgeç.
 *
 * Bir bölüm şu üç durumda düşer: kendisi gizliyse, ya da (basılacak bloğu
 * kalmadıysa VE basılacak çocuğu kalmadıysa VE bir EK bölümü değilse).
 * Ek bölümü içeriksiz de ayakta kalır — onun gövdesi bir ayraç kapağıdır ve
 * asıl içerik indirme ucunda birleştirilen PDF'tir.
 */
export function printedManual(payload: ManualPayload): ManualPayload {
  return { ...payload, sections: bolumleriSuz(payload.sections) };
}

function bolumleriSuz(sections: readonly ManualSection[]): ManualSection[] {
  const out: ManualSection[] = [];
  for (const s of sections) {
    if (s.hidden) continue;
    const blocks = s.blocks.filter((b) => !b.hidden && blockHasContent(b));
    const children = bolumleriSuz(s.children);
    if (blocks.length === 0 && children.length === 0 && !s.appendix) continue;
    out.push({ ...s, blocks, children });
  }
  return out;
}

// ————————————————————————————————————————————————————————— numaralama

export interface NumberedSection extends ManualSection {
  /** Basılan numara: `2.1.3` ya da ek bölümlerinde `EK-C`. */
  number: string;
  /** 1 tabanlı derinlik — başlık ölçüsü buradan seçilir. */
  depth: number;
  children: NumberedSection[];
}

/** Ek numaraları harflidir: EK-A · EK-B … (`docCode` ile karışmasın diye). */
const EK_HARFLERI = "ABCDEFGHIJKLMNOPRSTUVYZ";

/**
 * Ağacı numaralar.
 *
 * EK BÖLÜMLERİ AYRI BİR ZİNCİRDİR: gövde 1'den sayarken ekler A'dan harflenir.
 * Kaynak kılavuzda ek yoktu ama müşterinin talebi yedi ek getiriyor ve onları
 * gövdenin sayısına eklemek "8. bölüm elektrik projesi" gibi okunurdu — oysa
 * o bir bölüm değil, belgenin arkasına bağlanan başka bir belgedir.
 */
export function numberManual(sections: readonly ManualSection[]): NumberedSection[] {
  let govde = 0;
  let ek = 0;
  const out: NumberedSection[] = [];
  for (const s of sections) {
    const ekBolumu = s.appendix !== undefined || s.children.some((c) => c.appendix !== undefined);
    if (ekBolumu) {
      // Ek KAPSAYICISI numarasızdır; numarayı çocukları alır.
      out.push({ ...s, number: "", depth: 1, children: eklerNumarala(s.children, () => EK_HARFLERI[ek++] ?? "?") });
    } else {
      govde += 1;
      out.push({ ...s, number: String(govde), depth: 1, children: altlariNumarala(s.children, String(govde), 2) });
    }
  }
  return out;
}

function altlariNumarala(sections: readonly ManualSection[], onek: string, depth: number): NumberedSection[] {
  return sections.map((s, i) => {
    const no = `${onek}.${i + 1}`;
    return { ...s, number: no, depth, children: altlariNumarala(s.children, no, depth + 1) };
  });
}

function eklerNumarala(sections: readonly ManualSection[], harf: () => string): NumberedSection[] {
  return sections.map((s) => {
    const no = `EK-${harf()}`;
    return { ...s, number: no, depth: 2, children: altlariNumarala(s.children, no, 3) };
  });
}

// ————————————————————————————————————————————————————————— dolaşma

/** Ağacı düzleştirir — içindekiler, editör listesi ve sayaçlar bunu kullanır. */
export function flattenManual(sections: readonly NumberedSection[]): NumberedSection[] {
  const out: NumberedSection[] = [];
  const gez = (liste: readonly NumberedSection[]) => {
    for (const s of liste) {
      out.push(s);
      gez(s.children);
    }
  };
  gez(sections);
  return out;
}

/** Belgedeki bütün blokları sırayla verir. */
export function allBlocks(sections: readonly ManualSection[]): ManualBlock[] {
  const out: ManualBlock[] = [];
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      out.push(...s.blocks);
      gez(s.children);
    }
  };
  gez(sections);
  return out;
}

/** Belgenin kullandığı ek türleri — indirme ucu neyi birleştireceğini buradan bilir. */
export function usedAppendices(sections: readonly ManualSection[]): ManualAppendixKind[] {
  const out: ManualAppendixKind[] = [];
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      if (s.appendix && !out.includes(s.appendix)) out.push(s.appendix);
      gez(s.children);
    }
  };
  gez(sections);
  return out;
}

// ————————————————————————————————————————————— şablon büyümesi

export interface TemplateAddition {
  /** Şablondaki bölüm anahtarı. */
  key: string;
  title: string;
  /** Üst bölümün anahtarı; kök bölümde boştur. */
  parentKey: string;
  /** Üst bölümün çocukları arasındaki sırası. */
  index: number;
}

/** Ağaçtaki bütün bölüm anahtarları. */
function anahtarKumesi(sections: readonly ManualSection[]): Set<string> {
  const out = new Set<string>();
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      if (s.key) out.add(s.key);
      gez(s.children);
    }
  };
  gez(sections);
  return out;
}

/**
 * ŞABLONDA OLUP BELGEDE OLMAYAN BÖLÜMLER.
 *
 * ŞABLON SÜRÜMÜ ARTTIĞINDA VAR OLAN BELGELER DEĞİŞMEZ (KITAP-4). Belge
 * kullanıcınındır; bir güncelleme onun sildiği bölümü geri getiremez. Bu
 * yüzden burası yalnız NE EKLENEBİLECEĞİNİ söyler; ekleme kararı kullanıcınındır.
 *
 * Kullanıcının bilinçli olarak SİLDİĞİ bir bölüm de listede görünür ve bu
 * kabul edilebilir: karar yine kullanıcınındır ve kart kapatılabilir. Silinen
 * bölümü "bir daha önerme" diye işaretlemek, belgeye kullanıcının görmediği
 * bir durum eklemek olurdu.
 */
export function templateAdditions(payload: ManualPayload): TemplateAddition[] {
  const varOlan = anahtarKumesi(payload.sections);
  const out: TemplateAddition[] = [];
  const gez = (liste: readonly TemplateSection[], parentKey: string) => {
    liste.forEach((t, i) => {
      if (!varOlan.has(t.key)) {
        out.push({ key: t.key, title: t.title, parentKey, index: i });
        // ALT AĞACA İNİLMEZ: üst bölüm eklenirse çocukları da onunla gelir.
        return;
      }
      if (t.children) gez(t.children, t.key);
    });
  };
  gez(MANUAL_TEMPLATE, "");
  return out;
}

function sablonBolumuBul(
  liste: readonly TemplateSection[],
  key: string
): TemplateSection | null {
  for (const t of liste) {
    if (t.key === key) return t;
    const alt = t.children ? sablonBolumuBul(t.children, key) : null;
    if (alt) return alt;
  }
  return null;
}

/**
 * Şablondaki bir bölümü (alt ağacıyla birlikte) belgeye ekler.
 *
 * SIRASI ŞABLONDAKİ SIRADIR: bölüm üst bölümünün çocukları arasında şablondaki
 * yerine yerleştirilir, sona değil. Sona eklemek "5.6 Açıklık Ölçümü"nü
 * "5.5 Muayene Defteri"nden sonraya atardı ve numaralandırma şablondan
 * ayrışırdı.
 *
 * Kimlikler `makeIdFactory("e")` ile üretilir; var olan kimliklerle çakışmaz
 * çünkü şablon kopyaları `s`, okuyucu `r`, türetim `t` öneki kullanır.
 */
export function addTemplateSection(payload: ManualPayload, key: string): ManualPayload {
  const kaynak = sablonBolumuBul(MANUAL_TEMPLATE, key);
  if (!kaynak) return payload;
  if (anahtarKumesi(payload.sections).has(key)) return payload;

  const id = makeIdFactory("e");
  const yeni = templateToSection(kaynak, id);

  const ekle = (liste: readonly TemplateSection[], parentKey: string): TemplateAddition | null => {
    for (let i = 0; i < liste.length; i += 1) {
      if (liste[i].key === key) {
        return { key, title: liste[i].title, parentKey, index: i };
      }
      const alt = liste[i].children ? ekle(liste[i].children!, liste[i].key) : null;
      if (alt) return alt;
    }
    return null;
  };
  const yer = ekle(MANUAL_TEMPLATE, "");
  if (!yer) return payload;

  const yerlestir = (liste: readonly ManualSection[]): ManualSection[] => {
    const kopya = [...liste];
    kopya.splice(Math.max(0, Math.min(yer.index, kopya.length)), 0, yeni);
    return kopya;
  };

  if (!yer.parentKey) {
    return { ...payload, sections: yerlestir(payload.sections) };
  }

  const gez = (liste: readonly ManualSection[]): ManualSection[] =>
    liste.map((s) =>
      s.key === yer.parentKey
        ? { ...s, children: yerlestir(s.children) }
        : { ...s, children: gez(s.children) }
    );
  return { ...payload, sections: gez(payload.sections) };
}
