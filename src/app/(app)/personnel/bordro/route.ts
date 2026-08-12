// ÜCRET BORDROSU PDF ucu.
//
//   ?kisi=<uuid>&donem=<yyyy-aa>   → tek kişinin bordrosu
//   ?donem=<yyyy-aa>&hepsi=1       → dönemin BÜTÜN bordroları tek belgede
//
// Veri Personel'in KENDİ okuma katmanından gelir (`../data.ts`); ekranda
// görünen maaş satırı ile basılan pusula ayrışamaz.
//
// ═══════════════════════════════════════════ KÜMÜLATİF MATRAH YILDAN OKUNUR
// Gelir vergisi dilimi yılbaşından beri biriken matraha göre yükselir. Bu
// yüzden tek bir ay için bordro basarken bile O YILIN TAMAMI yüklenir ve
// kümülatif ocaktan itibaren yeniden hesaplanır. Satıra yazılmış eski bir
// kümülatif değere güvenilmez: aradaki bir ay sonradan düzeltilmiş olabilir
// ve o düzeltme sonraki bütün ayların vergisini değiştirir.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSeePersonnel } from "@/lib/roles";
import { DEFAULT_REPORT_SETTINGS, getReportSettings } from "@/lib/settings";
import { downloadFileName, payslipDocCode } from "@/lib/pdf/doc-naming";
import {
  renderPayslipBatchPdf,
  renderPayslipPdf,
  type PayslipProps,
} from "@/lib/pdf/payslip";
import { periodLabelUpper } from "@/lib/personnel/payroll";
import { gecerliParametre, yilKumulatifi, type PayrollParams } from "@/lib/personnel/bordro";
import { todayIso } from "@/lib/work-log";
import { loadEmployees, loadPayroll, loadPayrollParams } from "../data";
import type { EmployeeRow, PayrollRow } from "../schema";

export const runtime = "nodejs";
// Elli kişilik bir dönemde elli sayfa üretilir; react-pdf font gömmesiyle
// birlikte bu 10-20 saniye sürebilir.
export const maxDuration = 60;

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
  if (!canSeePersonnel((profile as { role?: string } | null)?.role)) {
    return NextResponse.json(
      { error: "Bordroya yalnız Yönetici ve Müdür erişebilir." },
      { status: 403 }
    );
  }

  const p = request.nextUrl.searchParams;
  const kisi = (p.get("kisi") ?? "").trim();
  const hepsi = p.get("hepsi") === "1";
  const donemHam = (p.get("donem") ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])/.test(donemHam)) {
    return NextResponse.json(
      { error: "Geçersiz adres: dönem gerekli (?donem=yyyy-aa)." },
      { status: 400 }
    );
  }
  if (!hepsi && !/^[0-9a-fA-F-]{36}$/.test(kisi)) {
    return NextResponse.json(
      { error: "Geçersiz adres: kişi gerekli (?kisi=…) ya da toplu indirme için &hepsi=1." },
      { status: 400 }
    );
  }
  const donem = donemHam.slice(0, 7);
  const yil = donem.slice(0, 4);

  const bugun = todayIso();
  const [employees, yilSatirlari, paramRows, st] = await Promise.all([
    loadEmployees(supabase, bugun),
    // YILIN TAMAMI: kümülatif matrah ocaktan itibaren hesaplanır.
    loadPayroll(supabase, kisi && !hepsi ? { employeeId: kisi } : {}),
    loadPayrollParams(supabase),
    getReportSettings(supabase),
  ]);

  const ayar = { ...DEFAULT_REPORT_SETTINGS, ...st };
  const params: PayrollParams[] = paramRows.map((r) => ({ ...r, brackets: r.brackets }));
  const donemParam = gecerliParametre(params, donem);

  const kisiHarita = new Map(employees.map((e) => [e.id, e]));
  const oDonem = yilSatirlari.filter((r) => r.period === donem);
  const hedefler = hepsi ? oDonem : oDonem.filter((r) => r.employeeId === kisi);

  if (hedefler.length === 0) {
    return NextResponse.json(
      {
        error: hepsi
          ? `${periodLabelUpper(donem)} dönemine ait maaş kaydı yok.`
          : `Bu personelin ${periodLabelUpper(donem)} dönemine ait maaş kaydı yok.`,
      },
      { status: 404 }
    );
  }

  function pusula(row: PayrollRow, emp: EmployeeRow): PayslipProps {
    // Kümülatif KİŞİ BAŞINA ve YILIN BAŞINDAN hesaplanır.
    const kisiYil = yilSatirlari.filter(
      (r) => r.employeeId === row.employeeId && r.period.slice(0, 4) === yil
    );
    const bordro = donemParam ? (yilKumulatifi(kisiYil, donemParam).get(donem) ?? null) : null;
    // Kıdem başlangıcı EN ESKİ dönemin başlangıcıdır: kişi ayrılıp döndüyse
    // pusulada ilk işe giriş görünmelidir (`employment` yeniden eskiye sıralı).
    const ilkGiris =
      emp.employment.length > 0 ? emp.employment[emp.employment.length - 1].startDate : null;
    return {
      employee: {
        fullName: emp.fullName,
        employeeNo: emp.employeeNo,
        nationalId: emp.nationalId,
        title: emp.title,
        department: emp.department,
        sgkNo: emp.sgkNo,
        iban: emp.iban,
        bankName: emp.bankName,
        hireDate: ilkGiris,
      },
      payroll: {
        netSalary: row.netSalary,
        overtimeHours50: row.overtimeHours50,
        overtimeHours100: row.overtimeHours100,
        overtimeAmount: row.overtimeAmount,
        bonus: row.bonus,
        perDiem: row.perDiem,
        advance: row.advance,
        deduction: row.deduction,
        workedDays: row.workedDays,
        paidOn: row.paidOn,
        note: row.note,
      },
      period: donem,
      company: {
        company: ayar.company,
        address: ayar.address || ayar.city,
        phone: ayar.phone,
        email: ayar.email,
        web: ayar.web,
      },
      bordro,
      params: donemParam,
    };
  }

  if (hepsi) {
    // Sıra kategori + ad: elli sayfalık desteyi elden dağıtan kişi listeyi
    // ekrandakiyle aynı düzende görmelidir.
    const sirali = [...hedefler].sort((a, b) => {
      const ka = kisiHarita.get(a.employeeId);
      const kb = kisiHarita.get(b.employeeId);
      return (
        (ka?.category ?? "").localeCompare(kb?.category ?? "", "tr") ||
        (ka?.fullName ?? "").localeCompare(kb?.fullName ?? "", "tr")
      );
    });
    const items = sirali
      .map((r) => {
        const emp = kisiHarita.get(r.employeeId);
        return emp ? pusula(r, emp) : null;
      })
      .filter((x): x is PayslipProps => x !== null);

    const govde = await renderPayslipBatchPdf(items);
    const ad = downloadFileName(
      ["Orion", payslipDocCode(donem), "Bordrolar", periodLabelUpper(donem)],
      "pdf"
    );
    return pdfYaniti(govde, ad);
  }

  const row = hedefler[0];
  const emp = kisiHarita.get(row.employeeId);
  if (!emp) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });

  const govde = await renderPayslipPdf(pusula(row, emp));
  const ad = downloadFileName([emp.fullName, payslipDocCode(donem), "Bordro"], "pdf");
  return pdfYaniti(govde, ad);
}

/**
 * Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
 * gider, ASCII yedek eski istemciler içindir.
 */
function pdfYaniti(govde: Buffer, dosyaAdi: string): NextResponse {
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new NextResponse(new Uint8Array(govde), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}
