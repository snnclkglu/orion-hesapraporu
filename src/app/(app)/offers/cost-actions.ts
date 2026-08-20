"use server";

// MALİYET ÇALIŞMASININ SERVER ACTION'LARI.
//
// Teklifin `actions.ts`i ile aynı sıra: `createClient` → `auth.getUser` → Zod
// `safeParse` → (gerekiyorsa) önceki hâli oku → yaz → `audit_log` →
// `revalidatePath`. Denetim izi yine `detail.offer_id` üzerinden geçer
// (`audit_log.project_id` bir HESAP RAPORU projesine bağlıdır).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requestPermanentDeletion } from "@/lib/deletion-request-server";
import { getReportSettings } from "@/lib/settings";
import { isAdminRole } from "@/lib/roles";
import { withDefaults } from "@/lib/offers/payload";
import { emptyCostPayload, withCostDefaults, withCostDerived, withDefaultRates, withOfferSync } from "@/lib/offers/cost/payload";
import type { CostTemplate, CostTemplateSkeleton } from "@/lib/offers/cost/types";
import { renderOfferCostPdf } from "@/lib/pdf/offer-cost";
import { offerCostFileName } from "@/lib/pdf/doc-naming";
import { saveCostSchema, type SaveCostInput } from "./cost-schema";

export type CostActionResult = { error?: string; ok?: boolean; warning?: string };

async function audit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ project_id: null, actor: actorId, action, detail });
}

function tazele(offerId: string, costRevId?: string) {
  revalidatePath("/offers");
  revalidatePath(`/offers/${offerId}`);
  if (costRevId) revalidatePath(`/offers/${offerId}/costs/${costRevId}`);
}

/** Teklifin künyesi ve GÜNCEL revizyonu — maliyet ondan türetilir. */
async function teklifVeRevizyon(supabase: SupabaseClient, offerId: string) {
  const { data: offer } = await supabase
    .from("offers")
    .select("id, offer_no, subject, customer_name, currency, issue_date")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;
  const { data: revision } = await supabase
    .from("offer_revisions")
    .select("rev_no, payload")
    .eq("offer_id", offerId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { offer, revision };
}

/**
 * ETKİN MALİYET ŞABLONLARI — yeni maliyet ve açık "Tekliften Tazele"
 * eyleminin ortak kaynağı. Okuma hatasında varsayılana sessizce düşülmez;
 * ekranın "şablon uygulandı" deyip başka bir belge kurması daha tehlikelidir.
 */
async function maliyetSablonlari(
  supabase: SupabaseClient
): Promise<{ templates?: CostTemplate[]; error?: string }> {
  const { data, error } = await supabase
    .from("offer_cost_templates")
    .select("crane_type, skeleton")
    .eq("active", true);
  if (error) return { error: `Maliyet şablonları okunamadı: ${error.message}` };
  return {
    templates: ((data ?? []) as { crane_type: string; skeleton: CostTemplateSkeleton | null }[])
      .filter((row) => row.crane_type && row.skeleton)
      .map((row) => ({ craneType: row.crane_type, skeleton: row.skeleton! })),
  };
}

/**
 * YENİ MALİYET REVİZYONU.
 *
 * İLKİ TEKLİFTEN KURULUR, sonrakiler ÖNCEKİNDEN kopyalanır. İlk maliyet boş
 * bir sayfa olsaydı kullanıcı kalemleri, grupları ve ölçüleri elle yeniden
 * girerdi — oysa hepsi teklifte yazılı (TEKLIF-20'nin "aynı bilgiyi iki defa
 * alıyoruz" gerekçesi).
 *
 * `rev_no` en büyük numaranın bir fazlasıdır, kayıt sayısı DEĞİL: silinen bir
 * taslak numarayı geri döndürmemelidir.
 */
export async function createOfferCostRevision(
  offerId: string
): Promise<CostActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const id = z.uuid("Geçersiz teklif").safeParse(offerId);
  if (!id.success) return { error: id.error.issues[0].message };

  const kaynak = await teklifVeRevizyon(supabase, id.data);
  if (!kaynak) return { error: "Teklif bulunamadı" };
  const sablonlar = await maliyetSablonlari(supabase);
  if (sablonlar.error) return { error: sablonlar.error };

  const { data: son } = await supabase
    .from("offer_cost_revisions")
    .select("rev_no, payload, notes")
    .eq("offer_id", id.data)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currency = (kaynak.offer.currency as string) ?? "EUR";
  const temel = son
    ? withCostDefaults(son.payload, currency)
    : withDefaultRates(emptyCostPayload(currency));

  const teklif = withDefaults(kaynak.revision?.payload, currency);
  const { payload } = withOfferSync(
    temel,
    teklif,
    kaynak.revision?.rev_no ?? null,
    sablonlar.templates
  );
  const hazir = withCostDerived(payload);

  const revNo = (son?.rev_no ?? -1) + 1;
  const { data, error } = await supabase
    .from("offer_cost_revisions")
    .insert({
      offer_id: id.data,
      rev_no: revNo,
      label: `M${revNo}`,
      payload: hazir,
      notes: son?.notes ?? "",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await audit(supabase, user.id, "offer.cost_create", { offer_id: id.data, rev_no: revNo });
  tazele(id.data);
  return { id: data.id as string };
}

/**
 * Maliyet revizyonunu kaydeder.
 *
 * MİKTAR, FİYAT VE TOPLAMLAR BURADA YAZILIR (`withCostDerived`): model
 * miktarları ve hammadde şeridinin fiyatları satırlara işlenir, sonra toplam
 * türetilir.
 * Veritabanındaki `direct_amount` ve `total_amount` üretilmiş sütunları
 * payload'ı okur; ekranda hesaplanıp yazılmasaydı liste ve panel maliyeti
 * görmek için modeli yeniden koşturmak zorunda kalırdı.
 */
export async function saveOfferCostRevision(
  offerId: string,
  costRevId: string,
  input: SaveCostInput
): Promise<CostActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = saveCostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const payload = withCostDerived(withCostDefaults(parsed.data.payload));

  const { data: yazilan, error } = await supabase
    .from("offer_cost_revisions")
    .update({ payload, notes: parsed.data.notes })
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .eq("status", "draft")
    .select("id");
  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Yayımlanmış maliyet revizyonu değiştirilemez; yeni bir revizyon oluşturun."
        : error.message,
    };
  }
  if (!yazilan?.length) {
    return { error: "Maliyet revizyonu bulunamadı ya da yayımlanmış — yeni bir revizyon oluşturun." };
  }

  tazele(offerId, costRevId);
  return { ok: true };
}

/**
 * TEKLİFTEN TAZELE — kalemleri ve boş girdileri teklifle eşitler.
 *
 * AYRI BİR EYLEMDİR, kaydetmenin yan etkisi değil (TEKLIF-14'ün "yalnız
 * açılışta" kuralının aynı gerekçesi): her kaydetmede koşsaydı kullanıcının
 * elle düzelttiği bir girdi teklifin değeriyle sessizce ezilir, sildiği bir
 * kalem geri gelirdi. Eşitleme EKLEYİCİDİR: teklifte artık bulunmayan bir
 * kalemin maliyeti silinmez, bağı kopar.
 */
export async function syncOfferCostFromOffer(
  offerId: string,
  costRevId: string
): Promise<CostActionResult & { eklenen?: number; yetim?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const kaynak = await teklifVeRevizyon(supabase, offerId);
  if (!kaynak) return { error: "Teklif bulunamadı" };
  const sablonlar = await maliyetSablonlari(supabase);
  if (sablonlar.error) return { error: sablonlar.error };

  const { data: mevcut } = await supabase
    .from("offer_cost_revisions")
    .select("payload, status")
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .maybeSingle();
  if (!mevcut) return { error: "Maliyet revizyonu bulunamadı" };
  if (mevcut.status !== "draft") return { error: "Yayımlanmış maliyet tazelenemez; yeni bir revizyon açın." };

  const currency = (kaynak.offer.currency as string) ?? "EUR";
  const teklif = withDefaults(kaynak.revision?.payload, currency);
  const sonuc = withOfferSync(
    withCostDefaults(mevcut.payload, currency),
    teklif,
    kaynak.revision?.rev_no ?? null,
    sablonlar.templates
  );
  const payload = withCostDerived(sonuc.payload);

  const { error } = await supabase
    .from("offer_cost_revisions")
    .update({ payload })
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .eq("status", "draft");
  if (error) return { error: error.message };

  await audit(supabase, user.id, "offer.cost_sync", {
    offer_id: offerId,
    eklenen: sonuc.eklenen,
    yetim: sonuc.yetim,
  });
  tazele(offerId, costRevId);
  return { ok: true, eklenen: sonuc.eklenen, yetim: sonuc.yetim };
}

/**
 * Maliyeti YAYIMLAR: durum `issued` olur, tetikleyici damgalar ve kilitler.
 *
 * "Yayım" burada müşteriye göndermek DEĞİL, kararı dondurmaktır: bu fiyatı bu
 * maliyetle verdik. İç PDF `offer-costs` kovasına arşivlenir ve arşivleme
 * hatası YAYIMI GERİ ALMAZ (teklifteki aynı denge: yayım bir karardır, arşiv
 * bir kolaylıktır).
 */
export async function issueOfferCostRevision(
  offerId: string,
  costRevId: string
): Promise<CostActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: revision, error } = await supabase
    .from("offer_cost_revisions")
    .update({ status: "issued" })
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .eq("status", "draft")
    .select("rev_no, payload")
    .single();
  if (error || !revision) {
    return { error: error?.message ?? "Maliyet revizyonu bulunamadı veya zaten yayımlanmış" };
  }

  let arsivlendi = false;
  try {
    const kaynak = await teklifVeRevizyon(supabase, offerId);
    if (kaynak) {
      const currency = (kaynak.offer.currency as string) ?? "EUR";
      const settings = await getReportSettings(supabase);
      const buffer = await renderOfferCostPdf({
        offer: {
          offerNo: kaynak.offer.offer_no as string,
          subject: kaynak.offer.subject as string,
          customerName: kaynak.offer.customer_name as string,
          currency,
          offerRevNo: kaynak.revision?.rev_no ?? null,
        },
        costRevNo: revision.rev_no as number,
        payload: withCostDefaults(revision.payload, currency),
        offerPayload: withDefaults(kaynak.revision?.payload, currency),
        company: { company: settings.company },
        meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
      });
      const { error: uploadError } = await supabase.storage
        .from("offer-costs")
        .upload(
          `${offerId}/${offerCostFileName(
            kaynak.offer.subject as string,
            kaynak.offer.offer_no as string,
            revision.rev_no as number
          )}`,
          buffer,
          { contentType: "application/pdf", upsert: true }
        );
      arsivlendi = !uploadError;
    }
  } catch {
    arsivlendi = false;
  }

  await audit(supabase, user.id, "offer.cost_issue", {
    offer_id: offerId,
    rev_no: revision.rev_no,
    pdf_archived: arsivlendi,
  });
  tazele(offerId, costRevId);
  return arsivlendi ? {} : { warning: "Maliyet yayımlandı ancak PDF arşivlenemedi." };
}

/**
 * YAYIMLANMIŞ MALİYETİ TASLAĞA GERİ ÇEKER — yalnız YÖNETİCİ.
 *
 * Teklifteki `unlockOfferRevision`in ikizidir ve aynı kapıdan geçer: durum
 * `draft`a çekilir, yayım damgaları boşalır, GERİ KALAN HER ŞEY AYNI KALIR.
 * Tetikleyicinin sorduğu alan kümesi budur (`guard_issued_offer_cost`);
 * buraya bir alan daha eklemek özelliği sessizce çalışmaz hâle getirir.
 */
export async function unlockOfferCostRevision(
  offerId: string,
  costRevId: string
): Promise<CostActionResult> {
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
  if (!isAdminRole(profile?.role)) {
    return { error: "Yayımlanmış bir maliyeti yalnız Yönetici geri çekebilir." };
  }

  const { data: geri, error } = await supabase
    .from("offer_cost_revisions")
    .update({ status: "draft", issued_at: null, issued_by: null })
    .eq("id", costRevId)
    .eq("offer_id", offerId)
    .eq("status", "issued")
    .select("id, rev_no");
  if (error) return { error: error.message };
  if (!geri?.length) return { error: "Maliyet revizyonu bulunamadı ya da zaten taslak." };

  await audit(supabase, user.id, "offer.cost_unlock", { offer_id: offerId, rev_no: geri[0].rev_no });
  tazele(offerId, costRevId);
  return {};
}

export async function deleteOfferCostRevision(
  offerId: string,
  costRevId: string
): Promise<CostActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  return requestPermanentDeletion({
    entityType: "offer_cost_revision",
    targetId: costRevId,
    context: { offer_id: offerId },
  });
}
