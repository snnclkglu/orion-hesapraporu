import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadCustomerLogoDataUrl } from "@/lib/customers/logo-data-url-server";
import { customerPortalDtoForPreview } from "@/lib/product-portal/access-server";
import { loadProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import type { ProductPortalFileDto } from "@/lib/product-portal/types";
import { ProductPortalCard } from "./product-portal-card";

const loadNameplateAssets = cache(async () => {
  const root = process.cwd();
  const [logo, logoPaper, archivoBold, archivoExtraBold, plex] = await Promise.all([
    fs.readFile(path.join(root, "public", "brand", "orion-logo-white.svg")),
    fs.readFile(path.join(root, "public", "brand", "orion-logo-paper.png")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "Archivo-Bold.ttf")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "Archivo-ExtraBold.ttf")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "IBMPlexMono-SemiBold.ttf")),
  ]);
  return {
    logoDataUrl: `data:image/svg+xml;base64,${logo.toString("base64")}`,
    logoPaperDataUrl: `data:image/png;base64,${logoPaper.toString("base64")}`,
    archivoBoldDataUrl: `data:font/ttf;base64,${archivoBold.toString("base64")}`,
    archivoExtraBoldDataUrl: `data:font/ttf;base64,${archivoExtraBold.toString("base64")}`,
    plexDataUrl: `data:font/ttf;base64,${plex.toString("base64")}`,
    embeddedFontsCss: `
      @font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivoBold.toString("base64")}) format('truetype');font-weight:700}
      @font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivoExtraBold.toString("base64")}) format('truetype');font-weight:800}
      @font-face{font-family:PlexMono;src:url(data:font/ttf;base64,${plex.toString("base64")}) format('truetype');font-weight:500 700}
    `,
  };
});

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

async function portalOrigin(): Promise<string> {
  const configured = validPortalOrigin(
    process.env.CUSTOMER_PORTAL_ORIGIN
      ?? process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_ORIGIN
      ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  if (configured) return configured;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const proto = (requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https"))
    .split(",")[0]
    .trim();
  return validPortalOrigin(`${proto}://${host}`) ?? "http://localhost:3000";
}
export async function ProductPortalSection({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const [workspace, nameplateAssets, portalOriginValue, { data: logoProject }] = await Promise.all([
    loadProductPortalWorkspace(supabase, projectId),
    loadNameplateAssets(),
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
        portalOrigin={portalOriginValue}
        logoDataUrl={nameplateAssets.logoDataUrl}
        logoPaperDataUrl={nameplateAssets.logoPaperDataUrl}
        customerLogoDataUrl={customerLogoDataUrl}
        archivoBoldDataUrl={nameplateAssets.archivoBoldDataUrl}
        archivoExtraBoldDataUrl={nameplateAssets.archivoExtraBoldDataUrl}
        plexDataUrl={nameplateAssets.plexDataUrl}
        embeddedFontsCss={nameplateAssets.embeddedFontsCss}
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
      key={`${displayRevision.id}:${JSON.stringify(payload)}:${JSON.stringify(workspace.units)}`}
      projectId={projectId}
      canEdit={canEdit}
      workspace={workspace}
      portalOrigin={portalOriginValue}
      logoDataUrl={nameplateAssets.logoDataUrl}
      logoPaperDataUrl={nameplateAssets.logoPaperDataUrl}
      customerLogoDataUrl={customerLogoDataUrl}
      archivoBoldDataUrl={nameplateAssets.archivoBoldDataUrl}
      archivoExtraBoldDataUrl={nameplateAssets.archivoExtraBoldDataUrl}
      plexDataUrl={nameplateAssets.plexDataUrl}
      embeddedFontsCss={nameplateAssets.embeddedFontsCss}
      draftPreview={draftPreview}
      publishedPreview={publishedPreview}
    />
  );
}
