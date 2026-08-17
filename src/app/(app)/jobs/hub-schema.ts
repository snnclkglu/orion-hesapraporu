// İş hub'ının (görev + yorum) Zod şemaları. "use server" DEĞİL — şemalar
// runtime değer olduğundan action dosyasında export edilemez; hem server
// action hem istemci formlar buradan okur (jobs/schema.ts kalıbı).

import { z } from "zod";

const dateOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const uuidOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Geçersiz kayıt");

/**
 * Görev başlığı SERBEST METİNDİR, ad alanı değil: "Sözleşme PDF'ini yükle"
 * bir talimattır ve BÜYÜK HARF kuralı (IS-14) ad alanlarını kapsar —
 * talimatı bağırtmak okunurluğu düşürürdü.
 */
export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Görev başlığı gerekli").max(200),
  note: z.string().trim().max(1000).default(""),
  assignee: uuidOrNull,
  due_date: dateOrNull,
  /** Kalem bağlamı METİNDİR (md. 17) — kalem silinse de görev yaşar. */
  item_no: z.string().trim().max(40).default(""),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const commentInputSchema = z.object({
  body: z.string().trim().min(1, "Yorum boş olamaz").max(4000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;
