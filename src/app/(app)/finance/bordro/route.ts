// ÜCRET PUSULASI (bordro) PDF ucu — `?kisi=<uuid>&donem=<yyyy-aa>`.
//
// Veri Finans'ın KENDİ okuma katmanından gelir (`../data.ts`); ekranda görünen
// maaş satırı ile basılan pusula ayrışamaz. İkinci bir sorgu yazmak bu projede
// bir kez yaşandı ve dersi `worklog/filters.ts`in başında yazılı.
//
// YETKİ BURADA DA SORULUR. RLS zaten keser ama BOŞ bir PDF indirmek
// "yetkiniz yok" demekten çok daha kafa karıştırıcıdır — ve bu belge kişisel
// veri taşır (TC kimlik no, IBAN, ücret).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSeeFinance } from "@/lib/roles";
import { DEFAULT_REPORT_SETTINGS, getReportSettings } from "@/lib/settings";
import { downloadFileName, payslipDocCode } from "@/lib/pdf/doc-naming";
import { renderPayslipPdf } from "@/lib/pdf/payslip";
import { periodLabelUpper } from "@/lib/finance/payroll";
import { todayIso } from "@/lib/work-log";
import { loadEmployee, loadPayroll, loadPeriods } from "../data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canSeeFinance((profile as { role?: string } | null)?.role)) {
    return NextResponse.json(
      { error: "Bordroya yalnız Yönetici ve Müdür erişebilir." },
      { status: 403 }
    );
  }

  const p = request.nextUrl.searchParams;
  const kisi = (p.get("kisi") ?? "").trim();
  const donemHam = (p.get("donem") ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(kisi) || !/^\d{4}-(0[1-9]|1[0-2])/.test(donemHam)) {
    return NextResponse.json(
      { error: "Geçersiz adres: kişi ve dönem gerekli (?kisi=…&donem=yyyy-aa)." },
      { status: 400 }
    );
  }
  const donem = donemHam.slice(0, 7);

  const bugun = todayIso();
  const [employee, satirlar, periods, st] = await Promise.all([
    loadEmployee(supabase, kisi, bugun),
    loadPayroll(supabase, { employeeId: kisi, period: donem }),
    loadPeriods(supabase),
    getReportSettings(supabase),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  }
  const payroll = satirlar[0];
  if (!payroll) {
    return NextResponse.json(
      { error: `${employee.fullName} için ${periodLabelUpper(donem)} dönemine ait maaş kaydı yok.` },
      { status: 404 }
    );
  }

  const ayar = { ...DEFAULT_REPORT_SETTINGS, ...st };
  // Kıdem başlangıcı EN ESKİ dönemin başlangıcıdır: kişi ayrılıp geri
  // döndüyse pusulada "ilk işe giriş" görünmelidir (`employment` en yeniden
  // eskiye sıralıdır).
  const ilkGiris =
    employee.employment.length > 0
      ? employee.employment[employee.employment.length - 1].startDate
      : null;

  const govde = await renderPayslipPdf({
    employee: {
      fullName: employee.fullName,
      employeeNo: employee.employeeNo,
      nationalId: employee.nationalId,
      title: employee.title,
      department: employee.department,
      sgkNo: employee.sgkNo,
      iban: employee.iban,
      hireDate: ilkGiris,
    },
    payroll,
    period: donem,
    // Dönemin KENDİ kuru; girilmemişse null → PDF avro satırını HİÇ BASMAZ.
    eurTryRate: periods.find((x) => x.period === donem)?.eurTryRate ?? null,
    company: {
      company: ayar.company,
      address: ayar.address || ayar.city,
      phone: ayar.phone,
      email: ayar.email,
      web: ayar.web,
    },
  });

  const dosyaAdi = downloadFileName(
    [employee.fullName, payslipDocCode(donem), "Bordro"],
    "pdf"
  );
  // Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
  // gider, ASCII yedek eski istemciler içindir.
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new NextResponse(new Uint8Array(govde), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}
