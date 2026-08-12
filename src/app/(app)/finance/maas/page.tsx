// Aylık Maaş — Finans bölümünün her ay açılan ÇALIŞMA ekranı.
//
// Sunucu yalnız OKUR ve tek bir istemci bileşenine verir (worklog/sales
// kalıbı): ay seçimi, satır düzenleme ve toplamlar orada yaşar. Başlık
// basılmaz — bölüm kabuğu (`finance/layout.tsx`) zaten bir `PageHeader`
// çiziyor ve bir ekranda YALNIZ BİR tane olur.
//
// ÖNCEKİ AY DA YÜKLENİR: "geçen ayı kopyala" bu bölümün en büyük kaldıracıdır
// (maaşların çoğu aydan aya değişmez) ve ikinci bir istekle sonradan çekmek,
// düğmenin bir şey yapıp yapmayacağını ancak basıldıktan sonra öğrenmek
// demekti.

import { createClient } from "@/lib/supabase/server";
import { canEditFinance } from "@/lib/roles";
import { loadEmployees, loadFxMonthly, loadPayroll, loadPeriods } from "../data";
import { PayrollBoard } from "./payroll-board";

/**
 * Bugünün ayı ve günü — YEREL takvime göre.
 *
 * `toISOString()` UTC verir ve ayın ilk gününün ilk saatlerinde bir ÖNCEKİ ayı
 * gösterirdi: kullanıcı 1 Ağustos sabahı ekranı açtığında Temmuz açılırdı.
 */
function bugunVeAy(): { bugun: string; ay: string } {
  const d = new Date();
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, "0");
  return { bugun: `${y}-${a}-${String(d.getDate()).padStart(2, "0")}`, ay: `${y}-${a}` };
}

/** `2026-08` → `2026-07`. Dönem anahtarı gün taşımaz. */
function oncekiAy(ay: string): string {
  const [y, a] = ay.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  // Next 16'da `searchParams` bir PROMISE'tir.
  const sp = await searchParams;
  const raw = sp.ay ?? "";
  const { bugun, ay: buAy } = bugunVeAy();
  // Adres çubuğuna elle yazılan bozuk bir ay sayfayı ÇÖKERTMEZ, bugüne düşer.
  // Ay numarası da doğrulanır: "2026-13" geçerli bir dönem değildir.
  const ay = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : buAy;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Yetki KAPISI kabukta (`finance/layout.tsx`); buradaki okuma yalnız YAZMA
  // düğmelerini pasifleştirmek içindir. Asıl engel RLS'tir.
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canWrite = canEditFinance((profile as { role?: string } | null)?.role);

  const [employees, payroll, previousPayroll, periods, fxMonthly] = await Promise.all([
    loadEmployees(supabase, bugun),
    loadPayroll(supabase, { period: ay }),
    loadPayroll(supabase, { period: oncekiAy(ay) }),
    loadPeriods(supabase),
    loadFxMonthly(supabase),
  ]);

  // BOŞ DURUM sunucuda basılır: personel defteri boşken maaş panosunun bütün
  // kutuları sıfır gösterir ve kullanıcı nereden başlayacağını bilemez.
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ PERSONEL YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Maaş bir kişiye yazılır. Önce Personel sekmesinden çalışanları ekleyin; bu ekran
          onların aylık net maaşını ve fazla mesaisini toplar.
        </p>
      </div>
    );
  }

  return (
    <PayrollBoard
      ay={ay}
      bugunAy={buAy}
      employees={employees}
      payroll={payroll}
      previousPayroll={previousPayroll}
      periods={periods}
      fxMonthly={fxMonthly}
      canWrite={canWrite}
    />
  );
}
