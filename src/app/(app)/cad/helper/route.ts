import { helperUrl, CadError } from "@/lib/cad/server";
export async function GET() {
  try {
    return Response.redirect(await helperUrl(), 303);
  } catch (error) {
    return Response.json({ error: error instanceof CadError ? error.message : "Yardımcı indirilemedi." }, { status: error instanceof CadError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
