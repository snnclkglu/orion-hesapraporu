"use server";

// Yönetim paneli server action'ları. Tüm yazma işlemleri:
// 1) sunucuda admin rol kontrolü (RLS zaten admin ister; burada net hata mesajı için)
// 2) audit_log kaydı (project_id null — proje bağımsız yönetim işlemi)

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { USER_ROLES, type UserRole } from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";
import { trKatla } from "@/lib/drawings/tr-text";
import { consumableMatchKey } from "@/lib/purchasing/consumable-key";
import {
  CUSTOMER_LOGO_BUCKET,
  CUSTOMER_LOGO_MIME,
  MAX_CUSTOMER_LOGO_BYTES,
  isCustomerLogoPath,
} from "@/lib/customers/logo";
import { normalizeCustomerLogo } from "@/lib/customers/logo-image";
import type { CustomerContact } from "@/lib/customer-contacts";
import type { ReportSettings } from "@/lib/settings";

export type AdminActionResult = { error?: string; ok?: boolean };

type AdminContext = { supabase: SupabaseClient; user: User };

async function requireAdmin(): Promise<AdminContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Bu işlem için admin yetkisi gerekir" };

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

// ------------------------------------------------------------------ Kullanıcılar

// GÖREV ETİKETLERİ KALDIRILDI (12.08.2026, kullanıcı kararı): Satın Alma ·
// Planlama · Üretim artık `role` enum'unun kendi değerleridir. Şemadaki `tags`
// alanı ve onun "undefined ≠ boş dizi" ayrımı bu yüzden gitti — yazacak bir
// sütun kalmadı (bkz. migration 20260812150000).
const userSchema = z.object({
  full_name: z.string().trim().min(1, "Ad soyad gerekli").max(120),
  role: z.enum(USER_ROLES),
  title: z.string().trim().max(120),
});

export async function updateUserProfile(
  userId: string,
  input: { full_name: string; role: UserRole; title: string }
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { error: "Geçersiz kullanıcı bilgisi" };

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role, title")
    .eq("id", userId)
    .single();
  if (!target) return { error: "Kullanıcı bulunamadı" };

  // Son yönetici korunur: sistemde tek yönetici varsa rolü düşürülemez.
  // Kontrol "engineer'a düşürme" değil "yöneticiLİKTEN çıkarma" üzerinedir —
  // müdür/teknik ressam da yönetici olmayan rollerdir.
  if (target.role === "admin" && parsed.data.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Sistemdeki son Yönetici rolü düşürülemez. Önce başka bir Yönetici atayın." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      title: parsed.data.title,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.user_update", {
    target_id: userId,
    previous_name: target.full_name,
    previous_role: target.role,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    title: parsed.data.title,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/access");
  return { ok: true };
}

// -------------------------------------------------------------------- Müşteriler

/**
 * Müşteri defteri düzenlemesi.
 *
 * Renk burada AÇI olarak gelir (0–359, bkz. lib/tags.ts): sunum katmanı ondan
 * temaya uygun pasteli üretir. Hex kabul edilseydi kullanıcı koyu temada
 * okunmayan bir renk seçebilirdi.
 */
const customerAdminSchema = z.object({
  // Müşteri adı ve kısaltması BÜYÜK HARFLE saklanır (firma kuralı, `adBuyuk`):
  // defteri düzenleyen yönetici de kuralın dışında değildir, yoksa aynı ad
  // iş emrinde büyük, defterde karışık kiple dururdu.
  name: z.string().trim().min(1, "Müşteri adı gerekli").max(200).transform(adBuyuk),
  short_name: z.string().trim().max(40).transform(adBuyuk),
  color_hue: z.number().int().min(0).max(359),
  address: z.string().trim().max(400),
  tax_office: z.string().trim().max(120),
  tax_no: z.string().trim().max(60),
  phone: z.string().trim().max(60),
  fax: z.string().trim().max(60),
  notes: z.string().trim().max(1000),
});

export type CustomerAdminInput = z.infer<typeof customerAdminSchema>;

function revalidateCustomerViews() {
  revalidatePath("/admin/customers");
  revalidatePath("/jobs");
  revalidatePath("/sales");
}

export async function updateCustomer(
  id: string,
  input: CustomerAdminInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = customerAdminSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("customers")
    .update({
      ...parsed.data,
      // Kısaltma boş bırakılırsa tetikleyici de dolduramaz (o yalnız INSERT'te
      // çalışır); ilk kelimeye burada düşülür.
      short_name: parsed.data.short_name || parsed.data.name.split(" ")[0] || parsed.data.name,
    })
    .eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? "Bu isimde bir müşteri zaten var" : error.message };
  }

  await audit(supabase, user.id, "admin.customer_update", { id, name: parsed.data.name });
  revalidateCustomerViews();
  return { ok: true };
}

/**
 * MÜŞTERİ LOGOSUNU KAYDA BAĞLAR — baytlar buradan GEÇMEZ.
 *
 * Tarayıcı dosyayı doğrudan `customer-logos` kovasına yükler, bu eylem yalnız
 * ölçer ve satırı yazar (özlük dosyası / ekipman eki kalıbı): Next server
 * action gövdesinin varsayılan sınırı 1 MB'tır.
 *
 * DOSYA BEYAN DEĞİL ÖLÇÜMLE KAYDA GİRER. `file.type` istemcinin sözüdür;
 * sunucu nesneyi GERİ İNDİRİR, sharp ile formatını ölçer ve baytları künyeye
 * basılabilir bir PNG olarak (8 bit sRGB, interlaced değil, paletsiz) YENİDEN
 * KODLAYIP aynı yola yazar. Ölçüm düşerse yüklenen nesne depodan silinir ve
 * kayda hiç girmez — bozuk tek bir logo teklif PDF'ini 500'e çevirirdi.
 *
 * "KAYDET"İ BEKLEMEZ (sözleşme PDF'iyle aynı gerekçe): dosya zaten depodadır,
 * pencereyi "Vazgeç" ile kapatmak onu geri almaz. Logo yolunu form state'ine
 * koyup Kaydet'e bağlamak, vazgeçen kullanıcının ardında YETİM bir nesne
 * bırakırdı.
 */
export async function setCustomerLogo(
  customerId: string,
  input: { path: string; fileName: string }
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const path = (input.path ?? "").trim();
  // Sunucu istemciden gelen yola GÜVENMEZ: kova politikası "admin mi" diye
  // sorar, "hangi müşteri" diye değil.
  if (!isCustomerLogoPath(customerId, path)) {
    return { error: "Logo yolu bu müşteriye ait değil." };
  }

  const { data: file, error: indirmeHatasi } = await supabase.storage
    .from(CUSTOMER_LOGO_BUCKET)
    .download(path);
  if (indirmeHatasi || !file) {
    return { error: "Yüklenen dosya depoda bulunamadı; yüklemeyi tekrarlayın." };
  }

  // Sıra "önce ucuz olanı kaybet": kayıt HENÜZ YOK, o yüzden reddedilen dosya
  // depodan hemen silinir ve geride hiçbir iz kalmaz.
  async function reddet(mesaj: string): Promise<AdminActionResult> {
    await supabase.storage.from(CUSTOMER_LOGO_BUCKET).remove([path]);
    return { error: mesaj };
  }

  if (file.size > MAX_CUSTOMER_LOGO_BYTES) {
    return reddet("Logo 2 MB sınırını aşıyor.");
  }

  const olcum = await normalizeCustomerLogo(new Uint8Array(await file.arrayBuffer()));
  if (!olcum.ok) return reddet(olcum.error);

  const { error: yuklemeHatasi } = await supabase.storage
    .from(CUSTOMER_LOGO_BUCKET)
    .upload(path, olcum.png, { contentType: CUSTOMER_LOGO_MIME, upsert: true });
  if (yuklemeHatasi) return reddet(`Logo kaydedilemedi: ${yuklemeHatasi.message}`);

  const { data: onceki } = await supabase
    .from("customers")
    .select("logo_path")
    .eq("id", customerId)
    .maybeSingle();

  const { error } = await supabase
    .from("customers")
    .update({ logo_path: path, logo_name: (input.fileName ?? "").trim() })
    .eq("id", customerId);
  if (error) return reddet(error.message);

  // Eski nesne kayıt yazıldıktan SONRA silinir: ters sırada bir hata, defterde
  // artık var olmayan bir dosyaya işaret eden bir yol bırakırdı.
  const eski = ((onceki as { logo_path?: string } | null)?.logo_path ?? "").trim();
  if (eski && eski !== path) {
    await supabase.storage.from(CUSTOMER_LOGO_BUCKET).remove([eski]);
  }

  await audit(supabase, user.id, "admin.customer_logo_set", {
    id: customerId,
    file: input.fileName,
    width: olcum.width,
    height: olcum.height,
    content_width: olcum.contentWidth,
    content_height: olcum.contentHeight,
  });
  revalidateCustomerViews();
  return { ok: true };
}

/**
 * Logoyu kaldırır. ÖNCE KAYIT, SONRA DEPO (ekipman eki kuralı): ters sırada
 * bir hata, defteri var olmayan bir dosyaya bağlı bırakırdı; bu sırada en kötü
 * ihtimalle yetim bir nesne kalır ve o geri alınabilir bir hatadır.
 */
export async function clearCustomerLogo(customerId: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: onceki } = await supabase
    .from("customers")
    .select("logo_path")
    .eq("id", customerId)
    .maybeSingle();
  const path = ((onceki as { logo_path?: string } | null)?.logo_path ?? "").trim();

  const { error } = await supabase
    .from("customers")
    .update({ logo_path: "", logo_name: "" })
    .eq("id", customerId);
  if (error) return { error: error.message };

  if (path) await supabase.storage.from(CUSTOMER_LOGO_BUCKET).remove([path]);

  await audit(supabase, user.id, "admin.customer_logo_clear", { id: customerId });
  revalidateCustomerViews();
  return { ok: true };
}

/**
 * Müşteriyi defterden siler.
 *
 * İŞ EMİRLERİ SİLİNMEZ: `jobs.customer_id` yabancı anahtarı `on delete set null`
 * taşır ve iş emrindeki müşteri METİN alanları zaten basıldığı andaki
 * fotoğraftır — yayınlanmış bir iş emri defter kaydı silinince değişmemelidir.
 * Buna karşılık listelerdeki kısaltma ve renk kaybolur; bu yüzden kullanıcı
 * bağlı iş sayısıyla birlikte uyarılır.
 */
export async function deleteCustomer(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  // Logo yolu SİLMEDEN ÖNCE okunur: satır gidince yol da gider ve depodaki
  // nesneye ulaşacak ikinci bir kayıt yoktur.
  const { data: item } = await supabase
    .from("customers")
    .select("name, logo_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { error: error.message };

  const logo = ((item as { logo_path?: string } | null)?.logo_path ?? "").trim();
  if (logo) await supabase.storage.from(CUSTOMER_LOGO_BUCKET).remove([logo]);

  await audit(supabase, user.id, "admin.customer_delete", { id, name: item?.name });
  revalidateCustomerViews();
  return { ok: true };
}

// ------------------------------------------------------------------ Tedarikçiler

/**
 * TEDARİKÇİ DEFTERİ YÖNETİME TAŞINDI (kullanıcı kararı, 13.08.2026):
 * *"Satın Alma bölümündeki tedarikçileri Yönetim bölümüne Tedarikçiler adında
 * bir sayfa ekleyerek oraya taşıyalım. Her tedarikçiye benzersiz bir kod
 * verelim."*
 *
 * DEFTERİN YERİ İLE KAPISI AYRI ŞEYLERDİR. Firma listesini DÜZENLEMEK bir
 * yönetim işidir (ad düzeltmek, kod vermek, tedarikçi olmayan devralınan
 * kayıtları pasife çekmek) ve bu ekran admin'e kapalıdır. Ama YENİ FİRMA yine
 * sipariş/teklif penceresinden açılır (`ensureSupplier`, satın alma yetkisi):
 * satınalmacıyı yönetim ekranına göndermek, defterin 12.08.2026'da hiç
 * açılmama gerekçesiydi ve o gerekçe hâlâ geçerli.
 *
 * AD BÜYÜK HARFLE saklanır (`adBuyuk`, IS-14) ve `match_key` KATLANMIŞ addır:
 * "ÇELİK RULMAN" ile "CELIK RULMAN" tek firmadır.
 */
const supplierSchema = z.object({
  name: z.string().trim().min(2, "Firma adı gerekli").max(120).transform(adBuyuk),
  // Kod BOŞ BIRAKILABİLİR ve o zaman veritabanı sırayı kendisi verir
  // (`purchase_supplier_code_seq`). Elle yazılan kod serbesttir ama biçimi
  // kısıtlıdır: kod bir sipariş numarasının önekidir ve boşluk taşıyan bir
  // önek numarayı okunmaz yapardı.
  code: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toLocaleUpperCase("tr-TR"))
    .refine((v) => v === "" || /^[A-Z0-9ÇĞİÖŞÜ._-]+$/.test(v), "Kod boşluk ve simge taşıyamaz."),
  active: z.boolean(),
  note: z.string().trim().max(500),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

function revalidateSupplierViews() {
  revalidatePath("/admin/suppliers");
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/siparisler");
  revalidatePath("/purchasing/sarf");
  revalidatePath("/purchasing/sarf/kayitlar");
  revalidatePath("/purchasing/sarf/analiz");
}

/** Çakışma hangi indeksten geldi? İki tekillik var ve mesajları ayrı olmalı. */
function supplierConflictMessage(message: string): string {
  return message.includes("code")
    ? "Bu kod başka bir tedarikçide kullanılıyor."
    : "Bu firma zaten defterde kayıtlı.";
}

export async function createSupplier(input: SupplierInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, code, active, note } = parsed.data;

  const { error } = await supabase.from("purchase_suppliers").insert({
    name,
    match_key: trKatla(name),
    // Boş kod GÖNDERİLMEZ: sütun varsayılanı ancak alan hiç yokken çalışır.
    ...(code ? { code } : {}),
    active,
    note,
    created_by: user.id,
  });
  if (error) {
    return { error: error.code === "23505" ? supplierConflictMessage(error.message) : error.message };
  }

  await audit(supabase, user.id, "admin.supplier_create", { name, code });
  revalidateSupplierViews();
  return { ok: true };
}

export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, code, active, note } = parsed.data;
  if (!code) return { error: "Kod boş bırakılamaz." };

  const { error } = await supabase
    .from("purchase_suppliers")
    .update({ name, match_key: trKatla(name), code, active, note })
    .eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? supplierConflictMessage(error.message) : error.message };
  }

  await audit(supabase, user.id, "admin.supplier_update", { id, name, code, active });
  revalidateSupplierViews();
  return { ok: true };
}

/**
 * Tedarikçiyi defterden siler.
 *
 * YAYINLANMIŞ SİPARİŞ DEĞİŞMEZ: `purchase_orders.supplier` bir METİNdir, bu
 * kayda bağlı değil (IS-14'ün müşteri fotoğrafı kuralı). Silinen firmanın
 * geçmiş siparişleri ve teklifleri olduğu gibi durur; kaybolan tek şey öneri
 * listesindeki satır ve kodudur — o yüzden ekran "silmek yerine pasife çek"i
 * önerir.
 */
export async function deleteSupplier(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("purchase_suppliers")
    .select("name, code")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("purchase_suppliers").delete().eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.supplier_delete", { id, ...(item ?? {}) });
  revalidateSupplierViews();
  return { ok: true };
}

// ------------------------------------------------------------ Sarf Malzemeleri
//
// SM kodu veritabanının verdiği DEĞİŞMEZ kimliktir. Yönetim ad, grup, birim,
// not ve aktifliği düzeltir; update payload'ında `code` bilinçli olarak yoktur.
// Import üreticisiyle canlı kayıt AYNI `consumableMatchKey` fonksiyonunu
// kullanır. İkinci bir normalizasyon yazmak, aynı malzemeyi iki anahtara
// bölmek veya iki ayrı malzemeyi tek anahtarda birleştirmek olurdu.
const consumableItemSchema = z
  .object({
    name: z.string().trim().min(2, "Malzeme adı gerekli.").max(200).transform(adBuyuk),
    groupName: z.string().trim().min(1, "Sarf grubu gerekli.").max(120),
    defaultUnit: z.string().trim().min(1, "Varsayılan birim gerekli.").max(30),
    active: z.boolean(),
    note: z.string().trim().max(500),
  })
  .strict();

const consumableItemIdSchema = z.uuid("Geçersiz sarf malzeme kimliği.");

export type ConsumableItemInput = z.input<typeof consumableItemSchema>;

function revalidateConsumableViews() {
  revalidatePath("/admin/consumables");
  revalidatePath("/purchasing/sarf");
  revalidatePath("/purchasing/sarf/kayitlar");
  revalidatePath("/purchasing/sarf/analiz");
}

function consumableItemDatabaseError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return error.message.includes("code")
      ? "Yeni SM kodu üretilemedi; sayacın güncellenmesi gerekiyor."
      : "Bu sarf malzeme zaten defterde kayıtlı.";
  }
  if (error.code === "23503" || /foreign key|still referenced/i.test(error.message)) {
    return "Bu sarf malzeme gider kayıtlarında kullanılıyor; silmek yerine pasife alın.";
  }
  return error.message;
}

export async function createConsumableItem(
  input: ConsumableItemInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = consumableItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt." };
  const { name, groupName, defaultUnit, active, note } = parsed.data;

  const { data, error } = await supabase
    .from("purchase_consumable_items")
    .insert({
      name,
      match_key: consumableMatchKey(name),
      group_name: groupName,
      default_unit: defaultUnit,
      active,
      note,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, code")
    .single();
  if (error) return { error: consumableItemDatabaseError(error) };
  if (!data) return { error: "Sarf malzeme kaydedildi ancak SM kodu okunamadı." };

  await audit(supabase, user.id, "admin.consumable_item_create", {
    id: data.id,
    code: data.code,
    name,
    group_name: groupName,
    default_unit: defaultUnit,
    active,
  });
  revalidateConsumableViews();
  return { ok: true };
}

export async function updateConsumableItem(
  id: string,
  input: ConsumableItemInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsedId = consumableItemIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message };
  const parsed = consumableItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt." };
  const { name, groupName, defaultUnit, active, note } = parsed.data;

  const { data: before } = await supabase
    .from("purchase_consumable_items")
    .select("id, code, name, group_name, default_unit, active, note")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!before) return { error: "Sarf malzeme bulunamadı." };

  const { error } = await supabase
    .from("purchase_consumable_items")
    .update({
      name,
      match_key: consumableMatchKey(name),
      group_name: groupName,
      default_unit: defaultUnit,
      active,
      note,
      updated_by: user.id,
    })
    .eq("id", parsedId.data);
  if (error) return { error: consumableItemDatabaseError(error) };

  await audit(supabase, user.id, "admin.consumable_item_update", {
    id: parsedId.data,
    code: before.code,
    before,
    after: { name, group_name: groupName, default_unit: defaultUnit, active, note },
  });
  revalidateConsumableViews();
  return { ok: true };
}

export async function deleteConsumableItem(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsedId = consumableItemIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message };
  const { data: item } = await supabase
    .from("purchase_consumable_items")
    .select("id, code, name, group_name, default_unit, active")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!item) return { error: "Sarf malzeme bulunamadı." };

  const { error } = await supabase
    .from("purchase_consumable_items")
    .delete()
    .eq("id", parsedId.data);
  if (error) return { error: consumableItemDatabaseError(error) };

  await audit(supabase, user.id, "admin.consumable_item_delete", item);
  revalidateConsumableViews();
  return { ok: true };
}

// ---------------------------------------------------------------- Ekipman katalogu

const KINDS = ["motor", "gearbox", "rope", "brake", "bearing", "wheel", "buffer", "hook", "sheave", "coupling", "other"] as const;

const equipmentSchema = z.object({
  kind: z.enum(KINDS),
  brand: z.string().trim().min(1, "Marka gerekli"),
  model: z.string().trim().min(1, "Model gerekli"),
  notes: z.string().trim(),
  datasheet_url: z.string().trim().optional().default(""),
  active: z.boolean(),
  sort: z.number().int(),
  attrs: z.record(z.string(), z.union([z.string(), z.number()])),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;

export async function createEquipment(input: EquipmentInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("cat_equipment")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_create", {
    id: data.id,
    kind: parsed.data.kind,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

export async function updateEquipment(
  id: string,
  input: EquipmentInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_equipment").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_update", {
    id,
    kind: parsed.data.kind,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

export async function deleteEquipment(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("cat_equipment")
    .select("kind, brand, model")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("cat_equipment").delete().eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_delete", {
    id,
    kind: item?.kind,
    brand: item?.brand,
    model: item?.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

// ----------------------------------------------------------------- Kaplin katalogu

const couplingSchema = z.object({
  coupling_type: z.enum(["drum", "brake", "gear"]),
  brand: z.string().trim().min(1, "Marka gerekli"),
  series: z.string().trim().min(1, "Seri gerekli"),
  model: z.string().trim().min(1, "Model gerekli"),
  dmax: z.number().positive("dmax pozitif olmalı"),
  t_nominal: z.number().positive("Nominal tork pozitif olmalı"),
  radial_load: z.number().positive().nullable(),
  sort: z.number().int(),
});

export type CouplingInput = z.infer<typeof couplingSchema>;

export async function createCoupling(input: CouplingInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = couplingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("cat_couplings")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    return {
      error: error.code === "23505" ? "Bu kaplin zaten kayıtlı (tip+marka+seri+model)" : error.message,
    };
  }

  await audit(supabase, user.id, "admin.coupling_create", {
    id: data.id,
    coupling_type: parsed.data.coupling_type,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

export async function updateCoupling(
  id: number,
  input: CouplingInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = couplingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_couplings").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.coupling_update", {
    id,
    coupling_type: parsed.data.coupling_type,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

export async function deleteCoupling(id: number): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("cat_couplings")
    .select("coupling_type, brand, series, model")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("cat_couplings").delete().eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.coupling_delete", { id, ...item });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

// ------------------------------------------------------------------------ Raylar

const railSchema = z.object({
  code: z.string().trim().min(1, "Ray kodu gerekli"),
  radius: z.number().positive().nullable(),
  head_width: z.number().positive("Temas genişliği pozitif olmalı"),
  sort: z.number().int(),
});

export type RailInput = z.infer<typeof railSchema>;

export async function createRail(input: RailInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = railSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_rails").insert(parsed.data);
  if (error) {
    return { error: error.code === "23505" ? "Bu ray kodu zaten kayıtlı" : error.message };
  }

  await audit(supabase, user.id, "admin.rail_create", { code: parsed.data.code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

export async function updateRail(code: string, input: RailInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = railSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("cat_rails")
    .update({ radius: parsed.data.radius, head_width: parsed.data.head_width, sort: parsed.data.sort })
    .eq("code", code);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.rail_update", { code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

export async function deleteRail(code: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { error } = await supabase.from("cat_rails").delete().eq("code", code);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.rail_delete", { code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

// ----------------------------------------------------------------- Rapor ayarları

const settingsSchema = z.object({
  company: z.string().trim().min(1, "Firma adı gerekli"),
  city: z.string().trim().min(1, "Şehir gerekli"),
  title_tr: z.string().trim().min(1, "Türkçe başlık gerekli"),
  title_en: z.string().trim().min(1, "İngilizce başlık gerekli"),
  default_crane_type: z.string().trim().min(1, "Varsayılan vinç tipi gerekli"),
  address: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  web: z.string().trim().optional().default(""),
});

export async function updateReportSettings(
  input: ReportSettings
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("app_settings").upsert({
    key: "report",
    value: parsed.data,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.settings_update", { key: "report", ...parsed.data });

  revalidatePath("/admin/settings");
  revalidatePath("/projects");
  return { ok: true };
}

// ------------------------------------------------------------ Marka / Kalite
//
// Sipariş satırı ve sarf gideri değeri kendi `quality` metninde dondurur (md.
// 16/18'in tedarikçi defteri kuralı): defter düzeltilse de yayınlanmış kayıt
// değişmez. Yönetim adı düzeltir, pasife çeker ve yeni değer ekler.
const qualitySchema = z
  .object({
    name: z.string().trim().min(1, "Marka/Kalite gerekli.").max(120).transform(adBuyuk),
    active: z.boolean(),
  })
  .strict();

export type QualityInput = z.input<typeof qualitySchema>;

function revalidateQualityViews() {
  revalidatePath("/admin/qualities");
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/siparisler");
  revalidatePath("/purchasing/sarf");
}

export async function createQuality(input: QualityInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = qualitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, active } = parsed.data;

  const { error } = await supabase
    .from("purchase_qualities")
    .insert({ name, match_key: name, active, created_by: user.id });
  if (error) {
    return { error: error.code === "23505" ? "Bu marka/kalite zaten defterde." : error.message };
  }
  await audit(supabase, user.id, "admin.quality_create", { name });
  revalidateQualityViews();
  return { ok: true };
}

export async function updateQuality(id: string, input: QualityInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = qualitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, active } = parsed.data;

  const { error } = await supabase
    .from("purchase_qualities")
    .update({ name, match_key: name, active })
    .eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? "Bu marka/kalite zaten defterde." : error.message };
  }
  await audit(supabase, user.id, "admin.quality_update", { id, name, active });
  revalidateQualityViews();
  return { ok: true };
}

/**
 * Marka/Kaliteyi defterden siler. Yayınlanmış sipariş/sarf DEĞİŞMEZ (değer
 * satırın kendi metnindedir); kaybolan tek şey öneri listesindeki satırdır.
 */
export async function deleteQuality(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("purchase_qualities")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("purchase_qualities").delete().eq("id", id);
  if (error) return { error: error.message };
  await audit(supabase, user.id, "admin.quality_delete", { id, ...(item ?? {}) });
  revalidateQualityViews();
  return { ok: true };
}

// ------------------------------------------------- Müşteri iletişim kişileri
//
// YETKİ `requireAdmin` DEĞİLDİR ve bu bilinçli bir istisnadır. Kişiyi deftere
// giren, teklif kapağını dolduran kişidir; yalnız yöneticiye açılsaydı satışçı
// kapakta yeni bir muhatap yazarken deftere ekleyemez, yöneticiyi beklerdi.
// Soru RLS'in sorduğunun AYNISIDIR: `is_admin() or can_edit_offers()`.
//
// YETKİSİZ YAZIM SESSİZ KALMAZ: RLS reddettiğinde Postgres UPDATE/DELETE'te
// hata DÖNDÜRMEZ, yalnız sıfır satır etkiler ve ekran "kaydettim" der
// (offers/tanimlar/actions.ts'in ölçtüğü tuzak). Bu yüzden her yazma
// `.select("id")` ile satır SAYAR. INSERT ayrıdır: orada red gerçek bir
// hatadır ve `42501` koduyla gelir.

const KISI_YETKI_YOK = "Müşteri kişilerini düzenleme yetkisi gerekir.";

/** Oturum — rol kontrolü YAPILMAZ, kararı RLS verir ve satır sayısı ölçer. */
async function kisiOturumu(): Promise<AdminContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  return { supabase, user };
}

const customerContactSchema = z
  .object({
    // AD SOYAD BÜYÜK HARF saklanır (değişmez md. 3). `adBuyuk` YALNIZ ADA
    // uygulanır: unvan ve bölüm birer cümledir ("Satın Alma Müdürü") ve
    // büyütülürlerse müşteriye giden kapakta bağırır gibi görünür.
    name: z.string().trim().min(2, "Ad soyad gerekli.").max(160).transform(adBuyuk),
    title: z.string().trim().max(120),
    department: z.string().trim().max(120),
    phone: z.string().trim().max(60),
    email: z.string().trim().max(160),
    note: z.string().trim().max(500),
    isPrimary: z.boolean(),
    active: z.boolean(),
  })
  .strict();

export type CustomerContactInput = z.input<typeof customerContactSchema>;

/** Kişi defteri teklif kapağını besler — iki ekran birlikte tazelenir. */
function revalidateContactViews() {
  revalidatePath("/admin/customers");
  revalidatePath("/offers");
}

/** Satırın istemcideki karşılığı; ekleme sonrası liste yeniden çekilmesin. */
type CustomerContactRow = {
  id: string;
  customer_id: string;
  name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  note: string;
  is_primary: boolean;
  active: boolean;
  sort: number;
};

function toContact(row: CustomerContactRow): CustomerContact {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name ?? "",
    title: row.title ?? "",
    department: row.department ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    note: row.note ?? "",
    isPrimary: Boolean(row.is_primary),
    active: Boolean(row.active),
    sort: Number(row.sort) || 0,
  };
}

const CONTACT_COLUMNS =
  "id, customer_id, name, title, department, phone, email, note, is_primary, active, sort";

/**
 * BİRİNCİL KİŞİ TEKTİR ve kural BURADADIR, veritabanında değil.
 *
 * Kısmi bir tekillik indeksi (`(customer_id) where is_primary`) yazılabilirdi
 * ama o zaman "birincili değiştir" iki adımlı olur ve ARADA müşteri
 * birincilsiz kalırdı (`offer_options.is_default` ile birebir aynı karar).
 * Yeni birincil işaretlenirken kardeşleri düşürülür.
 */
async function birincilKardesleriDusur(
  supabase: SupabaseClient,
  customerId: string,
  haricId: string | null
) {
  const temizle = supabase
    .from("customer_contacts")
    .update({ is_primary: false })
    .eq("customer_id", customerId)
    .eq("is_primary", true);
  await (haricId ? temizle.neq("id", haricId) : temizle);
}

export async function createCustomerContact(
  customerId: string,
  input: CustomerContactInput
): Promise<AdminActionResult & { contact?: CustomerContact }> {
  const ctx = await kisiOturumu();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsedId = z.uuid("Geçersiz müşteri kimliği.").safeParse(customerId);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };
  const parsed = customerContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, title, department, phone, email, note, isPrimary, active } = parsed.data;

  // Sıra KARDEŞLER İÇİNDE sorulur ve yeni kişi listenin SONUNA eklenir; eski
  // muhatapların sırası bir kişi eklendi diye kaymaz.
  const { data: son } = await supabase
    .from("customer_contacts")
    .select("sort")
    .eq("customer_id", parsedId.data)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((son as { sort?: number } | null)?.sort ?? 0) + 10;

  // KARDEŞLER İNSERT'TEN SONRA DÜŞÜRÜLÜR. Tersi (önce düşür, sonra ekle) aynı
  // kişi ikinci kez girilip tekillik kısıtına takıldığında müşteriyi
  // BİRİNCİLSİZ bırakırdı: kullanıcı bir hata mesajı görür, defter sessizce
  // yıldızını kaybederdi. İki birincilin bir an birlikte var olması ise
  // okunabilir bir aradır ve `suggestedContact` orada da bir kişi döndürür.
  const { data, error } = await supabase
    .from("customer_contacts")
    .insert({
      customer_id: parsedId.data,
      name,
      match_key: trKatla(name),
      title,
      department,
      phone,
      email,
      note,
      is_primary: isPrimary,
      active,
      sort,
      created_by: user.id,
    })
    .select(CONTACT_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "Bu kişi zaten bu müşterinin defterinde." };
    if (error.code === "42501") return { error: KISI_YETKI_YOK };
    return { error: error.message };
  }
  if (!data) return { error: KISI_YETKI_YOK };

  const eklenen = toContact(data as CustomerContactRow);
  if (isPrimary) await birincilKardesleriDusur(supabase, parsedId.data, eklenen.id);

  await audit(supabase, user.id, "customer.contact_create", {
    customer_id: parsedId.data,
    name,
  });
  revalidateContactViews();
  return { ok: true, contact: eklenen };
}

export async function updateCustomerContact(
  id: string,
  input: CustomerContactInput
): Promise<AdminActionResult> {
  const ctx = await kisiOturumu();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsedId = z.uuid("Geçersiz kişi kimliği.").safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };
  const parsed = customerContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, title, department, phone, email, note, isPrimary, active } = parsed.data;

  const { data: mevcut } = await supabase
    .from("customer_contacts")
    .select("customer_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!mevcut) return { error: "Kişi defterde bulunamadı." };
  const customerId = (mevcut as { customer_id: string }).customer_id;

  if (isPrimary) await birincilKardesleriDusur(supabase, customerId, parsedId.data);

  const { data, error } = await supabase
    .from("customer_contacts")
    .update({
      name,
      match_key: trKatla(name),
      title,
      department,
      phone,
      email,
      note,
      is_primary: isPrimary,
      active,
    })
    .eq("id", parsedId.data)
    .select("id");
  if (error) {
    return {
      error:
        error.code === "23505" ? "Bu kişi zaten bu müşterinin defterinde." : error.message,
    };
  }
  if (!data || data.length === 0) return { error: KISI_YETKI_YOK };

  await audit(supabase, user.id, "customer.contact_update", {
    id: parsedId.data,
    customer_id: customerId,
    name,
    is_primary: isPrimary,
    active,
  });
  revalidateContactViews();
  return { ok: true };
}

/**
 * Kişiyi defterden siler.
 *
 * TESLİM EDİLMİŞ TEKLİF DEĞİŞMEZ: kapaktaki ad, bölüm ve telefon revizyon
 * payload'ında METİN olarak donmuştur. Kaybolan tek şey öneri listesindeki
 * satırdır — bu yüzden ekran, işten ayrılmış bir muhatap için silmek yerine
 * pasife çekmeyi önerir.
 */
export async function deleteCustomerContact(id: string): Promise<AdminActionResult> {
  const ctx = await kisiOturumu();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsedId = z.uuid("Geçersiz kişi kimliği.").safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };

  const { data: mevcut } = await supabase
    .from("customer_contacts")
    .select("customer_id, name")
    .eq("id", parsedId.data)
    .maybeSingle();

  const { data, error } = await supabase
    .from("customer_contacts")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: KISI_YETKI_YOK };

  await audit(supabase, user.id, "customer.contact_delete", {
    id: parsedId.data,
    ...(mevcut ?? {}),
  });
  revalidateContactViews();
  return { ok: true };
}
