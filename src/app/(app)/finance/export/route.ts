// Personel ve Maaş Excel ucu — `?ay=yyyy-aa` verilirse tek ay, verilmezse
// bütün dönemler.
//
// Veri Finans'ın KENDİ okuma katmanından gelir (`../data.ts`): ekrandaki tablo
// ile indirilen dosya ayrışamaz. İki sorgu yazmanın bedeli bu projede bir kez
// ödendi (`worklog/filters.ts` başlığı).
//
// YETKİ BURADA DA SORULUR. RLS zaten keser ama BOŞ bir Excel indirmek
// "yetkiniz yok" demekten çok daha kafa karıştırıcıdır.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSeeFinance } from "@/lib/roles";
import { buildPayrollWorkbook } from "@/lib/excel/payroll";
import { periodLabel } from "@/lib/finance/payroll";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { todayIso } from "@/lib/work-log";
import { loadEmployees, loadPayroll, loadPeriods } from "../data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const me = profile as { role?: string; full_name?: string } | null;
  if (!canSeeFinance(me?.role)) {
    return NextResponse.json(
      { error: "Personel ve maaş dosyasına yalnız Yönetici ve Müdür erişebilir." },
      { status: 403 }
    );
  }

  const ayHam = (request.nextUrl.searchParams.get("ay") ?? "").trim();
  // Adres çubuğuna elle yazılan bozuk bir ay uca 500 attırmaz; süzgeç düşer.
  const ay = /^\d{4}-(0[1-9]|1[0-2])$/.test(ayHam) ? ayHam : "";

  const bugun = todayIso();
  const [employees, payroll, periods] = await Promise.all([
    loadEmployees(supabase, bugun),
    loadPayroll(supabase, ay ? { period: ay } : {}),
    loadPeriods(supabase),
  ]);

  const govde = await buildPayrollWorkbook({
    employees,
    payroll,
    periods,
    bugun,
    meta: {
      filterText: ay ? periodLabel(ay) : "tüm dönemler",
      generatedAt: new Date().toLocaleString("tr-TR"),
      preparedBy: me?.full_name ?? "",
    },
  });

  // Dosya adı TARİH VE SAAT taşır: aynı süzgeçle alınan iki dosya klasörde
  // birbirini ezmez (worklog'daki `downloadName` kuralı).
  const damga = new Date()
    .toLocaleString("sv-SE")
    .replace(/[^0-9]/g, "")
    .slice(0, 12);
  const dosyaAdi = downloadFileName(
    ["Orion", "Personel ve Maaş", ay ? periodLabel(ay) : "Tüm Dönemler", damga],
    "xlsx"
  );
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new NextResponse(govde, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}
