// ELEKTRİK PROJESİ PDF'İNİN OKUYUCUSU — Node adaptörü.
//
// BU DOSYA ÇEKİRDEĞİN PARÇASI DEĞİLDİR. `parts-list.ts`, `sheet-index.ts`,
// `title-block.ts` ve `rollup.ts` SAFTIR (yalnız veri girer, veri çıkar);
// burası onları `unpdf` ile besleyen tek yerdir ve `nodejs` çalışma zamanı
// ister. Ayrım `drawings/titleblock.ts` ↔ `drawings/[id]/import/route.ts`
// ayrımının aynısıdır — ama okuma iki yerden çağrıldığı için (içtirme ucu ve
// `scripts/test-electrical-read.ts`) route'un içine gömülmedi.
//
// `extractText` DEĞİL `getTextContent`: birincisi düz metin verir ve bu
// belgede düz metin işe yaramaz (bkz. `parts-list.ts` başlığı). İkincisi her
// parçanın DÖNÜŞÜM MATRİSİNİ de verir — dönmüş yazılar ancak oradan elenir.
//
// TEK GEÇİŞ, PARÇALAMA YOK. Ölçüldü: 157 sayfalık 12 MB'lık bir dışa
// aktarımda metin katmanı ~1,2 saniyede okunuyor (20 sayfa 155 ms). Teknik
// resim içtirmesinde parçalama gerekiyordu çünkü orada 450 AYRI DOSYA
// indiriliyor; burada tek dosya var ve baskın maliyet indirmedir.

import { getDocumentProxy } from "unpdf";
import { readPartsList, type PdfSpan } from "./parts-list";
import { isPageListRoot, parseSheetTitle } from "./sheet-index";
import { BOS_KUNYE, readElectricalTitleBlock } from "./title-block";
import type { ElectricalPart, ElectricalRead, ElectricalSheet } from "./types";

/** pdf.js yer imi düğümünün ihtiyacımız olan yüzü. */
interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

/**
 * Yer imi ağacından SAYFA DİZİNİNİ çıkarır.
 *
 * Hedef çözümü (`getPageIndex`) YALNIZ "Page list" kökünün çocukları için
 * yapılır: ağacın tamamı 11.400'den fazla düğüm taşıyor ve hepsini çözmek
 * saniyeler sürerdi. Liste zaten sayfa sırasındadır; hedef çözülemezse sıra
 * numarasına düşülür — dizin eksik değil, yalnız daha az kesin olur.
 */
async function sayfaDizini(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>
): Promise<ElectricalSheet[]> {
  let kokler: OutlineNode[] | null = null;
  try {
    kokler = (await pdf.getOutline()) as OutlineNode[] | null;
  } catch {
    return [];
  }
  if (!kokler) return [];
  const liste = kokler.find((k) => isPageListRoot(k.title ?? ""));
  if (!liste?.items?.length) return [];

  const out: ElectricalSheet[] = [];
  for (let i = 0; i < liste.items.length; i++) {
    const it = liste.items[i];
    let sayfa = i + 1;
    const hedef = Array.isArray(it.dest) ? it.dest[0] : null;
    if (hedef && typeof hedef === "object") {
      try {
        sayfa = (await pdf.getPageIndex(hedef as never)) + 1;
      } catch {
        // Çözülemeyen hedef sıraya düşer.
      }
    }
    out.push(parseSheetTitle(it.title ?? "", sayfa));
  }
  return out.sort((a, b) => a.page - b.page);
}

/** Bir sayfanın DÖNMEMİŞ metin parçaları. */
async function sayfaSpanlari(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  sayfa: number
): Promise<PdfSpan[]> {
  const page = await pdf.getPage(sayfa);
  const tc = await page.getTextContent();
  const spans: PdfSpan[] = [];
  for (const it of tc.items) {
    if (!("str" in it) || it.str === "") continue;
    const t = it.transform as number[];
    // Dönmüş öğe: b ya da c sıfır değil. Tabloya karışmasınlar.
    if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue;
    spans.push({
      text: it.str,
      x: t[4],
      y: t[5],
      w: it.width,
      h: it.height || Math.abs(t[3]) || 1,
    });
  }
  return spans;
}

/** Baytları okunmuş bir elektrik projesine çevirir. */
export async function readElectricalPdf(bytes: Uint8Array): Promise<ElectricalRead> {
  const pdf = await getDocumentProxy(bytes);
  const ustveri = await pdf.getMetadata().catch(() => null);
  const bilgi = (ustveri?.info ?? {}) as {
    Title?: string;
    Author?: string;
    CreationDate?: string;
  };

  const parts: ElectricalPart[] = [];
  const partsPages: number[] = [];
  let kunye = { ...BOS_KUNYE };

  for (let sayfa = 1; sayfa <= pdf.numPages; sayfa++) {
    const spans = await sayfaSpanlari(pdf, sayfa);
    if (sayfa === 1) {
      kunye = readElectricalTitleBlock(spans, {
        title: bilgi.Title,
        author: bilgi.Author,
        // `D:20260707113514+03'00'` → tarih ayrıştırıcısının anlayacağı hâle.
        creationDate: (bilgi.CreationDate ?? "").replace(
          /^D:(\d{4})(\d{2})(\d{2}).*/,
          "$1-$2-$3"
        ),
      });
    }
    const okuma = readPartsList(spans, sayfa);
    if (!okuma.found) continue;
    partsPages.push(sayfa);
    parts.push(...okuma.parts);
  }

  const sheets = await sayfaDizini(pdf);

  // NOT SESSİZ KALMAZ: malzeme listesi bulunamadıysa bu görünür olmalıdır,
  // yoksa boş bir tablo "proje malzeme taşımıyor" diye okunur.
  const notlar: string[] = [];
  if (partsPages.length === 0) notlar.push("MALZEME_LISTESI_BULUNAMADI");
  else if (parts.length === 0) notlar.push("MALZEME_LISTESI_BOS");
  if (sheets.length === 0) notlar.push("SAYFA_DIZINI_YOK");

  return {
    v: 1,
    readAt: new Date().toISOString(),
    pageCount: pdf.numPages,
    titleBlock: kunye,
    sheets,
    parts,
    partsPages,
    note: notlar.join(" "),
  };
}
