import { z } from "zod";
import { CadError, workerCommand } from "@/lib/cad/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    // Gövde sınırı content-length beyanından bağımsız uygulanır.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "İstek boş." }, { status: 400 });
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new CadError("İstek çok büyük.", 413); }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks);
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    return Response.json(await workerCommand(token, JSON.parse(raw.toString("utf8"))), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CadError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
    const message = error instanceof CadError ? error.message : status === 400 ? "İstek biçimi geçersiz." : "Çizim İşleme hizmetine ulaşılamıyor.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
