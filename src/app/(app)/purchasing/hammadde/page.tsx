// Hammadde Havuzu — sunucu kabuğu.
//
// EKRANIN CEVAPLADIĞI SORU: "hangi malzemeyi ne kadar almalıyım?"
//
// Ekipman havuzu "hangi ürünü kaç adet" der; burada birim ADET DEĞİLDİR —
// sacda m² ve plaka, profilde metre ve BOY, doluda kilodur. Bu yüzden ayrı bir
// ekran: tek bir tabloya iki farklı birim sığmaz.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { loadSiparisler, loadSonKur, loadTedarikciler, loadTedarikciDefteri, loadTeklifler, loadSiparisNolari, loadQualities } from "../data";
import { loadHammaddeHavuzu } from "./data";
import { RawTable } from "./raw-table";

export default async function HammaddePage() {
  const supabase = await createClient();

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

  const veri = await loadHammaddeHavuzu(supabase);
  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);

  // TEKLİF VE SİPARİŞ EKİPMAN TARAFIYLA ORTAKTIR: ikisi de `match_key`
  // uzayında yaşıyor ve bir sac plakasına verilen sipariş burada da görünmeli.
  // Ayrı bir okuma katmanı yazmak, aynı siparişi iki ekranda farklı göstermenin
  // en kısa yoluydu (md. 16'nın dersi).
  const [teklifler, siparisler, tedarikciler, defter, siparisNolari, sonKur, qualities] =
    await Promise.all([
      anahtarlar.length > 0 ? loadTeklifler(supabase, anahtarlar) : Promise.resolve([]),
      loadSiparisler(supabase),
      loadTedarikciler(supabase),
      loadTedarikciDefteri(supabase),
      loadSiparisNolari(supabase),
      loadSonKur(supabase),
      loadQualities(supabase),
    ]);

  const siparisAdetleri = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdetleri.set(l.matchKey, (siparisAdetleri.get(l.matchKey) ?? 0) + l.qty);
    }
  }

  // STOK KALEMİ ADI ÖNERİ LİSTESİ (kullanıcı isteği, 15.08.2026): *"Yeni
  // Hammadde Talebi pop-up'ta stok kalemi adı öncekiler dropdown gelsin."*
  // Liste havuzun KENDİSİNDEN çıkar — ikinci bir defter tutmak, elle açılan
  // talebin adının havuzdakiyle ayrışmasının en kısa yoluydu.
  const stokAdlari = [...new Set(veri.havuz.satirlar.map((s) => s.tanim).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "tr")
  );

  return (
    <RawTable
      havuz={veri.havuz}
      stokAdlari={stokAdlari}
      teklifler={teklifler}
      siparisAdetleri={[...siparisAdetleri.entries()]}
      tedarikciler={tedarikciler}
      defter={defter}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      defterVar={veri.defterVar}
      isler={(
        (isler ?? []) as {
          id: string;
          job_no: string;
          title: string;
          job_items: { item_no: string }[] | null;
        }[]
      ).map((j) => ({
        id: j.id,
        // İŞ NUMARASI ASIL BAĞDIR: paketin `item_no`su her zaman bir iş kalemi
        // numarası değildir (MONORAY `0057-00` taşıyor ve o numarayla bir
        // `job_items` satırı yok). Kalem numaraları yedek kalır.
        jobNo: j.job_no,
        itemNos: (j.job_items ?? []).map((i) => i.item_no).filter(Boolean),
        label: `${j.job_no} · ${j.title}`,
      }))}
      canWrite={yazabilir}
    />
  );
}
