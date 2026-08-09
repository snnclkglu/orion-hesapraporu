// Günlük Giriş — bölümün her gün açılan ekranı.
//
// TASARIM ÖLÇÜTÜ: bir günü kaydetmenin kaç tıklama sürdüğü. Devralınan kayıtta
// bir günün satırlarının %87'si bir önceki iş gününden AYNEN devam ediyor ve
// 381 günün 170'i bir öncekiyle birebir aynı. Yani kullanıcının asıl yaptığı
// iş "dün ne yazdıysam onu tekrar yaz"dı. Ekran bunu iki yoldan tek harekete
// indirir: (1) "Önceki günü kopyala" bütün çizelgeyi taşır, (2) sık kullanılan
// üçlüler tek tıkla satır olur. Yeni bir satır yazmak yine mümkündür ama
// İSTİSNADIR, kural değil.

import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/work-log";
import { DayEntry } from "./day-entry";
import {
  loadCategories,
  loadCodeHints,
  loadDailyTotals,
  loadJobOptions,
  loadParts,
  loadPreviousWorkDay,
  loadRecentCombos,
  loadWorkDay,
} from "./data";

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function WorkLogEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.tarih ?? "";
  // Adres çubuğuna elle yazılan bozuk bir tarih sayfayı çökertmemeli.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayIso();

  const supabase = await createClient();
  const [dayRows, previous, parts, categories, jobs, recent, codeHints, dailyTotals] =
    await Promise.all([
      loadWorkDay(supabase, date),
      loadPreviousWorkDay(supabase, date),
      loadParts(supabase),
      loadCategories(supabase),
      loadJobOptions(supabase),
      loadRecentCombos(supabase, shift(date, -45)),
      loadCodeHints(supabase),
      loadDailyTotals(supabase, shift(date, -20), date),
    ]);

  return (
    <DayEntry
      date={date}
      rows={dayRows}
      previous={previous}
      parts={parts}
      categories={categories}
      jobs={jobs}
      recent={recent}
      codeHints={codeHints}
      dailyTotals={dailyTotals}
    />
  );
}
