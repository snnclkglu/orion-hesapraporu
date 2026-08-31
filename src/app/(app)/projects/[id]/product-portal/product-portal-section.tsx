import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadCustomerLogoDataUrl } from "@/lib/customers/logo-data-url-server";
import { customerPortalDtoForPreview } from "@/lib/product-portal/access-server";
import { loadProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import type { ProductPortalFileDto } from "@/lib/product-portal/types";
import { ProductPortalCard } from "./product-portal-card";

function validPortalOrigin(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((url.pathname && url.pathname !== "/") || url.search || url.hash) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/*
 * QR'A GÖMÜLEN ADRES BİR DAHA DEĞİŞTİRİLEMEZ.
 *
 * Plaka metale kazınır ve vincin üzerinde on yıl durur. Adres BASKI ANINDA
 * gömülür; uygulama bir gün başka bir alan adına taşınırsa ya da bu plaka bir
 * önizleme ortamından basılmışsa, sahadaki QR sonsuza kadar ölü bir adrese
 * bakar. Bunu geri almanın yolu YOKTUR — plakayı sökmek gerekir.
 *
 * Bu yüzden kaynak sırası ters çevrildi: ÖNCE açıkça yapılandırılmış kalıcı
 * adres (`CUSTOMER_PORTAL_ORIGIN`), sonra dağıtımın üretim adresi. İstek
 * başlığından türetme yalnız GELİŞTİRMEDE kalır ve o durumda plaka indirmesi
 * kartta ENGELLENİR (`readiness`), yani localhost adresli bir plaka basılamaz.
 *
 * Yönlendirme katmanı: adres `/qr/<kod>` ucuna bakar, o da portala yönlendirir.
 * Portal yolu bir gün değişirse yalnız o uç güncellenir; basılmış plakalar
 * çalışmaya devam eder.
 */
export const PORTAL_ORIGIN_ENV = "CUSTOMER_PORTAL_ORIGIN";

async function portalOrigin(): Promise<{ origin: string; permanent: boolean }> {
  const configured = validPortalOrigin(
    process.env.CUSTOMER_PORTAL_ORIGIN
      ?? process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_ORIGIN
  );
  if (configured) return { origin: configured, permanent: true };

  const production = validPortalOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return { origin: production, permanent: true };

  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const proto = (requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https"))
    .split(",")[0]
    .trim();
  return {
    origin: validPortalOrigin(`${proto}://${host}`) ?? "http://localhost:3000",
    // İstekten türetilmiş adres KALICI SAYILMAZ: önizleme dağıtımı, geçici
    // alan adı ya da localhost olabilir.
    permanent: false,
  };
}
export async function ProductPortalSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const [workspace, portalOriginInfo, { data: logoProject }] = await Promise.all([
    loadProductPortalWorkspace(supabase, projectId),
    portalOrigin(),
    supabase
      .from("projects")
      .select("end_customer_id")
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  const customerLogoDataUrl = await loadCustomerLogoDataUrl(
    supabase,
    logoProject?.end_customer_id
  );
  if (!workspace) {
    return (
      <ProductPortalCard
        projectId={projectId}
        canEdit={canEdit}
        workspace={null}
        portalOrigin={portalOriginInfo.origin}
        portalOriginPermanent={portalOriginInfo.permanent}
        customerLogoDataUrl={customerLogoDataUrl}
        draftPreview={null}
        publishedPreview={null}
      />
    );
  }

  const displayRevision = workspace.editableRevision
    ?? workspace.revisions.find((revision) => revision.id === workspace.currentRevisionId)
    ?? workspace.revisions[0];
  const payload = displayRevision.payload;
  const selectedUnit = workspace.units[0];
  const draftFiles: ProductPortalFileDto[] = payload.documents
    .filter((document) => document.included && document.ready)
    .map((document) => ({
      id: document.id,
      folderKey: document.folderKey,
      folderTitle: document.folderTitle,
      folderSort: document.folderSort,
      fileSort: document.fileSort,
      title: document.title,
      fileName: `${document.title}.pdf`,
      revisionLabel: document.sourceRevisionLabel,
      accessMode: document.accessMode,
      sizeBytes: 0,
      pageCount: 0,
    }));
  const draftPreview = selectedUnit
    ? customerPortalDtoForPreview({
        identity: workspace.identity,
        serialNo: selectedUnit.serialNo,
        publicCode: selectedUnit.publicCode,
        payload,
        revisionNo: displayRevision.revNo,
        files: draftFiles,
        customerLogoDataUrl,
      })
    : null;

  const publishedRevision = workspace.currentRevisionId
    ? workspace.revisions.find((revision) => revision.id === workspace.currentRevisionId) ?? null
    : null;
  const publishedPayload = publishedRevision
    ? withProductPortalDefaults(publishedRevision.payload)
    : null;
  const publishedPreview = selectedUnit && publishedRevision && publishedPayload?.issuedIdentity
    ? customerPortalDtoForPreview({
        identity: publishedPayload.issuedIdentity,
        serialNo: selectedUnit.serialNo,
        publicCode: selectedUnit.publicCode,
        payload: publishedPayload,
        revisionNo: publishedRevision.revNo,
        publishedAt: publishedRevision.issuedAt ?? publishedRevision.createdAt,
        files: workspace.publishedFiles,
        customerLogoDataUrl,
      })
    : null;

  return (
    <ProductPortalCard
      /*
       * ANAHTAR YALNIZ SÜRÜM KİMLİĞİDİR — payload'ı anahtara KATMA.
       *
       * Önceki hâli `${id}:${JSON.stringify(payload)}:${JSON.stringify(units)}` idi.
       * Her server action `revalidatePath` çağırır, payload değişir, anahtar değişir
       * ve kart KOMPLE YENİDEN MONTE OLUR. İki bedeli vardı ve ikisi de sessizdi:
       *
       *   - "Parolayı Yenile"nin ürettiği HAM PAROLA yalnız bir kez gösterilir;
       *     `shownPassword` yeniden montajda sıfırlandığı için kullanıcı parolayı
       *     hiç göremeden kaybediyordu. Açık parola saklanmaz — yani gerçekten kayıp.
       *   - "Erişimi Aç", "Kaynakları Yenile", "PDF Ekle" gibi her eylem, kaydedilmemiş
       *     bütün düzenlemeleri geri alıyordu.
       *
       * Sürüm değiştiğinde (yeni revizyon açıldığında) yeniden montaj DOĞRUDUR;
       * o yüzden anahtarda sürüm kimliği kalır. Aynı sürümün taze verisi ise
       * kartın kendi uzlaştırmasıyla içeri alınır.
       */
      key={displayRevision.id}
      projectId={projectId}
      canEdit={canEdit}
      workspace={workspace}
      portalOrigin={portalOriginInfo.origin}
      portalOriginPermanent={portalOriginInfo.permanent}
      customerLogoDataUrl={customerLogoDataUrl}
      draftPreview={draftPreview}
      publishedPreview={publishedPreview}
    />
  );
}
