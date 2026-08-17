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
import { canEditPurchasing } from "@/lib/roles";
import { satinAlmaKategoriSirasi } from "@/lib/drawings/derive";
import { HIZMET_TALEP_KATEGORILERI } from "@/lib/purchasing/categories";
import {
  loadHavuz,
  loadQualities,
  loadSiparisNolari,
  loadSiparisler,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
  loadTeklifler,
} from "./data";
import { DemandTable } from "./demand-table";

export default async function PurchasingPage() {
  const supabase = await createClient();

  // HAVUZ TAM OKUNUR, iş süzgeci İSTEMCİDE uygulanır (kullanıcı kararı, md. 6:
  // "bir veya daha fazla işi seçebilmeliyim"). Süzgeç sunucuda olsaydı her
  // seçim bir gidiş-dönüş olurdu ve çoklu seçimde bu kullanılamaz hâle
  // gelirdi. Okunan satır sayısı zaten dar: yalnız SATIN ALMA satırları
  // geliyor (üç canlı pakette 222 satır).
  const [{ data: kullanici }, { data: isler }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("jobs")
      .select("id, job_no, title, job_items (item_no)")
      .order("job_no", { ascending: false }),
  ]);

  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditPurchasing(profil?.role);

  const veri = await loadHavuz(supabase);
  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);

  const [teklifler, siparisler, tedarikciler, defter, siparisNolari, sonKur, qualities] =
    await Promise.all([
      anahtarlar.length > 0 ? loadTeklifler(supabase, anahtarlar) : Promise.resolve([]),
      loadSiparisler(supabase),
      loadTedarikciler(supabase),
      // KOD DEFTERİ AYRI OKUNUR: öneri listesi (`loadTedarikciler`) teklif ve
      // sipariş satırlarından gelen adları da kapsar; sipariş numarası ise yalnız
      // DEFTERDEKİ koddan türeyebilir.
      loadTedarikciDefteri(supabase),
      loadSiparisNolari(supabase),
      loadSonKur(supabase),
      loadQualities(supabase),
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
      defter={defter}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      kategoriler={satinAlmaKategoriSirasi(HIZMET_TALEP_KATEGORILERI)}
      // İŞ SÜZGECİ KALEM NUMARASIYLA eşleşir, iş kimliğiyle değil: havuz
      // satırları `item_no` METNİ taşır (WORKLOG-17 / RESIM-18'in kuralı — bağ türevdir).
      isler={(
        (isler ?? []) as {
          id: string;
          job_no: string;
          title: string;
          job_items: { item_no: string }[] | null;
        }[]
      ).map((j) => ({
        id: j.id,
        itemNos: (j.job_items ?? []).map((i) => i.item_no).filter(Boolean),
        label: `${j.job_no} · ${j.title}`,
      }))}
      canWrite={yazabilir}
    />
  );
}
