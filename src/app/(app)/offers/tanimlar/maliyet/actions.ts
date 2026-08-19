"use server";

// MALİYET ŞABLONU DEFTERİNİN YAZMA UCU.
//
// YETKİSİZ YAZIM SESSİZ KALMAZ. RLS (`can_edit_offer_costs`) reddettiğinde
// Postgres UPDATE/DELETE'te hata DÖNDÜRMEZ, yalnız sıfır satır etkiler; ekran
// "kaydettim" der ve hiçbir şey değişmez. Bu yüzden her yazma `.select("id")`
// ile satır SAYAR (`tanimlar/actions.ts` kalıbı). INSERT ayrıdır: orada red
// gerçek bir hatadır ve `42501` koduyla gelir.
//
// ŞABLONUN KİMLİĞİ VİNÇ TİPİDİR, bir `id` değil: ekran satırı olmayan bir tip
// için de yazabilmelidir (varsayılanı ilk kez daraltmak). Bu yüzden bütün
// eylemler `match_key` üzerinden çalışır ve kayıt yoksa AÇILIR.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { trKatla } from "@/lib/drawings/tr-text";
import { COST_GROUP_DEFS, GENERAL_GROUP_KEY } from "@/lib/offers/cost/registry";

export type CostTemplateResult = { error?: string; ok?: boolean };

const YETKI_YOK = "Maliyet şablonlarını düzenleme yetkisi gerekir.";
// SIFIR SATIR İKİ ŞEY DEMEK OLABİLİR: kayıt hiç yoktur (tip varsayılanda) ya da
// RLS yazmayı reddetmiştir. İkisini ayıramadığımız için mesaj ikisini de söyler
// — "yetkiniz yok" demek, varsayılandaki bir tipte kullanıcıyı boşuna yetki
// aramaya gönderirdi.
const SATIR_YOK = "Şablon defterde bulunamadı ya da düzenleme yetkiniz yok.";

type Baglam = { supabase: SupabaseClient; user: User };

async function oturum(): Promise<Baglam | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  return { supabase, user };
}

async function audit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ project_id: null, actor: actorId, action, detail });
}

function tazele() {
  revalidatePath("/offers/tanimlar/maliyet");
  revalidatePath("/offers");
}

/**
 * ŞABLONUN SEÇEBİLECEĞİ GRUPLAR — PROJE GENELİ hariç.
 *
 * O grup kaleme değil BELGEYE aittir (üç vinçlik bir teklifte dokümantasyon bir
 * kez yapılır) ve bir vinç tipine bağlanamaz; listeye konsaydı işaretlenip
 * işaretlenmemesi hiçbir şeyi değiştirmezdi.
 */
const SECILEBILIR_GRUPLAR = COST_GROUP_DEFS.filter((g) => g.key !== GENERAL_GROUP_KEY).map(
  (g) => g.key
);

const iskeletSemasi = z
  .object({
    craneType: z.string().trim().min(1, "Vinç tipi gerekli.").max(120),
    /**
     * SIRA KULLANICIDAN DEĞİL DEFTERDEN gelir: grupların sırası BELGENİN
     * sırasıdır (imalat → çelik → mekanizma → elektrik → saha) ve kutucukların
     * işaretlenme sırası bir maliyet düzeni değildir.
     */
    groupKeys: z
      .array(z.string())
      .transform((keys) => SECILEBILIR_GRUPLAR.filter((k) => keys.includes(k)))
      .refine((keys) => keys.length > 0, "En az bir bölüm seçilmeli."),
    /**
     * KAPATILAN SATIRLAR — beyaz liste değil KARA liste (gerekçesi
     * `CostTemplateSkeleton`ta). Defterde karşılığı olmayan anahtar sessizce
     * düşer: eskimiş bir kapatma kaydı, bir gün deftere aynı adla eklenen yeni
     * bir satırı hiç açılmadan yutardı.
     */
    closedLines: z.record(z.string(), z.array(z.string())),
  })
  .strict();

export type CostTemplateInput = z.input<typeof iskeletSemasi>;

/** Kapatma kaydını defterle sınırlar; boş kalan grup hiç yazılmaz. */
function temizKapatmalar(
  ham: Record<string, string[]>,
  groupKeys: readonly string[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const groupKey of groupKeys) {
    const def = COST_GROUP_DEFS.find((g) => g.key === groupKey);
    if (!def) continue;
    const secili = new Set(ham[groupKey] ?? []);
    const kapali = def.lines.filter((l) => secili.has(l.key)).map((l) => l.key);
    if (kapali.length) out[groupKey] = kapali;
  }
  return out;
}

export async function saveOfferCostTemplate(input: CostTemplateInput): Promise<CostTemplateResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = iskeletSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { craneType, groupKeys } = parsed.data;
  const closedLines = temizKapatmalar(parsed.data.closedLines, groupKeys);
  const matchKey = trKatla(craneType);
  const skeleton = { groupKeys, ...(Object.keys(closedLines).length ? { closedLines } : {}) };

  // ÖNCE GÜNCELLE, YOKSA EKLE — `upsert` DEĞİL. Upsert `sort` ve `active`
  // sütunlarını da göndermek zorunda kalırdı; bu ekran ikisini de düzenlemez ve
  // pasife alınmış bir şablonu bir kutucuk değişikliğiyle sessizce yeniden
  // etkinleştirmek başka birinin kararını silmek olurdu.
  const { data, error } = await supabase
    .from("offer_cost_templates")
    .update({ crane_type: craneType, skeleton })
    .eq("match_key", matchKey)
    .select("id");
  if (error) return { error: error.message };

  if (!data || data.length === 0) {
    const { error: ekleme } = await supabase.from("offer_cost_templates").insert({
      crane_type: craneType,
      match_key: matchKey,
      skeleton,
      created_by: user.id,
    });
    // 23505: aynı anda iki sekmeden yazılmış olabilir; 42501 RLS reddidir.
    if (ekleme) {
      if (ekleme.code === "42501") return { error: YETKI_YOK };
      return { error: ekleme.message };
    }
  }

  await audit(supabase, user.id, "offer.cost_template_save", { craneType, groupKeys, closedLines });
  tazele();
  return { ok: true };
}

/**
 * ŞABLONU PASİFE ALIR ya da geri açar.
 *
 * PASİF ŞABLON SİLİNMİŞ DEĞİLDİR: kararı defterde durur, yalnız uygulanmaz ve
 * o tip varsayılan kümeye düşer. Bir tipin şablonunu geçici olarak devre dışı
 * bırakmak, satırı silip bütün kutucuk kararlarını kaybetmekten iyidir.
 */
export async function setOfferCostTemplateActive(
  craneType: string,
  active: boolean
): Promise<CostTemplateResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data, error } = await supabase
    .from("offer_cost_templates")
    .update({ active })
    .eq("match_key", trKatla(craneType))
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: SATIR_YOK };

  await audit(supabase, user.id, "offer.cost_template_active", { craneType, active });
  tazele();
  return { ok: true };
}

/**
 * Tipin şablonunu defterden kaldırır — o tip VARSAYILAN kümeye döner.
 *
 * AÇILMIŞ MALİYET ÇALIŞMALARI ETKİLENMEZ: şablon yalnız yeni kurulan kalemin
 * iskeletini belirler ve "Tekliften Tazele"nin hangi satırları EKLEYECEĞİNİ
 * söyler; kayıtlı bir belgenin satırları buradan hiç okunmaz.
 */
export async function resetOfferCostTemplate(craneType: string): Promise<CostTemplateResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data, error } = await supabase
    .from("offer_cost_templates")
    .delete()
    .eq("match_key", trKatla(craneType))
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: SATIR_YOK };

  await audit(supabase, user.id, "offer.cost_template_reset", { craneType });
  tazele();
  return { ok: true };
}
