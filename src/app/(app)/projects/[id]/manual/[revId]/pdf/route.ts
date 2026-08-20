// EL KİTABI İNDİRME UCU.
//
//   (parametresiz) → GÖVDE: kapak, künye, içindekiler, bölümler + ek kapakları
//   ?ekler=1       → TAM SÜRÜM: gövde + eklerin kendisi, kapakların ardında
//
// İKİ ÇIKTI KULLANICI KARARIDIR (19.08.2026). Gövde ekranda okunan, onaya
// giden ve hızlı üretilen belgedir; tam sürüm teslim paketidir ve 12 MB'lık
// elektrik projesiyle birlikte yüz megabaytı bulabilir. Her önizlemede o
// desteyi yeniden üretmek sunucunun süre ve bellek tavanını zorlardı.
//
// EK SIRASI TEK KAYNAKTAN GELİR: `manualAppendixOrder(payload)`. PDF kapakları
// da o sırayla basar; iki yerde yazılsaydı bir ek yanlış kapağın altına düşer
// ve okuyan bunu ancak belgeyi açınca görürdü.
//
// ATLANAN EK SESSİZ KALMAZ: `pdfEkleriYerlestir` okunamayan ekin KAPAĞINI da
// siler (yoksa belge "bundan sonrası şu ektir" der ve başka bir kapak gelir);
// atlananlar yanıt başlığına yazılır.

import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { ManualPdf, manualAppendixOrder, type ManualImageAsset } from "@/lib/pdf/manual";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { pdfEkleriYerlestir } from "@/lib/pdf/merge";
import { getReportSettings } from "@/lib/settings";
import {
  MANUAL_IMAGE_BUCKET,
  loadManual,
  loadManualImages,
  loadManualRevision,
} from "@/lib/manual/data";
import { MANUAL_DOC_TITLE, manualDocCode } from "@/lib/manual/naming";
import { manualAssetsFor } from "@/lib/manual/asset-bytes";
import { manualUsedAssetKeys } from "@/lib/manual/assets";
import { allBlocks } from "@/lib/manual/payload";
import { MANUAL_APPENDIX_LABELS, type ManualAppendixKind } from "@/lib/manual/types";
import { ELECTRICAL_BUCKET, loadCurrentElectricalDoc } from "@/lib/electrical/data";
import { buildElectricalCatalogAppendix } from "@/lib/electrical/catalog-appendix";
import { SPEC_BUCKET, loadCurrentSpec } from "@/lib/project-specs";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { buildManualSourceData } from "../../sources-data";

export const runtime = "nodejs";
/** Tam sürüm yüzlerce sayfa birleştirebilir; gövde saniyeler içinde biter. */
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const eklerIstendi = request.nextUrl.searchParams.get("ekler") === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: proje } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer")
    .eq("id", id)
    .maybeSingle();
  if (!proje) return new Response("Proje bulunamadı", { status: 404 });

  const manual = await loadManual(supabase, id);
  const revizyon = await loadManualRevision(supabase, revId);
  if (!manual || !revizyon || revizyon.row.manualId !== manual.id) {
    return new Response("El kitabı bulunamadı", { status: 404 });
  }

  const [kaynaklar, gorselKayitlari, itemNo, ayarlar] = await Promise.all([
    buildManualSourceData(supabase, id),
    loadManualImages(supabase, revId),
    resolveProjectItemNo(supabase, id, String(proje.doc_no ?? "")),
    getReportSettings(supabase),
  ]);

  // GÖRSEL BAYTLARI PDF'E GİRER, imzalı bağlantı değil: react-pdf sunucuda
  // koşar ve dış bir adrese gitmesi hem yavaş hem kırılgan olurdu.
  const gorseller: ManualImageAsset[] = [];
  for (const g of gorselKayitlari) {
    const { data } = await supabase.storage.from(MANUAL_IMAGE_BUCKET).download(g.storagePath);
    if (!data) continue;
    gorseller.push({
      id: g.id,
      bytes: Buffer.from(await data.arrayBuffer()),
      width: g.width,
      height: g.height,
    });
  }

  // ŞABLON VARLIKLARI REPODAN, yüklenen görseller DEPODAN; ikisi TEK listede
  // birleşir ve çizim ikisini ayırt etmez (bkz. `pdf/manual.tsx`).
  gorseller.push(...manualAssetsFor(manualUsedAssetKeys(allBlocks(revizyon.payload.sections))));

  const payload = revizyon.payload;
  const belgeKodu = manualDocCode(itemNo || String(proje.doc_no ?? ""), revizyon.row.revNo);
  const docLine = [
    "ORION CRANES",
    payload.docTitle || MANUAL_DOC_TITLE,
    `V${revizyon.row.revNo}`,
    String(new Date().getFullYear()),
  ].join(" · ");

  // Tam sürümde eklerin GERÇEK boyu gövde çizilmeden önce bilinir. İçindekiler
  // ancak bu sayılarla sonraki ek kapaklarının nihai sayfasını doğru yazabilir.
  const cozulmusEkler: {
    tur: ManualAppendixKind;
    ad: string;
    bytes: Uint8Array;
    pageCount: number;
    destinations?: Record<string, number>;
    sectionLabel: string;
  }[] = [];
  const oncedenAtlanan: string[] = [];
  if (eklerIstendi) {
    const sira = manualAppendixOrder(payload);
    for (let i = 0; i < sira.length; i++) {
      const tur = sira[i];
      const ad = MANUAL_APPENDIX_LABELS[tur];
      const appendix = await ekBaytlari(supabase, id, revId, tur);
      if (appendix.bytes.byteLength === 0) {
        oncedenAtlanan.push(`${ad} (belge bulunamadı)`);
        continue;
      }
      try {
        const pdf = await PDFDocument.load(appendix.bytes, { updateMetadata: false });
        if (pdf.getPageCount() < 1) throw new Error("belgede sayfa yok");
        cozulmusEkler.push({
          tur,
          ad,
          bytes: appendix.bytes,
          pageCount: pdf.getPageCount(),
          destinations: appendix.destinations,
          sectionLabel: `EK-${String.fromCharCode(65 + i)}`,
        });
      } catch (error) {
        oncedenAtlanan.push(
          `${ad} (${error instanceof Error ? error.message.slice(0, 160) : "okunamadı"})`
        );
      }
    }
  }

  const appendixPageCounts = Object.fromEntries(
    cozulmusEkler.map((appendix) => [appendix.tur, appendix.pageCount])
  ) as Partial<Record<ManualAppendixKind, number>>;

  const govde = await renderToBuffer(
    ManualPdf({
      payload,
      sources: kaynaklar,
      images: gorseller,
      docCode: belgeKodu,
      docLine,
      // Künye HESAP RAPORUYLA AYNI ALANLARDAN kurulur (`pdf/report.tsx`):
      // iki belge aynı firmanın altbilgisini taşımalı ve ayrışmamalı.
      company: {
        company: ayarlar.company,
        address: ayarlar.address || ayarlar.city,
        phone: ayarlar.phone,
        email: ayarlar.email,
        web: ayarlar.web,
      },
      bandLines: [
        `V${revizyon.row.revNo}`,
        new Date(revizyon.row.issuedAt ?? revizyon.row.createdAt).toLocaleDateString("tr-TR"),
      ],
      appendixPageCounts,
      includedAppendices: eklerIstendi ? cozulmusEkler.map((appendix) => appendix.tur) : undefined,
      deferFolio: eklerIstendi,
    })
  );

  let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(govde);
  let atlanan = oncedenAtlanan.length;
  let atlananAd = oncedenAtlanan.join("; ");

  if (eklerIstendi) {
    const ekler = cozulmusEkler.map((appendix) => ({
      ad: appendix.ad,
      bytes: appendix.bytes,
      destinations: appendix.destinations,
      sectionLabel: appendix.sectionLabel,
    }));
    const sonuc = await pdfEkleriYerlestir(bytes, ekler, { finalFolio: true });
    bytes = sonuc.bytes;
    atlanan += sonuc.atlananlar.length;
    atlananAd = [
      atlananAd,
      sonuc.atlananlar.map((a) => `${a.ad} (${a.sebep})`).join("; "),
    ].filter(Boolean).join("; ");
  }

  const ad = downloadFileName(
    [
      proje.name as string,
      belgeKodu,
      payload.docTitle || MANUAL_DOC_TITLE,
      eklerIstendi ? "TAM SÜRÜM" : null,
    ],
    "pdf"
  );

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      // ATLANAN EK GÖRÜNÜR OLMALI: sessiz bir eksik, teslim edilmiş bir
      // pakette ancak müşteri sayarken fark edilirdi.
      ...(atlanan > 0
        ? {
            "X-Atlanan-Ek": String(atlanan),
            "X-Atlanan-Ek-Ayrinti": encodeURIComponent(atlananAd).slice(0, 900),
          }
        : {}),
    },
  });
}

/**
 * Bir ekin baytları.
 *
 * BULUNAMAYAN EK BOŞ DÖNER ve `pdfEkleriYerlestir` onun KAPAĞINI da siler —
 * belgede hiç iz kalmaz. Bir kapak bırakıp arkasını boş geçmek, okuyana
 * olmayan bir eki vaat etmek olurdu.
 *
 * Elektrik katalog eki güncel malzeme listesinin ürün başına en çok 1-2
 * teknik sayfasından derlenir; tam kataloglar yalnız malzeme ekranından açılır.
 */
async function ekBaytlari(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  revisionId: string,
  tur: ManualAppendixKind
): Promise<{ bytes: Uint8Array; destinations?: Record<string, number> }> {
  void revisionId;
  const bos = { bytes: new Uint8Array(0) };

  if (tur === "elektrikProje") {
    const belge = await loadCurrentElectricalDoc(supabase, projectId);
    if (!belge) return bos;
    const { data } = await supabase.storage.from(ELECTRICAL_BUCKET).download(belge.storagePath);
    return data ? { bytes: new Uint8Array(await data.arrayBuffer()) } : bos;
  }

  if (tur === "elektrikKatalog") {
    const appendix = await buildElectricalCatalogAppendix(supabase, projectId);
    return { bytes: appendix.bytes, destinations: appendix.destinations };
  }

  if (tur === "sartname") {
    const spec = await loadCurrentSpec(supabase, projectId);
    // PDF OLMAYAN ŞARTNAME BİRLEŞTİRİLEMEZ (Word/Excel): kaydı durur ve
    // ekranda açılır ama teslim paketine giremez. `pageCount === 0` bunun
    // ölçülmüş işaretidir (bkz. `spec-actions.ts`).
    if (!spec || spec.pageCount === 0) return bos;
    const { data } = await supabase.storage.from(SPEC_BUCKET).download(spec.storagePath);
    return data ? { bytes: new Uint8Array(await data.arrayBuffer()) } : bos;
  }

  if (tur === "mekanikHesap") {
    // HESAP RAPORU PDF'İ YAYIMDA ARŞİVLENİR (`reports` kovası) ve BURADA
    // YENİDEN ÜRETİLMEZ: raporu üretmek hesap motorunu, katalogları ve
    // diyagramları el kitabı indirmesine bağlar ve saniyeler ekler. Arşiv
    // yoksa ek düşer — yayımlanmamış bir hesabın raporu zaten teslim edilecek
    // bir belge değildir.
    //
    // YOL SÖZLEŞMESİ `revisions/[revId]/actions.ts` ile AYNIDIR:
    // `<project_id>/<doc_no>-V<rev_no>.pdf`. Tabloda bir `pdf_path` sütunu
    // YOKTUR; yol iki yerde de aynı biçimden kurulur ve ayrışırsa ek sessizce
    // düşer (kapağıyla birlikte).
    const { data: proje } = await supabase
      .from("projects")
      .select("doc_no")
      .eq("id", projectId)
      .maybeSingle();
    const { data: rev } = await supabase
      .from("revisions")
      .select("rev_no")
      .eq("project_id", projectId)
      .eq("status", "issued")
      .order("rev_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!proje?.doc_no || !rev) return bos;
    const yol = `${projectId}/${String(proje.doc_no)}-V${Number(rev.rev_no)}.pdf`;
    const { data } = await supabase.storage.from("reports").download(yol);
    return data ? { bytes: new Uint8Array(await data.arrayBuffer()) } : bos;
  }

  return bos;
}
