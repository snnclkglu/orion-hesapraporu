import { accountContext } from "@/lib/account/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await accountContext();
    const { id } = await params;
    const { data: a } = await db
      .from("app_feedback_attachments")
      .select("object_path")
      .eq("id", id)
      .single();
    if (!a) return new Response(null, { status: 404 });
    const { data, error } = await db.storage
      .from("feedback-images")
      .download(a.object_path);
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
