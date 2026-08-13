"use server";

// Teknik Resimler — sunucu eylemleri.
//
// AYRIŞTIRMA HER ZAMAN SUNUCUDA yapılır. İstemci yalnız yol, boyut ve imza
// gönderir; adı çözen, rolü belirleyen ve kodu bulan `src/lib/drawings/`
// çekirdeğidir. İstemci de aynı saf işlevleri çağırır ama YALNIZ ÖN İNCELEME
// GÖSTERMEK için — tek doğruluk kaynağı sunucudur ve kural değiştiğinde eski
// bir sekmeden gelen kayıt yanlış ayrıştırılmış olmaz.
//
// ————————————————————————————————————— YÜKLEMENİN SIRASI VE NEDEN BÖYLE
//
//   createPackage       paketi açar (dosya listesi TAŞIMAZ — 1 MB gövde sınırı)
//   addPackageFiles ×N  satırları 500'lük öbeklerle yazar, depo yollarını döner
//   sealPackageFiles    tanımayı BÜTÜN adlara bakarak yapar, sayaçları ölçer
//   [ baytlar tarayıcıdan doğrudan depoya gider ]
//   finalizeUpload      ulaşanları KİMLİKLE işaretler, ULAŞMAYANIN SEBEBİNİ yazar
//   verifyStorage       bucket'ı LİSTELER — beyanı değil gerçeği kaydeder
//   import ?asama=…     içerik okuma (ayrı route, Node çalışma zamanı ister)
//   reconcilePackage    defteri ve bulguları kurar
//   supersedePackage    (revizyonsa) eskiyi düşürür, üretim kaydını devreder
//
// Sıra bilinçlidir: satırlar baytlardan ÖNCE yazılır ki yarıda kalan bir
// yükleme kaldığı yerden sürdürülebilsin. Bu fazın düzelttiği kusur da tam
// buradaydı — iki yön hiçbir zaman KARŞILAŞTIRILMIYORDU.

// `randomUUID` AÇIKÇA içe aktarılır: `globalThis.crypto` yalnız Node 19+'da
// kararlıdır ve dağıtımın Node sürümüne bağlı sessiz bir kırılganlık istemiyoruz.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { resolveItemNo } from "@/lib/job-items";
import { parseFile } from "@/lib/drawings/file-name";
import { folderNameFromContents, parseFolderName } from "@/lib/drawings/folder-name";
import {
  reconcile,
  RECONCILER_VERSION,
  type FileContent,
  type PackageSnapshot,
} from "@/lib/drawings/reconcile";
import { packageDiff, type DiffFile, type DiffPart } from "@/lib/drawings/diff";
import {
  carryDecisions,
  carrySummary,
  carrySummaryText,
  type ProgressRef,
} from "@/lib/drawings/revision";
import { PURCHASE_PREFIX } from "@/lib/drawings/progress";
import { grupAdlariCikar } from "@/lib/drawings/normalize";
import { trKatla } from "@/lib/drawings/tr-text";
import type { BomRow, ParsedFile } from "@/lib/drawings/types";
import {
  ackFindingSchema,
  activePackageQuerySchema,
  addPackageFilesSchema,
  bindAliasSchema,
  createPackageSchema,
  deletePackageSchema,
  finalizeUploadSchema,
  packageIdSchema,
  remapItemSchema,
  reviewMarkSchema,
  SILME_ONAY_SOZU,
  supersedeSchema,
  type AckFindingInput,
  type ActivePackageQueryInput,
  type AddPackageFilesInput,
  type BindAliasInput,
  type CreatePackageInput,
  type DeletePackageInput,
  type DrawingActionResult,
  type FinalizeUploadInput,
  type RemapItemInput,
  type ReviewMarkInput,
  type SupersedeInput,
  type UploadTarget,
} from "./schema";

const BUCKET = "drawings";

/** Bir `in(...)` listesinin en çok kaç eleman taşıyacağı — URL uzunluğu sınırı. */
const KUME = 50;
/** Bir insert'in en çok kaç satır taşıyacağı. */
const YIGIN = 300;
/** Depo listelemesinin sayfa boyu — Storage API'nin kendi tavanı. */
const DEPO_SAYFA = 1000;

/**
 * SATIN ALMA HAVUZU BU MODÜLDEN BESLENİR — o yüzden buradan tazelenir.
 *
 * `/purchasing` ayrı bir tablo tutmaz: talep havuzu, teslimat ve ödeme
 * takvimleri `drawing_packages` + `drawing_parts` üzerinden TÜRETİLİR
 * (md. 21). Yani teknik resim tarafındaki her paket/defter değişikliği o beş
 * ekranı da eskitir; buradan tazelenmediğinde satınalmacı yeni yüklenmiş bir
 * paketi görmek için sayfayı elle yenilemek zorunda kalıyordu ve bunu
 * "proje satın almaya düşmedi" diye yaşıyordu (kullanıcı bildirimi,
 * 12.08.2026).
 *
 * Ters yön ZATEN VAR: `purchasing/actions.ts` paket ekranını
 * (`/drawings/<id>/purchasing`) tazeliyor. Bu, o simetrinin eksik yarısıdır.
 */
function satinAlmayiTazele() {
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/siparisler");
  revalidatePath("/purchasing/teslimat");
  revalidatePath("/purchasing/odemeler");
  revalidatePath("/purchasing/fiyatlar");
}

/**
 * Yazma yetkisi + oturum. Asıl engel RLS'tir; bu yalnız anlaşılır mesaj içindir.
 *
 * EXPORT EDİLİR: üretim durumu eylemleri (`[id]/progress/actions.ts`) aynı
 * soruyu soruyor. İki kopya kalsaydı yetki kuralı bir gün yalnız bir yerde
 * değişir ve atölye ekranı sessizce daha gevşek kalırdı.
 */
export async function requireWrite(): Promise<
  { supabase: SupabaseClient; userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditDrawings(profile?.role)) {
    return { error: "Teknik resim yükleme yetkiniz yok (Yönetici · Mühendis · Teknik Ressam)." };
  }
  return { supabase, userId: user.id };
}

/* ═══════════════════════════════════════════════════════ paket açma ═══ */

/**
 * Paketi açar. DOSYA LİSTESİ ALMAZ — satırlar `addPackageFiles` ile gelir.
 *
 * Tanıma burada YALNIZ klasör adından yapılır; içerikten tanıma bütün dosya
 * adlarını ister ve o `sealPackageFiles`in işidir. Klasör adı çözülemese de
 * paket AÇILIR: bir klasörü adlandırma biçimi yüzünden geri çevirmek, o
 * ressamın bir daha denememesi demektir.
 */
export async function createPackage(
  input: CreatePackageInput
): Promise<DrawingActionResult & { packageId?: string }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = createPackageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { folderName, itemNoOverride, supersedesId } = parsed.data;

  const tanima = parseFolderName(folderName);
  const klasor = tanima.value;
  const itemNo = (itemNoOverride || klasor?.itemNo || "").trim();
  const link = itemNo ? await resolveItemNo(supabase, itemNo) : { jobItemId: null, jobId: null };

  // Revizyonun numarası ESKİDEN TÜRER: `docCode("TR", …, revNo)` zaten `revNo`
  // alıyor, çıktı adları kendiliğinden R02 olur.
  let revNo = 1;
  if (supersedesId) {
    const { data: eski } = await supabase
      .from("drawing_packages")
      .select("rev_no")
      .eq("id", supersedesId)
      .maybeSingle();
    revNo = Number(eski?.rev_no ?? 1) + 1;
  }

  const { data: paket, error: paketHatasi } = await supabase
    .from("drawing_packages")
    .insert({
      folder_name: folderName,
      recognized_by: tanima.by,
      item_no: itemNo,
      job_id: link.jobId,
      job_item_id: link.jobItemId,
      job_code: klasor?.job ?? "",
      item_suffix: klasor?.suffix ?? "",
      group_code: klasor?.group ?? "",
      description: klasor?.description ?? "",
      capacity: klasor?.capacity ?? "",
      status: "yukleniyor",
      rev_no: revNo,
      // BAĞ ŞİMDİ KURULUR, DÜŞÜRME SONRA. Eski paket `aktif` kalır ve ancak
      // yükleme + eşleştirme başarıyla bittiğinde `superse` olur — yarım kalan
      // bir revizyon yüzünden atölyenin bakacağı resimler kaybolamaz.
      supersedes_id: supersedesId ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (paketHatasi || !paket) {
    return { error: `Paket oluşturulamadı: ${paketHatasi?.message ?? "bilinmeyen hata"}` };
  }
  const packageId = paket.id as string;

  await olayYaz(supabase, packageId, folderName, "olusturuldu", userId, {
    rev_no: revNo,
    supersedes_id: supersedesId ?? null,
  });

  revalidatePath("/drawings");
  return { packageId };
}

/**
 * Dosya satırlarını yazar ve depo hedeflerini döner — ÖBEK ÖBEK ÇAĞRILIR.
 *
 * KİMLİK BURADA ÜRETİLİR, veritabanında değil. Depo anahtarı
 * `{package_id}/{file_id}` olduğu için satır yazılmadan yol bilinemez gibi
 * görünür — ilk sürüm bu yüzden önce satırları yazıp SONRA her birine
 * `storage_path`i tek tek UPDATE ediyordu. 454 dosyada bu 454 ardışık
 * gidiş-geliş demek. Kimliği burada üretmek tek geçişte yazmayı sağlar.
 *
 * ————————————————————————————————— NE YÜKLENMEZ VE NEDEN
 *
 * İki tür dosyanın baytları GÖNDERİLMEZ ve bu bir kısıtlama değil TUTARLILIKTIR:
 *
 *   `haric`  — `.bak` yedeği ve `_Sheet` çalışma dosyası deftere BİLEREK
 *              alınmıyor; onları depoya yollamak "saymıyorum ama saklıyorum"
 *              demekti. MTC'de 10 `.bak` hem sayılmıyor hem yükleniyordu.
 *   `kopya`  — bayt bayt aynı dosya ikinci kez gönderilmez; satırın
 *              `storage_path`i ASLININKİNİ gösterir, yani dosya yine açılır.
 *
 * ASIL KAZANÇ YER DEĞİL HIZ: MTC'de 26 dosya ve 15,4 MB daha az istek demek.
 * Ofis hattında her istek bir başarısızlık fırsatıdır.
 */
export async function addPackageFiles(
  input: AddPackageFilesInput
): Promise<DrawingActionResult & { uploads?: UploadTarget[] }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = addPackageFilesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, files, onConflict } = parsed.data;

  // PAKETTE ZATEN NE VAR. Tek okuma iki soruya birden cevap verir: aynı yol
  // daha önce yazılmış mı (çakışma) ve aynı imza daha önce geçmiş mi (kopya).
  // `.in()` ile sormak 500 imzalık bir öbekte 33 KB URL ederdi.
  // GELEN LİSTE ÖNCE KENDİ İÇİNDE SINANIR — DB'ye dokunmadan.
  //
  // Aynı yolu taşıyan iki aday tek bir öbekte gelebiliyor: "Dosya Ekle"
  // penceresi seçimi DEĞİŞTİRMEZ, EKLER ve iki ayrı kaynak klasördeki aynı
  // adlı iki dosya aynı hedef yolu üretir. Bu, aşağıdaki arşivleme adımını
  // hayalet bir kimliğe yöneltip insert'i tekillik kısıtına düşürüyordu; o
  // noktada eski satır çoktan İPTAL'e taşınmış ve canlı yol BOŞ kalmış
  // oluyordu. Sınama en başta yapılır ki hiçbir yazma başlamasın.
  const gelenYollar = new Set<string>();
  for (const f of files) {
    if (gelenYollar.has(f.relPath)) {
      return {
        error: `Aynı yol bu seçimde iki kez var: ${f.relPath}. Fazladan olanı listeden çıkarın.`,
      };
    }
    gelenYollar.add(f.relPath);
  }

  const mevcut = await tumSayfalar(
    supabase,
    "drawing_files",
    packageId,
    "id, rel_path, folder, lifecycle, checksum, storage_path"
  );
  const yolIle = new Map<string, { id: string; storagePath: string }>();
  const imzaIle = new Map<string, string>();
  // VERİTABANINDA GERÇEKTEN VAR OLAN satırların kimlikleri. `yolIle` bu tur
  // içinde üretilen (henüz yazılmamış) kimlikleri de taşıyor; arşivleme yalnız
  // bu kümeye bakar, yoksa var olmayan bir satırı güncellemeye çalışır.
  const dbdeVar = new Set<string>();
  for (const r of mevcut) {
    const yol = r.rel_path as string;
    const imza = (r.checksum as string) ?? "";
    const depo = (r.storage_path as string) ?? "";
    yolIle.set(yol, { id: r.id as string, storagePath: depo });
    dbdeVar.add(r.id as string);
    if (imza && depo && !imzaIle.has(imza)) imzaIle.set(imza, depo);
  }

  const uploads: UploadTarget[] = [];
  const satirlar: Record<string, unknown>[] = [];
  /** Yeni sürüm olarak eklenen dosyanın süperse edeceği eski satır. */
  const supersele: { eskiId: string; yeniId: string }[] = [];
  /**
   * Arşivlenen satırların ESKİ hâli — insert düşerse geri alınır.
   *
   * Arşiv UPDATE'leri döngü içinde tek tek commit oluyor, insert ise
   * döngüden sonra tek ifadede. İkisi tek işlemde değil; insert herhangi bir
   * sebeple düşerse (RLS, ağ, kısıt) canlı yolda HİÇBİR satır kalmazdı.
   * Telafi eden bir geri alma, "önce ucuz olanı kaybet" ilkesinin buradaki
   * karşılığıdır.
   */
  const geriAl: { id: string; rel_path: string; folder: string; lifecycle: string }[] = [];

  for (const f of files) {
    const cozulmus = parseFile({ relPath: f.relPath, size: f.size, checksum: f.checksum });
    let carpisma = yolIle.get(f.relPath);

    // AYNI YOL İKİNCİ KEZ GELİYORSA BU BİR YENİ SÜRÜMDÜR, HATA DEĞİL.
    //
    // Eski satır RESSAMIN KENDİ SÖZLÜĞÜYLE arşivlenir: `İPTAL` alt klasörüne
    // taşınır. Uydurma bir işaret koymak yerine var olan anlamı kullanmak,
    // eşleştirmenin bu durumu ZATEN bildiği anlamına gelir — `parseFile` yolu
    // görünce yaşam döngüsünü `iptal` yapar, `reconcile` canlı bir adaş
    // bulunca onu `superse`ye çevirir. Baytlar SİLİNMEZ; dosya gezgininde
    // "Süperse · kopya · hariç" katında durur.
    if (carpisma && onConflict === "yeniSurum" && dbdeVar.has(carpisma.id)) {
      const eskiSatir = mevcut.find((r) => r.id === carpisma!.id)!;
      const arsivYol = iptalYolu(f.relPath, yolIle);
      const arsiv = parseFile({ relPath: arsivYol, size: 0, checksum: "" });
      // ETKİLENEN SATIR OKUNUR. `.select()`siz bir UPDATE hiçbir satıra
      // değmese de hata DÖNDÜRMEZ (204); `deletePackage`taki `count` dersi
      // burada da geçerlidir.
      const { data: etkilenen, error } = await supabase
        .from("drawing_files")
        .update({ rel_path: arsivYol, folder: arsiv.folder, lifecycle: "superse" })
        .eq("id", carpisma.id)
        .select("id");
      if (error) return { error: `Eski sürüm arşivlenemedi: ${error.message}` };
      if (!etkilenen?.length) {
        return { error: `Eski sürüm arşivlenemedi: ${f.relPath} satırı bulunamadı.` };
      }
      geriAl.push({
        id: carpisma.id,
        rel_path: f.relPath,
        folder: (eskiSatir.folder as string) ?? "",
        lifecycle: (eskiSatir.lifecycle as string) ?? "canli",
      });
      yolIle.delete(f.relPath);
      yolIle.set(arsivYol, carpisma);
      supersele.push({ eskiId: carpisma.id, yeniId: "" });
      carpisma = undefined;
    }

    if (carpisma && onConflict === "atla") {
      // Sürdürme kipi: satır zaten yazılmış, yalnız yolu geri istiyoruz.
      uploads.push({
        fileId: carpisma.id,
        relPath: f.relPath,
        storagePath: carpisma.storagePath,
        skip: false,
      });
      continue;
    }
    if (carpisma && onConflict === "hata") {
      return { error: `Bu yol pakette zaten var: ${f.relPath}` };
    }

    const fileId = randomUUID();
    const haric = cozulmus.lifecycle === "haric";
    const kopyaYolu = !haric && f.checksum ? imzaIle.get(f.checksum) : undefined;
    const atlanir = haric || Boolean(kopyaYolu);
    // Yedek dosyanın hiç yolu OLMAZ: boş `storage_path` "burada bir nesne
    // aramayın" demenin en dürüst yoludur ve dosya gezgini düğmeyi ona bakarak
    // pasifleştirir.
    const storagePath = haric ? "" : kopyaYolu ?? `${packageId}/${fileId}`;

    if (!atlanir && f.checksum) imzaIle.set(f.checksum, storagePath);
    yolIle.set(f.relPath, { id: fileId, storagePath });

    // Arşivlenen eski satır bu yeni satırı gösterecek (`superseded_file_id`);
    // kimlik ancak burada bilindiği için boş bırakılan alan şimdi doldurulur.
    const bekleyen = supersele.find((s) => s.yeniId === "");
    if (bekleyen) bekleyen.yeniId = fileId;

    satirlar.push({
      id: fileId,
      storage_path: storagePath,
      package_id: packageId,
      rel_path: f.relPath,
      folder: cozulmus.folder,
      file_name: cozulmus.fileName,
      ext: cozulmus.ext,
      role: cozulmus.role,
      lifecycle: cozulmus.lifecycle,
      part_code: cozulmus.partCode,
      material: cozulmus.material,
      thickness_mm: cozulmus.thicknessMm,
      qty: cozulmus.qty,
      label: cozulmus.label,
      recognized_by: cozulmus.recognizedBy,
      folder_material: cozulmus.folderMaterial,
      folder_thickness_mm: cozulmus.folderThicknessMm,
      size_bytes: cozulmus.size,
      checksum: cozulmus.checksum,
      upload_skipped: atlanir,
    });

    uploads.push({ fileId, relPath: f.relPath, storagePath, skip: atlanir });
  }

  for (let i = 0; i < satirlar.length; i += YIGIN) {
    const { error } = await supabase.from("drawing_files").insert(satirlar.slice(i, i + YIGIN));
    if (error) {
      // ARŞİVLENENLERİ GERİ AL. Yoksa canlı yol boş kalır: eski resim İPTAL
      // altında, yerine gelen yok. Kullanıcı ekranda yalnız bir hata mesajı
      // görür ve bir teknik resmin sessizce yerinden oynadığını bilmez.
      for (const g of geriAl) {
        await supabase
          .from("drawing_files")
          .update({ rel_path: g.rel_path, folder: g.folder, lifecycle: g.lifecycle })
          .eq("id", g.id);
      }
      return { error: `Dosya kaydı yazılamadı: ${error.message}` };
    }
  }

  for (const s of supersele) {
    if (!s.yeniId) continue;
    await supabase
      .from("drawing_files")
      .update({ superseded_file_id: s.yeniId })
      .eq("id", s.eskiId);
  }

  return { uploads };
}

/**
 * Eski sürümün arşiv yolu — ressamın kendi sözlüğüyle: `<klasör>/İPTAL/<ad>`.
 *
 * Zaten dolu bir yola denk gelirse sıra numarası eklenir; `(package_id,
 * rel_path)` tekildir ve çakışma yüklemeyi düşürürdü.
 */
function iptalYolu(relPath: string, dolu: Map<string, unknown>): string {
  const parcalar = relPath.split("/");
  const ad = parcalar.pop() ?? relPath;
  const taban = [...parcalar, "İPTAL", ad].join("/");
  if (!dolu.has(taban)) return taban;
  const nokta = ad.lastIndexOf(".");
  const kok = nokta > 0 ? ad.slice(0, nokta) : ad;
  const uzanti = nokta > 0 ? ad.slice(nokta) : "";
  for (let n = 2; n < 100; n++) {
    const aday = [...parcalar, "İPTAL", `${kok} (${n})${uzanti}`].join("/");
    if (!dolu.has(aday)) return aday;
  }
  return [...parcalar, "İPTAL", `${kok} (${randomUUID().slice(0, 8)})${uzanti}`].join("/");
}

/**
 * Bütün satırlar yazıldıktan SONRA: tanımayı tamamla, sayaçları ÖLÇ.
 *
 * İçerikten tanıma (`folderNameFromContents`) bütün dosya adlarını ister; o
 * liste artık veritabanındadır ve buradan okunması gövde sınırını tamamen
 * ilgisiz kılar. Sayaçlar da BEYANDAN değil SATIRLARDAN gelir.
 */
export async function sealPackageFiles(input: {
  packageId: string;
}): Promise<DrawingActionResult & { itemNo?: string; groupCode?: string }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  const { data: paket } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, item_no, group_code")
    .eq("id", packageId)
    .maybeSingle();
  if (!paket) return { error: "Paket bulunamadı." };

  const dosyalar = await tumSayfalar(
    supabase,
    "drawing_files",
    packageId,
    "file_name, size_bytes, upload_skipped"
  );

  const folderName = paket.folder_name as string;
  let tanima = parseFolderName(folderName);
  if (!tanima.value) {
    tanima = folderNameFromContents(
      folderName,
      dosyalar.map((d) => d.file_name as string)
    );
  }
  const klasor = tanima.value;

  const guncelleme: Record<string, unknown> = {
    file_count: dosyalar.length,
    bytes_total: dosyalar.reduce((t, d) => t + Number(d.size_bytes ?? 0), 0),
    skipped_count: dosyalar.filter((d) => d.upload_skipped === true).length,
    updated_by: userId,
  };

  // Kullanıcının yazdığı kalem numarası ya da daha önce çözülmüş bir kimlik
  // EZİLMEZ: içerikten tanıma yalnız BOŞ ALANI doldurur.
  if (klasor && !(paket.item_no as string)) {
    const itemNo = klasor.itemNo.trim();
    const link = itemNo ? await resolveItemNo(supabase, itemNo) : { jobItemId: null, jobId: null };
    guncelleme.recognized_by = tanima.by;
    guncelleme.item_no = itemNo;
    guncelleme.job_id = link.jobId;
    guncelleme.job_item_id = link.jobItemId;
    guncelleme.job_code = klasor.job;
    guncelleme.item_suffix = klasor.suffix;
    guncelleme.description = klasor.description;
    guncelleme.capacity = klasor.capacity;
  }
  if (klasor && !(paket.group_code as string)) guncelleme.group_code = klasor.group;

  const { error } = await supabase.from("drawing_packages").update(guncelleme).eq("id", packageId);
  if (error) return { error: `Paket künyesi yazılamadı: ${error.message}` };

  revalidatePath("/drawings");
  return {
    itemNo: (guncelleme.item_no as string) ?? (paket.item_no as string),
    groupCode: (guncelleme.group_code as string) ?? (paket.group_code as string),
  };
}

/* ══════════════════════════════════════════════ yükleme sonucu ═══ */

/**
 * Yüklemenin SONUCUNU kaydeder — ulaşanı da ULAŞMAYANIN SEBEBİNİ de.
 *
 * YOL DEĞİL KİMLİK kullanılır (bkz. `schema.ts` `finalizeUploadSchema`): 36
 * karakterlik UUID'lerle 50'lik öbek ~2 KB URL eder, gerçek yollarla 200'lük
 * öbek 22–26 KB ediyordu ve bir gün 414 ile sessizce düşecekti.
 *
 * `stored = false` de AÇIKÇA yazılır: yeniden denenen bir yüklemede eski bir
 * `true` yerinde kalırsa doğrulama sonuna kadar yanlış bir sayı gösterirdi.
 */
export async function finalizeUpload(input: FinalizeUploadInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = finalizeUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, storedFileIds, failed } = parsed.data;

  for (const obek of kumele(storedFileIds, KUME)) {
    const { error } = await supabase
      .from("drawing_files")
      .update({ stored: true, upload_error: "" })
      .eq("package_id", packageId)
      .in("id", obek);
    if (error) return { error: `Yükleme işaretlenemedi: ${error.message}` };
  }

  // SEBEP SATIRIN KENDİNE YAZILIR. Eski sihirbaz yalnız yolu bir diziye
  // itiyordu; `error.message` ve HTTP durumu atılıyordu ve "neden ulaşmadı"
  // sorusu bir daha cevaplanamıyordu.
  //
  // Aynı sebebi paylaşanlar tek UPDATE ile yazılır: bir ağ kesintisinde 150
  // dosya aynı mesajı taşır ve 150 ardışık sorgu anlamsız olurdu.
  const sebepKumeleri = new Map<string, string[]>();
  for (const f of failed) {
    const liste = sebepKumeleri.get(f.message ?? "");
    if (liste) liste.push(f.fileId);
    else sebepKumeleri.set(f.message ?? "", [f.fileId]);
  }
  for (const [sebep, idler] of sebepKumeleri) {
    for (const obek of kumele(idler, KUME)) {
      const { error } = await supabase
        .from("drawing_files")
        .update({ stored: false, upload_error: sebep.slice(0, 500) })
        .eq("package_id", packageId)
        .in("id", obek);
      if (error) return { error: `Yükleme hatası kaydedilemedi: ${error.message}` };
    }
  }

  // SÜPERSE EDİLMİŞ PAKET DİRİLTİLMEZ.
  //
  // `reconcilePackage` aynı korumayı taşıyor ama sıra finalize → verify →
  // reconcile: burada durum `yuklendi`ye çekilseydi oradaki `.neq` artık
  // tutmaz ve emekli edilmiş R01, R02 ile birlikte `aktif` görünürdü. Yol
  // gerçek: "Eksik Dosyaları Yükle" ve "Dosya Ekle" süperse bir pakette de
  // çalışabilir.
  const { error: durumHatasi } = await supabase
    .from("drawing_packages")
    .update({ status: "yuklendi", updated_by: userId })
    .eq("id", packageId)
    .neq("status", "superse");
  if (durumHatasi) return { error: `Paket durumu yazılamadı: ${durumHatasi.message}` };

  revalidatePath("/drawings");
  satinAlmayiTazele();
  return {};
}

/**
 * DEPOYU GERÇEKTEN DOĞRULA — bu fazın çekirdek eylemi.
 *
 * "Bayt ulaştı mı" sorusunun TEK YETKİLİ CEVABI budur ve bucket'ı listeleyerek
 * verilir. Öncesinde hiçbir ekran bunu sormuyordu: `file_count` paket açılırken
 * bir kez yazılıyor ve bir daha güncellenmiyordu, yani her sayı istemcinin
 * beyanıydı. `stored` alanı da beyandan yazılıyordu — sihirbaz "hata almadım"
 * dediği için `true` oluyordu.
 *
 * SAYFALANIR: Storage `list` bir çağrıda en çok 1000 nesne döner ve 454
 * dosyalık bir paket bugün tek sayfaya sığsa da 2000'lik bir paket sığmaz.
 * Sayfalamayan bir doğrulama, "eksik" diye var olan dosyaları gösterirdi.
 */
export async function verifyStorage(input: { packageId: string }): Promise<
  DrawingActionResult & {
    storedCount?: number;
    expectedCount?: number;
    skippedCount?: number;
    storedBytes?: number;
    missing?: number;
  }
> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  const nesneler = new Map<string, number>();
  for (let ofset = 0; ; ofset += DEPO_SAYFA) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(packageId, { limit: DEPO_SAYFA, offset: ofset });
    if (error) return { error: `Depo listelenemedi: ${error.message}` };
    const dilim = data ?? [];
    for (const o of dilim) {
      const boyut = Number((o.metadata as { size?: number } | null)?.size ?? 0);
      nesneler.set(o.name, boyut);
    }
    if (dilim.length < DEPO_SAYFA) break;
  }

  const dosyalar = await tumSayfalar(
    supabase,
    "drawing_files",
    packageId,
    "id, storage_path, size_bytes, stored, upload_skipped"
  );

  const dogru: string[] = [];
  const yanlis: string[] = [];
  let storedCount = 0;
  let skippedCount = 0;
  let skippedBytes = 0;
  let bytesTotal = 0;

  for (const d of dosyalar) {
    const atlandi = d.upload_skipped === true;
    const boyut = Number(d.size_bytes ?? 0);
    bytesTotal += boyut;
    if (atlandi) {
      skippedCount++;
      skippedBytes += boyut;
    }
    // Kopya satırının `storage_path`i ASLININKİNİ gösterir ve o nesne gerçekten
    // vardır; ama satırın KENDİ nesnesi yoktur. `stored` bu ayrımı taşır ve
    // atlananlar `upload_skipped` sayesinde "eksik" sayılmaz.
    const yol = ((d.storage_path as string) ?? "").split("/").pop() ?? "";
    const gercek = !atlandi && yol !== "" && nesneler.has(yol);
    if (gercek) storedCount++;
    if (gercek !== (d.stored === true)) (gercek ? dogru : yanlis).push(d.id as string);
  }

  for (const obek of kumele(dogru, KUME)) {
    await supabase.from("drawing_files").update({ stored: true }).in("id", obek);
  }
  for (const obek of kumele(yanlis, KUME)) {
    await supabase.from("drawing_files").update({ stored: false }).in("id", obek);
  }

  const storedBytes = [...nesneler.values()].reduce((t, n) => t + n, 0);
  const expectedCount = dosyalar.length - skippedCount;

  // DÖRT SAYAÇ DA BURADAN YAZILIR — tek ölçüm noktası.
  //
  // `file_count`/`bytes_total` eskiden yalnız `sealPackageFiles`ta yazılıyordu
  // ve onu yalnız ilk yükleme çağırıyordu. "Dosya Ekle" satır eklediğinde
  // `file_count` donuyor, `stored_count` artıyordu: ekran "170/169 dosya
  // depoda" gibi kendi kendiyle çelişen bir sayı basıyor, daha kötüsü gerçekten
  // ulaşmamış üç dosyanın yerine üç yeni dosya eklenince `missing` sıfıra
  // düşüp "Eksikleri Yükle" düğmesi ekrandan siliniyordu. Sayaçların hepsi
  // AYNI satır kümesinden okunursa bu sınıfın tamamı kapanır.
  await supabase
    .from("drawing_packages")
    .update({
      file_count: dosyalar.length,
      bytes_total: bytesTotal,
      stored_count: storedCount,
      stored_bytes: storedBytes,
      skipped_count: skippedCount,
      skipped_bytes: skippedBytes,
      verified_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", packageId);

  await olayYaz(supabase, packageId, "", "dogrulandi", userId, {
    stored_count: storedCount,
    expected: expectedCount,
    skipped: skippedCount,
    stored_bytes: storedBytes,
    duzeltilen: dogru.length + yanlis.length,
  });

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  return {
    storedCount,
    expectedCount,
    skippedCount,
    storedBytes,
    missing: Math.max(0, expectedCount - storedCount),
  };
}

/**
 * Depoya ulaşmamış dosyaların yolları ve hedefleri — SÜRDÜRME KİPİ.
 *
 * "Eksikleri Yükle" bu listeyle çalışır: kullanıcı aynı klasörü seçer, sihirbaz
 * YENİ BİR PAKET AÇMAZ ve yalnız buradaki yolları gönderir.
 */
export async function loadMissingUploads(input: { packageId: string }): Promise<
  DrawingActionResult & {
    folderName?: string;
    targets?: { relPath: string; fileId: string; storagePath: string }[];
  }
> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  const { data: paket } = await supabase
    .from("drawing_packages")
    .select("folder_name")
    .eq("id", packageId)
    .maybeSingle();
  if (!paket) return { error: "Paket bulunamadı." };

  const dosyalar = await tumSayfalar(
    supabase,
    "drawing_files",
    packageId,
    "id, rel_path, storage_path, stored, upload_skipped"
  );

  const targets = dosyalar
    .filter((d) => d.stored !== true && d.upload_skipped !== true)
    .map((d) => ({
      relPath: d.rel_path as string,
      fileId: d.id as string,
      storagePath: (d.storage_path as string) ?? "",
    }));

  return { folderName: paket.folder_name as string, targets };
}

/* ═══════════════════════════════════════════════════ eşleştirme ═══ */

/**
 * Eşleştirme — YALNIZ VERİTABANI, depoya hiç dokunmaz.
 *
 * Dosya kayıtları ve ham BOM satırları zaten yazılı olduğu için kural
 * değiştiğinde 200 MB'lık paketi yeniden indirmeye gerek yoktur; bu eylem
 * saniyenin altında biter. Onaylar ve öğrenilen bağlar METİN ANAHTARLI ayrı
 * tablolarda olduğu için silme-yazma döngüsünden sağ çıkar.
 */
export async function reconcilePackage(input: {
  packageId: string;
}): Promise<DrawingActionResult & { recognitionPct?: number; missing?: number }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = packageIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId } = parsed.data;

  const { data: paket } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, item_no, job_item_id, group_map")
    .eq("id", packageId)
    .maybeSingle();
  if (!paket) return { error: "Paket bulunamadı." };

  const dosyalar = await tumSayfalar(supabase, "drawing_files", packageId, "*");
  // Excel'in YOLU `drawing_files` üzerinden gelir: "İPTAL" bir klasör değil bir
  // DURUM olduğu için ham satırın hangi yoldan geldiğini bilmek şart.
  const bomSatirlari = await tumSayfalar(
    supabase,
    "drawing_bom_rows",
    packageId,
    "*, drawing_files (rel_path)"
  );

  const files: ParsedFile[] = dosyalar.map((d) =>
    parseFile({
      relPath: d.rel_path as string,
      size: Number(d.size_bytes ?? 0),
      checksum: (d.checksum as string) ?? "",
    })
  );

  // DEPOYA ULAŞMAMIŞ DOSYALAR — bu fazın çekirdeğe taşıdığı tek yeni bilgi.
  // Atlananlar (yedek + bayt bayt kopya) DIŞARIDA: onları "eksik" saymak
  // yanlış alarmın ta kendisi olurdu.
  const missingStorage = dosyalar
    .filter((d) => d.stored !== true && d.upload_skipped !== true)
    .map((d) => d.rel_path as string);

  // İPTAL altındaki Excel'ler ESKİ sürümdür; defter CANLI olandan kurulur.
  const bomYolu = (r: Record<string, unknown>): string =>
    ((r.drawing_files as { rel_path?: string } | null)?.rel_path ?? "") as string;

  const bom: BomRow[] = bomSatirlari
    .filter((r) => !bomYolu(r).split("/").some((s) => s === "İPTAL"))
    .map((r) => ({
      fileRelPath: bomYolu(r),
      sheetName: (r.sheet_name as string) ?? "",
      sourceKind: (r.source_kind as BomRow["sourceKind"]) ?? "bilinmiyor",
      rowNo: Number(r.row_no ?? 0),
      itemPath: (r.item_path as string) ?? "",
      partNumber: (r.part_number as string) ?? "",
      bomStructure: (r.bom_structure as string) ?? "",
      description: (r.description as string) ?? "",
      title: (r.title as string) ?? "",
      materialRaw: (r.material_raw as string) ?? "",
      itemQtyRaw: (r.item_qty_raw as string) ?? "",
      qtyRaw: (r.qty_raw as string) ?? "",
      category: (r.category as string) ?? "",
      massRaw: (r.mass_raw as string) ?? "",
      revRaw: (r.rev_raw as string) ?? "",
      extra: (r.extra as Record<string, string>) ?? {},
    }));

  // Sistemdeki güncel kalem numarası: kaymışsa `bilgi` bulgusu basılır.
  //
  // ÜRÜN ADI DA BURADAN OKUNUR — `xxxx-xx-0000` grubunun adı onu taşır
  // (`genelKompleAdi`, kullanıcı kararı 13.08.2026). ZENGİN SORGU + DAR YEDEK
  // kalıbı (md. 21): `product_name` okunamıyorsa kalem numarası yine alınır ve
  // genel komple sade adıyla yazılır — bir sütun yüzünden eşleştirmenin
  // tamamını kaybetmek, o sütunun eksikliğinden çok daha pahalıdır.
  let systemItemNo = "";
  let urunAdi = "";
  if (paket.job_item_id) {
    const zengin = await supabase
      .from("job_items")
      .select("item_no, product_name")
      .eq("id", paket.job_item_id)
      .maybeSingle();
    if (zengin.error) {
      const dar = await supabase
        .from("job_items")
        .select("item_no")
        .eq("id", paket.job_item_id)
        .maybeSingle();
      systemItemNo = (dar.data?.item_no as string) ?? "";
    } else {
      systemItemNo = (zengin.data?.item_no as string) ?? "";
      urunAdi = (zengin.data?.product_name as string) ?? "";
    }
  }

  const folderName = paket.folder_name as string;
  let tanima = parseFolderName(folderName);
  if (!tanima.value) {
    tanima = folderNameFromContents(
      folderName,
      files.map((f) => f.fileName)
    );
  }

  // OKUNMUŞ İÇERİK — varsa. `?asama=pdf|dxf` hiç çalıştırılmadıysa harita boş
  // kalır ve defter Faz 1 davranışına döner; hiçbir bulgu değişmez.
  const content: Record<string, FileContent> = {};
  for (const d of dosyalar) {
    const meta = d.meta as { titleBlock?: unknown; sheetBom?: unknown; dxf?: unknown } | null;
    if (!meta || (!meta.titleBlock && !meta.dxf)) continue;
    content[d.rel_path as string] = meta as FileContent;
  }

  const snap: PackageSnapshot = {
    folderName,
    folder: tanima.value,
    files,
    bom,
    content,
    groupMap: (paket.group_map as Record<string, string>) ?? {},
    systemItemNo,
    missingStorage,
  };
  const sonuc = reconcile(snap);

  // Yol → dosya kimliği (parçaya dosya bağlamak için).
  const yolKimlik = new Map<string, string>();
  for (const d of dosyalar) yolKimlik.set(d.rel_path as string, d.id as string);

  // Dosya kararları (kopya / süperse) satırlara yazılır.
  //
  // YALNIZ DEĞİŞENLER yazılır. Kararların ezici çoğunluğu dosyanın adından
  // zaten çıkarılmış olanı tekrarlar; hepsini tek tek UPDATE etmek 454 ardışık
  // gidiş-geliş demekti. Değişen satır sayısı gerçek paketlerde yirmiyi
  // geçmiyor (kopyalar ve süperse edilenler).
  const mevcutDurum = new Map(
    dosyalar.map((d) => [
      d.rel_path as string,
      {
        lifecycle: d.lifecycle as string,
        superseded: (d.superseded_file_id as string | null) ?? null,
        duplicate: (d.duplicate_of_id as string | null) ?? null,
      },
    ])
  );
  for (const k of sonuc.fileDecisions) {
    const id = yolKimlik.get(k.relPath);
    if (!id) continue;
    const superseded = k.supersedesRelPath ? yolKimlik.get(k.supersedesRelPath) ?? null : null;
    const duplicate = k.duplicateOfRelPath ? yolKimlik.get(k.duplicateOfRelPath) ?? null : null;
    const mevcut = mevcutDurum.get(k.relPath);
    if (
      mevcut &&
      mevcut.lifecycle === k.lifecycle &&
      mevcut.superseded === superseded &&
      mevcut.duplicate === duplicate
    ) {
      continue;
    }
    await supabase
      .from("drawing_files")
      .update({
        lifecycle: k.lifecycle,
        superseded_file_id: superseded,
        duplicate_of_id: duplicate,
      })
      .eq("id", id);
  }

  // Defter ve bulgular baştan kurulur. `drawing_finding_acks` ve
  // `drawing_aliases` metin anahtarlı ayrı tablolarda olduğu için etkilenmez.
  await supabase.from("drawing_parts").delete().eq("package_id", packageId);
  await supabase.from("drawing_findings").delete().eq("package_id", packageId);

  const partRows = sonuc.parts.map((p) => ({
    package_id: packageId,
    part_code: p.partCode,
    bom_seq: p.bomSeq,
    parent_code: p.parentCode,
    item_path: p.itemPath,
    level: p.level,
    kind: p.kind,
    name: p.name,
    description: p.description,
    assembly_title: p.assemblyTitle,
    material: p.material,
    material_raw: p.materialRaw,
    category: p.category,
    qty: p.qty,
    cut_length_mm: p.cutLengthMm,
    thickness_mm: p.thicknessMm,
    weight_kg: p.weightKg,
    // DXF kutusu yalnız içerik okunduysa doludur; okunmadıysa null kalır ve
    // sütun boş görünür — "ölçülmedi" ile "sıfır" karışmasın.
    extents_x_mm: p.extentsXMm,
    extents_y_mm: p.extentsYMm,
    has_model: p.hasModel,
    has_sheet: p.hasSheet,
    has_cut: p.hasCut,
    has_3d: p.has3d,
    sheet_file_id: p.sheetRelPath ? yolKimlik.get(p.sheetRelPath) ?? null : null,
    cut_file_id: p.cutRelPath ? yolKimlik.get(p.cutRelPath) ?? null : null,
    sort: p.sort,
  }));
  for (let i = 0; i < partRows.length; i += YIGIN) {
    const { error } = await supabase.from("drawing_parts").insert(partRows.slice(i, i + YIGIN));
    if (error) return { error: `Parça defteri yazılamadı: ${error.message}` };
  }

  // ANA GRUP ADI DEFTERİ — kod → grup adı (0057-00-0700 → 1 TON KANCA BLOĞU).
  //
  // Ad UYDURULMAZ, defterden ÇIKARILIR: ürün ağacında grubun kendi satırı
  // varsa tanımı ad olur, yoksa alt parçaların montaj başlığı OYBİRLİĞİYLE
  // aynıysa o kullanılır (`grupAdlariCikar`). Çelişen başlıktan ad üretilmez.
  //
  // ELLE DÜZELTİLMİŞ AD EZİLMEZ (`manual = true`): insanın verdiği karar bir
  // sonraki eşleştirmede tahmine yenilmemelidir — kategori düzeltme defteriyle
  // aynı felsefe. Bu yüzden `upsert` değil, önce mevcut manuel kayıtlar okunur.
  //
  // BAŞARISIZLIK SESSİZ GEÇİLİR: defter bir KOLAYLIKTIR, eşleştirmenin kendisi
  // değil. Grup adı yazılamadı diye 450 dosyalık bir içe aktarımı düşürmek,
  // md. 18/1'i ("hiçbir kural bir yüklemeyi engellemez") çiğnemek olurdu.
  try {
    const adaylar = grupAdlariCikar(
      sonuc.parts.map((p) => ({
        partCode: p.partCode,
        description: p.description,
        assemblyTitle: p.assemblyTitle,
        name: p.name,
      })),
      // Ürün adı yoksa klasörün kendi açıklamasına düşülür ("MTC PASLANMAZ"):
      // paket bir iş kalemine bağlanmamış olabilir ve o zaman bile genel
      // komplenin hangi ürüne ait olduğu klasör adında yazıyor.
      { urunAdi: urunAdi || tanima.value?.description || "" }
    );
    if (adaylar.length > 0) {
      const { data: mevcut } = await supabase
        .from("drawing_group_names")
        .select("group_code, manual")
        .in("group_code", adaylar.map((a) => a.groupCode));
      const elle = new Set(
        ((mevcut ?? []) as { group_code: string; manual: boolean }[])
          .filter((r) => r.manual)
          .map((r) => r.group_code)
      );
      const yazilacak = adaylar
        .filter((a) => a.name && !elle.has(a.groupCode))
        .map((a) => ({ group_code: a.groupCode, name: a.name, manual: false }));
      if (yazilacak.length > 0) {
        await supabase
          .from("drawing_group_names")
          .upsert(yazilacak, { onConflict: "group_code" });
      }
    }
  } catch {
    // yut — bkz. yukarıdaki gerekçe
  }

  const findingRows = sonuc.findings.map((f) => ({
    package_id: packageId,
    code: f.code,
    kind: f.kind,
    subject: f.subject,
    title: f.title,
    detail: f.detail ?? "",
    data: f.data ?? {},
    hint_id: f.hintId ?? "",
  }));
  for (let i = 0; i < findingRows.length; i += YIGIN) {
    const { error } = await supabase.from("drawing_findings").insert(findingRows.slice(i, i + YIGIN));
    if (error) return { error: `Bulgular yazılamadı: ${error.message}` };
  }

  const sayac: Record<string, number> = { eksik: 0, celiski: 0, bilgi: 0 };
  for (const f of sonuc.findings) sayac[f.kind] = (sayac[f.kind] ?? 0) + 1;

  await supabase
    .from("drawing_packages")
    .update({
      // YARIM KALMIŞ REVİZYON ESKİYİ DÜŞÜRMEZ: süperse edilmiş bir paket
      // yeniden eşleştirilirse durumu `aktif`e DÖNMEMELİDİR, yoksa aynı
      // (kalem, grup) için iki aktif paket görünür.
      status: "aktif",
      part_count: sonuc.parts.length,
      unrecognized_count: sonuc.recognition.unrecognized.length,
      finding_counts: sayac,
      recognition_pct: sonuc.recognition.pct,
      reconciled_at: new Date().toISOString(),
      reconciler_version: RECONCILER_VERSION,
      updated_by: userId,
    })
    .eq("id", packageId)
    .neq("status", "superse");

  await olayYaz(supabase, packageId, folderName, "eslestirildi", userId, {
    parca: sonuc.parts.length,
    tanima: sonuc.recognition.pct,
    bulgu: sayac,
    depoda_yok: missingStorage.length,
  });

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  satinAlmayiTazele();
  return { recognitionPct: sonuc.recognition.pct, missing: missingStorage.length };
}

/** Sayfa sayfa okur; `max_rows` sessizce satır kırpmasın. */
async function tumSayfalar(
  supabase: SupabaseClient,
  table: string,
  packageId: string,
  select: string
): Promise<Record<string, unknown>[]> {
  const sonuc: Record<string, unknown>[] = [];
  const SAYFA = 900;
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("package_id", packageId)
      .range(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    const dilim = (data ?? []) as unknown as Record<string, unknown>[];
    sonuc.push(...dilim);
    if (dilim.length < SAYFA) break;
  }
  return sonuc;
}

function kumele<T>(liste: readonly T[], boy: number): T[][] {
  const cikti: T[][] = [];
  for (let i = 0; i < liste.length; i += boy) cikti.push(liste.slice(i, i + boy));
  return cikti;
}

/**
 * Paket olayı — denetim kaydı.
 *
 * `audit_log` DEĞİL: o tablo hesap raporuna (`project_id`/`revision_id`)
 * bağlıdır. Emsalin diğer yanı aynen korunur: `await` edilir ama DÖNÜŞÜ
 * KONTROL EDİLMEZ — denetim kaydı asıl işi bozmaz.
 */
async function olayYaz(
  supabase: SupabaseClient,
  packageId: string | null,
  folderName: string,
  event: string,
  actor: string,
  detail: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("drawing_package_events")
    .insert({ package_id: packageId, folder_name: folderName, event, actor, detail });
}

/* ═════════════════════════════════════════════ eşleştirme yardımcıları ═══ */

/**
 * Paketi başka bir iş kalemine bağlar.
 *
 * `rewriteItemNo` kapalıyken YALNIZ BAĞLANTI değişir, paketin `item_no` metni
 * olduğu gibi kalır — ressamın klasörü hâlâ o numarayı diyor ve metin ASILDIR.
 * Açıkken metin de güncellenir; kodların içi ASLA değişmez.
 */
export async function remapPackageItemNo(input: RemapItemInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = remapItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, jobItemId, rewriteItemNo } = parsed.data;

  const guncelleme: Record<string, unknown> = { updated_by: userId };
  if (!jobItemId) {
    guncelleme.job_item_id = null;
    guncelleme.job_id = null;
  } else {
    const { data: kalem } = await supabase
      .from("job_items")
      .select("id, job_id, item_no")
      .eq("id", jobItemId)
      .maybeSingle();
    if (!kalem) return { error: "İş kalemi bulunamadı." };
    guncelleme.job_item_id = kalem.id;
    guncelleme.job_id = kalem.job_id;
    if (rewriteItemNo) guncelleme.item_no = kalem.item_no;
  }

  const { error } = await supabase.from("drawing_packages").update(guncelleme).eq("id", packageId);
  if (error) return { error: `Eşleştirme yazılamadı: ${error.message}` };

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  satinAlmayiTazele();
  return {};
}

/** "Bunu gördüm." Bulgular yeniden üretilse de onay kalır (metin anahtarlı). */
export async function ackFinding(input: AckFindingInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = ackFindingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, code, subject, note } = parsed.data;

  const { error } = await supabase.from("drawing_finding_acks").upsert(
    { package_id: packageId, code, subject, note, acked_by: userId },
    { onConflict: "package_id,code,subject" }
  );
  if (error) return { error: `Onay yazılamadı: ${error.message}` };

  revalidatePath(`/drawings/${packageId}/report`);
  return {};
}

/**
 * Tanınmayan bir dosyayı elle bir koda bağlar VE bunu hatırlar.
 *
 * Bağ `drawing_aliases`a yazılır: aynı desen başka bir pakette geçtiğinde
 * kendiliğinden çözülür. Kuralı sıkılaştırmadan isabeti artırmanın yolu budur.
 */
export async function bindAlias(input: BindAliasInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = bindAliasSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, scope, pattern, resolvesTo } = parsed.data;

  const { error: aliasHatasi } = await supabase.from("drawing_aliases").upsert(
    { scope, pattern, resolves_to: resolvesTo, created_by: userId },
    { onConflict: "scope,pattern" }
  );
  if (aliasHatasi) return { error: `Bağ kaydedilemedi: ${aliasHatasi.message}` };

  // Bu paketteki dosyaya da hemen uygulanır; kullanıcı sonucu beklemez.
  if (scope === "dosya") {
    await supabase
      .from("drawing_files")
      .update({ part_code: resolvesTo, recognized_by: "dosya.elle" })
      .eq("package_id", packageId)
      .eq("rel_path", pattern);
  }

  return reconcilePackage({ packageId });
}

/* ══════════════════════════════════════════════════════════ silme ═══ */

/**
 * Paketi ve bütün depo nesnelerini siler.
 *
 * ————————————————————————————————————————————— SIRA VERİ KAYBETTİRİR
 *
 * Eski sıra şuydu: önce depo nesneleri silinir, SONRA satır. Depo RLS'i
 * `can_edit_drawings()` olduğu için ressam BAYTLARI SİLİYORDU; tablo RLS'i
 * `is_admin()` olduğu için satır silinmiyordu. Sonuç: baytlar yok, kayıtlar
 * yerinde. Paket ekranda sapasağlam görünüyor (sayaçlar beyan olduğu için),
 * defter ve rapor çalışıyor, ama her dosya boş. Sessiz, geri dönüşsüz kayıp.
 *
 * YENİ SIRA: önce satır (yetkilendirilip BAŞARILI olana kadar depoya
 * dokunulmaz), sonra nesneler. Satır gidip depo temizliği yarıda kalırsa yetim
 * dosya kalır — bu GERİ ALINABİLİR bir hatadır. Tersi değildir. Yıkıcı işlemde
 * sıra her zaman "önce ucuz olanı kaybet" olmalıdır.
 */
export async function deletePackage(input: DeletePackageInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = deletePackageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, confirmName } = parsed.data;

  const { data: paket } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, item_no, file_count, bytes_total, part_count")
    .eq("id", packageId)
    .maybeSingle();
  if (!paket) return { error: "Paket bulunamadı." };

  // Onay SUNUCUDA da sınanır: arayüzdeki düğme kilidi bir görgü kuralıdır,
  // asıl kapı burasıdır (RLS'in arayüz gizlemesine üstün olmasıyla aynı ilke).
  // Beklenen dizgi PAKET ADI DEĞİL tek bir sözcüktür — gerekçesi
  // `SILME_ONAY_SOZU`nun yanındadır.
  if (trKatla(confirmName).trim() !== trKatla(SILME_ONAY_SOZU)) {
    return { error: `Onaylamak için kutuya "${SILME_ONAY_SOZU}" yazmanız gerekiyor.` };
  }

  const { error, count } = await supabase
    .from("drawing_packages")
    .delete({ count: "exact" })
    .eq("id", packageId);

  if (error) {
    // Tetikleyicinin Türkçe mesajı olduğu gibi geçirilir: "üretime girmiş paket
    // silinemez" cümlesini burada ikinci kez yazmak, iki metnin bir gün
    // ayrışması demekti.
    return { error: error.message };
  }
  // RLS sessiz bir no-op üretebilir; sayıyı okumak onu gerçek hataya çevirir.
  if (!count) {
    return { error: "Paketi silme yetkiniz yok (Yönetici · Mühendis · Teknik Ressam)." };
  }

  // ANCAK ŞİMDİ depo temizlenir. SAYFALANIR: tek sayfalık `list(…, {limit:1000})`
  // 2000 nesneli bir pakette 1000'ini bucket'ta yetim bırakırdı.
  let silinenNesne = 0;
  for (let tur = 0; tur < 50; tur++) {
    const { data: liste, error: listeHatasi } = await supabase.storage
      .from(BUCKET)
      .list(packageId, { limit: DEPO_SAYFA });
    if (listeHatasi || !liste?.length) break;
    const { error: silmeHatasi } = await supabase.storage
      .from(BUCKET)
      .remove(liste.map((o) => `${packageId}/${o.name}`));
    if (silmeHatasi) break;
    silinenNesne += liste.length;
    if (liste.length < DEPO_SAYFA) break;
  }

  await olayYaz(supabase, null, (paket.folder_name as string) ?? "", "silindi", userId, {
    package_id: packageId,
    item_no: paket.item_no,
    dosya: paket.file_count,
    parca: paket.part_count,
    bayt: paket.bytes_total,
    silinen_nesne: silinenNesne,
  });

  revalidatePath("/drawings");
  satinAlmayiTazele();
  return {};
}

/* ═════════════════════════════════════════════════════ revizyon ═══ */

/**
 * Aynı (kalem, grup) için AÇIK bir paket var mı?
 *
 * Sihirbaz yüklemeye başlamadan ÖNCE sorar ve üç seçenek sunar: yeni revizyon ·
 * ikisi ayrı dursun · vazgeç. Grup boşken HİÇ SORULMAZ (`schema.ts`te gerekçesi
 * yazılı): tanınmamış iki klasör birbirini süperse edecek gibi görünürdü.
 */
export async function findActivePackage(input: ActivePackageQueryInput): Promise<{
  package?: { id: string; folderName: string; revNo: number; fileCount: number; partCount: number };
}> {
  const parsed = activePackageQuerySchema.safeParse(input);
  if (!parsed.success) return {};
  const { itemNo, groupCode } = parsed.data;
  if (!itemNo.trim()) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, rev_no, file_count, part_count")
    .eq("item_no", itemNo.trim())
    .eq("group_code", groupCode.trim())
    .in("status", ["yuklendi", "aktif"])
    .order("rev_no", { ascending: false })
    .limit(1);

  const p = data?.[0];
  if (!p) return {};
  return {
    package: {
      id: p.id as string,
      folderName: p.folder_name as string,
      revNo: Number(p.rev_no ?? 1),
      fileCount: Number(p.file_count ?? 0),
      partCount: Number(p.part_count ?? 0),
    },
  };
}

/**
 * Eski paketi süperse eder ve ÜRETİM KAYDINI yeni revizyona devreder.
 *
 * ————————————————————————————————————————————— SIRA (yanlış sıra kaybettirir)
 *
 * Bu eylem yüklemenin EN SONUNDA çağrılır: dosyalar yüklenip DOĞRULANDIKTAN ve
 * defter kurulduktan sonra. Önce çağrılsaydı yarım kalan bir revizyon eski
 * paketi düşürür ve atölye bakacak resim bulamazdı.
 *
 * SÜPERSE SİLMEK DEĞİLDİR: eski paket ve bütün dosyaları durur, indirilebilir
 * kalır; yalnız listede ve sayaçlarda geri plana düşer. Teslim edilmiş bir
 * resim geri alınamaz.
 */
export async function supersedePackage(input: SupersedeInput): Promise<
  DrawingActionResult & { summary?: string; review?: number; orphan?: number }
> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const parsed = supersedeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, supersedesId } = parsed.data;
  if (packageId === supersedesId) return { error: "Bir paket kendini süperse edemez." };

  const { data: paketler } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, item_no, rev_no")
    .in("id", [packageId, supersedesId]);
  const yeni = paketler?.find((p) => p.id === packageId);
  const eski = paketler?.find((p) => p.id === supersedesId);
  if (!yeni || !eski) return { error: "Paketlerden biri bulunamadı." };

  const [eskiTaraf, yeniTaraf] = await Promise.all([
    tarafOku(supabase, supersedesId),
    tarafOku(supabase, packageId),
  ]);
  const fark = packageDiff(eskiTaraf.side, yeniTaraf.side);

  // ESKİ PAKETİN ÜRETİM KAYITLARI. İki yoldan aranır çünkü bağ bir KOLAYLIKTIR
  // (`on delete set null`), asıl anahtar (item_no, part_code) METNİDİR.
  //
  // KÜME İLERLEME ANAHTARLARIYLA kurulur, defter anahtarlarıyla değil: kodsuz
  // satırların `part_code`u boştur ve `register_key` konumsaldır (`SATIR:7`),
  // oysa üretim kaydı `SATINALMA:<katlanmış tanım>` yazar. Konumsal anahtarla
  // kurulsaydı bu süzgeç HİÇBİR satın alma kaydını geçirmezdi — yani
  // kullanıcının ilk saydığı ihtiyaç ("parça satın alındı") güvenlik ağının
  // tamamen dışında kalırdı.
  const eskiKodlar = new Set(
    eskiTaraf.side.parts.map((p) =>
      p.partCode.trim() ? p.partCode.trim() : `${PURCHASE_PREFIX}${trKatla(p.description)}`
    )
  );
  const kayitlar = new Map<string, ProgressRef>();

  const { data: bagli } = await supabase
    .from("drawing_part_progress")
    .select("id, item_no, part_code, stage")
    .eq("package_id", supersedesId);
  for (const r of bagli ?? []) {
    kayitlar.set(r.id as string, {
      id: r.id as string,
      itemNo: r.item_no as string,
      partCode: r.part_code as string,
      stage: r.stage as string,
    });
  }

  const eskiKalem = ((eski.item_no as string) ?? "").trim();
  if (eskiKalem) {
    const { data: metinle } = await supabase
      .from("drawing_part_progress")
      .select("id, item_no, part_code, stage")
      .eq("item_no", eskiKalem);
    for (const r of metinle ?? []) {
      // Kardeş paketlerin kayıtlarına DOKUNULMAZ: aynı kalem numarasını
      // paylaşan başka bir grubun (0057-00 + 2000) parçaları bu revizyonun
      // devrine girmemeli.
      if (!eskiKodlar.has(r.part_code as string)) continue;
      kayitlar.set(r.id as string, {
        id: r.id as string,
        itemNo: r.item_no as string,
        partCode: r.part_code as string,
        stage: r.stage as string,
      });
    }
  }

  const kararlar = carryDecisions([...kayitlar.values()], fark, yeniTaraf.side.parts);
  const ozet = carrySummary(kararlar);

  // Yeni paketteki parça kimlikleri — devir bağı gerçek bir satırı göstermeli.
  const { data: yeniParcalar } = await supabase
    .from("drawing_parts")
    .select("id, part_code")
    .eq("package_id", packageId);
  const parcaKimlik = new Map<string, string>();
  for (const p of yeniParcalar ?? []) {
    const kod = (p.part_code as string) ?? "";
    if (kod && !parcaKimlik.has(kod)) parcaKimlik.set(kod, p.id as string);
  }

  for (const k of kararlar) {
    if (k.outcome === "karsiliksiz") continue;
    // DEVİR İŞARETİ KOYAR, KALDIRMAZ.
    //
    // `ayni` dalında `review_required: false` yazmak, insanın HENÜZ
    // CEVAPLAMADIĞI bir soruyu sessizce kapatırdı: R01→R02'de "Adet 4 → 2"
    // diye işaretlenmiş bir parça R02→R03'te hiç değişmezse `ayni` olur ve
    // açık soru kaybolurdu. İşaret bir SORUDUR ve onu yalnız insan
    // (`setReviewMark`) kapatabilir.
    const guncelleme: Record<string, unknown> = {
      package_id: packageId,
      part_id: parcaKimlik.get(k.progress.partCode) ?? null,
      carried_from_package_id: supersedesId,
    };
    if (k.outcome === "gozdenGecir") {
      guncelleme.review_required = true;
      guncelleme.review_reason = k.reason;
    }
    const { error } = await supabase
      .from("drawing_part_progress")
      .update(guncelleme)
      .eq("id", k.progress.id);
    if (error) return { error: `Üretim kaydı devredilemedi: ${error.message}` };
  }

  const { error: eskiHata } = await supabase
    .from("drawing_packages")
    .update({ status: "superse", updated_by: userId })
    .eq("id", supersedesId);
  if (eskiHata) return { error: `Eski paket düşürülemedi: ${eskiHata.message}` };

  await supabase
    .from("drawing_packages")
    .update({ supersedes_id: supersedesId, rev_no: Number(eski.rev_no ?? 1) + 1, updated_by: userId })
    .eq("id", packageId);

  const revNo = Number(eski.rev_no ?? 1) + 1;
  const metin = carrySummaryText(ozet, revNo);

  await olayYaz(supabase, packageId, (yeni.folder_name as string) ?? "", "revizyon", userId, {
    supersedes_id: supersedesId,
    rev_no: revNo,
    fark: fark.ozet,
  });
  await olayYaz(supabase, supersedesId, (eski.folder_name as string) ?? "", "superse", userId, {
    yerine: packageId,
    rev_no: revNo,
  });
  await olayYaz(supabase, packageId, (yeni.folder_name as string) ?? "", "ilerleme_devri", userId, {
    ...ozet,
    ozet: metin,
  });

  revalidatePath("/drawings");
  revalidatePath(`/drawings/${packageId}`);
  revalidatePath(`/drawings/${supersedesId}`);
  satinAlmayiTazele();
  return { summary: metin, review: ozet.gozdenGecir, orphan: ozet.karsiliksiz };
}

/** Fark için bir paketin dosya ve parça tarafı. */
async function tarafOku(
  supabase: SupabaseClient,
  packageId: string
): Promise<{ side: { files: DiffFile[]; parts: DiffPart[] } }> {
  const dosyalar = await tumSayfalar(
    supabase,
    "drawing_files",
    packageId,
    "rel_path, checksum, size_bytes, role, lifecycle"
  );
  const parcalar = await tumSayfalar(
    supabase,
    "drawing_parts",
    packageId,
    "register_key, part_code, description, qty, material, weight_kg, thickness_mm, cut_length_mm, category"
  );
  return {
    side: {
      files: dosyalar.map((d) => ({
        relPath: d.rel_path as string,
        checksum: (d.checksum as string) ?? "",
        size: Number(d.size_bytes ?? 0),
        role: d.role as DiffFile["role"],
        lifecycle: d.lifecycle as DiffFile["lifecycle"],
      })),
      parts: parcalar.map((p) => ({
        registerKey: (p.register_key as string) ?? "",
        partCode: (p.part_code as string) ?? "",
        description: (p.description as string) ?? "",
        qty: p.qty as DiffPart["qty"],
        material: (p.material as string) ?? "",
        weightKg: p.weight_kg as DiffPart["weightKg"],
        thicknessMm: p.thickness_mm as DiffPart["thicknessMm"],
        cutLengthMm: p.cut_length_mm as DiffPart["cutLengthMm"],
        category: (p.category as string) ?? "",
      })),
    },
  };
}

/**
 * "Bu parçayı gözden geçirdim" — işareti kaldırır ya da geri koyar.
 *
 * İşaretin kendisi bir SORUDUR, bir hata değil: "bu parça R02'de değişti, kayıt
 * hâlâ geçerli mi?" Cevabı ancak insan verebilir.
 */
export async function setReviewMark(input: ReviewMarkInput): Promise<DrawingActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = reviewMarkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { packageId, progressId, reviewRequired } = parsed.data;

  const { error } = await supabase
    .from("drawing_part_progress")
    .update({ review_required: reviewRequired })
    .eq("id", progressId);
  if (error) return { error: `İşaret güncellenemedi: ${error.message}` };

  revalidatePath(`/drawings/${packageId}/progress`);
  return {};
}
