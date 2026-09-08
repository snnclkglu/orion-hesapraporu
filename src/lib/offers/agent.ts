// Harici agent'ın görebildiği ve yazabildiği teklif payload sınırı.
//
// Taslak metnin tamamı agent işi için gereklidir; özel imza kovasının yolu ve
// kullanıcı profil kimliği değildir. Bu alanları yalnız yanıttan silmek yetmez:
// PUT sırasında mevcut sunucu değeri geri takılır ki agent onları silemesin,
// değiştiremesin veya başka bir iç depo yolunu enjekte edemesin.

import { withDefaults } from "./payload";
import type { OfferPayload } from "./types";

/** İmzacı adı/unvanı görünür; iç profil ve özel depo alanları görünmez. */
export function offerPayloadForAgent(raw: unknown, currency = "EUR"): OfferPayload {
  const payload = withDefaults(raw, currency);
  return {
    ...payload,
    cover: {
      ...payload.cover,
      signatories: payload.cover.signatories.map((signatory) => ({
        name: signatory.name,
        title: signatory.title,
      })),
    },
  };
}

/** Agent'ın gönderdiği imza alanlarını yok sayıp sunucudaki hâli korur. */
export function preserveAgentProtectedOfferFields(
  submitted: unknown,
  current: unknown,
  currency = "EUR"
): OfferPayload {
  const next = withDefaults(submitted, currency);
  const existing = withDefaults(current, currency);
  return {
    ...next,
    cover: {
      ...next.cover,
      signatories: existing.cover.signatories,
    },
  };
}
