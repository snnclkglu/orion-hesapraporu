import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { customerPortalDtoForPreview } from "@/lib/product-portal/access-server";
import { loadProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import type { ProductPortalFileDto } from "@/lib/product-portal/types";
import { ProductPortalCard } from "./product-portal-card";

function portalOrigin(web: string | undefined): string {
  const value = String(
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_ORIGIN ?? web ?? "orioncranes.com"
  ).trim();
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `https://${value.replace(/\/+$/, "")}`;
}
export async function ProductPortalSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const [workspace, settings] = await Promise.all([
    loadProductPortalWorkspace(supabase, projectId),
    getReportSettings(supabase),
  ]);
  if (!workspace) {
    return (
      <ProductPortalCard
        projectId={projectId}
        canEdit={canEdit}
        workspace={null}
        portalOrigin={portalOrigin(settings.web)}
        logoDataUrl="/brand/orion-logo-white.svg"
        draftPreview={null}
        publishedPreview={null}
      />
    );
  }

  const displayRevision = workspace.editableRevision ?? workspace.revisions[0];
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
      })
    : null;

  return (
    <ProductPortalCard
      projectId={projectId}
      canEdit={canEdit}
      workspace={workspace}
      portalOrigin={portalOrigin(settings.web)}
      logoDataUrl="/brand/orion-logo-white.svg"
      draftPreview={draftPreview}
      publishedPreview={publishedPreview}
    />
  );
}
