// İş Takibi Zod şemaları. "use server" DEĞİL — şemalar runtime değerdir ve
// server action dosyasından export edilemez (satış/iş emri modülüyle aynı desen).

import { z } from "zod";

/** ISO gün (yyyy-mm-dd). Saat taşımaz: kayıt bir GÜNE aittir. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih gg.aa.yyyy biçiminde olmalı");

/**
 * Tek bir çalışma satırı.
 *
 * ÜST SINIRLAR bilinçli olarak GENİŞTİR. Devralınan kayıtta "3 kişi × 112 saat"
 * ve "100 kişi × 8 saat" gibi satırlar var: bunlar bir günün değil, o güne
 * yazılan bir toplu işin kaydıdır. Saati 24'le sınırlamak o kayıtları
 * girilemez yapardı; sınır yalnız açık bir yazım hatasını (sıfır, negatif,
 * dört haneli sayı) keser.
 */
export const workLogRowSchema = z.object({
  /** Var olan satırın kimliği; yeni satırda null */
  id: z.uuid().nullable(),
  itemNo: z.string().trim().max(40, "Kalem no en çok 40 karakter"),
  partId: z.uuid("Parça seçilmeli"),
  categoryId: z.uuid("İmalat türü seçilmeli"),
  partCode: z.string().trim().max(20).default(""),
  people: z
    .number()
    .int("Kişi sayısı tam sayı olmalı")
    .min(1, "En az 1 kişi")
    .max(999, "Kişi sayısı çok büyük"),
  hours: z
    .number()
    .positive("Saat sıfırdan büyük olmalı")
    .max(999, "Saat çok büyük"),
  note: z.string().trim().max(500).default(""),
});

export type WorkLogRowInput = z.infer<typeof workLogRowSchema>;

/** Bir günün tamamı — ekran günü bir bütün olarak kaydeder. */
export const workDaySchema = z.object({
  date: isoDate,
  rows: z.array(workLogRowSchema).max(200, "Bir güne en çok 200 satır girilebilir"),
});

export type WorkDayInput = z.infer<typeof workDaySchema>;

export const workPartSchema = z.object({
  name: z.string().trim().min(2, "Parça adı en az 2 karakter").max(80),
});

export const workCategorySchema = z.object({
  name: z.string().trim().min(2, "İmalat türü en az 2 karakter").max(80),
  colorHue: z.number().int().min(0).max(359),
});

/** Eşleşmemiş kalem numarasını gerçek bir iş kalemine bağlama. */
export const remapItemSchema = z.object({
  fromItemNo: z.string().trim().min(1, "Kaynak kalem no gerekli").max(40),
  jobItemId: z.uuid("Hedef iş kalemi seçilmeli"),
  /** Kayıtlardaki metin de hedefin numarasına çevrilsin mi? */
  rewriteItemNo: z.boolean().default(true),
});
