// Özet — devralınan Excel'in "Maaş Özet Tablo" ve "Aylık Çalışma Saatleri"
// sayfalarının karşılığı.
//
// EKRAN HİÇBİR ŞEY SAKLAMAZ. Buradaki her sayı maaş satırlarından ve dönem
// ayarlarından TÜRETİLİR (`donemOzeti`, `netCalismaSaati`); ikinci bir özet
// tablosu tutmak iki kaynak üretir ve ikisi zamanla ayrışırdı.
//
// Sayfa YALNIZ VERİ ÇEKER. Süzme, toplama ve grafikler tek bir istemci
// bileşenindedir: maaş satırı sayısı yüzlerle ölçülür (bugün 566), tamamı tek
// istekte gelir ve süzgeç değiştikçe yeniden sorgulamaya gerek yoktur.

import { createClient } from "@/lib/supabase/server";
import { canEditPersonnel } from "@/lib/roles";
import { todayIso } from "@/lib/work-log";
import { loadEmployees, loadFxMonthly, loadPayroll, loadPeriods } from "../data";
import { SummaryView } from "./summary-view";

export default async function PersonnelSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; kapsam?: string }>;
}) {
  const sp = await searchParams;
  // SÜZGEÇ ADRESTE DURUR ama adres çubuğuna elle yazılan bozuk bir değer
  // sayfayı ÇÖKERTMEZ: doğrulamayı geçemeyen değer "Tümü"ye düşer.
  const yil = /^\d{4}$/.test(sp.yil ?? "") ? (sp.yil as string) : null;
  const kapsam = sp.kapsam === "personel" || sp.kapsam === "yonetim" ? sp.kapsam : null;

  const bugun = todayIso();
  const supabase = await createClient();

  // Yetki KAPISI bölüm kabuğundadır (`finance/layout.tsx`); burada sorulan
  // yalnız YAZMA yetkisidir — eksik dönem kuru için verilen "Kurlar" kısayolu
  // yazamayacak kullanıcıya gösterilmez.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  const [employees, payroll, periods, fx] = await Promise.all([
    loadEmployees(supabase, bugun),
    loadPayroll(supabase),
    loadPeriods(supabase),
    loadFxMonthly(supabase),
  ]);

  if (payroll.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ MAAŞ KAYDI YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Özet hesaplanan bir ekrandır: aylık toplamlar, fazla mesai ve çalışma
          saatleri maaş satırlarından türetilir. Maaş sekmesinden ilk dönemi
          girdiğinizde tablo ve grafikler kendiliğinden dolar.
        </p>
      </div>
    );
  }

  return (
    <SummaryView
      employees={employees}
      payroll={payroll}
      periods={periods}
      fx={fx}
      year={yil}
      scope={kapsam}
      canWrite={canEditPersonnel((profile as { role?: string } | null)?.role)}
    />
  );
}
