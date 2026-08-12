// Personel listesi — Finans bölümünün kök sayfası.
//
// Sunucu yalnız OKUR; süzme, arama ve pencereler tek bir istemci bileşenindedir
// (worklog/sales kalıbı). Defter 46 satırdır ve tamamı tek istekte gelir —
// süzgeç her değiştiğinde sunucuya gitmek burada hiçbir şey kazandırmaz.
//
// BAŞLIK BASILMAZ: bölüm kabuğu (`finance/layout.tsx`) zaten bir `PageHeader`
// çiziyor ve bir ekranda YALNIZ BİR tane olur.

import { createClient } from "@/lib/supabase/server";
import { canEditFinance } from "@/lib/roles";
import { todayIso } from "@/lib/work-log";
import { loadEmployees } from "./data";
import { PersonnelTable } from "./personnel-table";

export default async function FinancePage({
  searchParams,
}: {
  // Next 16'da `searchParams` bir PROMISE'tir.
  searchParams: Promise<{ durum?: string; kategori?: string; ara?: string }>;
}) {
  const sp = await searchParams;
  // Adres çubuğuna elle yazılan bozuk bir değer sayfayı ÇÖKERTMEZ, varsayılana
  // düşer. Varsayılan "aktif"tir: günlük iş bugün çalışanlarladır, ayrılanlar
  // aynı listede bir süzgeç arkasındadır.
  const durum =
    sp.durum === "ayrildi" || sp.durum === "tumu" ? sp.durum : "aktif";
  const kategori = (sp.kategori ?? "").trim().slice(0, 60);
  const ara = (sp.ara ?? "").trim().slice(0, 60);

  const bugun = todayIso();
  const supabase = await createClient();

  // Yetki KAPISI kabuktadır; buradaki okuma yalnız yazma düğmelerini
  // pasifleştirmek içindir. Asıl engel RLS'tir.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canWrite = canEditFinance((profile as { role?: string } | null)?.role);

  const employees = await loadEmployees(supabase, bugun);

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ PERSONEL YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Personel defteri bu bölümün temelidir: maaş, özlük dosyası ve bordro hep bir
          kişiye bağlanır. İlk çalışanı ekleyerek başlayın.
        </p>
      </div>
    );
  }

  return (
    <PersonnelTable
      employees={employees}
      bugun={bugun}
      durum={durum}
      kategori={kategori}
      ara={ara}
      canWrite={canWrite}
    />
  );
}
