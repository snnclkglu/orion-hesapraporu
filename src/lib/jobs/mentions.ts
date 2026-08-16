// Yorum gövdesindeki @AD SOYAD anmaları — saf yardımcılar.
//
// Gövde DÜZ METİNDİR ve anma `@AD SOYAD` yazımıyla içinde durur; kimlikler
// `job_comments.mentions` uuid[] sütununda taşınır. Bu dosya iki soruyu
// cevaplar: (a) kayıt anında gövdede KİM anılıyor (`extractMentionIds` —
// kullanıcı eklediği anmayı silmiş olabilir, kaynak her zaman SON metindir),
// (b) görüntülerken hangi parçalar vurgulanacak (`splitMentions`).
//
// EŞLEŞME `trKatla` İLEDİR: adlar BÜYÜK saklanır ama yorum yazan kişi
// "@sinan çolakoğlu" yazabilir — düz karşılaştırma Türkçe İ/ı ayrımında düşer.

import { trKatla } from "@/lib/drawings/tr-text";

export interface MentionPerson {
  id: string;
  fullName: string;
}

export interface MentionSegment {
  text: string;
  /** Doluysa bu parça bir anmadır ve vurgulanır. */
  personId?: string;
}

/**
 * Gövdeyi anma/metin parçalarına böler.
 *
 * Adlar UZUNDAN KISAYA denenir: listede hem "AHMET" hem "AHMET YILMAZ" varsa
 * "@AHMET YILMAZ" uzun ada bağlanmalıdır — kısa ad önce denenseydi kalan
 * " YILMAZ" düz metne düşer ve anma ikiye bölünürdü.
 */
export function splitMentions(
  body: string,
  people: readonly MentionPerson[]
): MentionSegment[] {
  const adaylar = people
    .filter((p) => p.fullName.trim())
    .sort((a, b) => b.fullName.length - a.fullName.length);
  if (adaylar.length === 0 || !body.includes("@")) {
    return body ? [{ text: body }] : [];
  }

  const out: MentionSegment[] = [];
  let duz = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@") {
      const kalan = body.slice(i + 1);
      const eslesen = adaylar.find(
        (p) =>
          trKatla(kalan.slice(0, p.fullName.length)) === trKatla(p.fullName)
      );
      if (eslesen) {
        if (duz) {
          out.push({ text: duz });
          duz = "";
        }
        out.push({
          text: body.slice(i, i + 1 + eslesen.fullName.length),
          personId: eslesen.id,
        });
        i += 1 + eslesen.fullName.length;
        continue;
      }
    }
    duz += body[i];
    i += 1;
  }
  if (duz) out.push({ text: duz });
  return out;
}

/**
 * Kayıt anında gövdede GERÇEKTEN anılan kimlikler — tekilleştirilmiş.
 * Composer'ın eklediği liste değil SON METİN esastır: kullanıcı anmayı
 * silmişse kimlik de düşer, yoksa bildirim olmayan bir anmaya giderdi.
 */
export function extractMentionIds(
  body: string,
  people: readonly MentionPerson[]
): string[] {
  const ids = splitMentions(body, people)
    .filter((s) => s.personId)
    .map((s) => s.personId as string);
  return [...new Set(ids)];
}
