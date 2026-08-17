"use server";

// Kişisel yapılacakların yazma yolu. RLS satırı zaten sahibine kelepçeler;
// sorgulardaki `user_id` eşitliği niyeti koda da yazar (dev önizlemede ya da
// politika gevşediğinde sessiz sızıntı olmaz). Madde İŞE BAĞLANMAZ, bildirim
// üretmez, olay defterine yazmaz — o işler `job_tasks`ındır.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LANDING_PATH } from "@/lib/roles";

export type TodoActionResult = { error?: string };

const BASLIK_SINIRI = 300;

async function kimlik() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" } as const;
  return { supabase, user } as const;
}

function tarihGecerli(v: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  );
}

export async function createTodo(input: {
  title: string;
  dueDate?: string | null;
}): Promise<TodoActionResult> {
  const ctx = await kimlik();
  if ("error" in ctx) return { error: ctx.error };

  const title = (input.title ?? "").trim();
  if (!title) return { error: "Madde boş olamaz." };
  if (title.length > BASLIK_SINIRI) {
    return { error: `Madde ${BASLIK_SINIRI} karakteri aşamaz.` };
  }
  const dueDate = (input.dueDate ?? "").trim() || null;
  if (dueDate && !tarihGecerli(dueDate)) return { error: "Tarih okunamadı." };

  const { error } = await ctx.supabase.from("user_todos").insert({
    user_id: ctx.user.id,
    title,
    due_date: dueDate,
  });
  if (error) return { error: error.message };

  revalidatePath(LANDING_PATH);
  return {};
}

export async function toggleTodo(
  id: string,
  done: boolean
): Promise<TodoActionResult> {
  const ctx = await kimlik();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("user_todos")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) return { error: error.message };

  revalidatePath(LANDING_PATH);
  return {};
}

export async function setTodoDueDate(
  id: string,
  dueDate: string | null
): Promise<TodoActionResult> {
  const ctx = await kimlik();
  if ("error" in ctx) return { error: ctx.error };

  const temiz = (dueDate ?? "").trim() || null;
  if (temiz && !tarihGecerli(temiz)) return { error: "Tarih okunamadı." };

  const { error } = await ctx.supabase
    .from("user_todos")
    .update({ due_date: temiz })
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) return { error: error.message };

  revalidatePath(LANDING_PATH);
  return {};
}

export async function deleteTodo(id: string): Promise<TodoActionResult> {
  const ctx = await kimlik();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("user_todos")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) return { error: error.message };

  revalidatePath(LANDING_PATH);
  return {};
}
