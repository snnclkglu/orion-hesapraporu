"use server";

// Teknik Resim Takibi defterinin yazma katmanı.
//
// DEFTER BİR BÜTÜN OLARAK KAYDEDİLİR (`saveWorkDay` ile aynı desen, AGENTS
// md. 17): gelen satırlar kimlikleriyle eşlenir, kalanlar güncellenir,
// listeden düşenler silinir. Alternatif — her satırı ayrı ayrı yazmak —
// mühendisin "önce numarayı 0100'den 0200'e al, sonra 0100'ü başka gruba ver"
// gibi tek bir düzenlemede yaptığı yer değiştirmelerde tekillik kısıtına
// (`unique (project_id, code)`) ARADA takılırdı: numara kısa bir an iki satırda
// birden dururdu. Bütün olarak kaydetmek bu ara durumu hiç doğurmaz — silmeler
// yazmalardan ÖNCE uygulanır.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  /** Var olan satırın kimliği; yeni satırda boş gelir. */
  id: z.string().trim().max(60).optional(),
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Grup kodu dört rakam olmalı (ör. 0100)"),
  name: z.string().trim().max(120).default(""),
  drawn: z.boolean().default(false),
  note: z.string().trim().max(300).default(""),
});

export type DrawingPlanInput = z.input<typeof rowSchema>;

const payloadSchema = z
  .array(rowSchema)
  // Ana grup sayısı gerçekte 10–25 arasındadır; sınır bir kota değil, kazara
  // gönderilmiş dev bir yükün kalkanıdır.
  .max(120, "Çok fazla satır")
  .superRefine((rows, ctx) => {
    const gorulen = new Set<string>();
    for (const r of rows) {
      if (gorulen.has(r.code)) {
        ctx.addIssue({
          code: "custom",
          message: `${r.code} numarası listede iki kez var — her ana gruba bir numara.`,
        });
        return;
      }
      gorulen.add(r.code);
    }
  });

export type DrawingPlanResult = {
  ok?: boolean;
  error?: string;
  /**
   * Kaydedilen satırların kod → kimlik eşlemesi.
   *
   * NEDEN GERİ DÖNER: yeni satırların kimliğini SUNUCU üretir. Ekran onu
   * öğrenmezse aynı satır ikinci kaydetmede yeniden EKLENMEYE çalışılır ve
   * `unique (project_id, code)` kısıtına takılır — kullanıcı hiçbir şey
   * değiştirmeden hata görürdü. `revalidatePath` bunu çözmez: istemci
   * durumundaki `dbId` alanı sunucu yeniden çizse de yerinde kalır.
   */
  saved?: { code: string; id: string }[];
};

/**
 * Projenin ana grup numaralandırmasını kaydeder.
 *
 * Yetki RLS'tedir (`can_edit_reports()`); buradaki kontrol yalnız kullanıcıya
 * anlaşılır bir cümle söylemek içindir — menüden gizlemek görgü kuralı, asıl
 * engel politikadır (AGENTS md. 15).
 */
export async function saveDrawingPlan(
  projectId: string,
  rows: DrawingPlanInput[]
): Promise<DrawingPlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsedId = z.uuid("Geçersiz hesap raporu").safeParse(projectId);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };

  const parsed = payloadSchema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: mevcut } = await supabase
    .from("project_drawing_plan")
    .select("id")
    .eq("project_id", projectId);

  const kalanIds = new Set(
    parsed.data.map((r) => (r.id ?? "").trim()).filter(Boolean)
  );
  const silinecek = ((mevcut ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !kalanIds.has(id));

  // ÖNCE SİLME: yer değiştiren numaraların tekillik kısıtına takılmaması için
  // (dosya başlığındaki gerekçe).
  if (silinecek.length > 0) {
    const { error } = await supabase
      .from("project_drawing_plan")
      .delete()
      .eq("project_id", projectId)
      .in("id", silinecek);
    if (error) return { error: error.message };
  }

  const simdi = new Date().toISOString();
  const ortak = (r: (typeof parsed.data)[number]) => ({
    project_id: projectId,
    code: r.code,
    name: r.name,
    drawn: r.drawn,
    note: r.note,
    updated_at: simdi,
    updated_by: user.id,
  });

  // YENİ ve VAR OLAN satırlar AYRI yazılır. Tek bir `upsert` ile yazılsaydı
  // `created_by` her kaydetmede o anki kullanıcıya dönerdi: defteri açan kişi
  // bilgisi ilk düzenlemede sessizce silinirdi. Alan, güncelleme yükünde hiç
  // GEÇMEZ — `on conflict do update` yalnız gönderilen sütunları yazar.
  const yeniler = parsed.data
    .filter((r) => !(r.id ?? "").trim())
    .map((r) => ({ id: crypto.randomUUID(), ...ortak(r), created_by: user.id }));
  const guncellenenler = parsed.data
    .filter((r) => (r.id ?? "").trim())
    .map((r) => ({ id: (r.id ?? "").trim(), ...ortak(r) }));

  const yazmaHatasi = (error: { code?: string; message: string }) =>
    error.code === "23505"
      ? "Bu numara projede zaten kullanılıyor — her ana gruba bir numara."
      : error.message;

  if (guncellenenler.length > 0) {
    const { error } = await supabase
      .from("project_drawing_plan")
      .upsert(guncellenenler, { onConflict: "id" });
    if (error) return { error: yazmaHatasi(error) };
  }
  if (yeniler.length > 0) {
    const { error } = await supabase.from("project_drawing_plan").insert(yeniler);
    if (error) return { error: yazmaHatasi(error) };
  }
  const yazilacak = [...yeniler, ...guncellenenler];

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: "drawingPlan.save",
    detail: { groups: yazilacak.length, removed: silinecek.length },
  });

  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    saved: yazilacak.map((r) => ({ code: r.code, id: r.id })),
  };
}
