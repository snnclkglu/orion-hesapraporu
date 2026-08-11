// Talep Havuzu — satın almanın ana ekranı; sunucu kabuğu.
//
// EKRANIN CEVAPLADIĞI SORU: "bugün ne sipariş etmeliyim?"
//
// Havuz bütün canlı paketlerin satın alma satırlarını TEK LİSTEDE toplar,
// adetleri iş kalemi adediyle çarpar (md. 6) ve aynı kalemi normalleştirilmiş
// tanım üzerinden birleştirir (md. 9). Bu, satınalmacının bugüne kadar elle
// yaptığı işin ta kendisidir — İŞ HAZIRLAMA LİSTESİ dosyasında beş ayrı iş
// numarasının satırları yan yana duruyor.
//
// SÜZGEÇ VERİTABANI TARAFINDA: `loadHavuz` yalnız satın alma satırlarını okur.
// Bütün parçaları çekip istemcide süzmek elli pakette otuz bin satır ederdi.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, tagsOf } from "@/lib/roles";
import { satinAlmaKategoriSirasi } from "@/lib/drawings/derive";
import { loadHavuz, loadSiparisler, loadTedarikciler, loadTeklifler } from "./data";
import { DemandTable } from "./demand-table";

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ is?: string }>;
}) {
  const { is } = await searchParams;
  const supabase = await createClient();

  // İŞ SÜZGECİ ADRESTE DURUR, istemci durumunda değil: satınalmacı "şu üç
  // projeyi bir arada alacağım" diye çalışır ve o görünümü meslektaşına
  // bağlantı olarak yollayabilmelidir.
  const jobIds = (is ?? "").split(",").filter(Boolean);

  const [{ data: kullanici }, { data: isler }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("jobs").select("id, job_no, title").order("job_no", { ascending: false }),
  ]);

  const zengin = kullanici.user
    ? await supabase.from("profiles").select("role, tags").eq("id", kullanici.user.id).maybeSingle()
    : { data: null, error: null };
  const profil = zengin.error
    ? (
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", kullanici.user!.id)
          .maybeSingle()
      ).data
    : zengin.data;
  const yazabilir = canEditPurchasing({
    role: (profil as { role?: string } | null)?.role ?? "",
    tags: tagsOf((profil as { tags?: string[] } | null)?.tags),
  });

  const veri = await loadHavuz(supabase, { jobIds });
  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);

  const [teklifler, siparisler, tedarikciler] = await Promise.all([
    anahtarlar.length > 0 ? loadTeklifler(supabase, anahtarlar) : Promise.resolve([]),
    loadSiparisler(supabase),
    loadTedarikciler(supabase),
  ]);

  // Sipariş edilmiş adetler kalem başına toplanır: havuz "ne lazım" der,
  // siparişler "ne alındı" der ve satınalmacının asıl baktığı sayı İKİSİNİN
  // FARKIdır. Fark ekranda ayrıca hesaplanmaz — sunucu tek bir harita verir.
  const siparisAdetleri = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdetleri.set(l.matchKey, (siparisAdetleri.get(l.matchKey) ?? 0) + l.qty);
    }
  }

  return (
    <DemandTable
      havuz={veri.havuz}
      teklifler={teklifler}
      siparisAdetleri={[...siparisAdetleri.entries()]}
      tedarikciler={tedarikciler}
      kategoriler={satinAlmaKategoriSirasi()}
      isler={((isler ?? []) as { id: string; job_no: string; title: string }[]).map((j) => ({
        id: j.id,
        label: `${j.job_no} · ${j.title}`,
      }))}
      seciliIsler={jobIds}
      canWrite={yazabilir}
    />
  );
}
