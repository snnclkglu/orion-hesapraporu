"use server";

// PANO YERLEŞİMİ EYLEMLERİ — yalnız KARARLAR yazılır, plan yazılmaz.
//
// Hesaplanan yerleşim hiçbir eylemde kaydedilmez: saf ve deterministik olduğu
// için her açılışta yeniden üretilir (`lib/switchboard/compute.ts`). Buradaki
// eylemler kullanıcının seçimlerini saklar — pano gövde ölçüsü, aygıt
// düzeltmesi, ürün ölçüsü ve onay.
//
// Her eylem yetkiyi YENİDEN sınar (`canEditReports`), girdiyi Zod ile doğrular
// ve `{ ok: true } | { error }` döndürür — asla fırlatmaz.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { electricalCatalogLookupKey } from "@/lib/electrical/catalogs";
import {
  FIELD_GRID,
  ROOM_GRID,
} from "@/lib/switchboard/sizes";

type Sonuc = { ok: true } | { error: string };

async function yetkiliMi(): Promise<
  { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | { error: string }
> {
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
    return { error: "Bu işlem için mühendislik yetkisi gerekiyor." };
  }
  return { ok: true, supabase, userId: user.id };
}

/** Izgara dışı bir ölçü kabul edilmez: pano imalatçısı ara ölçü kesmez. */
const izgarada = (...izgaralar: readonly (readonly number[])[]) =>
  z
    .number()
    .refine((v) => izgaralar.some((g) => g.includes(v)), { message: "Ölçü listede yok." })
    .nullable();

/**
 * İKİ IZGARANIN BİRLEŞİMİ (PANO-33).
 *
 * Bu eylem panonun oda mı saha mı olduğunu BİLMEZ — `kind` gönderilmemiş de
 * olabilir ve gönderilse bile hangi ızgaranın geçerli olduğunu çözücü
 * uygular. Doğrulamanın işi, hiçbir imalatçının kesmediği bir ara ölçüyü
 * (mesela 1500 mm) reddetmektir; iki ızgaradan birinde varsa geçerlidir.
 */
const HER_IKI = {
  widths: [ROOM_GRID.widths, FIELD_GRID.widths],
  heights: [ROOM_GRID.heights, FIELD_GRID.heights],
  depths: [ROOM_GRID.depths, FIELD_GRID.depths],
  bases: [ROOM_GRID.bases, FIELD_GRID.bases],
} as const;

const PanoSemasi = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().max(160).default(""),
  kind: z.enum(["oda", "saha", "haric"]).nullable().default(null),
  widthMm: izgarada(...HER_IKI.widths).default(null),
  heightMm: izgarada(...HER_IKI.heights).default(null),
  depthMm: izgarada(...HER_IKI.depths).default(null),
  baseMm: izgarada(...HER_IKI.bases).default(null),
  doorConfig: z.enum(["tek", "cift"]).nullable().default(null),
  orderIndex: z.number().int().nullable().default(null),
  note: z.string().max(500).default(""),
});

/**
 * Bir panonun gövde seçimlerini yazar.
 *
 * ELLE GİRİLEN ÖLÇÜ KİLİTLENİR. Kullanıcı bir en seçtiyse "Yeniden Yerleştir"
 * onu ezmemelidir; aksi hâlde verilen siparişle ekrandaki plan ayrışır. Kilit
 * ayrı bir kutu değil, ölçünün KENDİSİNDEN çıkar: dolu ölçü = kilitli.
 */
export async function savePanel(girdi: z.input<typeof PanoSemasi>): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  const ayris = PanoSemasi.safeParse(girdi);
  if (!ayris.success) return { error: ayris.error.issues[0]?.message ?? "Geçersiz girdi." };
  const v = ayris.data;

  const { error } = await kapi.supabase.from("switchboard_panels").upsert(
    {
      project_id: v.projectId,
      code: v.code,
      name: v.name,
      kind: v.kind,
      width_mm: v.widthMm,
      height_mm: v.heightMm,
      depth_mm: v.depthMm,
      base_mm: v.baseMm,
      door_config: v.doorConfig,
      order_index: v.orderIndex,
      width_locked: v.widthMm !== null,
      height_locked: v.heightMm !== null,
      depth_locked: v.depthMm !== null,
      note: v.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,code" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${v.projectId}/pano`);
  return { ok: true };
}

const YerlesimSemasi = z.object({
  projectId: z.string().uuid(),
  deviceKey: z.string().min(1).max(200),
  panelCode: z.string().max(64).nullable().default(null),
  mountType: z.enum(["din", "plaka", "kapak", "govde", "yan", "saha"]).nullable().default(null),
  zone: z.enum(["giris", "guc", "motor", "kumanda", "klemens"]).nullable().default(null),
  widthMm: z.number().positive().nullable().default(null),
  heightMm: z.number().positive().nullable().default(null),
  depthMm: z.number().positive().nullable().default(null),
  pinned: z.boolean().default(false),
  note: z.string().max(500).default(""),
});

/** Bir aygıtın yerleşim düzeltmesini yazar. */
export async function savePlacement(girdi: z.input<typeof YerlesimSemasi>): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  const ayris = YerlesimSemasi.safeParse(girdi);
  if (!ayris.success) return { error: ayris.error.issues[0]?.message ?? "Geçersiz girdi." };
  const v = ayris.data;

  const { error } = await kapi.supabase.from("switchboard_placements").upsert(
    {
      project_id: v.projectId,
      device_key: v.deviceKey,
      panel_code: v.panelCode,
      mount_type: v.mountType,
      zone: v.zone,
      width_mm: v.widthMm,
      height_mm: v.heightMm,
      depth_mm: v.depthMm,
      pinned: v.pinned,
      note: v.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,device_key" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${v.projectId}/pano`);
  return { ok: true };
}

const TasimaSemasi = z.object({
  projectId: z.string().uuid(),
  deviceKey: z.string().min(1).max(200),
  /** Aygıtın panonun sırasındaki YENİ yeri (0 tabanlı). */
  orderInRail: z.number().int().min(0).max(9999),
  /** Bırakıldığı ray — bilgi amaçlı; sıra baskındır (PANO-23). */
  railIndex: z.number().int().min(0).max(999).nullable().default(null),
});

/**
 * ŞEMADA TAŞINAN AYGITIN SIRASINI YAZAR — ölçüsüne DOKUNMAZ.
 *
 * `savePlacement` KULLANILAMAZ ve bu tuzak ölçülmüştür: onun şemasında
 * `widthMm`/`heightMm`/`depthMm` alanları `.default(null)` taşıyor, yani
 * yalnız sıra göndermek kullanıcının o aygıta ELLE yazdığı ölçüyü SİLERDİ.
 * Bir cihazı şemada sağa kaydırmak, ölçüsünü unutturmamalı.
 *
 * `pinned` burada zorunlu olarak `true` olur: kullanıcı bir aygıtı bilerek
 * taşıdıysa "Yeniden Yerleştir" onu geri almamalıdır (PANO-14).
 *
 * SIRA SAKLANIR, KOORDİNAT DEĞİL (PANO-23). Yazılan sayı panonun aygıt
 * sırasındaki indekstir; koordinat her çözümde yeniden hesaplanır, çünkü komşu
 * bir cihazın eni değişince bu cihazın yeri de değişmelidir.
 *
 * PANO KODUNA DOKUNULMAZ ve bu ölçülmüş bir tuzaktır. Bölünmüş bir gözün kodu
 * (`LVD0-D`) gerçek bir konum değil, bölücünün ÜRETTİĞİ bir addır; onu bir
 * yerleşim düzeltmesi olarak yazmak aygıtı var olmayan bir panoya taşır.
 * Ölçüldü (0026-01): tek bir sürüklemeden sonra dizide AYNI KODLU İKİNCİ bir
 * göz beliriyor ve toplam en 2.500 mm'den 2.900 mm'ye çıkıyordu — imalatçı
 * fazladan bir gövde keserdi. Aygıtı BAŞKA bir panoya taşımak ayrı bir iştir
 * ve `savePlacement` üstünden yapılır.
 */
export async function movePlacement(girdi: z.input<typeof TasimaSemasi>): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  const ayris = TasimaSemasi.safeParse(girdi);
  if (!ayris.success) return { error: ayris.error.issues[0]?.message ?? "Geçersiz girdi." };
  const v = ayris.data;

  const { error } = await kapi.supabase.from("switchboard_placements").upsert(
    {
      project_id: v.projectId,
      device_key: v.deviceKey,
      rail_index: v.railIndex,
      order_in_rail: v.orderInRail,
      pinned: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,device_key" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${v.projectId}/pano`);
  return { ok: true };
}

/**
 * Bir aygıtın SABİTLEMESİNİ kaldırır — sırayı sisteme geri verir.
 *
 * Sabitleyip geri alamamak bir tuzaktır: kullanıcı bir cihazı yanlış yere
 * taşıdığında "Yeniden Yerleştir" onu KORUR (öyle olması gerekiyor) ve geriye
 * dönüş kalmazdı. Ölçü düzeltmesi varsa DURUR; silinen yalnız sıradır.
 */
export async function unpinPlacement(projectId: string, deviceKey: string): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  if (!z.string().uuid().safeParse(projectId).success) return { error: "Geçersiz proje." };
  if (!deviceKey) return { error: "Aygıt anahtarı boş." };

  const { error } = await kapi.supabase
    .from("switchboard_placements")
    .update({
      rail_index: null,
      order_in_rail: null,
      pinned: false,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("device_key", deviceKey);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}

/**
 * "Yeniden Yerleştir" — bir YAZMA değil, bir SİLME işlemidir.
 *
 * Plan zaten saklanmıyor; yeniden yerleştirmek demek, kullanıcının aygıt
 * düzeltmelerini bırakıp sistemin kendi sırasına dönmek demektir. `pinned`
 * satırlar ve pano gövde seçimleri KORUNUR: onlar bilerek verilmiş
 * kararlardır ve bir düğme onları silmemelidir.
 */
export async function resetPlacements(projectId: string): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  if (!z.string().uuid().safeParse(projectId).success) return { error: "Geçersiz proje." };

  const { error } = await kapi.supabase
    .from("switchboard_placements")
    .delete()
    .eq("project_id", projectId)
    .eq("pinned", false);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}

/** Bir panonun gövde kilidini kaldırır — ölçüyü sisteme geri verir. */
export async function unlockPanel(projectId: string, code: string): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;

  const { error } = await kapi.supabase
    .from("switchboard_panels")
    .update({
      width_mm: null,
      height_mm: null,
      depth_mm: null,
      width_locked: false,
      height_locked: false,
      depth_locked: false,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("code", code);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}

const OlcuSemasi = z.object({
  projectId: z.string().uuid(),
  supplier: z.string().min(1).max(160),
  typeNo: z.string().min(1).max(160),
  widthMm: z.number().positive().nullable(),
  heightMm: z.number().positive().nullable(),
  depthMm: z.number().positive().nullable(),
  mountType: z.enum(["din", "plaka", "kapak", "govde", "yan", "saha"]).nullable().default(null),
  zone: z.enum(["giris", "guc", "motor", "kumanda", "klemens"]).nullable().default(null),
  clearanceTopMm: z.number().nonnegative().nullable().default(null),
  clearanceBottomMm: z.number().nonnegative().nullable().default(null),
  note: z.string().max(500).default(""),
});

/**
 * Ürün ölçüsünü DEFTERE yazar — projeye değil.
 *
 * Ölçü ürüne aittir: aynı Siemens şalteri bir sonraki projede de aynı yeri
 * kaplar. `source` daima `elle`dir; bu bir TAHMİNİN ONAYLANMASI değil, ayrı
 * bir iddiadır (PANO-12). Tahmin defterde hiç saklanmaz.
 */
export async function saveDeviceModel(girdi: z.input<typeof OlcuSemasi>): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  const ayris = OlcuSemasi.safeParse(girdi);
  if (!ayris.success) return { error: ayris.error.issues[0]?.message ?? "Geçersiz girdi." };
  const v = ayris.data;

  const { error } = await kapi.supabase.from("electrical_device_models").upsert(
    {
      lookup_key: electricalCatalogLookupKey(v.supplier, v.typeNo),
      supplier: v.supplier,
      type_no: v.typeNo,
      width_mm: v.widthMm,
      height_mm: v.heightMm,
      depth_mm: v.depthMm,
      mount_type: v.mountType,
      zone: v.zone,
      clearance_top_mm: v.clearanceTopMm,
      clearance_bottom_mm: v.clearanceBottomMm,
      source: "elle",
      note: v.note,
      verified_by: kapi.userId,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lookup_key" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${v.projectId}/pano`);
  return { ok: true };
}

/**
 * Dizi ölçü tercihlerini KAYDEDER — onaylamadan (PANO-34).
 *
 * Bugüne kadar tek kalıcı yer onay satırıydı: kullanıcı bir yükseklik seçip
 * sayfayı yenilediğinde seçimi sessizce kayboluyordu, çünkü seçim yalnız adres
 * çubuğunda yaşıyordu. Ayarı kaydetmek ONAYLAMAK DEĞİLDİR; ayar girdinin
 * parçası olduğu için parmak izi değişir ve varsa onay kendiliğinden eskir.
 *
 * IZGARA BURADA DA DENETLENİR: ara ölçü hiçbir imalatçının kesmediği bir
 * gövdedir ve bir adres parametresinden gelmiş olabilir.
 */
const DiziAyariSemasi = z.object({
  heightMm: izgarada(...HER_IKI.heights).optional(),
  depthMm: izgarada(...HER_IKI.depths).optional(),
  baseMm: z
    .number()
    .refine((v) => HER_IKI.bases.some((g) => g.includes(v)), { message: "Baza listede yok." })
    .optional(),
});

const AyarSemasi = z.object({
  room: DiziAyariSemasi.default({}),
  field: DiziAyariSemasi.default({}),
});

export async function saveLayoutSettings(
  projectId: string,
  ayar: z.input<typeof AyarSemasi>
): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  if (!z.string().uuid().safeParse(projectId).success) return { error: "Geçersiz proje." };

  const g = AyarSemasi.safeParse(ayar);
  if (!g.success) return { error: g.error.issues[0]?.message ?? "Ayar okunamadı." };

  const { error } = await kapi.supabase.from("switchboard_settings").upsert(
    {
      project_id: projectId,
      settings: g.data as unknown as Record<string, unknown>,
      updated_by: kapi.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}

/**
 * Yerleşimi onaylar ve o anki GİRDİNİN parmak izini saklar.
 *
 * Plan saklanmadığı için "neyi onayladım" sorusunun cevabı bu izdir. Girdi
 * değişince (yeni bir elektrik projesi okunduğunda, bir ölçü düzeltildiğinde)
 * iz tutmaz ve ekranda "onay eskidi" şeridi çıkar — kimse eski bir plana göre
 * pano sipariş etmesin diye.
 */
export async function approveLayout(
  projectId: string,
  fingerprint: string,
  settings: unknown,
  note = ""
): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;
  if (!z.string().uuid().safeParse(projectId).success) return { error: "Geçersiz proje." };
  if (!z.string().min(4).max(64).safeParse(fingerprint).success) {
    return { error: "Parmak izi okunamadı." };
  }

  const { error } = await kapi.supabase.from("switchboard_approvals").upsert(
    {
      project_id: projectId,
      input_fingerprint: fingerprint,
      settings: (settings ?? {}) as Record<string, unknown>,
      note: note.slice(0, 500),
      approved_by: kapi.userId,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}

/** Onayı kaldırır — plan yeniden taslak olur. */
export async function withdrawApproval(projectId: string): Promise<Sonuc> {
  const kapi = await yetkiliMi();
  if ("error" in kapi) return kapi;

  const { error } = await kapi.supabase
    .from("switchboard_approvals")
    .delete()
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/pano`);
  return { ok: true };
}
