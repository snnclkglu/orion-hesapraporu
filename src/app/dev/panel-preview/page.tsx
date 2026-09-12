import { notFound } from "next/navigation";
import { TaskWorkspace } from "@/app/(app)/panel/task-workspace";
import { todayIstanbul, type Task, type Workspace } from "@/lib/tasks/model";
const me = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  team = "20000000-0000-4000-8000-000000000001",
  board = "30000000-0000-4000-8000-000000000001";
const today = todayIstanbul();
function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id: `40000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    title,
    note: "",
    assignee: me,
    created_by: me,
    job_id: null,
    board_id: board,
    visibility: "team",
    kind: "task",
    status: "todo",
    previous_status: "todo",
    priority: "none",
    due_date: today,
    done_at: null,
    version: 1,
    archived_at: null,
    goal_id: null,
    source_ref: null,
    updated_at: new Date().toISOString(),
    can_edit: true,
    ...extra,
  };
}
const initial: Workspace = {
  tasks: [
    task(1, "Köprü kirişi hesap raporunu kontrol et", {
      job_no: "0065",
      priority: "high",
      status: "doing",
      note: "Yük kombinasyonlarını ve sehim sonuçlarını birlikte kontrol et.",
    }),
    task(2, "Müşteriden gelen teknik notları değerlendir", {
      job_no: "0065",
      priority: "urgent",
      due_date: "2026-09-10",
    }),
    task(3, "Elektrik projesi için ekip toplantısı", {
      job_no: "0062",
      assignee: other,
      status: "waiting",
    }),
    task(4, "Haftanın çizim planını hazırla", {
      visibility: "private",
      board_id: null,
      priority: "medium",
    }),
    task(5, "Satın alma listesini mühendislikle paylaş", {
      job_no: "0061",
      status: "done",
      done_at: new Date().toISOString(),
    }),
    task(6, "Atölye kontrolünde dikkat edilecek noktalar", {
      kind: "note",
      due_date: null,
    }),
    task(7, "Bu haftanın teknik kontrollerini tamamla", {
      kind: "goal",
      goal_total: 4,
      goal_done: 2,
    }),
  ],
  total: 7,
  boards: [
    {
      id: board,
      name: "Mühendislik işleri",
      kind: "task",
      owner_id: me,
      team_id: team,
      archived_at: null,
      can_edit: true,
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      name: "Kişisel notlarım",
      kind: "note",
      owner_id: me,
      team_id: null,
      archived_at: null,
      can_edit: true,
    },
  ],
  teams: [{ id: team, name: "Mühendislik", owner_id: me }],
  members: [
    { team_id: team, user_id: me, role: "manager" },
    { team_id: team, user_id: other, role: "editor" },
  ],
  people: [
    { id: me, full_name: "DENİZ YILMAZ", role: "admin" },
    { id: other, full_name: "ECE DEMİR", role: "engineer" },
  ],
  jobs: [],
  inbox: [],
};
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1440px] p-4 sm:p-8">
      <TaskWorkspace
        initial={initial}
        userId={me}
        role="admin"
        name="Deniz"
        preview
      />
    </main>
  );
}
