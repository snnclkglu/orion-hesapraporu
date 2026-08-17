// ÖNERİ ALTYAPISI — bugün BOŞ, yeri bugünden hazır.
//
// Kullanıcı kararı (17.08.2026): *"Başlangıç olarak vinci örneğin motor gücünü
// halatını ben seçerim. Ama hedefim bunu kısa ve hızlı hesaplarla otomatize
// eden ve bana öneren bir sistem yaratmak … Şimdilik değil ama sonrasında
// eklenecek. Sistem buna uygun olsun."*
//
// DEFTER BOŞ BAŞLAR ve bu bir eksiklik değil bir kuraldır (`job_task_templates`
// ile aynı gerekçe, değişmez md. 4): uydurma bir motor gücü önerisi, elle
// yazılmış doğru bir değerden daha tehlikelidir — kullanıcı onu bir hesap
// sanır. Gerçek bağıntı geldiğinde YALNIZ BU DOSYA dolar; editör, PDF ve
// belge modeli hiç değişmez.
//
// KANCA `OfferRow.source`TADIR: bir satırın değeri elle mi yazıldı, katalogdan
// mı geldi, önerildi mi — bu ayrım bugün de kaydediliyor. Öneri açıldığında
// "hangi satırlara dokunabilirim" sorusunun cevabı zaten veride olacak.

import type { OfferItem, OfferRow } from "./types";

/**
 * Önerinin girdisi: kalemin KÜNYESİ.
 *
 * Öneri, basılan teknik özellik satırlarını OKUMAZ. Okusaydı kendi ürettiği
 * metni geri ayrıştırmak zorunda kalırdı ("30.000 kg / 5.000 kg" → 30 t) ve
 * yazım her değiştiğinde öneri sessizce bozulurdu. Künye ise sayıdır.
 */
export interface OfferItemBasics {
  craneType: string;
  capacityT: number | null;
  spanM: number | null;
  liftHeightM: number | null;
  liftSpeedMpm: number | null;
  craneClass: string;
}

export function itemBasics(item: OfferItem): OfferItemBasics {
  return {
    craneType: item.craneType ?? "",
    capacityT: item.capacityT ?? null,
    spanM: item.spanM ?? null,
    liftHeightM: null,
    liftSpeedMpm: null,
    craneClass: "",
  };
}

/**
 * Bir satır için öneri üreten fonksiyon. `null` döndürmek "bu girdilerle bir
 * şey söyleyemem" demektir ve satır elle doldurulmaya açık kalır — boş bir
 * öneri, yanlış bir öneriden iyidir.
 */
export type OfferSuggester = (basics: OfferItemBasics) => Partial<OfferRow> | null;

/**
 * Anahtar biçimi `<grupAnahtarı>.<satırAnahtarı>` — `mainHoist.motor` gibi.
 * Aynı satır anahtarı farklı gruplarda farklı bağıntıyla dolar (kaldırma
 * motoru ile köprü yürütme motoru aynı formülden çıkmaz).
 */
export const OFFER_SUGGESTERS: Record<string, OfferSuggester> = {};

export function suggesterFor(groupKey: string, rowKey: string): OfferSuggester | undefined {
  return OFFER_SUGGESTERS[`${groupKey}.${rowKey}`];
}

/** Bugün hiçbir satır önerilmiyor; ekran öneri düğmesini bu soruyla çizer. */
export function hasSuggestion(groupKey: string, rowKey: string): boolean {
  return suggesterFor(groupKey, rowKey) !== undefined;
}
