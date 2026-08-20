"use server";

// ELEKTRİK PROJESİ — kayıt, sürüm seçimi ve silme.
//
// BAYTLAR BU ACTION'DAN GEÇMEZ. Dosyayı tarayıcı doğrudan depoya yükler
// (`equipment/attachment-actions.ts` ile aynı desen): server action gövdesinin
// varsayılan sınırı 1 MB'tır ve gerçek bir elektrik projesi 12 MB'tır.
//
// OKUMA BURADA DEĞİL, ROUTE HANDLER'DA. `unpdf` Node çalışma zamanı ister ve
// 157 sayfalık bir belgeyi ~2 saniyede okur; server action bunu taşıyabilirdi
// ama içtirme uçları evin bu iş için kullandığı yoldur (`drawings/[id]/import`)
// ve ilerlemeyi kullanıcıya göstermeyi kolaylaştırır.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requestPermanentDeletion } from "@/lib/deletion-request-server";
import { canEditReports } from "@/lib/roles";
import { ELECTRICAL_BUCKET } from "@/lib/electrical/data";

const kayitSemasi = z.object({
  /** İstemcinin ürettiği kimlik; depo yolu da bunu taşır. */
  docId: z.uuid("Geçersiz belge kimliği"),
  fileName: z.string().trim().min(1).max(250),
  revision: z.string().trim().max(40).default(""),
  sizeBytes: z.number().int().min(0).max(157_286_400),
});

export type ElectricalResult = { ok?: boolean; error?: string; docId?: string };

/** Depo yolu SUNUCUDA kurulur; istemciden gelen bir yola asla güvenilmez. */
function depoYolu(projectId: string, docId: string): string {
  return `${projectId}/${docId}.pdf`;
}

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
    return { error: "Elektrik projesi yükleme yetkiniz yok." };
  }
  return { userId: user.id };
}

/**
 * Yüklenmiş bir PDF'i projeye bağlar.
 *
 * Satır önce YAZILIR, okuma AYRI bir adımdır: 157 sayfalık bir belgeyi okumak
 * saniyeler sürer ve o sürede tarayıcı kapanırsa kullanıcı yüklediği dosyayı
 * kaybetmiş olurdu. Okunmamış bir yükleme `parsed_at = null` ile görünür ve
 * ekranda "Malzemeyi Oku" düğmesi taşır.
 */
export async function registerElectricalDoc(
  projectId: string,
  input: { docId: string; fileName: string; revision?: string; sizeBytes: number }
): Promise<ElectricalResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;

  const parsed = kayitSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const proje = z.uuid("Geçersiz proje").safeParse(projectId);
  if (!proje.success) return { error: proje.error.issues[0].message };

  const supabase = await createClient();
  const yol = depoYolu(projectId, parsed.data.docId);

  // Dosyanın DEPODA OLDUĞU doğrulanır: istemcinin "yükledim" demesi bir
  // beyandır (`attachment-actions.ts` dersi). Baytları burada AÇMAYIZ —
  // 12 MB'ı action'a indirmek gereksiz; PDF geçerliliğini okuma adımı ölçer.
  const { data: liste, error: listeHatasi } = await supabase.storage
    .from(ELECTRICAL_BUCKET)
    .list(projectId, { search: `${parsed.data.docId}.pdf`, limit: 1 });
  if (listeHatasi || !liste || liste.length === 0) {
    return { error: "Yüklenen dosya depoda bulunamadı; yüklemeyi tekrarlayın." };
  }

  // YENİ YÜKLEME GÜNCEL OLUR ve eskisi güncellikten düşer. Kısmi tekil indeks
  // iki "güncel" satıra izin vermez, o yüzden önce eskiyi indiririz.
  await supabase
    .from("electrical_projects")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);

  const { error } = await supabase.from("electrical_projects").insert({
    id: parsed.data.docId,
    project_id: projectId,
    file_name: parsed.data.fileName,
    revision: parsed.data.revision ?? "",
    storage_path: yol,
    size_bytes: parsed.data.sizeBytes,
    is_current: true,
    created_by: izin.userId,
  });
  if (error) {
    await supabase.storage.from(ELECTRICAL_BUCKET).remove([yol]);
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, docId: parsed.data.docId };
}

/** Hangi sürümün geçerli olduğunu değiştirir. */
export async function setCurrentElectricalDoc(
  projectId: string,
  docId: string
): Promise<ElectricalResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  await supabase
    .from("electrical_projects")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);

  const { error } = await supabase
    .from("electrical_projects")
    .update({ is_current: true })
    .eq("id", docId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Sürüm etiketini elle düzeltir. */
export async function renameElectricalRevision(
  projectId: string,
  docId: string,
  revision: string
): Promise<ElectricalResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const temiz = revision.trim().slice(0, 40);
  const supabase = await createClient();
  const { error } = await supabase
    .from("electrical_projects")
    .update({ revision: temiz })
    .eq("id", docId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Elektrik projesinin kalıcı silinmesini Yönetici onay kuyruğuna yollar. */
export async function deleteElectricalDoc(
  projectId: string,
  docId: string
): Promise<ElectricalResult> {
  return requestPermanentDeletion({
    entityType: "electrical_project",
    targetId: docId,
    context: { project_id: projectId },
  });
}
