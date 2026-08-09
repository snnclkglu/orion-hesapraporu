// İş Takibi Excel indirme ucu.
//
// Süzgeçler ADRESTEN okunur ve ekranla AYNI saf fonksiyonlardan geçirilir
// (`filters.ts`): indirilen dosya ile ekrandaki tablo hiçbir koşulda
// ayrışmaz. Tarih aralığı sunucuda kesilir, kalan süzgeçler bellekte
// uygulanır — bu, ekrandaki sıralamanın birebir aynısıdır.
//
// DOSYA ADINDA TARİH VE SAAT vardır (kullanıcı isteği): aynı süzgeçle
// alınmış iki dosya klasörde birbirini ezmez ve hangisinin yeni olduğu ada
// bakılarak anlaşılır.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSeeWorkLog } from "@/lib/roles";
import { buildWorkLogWorkbook } from "@/lib/excel/work-log";
import { downloadName } from "@/lib/work-log";
import { loadWorkLogs } from "../data";
import { describeFilters, filtersFromQuery, matchesFilters } from "../filters";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const me = profile as { role: string; full_name: string } | null;
  if (!canSeeWorkLog(me?.role)) return new Response("Yetki yok", { status: 403 });

  const filters = filtersFromQuery(request.nextUrl.searchParams);
  const rows = (await loadWorkLogs(supabase, { from: filters.from, to: filters.to })).filter((r) =>
    matchesFilters(r, filters)
  );

  const now = new Date();
  const workbook = buildWorkLogWorkbook(rows, {
    filterText: describeFilters(filters),
    generatedAt: now.toLocaleString("tr-TR"),
    preparedBy: me?.full_name || user.email || "",
  });

  const raw = await workbook.xlsx.writeBuffer();
  const body = new Uint8Array(raw as ArrayBuffer);
  const filename = downloadName("ORION İş Takibi", "xlsx", now);
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
