// EL KİTABI EDİTÖRÜ — sunucu kabuğu.
//
// KAYNAK VERİSİ SUNUCUDA ÇÖZÜLÜR, editöre HAZIR gelir: otomatik blokların
// tablosunu istemcide üretmek, hesap motorunu ve 726 satırlık malzeme
// listesini tarayıcıya taşımak demekti. Editör yalnız GÖRÜNENİ tutar.
//
// Adres proje detayının DIŞINDA değil ALTINDADIR (`/projects/[id]/manual/...`)
// çünkü el kitabı projenin bir belgesidir; hesap raporu editörünün
// (`revisions/[revId]`) yanında durur ve aynı kırıntı yolunu paylaşır.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import {
  loadManual,
  loadManualImages,
  loadManualRevision,
} from "@/lib/manual/data";
import { MANUAL_LABEL } from "@/lib/manual/naming";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { loadManualSnippets } from "@/lib/manual/books-data";
import { buildManualSourceData } from "../sources-data";
import { loadCustomerBook } from "@/lib/customers/company-server";
import { loadCustomerLogoPreview } from "@/lib/customers/logo-data-url-server";
import { resolveManualIdentity } from "@/lib/manual/identity-server";
import { ManualEditor } from "./manual-editor";

export default async function ManualEditorPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, doc_no, name, customer, crane_type, report_brand_customer_id, jobs:job_id(id, job_no)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const manual = await loadManual(supabase, id);
  const revizyon = await loadManualRevision(supabase, revId);
  if (!manual || !revizyon || revizyon.row.manualId !== manual.id) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canEdit = canEditReports((profil as { role?: string } | null)?.role);

  const [kaynaklar, gorseller, itemNo, parcalar, firmalar, kimlikOnerisi] =
    await Promise.all([
      buildManualSourceData(supabase, id),
      loadManualImages(supabase, revId),
      resolveProjectItemNo(supabase, id, String(project.doc_no ?? "")),
      // METİN PARÇALARI DEFTERİ blok ekleme menüsünde görünür (KITAP-21).
      loadManualSnippets(supabase),
      // FİRMA DEFTERİ ADLARI TAŞIR, BAYT TAŞIMAZ. Yirmi müşterinin logosunu
      // birlikte yüklemek her editör açılışında megabaytlarca veri demekti.
      loadCustomerBook(supabase),
      // Kaynak etiketleri künye alanlarının altında görünür; değer YAZILMAZ,
      // yalnız "bu alan nereden gelir" sorusunu cevaplar.
      resolveManualIdentity(supabase, id, revizyon.row.revNo).catch(() => null),
    ]);

  /*
   * YALNIZ SEÇİLİ FİRMALARIN LOGOSU YÜKLENİR.
   *
   * Üst bandın iki yuvası ve proje Rapor Firması — en çok üç kayıt. Defterin
   * tamamını veri adresine çevirmek editör açılışını gereksiz yere pahalıya
   * getirirdi; seçici zaten yalnız AD gösterir.
   */
  const projectBrandId = String(project.report_brand_customer_id ?? "");
  const logoIcinKimlikler = [
    ...new Set(
      [
        revizyon.payload.partnerLogos.centerCustomerId ?? "",
        revizyon.payload.partnerLogos.rightCustomerId ?? "",
        projectBrandId,
      ].filter(Boolean)
    ),
  ];
  const logoCiftleri = await Promise.all(
    logoIcinKimlikler.map(async (customerId) => {
      const logo = await loadCustomerLogoPreview(supabase, customerId);
      return logo ? ([customerId, logo] as const) : null;
    })
  );
  const firmaLogolari = Object.fromEntries(
    logoCiftleri.filter(
      (pair): pair is readonly [string, { url: string; oran: number }] => pair !== null
    )
  );
  const projectBrandName =
    firmalar.find((firma) => firma.id === projectBrandId)?.name ?? "";

  const job = (project.jobs as unknown as { id: string; job_no: string } | null) ?? null;

  return (
    <div className="grid gap-4">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel={project.name as string}
        title={`${MANUAL_LABEL} · V${revizyon.row.revNo}`}
        hint={project.customer as string}
      />

      {/* KIRINTI YOLU BİR KEZ ÇİZİLİR (MOBIL-13): `PageHeader`ın künyesi
          `xl`den itibaren görünür, bu satır da orada saklanır — ikisi birden
          basılınca aynı yol üst üste iki kez okunuyordu. `xl` altında geri
          oku ve bu satır birlikte bağlamı taşır. */}
      <div className="text-sm text-muted-foreground xl:hidden">
        {job ? (
          <>
            <Link href="/jobs" className="hover:underline">
              İşler
            </Link>
            {" / "}
            <Link href={`/jobs/${job.id}`} className="font-mono hover:underline">
              {job.job_no}
            </Link>
          </>
        ) : (
          <Link href="/projects" className="hover:underline">
            Mühendislik
          </Link>
        )}
        {" / "}
        <Link href={`/projects/${id}`} className="font-mono hover:underline">
          {itemNo || String(project.doc_no ?? "")}
        </Link>
        {" / "}
        <span>El Kitabı V{revizyon.row.revNo}</span>
      </div>

      <ManualEditor
        projectId={id}
        revisionId={revId}
        revNo={revizyon.row.revNo}
        status={revizyon.row.status}
        label={revizyon.row.label}
        initialPayload={revizyon.payload}
        projectTitle={String(project.name ?? "")}
        sources={kaynaklar}
        images={gorseller}
        snippets={parcalar}
        itemNo={itemNo || String(project.doc_no ?? "")}
        canEdit={canEdit}
        identitySources={kimlikOnerisi?.sources ?? {}}
        firmalar={firmalar}
        firmaLogolari={firmaLogolari}
        projectBrandName={projectBrandName}
        projectBrandId={projectBrandId}
      />
    </div>
  );
}
