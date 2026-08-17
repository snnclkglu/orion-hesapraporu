// Personel profili — bir kişinin künyesi, çalışma dönemleri, maaş geçmişi ve
// özlük dosyaları TEK adreste.
//
// SAYFA BAŞLIK BASMAZ: bölüm kabuğu (`finance/layout.tsx`) zaten bir
// `PageHeader` çiziyor ve bir ekranda YALNIZ BİR tane olur (AGENTS MOBIL-13).
// Kişinin adı gövdedeki `h2`dir. Geri dönüş bağlantısı da gövdededir çünkü
// kabuğun başlığı `backHref` taşımıyor: 1280px altında kırıntı yolu gizlidir ve
// kullanıcıda başka hiçbir "yukarı" bağlantısı kalmazdı.
//
// Sayfa yalnız VERİ ÇEKER ve tek bir istemci bileşenine geçer (worklog/sales
// kalıbı); markup orada durur — geri bağlantısı ve `h2` dâhil.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditPersonnel } from "@/lib/roles";
import { loadDocuments, loadEmployee, loadPayroll, loadPeriods } from "../data";
import { EmployeeProfile } from "./employee-profile";

/**
 * Adres çubuğuna elle yazılan bozuk bir kimlik sayfayı ÇÖKERTMEZ.
 *
 * `loadEmployee` bütün listeyi okuyup içinden aradığı için uuid olmayan bir
 * değer bugün sessizce "bulunamadı"ya düşer; yarın doğrudan sorguya çevrilirse
 * Postgres `22P02` verir ve sayfa 500'e giderdi. Biçim burada, girişte sınanır.
 */
const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function EmployeeProfilePage({
  params,
}: {
  // Next 16'da `params` da PROMISE'tir (`searchParams` gibi).
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // "Bugün" TEK bir yerde okunur: kıdem, yaş ve belge geçerliliği aynı güne
  // göre hesaplanmalıdır — üç ayrı `new Date()` gece yarısında ayrışabilir.
  const bugun = new Date().toISOString().slice(0, 10);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canWrite = canEditPersonnel((profile as { role?: string } | null)?.role);

  const [employee, payroll, documents, periods] = await Promise.all([
    loadEmployee(supabase, id, bugun),
    loadPayroll(supabase, { employeeId: id }),
    loadDocuments(supabase, id),
    loadPeriods(supabase),
  ]);

  // Kişi yoksa 404: silinmiş bir personelin adresi yer imine alınmış olabilir.
  if (!employee) notFound();

  return (
    <EmployeeProfile
      employee={employee}
      payroll={payroll}
      documents={documents}
      periods={periods}
      bugun={bugun}
      canWrite={canWrite}
    />
  );
}
