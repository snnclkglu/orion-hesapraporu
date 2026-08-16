"use server";

// İş hub'ının yazma yolları: görevler + yorumlar + şablondan görev seti.
//
// Her yazma `job_events`e de düşer (isOlayiYaz — hata yutulur, asıl kaydı
// bloklamaz). Bildirim fan-out'u Faz 4'te bu action'lara eklenir.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractMentionIds } from "@/lib/jobs/mentions";
import { notifyTargets } from "@/lib/jobs/notify";
import { isOlayiYaz } from "../events";
import { bildirimYaz } from "../notify-write";
import {
  commentInputSchema,
  taskInputSchema,
  type CommentInput,
  type TaskInput,
} from "../hub-schema";

export type HubActionResult = { error?: string };

/** Görev/yorum action'larının ortak girişi: oturum + iş kimliği. */
async function requireJob(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" as const };
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_no")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "İş bulunamadı" as const };
  return { supabase, user, job: job as { id: string; job_no: string } };
}

function tazele(jobId: string) {
  revalidatePath(`/jobs/${jobId}/gorevler`);
  revalidatePath(`/jobs/${jobId}/akis`);
  // "Benim işlerim" şeridi liste sayfasında yaşar.
  revalidatePath("/jobs");
}

// ─────────────────────────────────────────────────────────────────── görev

export async function createTask(
  jobId: string,
  input: TaskInput
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, job } = ctx;

  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Sıra listenin sonuna eklenir; mevcut en büyük sırayı okumak iki kullanıcı
  // aynı anda eklerken çakışabilir ama sıranın işi yalnız görüntü düzenidir.
  const { data: son } = await supabase
    .from("job_tasks")
    .select("sort")
    .eq("job_id", jobId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((son as { sort?: number } | null)?.sort ?? -1) + 1;

  const { error } = await supabase.from("job_tasks").insert({
    ...parsed.data,
    job_id: jobId,
    sort,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await isOlayiYaz(supabase, {
    jobId,
    jobNo: job.job_no,
    event: "gorev_acildi",
    detail: { title: parsed.data.title },
    actor: user.id,
  });
  if (parsed.data.assignee) {
    await isOlayiYaz(supabase, {
      jobId,
      jobNo: job.job_no,
      event: "gorev_atandi",
      detail: { title: parsed.data.title, assignee: parsed.data.assignee },
      actor: user.id,
    });
    await bildirimYaz(supabase, {
      targets: notifyTargets({
        kind: "gorev_atandi",
        actorId: user.id,
        assigneeId: parsed.data.assignee,
      }),
      kind: "gorev_atandi",
      jobId,
      jobNo: job.job_no,
      title: `${job.job_no} · Görev atandı: ${parsed.data.title}`,
      href: `/jobs/${jobId}/gorevler`,
      actor: user.id,
    });
  }

  tazele(jobId);
  return {};
}

export async function updateTask(
  jobId: string,
  taskId: string,
  input: TaskInput
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, job } = ctx;

  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Atama DEĞİŞİKLİĞİ olay üretir; bunun için eski değer yazmadan önce okunur.
  const { data: eski } = await supabase
    .from("job_tasks")
    .select("assignee")
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await supabase
    .from("job_tasks")
    .update(parsed.data)
    .eq("id", taskId)
    .eq("job_id", jobId);
  if (error) return { error: error.message };

  const eskiAtanan = (eski as { assignee?: string | null } | null)?.assignee ?? null;
  if (parsed.data.assignee && parsed.data.assignee !== eskiAtanan) {
    await isOlayiYaz(supabase, {
      jobId,
      jobNo: job.job_no,
      event: "gorev_atandi",
      detail: { title: parsed.data.title, assignee: parsed.data.assignee },
      actor: user.id,
    });
    await bildirimYaz(supabase, {
      targets: notifyTargets({
        kind: "gorev_atandi",
        actorId: user.id,
        assigneeId: parsed.data.assignee,
      }),
      kind: "gorev_atandi",
      jobId,
      jobNo: job.job_no,
      title: `${job.job_no} · Görev atandı: ${parsed.data.title}`,
      href: `/jobs/${jobId}/gorevler`,
      actor: user.id,
    });
  }

  tazele(jobId);
  return {};
}

export async function toggleTask(
  jobId: string,
  taskId: string,
  done: boolean
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, job } = ctx;

  const { data, error } = await supabase
    .from("job_tasks")
    .update(
      done
        ? { done_at: new Date().toISOString(), done_by: user.id }
        : { done_at: null, done_by: null }
    )
    .eq("id", taskId)
    .eq("job_id", jobId)
    .select("title")
    .maybeSingle();
  if (error) return { error: error.message };

  await isOlayiYaz(supabase, {
    jobId,
    jobNo: job.job_no,
    event: done ? "gorev_kapandi" : "gorev_acildi",
    detail: {
      title: (data as { title?: string } | null)?.title ?? "",
      ...(done ? {} : { yeniden: true }),
    },
    actor: user.id,
  });

  tazele(jobId);
  return {};
}

export async function deleteTask(
  jobId: string,
  taskId: string
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  // RLS silmeyi açan ya da yöneticiyle sınırlar; sessiz başarısızlık
  // görünmesin diye satır sayısı okunur (deleteJob kalıbı).
  const { data, error } = await supabase
    .from("job_tasks")
    .delete()
    .eq("id", taskId)
    .eq("job_id", jobId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Görev silinemedi — silme görevi açana ve yöneticiye açıktır." };
  }

  tazele(jobId);
  return {};
}

/**
 * Şablondaki aktif maddeleri işe görev seti olarak ekler (kullanıcı onayı,
 * 16.08.2026). Şablon defteri yöneticinindir (/admin/task-templates).
 */
export async function addTemplateTasks(jobId: string): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, job } = ctx;

  const { data: sablon, error: sablonHatasi } = await supabase
    .from("job_task_templates")
    .select("title, sort")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (sablonHatasi) return { error: sablonHatasi.message };
  if (!sablon || sablon.length === 0) {
    return { error: "Şablon boş — Yönetim → Görev Şablonu'ndan madde ekleyin." };
  }

  const { data: son } = await supabase
    .from("job_tasks")
    .select("sort")
    .eq("job_id", jobId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const taban = ((son as { sort?: number } | null)?.sort ?? -1) + 1;

  const { error } = await supabase.from("job_tasks").insert(
    (sablon as { title: string }[]).map((s, i) => ({
      job_id: jobId,
      title: s.title,
      sort: taban + i,
      created_by: user.id,
    }))
  );
  if (error) return { error: error.message };

  await isOlayiYaz(supabase, {
    jobId,
    jobNo: job.job_no,
    event: "gorev_acildi",
    detail: { title: `Şablondan ${sablon.length} görev eklendi` },
    actor: user.id,
  });

  tazele(jobId);
  return {};
}

// ─────────────────────────────────────────────────────────────────── yorum

export async function createComment(
  jobId: string,
  input: CommentInput
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, job } = ctx;

  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Anılan kimlikler SON METİNDEN çıkarılır (composer'ın eklediği listeden
  // değil): kullanıcı anmayı silmişse kimlik de düşmelidir.
  const { data: people } = await supabase.from("profiles").select("id, full_name");
  const mentions = extractMentionIds(
    parsed.data.body,
    ((people ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
    }))
  );

  const { error } = await supabase.from("job_comments").insert({
    job_id: jobId,
    body: parsed.data.body,
    mentions,
    author: user.id,
  });
  if (error) return { error: error.message };

  await isOlayiYaz(supabase, {
    jobId,
    jobNo: job.job_no,
    event: "yorum",
    detail: { ozet: parsed.data.body.slice(0, 80) },
    actor: user.id,
  });
  await bildirimYaz(supabase, {
    targets: notifyTargets({
      kind: "bahsedildi",
      actorId: user.id,
      mentionIds: mentions,
    }),
    kind: "bahsedildi",
    jobId,
    jobNo: job.job_no,
    title: `${job.job_no} · Yorumda anıldınız: ${parsed.data.body.slice(0, 60)}`,
    href: `/jobs/${jobId}/akis`,
    actor: user.id,
  });

  tazele(jobId);
  return {};
}

export async function updateComment(
  jobId: string,
  commentId: string,
  input: CommentInput
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: people } = await supabase.from("profiles").select("id, full_name");
  const mentions = extractMentionIds(
    parsed.data.body,
    ((people ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
    }))
  );

  // RLS düzenlemeyi yalnız sahibine açar; boş dönüş sessiz kalmasın.
  const { data, error } = await supabase
    .from("job_comments")
    .update({ body: parsed.data.body, mentions, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("job_id", jobId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Yorum düzenlenemedi — yorum yalnız sahibince düzenlenir." };
  }

  tazele(jobId);
  return {};
}

export async function deleteComment(
  jobId: string,
  commentId: string
): Promise<HubActionResult> {
  const ctx = await requireJob(jobId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from("job_comments")
    .delete()
    .eq("id", commentId)
    .eq("job_id", jobId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Yorum silinemedi — silme sahibine ve yöneticiye açıktır." };
  }

  tazele(jobId);
  return {};
}
