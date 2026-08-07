// "Ek Özellikler" notlarının (equipment_notes) revizyondan revizyona taşınması.
//
// Madde 34: yeni bir hesap raporu versiyonuna geçildiğinde ekipman listesine
// yazılmış açıklamalar da gelmelidir. Notlar revizyon snapshot'ının İÇİNDE
// (inputs/selections/results JSONB) değil AYRI bir tabloda durur — gerekçesi
// migration başlığındadır — bu yüzden revizyon kopyalanırken kendiliğinden
// taşınmazlar; kopyalama açıkça yapılır.
//
// Bu modül SAFTIR: veritabanı istemcisi almaz. Çağıran kaynak satırları okur,
// dönüşüm burada yapılır, sonuç çağıran tarafından yazılır. Böylece "hangi not
// taşınır, hangi kimlikle taşınır" kararı birim testine açık kalır.

/** `equipment_notes` tablosundan okunan ham satır. */
export interface EquipmentNoteRow {
  row_key: string;
  note: string;
}

/** `equipment_notes` tablosuna yazılacak satır. */
export interface EquipmentNoteInsert {
  revision_id: string;
  row_key: string;
  note: string;
  updated_by: string | null;
}

/**
 * Kaynak revizyonun notlarını hedef revizyona yeniden etiketler.
 *
 * - `row_key` DEĞİŞMEZ: anahtar ekipman satırının kararlı kimliğidir
 *   (`<modulKey>:<slug>`), revizyona bağlı değildir; not bu sayede yeni
 *   revizyonda aynı satıra oturur.
 * - Boş not taşınmaz: kaynakta içeriği silinmiş bir notun hedefte boş satır
 *   olarak dirilmesi tabloyu şişirir, görünen sonucu değiştirmez.
 * - Tekrar eden `row_key` bir kez alınır: hedefte birincil anahtar
 *   (revision_id, row_key) olduğu için çift satır toplu insert'i düşürürdü.
 */
export function notesForRevision(
  rows: EquipmentNoteRow[] | null | undefined,
  targetRevisionId: string,
  actorId?: string | null
): EquipmentNoteInsert[] {
  if (!rows || rows.length === 0) return [];
  const gorulen = new Set<string>();
  const sonuc: EquipmentNoteInsert[] = [];
  for (const r of rows) {
    const rowKey = (r?.row_key ?? "").trim();
    const note = (r?.note ?? "").trim();
    if (rowKey === "" || note === "") continue;
    if (gorulen.has(rowKey)) continue;
    gorulen.add(rowKey);
    sonuc.push({
      revision_id: targetRevisionId,
      row_key: rowKey,
      note,
      updated_by: actorId ?? null,
    });
  }
  return sonuc;
}
