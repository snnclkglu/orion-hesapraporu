// Harcirah — yurtiçi harcirah tarifesi (dönem × personel sınıfı × günlük TL).
//
// TARİFE BİR GEÇMİŞTİR, bir ayar değil: eski dönem SİLİNMEZ, yenisi `validFrom`
// ile eklenir. Geçen yılki bir şantiyenin gün ücreti sorulduğunda o günkü tarife
// görünmelidir; tek satırı güncelleyen bir ekran o soruyu cevaplayamaz hâle
// getirirdi (`fin_per_diem` migration başlığındaki aynı gerekçe).
//
// KUR TABLOSU DA OKUNUR: gün ücreti TL'dir ama firma her şeyi avroda
// karşılaştırır (AGENTS md. 16). Karşılık TÜRETİLİR ve hangi kurla üretildiği
// ekranda YAZILIR — çevrilmiş bir sayının kaynağı görünmüyorsa o sayı bir iddia
// olur.

import { createClient } from "@/lib/supabase/server";
import { canEditFinance } from "@/lib/roles";
import { todayIso } from "@/lib/work-log";
import { loadFxMonthly, loadPerDiem } from "../data";
import { PerDiemTable } from "./per-diem-table";

export default async function PerDiemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // GÖRME yetkisi bölüm kabuğunda (finance/layout.tsx) sorulmuştur; burada
  // sorulan YAZMA yetkisidir ve tek iş yaptığı yer istemci bileşenidir.
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canWrite = canEditFinance((profile as { role?: string } | null)?.role);

  const [rows, fx] = await Promise.all([loadPerDiem(supabase), loadFxMonthly(supabase)]);

  // BUGÜN SUNUCUDA ÜRETİLİR: "güncel tarife hangisi" sorusunun cevabı istemcide
  // hesaplansaydı sunucu ve tarayıcı çıktısı gece yarısı ayrışır, hidrasyon
  // uyuşmazlığı doğardı.
  const bugun = todayIso();

  return (
    <div className="grid gap-4">
      <PerDiemTable rows={rows} fx={fx} bugun={bugun} canWrite={canWrite} />

      {/* BOŞ DURUM tablonun YERİNE değil ALTINA basılır: ekleme düğmesi
          tablonun şeridindedir ve ilk tarifeyi girecek kullanıcı onu
          bulabilmelidir. */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ TARİFE YOK ]
          </h2>
          <p className="max-w-sm text-sm text-foreground/70">
            Yurtiçi harcirah tarifesi dönem dönem tutulur: bir dönemin personel
            sınıfları ve günlük ücretleri girilir, ücret değiştiğinde eski dönem
            silinmeden yeni bir dönem açılır.
          </p>
        </div>
      )}
    </div>
  );
}
