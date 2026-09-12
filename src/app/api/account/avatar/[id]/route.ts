import { accountContext } from "@/lib/account/server";
import { z } from "zod";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await accountContext();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      return new Response(null, { status: 404 });
    const { data: p } = await db
      .from("profiles")
      .select("avatar_path")
      .eq("id", id)
      .single();
    if (!p?.avatar_path) return new Response(null, { status: 404 });
    const size =
      new URL(request.url).searchParams.get("size") === "256" ? 256 : 64;
    const { data, error } = await db.storage
      .from("account-avatars")
      .download(`${p.avatar_path}/${size}.webp`);
    if (error || !data) return new Response(null, { status: 404 });
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 401 });
  }
}
