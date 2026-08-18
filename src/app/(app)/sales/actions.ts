"use server";

// Satış Takibi server action'ları.
//
// Yetki İKİ KEZ sorulur: burada net bir hata mesajı üretmek için, RLS'te ise
// asıl engel olarak. Arayüzden gizlemek tek başına yeterli değildir — sayfa
// adresi doğrudan yazılabilir.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { allItemsShipped, autoCompletesOnShipment } from "@/lib/job-status";
import { isOlayiYaz } from "@/app/(app)/jobs/events";
import { bildirimYaz } from "@/app/(app)/jobs/notify-write";
import { notifyTargets } from "@/lib/jobs/notify";
import { saleInputSchema, type SaleInput } from "./schema";

export type SalesActionResult = {
  error?: string;
  ok?: boolean;
  /**
   * Sevk tarihi girildiği için işin durumu KENDİLİĞİNDEN "Tamamlandı" olduysa
   * işin numarası. Pencere bunu ayrı bir bildirimle söyler — GÖRÜNMEYEN İŞ
   * OLMAYAN İŞTİR: kullanıcı, başka bir sayfadaki bir kaydın sessizce
   * değiştiğini fark edemez ve sonra onu bir arıza olarak bildirir.
   */
  jobCompleted?: string;
};

async function requireSalesAccess() {
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
  if (!canSeeSales(profile?.role)) {
    return { error: "Satış bilgilerine yalnız Yönetici ve Müdür erişebilir" } as const;
  }
  return { supabase, user } as const;
}

/**
 * SEVK TARİHİ GİRİLDİ → İŞ "TAMAMLANDI" (kullanıcı kararı, 13.08.2026).
 *
 * Kural saf çekirdekte tanımlıdır (`lib/job-status.ts`): işin BÜTÜN kalemleri
 * sevk edilmişse ve iş hâlâ VARSAYILAN durumdaysa (`active`) durum
 * "Tamamlandı"ya çekilir. Kullanıcının istediği manuel müdahale güvencesi tam
 * da buradadır — Pasif/Tamamlandı/Arşiv bir insan kararıdır ve otomatik kural
 * onlara dokunmaz.
 *
 * TETİKLEYİCİ DEĞİL EYLEM: kural iki tablonun (kalemler + ticari kayıtlar)
 * kesişiminden okunur ve `jobs`a yazar; bunu bir veritabanı tetikleyicisiyle
 * yapmak `security definer` bir yol açmayı gerektirirdi. Buna karşılık BEDELİ
 * yazılıdır: doğrudan SQL ile girilen bir sevk tarihi durumu değiştirmez.
 *
 * SESSİZ ÇALIŞMAZ: değişiklik denetim izine yazılır ve çağırana bildirilir.
 *
 * Yalnız SEVK TARİHİNİN YENİ GİRİLDİĞİ kaydetmede çağrılır (`onceSevkli`
 * false idi): fiyat düzeltmek için açılan bir pencere, kullanıcının elle
 * Aktif'e çektiği bir işi yeniden tamamlamamalıdır.
 */
async function sevkSonrasiIsiTamamla(
  supabase: SupabaseClient,
  userId: string,
  jobItemId: string
): Promise<string | undefined> {
  const { data: kalem } = await supabase
    .from("job_items")
    .select("job_id")
    .eq("id", jobItemId)
    .maybeSingle();
  const jobId = (kalem as { job_id?: string } | null)?.job_id;
  if (!jobId) return undefined;

  const { data: is } = await supabase
    .from("jobs")
    .select("job_no, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!is || !autoCompletesOnShipment((is as { status?: string }).status)) return undefined;

  // İki AYRI sorgu, gömülü ilişki DEĞİL: `job_item_sales` satırları önceden
  // üretilmez, yani "kaydı hiç olmayan kalem" de bir cevaptır ve sol
  // birleştirmenin boş tarafını saymak gerekir.
  const { data: kalemler } = await supabase
    .from("job_items")
    .select("id")
    .eq("job_id", jobId);
  const kimlikler = ((kalemler ?? []) as { id: string }[]).map((k) => k.id);
  if (kimlikler.length === 0) return undefined;

  const { data: sevkliler } = await supabase
    .from("job_item_sales")
    .select("job_item_id")
    .in("job_item_id", kimlikler)
    .not("shipment_date", "is", null);
  const sevkliKume = new Set(
    ((sevkliler ?? []) as { job_item_id: string }[]).map((s) => s.job_item_id)
  );

  if (!allItemsShipped(kimlikler.map((id) => ({ shipmentDate: sevkliKume.has(id) ? "x" : null })))) {
    return undefined;
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: "completed" })
    .eq("id", jobId);
  if (error) return undefined;

  await supabase.from("audit_log").insert({
    actor: userId,
    action: "job.status.auto",
    detail: {
      job_id: jobId,
      status: "completed",
      reason: "Bütün iş kalemlerinin sevk tarihi girildi",
      trigger_item_id: jobItemId,
    },
  });
  // İşin kendi "Akış" sekmesi de görsün: otomatik geçiş sessiz değildir.
  const jobNo = (is as { job_no?: string }).job_no ?? "";
  await isOlayiYaz(supabase, {
    jobId,
    jobNo,
    event: "durum_oto",
    detail: { to: "completed", trigger_item_id: jobItemId },
    actor: userId,
  });
  // Bildirim: elle durum değişikliğiyle AYNI kitle (favori ∪ açık görevli).
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
    title: `${jobNo} · Kendiliğinden tamamlandı (bütün kalemler sevk edildi)`,
    href: `/jobs/${jobId}`,
    actor: userId,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return (is as { job_no?: string }).job_no ?? "";
}

/**
 * Kalemin ticari kaydını yazar. Kayıt yoksa açar, varsa günceller —
 * `job_item_id` ünik olduğu için tek `upsert` yeter; satırların önceden
 * üretilmesine gerek kalmaz.
 */
export async function saveSale(
  jobItemId: string,
  input: SaleInput
): Promise<SalesActionResult> {
  const ctx = await requireSalesAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Sevk tarihi bu kaydetmede mi girildi? Cevap yazmadan ÖNCE okunur; sonra
  // sorulsaydı "zaten doluydu" ile "az önce doldu" ayırt edilemezdi.
  const { data: onceki } = await supabase
    .from("job_item_sales")
    .select("shipment_date")
    .eq("job_item_id", jobItemId)
    .maybeSingle();
  const onceSevkliydi = !!(onceki as { shipment_date?: string | null } | null)?.shipment_date;

  // Avro satırında kur her zaman 1'dir; kullanıcı başka bir şey yazmışsa bile
  // avro karşılığı bozulmasın diye burada sabitlenir.
  const data = { ...parsed.data };
  if (data.currency === "EUR") data.fx_rate = 1;

  // Fiyat girilmişse kur ZORUNLUDUR: kuru olmayan satır avro toplamına
  // giremez ve sessizce ciro dışında kalırdı.
  if (data.unit_price !== null && data.fx_rate === null) {
    return { error: "Fiyat girilen satırda kur da girilmelidir." };
  }

  const { error } = await supabase.from("job_item_sales").upsert(
    { job_item_id: jobItemId, ...data, updated_by: user.id },
    { onConflict: "job_item_id" }
  );
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "sales.save",
    detail: { job_item_id: jobItemId, currency: data.currency, unit_price: data.unit_price },
  });

  const jobCompleted =
    data.shipment_date && !onceSevkliydi
      ? await sevkSonrasiIsiTamamla(supabase, user.id, jobItemId)
      : undefined;

  revalidatePath("/sales");
  return { ok: true, ...(jobCompleted !== undefined ? { jobCompleted } : {}) };
}

/** Kalemin ticari kaydını tamamen siler (fiyat girilmemiş hâline döner). */
export async function clearSale(jobItemId: string): Promise<SalesActionResult> {
  const ctx = await requireSalesAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { error } = await supabase
    .from("job_item_sales")
    .delete()
    .eq("job_item_id", jobItemId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "sales.clear",
    detail: { job_item_id: jobItemId },
  });

  revalidatePath("/sales");
  return { ok: true };
}

// ────────────────────────────────────────────────────────────── sözleşme

/**
 * SÖZLEŞME PDF'İ İŞ EMRİ BAŞINA saklanır (kullanıcı kararı, 18.08.2026).
 *
 * Yükleme yeri Satış Bilgisi penceresidir ama kaydın anahtarı `job_id`dir:
 * bir sözleşme işin tamamını kapsar ve dokuz kalemli bir işte aynı PDF'i
 * dokuz kez yüklemek gerekmez. Kayıt `job_contracts` tablosundadır ve tablo
 * da `contracts` bucket'ı da `can_see_sales()` ile kesilir — dosya İşler
 * bölümünden hiç görünmez.
 *
 * ÖNCEKİ DOSYA DEPODAN SİLİNİR: yol tek bir satırda yaşıyor, üzerine yazılan
 * eski nesneye ulaşacak ikinci bir kayıt yok — bırakılsaydı depoda erişilemez
 * bir yığın büyürdü (`ContractUpload`un kendi içindeki kuralın sunucu yarısı).
 */
export async function saveJobContract(
  jobId: string,
  file: { path: string; fileName: string }
): Promise<SalesActionResult> {
  const gate = await requireSalesAccess();
  if ("error" in gate) return { error: gate.error };
  const { supabase, user } = gate;

  const path = String(file.path ?? "").trim();
  const fileName = String(file.fileName ?? "").trim();
  if (!path) return { error: "Sözleşme dosyası seçilmedi" };

  const { data: onceki } = await supabase
    .from("job_contracts")
    .select("file_path")
    .eq("job_id", jobId)
    .maybeSingle();

  const { error } = await supabase.from("job_contracts").upsert(
    {
      job_id: jobId,
      file_path: path,
      file_name: fileName,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "job_id" }
  );
  if (error) return { error: error.message };

  const eski = (onceki as { file_path?: string } | null)?.file_path;
  if (eski && eski !== path) {
    await supabase.storage.from("contracts").remove([eski]);
  }

  revalidatePath("/sales");
  return { ok: true };
}

/** Sözleşmeyi kaldırır — kayıt ve depo nesnesi birlikte gider. */
export async function clearJobContract(jobId: string): Promise<SalesActionResult> {
  const gate = await requireSalesAccess();
  if ("error" in gate) return { error: gate.error };
  const { supabase } = gate;

  const { data: mevcut } = await supabase
    .from("job_contracts")
    .select("file_path")
    .eq("job_id", jobId)
    .maybeSingle();

  const { error } = await supabase.from("job_contracts").delete().eq("job_id", jobId);
  if (error) return { error: error.message };

  const yol = (mevcut as { file_path?: string } | null)?.file_path;
  if (yol) await supabase.storage.from("contracts").remove([yol]);

  revalidatePath("/sales");
  return { ok: true };
}
