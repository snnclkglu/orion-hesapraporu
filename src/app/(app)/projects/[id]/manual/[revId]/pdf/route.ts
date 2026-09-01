// EL KİTABI İNDİRME UCU.
//
//   (parametresiz) → GÖVDE: kapak, künye, içindekiler ve işletme bölümleri
//   ?ekler=1       → TAM SÜRÜM: gövde + bulunan ek kapakları + eklerin kendisi
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
import { pdfBirlestir, pdfEkleriYerlestir } from "@/lib/pdf/merge";
import { trKatla } from "@/lib/drawings/tr-text";
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
import { manualAppendixOption } from "@/lib/manual/packages";
import { MANUAL_APPENDIX_LABELS, type ManualAppendixKind } from "@/lib/manual/types";
import { ELECTRICAL_BUCKET, loadCurrentElectricalDoc } from "@/lib/electrical/data";
import { buildElectricalCatalogAppendix } from "@/lib/electrical/catalog-appendix";
import { SPEC_BUCKET, loadCurrentSpec } from "@/lib/project-specs";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { loadReportCoverIdentity } from "@/lib/report-cover-identity-server";
import { loadCustomerLogo } from "@/lib/customers/logo-server";
import { documentMonthLabel, renderReportPdf } from "@/lib/pdf/report";
import { runCalc } from "@/lib/calc/engine";
import {
  altsFromRevision,
  calcInputFromRevision,
  hiddenDiagramsFromRevision,
  hiddenSectionsFromRevision,
  sectionNotesFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
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
    .select("id, doc_no, name, customer, crane_location, report_brand_customer_id, end_customer_id, prepared_by, checked_by, checked_by_name")
    .eq("id", id)
    .maybeSingle();
  if (!proje) return new Response("Proje bulunamadı", { status: 404 });

  const manual = await loadManual(supabase, id);
  const revizyon = await loadManualRevision(supabase, revId);
  if (!manual || !revizyon || revizyon.row.manualId !== manual.id) {
    return new Response("El kitabı bulunamadı", { status: 404 });
  }

  const signatoryIds = [proje.prepared_by, proje.checked_by].filter(
    (value): value is string => Boolean(value)
  );
  const { data: signatoryProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", signatoryIds);
  const nameOf = (id: string | null | undefined) =>
    (signatoryProfiles ?? []).find((profile) => profile.id === id)?.full_name || "";

  /*
   * ÜST BANDIN FİRMALARI ÜÇ BASAMAKTAN ÇÖZÜLÜR (01.09.2026).
   *
   * KÜNYEDE SEÇİLEN FİRMA > PROJE RAPOR FİRMASI > ELLE YÜKLENMİŞ GÖRSEL.
   * Ortadaki basamak KITAP-18'in kuralıdır ve bozulmadı; kullanıcı Künye
   * sekmesinden başka bir firma seçtiyse o kılavuzda onun sözü geçer. Seçim
   * yoksa hiçbir şey değişmez — eski kılavuzlar birebir aynı basılır.
   */
  const kunyeOrtaFirma = String(revizyon.payload.partnerLogos.centerCustomerId ?? "");
  const kunyeSagFirma = String(revizyon.payload.partnerLogos.rightCustomerId ?? "");

  const [kaynaklar, gorselKayitlari, itemNo, ayarlar, coverIdentity, sagFirmaLogosu] =
    await Promise.all([
      buildManualSourceData(supabase, id),
      loadManualImages(supabase, revId),
      resolveProjectItemNo(supabase, id, String(proje.doc_no ?? "")),
      getReportSettings(supabase),
      loadReportCoverIdentity(
        supabase,
        kunyeOrtaFirma || proje.report_brand_customer_id,
        proje.end_customer_id
      ),
      loadCustomerLogo(supabase, kunyeSagFirma || null),
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
      // EKİN BİÇİMİ KAPSAM PAKETİNDEN GELİR (KITAP-20): ekin girip girmemesi
      // `section.hidden`dır ve zaten `manualAppendixOrder`da çözüldü; buradaki
      // yalnız "girecekse hangi biçimde"dir.
      const appendix = await ekBaytlari(
        supabase,
        id,
        revId,
        tur,
        manualAppendixOption(payload, tur)
      );
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
      partner: coverIdentity.reportBrand,
      rightPartnerLogo: sagFirmaLogosu,
      projectTitle: String(proje.name ?? ""),
      craneLocation: String(proje.crane_location ?? ""),
      coverSpecs: kaynaklar.coverSpecs,
      endCustomerLogo: coverIdentity.endCustomerLogo,
      coverMeta: {
        customer: String(proje.customer ?? ""),
        date: documentMonthLabel(revizyon.row.issuedAt ?? revizyon.row.createdAt),
        preparedBy: nameOf(proje.prepared_by) || revizyon.row.createdByName || "—",
        checkedBy: String(proje.checked_by_name ?? "").trim() || nameOf(proje.checked_by) || "—",
        revision: `R${String(revizyon.row.revNo).padStart(2, "0")}`,
      },
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
      includedAppendices: eklerIstendi ? cozulmusEkler.map((appendix) => appendix.tur) : [],
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
/**
 * HESAP RAPORUNU TALEP ANINDA ÜRETİR — kapsam paketi ÖZET ya da STANDART
 * istediğinde.
 *
 * Arşiv yalnız DETAYLI raporu saklar; öteki iki seviye için ya seviye başına
 * ayrı arşiv tutulacaktı (depoyu üçe katlar ve arşiv sözleşmesini el kitabına
 * bulaştırırdı) ya da rapor burada üretilecekti. İkincisi seçildi: bedel
 * birkaç saniyedir ve yalnız TAM SÜRÜM indirilirken ödenir.
 *
 * ÜRETİM YAYIMLANMIŞ REVİZYONDAN OKUNUR: teslim edilen kılavuz teslim edilen
 * hesabı anlatır. Yayımlanmış revizyon yoksa ek DÜŞER (kapağıyla birlikte) —
 * yayımlanmamış bir hesabın raporu zaten teslim edilecek bir belge değildir.
 */
async function raporUret(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  level: "ozet" | "standart" | "detayli"
): Promise<Uint8Array> {
  const bos = new Uint8Array(0);
  const { data: proje } = await supabase
    .from("projects")
    .select(
      "doc_no, name, customer, crane_type, crane_location, report_brand_customer_id, end_customer_id, prepared_by, checked_by, checked_by_name"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!proje) return bos;

  const { data: rev } = await supabase
    .from("revisions")
    .select("rev_no, label, issued_at, updated_at, inputs, selections")
    .eq("project_id", projectId)
    .eq("status", "issued")
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rev) return bos;

  const imzaKimlikleri = [proje.prepared_by, proje.checked_by].filter(
    (v): v is string => Boolean(v)
  );
  const { data: imzalar } = imzaKimlikleri.length
    ? await supabase.from("profiles").select("id, full_name").in("id", imzaKimlikleri)
    : { data: [] as { id: string; full_name: string | null }[] };
  const adi = (id: string | null | undefined) =>
    (imzalar ?? []).find((k) => k.id === id)?.full_name ?? "";

  const input = calcInputFromRevision(
    rev.inputs as RevisionInputsJson,
    rev.selections as RevisionSelectionsJson
  );
  const result = runCalc(input);
  const [ayarlar, kimlik] = await Promise.all([
    getReportSettings(supabase),
    loadReportCoverIdentity(supabase, proje.report_brand_customer_id, proje.end_customer_id),
  ]);

  try {
    const buffer = await renderReportPdf({
      settings: ayarlar,
      project: proje,
      revision: {
        rev_no: rev.rev_no,
        label: rev.label,
        issued_at: rev.issued_at,
        updated_at: rev.updated_at,
      },
      preparedBy: adi(proje.prepared_by) || "—",
      checkedBy: String(proje.checked_by_name ?? "").trim() || adi(proje.checked_by) || "—",
      reportBrand: kimlik.reportBrand,
      endCustomerLogo: kimlik.endCustomerLogo,
      input,
      result,
      level,
      alts: altsFromRevision(rev.selections as RevisionSelectionsJson),
      sectionNotes: sectionNotesFromRevision(rev.selections as RevisionSelectionsJson),
      hiddenSections: hiddenSectionsFromRevision(rev.inputs as RevisionInputsJson),
      hiddenDiagrams: hiddenDiagramsFromRevision(rev.inputs as RevisionInputsJson),
    });
    return new Uint8Array(buffer);
  } catch {
    // ÜRETİM DÜŞERSE EK DÜŞER, BELGE DÜŞMEZ: atlanan ek zaten yanıt başlığına
    // yazılır ve kapağı da silinir (KITAP-8).
    return bos;
  }
}

/**
 * Ekin baytları.
 *
 * `option` KAPSAM PAKETİNİN verdiği biçim ayarıdır (KITAP-20):
 *   `mekanikHesap`    → rapor seviyesi (`ozet` · `standart` · `detayli`)
 *   `elektrikKatalog` → ürün başına teknik föy sayısı
 * Öteki eklerde karşılığı yoktur ve yok sayılır.
 */
async function ekBaytlari(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  revisionId: string,
  tur: ManualAppendixKind,
  option?: string
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
    // KITAP-17 GÜNCELLENDİ: "en çok iki teknik sayfa" artık kapsam paketinin
    // verdiği sayıdır; öntanım yine ikidir. Tanınmayan bir değer öntanıma
    // düşer — bozuk bir ayar yüzünden ekin hiç basılmaması, iki föyle
    // basılmasından kötüdür.
    const foySayisi = Number(option);
    const appendix = await buildElectricalCatalogAppendix(supabase, projectId, {
      ...(Number.isFinite(foySayisi) && foySayisi >= 1 && foySayisi <= 10
        ? { maxPagesPerDocument: foySayisi }
        : {}),
    });
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

  if (tur === "mekanikProje") {
    // BUGÜNE KADAR BAĞLI DEĞİLDİ ve kapağı da düşüyordu (KITAP-8). Artık
    // Teknik Resim Takibi'nin CANLI paketlerindeki PDF paftaları birleşir.
    //
    // ÖNTANIM "GENEL MONTAJ"DIR, TÜMÜ DEĞİL: bir iş paketinde yüzlerce imalat
    // paftası olabilir ve hepsini teslim kılavuzuna koymak, müşteriye imalat
    // dosyasını göndermek olurdu. Kapsam paketi `tumu` derse hepsi girer.
    const tumu = option === "tumu";
    const { data: paketler } = await supabase
      .from("drawing_packages")
      .select("id, rev_no, status")
      .eq("project_id", projectId)
      .neq("status", "superse")
      .order("rev_no", { ascending: false });
    const paketKimlikleri = (paketler ?? []).map((p) => String(p.id));
    if (paketKimlikleri.length === 0) return bos;

    const { data: dosyalar } = await supabase
      .from("drawing_files")
      .select("id, file_name, storage_path")
      .in("package_id", paketKimlikleri)
      .eq("stored", true)
      .eq("lifecycle", "canli")
      .ilike("file_name", "%.pdf")
      .order("file_name", { ascending: true });

    const secilenler = (dosyalar ?? []).filter((d) =>
      tumu ? true : /GENEL\s*MONTAJ|GENERAL\s*ARRANGEMENT/i.test(trKatla(String(d.file_name)))
    );
    if (secilenler.length === 0) return bos;

    const parcalar: { ad: string; bytes: Uint8Array }[] = [];
    for (const d of secilenler) {
      const { data } = await supabase.storage.from("drawings").download(String(d.storage_path));
      if (!data) continue;
      parcalar.push({
        ad: String(d.file_name),
        bytes: new Uint8Array(await data.arrayBuffer()),
      });
    }
    if (parcalar.length === 0) return bos;
    // AÇILAMAYAN PAFTA BÜTÜN EKİ DÜŞÜRMEZ: `pdfBirlestir` atlananı bildirir ve
    // geri kalanı birleştirir.
    const birlesik = await pdfBirlestir(parcalar);
    return { bytes: birlesik.bytes };
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

    // ARŞİV HER ZAMAN "detayli"DİR (`revisions/[revId]/actions.ts`: "yayın
    // arşivi her zaman tam (detaylı) rapor saklar"). Kapsam paketi ÖZET ya da
    // STANDART istiyorsa arşiv bunu veremez ve rapor TALEP ANINDA üretilir.
    //
    // SEVİYE BAŞINA AYRI ARŞİV ÜRETİLMEZ: depoyu üçe katlar ve arşiv
    // sözleşmesi hesap raporuna aittir, el kitabına değil. Bedel birkaç
    // saniyedir ve YALNIZ TAM SÜRÜM indirilirken ödenir (`maxDuration = 300`).
    const seviye = (["ozet", "standart", "detayli"] as const).includes(
      option as "ozet" | "standart" | "detayli"
    )
      ? (option as "ozet" | "standart" | "detayli")
      : "detayli";

    if (seviye === "detayli") {
      const yol = `${projectId}/${String(proje.doc_no)}-V${Number(rev.rev_no)}.pdf`;
      const { data } = await supabase.storage.from("reports").download(yol);
      return data ? { bytes: new Uint8Array(await data.arrayBuffer()) } : bos;
    }

    return { bytes: await raporUret(supabase, projectId, seviye) };
  }

  return bos;
}
