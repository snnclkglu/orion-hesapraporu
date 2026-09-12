"use server";
import { revalidatePath } from "next/cache";
import {
  integrationCommand,
  integrationSnapshot,
  type IntegrationCommand,
  type EventFilters,
} from "@/lib/integrations/server";
export async function saveIntegration(command: IntegrationCommand) {
  try {
    const result = await integrationCommand(command);
    revalidatePath("/admin/integrations");
    return { ok: true as const, ...result };
  } catch (error) {
    const message =
      error instanceof Error &&
      !/token|digest|sql|fetch|JSON|Zod/i.test(error.message) &&
      error.message.length < 200
        ? error.message
        : "İşlem tamamlanamadı. Alanları kontrol edip ayarları yenileyin.";
    return { ok: false as const, error: message };
  }
}
export async function refreshIntegrations(filters: EventFilters = {}) {
  try {
    return { ok: true as const, data: await integrationSnapshot(filters) };
  } catch {
    return {
      ok: false as const,
      error: "Ayarlar okunamadı. Oturumunuzu ve bağlantıyı kontrol edin.",
    };
  }
}
