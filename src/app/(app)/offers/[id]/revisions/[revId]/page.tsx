// TEKLİF EDİTÖRÜ — kabuk (sunucu bileşeni).
//
// Defterin TAMAMI tek okumada gelir (`loadOfferOptions`): editörde elliye yakın
// açılır liste var ve her biri için ayrı sorgu atmak açılışta elli istek
// demekti. Defter birkaç yüz satırdır; bir kerede gelmesi hem daha hızlı hem
// daha basittir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadCustomerContacts, loadOfferOptions, loadOfferRevision } from "../../../data";
import { OfferEditor } from "./offer-editor";

export const dynamic = "force-dynamic";

export default async function OfferRevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();
  const [kayit, options] = await Promise.all([
    loadOfferRevision(supabase, id, revId),
    loadOfferOptions(supabase),
  ]);
  if (!kayit) notFound();

  // Muhatap seçicisinin listesi. Teklifin müşterisi belliyken kişiler ONA
  // bağlıdır; müşteri değişirse kapak elle güncellenir (belge, basıldığı
  // andaki bilginin fotoğrafıdır).
  const contacts = await loadCustomerContacts(supabase, kayit.offer.customer_id);

  return (
    // SAYFA KENDİ KAYDIRMA KABINI KURAR.
    //
    // Kabuk `/…/revisions/…` adreslerini SABİT ÇERÇEVE sayar (`isFrame`,
    // app-shell.tsx) ve `lg` üstünde gövdeye `h-dvh overflow-hidden` verir;
    // sayfa kendi kabını kurmazsa taşan içerik KIRPILIR ve kaydırılamaz
    // (kullanıcı bildirimi, 17.08.2026: *"teklifte scroll down çalışmıyor"*).
    // Yükseklik zinciri kesintisiz olmalıdır: kabuk → bu kök → editör.
    //
    // KAP `flex`TİR, `grid-rows` DEĞİL — ve bu fark bir hataya mal oldu.
    // `PageHeader` başlığı kabuğun üst şeridine PORTALLAR, yani burada HİÇ DOM
    // düğümü bırakmaz. `grid-rows-[auto_minmax(0,1fr)]` iki çocuk sayıyordu;
    // gerçekte tek çocuk vardı ve editör `auto` satıra düşüp yükseklik sınırını
    // hiç almıyordu (ilk düzeltme bu yüzden yalnız önizlemede çalıştı — orada
    // `PageHeader` yoktu). `flex-1` çocuk sayısından BAĞIMSIZDIR.
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <PageHeader
        kicker="Teklif"
        title={kayit.offer.subject || kayit.offer.offer_no}
        hint={kayit.offer.customer_name}
        backHref={`/offers/${id}`}
        backLabel="Teklif Paneli"
      />
      <OfferEditor
        offerId={id}
        offerNo={kayit.offer.offer_no}
        revisionId={revId}
        revNo={kayit.revision.rev_no}
        readOnly={kayit.revision.status !== "draft"}
        initial={kayit.revision.payload}
        options={options}
        contacts={contacts}
        currency={kayit.offer.currency}
      />
    </div>
  );
}
