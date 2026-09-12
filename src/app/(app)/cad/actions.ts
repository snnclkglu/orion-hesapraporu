"use server";

import { z } from "zod";
import { CadError, snapshot, webCommand } from "@/lib/cad/server";

export async function cadAction(action: string, payload: unknown) {
  try { return { ok: true as const, data: await webCommand(action, payload) }; }
  catch (error) { return { ok: false as const, error: error instanceof CadError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message ?? "Bilgileri kontrol edin." : "İşlem tamamlanamadı. Bağlantınızı kontrol edin." }; }
}
export async function cadSnapshot(jobId?: string) {
  try { return { ok: true as const, data: await snapshot(jobId) }; }
  catch (error) { return { ok: false as const, error: error instanceof CadError ? error.message : "Durum bilgisi alınamadı." }; }
}
