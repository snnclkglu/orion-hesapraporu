"use server";

// İŞLETME VE BAKIM EL KİTABI — yazma katmanı.
//
// REVİZYON MODELİ TEKLİFİN İKİZİDİR (TEKLIF-2): `payload` belgenin tamamıdır,
// yayımlanan revizyon `guard_issued_manual_revision` ile dondurulur ve yeni
// revizyon öncekinin KOPYASIYLA açılır — mühendis boş sayfayla başlamaz.
//
// YAYIMDA OTOMATİK TABLOLAR DONAR. Taslakta bir "auto" bloğu her açılışta
// hesap raporundan/elektrik projesinden yeniden üretilir; yayımda çözülmüş
// tablo `frozen`a yazılır. Aksi hâlde teslim edilmiş bir kılavuz, kaynağı
// sonradan revize edilince sessizce başka bir şey söylerdi — ve bu, bir vinç
// kılavuzunda yapılabilecek en pahalı hatadır.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requestPermanentDeletion } from "@/lib/deletion-request-server";
import { canEditReports } from "@/lib/roles";
import {
  BOS_KIMLIK,
  manualDraftForNextRevision,
  manualFromProjectTemplate,
  withManualDefaults,
} from "@/lib/manual/payload";
import { applyAutofill } from "@/lib/manual/autofill";
import { loadManualBooks } from "@/lib/manual/books-data";
import { applyManualPackage, suggestManualPackage } from "@/lib/manual/packages";
import { resolveAutoTable, type ManualSourceData } from "@/lib/manual/sources";
import { MANUAL_IMAGE_BUCKET } from "@/lib/manual/data";
import { manualPublishReadiness } from "@/lib/manual/guide";
import {
  applyManualIdentitySuggestion,
  resolveManualIdentity,
} from "@/lib/manual/identity-server";
import type { ManualIdentity, ManualPayload, ManualSection } from "@/lib/manual/types";
import { buildManualSourceData } from "./sources-data";

export type ManualResult = { ok?: boolean; error?: string; revisionId?: string };

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
    return { error: "El kitabı düzenleme yetkiniz yok." };
  }
  return { userId: user.id };
}

/**
 * El kitabını açar ve İLK REVİZYONU şablondan kurar.
 *
 * KÜNYE ARTIK KAYNAKLARDAN DOLAR (kullanıcı isteği, 01.09.2026: *"Künye kısmı
 * olabildiğince her şey otomatik gelsin"*). Eski yorum "ÜRETİCİ, SERİ NO ve
 * SAHA uygulamada yoktur" diyordu; bu artık DOĞRU DEĞİL: üretici müşteri
 * defterindeki kendi kaydımızda (`customers.is_self`), saha
 * `projects.crane_location`da, seri/ürün kodu iş emri kaleminde ve üretim yılı
 * iş emrinin atölye çıkış tarihinde duruyor. Çözücü Vinç Kimliği ile ORTAKTIR
 * (`lib/manual/identity-server.ts`), yani plaka ile kılavuz aynı sayıyı basar.
 *
 * Kaynağı gerçekten olmayan alan yine BOŞ kalır — uydurulmaz (değişmez md. 4).
 */
export async function createManual(projectId: string): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: proje } = await supabase
    .from("projects")
    .select("id, name, customer, crane_type")
    .eq("id", projectId)
    .maybeSingle();
  if (!proje) return { error: "Proje bulunamadı." };

  const { data: varOlan } = await supabase
    .from("manuals")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (varOlan) return { error: "Bu projenin el kitabı zaten açılmış." };

  const ad = String(proje.name ?? "");
  const tip = String(proje.crane_type ?? "");
  const taslak = manualFromProjectTemplate({
    customer: String(proje.customer ?? ""),
    product: ad,
    craneType: tip,
  });

  // Künye kaynaklardan doldurulur; çözücü hata verirse belge yine açılır —
  // eksik bir künye, hiç açılmayan bir el kitabından iyidir.
  try {
    const oneri = await resolveManualIdentity(supabase, projectId, 1);
    taslak.identity = applyManualIdentitySuggestion(taslak.identity, oneri.values).identity;
  } catch {
    // sessiz: alanlar boş kalır ve kullanıcı Künye sekmesinden doldurur
  }

  // TESLİM PAKETİ VİNÇ TİPİNDEN ÖNERİLİR (KITAP-20). Öneri bir dayatma
  // değildir: kullanıcı Kapsam panelinden paketi değiştirebilir ve tek tek
  // bölüm kararı verebilir. Ama boş bir kapsamla açmak, standart bir vinçte
  // yedi ekin de kapalı ya da açık olduğu belirsiz bir belge demekti.
  const { payload: govde } = applyManualPackage(taslak, suggestManualPackage(tip), {
    at: new Date().toISOString(),
  });
  const kapak = govde.coverTitle;

  const { data: manual, error: manualHatasi } = await supabase
    .from("manuals")
    .insert({
      project_id: projectId,
      title: kapak,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (manualHatasi || !manual) return { error: manualHatasi?.message ?? "El kitabı açılamadı." };

  const { data: rev, error: revHatasi } = await supabase
    .from("manual_revisions")
    .insert({
      manual_id: manual.id,
      rev_no: 1,
      payload: govde,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (revHatasi || !rev) return { error: revHatasi?.message ?? "Revizyon açılamadı." };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, revisionId: String(rev.id) };
}

const kaydetSemasi = z.object({
  revisionId: z.uuid("Geçersiz revizyon"),
  /** Gövde JSONB olarak gelir; şekil `withManualDefaults` ile SINANIR. */
  payload: z.unknown(),
  label: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
});

/** Taslağı kaydeder. Yayımlanmış revizyonda DB tetikleyicisi reddeder. */
export async function saveManualRevision(
  projectId: string,
  input: { revisionId: string; payload: unknown; label?: string; notes?: string }
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = kaydetSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // GELEN GÖVDE OLDUĞU GİBİ YAZILMAZ. İstemciden gelen JSON serbest biçimlidir;
  // `withManualDefaults` tanınmayan düğümü düşürür ve şekli bugüne taşır.
  // Aksi hâlde bir hata (ya da kötü niyet) veritabanına okunamayan bir belge
  // yazabilirdi ve o kayıt bir daha açılmazdı.
  const govde = withManualDefaults(parsed.data.payload);

  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_revisions")
    .update({
      payload: govde,
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    })
    .eq("id", parsed.data.revisionId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/manual/${parsed.data.revisionId}`);
  return { ok: true };
}

const turetSemasi = z.object({
  revisionId: z.uuid("Geçersiz revizyon"),
  payload: z.unknown(),
  /** Yalnız bu bölüm anahtarı tazelensin. */
  sectionKey: z.string().trim().max(120).optional(),
  /** Yalnız bu blok tazelensin — `edited` bilerek yok sayılır. */
  blockId: z.string().trim().max(80).optional(),
});

export type ManualAutofillResult =
  | { error: string }
  | { ok: true; payload: ManualPayload; uretilen: number; korunan: number };

/**
 * "KAYNAKTAN DOLDUR" — türetilmiş blokları üretir ve GÖVDEYİ DÖNDÜRÜR.
 *
 * VERİTABANINA YAZMAZ. Kaydetme AÇIKTIR (KITAP-10) ve arka planda dolaşan bir
 * kaydedici hangi hâlin kaydedildiğini belirsizleştirirdi; kullanıcı türetimin
 * sonucunu görür, beğenmezse geri alır, beğenirse Kaydet'e basar.
 *
 * KAYNAK VE DEFTER SUNUCUDA ÇÖZÜLÜR: hesap raporu, elektrik projesi ve panel
 * defterleri istemciye hiç inmez — hem yetki hem boyut sebebiyle.
 */
export async function autofillManualRevision(
  projectId: string,
  input: { revisionId: string; payload: unknown; sectionKey?: string; blockId?: string }
): Promise<ManualAutofillResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = turetSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("status")
    .eq("id", parsed.data.revisionId)
    .maybeSingle();
  if (!rev) return { error: "Revizyon bulunamadı." };
  // YAYIMLANMIŞ REVİZYON DEĞİŞMEZ (KITAP-2). Tetikleyici zaten reddeder ama
  // kullanıcıya okunur bir cümle söylemek eylemin işidir.
  if ((rev as { status?: string }).status !== "draft") {
    return { error: "Yayımlanmış revizyonda türetim yapılamaz." };
  }

  const [sources, books] = await Promise.all([
    buildManualSourceData(supabase, projectId),
    loadManualBooks(supabase),
  ]);

  const govde = withManualDefaults(parsed.data.payload);
  const sonuc = applyAutofill(
    govde,
    {
      sources,
      maintenanceRules: books.maintenance,
      lubricationPoints: books.lubrication,
    },
    {
      ...(parsed.data.sectionKey ? { yalnizBolum: parsed.data.sectionKey } : {}),
      ...(parsed.data.blockId ? { yalnizBlok: parsed.data.blockId } : {}),
    }
  );

  return {
    ok: true,
    payload: sonuc.payload,
    uretilen: sonuc.uretilen,
    korunan: sonuc.korunan,
  };
}

/**
 * Otomatik blokları kaynaktan çözüp `frozen`a yazar (yayım hazırlığı).
 *
 * BLOĞUN VARYANTI DA GEÇİRİLİR (KITAP-20): kapsam paketi ekipman listesini
 * "kataloglu" yaptıysa donan tablo da kataloglu olmalıdır. Varyantsız
 * çözülseydi taslakta detaylı görünen liste yayımda sessizce standarda döner
 * ve müşteriye ekranda onaylanandan başka bir belge giderdi.
 */
function dondur(sections: ManualSection[], veri: ManualSourceData): ManualSection[] {
  return sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) =>
      b.kind === "auto" ? { ...b, frozen: resolveAutoTable(b.source, veri, b.variant) } : b
    ),
    children: dondur(s.children, veri),
  }));
}

/**
 * Revizyonu YAYIMLAR.
 *
 * İki iş bir arada yapılır ve SIRA ÖNEMLİDİR: önce otomatik tablolar donar,
 * SONRA durum `issued` olur. Ters sırada tetikleyici ikinci yazmayı
 * reddederdi ve belge, kaynağı hâlâ canlı okuyan bir yayın olurdu.
 */
export async function issueManualRevision(
  projectId: string,
  revisionId: string
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("id, status, payload")
    .eq("id", revisionId)
    .maybeSingle();
  if (!rev) return { error: "Revizyon bulunamadı." };
  if (rev.status === "issued") return { error: "Bu revizyon zaten yayımlanmış." };

  const govde: ManualPayload = withManualDefaults(rev.payload);
  const hazirlik = manualPublishReadiness(govde);
  if (hazirlik.missingIdentity.length > 0) {
    return {
      error: `Yayım kalite kapısı: eksik künye alanları — ${hazirlik.missingIdentity.join(", ")}.`,
    };
  }
  if (hazirlik.missingSections.length > 0) {
    const ilk = hazirlik.missingSections.slice(0, 3).map((section) => section.title).join(", ");
    const devam = hazirlik.missingSections.length > 3 ? "…" : "";
    return {
      error:
        `Yayım kalite kapısı: ${hazirlik.missingSections.length} vince özel bölüm boş — ` +
        `${ilk}${devam}. Bölümleri doldurun veya bilinçli olarak gizleyin.`,
    };
  }
  const veri = await buildManualSourceData(supabase, projectId);
  govde.sections = dondur(govde.sections, veri);

  const { error } = await supabase
    .from("manual_revisions")
    .update({ payload: govde, status: "issued" })
    .eq("id", revisionId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/manual/${revisionId}`);
  return { ok: true };
}

/**
 * Yeni revizyon — öncekinin KOPYASIYLA açılır. Üst el kitabı kaydı dururken
 * tüm revizyonlar silinmişse ilk taslak proje künyesiyle ŞABLONDAN yeniden
 * kurulur. Böylece boş liste, kullanıcıyı çıkmazda bırakmaz.
 *
 * GÖRSELLER DE KOPYALANIR (`equipment_attachments`ın `copyEquipmentNotes`
 * dersi): mühendis her sürümde aynı saha fotoğrafını yeniden yüklemez.
 * Kopyalama depo nesnesini de çoğaltır çünkü kayıt revizyona bağlıdır ve
 * eski revizyonun nesnesini paylaşmak, o revizyon silinince yeni belgeyi
 * boşa düşürürdü.
 *
 * DONMUŞ TABLOLAR ÇÖZÜLÜR: yeni revizyon bir TASLAKTIR ve taslakta otomatik
 * blok CANLIDIR — yoksa yeni sürüm, güncellenmiş hesap raporunu değil eski
 * yayının fotoğrafını basardı.
 */
export async function newManualRevision(
  projectId: string,
  manualId: string
): Promise<ManualResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: manual, error: manualHatasi } = await supabase
    .from("manuals")
    .select("id, title")
    .eq("id", manualId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (manualHatasi) return { error: manualHatasi.message };
  if (!manual) return { error: "El kitabı bulunamadı." };

  const { data: proje, error: projeHatasi } = await supabase
    .from("projects")
    .select("name, customer, crane_type")
    .eq("id", projectId)
    .maybeSingle();
  if (projeHatasi) return { error: projeHatasi.message };
  if (!proje) return { error: "Proje bulunamadı." };

  const { data: son, error: sonHatasi } = await supabase
    .from("manual_revisions")
    .select("id, rev_no, payload")
    .eq("manual_id", manualId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sonHatasi) return { error: sonHatasi.message };

  const taslak = manualDraftForNextRevision(
    son
      ? {
          revNo: Number(son.rev_no ?? 0),
          payload: son.payload,
        }
      : null,
    {
      customer: String(proje.customer ?? ""),
      product: String(proje.name ?? ""),
      craneType: String(proje.crane_type ?? ""),
      coverTitle: String(manual.title ?? ""),
    }
  );
  /*
   * DOKÜMAN NO VE REVİZYON ETİKETİ YENİ SÜRÜMDE KESİN OLARAK DEĞİŞİR.
   *
   * Önceki hâl önceki snapshot'ı olduğu gibi kopyalıyordu; `customerRevision`
   * elle güncellenmediği sürece V2 hâlâ "R01" yazıyordu ve belge kodu bir
   * önceki revizyonu gösteriyordu. Diğer künye alanları KORUNUR — kullanıcının
   * yazdığı bir değer bir revizyon açmakla silinemez (KITAP-4).
   */
  try {
    const oneri = await resolveManualIdentity(supabase, projectId, taslak.revNo);
    taslak.payload.identity = applyManualIdentitySuggestion(
      taslak.payload.identity,
      oneri.values
    ).identity;
  } catch {
    // sessiz: künye eski hâliyle taşınır
  }

  const { data: yeni, error } = await supabase
    .from("manual_revisions")
    .insert({
      manual_id: manualId,
      rev_no: taslak.revNo,
      payload: taslak.payload,
      created_by: izin.userId,
    })
    .select("id")
    .single();
  if (error || !yeni) return { error: error?.message ?? "Revizyon açılamadı." };

  // Görselleri taşı: önce depo nesnesi kopyalanır, sonra kayıt yazılır.
  // KOPYA YA HEP YA HİÇTİR. Payload eski `imageId`leri aynen taşıdığı için
  // tek görselin düşmesi bile yeni revizyonu içerik olarak bozar; hata olursa
  // bu çağrıda açılan taslak ve kopyalanan nesneler geri alınır.
  let gorseller: Record<string, unknown>[] = [];
  if (son) {
    const { data } = await supabase
      .from("manual_images")
      .select("id, file_name, storage_path, width, height, size_bytes, origin")
      .eq("revision_id", son.id);
    gorseller = (data ?? []) as Record<string, unknown>[];
  }
  const kopyalananYollar: string[] = [];
  const geriAl = async () => {
    if (kopyalananYollar.length > 0) {
      await supabase.storage.from(MANUAL_IMAGE_BUCKET).remove(kopyalananYollar);
    }
    await supabase.rpc("rollback_manual_revision_copy", { p_revision_id: yeni.id });
  };
  for (const g of gorseller) {
    const eski = String(g.storage_path);
    const uzanti = eski.slice(eski.lastIndexOf(".") + 1) || "png";
    const yeniYol = `${yeni.id}/${String(g.id)}.${uzanti}`;
    const { error: kopyaHatasi } = await supabase.storage
      .from(MANUAL_IMAGE_BUCKET)
      .copy(eski, yeniYol);
    if (kopyaHatasi) {
      await geriAl();
      return { error: `Görsel dosyası kopyalanamadı (${kopyaHatasi.message}). Revizyon açılmadı.` };
    }
    kopyalananYollar.push(yeniYol);
    // KİMLİK KORUNUR: gövdedeki `imageId` atıfları aynı kalmalı, yoksa her
    // resim bloğu boşa düşerdi.
    //
    // HATA SESSİZ KALAMAZ (ölçüldü, 20.08.2026): bu insert `manual_images.id`
    // tek sütunlu birincil anahtar olduğu sürece 23505 ile DÜŞÜYOR ve dönüş
    // değeri okunmadığı için kimse görmüyordu — R01'de resimli olan kılavuz
    // R02'de resimsiz çıkıyordu. Anahtar `(revision_id, id)` yapıldı
    // (20260823000001_manual_images_pk.sql); yine de hata YUTULMAZ, çünkü bu
    // düzeltmenin uygulanıp uygulanmadığını ancak burası söyler.
    const { error: kayitHatasi } = await supabase.from("manual_images").insert({
      id: String(g.id),
      revision_id: yeni.id,
      file_name: String(g.file_name ?? ""),
      storage_path: yeniYol,
      width: Number(g.width ?? 0),
      height: Number(g.height ?? 0),
      size_bytes: Number(g.size_bytes ?? 0),
      // KAYNAK DA KOPYALANIR: yeni revizyonda "bu resim hangi paftanın kaçıncı
      // sayfası" sorusu aynen geçerlidir (KITAP-22).
      origin: (g.origin ?? {}) as Record<string, unknown>,
      created_by: izin.userId,
    });
    if (kayitHatasi) {
      await geriAl();
      return {
        error: `Görsel kaydı kopyalanamadı (${kayitHatasi.message}). Revizyon açılmadı.`,
      };
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, revisionId: String(yeni.id) };
}

/** Taslak revizyonun kalıcı silinmesini Yönetici onay kuyruğuna yollar. */
export async function deleteManualRevision(
  projectId: string,
  revisionId: string
): Promise<ManualResult> {
  return requestPermanentDeletion({
    entityType: "manual_revision",
    targetId: revisionId,
    context: { project_id: projectId },
  });
}

/**
 * KÜNYEYİ KAYNAKTAN TAZELE — VERİTABANINA HİÇBİR ŞEY YAZMAZ.
 *
 * Kullanıcı isteği (01.09.2026): künye alanları "olabildiğince otomatik"
 * gelsin. Otomatik doldurma bir KERE değil, İSTENDİĞİNDE çalışır: proje adı
 * düzeltilir, iş emrine atölye çıkış tarihi girilir ya da firma künyesi
 * güncellenir — kullanıcı bu düğmeyle onları belgeye çeker.
 *
 * KAYDETME AÇIKTIR (KITAP-10): bu eylem yalnız ÖNERİYİ çözer ve editöre
 * döndürür; gövdeye işlemek ve kaydetmek kullanıcının kararıdır. Arka planda
 * yazan bir tazeleyici, hangi hâlin kaydedildiğini belirsizleştirirdi.
 *
 * `hepsiniTazele` KAPALIYKEN yalnız BOŞ alanlar doldurulur ve dolu olanlar
 * korunur; açıkken kullanıcının düzenlemesi de kaynağa döner. Bu, Kaynaktan
 * Doldur / Kaynaktan Tazele ayrımının künye karşılığıdır (KITAP-21).
 */
export async function refreshManualIdentity(
  projectId: string,
  input: { revisionId: string; identity: unknown; revNo: number; hepsiniTazele?: boolean }
): Promise<
  | { error: string }
  | { identity: ManualIdentity; doldurulan: number; korunan: number }
> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();

  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("id, rev_no, status, manuals!inner(project_id)")
    .eq("id", input.revisionId)
    .maybeSingle();
  if (!rev) return { error: "Revizyon bulunamadı." };
  if ((rev.manuals as unknown as { project_id: string }).project_id !== projectId) {
    return { error: "Revizyon bu projeye ait değil." };
  }
  if (rev.status === "issued") return { error: "Yayımlanmış revizyon değiştirilemez." };

  // Gelen künye İSTEMCİDENDİR ve olduğu gibi kullanılmaz: `withManualDefaults`
  // yalnız gövdeyi tanır, o yüzden künye burada tek tek okunur (KITAP-10).
  const gelen = (input.identity && typeof input.identity === "object" ? input.identity : {}) as Record<string, unknown>;
  const mevcut = { ...BOS_KIMLIK };
  for (const anahtar of Object.keys(BOS_KIMLIK) as (keyof ManualIdentity)[]) {
    mevcut[anahtar] = String(gelen[anahtar] ?? "");
  }

  const oneri = await resolveManualIdentity(supabase, projectId, Number(rev.rev_no ?? input.revNo ?? 1));
  const sonuc = applyManualIdentitySuggestion(mevcut, oneri.values, {
    hepsiniTazele: input.hepsiniTazele === true,
  });
  return { identity: sonuc.identity, doldurulan: sonuc.doldurulan, korunan: sonuc.korunan };
}
