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
import {
  MANUAL_APPENDIX_KINDS,
  MANUAL_AUTO_SOURCES,
  MANUAL_NOTE_LEVELS,
  type ManualAppendixKind,
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
export function manualFromTemplate(kimlik: Partial<ManualIdentity> = {}): ManualPayload {
  const id = makeIdFactory("s");
  return {
    v: 1,
    docTitle: "",
    coverTitle: "",
    partnerLogos: {},
    identity: { ...BOS_KIMLIK, ...kimlik },
    sections: MANUAL_TEMPLATE.map((t) => templateToSection(t, id)),
    templateVersion: MANUAL_TEMPLATE_VERSION,
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
      };
    }
    default:
      return null;
  }
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
