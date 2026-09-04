// SATIŞ ANALİZİ — projeksiyon ve kazanılan işler için sunucu ucu.
//
// PROJEKSİYONDA İKİ KAYNAK TEK ÇİZELGEDE BULUŞUR: verilmiş teklifler (`offers`) ve henüz
// verilmemiş beklenen işler (`offer_leads`). Birleştirme BURADA yapılır ve
// aşağıya tek bir satır tipiyle iner — çekirdek (`lib/offers/analiz.ts`) satırın
// hangi tabloda durduğunu umursamaz. KAZANILAN İŞLER ise `won` teklifleri ayrı
// bir gerçekleşme satırı olarak okur; iki soru sekmeyle ayrılır.
//
// SÜZME VE HESAP İSTEMCİDE: teklif sayısı bir firmanın yıllık üretimi kadardır
// (yüzler mertebesi) ve her pencere/süzgeç değişiminde sunucuya gitmek ekranı
// gereksiz yavaşlatırdı (teklif listesinin deseni).
//
// YETKİ KAPISI BÖLÜM KABUĞUNDADIR (`offers/layout.tsx`) — burada tekrar
// edilmez; RLS (`can_see_offers`) zaten satırları vermez.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { effectiveOfferDate } from "@/lib/offers/filter";
import type { KazanilanIsSatiri } from "@/lib/offers/analiz";
import { isOfferIncludedInAnalysis, offerStatusOf } from "@/lib/offers/status";
import { loadCustomers, loadOfferList } from "../data";
import { AnalizView } from "./analiz-view";
import type { AnalizSatiriDetay } from "./lead-dialog";

export const dynamic = "force-dynamic";

interface LeadRecord {
  id: string;
  customer_id: string | null;
  customer_name: string;
  subject: string;
  expected_on: string | null;
  amount: number | string | null;
  currency: string;
  win_score: number | null;
  notes: string;
  active: boolean;
  offer_id: string | null;
}

interface JobRecord {
  id: string;
  job_no: string;
  title: string;
}

/**
 * Teklifin ANALİZ ALANLARI ayrı okunur.
 *
 * `offer_list` görünümü `win_score` ve `expected_on` sütunlarını taşır ama
 * `loadOfferList`in döndürdüğü `OfferListEntry` onları taşımaz ve o okuma
 * katmanı bütün teklif ekranlarının ORTAK sözleşmesidir — yalnız bu sayfa için
 * genişletmek ya da sorguyu kopyalamak, listeyle analizin sessizce ayrışmasına
 * açılan iki kapıdır. İki alanlık ikinci bir okuma en ucuz ve en dürüst yol.
 */
async function loadWinScores(
  supabase: SupabaseClient
): Promise<Map<string, { score: number | null; expectedOn: string | null }>> {
  const { data } = await supabase.from("offers").select("id, win_score, expected_on");
  return new Map(
    (data ?? []).map((r) => [
      r.id as string,
      { score: (r.win_score as number | null) ?? null, expectedOn: (r.expected_on as string | null) ?? null },
    ])
  );
}

/** YUMUŞAK DÜŞER: defter okunamazsa sayfa yine açılır, beklenen işler boş kalır. */
async function loadLeads(supabase: SupabaseClient): Promise<LeadRecord[]> {
  const { data, error } = await supabase
    .from("offer_leads")
    .select(
      "id, customer_id, customer_name, subject, expected_on, amount, currency, win_score, notes, active, offer_id"
    )
    .order("expected_on", { ascending: true, nullsFirst: false });
  if (error) return [];
  return (data ?? []) as LeadRecord[];
}

/**
 * Kazanılan teklifin açtığı iş emrini etiketlemek için gereken küçük defter.
 * Bağ zaten `offers.job_id`dedir; burada ikinci bir ilişki kurulmaz.
 */
async function loadJobRefs(supabase: SupabaseClient): Promise<JobRecord[]> {
  const { data, error } = await supabase.from("jobs").select("id, job_no, title");
  if (error) return [];
  return (data ?? []) as JobRecord[];
}

export default async function OfferAnalysisPage() {
  const supabase = await createClient();
  const [offers, customers, leads, puanlar, jobs] = await Promise.all([
    loadOfferList(supabase),
    loadCustomers(supabase),
    loadLeads(supabase),
    loadWinScores(supabase),
    loadJobRefs(supabase),
  ]);

  // Müşteri kısaltması ve rengi DEFTERDEN gelir: beklenen iş satırında ad
  // serbest metin olabilir ve defterde karşılığı yoksa `CustomerTag` rengi
  // metinden türetir — satır hiçbir zaman kimliksiz kalmaz.
  const defter = new Map(customers.map((c) => [c.id, c]));
  const isDefteri = new Map(jobs.map((j) => [j.id, j]));

  // BÜTÇESEL teklifler gerçek bir satın alma fırsatı değildir. Tutarı ve puanı
  // bulunsa bile sunucuda elenir; istemciye/grafiklere hiç taşınmaz.
  const teklifSatirlari: AnalizSatiriDetay[] = offers
    .filter((o) => isOfferIncludedInAnalysis(o.status))
    .map((o) => {
      const puan = puanlar.get(o.id);
      return {
        id: o.id,
        kaynak: "teklif",
        offerNo: o.offer_no,
        customerName: o.customer_name,
        customerShort: o.customerShort,
        customerHue: o.customerHue,
        subject: o.subject,
        status: o.status,
        // ÇİZELGENİN SIRA TARİHİ — teklifin VERİLDİĞİ gün. Tanım TEK yerdedir
        // (`effectiveOfferDate`): teklif listesi de aynı soruyu aynı yerden sorar
        // ve "yayımlandıysa gönderim günü, yoksa açılış günü" kuralı iki ekranda
        // ayrışamaz.
        verilisTarihi: effectiveOfferDate(o),
        expectedOn: puan?.expectedOn ?? null,
        // TUTAR GÜNCEL REVİZYONUN TOPLAMIDIR; fiyatı girilmemiş teklif `null`
        // kalır ve `0 €`lık bir teklif sayılmaz (değişmez md. 4).
        amount: o.latestTotal,
        currency: o.currency,
        score: puan?.score ?? null,
        active: true,
        customerId: o.customerId,
        notes: "",
      };
    });

  const beklenenSatirlar: AnalizSatiriDetay[] = leads.map((l) => {
    const musteri = l.customer_id ? defter.get(l.customer_id) : undefined;
    return {
      id: l.id,
      kaynak: "beklenen",
      offerNo: null,
      customerName: l.customer_name,
      customerShort: musteri?.short_name ?? null,
      customerHue: musteri?.color_hue ?? null,
      subject: l.subject,
      status: "beklenen",
      // BEKLENEN İŞİN VERİLME GÜNÜ YOKTUR ve uydurulmaz (değişmez md. 4):
      // satır henüz bir teklif değildir. Sıralama onu `expected_on` ile dizer,
      // o da yoksa satır SONA düşer — ama listeden düşmez.
      verilisTarihi: null,
      expectedOn: l.expected_on,
      amount: l.amount === null ? null : Number(l.amount),
      currency: l.currency,
      score: l.win_score,
      offerId: l.offer_id,
      active: l.active,
      customerId: l.customer_id,
      notes: l.notes,
    };
  });

  const kazanilanlar: KazanilanIsSatiri[] = offers
    .filter((o) => offerStatusOf(o.status) === "won")
    .map((o) => {
      const isEmri = o.jobId ? isDefteri.get(o.jobId) : undefined;
      return {
        id: o.id,
        offerNo: o.offer_no,
        customerName: o.customer_name,
        customerShort: o.customerShort,
        customerHue: o.customerHue,
        subject: o.subject,
        issuedOn: o.issuedOn,
        wonOn: o.wonOn,
        amount: o.latestTotal,
        currency: o.currency,
        jobId: o.jobId,
        jobNo: isEmri?.job_no ?? null,
        jobTitle: isEmri?.title ?? null,
      };
    });

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="TEKLİF"
        title="Satış Analizi"
        hint="İleri satış projeksiyonu ile kazanılan işlerin gerçekleşmesini aynı yerde izleyin."
      />

      {/* BUGÜN SUNUCUDA ÇÖZÜLÜR: bütün dönem hesabı bu tek tarihe dayanır ve
          istemcide `new Date()` çağırmak hidrasyon uyuşmazlığı açardı. */}
      <AnalizView
        satirlar={[...teklifSatirlari, ...beklenenSatirlar]}
        kazanilanlar={kazanilanlar}
        customers={customers}
        bugun={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
