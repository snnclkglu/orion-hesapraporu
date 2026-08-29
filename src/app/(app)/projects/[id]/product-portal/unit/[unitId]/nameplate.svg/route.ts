import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { loadProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { buildNameplateSvg, productPortalUrl } from "@/lib/product-portal/nameplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origin(web: string | undefined): string {
  const value = String(
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_ORIGIN ?? web ?? "orioncranes.com"
  ).trim();
  return (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, "");
}
function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 90) || "vinc";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const { id, unitId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });
  const [workspace, settings] = await Promise.all([
    loadProductPortalWorkspace(supabase, id),
    getReportSettings(supabase),
  ]);
  const unit = workspace?.units.find((entry) => entry.id === unitId);
  const revision = workspace?.editableRevision ?? workspace?.revisions[0];
  if (!workspace || !unit || !revision) return new Response("İsim plakası bulunamadı", { status: 404 });

  const root = process.cwd();
  const [logo, archivo, plex] = await Promise.all([
    fs.readFile(path.join(root, "public", "brand", "orion-logo-white.svg")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "Archivo-Bold.ttf")),
    fs.readFile(path.join(root, "src", "assets", "fonts", "IBMPlexMono-SemiBold.ttf")),
  ]);
  const logoDataUrl = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const embeddedFontsCss = `
    @font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivo.toString("base64")}) format('truetype');font-weight:700 900}
    @font-face{font-family:PlexMono;src:url(data:font/ttf;base64,${plex.toString("base64")}) format('truetype');font-weight:500 700}
  `;
  const svg = buildNameplateSvg({
    widthMm: revision.payload.plate.widthMm,
    heightMm: revision.payload.plate.heightMm,
    serialNo: unit.serialNo,
    publicUrl: productPortalUrl(origin(settings.web), unit.publicCode),
    identity: workspace.identity,
    hiddenFields: revision.payload.hiddenFields,
    logoDataUrl,
    holeDiameterMm: revision.payload.plate.holeDiameterMm,
    holeInsetMm: revision.payload.plate.holeInsetMm,
    embeddedFontsCss,
  });
  const fileName = `${safeName(unit.serialNo)}-ORION-VINC-KIMLIK-PLAKASI-${revision.revNo}.svg`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
