import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { taskCommand, taskSnapshot, TaskError } from "./service";
it("iptal nedenini, sürümü ve sunucuda belirlenen aktörü zorunlu tutar", async () => {
  const rpc=vi.fn(), db={rpc} as unknown as SupabaseClient, actor=crypto.randomUUID(), id=crypto.randomUUID();
  for(const input of [{id,version:1},{id,version:1,reason:"  "},{id,reason:"Yanlışlıkla açıldı"},{id,version:1,reason:"Yanlışlıkla açıldı",cancelled_by:actor}]) {
    await expect(taskCommand(db,actor,"cancel",input)).rejects.toBeInstanceOf(TaskError);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it("geçersiz veri veritabanına gitmez", async () => {
  const rpc = vi.fn();
  await expect(
    taskCommand(
      { rpc } as unknown as SupabaseClient,
      crypto.randomUUID(),
      "update",
      { title: "İş" },
    ),
  ).rejects.toBeInstanceOf(TaskError);
  expect(rpc).not.toHaveBeenCalled();
});
it("ajan aktörünü ve tekrar anahtarını atomik geçide taşır", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { ok: true } });
  const actor = crypto.randomUUID();
  await taskCommand(
    { rpc } as unknown as SupabaseClient,
    actor,
    "create",
    { title: "İş" },
    "grok-tasks",
    "command-0001",
  );
  expect(rpc).toHaveBeenCalledWith(
    "task_command",
    expect.objectContaining({
      p_actor: actor,
      p_agent: "grok-tasks",
      p_key: "command-0001",
    }),
  );
});
it("veritabanı iç hatası istemciye sızmaz", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({
      error: { code: "XX000", message: "secret internal table" },
    });
  await expect(
    taskSnapshot({ rpc } as unknown as SupabaseClient, crypto.randomUUID(), {}),
  ).rejects.toThrow("Görev alanına ulaşılamadı");
});
