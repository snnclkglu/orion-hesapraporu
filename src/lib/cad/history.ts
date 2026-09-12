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
