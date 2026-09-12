import { z } from "zod";
export const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Ad soyad gerekli").max(120),
    phone: z.string().trim().max(40),
    note: z.string().trim().max(500),
    version: z.number().int().positive(),
  })
  .strict();
export const feedbackCategories = {
  general: "Genel",
  bug: "Hata",
  idea: "Öneri",
  other: "Diğer",
} as const;
export const feedbackSchema = z
  .object({
    id: z.uuid(),
    body: z.string().trim().min(1, "Geri bildiriminizi yazın").max(4000),
    category: z.enum(["general", "bug", "idea", "other"]),
    section: z.string().max(60),
    files: z.number().int().min(0).max(3),
  })
  .strict();
export interface AccountData {
  id: string;
  name: string;
  email: string;
  title: string;
  role: string;
  phone: string;
  note: string;
  version: number;
  avatar: string | null;
  teams: { id: string; name: string }[];
}
export interface FeedbackItem {
  id: string;
  body: string;
  category: keyof typeof feedbackCategories;
  section: string;
  full_name: string;
  submitted_at: string;
  user_id: string;
  attachment_count?: number;
  read_at?: string | null;
  archived_at?: string | null;
  version?: number;
}
export interface FeedbackAttachment {
  id: string;
  object_path: string;
  name: string;
  bytes: number;
}
