import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { taskSnapshot } from "@/lib/tasks/service";
import { filtersSchema } from "@/lib/tasks/model";
import { TaskWorkspace } from "./panel/task-workspace";
export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const params = await searchParams;
  const db = await createClient();
  const parsed = filtersSchema.safeParse(
    Object.fromEntries(
      Object.entries(params).filter(([key]) =>
        [
          "view",
          "period",
          "q",
          "board",
          "team",
          "assignee",
          "status",
          "priority",
          "sent",
          "unassigned", "tagIds", "tagMatch", "untagged",
        ].includes(key),
      ).map(([key, value]) => [key, key === "sent" || key === "unassigned" || key === "untagged" ? value === "true" : value]),
    ),
  );
  const filters = parsed.success ? parsed.data : { view: "mine" as const };
  let initial;
  let initialError;
  try {
    initial = await taskSnapshot(db, profile.userId, filters);
  } catch {
    initialError = "Görev alanı yüklenemedi. Yeniden deneyin.";
  }
  return (
    <TaskWorkspace
      initialFilters={filters}
      initial={initial}
      userId={profile.userId}
      role={profile.role}
      name={profile.fullName}
      initialTask={params.task}
      initialError={initialError}
    />
  );
}
