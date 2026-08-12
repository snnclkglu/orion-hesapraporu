// Paketin SATIN ALMA ÖZETİ — sunucu kabuğu. SALT OKUNUR.
//
// ————————————————————————————————— SEKME GERİ GELDİ AMA EKRAN GELMEDİ
//
// 12.08.2026 sabahı paket içi Satın Alma sekmesi KALDIRILMIŞTI ve gerekçesi
// hâlâ geçerli: satınalmacı projeleri tek tek ele almaz, birden çok projenin
// siparişini bir arada verir; `/purchasing` tam olarak o işi modeller ve iki
// YAZAN ekran "hangisi doğru" sorusunu doğururdu.
//
// Aynı gün gelen istek başka bir şeydir (kullanıcı kararı): *"Mühendis ya da
// ressam bu ekipman satın alınmış mı diye bakabilsin ve teslim süresini
// görebilsin. Fiyat ve kimden alındığı gibi bilgilere gerek yok. Satın Alma
// modülünü mühendis ve ressama açmayacağım."*
//
// Bu yüzden BURADA HİÇBİR İŞLEM YOKTUR — tek bir düğme, tek bir form, tek bir
// server action yok. Çelişki de doğmaz: yazan taraf hâlâ tektir.
//
// ————————————————————————————————— FİYAT BURAYA GELEMEZ
//
// Veri `drawing_purchase_summary(uuid)` fonksiyonundan gelir; `purchase_orders`
// tablosu bu kullanıcıya RLS ile KAPALIDIR ve öyle kalır. Fonksiyonun
// `returns table` listesi güvenlik sınırının kendisidir ve orada para ya da
// tedarikçi geçmez (migration 20260812140000 + koruma testi). Bu, "unutmayalım"
// düzeyinde bir kural değil, veriyi hiç getirmeyen bir kapıdır.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { satinAlmaListesi } from "@/lib/drawings/derive";
import {
  PURCHASE_STAGE_SLUG,
  progressItemNo,
  trackedParts,
} from "@/lib/drawings/progress";
import {
  paketSatinAlmaOzeti,
  type SatinAlmaIsareti,
  type SiparisOzeti,
} from "@/lib/purchasing/package-summary";
import { loadPackage, loadParts } from "../../data";
import { partToTurev } from "../export/shared";
import { PurchaseSummaryTable } from "./summary-table";

interface OzetSatiriHam {
  part_key: string | null;
  match_key: string | null;
  ordered_qty: number | string | null;
  received_qty: number | string | null;
  first_ordered_at: string | null;
  next_due_at: string | null;
  last_received_at: string | null;
  order_count: number | null;
  open_order_count: number | null;
}

const say = (v: number | string | null | undefined) =>
  v == null ? 0 : Number.isFinite(Number(v)) ? Number(v) : 0;

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
  const liste = satinAlmaListesi(parcalar.map(partToTurev));

  if (liste.satirlar.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ SATIN ALINACAK KALEM YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Bu paketin defterinde satın alma satırı bulunamadı. Defter Excel&apos;den
          kurulur; “Yeniden Eşleştir” çalıştırıldığında kalemler burada belirir.
        </p>
      </div>
    );
  }

  // ————————————————————————————————— sipariş özeti (fonksiyon üzerinden)
  //
  // MIGRATION HENÜZ UYGULANMAMIŞ OLABİLİR. Bir RPC'nin yokluğu yüzünden bütün
  // sayfayı kaybetmek, eksikliğin kendisinden çok daha pahalıdır (md. 21'in
  // "zengin sorgu + dar yedek" kalıbı): fonksiyon yoksa liste yine basılır ve
  // her kalem "sipariş bekliyor" görünür — ekran bunu AÇIKÇA söyler.
  const rpc = await supabase.rpc("drawing_purchase_summary", { p_package_id: id });
  const ozetKapisiVar = !rpc.error;
  const ozetler: SiparisOzeti[] = ((rpc.data ?? []) as OzetSatiriHam[]).map((r) => ({
    partKey: r.part_key ?? "",
    matchKey: r.match_key ?? "",
    orderedQty: say(r.ordered_qty),
    receivedQty: say(r.received_qty),
    firstOrderedAt: r.first_ordered_at,
    nextDueAt: r.next_due_at,
    lastReceivedAt: r.last_received_at,
    orderCount: say(r.order_count),
    openOrderCount: say(r.open_order_count),
  }));

  // ————————————————————————————————— "satın alındı" işaretleri
  //
  // Sorgu KALEM NUMARASI üzerinden yapılır, anahtar listesiyle değil: satın
  // alma anahtarları uzun metinlerdir (`SATINALMA:CIVATA M16X120 DIN 931
  // GALVANİZLİ`) ve yetmiş kalemlik bir `in(...)` adres çubuğunu taşırır.
  // Üretim tahtası da aynı yolu izliyor.
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
  const kalemler = [
    ...new Set(izlenen.all.map((p) => progressItemNo(p.key, izlenen.itemNo)).filter(Boolean)),
  ];
  const anahtarlar = new Set(liste.satirlar.map((s) => s.key));

  let isaretler: SatinAlmaIsareti[] = [];
  if (kalemler.length > 0) {
    const { data } = await supabase
      .from("drawing_part_progress")
      .select("part_code, done_at")
      .eq("stage", PURCHASE_STAGE_SLUG)
      .in("item_no", kalemler);
    isaretler = ((data ?? []) as { part_code: string; done_at: string | null }[])
      // Aynı kalem numarasını paylaşan BAŞKA bir paketin satırları da gelir;
      // bu ekrana yalnız bu defterin kalemleri girer.
      .filter((r) => anahtarlar.has(r.part_code))
      .map((r) => ({ key: r.part_code, doneAt: r.done_at }));
  }

  const ozet = paketSatinAlmaOzeti(
    liste.satirlar.map((s) => ({
      key: s.key,
      tanim: s.tanim,
      sinif: s.sinif,
      malzeme: s.malzeme,
      parcaKodu: s.parcaKodu,
      adet: s.adet,
    })),
    ozetler,
    isaretler
  );

  return <PurchaseSummaryTable ozet={ozet} ozetKapisiVar={ozetKapisiVar} />;
}
