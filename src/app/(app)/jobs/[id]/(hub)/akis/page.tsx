// AKIŞ — olaylar + yorumlar birleşik kronolojide.
//
// Okuma HOŞGÖRÜLÜDÜR: `job_events` / `job_comments` migration'ları
// uygulanmamışsa sorgular hata döner ve sayfa boş listeyle çizilir — bir
// defterin yokluğu sekmeyi düşürmez.

import { createClient } from "@/lib/supabase/server";
import { JobAkisi, type JobCommentRow, type JobEventRow } from "../../../akis-view";
import type { MentionPerson } from "@/lib/jobs/mentions";

/** Gömülü ilişki tekil ya da dizi dönebilir; ikisini de karşıla. */
function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export default async function JobAkisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: olaylar }, { data: yorumlar }, { data: people }, { data: me }] =
    await Promise.all([
      supabase
        .from("job_events")
        .select("id, event, detail, at, actor:profiles(full_name)")
        .eq("job_id", id)
        .order("at", { ascending: false })
        .limit(100),
      supabase
        .from("job_comments")
        .select("id, body, author, created_at, edited_at, yazar:profiles(full_name)")
        .eq("job_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      user
        ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const olayRows: JobEventRow[] = (olaylar ?? []).map((o) => ({
    id: String(o.id),
    event: String(o.event),
    at: String(o.at),
    actorName: one<{ full_name: string | null }>(o.actor as unknown)?.full_name ?? "",
    detail: (o.detail ?? {}) as Record<string, unknown>,
  }));

  const yorumRows: JobCommentRow[] = (yorumlar ?? []).map((c) => ({
    id: String(c.id),
    at: String(c.created_at),
    authorId: String(c.author ?? ""),
    authorName: one<{ full_name: string | null }>(c.yazar as unknown)?.full_name ?? "",
    body: String(c.body ?? ""),
    edited: Boolean(c.edited_at),
  }));

  const kisiler: MentionPerson[] = ((people ?? []) as {
    id: string;
    full_name: string | null;
  }[]).map((p) => ({ id: p.id, fullName: p.full_name ?? "" }));

  return (
    <JobAkisi
      jobId={id}
      olaylar={olayRows}
      yorumlar={yorumRows}
      people={kisiler}
      meId={user?.id ?? ""}
      isAdmin={(me as { role?: string } | null)?.role === "admin"}
    />
  );
}
