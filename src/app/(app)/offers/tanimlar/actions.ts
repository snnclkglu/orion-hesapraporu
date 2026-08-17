"use server";

// TEKLİF DEFTERİNİN YAZMA UCU — Tanımlar sayfası buradan yazar.
//
// DEFTER SİLİNMEZ, İŞARETLENİR (tedarikçi/marka defterinin kuralı, SATIN-21):
// yayınlanmış bir teklifte değer zaten METİN olarak donmuştur, yani buradan
// silmek belgeyi değiştirmez — kaybolan şey listenin GEÇMİŞLE bağıdır. Bu
// yüzden asıl eylem `active = false`tır; silme yalnız yeni yazılmış hatalı bir
// madde için vardır ve ekranda onay ister.
//
// YETKİSİZ YAZIM SESSİZ KALMAZ. RLS (`can_edit_offers`) reddettiğinde Postgres
// UPDATE/DELETE'te hata DÖNDÜRMEZ, yalnız sıfır satır etkiler; ekran "kaydettim"
// der ve hiçbir şey değişmez. Bu yüzden her yazma `.select("id")` ile satır
// SAYAR (deleteJob / task-templates kalıbı). INSERT ayrıdır: orada red gerçek
// bir hatadır ve `42501` koduyla gelir.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { trKatla } from "@/lib/drawings/tr-text";
import { OFFER_GROUP_DEFS } from "@/lib/offers/registry";

export type OfferDefinitionResult = { error?: string; ok?: boolean };

const YETKI_YOK = "Teklif defterini düzenleme yetkisi gerekir.";

/** Yeni maddenin sırası: seed 10'ar artar, elle eklenen de o ritme oturur. */
const SIRA_ADIMI = 10;

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
  await supabase.from("audit_log").insert({
    project_id: null,
    actor: actorId,
    action,
    detail,
  });
}

/**
 * INSERT hatasının Türkçesi.
 *
 * `23505` kısmi tekillik indekslerinden gelir (kök madde liste içinde, çocuk
 * ebeveyni içinde tekildir) ve kullanıcıya ham indeks adı gösterilmez.
 * `42501` RLS reddidir — UPDATE'te sıfır satırla ölçtüğümüz şeyin INSERT'teki
 * karşılığı budur.
 */
function eklemeHatasi(error: { code?: string; message: string }, tekrar: string): string {
  if (error.code === "23505") return tekrar;
  if (error.code === "42501") return YETKI_YOK;
  return error.message;
}

/**
 * Tanımlar sayfası VE teklif ekranları tazelenir: defter, editördeki bütün
 * açılır listelerin kaynağıdır (`loadOfferOptions`) — yalnız bu sayfayı
 * tazelemek, yeni eklenen markanın teklifte görünmemesi demekti.
 */
function tazele() {
  revalidatePath("/offers/tanimlar");
  revalidatePath("/offers");
}

// ————————————————————————————————————————————————————— defter maddeleri

/**
 * Madde metni OLDUĞU GİBİ saklanır — `adBuyuk` UYGULANMAZ.
 *
 * Ad alanlarının BÜYÜK HARF kuralı (değişmez md. 3) müşteri/personel adları
 * içindir; teklif defterindeki değerler markadır ve markanın yazımı kendisine
 * aittir: "Conductix-Wampfler", "SEW-EURODRIVE", "Yılmaz R." büyütülünce ya
 * bozulur ya da müşteriye giden belgede firma adını yanlış yazmış oluruz.
 * Tekillik yine de yazım farklarını yutar: karşılaştırma `match_key` üzerinden,
 * `trKatla` ile yapılır (SQL'de `upper()` DEĞİL — Postgres Türkçe farkında
 * değildir ve "İ" ile "I"yı ayıramaz).
 */
const maddeMetni = z.string().trim().min(1, "Madde boş olamaz.").max(200);

const yeniMaddeSemasi = z
  .object({
    listKey: z.string().trim().min(1).max(80),
    /** Kademeli listede ebeveyn markanın kimliği; kök maddede `null`. */
    parentId: z.uuid().nullable(),
    value: maddeMetni,
  })
  .strict();

export type YeniOfferOptionInput = z.input<typeof yeniMaddeSemasi>;

const maddeSemasi = z
  .object({
    value: maddeMetni,
    active: z.boolean(),
    isDefault: z.boolean(),
    note: z.string().trim().max(500),
  })
  .strict();

export type OfferOptionInput = z.input<typeof maddeSemasi>;

export async function createOfferOption(
  input: YeniOfferOptionInput
): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = yeniMaddeSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { listKey, parentId, value } = parsed.data;

  // Sıra KARDEŞLER İÇİNDE sorulur: bir markanın serileri kendi içinde
  // numaralanır, `list_key` genelinde değil — yoksa iki markanın serileri
  // birbirinin sırasını iteler.
  //
  // SÜZGEÇ ÖNCE, SIRALAMA SONRA: postgrest-js'te `.order()`/`.limit()` dönen
  // kap artık bir SÜZGEÇ kabı değildir, `.eq()` orada yoktur.
  const temel = supabase.from("offer_options").select("sort").eq("list_key", listKey);
  const kardesler = parentId ? temel.eq("parent_id", parentId) : temel.is("parent_id", null);
  const { data: son } = await kardesler
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((son as { sort?: number } | null)?.sort ?? 0) + SIRA_ADIMI;

  const { error } = await supabase.from("offer_options").insert({
    list_key: listKey,
    value,
    match_key: trKatla(value),
    parent_id: parentId,
    sort,
    created_by: user.id,
  });
  if (error) return { error: eklemeHatasi(error, "Bu madde defterde zaten var.") };

  await audit(supabase, user.id, "offer.option_create", { list_key: listKey, value, parent_id: parentId });
  tazele();
  return { ok: true };
}

export async function updateOfferOption(
  id: string,
  input: OfferOptionInput
): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = maddeSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { value, active, isDefault, note } = parsed.data;

  const { data: mevcut } = await supabase
    .from("offer_options")
    .select("list_key, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (!mevcut) return { error: "Madde defterde bulunamadı." };
  const satir = mevcut as { list_key: string; parent_id: string | null };

  // VARSAYILAN TEKTİR. Veritabanı bunu kısıtlamaz (kısmi bir tekillik indeksi
  // `is_default` için de yazılabilirdi ama o zaman "varsayılanı değiştir" iki
  // adımlı bir işlem olur ve ARADA HİÇ varsayılansız kalırdı); kural burada,
  // yazma yolunda tutulur: yeni varsayılan işaretlenince kardeşleri düşer.
  if (isDefault) {
    const temizle = supabase
      .from("offer_options")
      .update({ is_default: false })
      .eq("list_key", satir.list_key)
      .eq("is_default", true)
      .neq("id", id);
    await (satir.parent_id ? temizle.eq("parent_id", satir.parent_id) : temizle.is("parent_id", null));
  }

  const { data, error } = await supabase
    .from("offer_options")
    .update({ value, match_key: trKatla(value), active, is_default: isDefault, note })
    .eq("id", id)
    .select("id");
  if (error) {
    return {
      error: error.code === "23505" ? "Bu madde defterde zaten var." : error.message,
    };
  }
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.option_update", {
    id,
    list_key: satir.list_key,
    value,
    active,
    is_default: isDefault,
  });
  tazele();
  return { ok: true };
}

/**
 * Maddeyi defterden siler.
 *
 * YAYINLANMIŞ TEKLİF DEĞİŞMEZ: revizyon payload'ı değeri metin olarak
 * dondurmuştur. Kademeli bir markanın silinmesi çocuklarını da götürür
 * (`on delete cascade`) — ekran bunu silmeden önce sayıyla söyler.
 */
export async function deleteOfferOption(id: string): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: mevcut } = await supabase
    .from("offer_options")
    .select("list_key, value")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase.from("offer_options").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.option_delete", { id, ...(mevcut ?? {}) });
  tazele();
  return { ok: true };
}

/**
 * Maddeyi bir üst/alt komşusuyla yer değiştirir.
 *
 * SIRA TAKASI DEĞİL YENİDEN NUMARALAMA yapılır: seed sıraları 10'ar artıyor
 * ama elle eklenen maddelerde EŞİT `sort` değerleri oluşabilir (aynı anda iki
 * madde eklenirse), ve iki eşit sayıyı takas etmek EKRANDA HİÇBİR ŞEY
 * DEĞİŞTİRMEZ — kullanıcı düğmenin bozuk olduğunu düşünür. Listeyi baştan
 * numaralamak bu sessiz hâli imkânsız kılar; kardeş sayısı onlarla ölçülür,
 * bedeli yoktur. Yalnız DEĞİŞEN satırlar yazılır.
 */
export async function moveOfferOption(id: string, dir: -1 | 1): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: mevcut } = await supabase
    .from("offer_options")
    .select("list_key, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (!mevcut) return { error: "Madde defterde bulunamadı." };
  const satir = mevcut as { list_key: string; parent_id: string | null };

  // Sıralama EKRANDAKİYLE aynı olmalıdır (`loadOfferOptions`: sort, sonra
  // value); ayrışırsa "yukarı" düğmesi başka bir komşuyla takas eder.
  const temel = supabase
    .from("offer_options")
    .select("id, sort")
    .eq("list_key", satir.list_key);
  const { data: rows, error } = await (satir.parent_id
    ? temel.eq("parent_id", satir.parent_id)
    : temel.is("parent_id", null)
  )
    .order("sort", { ascending: true })
    .order("value", { ascending: true });
  if (error) return { error: error.message };

  const liste = (rows ?? []) as { id: string; sort: number }[];
  const i = liste.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= liste.length) return { ok: true };

  const yeni = [...liste];
  const [tasinan] = yeni.splice(i, 1);
  yeni.splice(j, 0, tasinan);

  for (const [sira, kayit] of yeni.entries()) {
    const hedef = (sira + 1) * SIRA_ADIMI;
    if (kayit.sort === hedef) continue;
    const { data, error: yazmaHatasi } = await supabase
      .from("offer_options")
      .update({ sort: hedef })
      .eq("id", kayit.id)
      .select("id");
    if (yazmaHatasi) return { error: yazmaHatasi.message };
    if (!data || data.length === 0) return { error: YETKI_YOK };
  }

  await audit(supabase, user.id, "offer.option_move", { id, list_key: satir.list_key, dir });
  tazele();
  return { ok: true };
}

// ——————————————————————————————————————————————————————————— şablonlar

/** Defterin tanıdığı grup anahtarları — şablon yalnız bunlardan kurulur. */
const GRUP_ANAHTARLARI = OFFER_GROUP_DEFS.map((g) => g.key);

const sablonSemasi = z
  .object({
    name: z.string().trim().min(1, "Şablon adı gerekli.").max(160),
    craneType: z.string().trim().max(120),
    /**
     * İskeletin grupları. SIRA KULLANICIDAN DEĞİL DEFTERDEN gelir: grupların
     * sırası BELGENİN sırasıdır (genel özellikler → tahrik grupları → çelik →
     * elektrik) ve kutucukların işaretlenme sırası bir teklif düzeni değildir.
     */
    groupKeys: z
      .array(z.string())
      .transform((keys) => GRUP_ANAHTARLARI.filter((k) => keys.includes(k)))
      .refine((keys) => keys.length > 0, "En az bir grup seçilmeli."),
    active: z.boolean(),
    sort: z.number().int().min(0).max(9999),
  })
  .strict();

export type OfferTemplateInput = z.input<typeof sablonSemasi>;

export async function createOfferTemplate(
  input: OfferTemplateInput
): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = sablonSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, craneType, groupKeys, active, sort } = parsed.data;

  const { error } = await supabase.from("offer_templates").insert({
    name,
    match_key: trKatla(name),
    crane_type: craneType,
    skeleton: { groupKeys },
    sort,
    active,
    created_by: user.id,
  });
  if (error) return { error: eklemeHatasi(error, "Bu şablon adı defterde zaten var.") };

  await audit(supabase, user.id, "offer.template_create", { name, crane_type: craneType, groupKeys });
  tazele();
  return { ok: true };
}

export async function updateOfferTemplate(
  id: string,
  input: OfferTemplateInput
): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = sablonSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, craneType, groupKeys, active, sort } = parsed.data;

  const { data, error } = await supabase
    .from("offer_templates")
    .update({
      name,
      match_key: trKatla(name),
      crane_type: craneType,
      skeleton: { groupKeys },
      sort,
      active,
    })
    .eq("id", id)
    .select("id");
  if (error) {
    return {
      error: error.code === "23505" ? "Bu şablon adı defterde zaten var." : error.message,
    };
  }
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.template_update", { id, name, groupKeys, active });
  tazele();
  return { ok: true };
}

/**
 * Şablonu siler. AÇILMIŞ TEKLİFLER ETKİLENMEZ: şablon yalnız yeni teklifin
 * ilk hâlini kurar, revizyon payload'ı ondan bağımsız yaşar.
 */
export async function deleteOfferTemplate(id: string): Promise<OfferDefinitionResult> {
  const ctx = await oturum();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: mevcut } = await supabase
    .from("offer_templates")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase.from("offer_templates").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: YETKI_YOK };

  await audit(supabase, user.id, "offer.template_delete", { id, ...(mevcut ?? {}) });
  tazele();
  return { ok: true };
}
