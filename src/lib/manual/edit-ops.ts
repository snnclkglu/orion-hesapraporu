// EL KİTABI AĞACININ DÜZENLEME İŞLEMLERİ — saf; React, DB ve HTTP yok.
//
// NEDEN AYRI DOSYA: bu işlemler bugüne kadar `manual-editor.tsx`in içinde,
// JSX'in ortasında satır içi kapanışlar olarak yaşıyordu ve HİÇBİRİNİN birim
// testi yoktu. Bir bloğu taşımanın, silmenin ya da standarda döndürmenin
// doğruluğu ancak ekranı açıp deneyerek anlaşılıyordu. Üstelik aynı işlem
// yakında İKİ yerden çağrılacak (ok düğmeleri ve sürükle-bırak); iki ayrı
// gövde yazılsaydı ikisi bir gün ayrışırdı (değişmez md. 8).
//
// HEPSİ SAFTIR VE YENİ AĞAÇ DÖNER. Yerinde değiştirme yapılsaydı React'in
// referans karşılaştırması değişikliği görmez, ekran güncellenmezdi. Bir
// işlem uygulanamıyorsa (sınırda taşıma, bulunamayan kimlik) GELEN AĞAÇ AYNEN
// döner — yarım uygulanmış bir işlem, kullanıcının bu ekrana bir daha
// güvenmemesi demektir.

import { MANUAL_TEMPLATE } from "./template";
import type { TemplateBlock, TemplateSection } from "./template";
import type { ManualBlock, ManualSection } from "./types";

export type Yon = "yukari" | "asagi";

// ————————————————————————————————————————————————————————————————— bulma

/** Ağaçta kimliğiyle bölüm arar; yoksa `null`. */
export function sectionFind(
  sections: readonly ManualSection[],
  id: string
): ManualSection | null {
  for (const s of sections) {
    if (s.id === id) return s;
    const alt = sectionFind(s.children, id);
    if (alt) return alt;
  }
  return null;
}

/** Kökten bölümün kendisine giden yol — kırıntı ve "üst bölüm gizli mi". */
export function sectionPath(
  sections: readonly ManualSection[],
  id: string
): ManualSection[] {
  for (const s of sections) {
    if (s.id === id) return [s];
    const alt = sectionPath(s.children, id);
    if (alt.length > 0) return [s, ...alt];
  }
  return [];
}

/** Bir bölümün ve bütün alt ağacının kimlikleri — taşıma kilidi bunu okur. */
function altAgacKimlikleri(section: ManualSection): Set<string> {
  const kume = new Set<string>([section.id]);
  const gez = (liste: readonly ManualSection[]) => {
    for (const s of liste) {
      kume.add(s.id);
      gez(s.children);
    }
  };
  gez(section.children);
  return kume;
}

// ——————————————————————————————————————————————————————————— değiştirme

/** Ağaçtaki bir bölümü kimliğiyle değiştirir; yeni ağaç döner. */
export function sectionUpdate(
  sections: readonly ManualSection[],
  id: string,
  degistir: (s: ManualSection) => ManualSection
): ManualSection[] {
  return sections.map((s) =>
    s.id === id
      ? degistir(s)
      : { ...s, children: sectionUpdate(s.children, id, degistir) }
  );
}

/**
 * GİZLE / GÖSTER.
 *
 * Yalnız bayrağı çevirir; blok SİLMEZ ve alt ağaca DOKUNMAZ. Gizlemek silmek
 * değildir (KITAP-6). Süzgeç zaten üst bölüm gizliyse alt ağacın tamamını
 * düşürür; burada da düşürmek, göstermeye dönüldüğünde kullanıcının kendi
 * verdiği alt bölüm kararlarını kaybetmesi demekti.
 */
export function sectionToggleHidden(
  sections: readonly ManualSection[],
  id: string
): ManualSection[] {
  return sectionUpdate(sections, id, (s) => ({ ...s, hidden: !s.hidden }));
}

/** Başlığı değiştirir ve `titleEdited` açar — şablon tazelemesi bir daha ezmez. */
export function sectionRename(
  sections: readonly ManualSection[],
  id: string,
  title: string
): ManualSection[] {
  return sectionUpdate(sections, id, (s) => ({ ...s, title, titleEdited: true }));
}

// ——————————————————————————————————————————————————————————— bölüm taşıma

/** Bölümü KARDEŞLERİ arasında bir sıra kaydırır (ok düğmesi). */
export function sectionMove(
  sections: readonly ManualSection[],
  id: string,
  yon: Yon
): ManualSection[] {
  const kaydir = (liste: readonly ManualSection[]): ManualSection[] | null => {
    const i = liste.findIndex((s) => s.id === id);
    if (i >= 0) {
      const j = i + (yon === "yukari" ? -1 : 1);
      if (j < 0 || j >= liste.length) return null;
      const kopya = [...liste];
      [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
      return kopya;
    }
    let degisti = false;
    const kopya = liste.map((s) => {
      if (degisti) return s;
      const alt = kaydir(s.children);
      if (!alt) return s;
      degisti = true;
      return { ...s, children: alt };
    });
    return degisti ? kopya : null;
  };
  return kaydir(sections) ?? [...sections];
}

/**
 * SÜRÜKLE-BIRAK TAŞIMA: bölümü `hedefParentId`in altına verilen sıraya koyar;
 * `hedefParentId` boşsa kök seviyesine alır.
 *
 * BİR BÖLÜM KENDİ ALT AĞACINA TAŞINAMAZ — ağacı ikiye böler ve taşınan dal
 * belgeden sessizce düşerdi. Uygulanamayan taşımada gelen ağaç aynen döner.
 */
export function sectionReorder(
  sections: readonly ManualSection[],
  id: string,
  hedefParentId: string | null,
  index: number
): ManualSection[] {
  const tasinan = sectionFind(sections, id);
  if (!tasinan) return [...sections];
  if (hedefParentId && altAgacKimlikleri(tasinan).has(hedefParentId)) {
    return [...sections];
  }

  const sok = (liste: readonly ManualSection[]): ManualSection[] =>
    liste
      .filter((s) => s.id !== id)
      .map((s) => ({ ...s, children: sok(s.children) }));

  const yerlestir = (liste: readonly ManualSection[]): ManualSection[] => {
    const kopya = [...liste];
    kopya.splice(Math.max(0, Math.min(index, kopya.length)), 0, tasinan);
    return kopya;
  };

  const sokulmus = sok(sections);
  if (!hedefParentId) return yerlestir(sokulmus);
  return sectionUpdate(sokulmus, hedefParentId, (s) => ({
    ...s,
    children: yerlestir(s.children),
  }));
}

// ————————————————————————————————————————————————————————————————— blok

/** Bölümün blok dizisini topluca değiştiren ortak gövde; `null` = değişme yok. */
function bloklariDegistir(
  sections: readonly ManualSection[],
  sectionId: string,
  f: (blocks: readonly ManualBlock[]) => ManualBlock[] | null
): ManualSection[] {
  return sectionUpdate(sections, sectionId, (s) => {
    const yeni = f(s.blocks);
    return yeni ? { ...s, blocks: yeni } : s;
  });
}

export function blockUpdate(
  sections: readonly ManualSection[],
  sectionId: string,
  blockId: string,
  degistir: (b: ManualBlock) => ManualBlock
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) =>
    blocks.map((b) => (b.id === blockId ? degistir(b) : b))
  );
}

/** Bloğu verilen sıraya ekler; sınır dışı sıra uçlara KELEPÇELENİR. */
export function blockInsertAt(
  sections: readonly ManualSection[],
  sectionId: string,
  index: number,
  block: ManualBlock
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) => {
    const kopya = [...blocks];
    kopya.splice(Math.max(0, Math.min(index, kopya.length)), 0, block);
    return kopya;
  });
}

/** Bloğu bölümün SONUNA ekler — blok ekleme şeridinin bugünkü davranışı. */
export function blockAppend(
  sections: readonly ManualSection[],
  sectionId: string,
  block: ManualBlock
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) => [...blocks, block]);
}

export function blockRemove(
  sections: readonly ManualSection[],
  sectionId: string,
  blockId: string
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) =>
    blocks.filter((b) => b.id !== blockId)
  );
}

/** Bloğu bir sıra kaydırır (ok düğmesi); sınırda ağaç değişmez. */
export function blockMove(
  sections: readonly ManualSection[],
  sectionId: string,
  blockId: string,
  yon: Yon
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + (yon === "yukari" ? -1 : 1);
    if (i < 0 || j < 0 || j >= blocks.length) return null;
    const kopya = [...blocks];
    [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
    return kopya;
  });
}

/** SÜRÜKLE-BIRAK: bloğu bölüm içinde verilen sıraya taşır. */
export function blockReorder(
  sections: readonly ManualSection[],
  sectionId: string,
  blockId: string,
  index: number
): ManualSection[] {
  return bloklariDegistir(sections, sectionId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return null;
    const kopya = [...blocks];
    const [blok] = kopya.splice(i, 1);
    kopya.splice(Math.max(0, Math.min(index, kopya.length)), 0, blok);
    return kopya;
  });
}

// ————————————————————————————————————————————— standarda geri dönüş

/**
 * ŞABLONUN anahtar → standart blok haritası.
 *
 * Editörün içinde ikinci bir kopyası vardı ve "Standarda Dön" onu okuyordu.
 * Tek tanım burasıdır: ikisi ayrışsaydı ekrandaki düğme belgeyi şablonun
 * BAŞKA bir sürümüne döndürürdü.
 */
export const TEMPLATE_BLOCKS: ReadonlyMap<string, readonly TemplateBlock[]> = (() => {
  const harita = new Map<string, readonly TemplateBlock[]>();
  const gez = (liste: readonly TemplateSection[]) => {
    for (const s of liste) {
      harita.set(s.key, s.blocks ?? []);
      if (s.children) gez(s.children);
    }
  };
  gez(MANUAL_TEMPLATE);
  return harita;
})();

/**
 * "STANDARDA DÖN" — bloğu şablondaki karşılığına geri alır.
 *
 * EŞLEŞME SIRA + TÜRDÜR: şablon blokları anahtar taşımaz, o yüzden bölümdeki
 * KAÇINCI blok olduğuna bakılır. Kullanıcı araya blok eklediyse sıra kayar;
 * bu yüzden tür de sınanır ve tutmuyorsa HİÇBİR ŞEY YAPILMAZ — yanlış bloğun
 * üstüne şablon metni yazmak, kullanıcının yazdığını sessizce yok etmekti.
 */
export function blockRevertToTemplate(
  sections: readonly ManualSection[],
  sectionId: string,
  blockId: string
): ManualSection[] {
  const bolum = sectionFind(sections, sectionId);
  const sablon = bolum?.key ? TEMPLATE_BLOCKS.get(bolum.key) : undefined;
  if (!bolum || !sablon) return [...sections];

  return bloklariDegistir(sections, sectionId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return null;
    const kaynak = sablon[i];
    if (!kaynak || kaynak.kind !== blocks[i].kind) return null;
    const kopya = [...blocks];
    kopya[i] = {
      ...blocks[i],
      ...(kaynak.text !== undefined ? { text: kaynak.text } : {}),
      ...(kaynak.items !== undefined ? { items: [...kaynak.items] } : {}),
      edited: false,
    } as ManualBlock;
    return kopya;
  });
}
