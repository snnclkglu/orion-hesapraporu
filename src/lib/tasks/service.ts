import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  commentSchema,
  filtersSchema,
  workflowSchema,
  type Workspace,
  type TaskDetail,
} from "./model";

const uuid = z.uuid();
const schemas = {
  workflow: workflowSchema,
  create: createTaskSchema,
  update: updateTaskSchema,
  comment: commentSchema,
  "board.create": z
    .object({
      name: z.string().trim().min(1).max(120),
      kind: z.enum(["task", "note", "goal"]),
      team_id: uuid.nullable(),
    })
    .strict(),
  "board.archive": z.object({ id: uuid, archived: z.boolean() }).strict(),
  "team.create": z.object({ name: z.string().trim().min(1).max(120) }).strict(),
  "team.member": z
    .object({
      team_id: uuid,
      user_id: uuid,
      role: z.enum(["manager", "editor", "viewer", "remove"]),
    })
    .strict(),
  attachment: z
    .object({
      id: uuid,
      name: z.string().min(1).max(200),
      object_path: z.string().max(500),
      mime_type: z.string().max(150),
      bytes: z.number().int().positive().max(20971520),
    })
    .strict(),
};
export type TaskOperation = keyof typeof schemas;
export class TaskError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
function dbError(error: { code?: string; message?: string }) {
  const actionable = [
    "Ön koşul görevleri henüz tamamlanmadı",
    "Önce bekleme bağlantılarını kaldırın",
    "Tekrar için görev türü ve termin gerekli",
    "Ön koşul aynı paylaşım kapsamında olmalı",
    "Döngü oluşturan bağlantı",
  ];
  if (
    error.code === "23514" &&
    error.message &&
    actionable.includes(error.message)
  )
    return new TaskError(error.message, 422);
  const status =
    error.code === "42501"
      ? 403
      : error.code === "40001" ||
          error.code === "23505" ||
          error.code === "40P01"
        ? 409
        : error.code?.startsWith("22") || error.code === "23514"
          ? 422
          : 503;
  return new TaskError(
    status === 503
      ? "Görev alanına ulaşılamadı. Lütfen yeniden deneyin."
      : status === 409
        ? "Kayıt değişti veya bu kaynak daha önce işlendi. Yenileyip tekrar deneyin."
        : status === 403
          ? "Bu kayıt için yetkiniz yok."
          : "Alanları ve paylaşım kapsamını kontrol edin.",
    status,
  );
}
export async function taskCommand(
  db: SupabaseClient,
  actor: string,
  operation: TaskOperation,
  input: unknown,
  agent?: string,
  key?: string,
) {
  const schema = schemas[operation];
  if (!schema) throw new TaskError("Geçersiz işlem");
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new TaskError(parsed.error.issues[0].message);
  const { data, error } = await db.rpc("task_command", {
    p_operation: operation,
    p_data: parsed.data,
    p_actor: actor,
    p_agent: agent ?? null,
    p_key: key ?? null,
  });
  if (error) throw dbError(error);
  return data as {
    task?: TaskDetail["task"];
    board?: Workspace["boards"][number];
    team?: Workspace["teams"][number];
    ok?: boolean;
    replayed?: boolean;
  };
}
export async function taskSnapshot(
  db: SupabaseClient,
  actor: string,
  filters: unknown,
): Promise<Workspace> {
  const parsed = filtersSchema.safeParse(filters);
  if (!parsed.success) throw new TaskError("Geçersiz süzgeç");
  const { data, error } = await db.rpc("task_snapshot", {
    p_actor: actor,
    p_filters: parsed.data,
  });
  if (error) throw dbError(error);
  return data;
}
export async function taskDetail(
  db: SupabaseClient,
  actor: string,
  id: string,
): Promise<TaskDetail> {
  if (!uuid.safeParse(id).success) throw new TaskError("Geçersiz görev");
  const { data, error } = await db.rpc("task_detail", {
    p_actor: actor,
    p_id: id,
  });
  if (error) throw dbError(error);
  return data;
}
