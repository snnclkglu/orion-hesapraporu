import { z } from "zod";

export const statuses = {
  todo: "Yapılacak",
  doing: "Devam ediyor",
  waiting: "Beklemede",
  done: "Tamamlandı",
} as const;
export const priorities = {
  none: "Öncelik yok",
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
} as const;
export const kinds = {
  task: "Görevler",
  note: "Notlar",
  goal: "Hedefler",
} as const;
export type TaskStatus = keyof typeof statuses;
export type TaskPriority = keyof typeof priorities;
export type TaskKind = keyof typeof kinds;
export const recurrenceSchema = z
  .object({
    mode: z.enum(["weekly", "monthly", "after"]),
    interval: z.number().int().min(1).max(52),
    day: z.number().int().min(1).max(31).optional(),
  })
  .strict();
export const checklistSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        text: z.string().trim().min(1).max(180),
        done: z.boolean(),
      })
      .strict(),
  )
  .max(30)
  .refine(
    (items) => new Set(items.map((i) => i.id)).size === items.length,
    "Kontrol adımları benzersiz olmalı",
  );
export const workflowSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    checklist: checklistSchema.optional(),
    recurrence: recurrenceSchema.nullable().optional(),
    waiting_for: z.array(z.uuid()).max(10).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.checklist !== undefined ||
      v.recurrence !== undefined ||
      v.waiting_for !== undefined,
    "Bir akış ayarı gerekli",
  );
export type WorkflowInput = z.infer<typeof workflowSchema>;
export type TaskFlow = {
  waiting_for: { id: string; title: string; status: TaskStatus }[];
  next_task: string | null;
};
export interface Task {
  checklist?: z.infer<typeof checklistSchema>;
  recurrence?: z.infer<typeof recurrenceSchema> | null;
  recurrence_parent?: string | null;
  id: string;
  title: string;
  note: string;
  assignee: string | null;
  created_by: string;
  job_id: string | null;
  job_no?: string | null;
  board_id: string | null;
  visibility: "private" | "team" | "job" | "direct";
  kind: TaskKind;
  status: TaskStatus;
  previous_status: Exclude<TaskStatus, "done">;
  priority: TaskPriority;
  due_date: string | null;
  done_at: string | null;
  version: number;
  archived_at: string | null;
  goal_id: string | null;
  source_ref: string | null;
  updated_at: string;
  goal_total?: number;
  goal_done?: number;
  can_edit?: boolean;
}
export interface Person {
  id: string;
  full_name: string;
  role: string;
}
export interface Board {
  is_default?: boolean;
  id: string;
  name: string;
  kind: TaskKind;
  owner_id: string;
  team_id: string | null;
  archived_at: string | null;
  can_edit?: boolean;
}
export interface Team {
  archived_at?: string | null;
  id: string;
  name: string;
  owner_id: string;
}
export interface Workspace {
  tasks: Task[];
  goals?: Task[];
  total: number;
  boards: Board[];
  teams: Team[];
  members: { team_id: string; user_id: string; role: string }[];
  people: Person[];
  jobs: { id: string; job_no: string; title: string }[];
  inbox: {
    id: string;
    task_id: string;
    title: string;
    event: string;
    read_at: string | null;
    created_at: string;
  }[];
}
export interface TaskDetail {
  task: Task;
  comments: {
    id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[];
  events: {
    id: string;
    actor_id: string;
    agent_name: string | null;
    event: string;
    changes: Record<string, { before: unknown; after: unknown }>;
    created_at: string;
  }[];
  attachments: {
    id: string;
    name: string;
    object_path: string;
    bytes: number;
  }[];
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Geçersiz tarih");
const fields = {
  title: z.string().trim().min(1, "Başlık gerekli").max(300),
  note: z.string().max(20000),
  assignee: z.uuid().nullable(),
  job_id: z.uuid().nullable(),
  board_id: z.uuid().nullable(),
  due_date: dateSchema.nullable(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  visibility: z.enum(["private", "team", "job", "direct"]),
  kind: z.enum(["task", "note", "goal"]),
  goal_id: z.uuid().nullable(),
};
export const createTaskSchema = z
  .object(fields)
  .partial()
  .required({ title: true })
  .extend({ source_ref: z.string().trim().min(1).max(500).optional() })
  .strict();
export const updateTaskSchema = z
  .object(fields)
  .partial()
  .extend({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(["todo", "doing", "waiting", "done"]).optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export const commentSchema = z
  .object({
    id: z.uuid(),
    body: z.string().trim().min(1).max(4000),
    mentions: z.array(z.uuid()).max(30).optional(),
  })
  .strict();
export const filtersSchema = z
  .object({
    view: z
      .enum(["mine", "team", "boards", "inbox", "menu"])
      .default("mine")
      .transform((view) => (view === "menu" ? ("mine" as const) : view)),
    period: z
      .enum(["all", "today", "week", "overdue", "upcoming", "done", "archived"])
      .default("all"),
    q: z.string().max(100).default(""),
    team: z.uuid().optional(),
    board: z.uuid().optional(),
    assignee: z.uuid().optional(),
    sent: z.boolean().optional(),
    unassigned: z.boolean().optional(),
    job: z.uuid().optional(),
    status: z.enum(["todo", "doing", "waiting", "done"]).optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    cursor: z
      .string()
      .max(100)
      .refine((value) => {
        const parts = value.split("|");
        return (
          parts.length === 2 &&
          z.iso.datetime({ offset: true }).safeParse(parts[0]).success &&
          z.uuid().safeParse(parts[1]).success
        );
      }, "Geçersiz sayfa imleci")
      .optional(),
    sourceRef: z.string().max(500).optional(),
    updatedSince: z.iso.datetime().optional(),
  })
  .strict();
export type TaskFilters = z.input<typeof filtersSchema>;
export type TaskInput = z.input<typeof createTaskSchema>;
export type TaskPatch = z.input<typeof updateTaskSchema>;
export function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function weekDays(today: string) {
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
export function isOverdue(t: Pick<Task, "status" | "due_date">, today: string) {
  return t.status !== "done" && !!t.due_date && t.due_date < today;
}
export function dateLabel(date: string | null, today: string) {
  if (!date) return "Tarih yok";
  if (date === today) return "Bugün";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}
export function goalProgress(total: number, done: number) {
  return total > 0 ? Math.round((done / total) * 100) : null;
}
