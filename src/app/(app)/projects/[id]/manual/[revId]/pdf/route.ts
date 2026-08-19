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
import { MANUAL_APPENDIX_LABELS, type ManualAppendixKind } from "@/lib/manual/types";
import { ELECTRICAL_BUCKET, loadCurrentElectricalDoc } from "@/lib/electrical/data";
import { SPEC_BUCKET, loadCurrentSpec } from "@/lib/project-specs";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { buildManualSourceData } from "../../sources-data";

export const runtime = "nodejs";
/** Tam sürüm yüzlerce sayfa birleştirebilir; gövde saniyeler içinde biter. */
export const maxDuration = 120;

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

  const payload = revizyon.payload;
  const belgeKodu = manualDocCode(itemNo || String(proje.doc_no ?? ""), revizyon.row.revNo);
  const docLine = [
    "ORION CRANES",
    payload.docTitle || MANUAL_DOC_TITLE,
    `V${revizyon.row.revNo}`,
    String(new Date().getFullYear()),
  ].join(" · ");

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
    })
  );

  let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(govde);
  let atlanan = 0;
  let atlananAd = "";

  if (eklerIstendi) {
    const sira = manualAppendixOrder(payload);
    const ekler: { ad: string; bytes: Uint8Array }[] = [];
    for (const tur of sira) {
      ekler.push({
        ad: MANUAL_APPENDIX_LABELS[tur],
        bytes: await ekBaytlari(supabase, id, revId, tur),
      });
    }
    if (ekler.length > 0) {
      const sonuc = await pdfEkleriYerlestir(bytes, ekler);
      bytes = sonuc.bytes;
      atlanan = sonuc.atlananlar.length;
      atlananAd = sonuc.atlananlar.map((a) => `${a.ad} (${a.sebep})`).join("; ");
    }
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
 * Bugün üç ek gerçekten bağlıdır: elektrik projesi, şartname ve mekanik
 * hesaplar (hesap raporu PDF'i). Ötekiler (mekanik projeler, katalog
 * sayfaları, elektrik hesapları) uygulamada henüz tek bir dosya olarak
 * durmuyor; bağlanana kadar kapakları da düşer.
 */
async function ekBaytlari(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  revisionId: string,
  tur: ManualAppendixKind
): Promise<Uint8Array> {
  void revisionId;
  const bos = new Uint8Array(0);

  if (tur === "elektrikProje") {
    const belge = await loadCurrentElectricalDoc(supabase, projectId);
    if (!belge) return bos;
    const { data } = await supabase.storage.from(ELECTRICAL_BUCKET).download(belge.storagePath);
    return data ? new Uint8Array(await data.arrayBuffer()) : bos;
  }

  if (tur === "sartname") {
    const spec = await loadCurrentSpec(supabase, projectId);
    // PDF OLMAYAN ŞARTNAME BİRLEŞTİRİLEMEZ (Word/Excel): kaydı durur ve
    // ekranda açılır ama teslim paketine giremez. `pageCount === 0` bunun
    // ölçülmüş işaretidir (bkz. `spec-actions.ts`).
    if (!spec || spec.pageCount === 0) return bos;
    const { data } = await supabase.storage.from(SPEC_BUCKET).download(spec.storagePath);
    return data ? new Uint8Array(await data.arrayBuffer()) : bos;
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
    return data ? new Uint8Array(await data.arrayBuffer()) : bos;
  }

  return bos;
}
