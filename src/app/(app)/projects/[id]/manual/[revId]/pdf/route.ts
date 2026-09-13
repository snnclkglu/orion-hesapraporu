import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderManualResponse } from "@/lib/manual/export-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; revId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });
  const { id, revId } = await params;
  return renderManualResponse(supabase, id, revId, request.nextUrl.searchParams.get("ekler") === "1");
}
