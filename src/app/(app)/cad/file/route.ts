import { fileUrl, CadError } from "@/lib/cad/server";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.redirect(await fileUrl(query.get("job") ?? "", query.get("artifact") ?? undefined), 303);
  } catch (error) {
    return Response.json({ error: error instanceof CadError ? error.message : "Dosya bulunamadı." }, { status: error instanceof CadError ? error.status : 400, headers: { "Cache-Control": "no-store" } });
  }
}
