"use server";

// ŞARTNAME — kayıt ve silme katmanı.
//
// BAYTLAR BU ACTION'DAN GEÇMEZ (`attachment-actions.ts` deseni): dosyayı
// tarayıcı doğrudan depoya yükler, burası yalnız kaydı yazar.
//
// AMA SUNUCU DOSYAYI YİNE DE OKUR. PDF ise depodan indirilip `pdf-lib` ile
// açılır ve sayfası SAYILIR — sayfa adedi bir BEYAN değil ÖLÇÜMdür ve aynı
// zamanda dosyanın gerçekten okunabilir bir PDF olduğunun kanıtıdır (el
// kitabının tam sürümü onu birleştirecek). Açılamayan PDF kayda GİRMEZ.
//
// PDF OLMAYAN BELGE REDDEDİLMEZ. Müşteri şartnameyi bazen Word olarak
// gönderiyor ve "yalnız PDF" demek belgeyi sistemin dışında bırakırdı; o
// dosya sayfasız kaydedilir, saklanır ve açılır — yalnız el kitabının ek
// yaprağına giremez ve bu ekranda görünür.

import { revalidatePath } from "next/cache";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { SPEC_BUCKET, specExtension } from "@/lib/project-specs";

const kayitSemasi = z.object({
  specId: z.uuid("Geçersiz şartname kimliği"),
  fileName: z.string().trim().min(1).max(250),
  contentType: z.string().trim().max(150).default(""),
  sizeBytes: z.number().int().min(0).max(52_428_800),
  revision: z.string().trim().max(40).default(""),
});

export type SpecResult = { ok?: boolean; error?: string; pageCount?: number };

async function yetki(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return { error: "Şartname yükleme yetkiniz yok." };
  }
  return { userId: user.id };
}

export async function registerProjectSpec(
  projectId: string,
  input: {
    specId: string;
    fileName: string;
    contentType?: string;
    sizeBytes: number;
    revision?: string;
  }
): Promise<SpecResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;

  const parsed = kayitSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const proje = z.uuid("Geçersiz proje").safeParse(projectId);
  if (!proje.success) return { error: proje.error.issues[0].message };

  const supabase = await createClient();
  // DEPO YOLU SUNUCUDA KURULUR; istemciden gelen bir yola asla güvenilmez
  // (`attachment-actions.ts` dersi: aksi hâlde başka bir projenin belgesi
  // kendi kaydına bağlanabilirdi). İstemci aynı yolu `specExtension` ile
  // BAĞIMSIZ olarak kurar ve oraya yükler.
  const yol = `${projectId}/${parsed.data.specId}.${specExtension(parsed.data.fileName)}`;

  const { data: dosya, error: indirmeHatasi } = await supabase.storage
    .from(SPEC_BUCKET)
    .download(yol);
  if (indirmeHatasi || !dosya) {
    return { error: "Yüklenen dosya depoda bulunamadı; yüklemeyi tekrarlayın." };
  }

  const pdfMi = specExtension(parsed.data.fileName) === "pdf";
  let pageCount = 0;
  if (pdfMi) {
    try {
      const bytes = new Uint8Array(await dosya.arrayBuffer());
      pageCount = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
    } catch (e) {
      // Okunamayan PDF kayda girmez; yüklenen nesne de temizlenir. Sıra burada
      // TERSTİR (önce depo, sonra kayıt) ÇÜNKÜ HENÜZ KAYIT YOKTUR.
      await supabase.storage.from(SPEC_BUCKET).remove([yol]);
      return {
        error:
          e instanceof EncryptedPDFError
            ? "Bu PDF parola korumalı; açılamadı. Korumasız bir kopyasını yükleyin."
            : "Dosya PDF olarak açılamadı. Başka bir kopyasını deneyin.",
      };
    }
    if (pageCount === 0) {
      await supabase.storage.from(SPEC_BUCKET).remove([yol]);
      return { error: "Belgede hiç sayfa yok." };
    }
  }

  await supabase
    .from("project_specs")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);

  const { error } = await supabase.from("project_specs").insert({
    id: parsed.data.specId,
    project_id: projectId,
    file_name: parsed.data.fileName,
    storage_path: yol,
    content_type: parsed.data.contentType ?? "",
    size_bytes: parsed.data.sizeBytes,
    page_count: pageCount,
    revision: parsed.data.revision ?? "",
    is_current: true,
    created_by: izin.userId,
  });
  if (error) {
    await supabase.storage.from(SPEC_BUCKET).remove([yol]);
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, pageCount };
}

/** Şartnameyi kaldırır — önce satır, sonra depo nesnesi. */
export async function deleteProjectSpec(
  projectId: string,
  specId: string
): Promise<SpecResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: satir } = await supabase
    .from("project_specs")
    .select("storage_path")
    .eq("id", specId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!satir) return { error: "Kayıt bulunamadı." };

  const { error } = await supabase
    .from("project_specs")
    .delete()
    .eq("id", specId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  await supabase.storage.from(SPEC_BUCKET).remove([String(satir.storage_path)]);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Hangi sürümün geçerli olduğunu değiştirir. */
export async function setCurrentSpec(projectId: string, specId: string): Promise<SpecResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  await supabase
    .from("project_specs")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);
  const { error } = await supabase
    .from("project_specs")
    .update({ is_current: true })
    .eq("id", specId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
