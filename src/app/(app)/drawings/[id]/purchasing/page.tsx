// Satın Alma — satınalmacının ekranı; sunucu kabuğu.
//
// NEDEN AYRI BİR BÖLÜM: satınalmacının 149 sac parçasını görmesine gerek yok.
// Bu liste defterin YALNIZ satın alınan yüzüdür (satın alma yapısındaki
// satırlar + parça numarası olmayanlar) ve kaynağı türev katmanın kendisidir —
// yani ekranda gördüğünüz satır ile indirdiğiniz Excel'in satırı AYNI
// `satinAlmaListesi` çağrısından çıkar.
//
// "SATIN ALINDI" YALNIZ BURADA İŞARETLENİR. Aşama defterinde o aşama duruyor
// ama Üretim tahtasında çipi YOKTUR (`productionStages`): sipariş kararı
// tezgâhın değil satınalmanın kaydıdır. Ayrım `lib/drawings/progress.ts`te tek
// yerde tanımlıdır, iki ekran onu okur.
//
// OKUMA HERKESE AÇIKTIR, yazma `canEditDrawings`tedir — Üretim tahtasıyla aynı
// kural. Menüden gizlemek yalnız görgü kuralıdır, asıl engel RLS'tir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { satinAlmaKategoriSirasi, satinAlmaListesi } from "@/lib/drawings/derive";
import {
  FALLBACK_STAGES,
  progressItemNo,
  purchaseStages,
  registerItemNo,
  type StageDef,
} from "@/lib/drawings/progress";
import { drawingCarpani } from "@/lib/purchasing/demand";
import { loadPackage, loadParts } from "../../data";
import { partToTurev } from "../export/shared";
import { PurchasingTable, type PurchaseMark } from "./purchasing-table";

interface StageRow {
  slug: string;
  name: string;
  sort: number;
  color_hue: number;
}

interface ProgressRow {
  id: string;
  part_code: string;
  stage: string;
  qty_done: number | null;
  done_at: string | null;
  due_at?: string | null;
  note: string | null;
  review_required: boolean | null;
  review_reason: string | null;
}

/**
 * İLERLEME SÜTUNLARI İKİ DENEMEDE OKUNUR.
 *
 * `due_at` 20260811 migration'ıyla geliyor; o uygulanmadan önce sütunu isteyen
 * bir `select` BÜTÜN sorguyu düşürür ve ekran satın alma kayıtlarını hiç
 * göremez. Bir alanın eksikliği yüzünden bütün listeyi kaybetmek, bu modülün
 * "hiçbir kural bir yüklemeyi engellemez" ilkesinin ekran tarafındaki
 * karşılığıdır: önce zengin sütun listesi denenir, olmazsa dar olanına düşülür.
 */
const ILERLEME_ALANLARI =
  "id, part_code, stage, qty_done, done_at, due_at, note, review_required, review_reason";
const ILERLEME_ALANLARI_DAR =
  "id, part_code, stage, qty_done, done_at, note, review_required, review_reason";

export default async function PackagePurchasingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const parcalar = await loadParts(supabase, id);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  // ————————————————————————————————— kategori defterleri
  //
  // İKİSİ DE OLMAYABİLİR (20260811 migration'ı ana oturumda uygulanacak).
  // Okunamıyorsa ekran sözlükle çalışır ve düzeltme araçları kapanır; bir
  // ekranın 500 vermesi kullanıcının modüle olan güvenini bir defada bitirir.
  const [{ data: duzeltmeSatirlari }, { data: kategoriSatirlari }] = await Promise.all([
    supabase.from("drawing_purchase_overrides").select("match_key, category"),
    supabase
      .from("drawing_purchase_categories")
      .select("name, sort")
      .eq("active", true)
      .order("sort")
      .order("name"),
  ]);

  const duzeltmeler = new Map(
    ((duzeltmeSatirlari ?? []) as { match_key: string; category: string }[]).map((r) => [
      r.match_key,
      r.category,
    ])
  );
  const ekKategoriler = ((kategoriSatirlari ?? []) as { name: string }[]).map((r) => r.name);
  // Defter okunamadıysa (migration yok) düzeltme araçları gösterilmez: var
  // olmayan bir tabloya yazmayı denemek kullanıcıya anlaşılmaz bir hata verirdi.
  const kategoriDefteriVar = duzeltmeSatirlari != null && kategoriSatirlari != null;

  const liste = satinAlmaListesi(parcalar.map(partToTurev), { duzeltmeler, ekKategoriler });

  // ————————————————————————————————— RESİM ÇARPANI (md. 6)
  //
  // Ressam BİR ürün için çizer; iş emrinde üç adet varsa üç katı satın alınır.
  // Çarpan iş kalemi defterinden gelir ve iki kalem resimlerini paylaşıyorsa
  // adetleri TOPLANIR (`drawingCarpani`).
  //
  // SÜTUNLAR OLMAYABİLİR: `qty` ve `shares_drawings_with` 20260812 ile geliyor.
  // Yoksa çarpan 1'dir ve ekran bunu "belirsiz" olarak yazar — sessizce doğru
  // varsaymaz.
  const kalemSorgusu = await supabase
    .from("job_items")
    .select("id, item_no, qty, shares_drawings_with");
  const carpanHazir = !kalemSorgusu.error;
  const kalemDefteri = carpanHazir
    ? ((kalemSorgusu.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        itemNo: String(r.item_no ?? ""),
        qty: r.qty == null ? null : Number(r.qty),
        sharesWith: (r.shares_drawings_with as string | null) ?? null,
      }))
    : [];
  const carpanBilgisi = drawingCarpani(paket.job_item_id, paket.item_no, kalemDefteri);

  if (liste.satirlar.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ SATIN ALMA KALEMİ YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Bu paketin defterinde satın alınacak bir kalem bulunamadı. Defter
          boşsa Excel eklenip “Yeniden Eşleştir” çalıştırıldığında liste kurulur;
          defter doluysa bütün satırların parça numarası var demektir.
        </p>
      </div>
    );
  }

  // ————————————————————————————————— aşama defteri (yoksa yedek sözlük)
  const { data: asamaSatirlari, error: asamaHatasi } = await supabase
    .from("drawing_stages")
    .select("slug, name, sort, color_hue")
    .eq("active", true)
    .order("sort");

  const defterYok = Boolean(asamaHatasi);
  const tumAsamalar: StageDef[] =
    !defterYok && asamaSatirlari && asamaSatirlari.length > 0
      ? (asamaSatirlari as StageRow[]).map((s) => ({
          slug: s.slug,
          name: s.name,
          sort: s.sort,
          colorHue: s.color_hue ?? 0,
        }))
      : FALLBACK_STAGES;
  const asamalar = purchaseStages(tumAsamalar);

  // ————————————————————————————————— ilerleme kayıtları
  //
  // Kalem numarası KODLARDAN türetilir (Üretim tahtasıyla aynı kural): paketin
  // `item_no` alanı yeniden yazılmış olabilir ve onunla sorgulamak
  // satınalmanın kendi kayıtlarını görünmez yapardı.
  const kalemNo = registerItemNo(
    parcalar.map((p) => ({ partCode: p.part_code ?? "" })),
    paket.item_no
  );
  const kalemler = [...new Set(liste.satirlar.map((s) => progressItemNo(s.key, kalemNo)))].filter(
    Boolean
  );

  let marks: PurchaseMark[] = [];
  if (kalemler.length > 0 && asamalar.length > 0) {
    const slugs = asamalar.map((s) => s.slug);
    const oku = (alanlar: string) =>
      supabase
        .from("drawing_part_progress")
        .select(alanlar)
        .in("item_no", kalemler)
        .in("stage", slugs);

    // `data` yeniden atanır, `error` atanmaz — ESLint bunu ayırmamızı ister.
    const ilk = await oku(ILERLEME_ALANLARI);
    let data = ilk.data;
    // `due_at` sütunu henüz yoksa dar listeye düşülür; teslim tarihi görünmez
    // ama işaretler görünür. Tersi (hiç satır göstermemek) çok daha kötüdür.
    if (ilk.error) ({ data } = await oku(ILERLEME_ALANLARI_DAR));

    // Aynı kalem numarasını paylaşan BAŞKA bir paketin satırları da gelir; bu
    // ekrana yalnız bu paketin listesinde karşılığı olanlar girer.
    const bilinen = new Set(liste.satirlar.map((s) => s.key));
    marks = ((data ?? []) as unknown as ProgressRow[])
      .filter((r) => bilinen.has(r.part_code))
      .map((r) => ({
        key: r.part_code,
        stage: r.stage,
        qtyDone: r.qty_done ?? 0,
        doneAt: r.done_at,
        dueAt: r.due_at ?? null,
        note: r.note ?? "",
        id: r.id,
        reviewRequired: r.review_required === true,
        reviewReason: r.review_reason ?? "",
      }));
  }

  return (
    <PurchasingTable
      packageId={id}
      liste={liste}
      stages={asamalar}
      marks={marks}
      kategoriler={satinAlmaKategoriSirasi(ekKategoriler)}
      canWrite={yazabilir}
      canEditCategories={yazabilir && kategoriDefteriVar}
      ledgerMissing={defterYok}
      carpan={carpanBilgisi.carpan}
      carpanBelirsiz={carpanBilgisi.belirsiz || !carpanHazir}
      carpanKalemleri={carpanBilgisi.katilanlar}
    />
  );
}
