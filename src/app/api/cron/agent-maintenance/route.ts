import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (
    !secret ||
    !timingSafeEqual(
      digest(request.headers.get("authorization") ?? ""),
      digest(`Bearer ${secret}`),
    )
  )
    return Response.json({ error: "Yetkisiz istek." }, { status: 403 });
  try {
    const { data, error } = await createAdminClient().rpc(
      "agent_prune_requests",
    );
    if (error) throw new Error("Bakım tamamlanamadı.");
    return Response.json(
      { deleted: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "API kayıt bakımı tamamlanamadı." },
      { status: 503 },
    );
  }
}
