"use server";

// İş emri (jobs) server action'ları. İş Emri = form FR.11.02: başlık bilgileri +
// müşteri + iş bilgileri + kapsam + iş kalemleri (job_items) + hazırlayan.
// İş = birden çok vinç (projects.job_id) ve birden çok iş kalemi (job_items).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/job-status";
import { autoShortName, nextDistinctHue } from "@/lib/tags";
import { notifyTargets } from "@/lib/jobs/notify";
import { isOlayiYaz } from "./events";
import { bildirimYaz } from "./notify-write";
import {
  CUSTOMER_COLUMNS,
  customerInputSchema,
  jobInputSchema,
  type CustomerInput,
  type CustomerOption,
  type JobInput,
  type JobItemInput,
} from "./schema";
export type { JobInput, JobItemInput } from "./schema";

export type ActionResult = { error?: string };

/** jobs tablosu satırı (items hariç header alanları) */
function jobRowFrom(input: JobInput) {
  const { items: _items, ...rest } = input;
  void _items;
  return rest;
}

/** Boş (tamamen doldurulmamış) iş kalemlerini ele, sort ata */
function cleanItems(items: JobItemInput[]) {
  return items
    .filter((it) => it.product_name.trim() || it.item_no.trim())
    .map((it, i) => ({ ...it, sort: i }));
}

export async function createJob(input: JobInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ ...jobRowFrom(parsed.data), created_by: user.id })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Bu iş no zaten kayıtlı" : error.message };
  }

  const items = cleanItems(parsed.data.items);
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("job_items")
      .insert(items.map((it) => ({ ...it, job_id: job.id })));
    if (itemsError) return { error: itemsError.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.create",
    detail: { job_id: job.id, job_no: parsed.data.job_no, title: parsed.data.title },
  });
  // audit_log KALIR (yönetici denetimi), olay defteri EK yazılır: işin kendi
  // "Akış" sekmesi audit'i okuyamaz — orada job_id sütunu yok.
  await isOlayiYaz(supabase, {
    jobId: job.id,
    jobNo: parsed.data.job_no,
    event: "olusturuldu",
    detail: { title: parsed.data.title, kalem: items.length },
    actor: user.id,
  });

  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(jobId: string, input: JobInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // REVİZYON OLAYI İÇİN ÖNCEKİ HARF YAZMADAN ÖNCE OKUNUR — "neyden neye"
  // bilgisi olayın kendisidir ve sonradan geri hesaplanamaz (durum yazımıyla
  // aynı gerekçe). Sütun migration bekliyorsa sorgu hata döner ve harf boş
  // kalır: olay yazılmaz, iş emri güncellemesi etkilenmez.
  const { data: onceki } = await supabase
    .from("jobs")
    .select("revision")
    .eq("id", jobId)
    .maybeSingle();
  const eskiRev = (onceki as { revision?: string } | null)?.revision ?? "";

  const { error } = await supabase
    .from("jobs")
    .update(jobRowFrom(parsed.data))
    .eq("id", jobId);
  if (error) {
    return { error: error.code === "23505" ? "Bu iş no zaten kayıtlı" : error.message };
  }

  // İŞ KALEMLERİ TAM YENİLENİR ve bu yol satır KİMLİKLERİNİ değiştirir.
  //
  // Kimliğe bağlı ne varsa `item_no` METNİ üzerinden geri kurulmalıdır — proje
  // bağlantısı baştan beri böyle korunuyordu; RESİM ÇARPANI (`qty`) ve KALEM
  // EŞLEŞTİRMESİ (`shares_drawings_with`) de aynı yolu izler. Korunmasalardı
  // iş emrini bir kez düzenlemek bütün satın alma adetlerini "belirsiz" yapardı
  // ve kullanıcı bunu ancak yanlış sipariş verdiğinde fark ederdi.
  //
  // Eşleştirme İKİ ADIMDA yazılır: hedef satır INSERT edilmeden ona işaret
  // eden bir satır yazılamaz (yabancı anahtar), bu yüzden önce kalemler
  // açılır, sonra bağlar kurulur.
  const zenginOkuma = await supabase
    .from("job_items")
    .select("item_no, project_id, qty, shares_drawings_with, id")
    .eq("job_id", jobId);
  const carpanSutunlariVar = !zenginOkuma.error;
  const existing = carpanSutunlariVar
    ? zenginOkuma.data
    : (await supabase.from("job_items").select("item_no, project_id, id").eq("job_id", jobId)).data;

  const linkByNo = new Map<string, string>();
  const qtyByNo = new Map<string, number>();
  /** eski kimlik → kalem no; eşleştirmeyi numaraya çevirmek için. */
  const noById = new Map<string, string>();
  const shareByNo = new Map<string, string>();
  for (const r of (existing ?? []) as Record<string, unknown>[]) {
    const no = String(r.item_no ?? "");
    if (r.project_id && no) linkByNo.set(no, r.project_id as string);
    if (r.id && no) noById.set(String(r.id), no);
    if (r.qty != null && no) qtyByNo.set(no, Number(r.qty));
  }
  for (const r of (existing ?? []) as Record<string, unknown>[]) {
    const no = String(r.item_no ?? "");
    const hedef = r.shares_drawings_with as string | null | undefined;
    if (no && hedef && noById.has(hedef)) shareByNo.set(no, noById.get(hedef)!);
  }

  await supabase.from("job_items").delete().eq("job_id", jobId);

  const items = cleanItems(parsed.data.items);
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("job_items").insert(
      items.map((it) => ({
        ...it,
        job_id: jobId,
        project_id: linkByNo.get(it.item_no) ?? null,
        ...(carpanSutunlariVar ? { qty: qtyByNo.get(it.item_no) ?? null } : {}),
      }))
    );
    if (itemsError) return { error: itemsError.message };

    if (carpanSutunlariVar && shareByNo.size > 0) {
      const { data: yeni } = await supabase
        .from("job_items")
        .select("id, item_no")
        .eq("job_id", jobId);
      const idByNo = new Map(
        ((yeni ?? []) as { id: string; item_no: string }[]).map((r) => [r.item_no, r.id])
      );
      for (const [no, hedefNo] of shareByNo) {
        const kaynak = idByNo.get(no);
        const hedef = idByNo.get(hedefNo);
        // Kalem numarası değişmiş (ör. `autoItemNos` kaydırmış) ya da kalem
        // silinmişse bağ SESSİZCE DÜŞER — yanlış bir kaleme bağlamaktansa
        // bağsız kalmak iyidir; kullanıcı kartta yeniden kurabilir.
        if (kaynak && hedef && kaynak !== hedef) {
          await supabase
            .from("job_items")
            .update({ shares_drawings_with: hedef })
            .eq("id", kaynak);
        }
      }
    }
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.update",
    detail: { job_id: jobId, job_no: parsed.data.job_no, revision: parsed.data.revision },
  });
  // REVİZYON AYRI BİR OLAYDIR. "Güncellendi" satırı her kaydetmede yazılır ve
  // aralarında hangisinin YAYIMLANMIŞ bir revizyon olduğu görünmezdi; belgenin
  // kimliği (`ORC-IE-0063-RB`) o harften türediği için işin biyografisinde
  // ayrı durmalıdır.
  const revizyonDegisti = Boolean(eskiRev) && eskiRev !== parsed.data.revision;
  await isOlayiYaz(supabase, {
    jobId,
    jobNo: parsed.data.job_no,
    event: revizyonDegisti ? "revize" : "guncellendi",
    detail: revizyonDegisti
      ? { kalem: items.length, from: eskiRev, to: parsed.data.revision }
      : { kalem: items.length },
    actor: user.id,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

/**
 * Tek işin durum yazımı + olay + bildirim — tekli ve TOPLU yol aynı gövdeyi
 * çağırır; iki yazım, birinde düzeltilen bir kuralın ötekinde kalması demekti.
 */
async function durumYazVeBildir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  status: JobStatus
): Promise<ActionResult> {
  // Eski durum yazmadan ÖNCE okunur: "neyden neye" bilgisi olayın kendisidir
  // ve sonradan geri hesaplanamaz.
  const { data: onceki } = await supabase
    .from("jobs")
    .select("job_no, status")
    .eq("id", jobId)
    .maybeSingle();

  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: userId,
    action: "job.status",
    detail: { job_id: jobId, status },
  });
  await isOlayiYaz(supabase, {
    jobId,
    jobNo: (onceki as { job_no?: string } | null)?.job_no ?? "",
    event: "durum",
    detail: { from: (onceki as { status?: string } | null)?.status ?? null, to: status },
    actor: userId,
  });

  // Bildirim: favorileyenler ∪ açık görev sahipleri (değiştiren hariç).
  // Favori satırları sahibine kapalıdır; liste DAR bir security definer
  // geçitten okunur (job_favorite_user_ids). Tablolar migration bekliyorsa
  // sorgular hata döner ve hedef listesi boş kalır — bildirim yazılmaz.
  const jobNo = (onceki as { job_no?: string } | null)?.job_no ?? "";
  const [favlar, gorevliler] = await Promise.all([
    supabase.rpc("job_favorite_user_ids", { p_job_id: jobId }),
    supabase.from("job_tasks").select("assignee").eq("job_id", jobId).is("done_at", null),
  ]);
  await bildirimYaz(supabase, {
    targets: notifyTargets({
      kind: "durum_degisti",
      actorId: userId,
      favoriteUserIds: favlar.error
        ? []
        : ((favlar.data ?? []) as unknown as string[]),
      openTaskAssigneeIds: gorevliler.error
        ? []
        : ((gorevliler.data ?? []) as { assignee: string | null }[]).map(
            (g) => g.assignee
          ),
    }),
    kind: "durum_degisti",
    jobId,
    jobNo,
    title: `${jobNo} · Durum: ${JOB_STATUS_LABELS[status]}`,
    href: `/jobs/${jobId}`,
    actor: userId,
  });

  return {};
}

/**
 * İşin durumunu değiştirir (Aktif · Pasif · Tamamlandı · Arşiv).
 *
 * Liste satırından ve iş detayından tek tıkla çağrılır; bu yüzden yönlendirme
 * YAPMAZ, yalnız ilgili sayfaları tazeler.
 */
export async function setJobStatus(
  jobId: string,
  status: JobStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  if (!JOB_STATUSES.includes(status)) return { error: "Geçersiz iş durumu" };

  const res = await durumYazVeBildir(supabase, user.id, jobId, status);
  if (res.error) return res;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return {};
}

/**
 * TOPLU durum değişikliği (kullanıcı onayı, 16.08.2026 — çoklu seçim).
 * Her iş TEKLİ yolun gövdesinden geçer: olay, denetim ve bildirim tek tek
 * yazılır — toplu bir UPDATE üçünü de sessizce atlardı. Seçim onlarla
 * ölçülür; N ayrı yazım bilinçli bir bedeldir.
 */
export async function bulkSetJobStatus(
  jobIds: string[],
  status: JobStatus
): Promise<ActionResult & { updated?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  if (!JOB_STATUSES.includes(status)) return { error: "Geçersiz iş durumu" };
  if (jobIds.length === 0) return { error: "Seçili iş yok" };
  if (jobIds.length > 100) return { error: "Tek seferde en çok 100 iş" };

  let updated = 0;
  for (const id of jobIds) {
    const res = await durumYazVeBildir(supabase, user.id, id, status);
    if (!res.error) updated += 1;
  }

  revalidatePath("/jobs");
  return { updated };
}

/**
 * İşi kalıcı olarak siler. `job_items` cascade ile gider; bağlı hesap raporları
 * SİLİNMEZ — `projects.job_id` null'a düşer (raporun kendi ömrü vardır).
 * RLS silmeyi yalnız yöneticiye açar; yetkisiz çağrı sessizce başarısız
 * olmasın diye satır sayısı kontrol edilir.
 */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .select("id, job_no");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "İş silinemedi — silme yetkisi yalnız yöneticidedir." };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.delete",
    detail: { job_id: jobId },
  });
  // job_id FK `set null`a düşer; kimlik kopyalanan job_no ile yaşar.
  await isOlayiYaz(supabase, {
    jobId: null,
    jobNo: (data[0] as { job_no?: string }).job_no ?? "",
    event: "silindi",
    detail: { job_id: jobId },
    actor: user.id,
  });

  revalidatePath("/jobs");
  return {};
}

// ------------------------------------------------------------------ müşteri

/**
 * Müşteri defterine yeni kayıt açar ve kaydı geri döner — form açılır listeyi
 * yeniden yüklemeden seçebilsin diye. Aynı ada sahip kayıt varsa MEVCUT kayıt
 * döner (unique index büyük/küçük harf duyarsızdır); mükerrer müşteri açılmaz.
 *
 * Renk BURADA seçilir, veritabanı varsayılanına bırakılmaz: defterdeki tonlar
 * okunup en uzak boşluk bulunur (`nextDistinctHue`), böylece yeni müşteri
 * listede komşularına benzemeyen bir renk alır.
 */
export async function createCustomer(
  input: CustomerInput
): Promise<{ error?: string; customer?: CustomerOption }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: used } = await supabase.from("customers").select("color_hue");
  const hue = nextDistinctHue(
    (used ?? []).map((r) => Number((r as { color_hue: number }).color_hue) || 0)
  );

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...parsed.data,
      short_name: parsed.data.short_name || autoShortName(parsed.data.name),
      color_hue: hue,
      created_by: user.id,
    })
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    if (error.code !== "23505") return { error: error.message };
    // Aynı isim zaten kayıtlı: kullanıcıyı hata ile durdurmak yerine mevcut
    // kaydı döndürüp seçilmesini sağlıyoruz.
    const { data: existing } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .ilike("name", parsed.data.name)
      .maybeSingle();
    if (!existing) return { error: "Bu müşteri zaten kayıtlı." };
    return { customer: existing as CustomerOption };
  }

  revalidatePath("/jobs");
  revalidatePath("/admin/customers");
  return { customer: data as CustomerOption };
}
