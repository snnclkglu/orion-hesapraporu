// İşler Excel indirme ucu.
//
// Süzgeçler ADRESTEN okunur ve ekranla AYNI saf fonksiyonlardan geçirilir
// (`lib/jobs/view-state.ts` + `lib/jobs/filter.ts`): indirilen dosya ile
// ekrandaki tablo hiçbir koşulda ayrışmaz (İş Takibi ucunun kalıbı).
//
// ROL KAPISI YOKTUR: /jobs herkese açıktır (lib/roles.ts, kime: "Herkes") ve
// bu döküm fiyat/ticari alan taşımaz. Oturum yine şarttır.
//
// DOSYA ADINDA TARİH VE SAAT vardır: aynı süzgeçle alınmış iki dosya klasörde
// birbirini ezmez.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildJobsWorkbook } from "@/lib/excel/jobs";
import { downloadName } from "@/lib/work-log";
import { bugunIstanbul } from "@/app/(app)/panel/data";
import {
  describeJobFilters,
  jobDate,
  son12AyBaslangici,
  jobYear,
  matchesJobFilters,
  sortJobs,
  type JobListRow,
} from "@/lib/jobs/filter";
import { readJobsViewState, resolveYear } from "@/lib/jobs/view-state";

export const runtime = "nodejs";

/** Gömülü ilişki tekil ya da dizi dönebilir; ikisini de karşıla. */
function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Liste sayfasıyla aynı sorgu: sayımlar gömülü dizi değil COUNT ile gelir.
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      `id, job_no, title, customer, status, work_order_date, created_at,
       customers(short_name, color_hue), job_items(count), projects(count)`
    )
    .order("created_at", { ascending: false });
  if (error) return new Response("Liste okunamadı", { status: 500 });

  const rows: JobListRow[] = (jobs ?? []).map((j) => {
    const book = one<{ short_name: string | null }>(j.customers as unknown);
    return {
      job_no: j.job_no,
      title: j.title,
      customer: j.customer ?? "",
      customerShort: book?.short_name ?? null,
      status: j.status,
      work_order_date: j.work_order_date ?? null,
      created_at: j.created_at,
      itemCount: one<{ count: number }>(j.job_items as unknown)?.count ?? 0,
      craneCount: one<{ count: number }>(j.projects as unknown)?.count ?? 0,
    };
  });

  const state = readJobsViewState(request.nextUrl.searchParams);
  const years = [...new Set(rows.map(jobYear).filter(Boolean))];
  // "Bugün" İstanbul saatiyledir: Vercel UTC'de koşar ve gece 00:00–03:00
  // arasında UTC yılbaşı sapması dönem süzgecini bir gün/yıl kaydırırdı.
  const bugun = bugunIstanbul().slice(0, 10);
  const thisYear = bugun.slice(0, 4);
  // Varsayılan dönem SON 12 AYDIR ve ekranla AYNI kuraldan geçer (`resolveYear`
  // + `son12Dolu`): iki taraf ayrı hesaplasaydı indirilen dosya ile ekrandaki
  // tablo sessizce ayrışırdı — bu dosyanın başındaki sözleşmenin ta kendisi.
  const son12Alt = son12AyBaslangici(bugun);
  const son12Dolu = rows.some((r) => {
    const t = jobDate(r);
    return t !== "" && t >= son12Alt;
  });
  const filterInput = {
    yil: resolveYear(state.yil, years, thisYear, son12Dolu),
    musteri: state.musteri,
    durum: state.durum,
    q: state.q,
    bugun,
  };
  const filtered = sortJobs(
    rows.filter((r) => matchesJobFilters(r, filterInput)),
    state.sirala
  );

  const now = new Date();
  const workbook = buildJobsWorkbook(filtered, {
    filterText: describeJobFilters(filterInput),
    generatedAt: now.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
    preparedBy: profile?.full_name || user.email || "",
  });

  const raw = await workbook.xlsx.writeBuffer();
  const body = new Uint8Array(raw as ArrayBuffer);
  const filename = downloadName("ORION İşler", "xlsx", now);
  // Türkçe karakterli ad iki kez yazılır: eski istemciler için ASCII'ye
  // indirgenmiş hâli, modern istemciler için UTF-8 kodlanmış hâli.
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}
