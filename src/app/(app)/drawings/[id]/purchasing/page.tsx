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
import { satinAlmaListesi } from "@/lib/drawings/derive";
import {
  FALLBACK_STAGES,
  progressItemNo,
  purchaseStages,
  registerItemNo,
  type ProgressMark,
  type StageDef,
} from "@/lib/drawings/progress";
import { loadPackage, loadParts } from "../../data";
import { partToTurev } from "../export/shared";
import { PurchasingTable } from "./purchasing-table";

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
  note: string | null;
  review_required: boolean | null;
  review_reason: string | null;
}

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

  const liste = satinAlmaListesi(parcalar.map(partToTurev));

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

  let marks: ProgressMark[] = [];
  if (kalemler.length > 0 && asamalar.length > 0) {
    const { data } = await supabase
      .from("drawing_part_progress")
      .select("id, part_code, stage, qty_done, done_at, note, review_required, review_reason")
      .in("item_no", kalemler)
      .in(
        "stage",
        asamalar.map((s) => s.slug)
      );
    // Aynı kalem numarasını paylaşan BAŞKA bir paketin satırları da gelir; bu
    // ekrana yalnız bu paketin listesinde karşılığı olanlar girer.
    const bilinen = new Set(liste.satirlar.map((s) => s.key));
    marks = ((data ?? []) as ProgressRow[])
      .filter((r) => bilinen.has(r.part_code))
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

  return (
    <PurchasingTable
      packageId={id}
      liste={liste}
      stages={asamalar}
      marks={marks}
      canWrite={yazabilir}
      ledgerMissing={defterYok}
    />
  );
}
