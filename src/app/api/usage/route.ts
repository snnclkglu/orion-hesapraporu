import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { USAGE_SECTIONS } from "@/lib/usage";

const usagePulseSchema = z
  .object({
    sessionId: z.uuid(),
    section: z.enum(USAGE_SECTIONS),
    activeSeconds: z.number().int().min(0).max(60),
    pageViews: z.number().int().min(0).max(1),
    deviceClass: z.enum(["desktop", "tablet", "mobile"]),
  })
  .strict();

export async function POST(request: Request) {
  // Başka bir siteden kullanıcının çereziyle sahte kullanım darbesi üretilemez.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const parsed = usagePulseSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz kullanım verisi" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum bulunamadı" }, { status: 401 });

  const { error } = await supabase.rpc("record_user_usage", {
    p_session_id: parsed.data.sessionId,
    p_section: parsed.data.section,
    p_active_seconds: parsed.data.activeSeconds,
    p_page_views: parsed.data.pageViews,
    p_device_class: parsed.data.deviceClass,
  });
  if (error) {
    // Veritabanı ayrıntısı istemciye açılmaz; takip hatası asıl işi engellemez.
    return Response.json({ error: "Kullanım kaydı alınamadı" }, { status: 503 });
  }

  return new Response(null, { status: 204 });
}
