"use server";

// "Ek Belge" — ekipman satırına yüklenen PDF'in KAYIT ve SİLME katmanı.
//
// BAYTLAR BU ACTION'DAN GEÇMEZ. Dosyayı tarayıcı doğrudan depoya yükler
// (`folder-picker.tsx` ile aynı desen); server action yalnız kaydı yazar.
// Sebep: Next.js server action gövdesinin varsayılan sınırı 1 MB'tır ve
// taranmış tek bir katalog yaprağı bunu rahatça aşar; sınırı bütün uygulama
// için yükseltmek, tek bir ekran uğruna her action'ın yüzeyini genişletirdi.
//
// AMA SUNUCU DOSYAYI YİNE DE OKUR. Sayfa adedi bir BEYAN değil ÖLÇÜMdür
// (Teknik Resimler'in `verifyStorage` dersi, AGENTS RESIM-18): kayıt yazılmadan
// önce PDF depodan indirilip pdf-lib ile açılır ve sayfaları sayılır. Bu aynı
// zamanda dosyanın gerçekten okunabilir bir PDF olduğunun kanıtıdır — detaylı
// listeyi üreten uç aynı kütüphaneyle birleştirecek. Açılamayan dosya kayda
// GİRMEZ ve yüklenen nesne silinir: kullanıcı hatayı yüklerken görür, aylar
// sonra eksik basılmış bir destede değil.

import { revalidatePath } from "next/cache";
import { PDFDocument, EncryptedPDFError } from "pdf-lib";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { EQUIPMENT_ATTACHMENT_BUCKET } from "@/lib/equipment-attachments";

/** row_key biçimi `equipment_notes` ile AYNIDIR (`<modulKey>:<slug>`). */
const ROW_KEY = /^[A-Za-z0-9]+:[A-Za-z0-9]+$/;

const registerSchema = z.object({
  /** İstemcinin ürettiği kimlik; depo yolu da bunu taşır. */
  attachmentId: z.uuid("Geçersiz ek kimliği"),
  rowKey: z.string().trim().min(1).max(120).regex(ROW_KEY, "Geçersiz satır anahtarı"),
  fileName: z.string().trim().min(1).max(200),
  sort: z.number().int().min(0).max(999).default(0),
});

export type AttachmentResult = { ok?: boolean; error?: string; pageCount?: number };

/** Depo yolu SUNUCUDA kurulur; istemciden gelen bir yol asla kullanılmaz. */
function storagePathOf(revisionId: string, attachmentId: string): string {
  return `${revisionId}/${attachmentId}.pdf`;
}

/**
 * Yüklenmiş bir PDF'i ekipman satırına bağlar.
 *
 * İstemci dosyayı `storagePathOf` ile üretilen yola yükler; burası aynı yolu
 * BAĞIMSIZ olarak yeniden kurar ve öyle okur. İstemcinin gönderdiği bir yola
 * güvenmek, başka bir revizyonun ekini kendi listesine bağlamanın yolu olurdu.
 */
export async function registerEquipmentAttachment(
  projectId: string,
  revisionId: string,
  input: { attachmentId: string; rowKey: string; fileName: string; sort?: number }
): Promise<AttachmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsedRev = z.uuid("Geçersiz revizyon").safeParse(revisionId);
  if (!parsedRev.success) return { error: parsedRev.error.issues[0].message };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const path = storagePathOf(revisionId, parsed.data.attachmentId);

  const { data: file, error: indirmeHatasi } = await supabase.storage
    .from(EQUIPMENT_ATTACHMENT_BUCKET)
    .download(path);
  if (indirmeHatasi || !file) {
    return { error: "Yüklenen dosya depoda bulunamadı; yüklemeyi tekrarlayın." };
  }

  let pageCount = 0;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = pdf.getPageCount();
  } catch (e) {
    // Okunamayan dosya kayda girmez; yüklenen nesne de temizlenir. Sıra burada
    // TERSTİR (önce depo, sonra kayıt) ÇÜNKÜ HENÜZ KAYIT YOKTUR — "önce ucuz
    // olanı kaybet" kuralı satır ile nesne arasında seçim yapılırken geçerlidir.
    await supabase.storage.from(EQUIPMENT_ATTACHMENT_BUCKET).remove([path]);
    return {
      error:
        e instanceof EncryptedPDFError
          ? "Bu PDF parola korumalı; açılamadı. Korumasız bir kopyasını yükleyin."
          : "Dosya PDF olarak açılamadı. Başka bir kopyasını deneyin.",
    };
  }

  if (pageCount === 0) {
    await supabase.storage.from(EQUIPMENT_ATTACHMENT_BUCKET).remove([path]);
    return { error: "Belgede hiç sayfa yok." };
  }

  const { error } = await supabase.from("equipment_attachments").insert({
    id: parsed.data.attachmentId,
    revision_id: revisionId,
    row_key: parsed.data.rowKey,
    file_name: parsed.data.fileName,
    storage_path: path,
    page_count: pageCount,
    sort: parsed.data.sort,
    created_by: user.id,
  });
  if (error) {
    await supabase.storage.from(EQUIPMENT_ATTACHMENT_BUCKET).remove([path]);
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true, pageCount };
}

/**
 * Eki kaldırır.
 *
 * SIRA "ÖNCE UCUZ OLANI KAYBET"TİR (AGENTS, Teknik Resimler): önce TABLO
 * satırı silinir, sonra depo nesnesi. Ters sırada baytlar gidip kayıt kalsaydı
 * liste var olmayan bir eke bağlanır ve detaylı PDF her seferinde eksik
 * basılırdı. Bu sırada ise en kötü ihtimalle yetim bir nesne kalır — geri
 * alınabilir bir hata.
 */
export async function deleteEquipmentAttachment(
  projectId: string,
  revisionId: string,
  attachmentId: string
): Promise<AttachmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = z
    .object({ revisionId: z.uuid(), attachmentId: z.uuid() })
    .safeParse({ revisionId, attachmentId });
  if (!parsed.success) return { error: "Geçersiz ek kimliği" };

  const { data: row } = await supabase
    .from("equipment_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("revision_id", revisionId)
    .maybeSingle();
  if (!row) return { error: "Ek bulunamadı" };

  const { error } = await supabase
    .from("equipment_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("revision_id", revisionId);
  if (error) return { error: error.message };

  await supabase.storage
    .from(EQUIPMENT_ATTACHMENT_BUCKET)
    .remove([(row as { storage_path: string }).storage_path]);

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true };
}
