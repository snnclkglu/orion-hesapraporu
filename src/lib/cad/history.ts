import { z } from "zod";

export const historySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["", "uploading", "queued", "processing", "review", "approved", "failed", "cancelled"]).default(""),
  device: z.union([z.literal(""), z.uuid()]).default(""),
  from: z.union([z.literal(""), z.iso.date()]).default(""),
  to: z.union([z.literal(""), z.iso.date()]).default(""),
  page: z.number().int().min(0).max(100000).default(0),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Başlangıç tarihi bitiş tarihinden sonra olamaz." });
export type CadHistoryFilter = z.infer<typeof historySchema>;
export const emptyHistory: CadHistoryFilter = { search: "", status: "", device: "", from: "", to: "", page: 0 };
export const HISTORY_PAGE_SIZE = 20;
export const escapeHistorySearch = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { from: "", to: "" };
  const [year, value] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${new Date(Date.UTC(year, value, 0)).getUTCDate()}` };
}
export function quickHistoryRange(period: string, now = new Date()) {
  const today = new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  if (period === "today") return { from: today, to: today };
  if (period === "week") return { from: new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10), to: today };
  if (period === "month") return monthRange(today.slice(0, 7));
  if (period === "previous") return monthRange(new Date(Date.UTC(Number(today.slice(0,4)), Number(today.slice(5,7)) - 2, 1)).toISOString().slice(0,7));
  if (period === "year") return { from: `${today.slice(0,4)}-01-01`, to: `${today.slice(0,4)}-12-31` };
  return { from: "", to: "" };
}
