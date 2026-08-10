"use server";

// Aşama defteri — sunucu eylemleri.
//
// YETKİ SORUSU BURADA YENİDEN YAZILMAZ. `requireWrite` `drawings/actions.ts`ten
// içe aktarılır ve bunun gerekçesi orada yazılı: iki kopya kalsaydı yetki
// kuralı bir gün yalnız bir yerde değişir ve bu ekran sessizce daha gevşek
// kalırdı. Soru `canEditDrawings`tir (Yönetici · Mühendis · Teknik Ressam) —
// `is_admin()` DEĞİL; 20260810000002:124-126 bunu açıkça söyler. Asıl engel yine
// RLS'tir, buradaki kontrol anlaşılır bir mesaj içindir.
//
// ————————————————————————————————————————— DEFTERİN İKİ DOKUNULMAZI
//
// 1. VAR OLAN BİR AŞAMANIN `slug`'I DEĞİŞMEZ. `drawing_part_progress.stage`
//    metni ona eşittir; anahtar kayarsa atölyenin o aşamadaki bütün kaydı
//    defterden kopar. `updateStage` bu yüzden `slug` alanını hiç yazmaz ve
//    şemasında böyle bir alan yoktur.
// 2. KULLANILMIŞ AŞAMA SİLİNMEZ, PASİFE ALINIR. Kullanımı SUNUCU sayar;
//    istemcinin gösterdiği sayı bir görüntüdür ve açık kalmış eski bir sekmede
//    çoktan eskimiş olabilir.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
// Yetki sorusu TEK YERDE — bkz. dosya başlığı. O dosyaya DOKUNULMAZ.
import { requireWrite } from "../actions";
import { nextDistinctHue } from "@/lib/tags";
import {
  createStageSchema,
  deleteStageSchema,
  moveStageSchema,
  nameKey,
  setStageActiveSchema,
  slugFromName,
  updateStageSchema,
  SIRA_ADIMI,
  type CreateStageInput,
  type DeleteStageInput,
  type MoveStageInput,
  type SetStageActiveInput,
  type StageActionResult,
  type UpdateStageInput,
} from "./schema";

const ALANLAR = "id, slug, name, sort, color_hue, active, note";

interface AsamaSatiri {
  id: string;
  slug: string;
  name: string;
  sort: number;
  color_hue: number;
  active: boolean;
  note: string;
}

/**
 * Defterin tamamı — SIRALAMA EKRANDAKİYLE BİREBİR AYNI.
 *
 * `moveStage` "bir yukarı" derken kullanıcının GÖRDÜĞÜ listede bir yukarıyı
 * kastediyor; sıralama ölçütü burada ve `page.tsx`te ayrışırsa ok tuşu bazen
 * beklenmedik bir satırla yer değiştirirdi. Defter onlarca satırdır, sayfalama
 * gerekmez.
 */
async function defteriOku(supabase: SupabaseClient): Promise<AsamaSatiri[]> {
  const { data, error } = await supabase
    .from("drawing_stages")
    .select(ALANLAR)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AsamaSatiri[];
}

/**
 * Ham Postgres hatasını Türkçeye çevirir.
 *
 * Kullanıcıya `duplicate key value violates unique constraint
 * "dwg_stage_name_key"` göstermek, ona hiçbir şey söylememektir. İki tekillik
 * indeksi de kendi cümlesini hak eder: ad çakışması ile ANAHTAR çakışması
 * kullanıcı için farklı iki durumdur (ikincisinde adlar birbirinden farklı
 * görünür ama aynı anahtara katlanır).
 */
function hataMesaji(
  error: { code?: string; message?: string },
  ad: string,
  varsayilan: string
): string {
  const m = error.message ?? "";
  if (error.code === "23505") {
    if (m.includes("dwg_stage_name_key")) return `"${ad}" adında bir aşama defterde zaten var.`;
    if (m.includes("dwg_stage_slug_key")) {
      return `"${ad}" var olan bir aşamayla aynı anahtara düşüyor; adı daha ayırt edici yazın.`;
    }
    return `"${ad}" defterde zaten var.`;
  }
  if (error.code === "23514") {
    if (m.includes("dwg_stage_hue_range")) return "Renk açısı 0–359 aralığında olmalı.";
    if (m.includes("dwg_stage_slug_ascii")) {
      return `"${ad}" adından geçerli bir anahtar türetilemedi; adda en az bir harf ya da rakam olmalı.`;
    }
    return "Girilen değer defterin kurallarına uymuyor.";
  }
  // Tablo yoksa (migration uygulanmamışsa) kullanıcıya "bilinmeyen hata"
  // demek yerine ne olduğunu söyleriz — düzeltme onda değil yöneticidedir.
  if (error.code === "42P01") {
    return "Aşama defteri veritabanında bulunamadı; migration henüz uygulanmamış olabilir.";
  }
  return `${varsayilan}${m ? `: ${m}` : ""}`;
}

/**
 * Ekranları tazele.
 *
 * Üretim tahtaları (`/drawings/[id]/progress`) defteri HER İSTEKTE okur —
 * Supabase istemcisi çerezlere baktığı için o rotalar zaten dinamiktir ve
 * önbelleğe girmez. Burada tazelenen, defterin kendi listesi ve paket
 * listesidir.
 */
function tazele() {
  revalidatePath("/drawings/stages");
  revalidatePath("/drawings");
}

/** Denetim kaydı — `await` edilir ama dönüşü KONTROL EDİLMEZ (evin kuralı). */
async function denetim(
  supabase: SupabaseClient,
  actor: string,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  await supabase.from("audit_log").insert({ project_id: null, actor, action, detail });
}

/* ═══════════════════════════════════════════════════════════ ekleme ═══ */

/**
 * Yeni aşama açar.
 *
 * ÇAKIŞMA VERİTABANINA BIRAKILMAZ, ÖNCE UYGULAMADA SORULUR — ve uygulama
 * kontrolü veritabanınınkinden DAHA SIKIDIR (bkz. `nameKey`): `dwg_stage_name_key`
 * bayt bayt tekildir, yani "Kesildi" ile "KESİLDİ"yi iki ayrı ad sayar. Defterin
 * var olma sebebi tam olarak bu ikisinin TEK aşama olmasıdır. Veritabanı hatası
 * yine de yakalanır (yarış durumu) ama normal yolda kullanıcı ham bir kısıt adı
 * görmez.
 */
export async function createStage(input: CreateStageInput): Promise<StageActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, sort, colorHue, note, active } = parsed.data;

  const slug = slugFromName(name);
  if (!slug) {
    return {
      error: "Aşama adından bir anahtar türetilemedi; adda en az bir harf ya da rakam olmalı.",
    };
  }

  let defter: AsamaSatiri[];
  try {
    defter = await defteriOku(supabase);
  } catch (e) {
    return { error: `Aşama defteri okunamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}` };
  }

  const adEsi = defter.find((s) => nameKey(s.name) === nameKey(name));
  if (adEsi) return { error: `"${adEsi.name}" defterde zaten var.` };

  const anahtarEsi = defter.find((s) => s.slug === slug);
  if (anahtarEsi) {
    return {
      error:
        `"${name}" ile "${anahtarEsi.name}" aynı anahtara (${slug}) düşüyor; ` +
        "iki aşama birbirinden ayırt edilemezdi. Adı biraz daha ayırt edici yazın.",
    };
  }

  // TON SUNUCUDA DA HESAPLANIR. Pencere bir öneri gönderiyor (kullanıcı önizleme
  // görmeden renk seçemez) ama gelmezse defterdeki tonlardan EN UZAK boşluk
  // alınır — komşu iki aşama çipinin ayırt edilebilirliği veriyle değil KURALLA
  // garanti edilir (`nextDistinctHue`, aynı gerekçe `work_categories`ta yazılı).
  const ton = colorHue ?? nextDistinctHue(defter.map((s) => s.color_hue));

  const { error } = await supabase.from("drawing_stages").insert({
    slug,
    name,
    sort,
    color_hue: ton,
    note,
    active,
    created_by: userId,
  });
  if (error) return { error: hataMesaji(error, name, "Aşama eklenemedi") };

  await denetim(supabase, userId, "drawings.stage.create", { slug, name, sort, hue: ton });
  tazele();
  return {};
}

/* ═════════════════════════════════════════════════════════ düzenleme ═══ */

/**
 * Aşamanın görünen yüzünü düzenler: ad, sıra, renk, not, aktiflik.
 *
 * `slug` YAZILMAZ — şemada böyle bir alan da yoktur (gerekçe `schema.ts`te ve
 * dosya başlığında). Tohumdaki bir yazım hatasını düzeltmek bu yüzden güvenlidir:
 * ekranda görünen ad değişir, atölyenin kaydı yerinde kalır.
 */
export async function updateStage(input: UpdateStageInput): Promise<StageActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = updateStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, sort, colorHue, note, active } = parsed.data;

  let defter: AsamaSatiri[];
  try {
    defter = await defteriOku(supabase);
  } catch (e) {
    return { error: `Aşama defteri okunamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}` };
  }

  const kendisi = defter.find((s) => s.id === id);
  if (!kendisi) return { error: "Aşama bulunamadı; defter bu arada değişmiş olabilir." };

  const adEsi = defter.find((s) => s.id !== id && nameKey(s.name) === nameKey(name));
  if (adEsi) return { error: `"${adEsi.name}" defterde zaten var.` };

  const { error } = await supabase
    .from("drawing_stages")
    .update({ name, sort, color_hue: colorHue, note, active })
    .eq("id", id);
  if (error) return { error: hataMesaji(error, name, "Aşama güncellenemedi") };

  await denetim(supabase, userId, "drawings.stage.update", {
    id,
    slug: kendisi.slug,
    name,
    onceki_ad: kendisi.name,
  });
  tazele();
  return {};
}

/**
 * Aktif/pasif anahtarı.
 *
 * PASİFE ALMAK SİLMEK DEĞİLDİR ve bu ayrım defterin omurgasıdır: pasif aşamanın
 * çipi üretim tahtasında çizilmez (tahta `active = true` süzer) ama o aşamaya
 * yazılmış üretim kayıtları OLDUĞU GİBİ KALIR. Atölyenin hiç kullanmadığı bir
 * adımı — 261 parçanın hepsinde duran ve telefonda kalıcı gürültü olan bir çipi
 * — ekrandan kaldırmanın doğru yolu budur.
 */
export async function setStageActive(input: SetStageActiveInput): Promise<StageActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = setStageActiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, active } = parsed.data;

  // `.select()`siz bir UPDATE hiçbir satıra değmese de hata DÖNDÜRMEZ (204);
  // `deletePackage`taki ders burada da geçerli — kullanıcı düğmeye bastı ve
  // hiçbir şey olmadıysa bunu bilmelidir.
  const { data: etkilenen, error } = await supabase
    .from("drawing_stages")
    .update({ active })
    .eq("id", id)
    .select("slug, name");
  if (error) return { error: hataMesaji(error, "", "Aşama durumu yazılamadı") };
  if (!etkilenen?.length) return { error: "Aşama bulunamadı; defter bu arada değişmiş olabilir." };

  await denetim(supabase, userId, "drawings.stage.active", {
    id,
    slug: etkilenen[0].slug as string,
    active,
  });
  tazele();
  return {};
}

/**
 * Aşamayı listede bir basamak yukarı/aşağı taşır.
 *
 * SIRA NUMARALARI YENİDEN DAĞITILIR (10, 20, 30…), iki satırın değeri takas
 * edilmez. Takas, sıraları eşit ya da düzensiz olan bir defterde (elle girilmiş
 * numaralar) hiçbir şey değiştirmiyormuş gibi görünürdü. Yeniden dağıtım her
 * durumda çalışır ve araya aşama sokacak boşluğu da korur (`SIRA_ADIMI`).
 * Yalnız DEĞERİ DEĞİŞEN satırlar yazılır; normal bir taşımada bu iki satırdır.
 */
export async function moveStage(input: MoveStageInput): Promise<StageActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, direction } = parsed.data;

  let defter: AsamaSatiri[];
  try {
    defter = await defteriOku(supabase);
  } catch (e) {
    return { error: `Aşama defteri okunamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}` };
  }

  const yer = defter.findIndex((s) => s.id === id);
  if (yer < 0) return { error: "Aşama bulunamadı; defter bu arada değişmiş olabilir." };

  const hedef = direction === "yukari" ? yer - 1 : yer + 1;
  // Uçtaki satırda ok tuşu zaten pasiftir; buraya düşmek ancak eski bir sekmede
  // mümkündür ve o bir hata değil, YAPACAK BİR ŞEY OLMAMASIDIR.
  if (hedef < 0 || hedef >= defter.length) return {};

  const yeniDizilim = [...defter];
  [yeniDizilim[yer], yeniDizilim[hedef]] = [yeniDizilim[hedef], yeniDizilim[yer]];

  for (let i = 0; i < yeniDizilim.length; i++) {
    const satir = yeniDizilim[i];
    const yeniSira = (i + 1) * SIRA_ADIMI;
    if (satir.sort === yeniSira) continue;
    const { error } = await supabase
      .from("drawing_stages")
      .update({ sort: yeniSira })
      .eq("id", satir.id);
    if (error) return { error: hataMesaji(error, satir.name, "Sıra yazılamadı") };
  }

  tazele();
  return {};
}

/* ══════════════════════════════════════════════════════════ silme ═══ */

/**
 * Aşamayı defterden siler — YALNIZ HİÇ KULLANILMAMIŞSA.
 *
 * Kullanım SUNUCUDA SAYILIR. İstemcinin gösterdiği sayı bir görüntüdür ve açık
 * kalmış bir sekmede eskimiş olabilir; o sayıya güvenmek, atölye o aşamayı
 * kullanmaya başladıktan sonra silmeye izin vermek demekti.
 *
 * SAYIM METİN SÜTUNUNDAN YAPILIR (`stage`), `stage_id`den değil: migration'ın
 * kendi ifadesiyle "METİN SÜTUNU KALIR VE ASIL ANAHTAR ODUR" — `stage_id` bir
 * kolaylıktır ve defter satırı yokken yazılan kayıtlarda BOŞTUR. Metni saymak
 * gerçeği saymaktır ve daha kapsayıcıdır.
 */
export async function deleteStage(input: DeleteStageInput): Promise<StageActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = deleteStageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id } = parsed.data;

  const { data: asama, error: okumaHatasi } = await supabase
    .from("drawing_stages")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle();
  if (okumaHatasi) return { error: hataMesaji(okumaHatasi, "", "Aşama okunamadı") };
  if (!asama) return { error: "Aşama bulunamadı; defter bu arada değişmiş olabilir." };

  const { count, error: sayimHatasi } = await supabase
    .from("drawing_part_progress")
    .select("id", { count: "exact", head: true })
    .eq("stage", asama.slug as string);
  // SAYIM OKUNAMIYORSA SİLİNMEZ. "Bilmiyorum" ile "sıfır" aynı şey değildir;
  // ikisini karıştırmak kullanılan bir aşamayı sessizce düşürürdü.
  if (sayimHatasi) return { error: `Aşamanın kullanımı sayılamadı: ${sayimHatasi.message}` };
  if ((count ?? 0) > 0) {
    return {
      error:
        `"${asama.name}" aşamasına bağlı ${count} üretim kaydı var; silinmez. ` +
        "Kullanımdan kaldırmak için PASİFE ALIN — geçmiş kayıtların aşaması adsız kalmamalı.",
    };
  }

  const { error, count: silinen } = await supabase
    .from("drawing_stages")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: hataMesaji(error, asama.name as string, "Aşama silinemedi") };
  // Silme RLS'e takılırsa PostgREST hata değil SIFIR SATIR döner; sessiz başarı
  // kullanıcıya "sildim" der ve satır ekranda kalır.
  if (!silinen) {
    return { error: "Aşama silinemedi: yetkiniz bu satıra ulaşmıyor olabilir." };
  }

  await denetim(supabase, userId, "drawings.stage.delete", {
    id,
    slug: asama.slug,
    name: asama.name,
  });
  tazele();
  return {};
}
