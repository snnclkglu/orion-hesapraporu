"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  taskCommand,
  taskSnapshot,
  taskDetail,
  TaskError,
  type TaskOperation,
} from "@/lib/tasks/service";
import {
  filtersSchema,
  type TaskFilters,
  type TaskFlow,
} from "@/lib/tasks/model";
import { z } from "zod";
import { attachmentSignatureMatches } from "@/lib/tasks/files";
async function context() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new TaskError("Oturumunuz sona erdi", 401);
  return { db, actor: user.id };
}
function message(e: unknown) {
  return e instanceof TaskError
    ? e.message
    : "İşlem tamamlanamadı. Yeniden deneyin.";
}
export async function loadWorkspace(filters: TaskFilters) {
  try {
    const { db, actor } = await context();
    await db.rpc("task_refresh_reminders");
    return { data: await taskSnapshot(db, actor, filters) };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function loadTaskDetail(id: string) {
  try {
    const { db, actor } = await context();
    return { data: await taskDetail(db, actor, id) };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function loadTaskFlow(id: string) {
  try {
    const { db, actor } = await context();
    const { data, error } = await db.rpc("task_flow_detail", {
      p_id: z.uuid().parse(id),
      p_actor: actor,
    });
    if (error) throw error;
    return { data: data as TaskFlow };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function searchDependencyTasks(query: string) {
  try {
    const { db } = await context();
    const q = z.string().max(100).parse(query).replace(/[%_]/g, "");
    const { data, error } = await db
      .from("job_tasks")
      .select("id,title,status,visibility,board_id,created_by,assignee,job_id")
      .is("archived_at", null)
      .ilike("title", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return { data: data ?? [] };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function savedTaskViews(
  operation: "list" | "save" | "delete",
  input?: unknown,
) {
  try {
    const { db, actor } = await context();
    if (operation === "save") {
      const p = z
        .object({
          name: z.string().trim().min(1).max(60),
          filters: filtersSchema,
        })
        .strict()
        .parse(input);
      const { error } = await db.rpc("task_save_view", {
        p_name: p.name,
        p_filters: p.filters,
      });
      if (error) throw error;
    } else if (operation === "delete") {
      const { error } = await db
        .from("task_saved_views")
        .delete()
        .eq("id", z.uuid().parse(input))
        .eq("user_id", actor);
      if (error) throw error;
    } else if (operation !== "list") throw new TaskError("Geçersiz işlem");
    const { data, error } = await db
      .from("task_saved_views")
      .select("id,name,filters")
      .eq("user_id", actor)
      .order("name");
    if (error) throw error;
    return {
      data: (data ?? []) as {
        id: string;
        name: string;
        filters: TaskFilters;
      }[],
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function searchTaskJobs(query: string) {
  try {
    const { db } = await context();
    if (typeof query !== "string" || query.length > 100)
      throw new TaskError("Arama çok uzun");
    const { data, error } = await db
      .from("jobs")
      .select("id,job_no,title")
      .ilike("job_no", `%${query.replace(/[%_]/g, "")}%`)
      .order("job_no", { ascending: false })
      .limit(30);
    if (error) throw error;
    return { data: data ?? [] };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function mutateWorkspace(
  operation: TaskOperation,
  input: unknown,
  key?: string,
) {
  try {
    const { db, actor } = await context();
    const data = await taskCommand(db, actor, operation, input, undefined, key);
    revalidatePath("/");
    revalidatePath("/jobs", "layout");
    return { data };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function readWorkspaceInbox(id: string, read = true) {
  try {
    const { db, actor } = await context();
    const { error } = await db
      .from("task_inbox")
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq("id", z.uuid().parse(id))
      .eq("user_id", actor);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function taskReminderPreferences(input?: unknown) {
  try {
    const { db, actor } = await context();
    if (input !== undefined) {
      const p = z
        .object({
          enabled: z.boolean(),
          quiet_start: z.number().int().min(0).max(23),
          quiet_end: z.number().int().min(0).max(23),
        })
        .strict()
        .parse(input);
      const { error } = await db
        .from("task_reminder_preferences")
        .upsert({ user_id: actor, ...p });
      if (error) throw error;
    }
    const { data, error } = await db
      .from("task_reminder_preferences")
      .select("enabled,quiet_start,quiet_end")
      .eq("user_id", actor)
      .maybeSingle();
    if (error) throw error;
    return { data: data ?? { enabled: true, quiet_start: 19, quiet_end: 8 } };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function uploadTaskFile(id: string, form: FormData) {
  try {
    const { db, actor } = await context();
    await taskDetail(db, actor, id);
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 20 * 1024 * 1024
    )
      throw new TaskError("Dosya 20 MB sınırını aşamaz.");
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(file.type))
      throw new TaskError("Bu dosya türü desteklenmiyor.");
    if (
      !attachmentSignatureMatches(
        file.type,
        new Uint8Array(await file.slice(0, 512).arrayBuffer()),
      )
    )
      throw new TaskError("Dosyanın içeriği seçilen dosya türüyle uyuşmuyor.");
    const path = `${id}/${actor}/${crypto.randomUUID()}`;
    const { error } = await db.storage
      .from("task-attachments")
      .upload(path, file, { contentType: file.type });
    if (error) throw new TaskError("Dosya yüklenemedi. Yeniden deneyin.");
    try {
      await taskCommand(db, actor, "attachment", {
        id,
        name: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 200),
        object_path: path,
        mime_type: file.type,
        bytes: file.size,
      });
    } catch (e) {
      await db.storage.from("task-attachments").remove([path]);
      throw e;
    }
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function getTaskFile(id: string) {
  try {
    const { db, actor } = await context();
    const { data: a } = await db
      .from("task_attachments")
      .select("task_id,object_path,name")
      .eq("id", id)
      .single();
    if (!a) throw new TaskError("Dosya bulunamadı", 404);
    await taskDetail(db, actor, a.task_id);
    const { data, error } = await db.storage
      .from("task-attachments")
      .createSignedUrl(a.object_path, 60, { download: a.name });
    if (error) throw error;
    return { url: data.signedUrl };
  } catch (e) {
    return { error: message(e) };
  }
}
