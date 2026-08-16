// GÖREVLER — işe bağlı yapılacaklar: aç, ata, termin ver, kapat.
//
// Veri katmanı burada, etkileşim `task-list.tsx`te (istemci). Atanan kişi
// listesi BÜTÜN profillerdir: görev her role atanabilir — rol süzgeci
// sunum kararıdır ve bugün için "herkes" doğru kümedir.

import { createClient } from "@/lib/supabase/server";
import { TaskList, type TaskPerson, type TaskRow } from "./task-list";

/** Gömülü ilişki tekil ya da dizi dönebilir; ikisini de karşıla. */
function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export default async function JobGorevlerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tasks }, { data: people }, { data: items }, sablon, { data: me }] =
    await Promise.all([
      supabase
        .from("job_tasks")
        .select(
          `id, title, note, item_no, due_date, sort, done_at, created_by,
           assignee, atanan:profiles!job_tasks_assignee_fkey(full_name),
           kapatan:profiles!job_tasks_done_by_fkey(full_name)`
        )
        .eq("job_id", id)
        .order("sort", { ascending: true }),
      supabase.from("profiles").select("id, full_name, title").order("full_name"),
      supabase
        .from("job_items")
        .select("item_no")
        .eq("job_id", id)
        .order("sort", { ascending: true }),
      supabase
        .from("job_task_templates")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
      user
        ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const rows: TaskRow[] = (tasks ?? []).map((t) => ({
    id: String(t.id),
    title: String(t.title ?? ""),
    note: String(t.note ?? ""),
    itemNo: String(t.item_no ?? ""),
    assigneeId: (t.assignee as string | null) ?? null,
    assigneeName: one<{ full_name: string | null }>(t.atanan as unknown)?.full_name ?? "",
    dueDate: (t.due_date as string | null) ?? null,
    doneAt: (t.done_at as string | null) ?? null,
    doneByName: one<{ full_name: string | null }>(t.kapatan as unknown)?.full_name ?? "",
    createdBy: String(t.created_by ?? ""),
  }));

  const kisiler: TaskPerson[] = ((people ?? []) as {
    id: string;
    full_name: string | null;
    title: string | null;
  }[]).map((p) => ({ id: p.id, fullName: p.full_name ?? "", title: p.title ?? "" }));

  return (
    <TaskList
      jobId={id}
      tasks={rows}
      people={kisiler}
      itemNos={((items ?? []) as { item_no: string }[])
        .map((i) => i.item_no)
        .filter(Boolean)}
      sablonSayisi={sablon.count ?? 0}
      meId={user?.id ?? ""}
      isAdmin={(me as { role?: string } | null)?.role === "admin"}
    />
  );
}
