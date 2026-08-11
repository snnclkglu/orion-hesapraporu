// Üretim durumu — atölye ekranının sunucu tarafı.
//
// OKUMA HERKESE AÇIKTIR (teknik resim atölyenin ortak gerçeğidir); yazma
// `canEditDrawings`tedir ve salt-okunur kullanıcı tahtayı görür, çipleri pasif
// durur. Menüden gizlemek yalnız görgü kuralıdır, asıl engel RLS'tir.
//
// MIGRATION HENÜZ UYGULANMAMIŞ OLABİLİR (ana oturum `npx supabase db push`
// yapacak). Bu sayfa bunu bir çökme sebebi saymaz: `drawing_stages` okunamazsa
// yedek sözlükle çalışır ve tahtanın üstünde sakin bir satır basar. Bir ekranın
// 500 vermesi, kullanıcının modüle olan güvenini bir defada bitirir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import {
  FALLBACK_STAGES,
  isPurchaseRow,
  orphanMarks,
  productionStages,
  progressItemNo,
  suggestStagesFromFolders,
  trackedParts,
  type ProgressMark,
  type StageDef,
  type SuggestionFile,
} from "@/lib/drawings/progress";
import { loadFiles, loadPackage, loadParts } from "../../data";
import { ProgressBoard } from "./progress-board";

interface StageRow {
  slug: string;
  name: string;
  sort: number;
  color_hue: number;
}

interface ProgressRow {
  id: string;
  item_no: string;
  part_code: string;
  stage: string;
  qty_done: number | null;
  done_at: string | null;
  note: string | null;
  review_required: boolean | null;
  review_reason: string | null;
}

const ILERLEME_ALANLARI =
  "id, item_no, part_code, stage, qty_done, done_at, note, review_required, review_reason";

export default async function PackageProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const [parcalar, dosyalar] = await Promise.all([
    loadParts(supabase, id),
    loadFiles(supabase, id),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

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

  // SATIN ALINDI BU TAHTADA YOKTUR. Sipariş kaydı tezgâhın değil satınalmanın
  // işidir ve kendi bölümünde yaşar (`/purchasing`). Ayrım çekirdekte tanımlı
  // (`productionStages`), burada yalnız uygulanır.
  const stages = productionStages(tumAsamalar);

  // ————————————————————————————————— defter → izlenen birimler
  const izlenen = trackedParts(
    parcalar.map((p) => ({
      partCode: p.part_code ?? "",
      description: p.description ?? "",
      name: p.name ?? "",
      assemblyTitle: p.assembly_title ?? "",
      qty: p.qty ?? null,
      kind: p.kind,
      category: p.category ?? "",
      material: p.material ?? "",
    })),
    paket.item_no
  );

  // ÜRETİM TAHTASI DEFTERİN İMALAT YÜZÜDÜR. Satın alınan kalemler — kodsuz
  // satırlar VE satın alma yapısındaki kodlu satırlar (motor, redüktör, halat)
  // — kendi bölümüne taşındı: atölyeye "bu motoru kesildi mi" diye sormanın
  // anlamı yok. İkili bölme `isPurchaseRow` ile TEK kuraldan çıkar, yani hiçbir
  // satır iki ekranda birden ya da hiçbirinde görünmez.
  const uretimParcalari = izlenen.coded.filter((p) => !isPurchaseRow(p));
  const uretimAnahtarlari = new Set(uretimParcalari.map((p) => p.key));

  if (izlenen.all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ DEFTER BOŞ ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Üretim durumu parça defterine bağlıdır ve bu pakette henüz okunabilen
          bir defter yok. Excel eklenip “Yeniden Eşleştir” çalıştırıldığında
          aşama çipleri burada belirir.
        </p>
      </div>
    );
  }

  // ————————————————————————————————— ilerleme kayıtları
  //
  // Kalem numaraları KODLARDAN türetilir; sorgu da o küme üzerinden yapılır.
  // Paketin `item_no` alanı yeniden yazılmış olabilir ve onunla sorgulamak
  // atölyenin kayıtlarını görünmez yapardı.
  const kalemler = [
    ...new Set(izlenen.all.map((p) => progressItemNo(p.key, izlenen.itemNo)).filter(Boolean)),
  ];

  let marks: ProgressMark[] = [];
  if (kalemler.length > 0) {
    const { data } = await supabase
      .from("drawing_part_progress")
      .select(ILERLEME_ALANLARI)
      .in("item_no", kalemler);
    marks = ((data ?? []) as ProgressRow[])
      // Aynı kalem numarasını paylaşan BAŞKA bir paketin satırları da gelir
      // (0043-00 altında birden çok grup olabilir). Bu tahtaya yalnız bu
      // paketin defterinde karşılığı olanlar girer; kalanı `orphanMarks`
      // gibi sessizce düşmez, zaten kendi paketinin tahtasında görünür.
      //
      // SATIN ALMA KALEMLERİNİN KAYITLARI DA BURAYA GELMEZ: `bilinen` yalnız
      // üretim parçalarıdır. Gelselerdi revizyon şeridi ("gözden geçirilecek")
      // bu tahtada satınalmanın kaydını sorar, düzeltme yeri ise başka bir
      // ekran olurdu — kullanıcı işaretin peşinden gidemezdi.
      .filter((r) => uretimAnahtarlari.has(r.part_code))
      .map((r) => ({
        key: r.part_code,
        stage: r.stage,
        qtyDone: r.qty_done ?? 0,
        doneAt: r.done_at,
        note: r.note ?? "",
        id: r.id,
        reviewRequired: r.review_required === true,
        reviewReason: r.review_reason ?? "",
      }));
  }

  // Bu paketin kalem numaralarına ait olup defterde karşılığı OLMAYAN kayıtlar.
  let oksuzler: ProgressMark[] = [];
  if (kalemler.length > 0) {
    const { data } = await supabase
      .from("drawing_part_progress")
      .select(ILERLEME_ALANLARI)
      .in("item_no", kalemler)
      .eq("package_id", id);
    oksuzler = orphanMarks(
      izlenen.all,
      ((data ?? []) as ProgressRow[]).map((r) => ({
        key: r.part_code,
        stage: r.stage,
        qtyDone: r.qty_done ?? 0,
      }))
    );
  }

  // ————————————————————————————————— klasör ipuçlarından öneri
  const oneriDosyalari: SuggestionFile[] = dosyalar
    .filter((f) => f.lifecycle !== "haric")
    .map((f) => ({
      folder: f.folder ?? "",
      partCode: f.part_code ?? "",
      fileName: f.file_name ?? "",
      qty: f.qty ?? null,
    }));

  const suggestions = suggestStagesFromFolders({
    files: oneriDosyalari,
    parts: uretimParcalari,
    marks,
    stages,
  });

  return (
    <ProgressBoard
      packageId={id}
      stages={stages}
      coded={uretimParcalari}
      marks={marks}
      suggestions={suggestions}
      orphans={oksuzler}
      canWrite={yazabilir}
      ledgerMissing={defterYok}
    />
  );
}
