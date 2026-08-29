import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { customerPortalDtoForPreview } from "@/lib/product-portal/access-server";
import { loadProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import type { ProductPortalFileDto } from "@/lib/product-portal/types";
import { ProductPortalCard } from "./product-portal-card";

const loadNameplateAssets = cache(async () => {
  const root = process.cwd();
  const [logo, archivo, plex] = await Promise.all([
    fs.readFile(path.join(root, "public", "brand", "orion-logo-white.svg")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "Archivo-Bold.ttf")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "IBMPlexMono-SemiBold.ttf")),
  ]);
  return {
    logoDataUrl: `data:image/svg+xml;base64,${logo.toString("base64")}`,
    embeddedFontsCss: `
      @font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivo.toString("base64")}) format('truetype');font-weight:700 900}
      @font-face{font-family:PlexMono;src:url(data:font/ttf;base64,${plex.toString("base64")}) format('truetype');font-weight:500 700}
    `,
  };
});

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
  const [workspace, settings, nameplateAssets] = await Promise.all([
    loadProductPortalWorkspace(supabase, projectId),
    getReportSettings(supabase),
    loadNameplateAssets(),
  ]);
  if (!workspace) {
    return (
      <ProductPortalCard
        projectId={projectId}
        canEdit={canEdit}
        workspace={null}
        portalOrigin={portalOrigin(settings.web)}
        logoDataUrl={nameplateAssets.logoDataUrl}
        embeddedFontsCss={nameplateAssets.embeddedFontsCss}
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
      logoDataUrl={nameplateAssets.logoDataUrl}
      embeddedFontsCss={nameplateAssets.embeddedFontsCss}
      draftPreview={draftPreview}
      publishedPreview={publishedPreview}
    />
  );
}
