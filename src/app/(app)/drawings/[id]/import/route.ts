// Paketin dosyalarını okuyup çözülmüş içeriği yazar.
//
// ÜÇ AŞAMA, TEK UÇ (`?asama=`):
//   excel — BOM Excel'lerinin ham satırları  →  `drawing_bom_rows`
//   pdf   — resim antedi + montaj parça tablosu  →  `drawing_files.meta`
//   dxf   — kesim dosyasının başlığı ve kutusu   →  `drawing_files.meta`
//
// `asama`nın ÖNTANIMI `excel`DİR ve öyle kalmalıdır: yükleme sihirbazı
// (`new/folder-picker.tsx`) bu ucu PARAMETRESİZ çağırıyor. Öntanım değişirse
// yeni bir yükleme sessizce Excel okumadan geçer ve defter boş kalır. Route
// testi olmadığı için bu satır tek koruma.
//
// NEDEN ROUTE HANDLER, SERVER ACTION DEĞİL: `exceljs` ve `unpdf` Node çalışma
// zamanı ister ve iş uzundur (yedi Excel, 171 resim, 99 DXF; hepsi depodan
// indirilir). Route handler evin ağır Node işleri için zaten kullandığı yol.
//
// PARÇALI ÇALIŞIR (`?ofset=&adet=`): dağıtımın süre tavanı ne olursa olsun bir
// istek onu aşmasın ve yarıda kalan bir okuma AYNI OFSETTEN sürdürülebilsin.
// Baskın maliyet AYRIŞTIRMA DEĞİL İNDİRMEDİR (ölçüldü: PDF 43 ms/dosya
// ayrıştırma ama ortalama 585 KB indirme), bu yüzden parça boyu aşamaya göre
// ayarlıdır.
//
// BOZUK TEK DOSYA BÜTÜN İÇTİRMEYİ DÜŞÜRMEZ: atlanır, sebebi `okunamayan`a
// yazılır, döngü sürer.

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { parseBomFileName } from "@/lib/drawings/file-name";
import { readSheet } from "@/lib/drawings/excel";
import {
  readSheetBom,
  readTitleBlock,
  type SheetBomRow,
  type TextSpan,
  type TitleBlock,
} from "@/lib/drawings/titleblock";
import { readDxfBytes, type DxfHeader } from "@/lib/drawings/dxf-header";

export const runtime = "nodejs";

const BUCKET = "drawings";

/** Aşama başına bir çağrıda işlenecek dosya sayısı. */
const VARSAYILAN_ADET: Record<Asama, number> = { excel: 10, pdf: 20, dxf: 25 };

type Asama = "excel" | "pdf" | "dxf";

/** `drawing_files.meta` sözleşmesi. Sürüm alanı ileride göç için gerekli. */
interface FileContentMeta {
  v: 1;
  readAt: string;
  kind: "pdf" | "dxf";
  recognizedBy: string;
  note: string;
  pages?: number;
  author?: string;
  producer?: string;
  labelsFound?: number;
  labelsTotal?: number;
  titleBlock?: TitleBlock;
  sheetBom?: SheetBomRow[];
  dxf?: DxfHeader;
  /** Bu meta başka bir dosyadan KOPYALANDIYSA kaynağın yolu */
  copiedFrom?: string;
}

interface DosyaSatiri {
  id: string;
  rel_path: string;
  file_name: string;
  storage_path: string;
  checksum: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditDrawings(profile?.role)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const url = new URL(request.url);
  const asamaHam = (url.searchParams.get("asama") ?? "excel").toLowerCase();
  const asama: Asama = asamaHam === "pdf" || asamaHam === "dxf" ? asamaHam : "excel";
  const ofset = Math.max(0, Number(url.searchParams.get("ofset") ?? 0) || 0);
  const adet = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("adet") ?? VARSAYILAN_ADET[asama]))
  );

  // Sıra KARARLI olsun diye yola göre: parçalı okuma ancak sıralama iki çağrı
  // arasında değişmezse aynı ofsetten sürdürülebilir.
  let sorgu = supabase
    .from("drawing_files")
    .select("id, rel_path, file_name, storage_path, checksum")
    .eq("package_id", packageId)
    .order("rel_path");

  // DEPODA OLAN ya da BİLEREK ATLANMIŞ satırlar okunabilir.
  //
  // Atlanmış bir satır (bayt bayt kopya) KENDİ nesnesini taşımaz ama
  // `storage_path`i ASLININKİNİ gösterir; dışarıda bırakılsaydı içerik
  // aşaması onun imza grubuna hiç girmez ve o dosyaya `meta` yazılmazdı.
  // Süzgeç dışında kalması gereken tek şey GERÇEKTEN ULAŞMAMIŞ dosyadır —
  // onu indirmeye çalışmak `okunamayan`ı sahte hatalarla doldururdu.
  const DEPODA = "stored.is.true,upload_skipped.is.true";

  if (asama === "excel") {
    // Excel de aynı süzgeci alır: eskiden almıyordu ve depoya ulaşmamış bir
    // BOM dosyası her turda indirilmeye çalışılıp `okunamayan`a düşüyordu.
    //
    // `haric` SÜZGECİ BURAYA DA KONDU (15.08.2026): ofis kilit dosyası
    // (`~$…xlsx`) bir BOM rolü taşıyor ama içi zip değildir; PDF ve kesim
    // aşamalarında zaten olan süzgeç Excel dalında eksikti.
    sorgu = sorgu.eq("role", "bom").or(DEPODA).not("lifecycle", "eq", "haric");
  } else if (asama === "pdf") {
    // BÜKÜM klasöründeki PDF'ler de resimdir; `haric` olanlar deftere
    // girmediği için okunmaz da.
    sorgu = sorgu.in("role", ["resim", "bukum"]).or(DEPODA).not("lifecycle", "eq", "haric");
  } else {
    sorgu = sorgu.eq("role", "kesim").or(DEPODA).not("lifecycle", "eq", "haric");
  }

  const { data: hepsi, error: listeHatasi } = await sorgu;
  if (listeHatasi) {
    return NextResponse.json({ error: listeHatasi.message }, { status: 500 });
  }

  const dosyalar = (hepsi ?? []) as DosyaSatiri[];

  if (asama === "excel") {
    return excelAsamasi(supabase, packageId, dosyalar, ofset, adet);
  }
  return icerikAsamasi(supabase, packageId, dosyalar, ofset, adet, asama);
}

/* -------------------------------------------------------------- excel ---- */

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function excelAsamasi(
  supabase: Supabase,
  packageId: string,
  hepsi: DosyaSatiri[],
  ofset: number,
  adet: number
) {
  const toplam = hepsi.length;
  const dilim = hepsi.slice(ofset, ofset + adet);

  let yazilanSatir = 0;
  const okunamayan: { file: string; reason: string }[] = [];

  for (const dosya of dilim) {
    // OFİS KİLİT DOSYASI SESSİZCE ATLANIR — `okunamayan`a bile girmez.
    //
    // `file-name.ts` artık onu `haric` işaretliyor ve yeni yüklemelerde depoya
    // hiç gitmiyor; ama DAHA ÖNCE yüklenmiş paketlerin satırları `canli`
    // damgasını taşıyor ve bir migration'la düzeltmeye değmez. Ad kuralı
    // burada da sorulur: `~$` ile başlayan bir dosya bir belge değildir,
    // okunamaması bir arıza değil beklenen davranıştır.
    if (/^~\$/.test(dosya.file_name ?? "")) continue;

    const yol = dosya.storage_path || "";
    if (!yol) {
      okunamayan.push({ file: dosya.rel_path, reason: "depo yolu yok" });
      continue;
    }

    const { data: blob, error: indirmeHatasi } = await supabase.storage.from(BUCKET).download(yol);
    if (indirmeHatasi || !blob) {
      okunamayan.push({
        file: dosya.rel_path,
        reason: indirmeHatasi?.message ?? "indirilemedi",
      });
      continue;
    }

    let workbook: ExcelJS.Workbook;
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      workbook = new ExcelJS.Workbook();
      // exceljs kendi `Buffer` bildirimini taşıyor ve @types/node'un jenerik
      // `Buffer<ArrayBuffer>`ıyla yapısal olarak uyuşmuyor. Çalışma zamanında
      // ikisi aynı nesne; dönüştürme yalnız tip katmanındadır.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch (e) {
      // Bozuk bir Excel BÜTÜN içe aktarmayı düşürmez: o dosya atlanır, sebebi
      // yazılır, kalanlar okunur.
      okunamayan.push({
        file: dosya.rel_path,
        reason: e instanceof Error ? e.message : "okunamadı",
      });
      continue;
    }

    const tur = parseBomFileName(dosya.file_name).kind;

    // Aynı dosya ikinci kez okunursa satırlar çiftlenmesin.
    await supabase.from("drawing_bom_rows").delete().eq("file_id", dosya.id);

    for (const ws of workbook.worksheets) {
      // exceljs 1 tabanlı ve seyrek; sütunlar `values[1..n]` içinde durur.
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const degerler = row.values as unknown[];
        const satir: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) {
          satir.push(hucreMetni(degerler?.[c]));
        }
        rows.push(satir);
      });

      const okuma = readSheet({ fileRelPath: dosya.rel_path, sheetName: ws.name, rows }, tur);
      if (okuma.rows.length === 0) continue;

      const kayitlar = okuma.rows.map((r) => ({
        package_id: packageId,
        file_id: dosya.id,
        sheet_name: r.sheetName,
        source_kind: r.sourceKind,
        row_no: r.rowNo,
        item_path: r.itemPath,
        part_number: r.partNumber,
        bom_structure: r.bomStructure,
        description: r.description,
        title: r.title,
        material_raw: r.materialRaw,
        item_qty_raw: r.itemQtyRaw,
        qty_raw: r.qtyRaw,
        category: r.category,
        mass_raw: r.massRaw,
        rev_raw: r.revRaw,
        extra: r.extra,
      }));

      for (let i = 0; i < kayitlar.length; i += 300) {
        const { error } = await supabase
          .from("drawing_bom_rows")
          .insert(kayitlar.slice(i, i + 300));
        if (error) {
          okunamayan.push({ file: `${dosya.rel_path}#${ws.name}`, reason: error.message });
          break;
        }
        yazilanSatir += kayitlar.slice(i, i + 300).length;
      }
    }
  }

  const sonrakiOfset = ofset + dilim.length;
  const kalan = Math.max(0, toplam - sonrakiOfset);
  // BOŞ İŞ KÜMESİ DAMGALANMAZ. `parsed_at` "bu paketin içeriği okundu" demektir;
  // okunacak hiçbir dosya bulunmadığında onu yazmak, hiç okunmamış bir paketi
  // okunmuş göstermekti.
  if (kalan === 0 && toplam > 0) await damgala(supabase, packageId);

  return NextResponse.json({
    toplam,
    // BOŞ İŞ KÜMESİ İLE BAŞARI AYNI YANIT DEĞİLDİR. İkisi de `{kalan: 0}`
    // döndüğü için istemci "yedi Excel okudum" ile "hiç Excel yoktu"yu ayırt
    // edemiyordu — ve depoya hiç ulaşmamış bir paket tam olarak ikincisi gibi
    // görünüyordu.
    bos: toplam === 0,
    islenen: dilim.length,
    yazilanSatir,
    kalan,
    sonraki: kalan > 0 ? sonrakiOfset : null,
    okunamayan,
  });
}

/* ------------------------------------------------------- pdf ve dxf ------ */

/**
 * İçerik aşaması: dosyayı indir, ayrıştır, sonucu `meta` jsonb'sine yaz.
 *
 * AYNI İÇERİK İKİ KEZ İNDİRİLMEZ. BÜKÜM klasöründeki PDF'ler `DWG\` altındaki
 * eşlerinin BAYT BAYT AYNISI ve `checksum` bunu zaten biliyor. İş listesi bu
 * yüzden dosyalardan değil TEKİL İMZALARDAN kurulur; okunan meta aynı imzayı
 * taşıyan bütün dosyalara yazılır. Ölçüldü: MTC'de ~13 indirme boşa gitmiyor.
 */
async function icerikAsamasi(
  supabase: Supabase,
  packageId: string,
  hepsi: DosyaSatiri[],
  ofset: number,
  adet: number,
  asama: "pdf" | "dxf"
) {
  // İmza → aynı içeriği taşıyan bütün dosyalar. İmzası boş olan dosya kendi
  // başınadır (imzasızları tek gruba toplamak farklı içerikleri birleştirirdi).
  const gruplar = new Map<string, DosyaSatiri[]>();
  for (const d of hepsi) {
    const anahtar = d.checksum ? `s:${d.checksum}` : `i:${d.id}`;
    const g = gruplar.get(anahtar);
    if (g) g.push(d);
    else gruplar.set(anahtar, [d]);
  }
  const temsilciler = [...gruplar.values()];

  const toplam = temsilciler.length;
  const dilim = temsilciler.slice(ofset, ofset + adet);

  let yazilanDosya = 0;
  const okunamayan: { file: string; reason: string }[] = [];

  for (const grup of dilim) {
    const dosya = grup[0];
    const yol = dosya.storage_path || "";
    if (!yol) {
      okunamayan.push({ file: dosya.rel_path, reason: "depo yolu yok" });
      continue;
    }

    const { data: blob, error: indirmeHatasi } = await supabase.storage.from(BUCKET).download(yol);
    if (indirmeHatasi || !blob) {
      okunamayan.push({
        file: dosya.rel_path,
        reason: indirmeHatasi?.message ?? "indirilemedi",
      });
      continue;
    }

    let meta: FileContentMeta;
    try {
      const bayt = new Uint8Array(await blob.arrayBuffer());
      meta = asama === "pdf" ? await pdfOku(bayt) : dxfOku(bayt);
    } catch (e) {
      okunamayan.push({
        file: dosya.rel_path,
        reason: e instanceof Error ? e.message : "okunamadı",
      });
      continue;
    }

    for (const hedef of grup) {
      const { error } = await supabase
        .from("drawing_files")
        .update({
          meta: hedef === dosya ? meta : { ...meta, copiedFrom: dosya.rel_path },
        })
        .eq("id", hedef.id);
      if (error) okunamayan.push({ file: hedef.rel_path, reason: error.message });
      else yazilanDosya++;
    }
  }

  const sonrakiOfset = ofset + dilim.length;
  const kalan = Math.max(0, toplam - sonrakiOfset);
  if (kalan === 0 && toplam > 0) await damgala(supabase, packageId);

  return NextResponse.json({
    asama,
    toplam,
    bos: toplam === 0,
    islenen: dilim.length,
    yazilanDosya,
    kalan,
    sonraki: kalan > 0 ? sonrakiOfset : null,
    okunamayan,
  });
}

/**
 * PDF'ten span modeli kurar ve anteti + montaj tablosunu okur.
 *
 * `extractText` DEĞİL `getTextContent` kullanılır: birincisi düz metin verir ve
 * antette düz metin işe yaramaz (etiketle değer aynı satırda karışıyor).
 * İkincisi her parçanın DÖNÜŞÜM MATRİSİNİ de verir — dönmüş ölçü yazıları
 * ancak oradan elenebiliyor (sayfa başına ortalama ~47 dönmüş öğe var ve
 * `extractTextItems` onları düz gibi gösteriyor).
 */
async function pdfOku(bayt: Uint8Array): Promise<FileContentMeta> {
  const pdf = await getDocumentProxy(bayt);
  const ustveri = await pdf.getMetadata().catch(() => null);
  const bilgi = (ustveri?.info ?? {}) as { Author?: string; Producer?: string };

  let antet: ReturnType<typeof readTitleBlock> | null = null;
  const sheetBom: SheetBomRow[] = [];

  for (let sayfa = 1; sayfa <= pdf.numPages; sayfa++) {
    const page = await pdf.getPage(sayfa);
    const tc = await page.getTextContent();
    const spans: TextSpan[] = [];
    for (const it of tc.items) {
      if (!("str" in it) || it.str === "") continue;
      const t = it.transform as number[];
      // Dönmüş öğe: b ya da c sıfır değil. Antete karışmasınlar.
      if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue;
      spans.push({
        text: it.str,
        x: t[4],
        y: t[5],
        w: it.width,
        h: it.height || Math.abs(t[3]) || 1,
      });
    }

    // Antet İLK TANINAN sayfadan alınır: çok sayfalı bir sette ilk sayfanın
    // antedi boş olabilir, ama hepsi aynı resmin sayfalarıdır.
    const okuma = readTitleBlock(spans);
    if (!antet || (antet.labelsFound < 5 && okuma.labelsFound >= 5)) antet = okuma;

    // Tablo HER SAYFADAN okunur ve hangi sayfadan geldiği saklanır: montaj
    // listesi uzun olduğunda ikinci sayfaya taşıyor.
    sheetBom.push(...readSheetBom(spans, sayfa));
  }

  return {
    v: 1,
    readAt: new Date().toISOString(),
    kind: "pdf",
    recognizedBy: antet?.recognizedBy ?? "",
    // Şablonu tanıyamamak bir HATA DEĞİL, kapsam kaybıdır — ama görünür olsun.
    note: antet && antet.recognizedBy ? "" : "ANTET_TANINMADI",
    pages: pdf.numPages,
    author: bilgi.Author ?? "",
    producer: bilgi.Producer ?? "",
    labelsFound: antet?.labelsFound ?? 0,
    labelsTotal: antet?.labelsTotal ?? 0,
    titleBlock: antet?.titleBlock,
    sheetBom,
  };
}

function dxfOku(bayt: Uint8Array): FileContentMeta {
  const dxf = readDxfBytes(bayt);
  return {
    v: 1,
    readAt: new Date().toISOString(),
    kind: "dxf",
    recognizedBy: dxf.version ? "dxf-header-v1" : "",
    note: dxf.note,
    dxf,
  };
}

/* ------------------------------------------------------------ ortak ------ */

async function damgala(supabase: Supabase, packageId: string) {
  await supabase
    .from("drawing_packages")
    .update({ parsed_at: new Date().toISOString() })
    .eq("id", packageId);
}

/**
 * Hücreyi metne çevirir.
 *
 * Hiçbir şey sayıya ZORLANMAZ: `QTY` sütunu çoğu satırda tam sayı ama
 * `Category = Testere` satırlarında bir kesim boyudur ("169,3 mm"). Ham metni
 * saklamak, o bilgiyi kaybetmemenin tek yolu.
 */
function hucreMetni(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Formül hücresi: sonucu; zengin metin: parçaların birleşimi; köprü: metni.
    if ("result" in o) return hucreMetni(o.result);
    if ("text" in o) return hucreMetni(o.text);
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
    }
    if ("hyperlink" in o) return hucreMetni(o.hyperlink);
  }
  return String(v).trim();
}
