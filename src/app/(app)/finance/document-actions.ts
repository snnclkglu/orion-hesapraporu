"use server";

// Özlük dosyası kaydı — BAYTLAR BURADAN GEÇMEZ.
//
// Tarayıcı dosyayı doğrudan `personnel` bucket'ına yükler, bu eylem yalnız
// TABLO SATIRINI yazar (`equipment_attachments` ile birebir aynı kalıp).
// Sebebi ölçülmüştür: Next.js server action gövdesinin varsayılan sınırı
// 1 MB'tır ve taranmış bir sözleşme bunu aşar.
//
// DOSYA BEYAN DEĞİL ÖLÇÜMLE KAYDA GİRER: sunucu yüklenen nesneyi geri indirir.
// PDF ise pdf-lib ile açılır ve sayfası SAYILIR; açılamayan dosya kayda
// GİRMEZ ve yüklenen nesne depodan silinir. Kullanıcı hatayı yüklerken görür,
// aylar sonra açılmayan bir özlük dosyasında değil.

import { revalidatePath } from "next/cache";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { canEditFinance, canSeeFinance } from "@/lib/roles";
import {
  MAX_DOCUMENT_BYTES,
  PERSONNEL_BUCKET,
  personnelStoragePath,
} from "@/lib/finance/personnel";
import { documentSchema, type DocumentInput, type FinanceActionResult } from "./schema";

// YOL KURALI SAF ÇEKİRDEKTEDİR (`lib/finance/personnel.ts`) ve İKİ TARAF DA
// oradan okur: tarayıcı yüklemeden önce, sunucu doğrulamadan önce. İki yerde
// ayrı yazılsaydı uzantı kuralındaki en küçük fark "dosya depoda bulunamadı"
// hatasına dönüşürdü. Sunucu yine de istemciden gelen bir YOLA GÜVENMEZ:
// parametrelerden yeniden üretir.

async function requireWrite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" } as const;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (!canSeeFinance(role) || !canEditFinance(role)) {
    return { error: "Özlük dosyalarına yalnız Yönetici ve Müdür erişebilir" } as const;
  }
  return { supabase, user } as const;
}

/**
 * Yüklenmiş bir dosyayı personelin özlük dosyasına kaydeder.
 *
 * Sıra: istemci `documentId` üretir → baytları `<employee_id>/<id>.<uzanti>`
 * yoluna yükler → BU EYLEM çağrılır.
 */
export async function registerDocument(input: DocumentInput): Promise<FinanceActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
  const d = parsed.data;

  if (d.sizeBytes > MAX_DOCUMENT_BYTES) {
    return { error: "Dosya 25 MB sınırını aşıyor." };
  }

  const path = await personnelStoragePath(d.employeeId, d.documentId, d.fileName);

  // ÖLÇÜM: dosya gerçekten depoda mı?
  const { data: file, error: indirmeHatasi } = await supabase.storage
    .from(PERSONNEL_BUCKET)
    .download(path);
  if (indirmeHatasi || !file) {
    return { error: "Yüklenen dosya depoda bulunamadı; yüklemeyi tekrarlayın." };
  }

  // PDF ise sayfası SAYILIR. PDF DIŞI dosya (taranmış jpg/png) için sayfa
  // sayısı 0'dır ve bu bir eksiklik DEĞİLDİR: görüntünün sayfası yoktur.
  // Ölçüm orada "dosya depoda ve okunabilir" olmasıdır — yukarıdaki indirme.
  let pageCount = 0;
  const pdfMi = path.endsWith(".pdf") || d.mimeType === "application/pdf";
  if (pdfMi) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch (e) {
      // Sıra burada TERSTİR (önce depo, sonra kayıt) ÇÜNKÜ HENÜZ KAYIT YOKTUR.
      await supabase.storage.from(PERSONNEL_BUCKET).remove([path]);
      return {
        error:
          e instanceof EncryptedPDFError
            ? "Bu PDF parola korumalı; açılamadı. Korumasız bir kopyasını yükleyin."
            : "Dosya PDF olarak açılamadı. Başka bir kopyasını deneyin.",
      };
    }
    if (pageCount === 0) {
      await supabase.storage.from(PERSONNEL_BUCKET).remove([path]);
      return { error: "Belgede hiç sayfa yok." };
    }
  }

  const { error } = await supabase.from("fin_employee_documents").insert({
    id: d.documentId,
    employee_id: d.employeeId,
    kind: d.kind,
    // Başlık boşsa dosya adı başlık olur: listede adsız bir satır kalmasın.
    title: d.title || d.fileName.replace(/\.[A-Za-z0-9]{1,8}$/, ""),
    file_name: d.fileName,
    storage_path: path,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes,
    page_count: pageCount,
    issued_on: d.issuedOn,
    expires_on: d.expiresOn,
    notes: d.notes,
    created_by: user.id,
  });
  if (error) {
    await supabase.storage.from(PERSONNEL_BUCKET).remove([path]);
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.document.add",
    detail: { employee_id: d.employeeId, kind: d.kind, file: d.fileName, pages: pageCount },
  });
  revalidatePath(`/finance/${d.employeeId}`);
  revalidatePath("/finance");
  return { ok: true, id: d.documentId };
}

/**
 * Belgeyi siler. SIRA: önce TABLO satırı, sonra depo nesnesi.
 *
 * Ters sırada depo temizlenip satır kalsaydı liste var olmayan bir belgeye
 * bağlanırdı. Bu sırada en kötü ihtimalle yetim bir nesne kalır ve o GERİ
 * ALINABİLİR bir hatadır.
 */
export async function deleteDocument(
  id: string,
  employeeId: string
): Promise<FinanceActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const { data: satir } = await supabase
    .from("fin_employee_documents")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();

  const { error, count } = await supabase
    .from("fin_employee_documents")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Belge silinemedi; yetkiniz olmayabilir." };

  const path = (satir as { storage_path?: string } | null)?.storage_path;
  if (path) await supabase.storage.from(PERSONNEL_BUCKET).remove([path]);

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.document.delete",
    detail: { id, employee_id: employeeId, file: (satir as { file_name?: string } | null)?.file_name },
  });
  revalidatePath(`/finance/${employeeId}`);
  return { ok: true };
}

/** Belgenin künyesini (tür, başlık, tarihler) düzeltir — baytlara dokunmaz. */
export async function updateDocumentMeta(
  id: string,
  employeeId: string,
  patch: { kind?: string; title?: string; issuedOn?: string | null; expiresOn?: string | null; notes?: string }
): Promise<FinanceActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return ctx;
  const { supabase } = ctx;

  const gun = (v: string | null | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

  const { error, count } = await supabase
    .from("fin_employee_documents")
    .update(
      {
        ...(patch.kind ? { kind: patch.kind } : {}),
        ...(patch.title !== undefined ? { title: patch.title.slice(0, 160) } : {}),
        ...(patch.issuedOn !== undefined ? { issued_on: gun(patch.issuedOn) } : {}),
        ...(patch.expiresOn !== undefined ? { expires_on: gun(patch.expiresOn) } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 500) } : {}),
      },
      { count: "exact" }
    )
    .eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Belge güncellenemedi; yetkiniz olmayabilir." };
  revalidatePath(`/finance/${employeeId}`);
  return { ok: true };
}

/**
 * Belgeyi açmak için KISA ÖMÜRLÜ imzalı bağlantı üretir.
 *
 * Bağlantı istemcide `supabase.storage.createSignedUrl` ile de üretilebilirdi
 * (uygulamanın başka yerlerinde öyle yapılıyor) ama BURADA SUNUCUDA üretilir
 * ve bu bilinçlidir: özlük dosyası kişisel veridir, imzalı bağlantı bir kez
 * üretildikten sonra oturum taşımaz. Sunucu tarafında üretmek erişimin
 * `can_see_finance()`ten geçtiğini ve DENETİM İZİNE yazıldığını garanti eder —
 * "bu sağlık raporunu kim açtı" sorusunun cevabı olur.
 */
export async function signDocumentUrl(
  id: string
): Promise<{ url?: string; fileName?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canSeeFinance((profile as { role?: string } | null)?.role)) {
    return { error: "Bu belgeye erişim yetkiniz yok" };
  }

  const { data: satir } = await supabase
    .from("fin_employee_documents")
    .select("storage_path, file_name, employee_id")
    .eq("id", id)
    .maybeSingle();
  const row = satir as { storage_path: string; file_name: string; employee_id: string } | null;
  if (!row) return { error: "Belge bulunamadı" };

  const { data, error } = await supabase.storage
    .from(PERSONNEL_BUCKET)
    .createSignedUrl(row.storage_path, 120);
  if (error || !data) return { error: error?.message ?? "Bağlantı üretilemedi" };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.document.open",
    detail: { id, employee_id: row.employee_id, file: row.file_name },
  });
  return { url: data.signedUrl, fileName: row.file_name };
}
