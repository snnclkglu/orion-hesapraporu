// Ücret Planı — yıllık net maaşların belirlendiği ekran.
//
// KULLANICI KARARI (13.08.2026): "Biz yıl başında zam yapıyoruz; kişinin net
// maaşının 50 bin TL olduğu belirleniyor, sonra kişi yıl boyunca o maaşı
// alıyor. Net maaşı belirleme sayfası gibi bir sayfa yapmak istiyorum. O
// bölümde zamları da ayarlayabileyim … Şimdiki maaş bölümüne de bu bölümden
// Net Maaş verisi gelsin."
//
// EKRAN KARAR YAZAR, ÖDEME YAZMAZ. `hr_salary_plan` "bu kişinin ücreti ne
// olacak" sorusunun cevabıdır; `hr_payroll` ise "o ay eline ne geçti"nin.
// İkisi çoğu ay aynıdır ama aynı ŞEY değildir — ay ortasında işe giren kişinin
// maaş satırı eksik gündür, ücreti tamdır. Bu yüzden buradan yazmak bir maaş
// satırı DOĞURMAZ; Maaş ekranı yeni satır açarken buradan OKUR.
//
// Sunucu yalnız veri çeker; yıl süzgeci, zam hesabı ve toplu kayıt tek bir
// istemci bileşenindedir (maaş/özet ekranlarıyla aynı kalıp).

import { createClient } from "@/lib/supabase/server";
import { canEditPersonnel } from "@/lib/roles";
import { todayIso } from "@/lib/work-log";
import { EN_ESKI_PLAN_YILI } from "@/lib/personnel/salary-plan";
import { loadEmployees, loadPayroll, loadSalaryPlan } from "../data";
import { SalaryPlanBoard } from "./salary-plan-board";

export default async function SalaryPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string }>;
}) {
  const sp = await searchParams;
  const bugun = todayIso();
  const buYil = Number(bugun.slice(0, 4));
  // Adres çubuğuna elle yazılan bozuk bir yıl sayfayı ÇÖKERTMEZ, bu yıla düşer.
  //
  // ALT SINIR KELEPÇESİ SUNUCUDADIR, yalnız düğmede değil (kullanıcı kararı,
  // 13.08.2026: "2024'ten geriye gitmemize gerek yok"). Ekrandaki ok
  // pasifleştirilmiş olsa bile `?yil=2019` elle yazılabilir ve orada kullanıcı
  // boş bir tablo görüp veriyi kaybolmuş sanardı — devralınan maaş kaydı
  // Mayıs 2024'te başlar.
  const ham = /^\d{4}$/.test(sp.yil ?? "") ? Number(sp.yil) : buYil;
  const yil = Math.max(EN_ESKI_PLAN_YILI, ham);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  const [employees, plans, payroll] = await Promise.all([
    loadEmployees(supabase, bugun),
    loadSalaryPlan(supabase),
    // ÖDENEN ÜCRET DE YÜKLENİR ama yalnız KARŞILAŞTIRMA için: planı olmayan
    // kişinin son ödenen maaşı zam tabanı olarak ÖNERİLİR. Öneri bir veri
    // değildir — kullanıcı kaydetmedikçe plana yazılmaz.
    loadPayroll(supabase),
  ]);

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ PERSONEL YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Ücret bir kişiye belirlenir. Önce Personel sekmesinden çalışanları ekleyin; bu ekran
          onların yıllık net ücretini ve zam oranlarını tutar.
        </p>
      </div>
    );
  }

  return (
    <SalaryPlanBoard
      yil={yil}
      buYil={buYil}
      employees={employees}
      plans={plans}
      payroll={payroll}
      canWrite={canEditPersonnel((profile as { role?: string } | null)?.role)}
    />
  );
}
