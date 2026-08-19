// TEKNİK RESSAM ÖZETİNİN "NOTLAR" BÖLÜMÜ — okuma katmanı.
//
// Not `equipment_drawing_notes` tablosundadır (revizyon snapshot'ında DEĞİL;
// gerekçe migration başlığındadır). İki yüzey birden okur: ekipman paneli
// (ekran) ve indirme ucu (Excel + PDF). Aynı sorguyu iki dosyaya ayrı ayrı
// yazmak, birinin filtresi değiştiğinde ekranla belgenin ayrışması demekti —
// panelde görünen bir notun indirilen dosyada olmaması en sinsi hâlidir.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Belge başına tek not; anahtar bugün yalnız "genel"dir. */
export const DRAWING_NOTE_KEY = "genel";

/**
 * Revizyonun ressam notunu okur. Kayıt yoksa boş dize döner — çağıranlar
 * "not yok" ile "boş not" arasında ayrım yapmaz, ikisi de bölümü açmaz.
 */
export async function loadDrawingNote(
  supabase: SupabaseClient,
  revisionId: string
): Promise<string> {
  const { data } = await supabase
    .from("equipment_drawing_notes")
    .select("note")
    .eq("revision_id", revisionId)
    .eq("note_key", DRAWING_NOTE_KEY)
    .maybeSingle();
  return ((data as { note?: string } | null)?.note ?? "").trim();
}
