// Bildirim fan-out kuralları — SAF çekirdek (DB/HTTP yok).
//
// Kim bildirim alır sorusunun TEK cevap yeri (kullanıcı kararı, 16.08.2026):
// · gorev_atandi   → atanan kişi (atamayı yapan kendisiyse gitmez)
// · bahsedildi     → yorumda anılanlar (yazan hariç)
// · durum_degisti  → işi favorileyenler ∪ o işte AÇIK görevi olanlar
//                    (değiştiren hariç)
// Kurallar action'larda tek tek yazılsaydı biri güncellenirken öteki kalır ve
// aynı olay iki ekranda iki farklı kitleye giderdi; test bu sözleşmeyi dondurur.

export type NotificationKind = "gorev_atandi" | "bahsedildi" | "durum_degisti";

export interface NotifyInput {
  kind: NotificationKind;
  /** İşlemi yapan — kendine bildirim GİTMEZ. */
  actorId: string;
  /** gorev_atandi: atanan kişi. */
  assigneeId?: string | null;
  /** bahsedildi: yorumda anılan kimlikler. */
  mentionIds?: readonly string[];
  /** durum_degisti: işi favorileyenler. */
  favoriteUserIds?: readonly string[];
  /** durum_degisti: işte açık görevi olanlar. */
  openTaskAssigneeIds?: readonly (string | null)[];
}

/** Bildirim GİDECEK kullanıcı kimlikleri — tekilleştirilmiş, aktörsüz. */
export function notifyTargets(input: NotifyInput): string[] {
  const hedefler = new Set<string>();

  switch (input.kind) {
    case "gorev_atandi":
      if (input.assigneeId) hedefler.add(input.assigneeId);
      break;
    case "bahsedildi":
      for (const id of input.mentionIds ?? []) hedefler.add(id);
      break;
    case "durum_degisti":
      for (const id of input.favoriteUserIds ?? []) hedefler.add(id);
      for (const id of input.openTaskAssigneeIds ?? []) {
        if (id) hedefler.add(id);
      }
      break;
  }

  hedefler.delete(input.actorId);
  return [...hedefler];
}
