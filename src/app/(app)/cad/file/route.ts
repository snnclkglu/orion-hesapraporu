import { fileUrl, CadError } from "@/lib/cad/server";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return new Response(null, { status: 303, headers: { Location: await fileUrl(query.get("job") ?? "", query.get("artifact") ?? undefined, query.get("combined") === "1"), "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof CadError ? error.message : "Dosya bulunamadı." }, { status: error instanceof CadError ? error.status : 400, headers: { "Cache-Control": "no-store" } });
  }
}
