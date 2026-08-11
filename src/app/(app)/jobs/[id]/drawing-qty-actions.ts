"use server";

// Resim çarpanı — iş kaleminin SAYISAL adedi ve kalem eşleştirmesi.
//
// AYRI BİR EYLEM DOSYASI, `jobs/actions.ts`teki `updateJob` DEĞİL. Gerekçe
// yapısaldır: `updateJob` iş kalemlerini SİLİP YENİDEN YAZAR (iş emri formu
// bütün listeyi bir bütün olarak gönderir) ve o yolda satır kimlikleri her
// kaydetmede değişir. `shares_drawings_with` bir kimliğe işaret ettiği için
// o yola konsaydı her düzenlemede kopardı.
//
// Burada satır YERİNDE güncellenir: kimlik korunur, bağ yaşar.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type QtyActionResult = { error?: string; ok?: boolean };

const setQtySchema = z.object({
  itemId: z.uuid(),
  /**
   * `null` = BİLİNMİYOR. Sıfır ya da 1 varsayılmaz: sessiz bir varsayım, üç
   * adetlik bir işi bir adet sipariş ettirmenin en kolay yoludur. Ekran
   * belirsizliği açıkça yazar ve kullanıcıdan doldurmasını ister.
   */
  qty: z.number().int().min(1).max(10000).nullable(),
});

const shareSchema = z.object({
  itemId: z.uuid(),
  /** `null` = paylaşımı kaldır (kalem kendi resimlerini taşır). */
  targetId: z.uuid().nullable(),
});

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." as const };
  return { supabase };
}

function tazele(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  // SATIN ALMA HAVUZU BU SAYIYI ÇARPAN OLARAK OKUR — tazelemeyi unutmak,
  // adedi düzelten kullanıcının havuzda eski sayıyı görmesi demekti.
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/siparisler");
}

/** İş kaleminin sayısal adedini yazar (teknik resim ve satın alma çarpanı). */
export async function setItemQty(
  jobId: string,
  input: { itemId: string; qty: number | null }
): Promise<QtyActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };

  const parsed = setQtySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Adet 1 ile 10.000 arasında bir tam sayı olmalı (ya da boş)." };
  }

  const { error } = await c.supabase
    .from("job_items")
    .update({ qty: parsed.data.qty })
    .eq("id", parsed.data.itemId);
  if (error) {
    // Sütun henüz yoksa (migration uygulanmamış) anlaşılır bir mesaj ver:
    // "column does not exist" kullanıcıya hiçbir şey söylemez.
    return {
      error: error.message.includes("qty")
        ? "Adet sütunu henüz kurulmamış; migration uygulanmalı."
        : error.message,
    };
  }
  tazele(jobId);
  return { ok: true };
}

/**
 * Kalemin resimlerini başka bir kaleme bağlar (ya da bağı kaldırır).
 *
 * ZİNCİR VE DÖNGÜ VERİTABANINDA KESİLİR (`guard_item_share` tetikleyicisi);
 * buradaki kontrol yalnız anlaşılır bir mesaj içindir. Kural VERİNİN
 * kuralıdır: aynı satır içe aktarımla ya da doğrudan SQL ile de yazılabilir
 * ve arayüzde engellemek yetmez.
 */
export async function setItemShare(
  jobId: string,
  input: { itemId: string; targetId: string | null }
): Promise<QtyActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };

  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { error: "Geçersiz kalem seçimi." };
  if (parsed.data.targetId === parsed.data.itemId) {
    return { error: "Bir kalem kendi resimlerini kendisiyle paylaşamaz." };
  }

  const { error } = await c.supabase
    .from("job_items")
    .update({ shares_drawings_with: parsed.data.targetId })
    .eq("id", parsed.data.itemId);
  if (error) {
    return {
      error: error.message.includes("shares_drawings_with")
        ? "Kalem eşleştirme sütunu henüz kurulmamış; migration uygulanmalı."
        : error.message,
    };
  }
  tazele(jobId);
  return { ok: true };
}
