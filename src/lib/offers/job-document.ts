// İşler ve Mühendislik içinde gösterilen FİYATSIZ teklif kopyası.
//
// Müşteriye giden teklif payload'ı fiyat, iskonto ve ödeme planı taşır. İşler
// ise bütün personele açıktır. Bu yüzden tam payload hiçbir zaman doğrudan PDF
// motoruna verilmez; önce burada yapısal ticari alanlar sökülür. Veritabanındaki
// `job_offer_document_payload` aynı sınırı RPC cevabından ÖNCE uygular; bu
// fonksiyon rota tarafındaki ikinci savunmadır ve eski/elle çağrılmış veriyi de
// güvenli şekle getirir.

import { downloadFileName } from "@/lib/pdf/doc-naming";
import { trKatla } from "@/lib/drawings/tr-text";
import { withDefaults } from "./payload";
import type { OfferPayload } from "./types";

const HIDDEN_TERM_KEYS = new Set(["payment", "price", "tax"]);
const COMMERCIAL_TEXT = /(?:FIYAT|BEDEL|ODEME|AVANS|ISKONTO|KDV|PARA BIRIMI|VERGI|BANKA|TEMINAT|VADE|€|[$]|₺|\b(?:EUR|USD|TRY|TL)\b)/;

function hasCommercialText(value: string): boolean {
  return COMMERCIAL_TEXT.test(trKatla(value));
}

export function jobOfferDocumentPayload(raw: unknown, currency = "EUR"): OfferPayload {
  const payload = withDefaults(raw, currency);

  return {
    ...payload,
    cover: {
      ...payload.cover,
      // İmzacı adı/unvanı kalır; özel depodaki imza anahtarı İşler kopyasına
      // geçmez. Böylece bu PDF yolu satış kovasına dolaylı erişim vermez.
      signatories: payload.cover.signatories.map(({ userId: _userId, signaturePath: _path, signatureName: _name, ...entry }) => {
        void _userId;
        void _path;
        void _name;
        return entry;
      }),
    },
    terms: {
      ...payload.terms,
      title: "TESLİM VE DİĞER ŞARTLAR",
      rows: payload.terms.rows.filter(
        (row) =>
          !HIDDEN_TERM_KEYS.has(row.key.trim().toLocaleLowerCase("tr-TR")) &&
          !hasCommercialText(`${row.key} ${row.label}`)
      ),
      paymentLines: [],
    },
    pricing: {
      currency: payload.pricing.currency || currency,
      vatIncluded: false,
      leadTimeUnit: null,
      lines: [],
      discountTotal: null,
      total: null,
    },
    // Serbest notlarda da bedel yazılabilir. Yapı sabit olmadığı için yalnız
    // pricing nesnesini boşaltmak yeterli değildir; ticari işaret taşıyan not
    // İşler kopyasına hiç girmez. Teknik notlar korunur.
    notes: payload.notes.filter((note) => !hasCommercialText(note.text)),
    generalTerms: payload.generalTerms.filter(
      (term) =>
        !HIDDEN_TERM_KEYS.has(term.key.trim().toLocaleLowerCase("tr-TR")) &&
        !hasCommercialText(`${term.key} ${term.title}`)
    ),
    hiddenSections: [...new Set([...payload.hiddenSections, "pricing" as const])],
  };
}

export function jobOfferDocumentFileName(
  jobNo: string,
  offerNo: string,
  revisionNo: number
): string {
  const revision = revisionNo > 0 ? `REV ${String(revisionNo).padStart(2, "0")}` : null;
  return downloadFileName([jobNo, "Teklif Dokümanı", offerNo, revision]);
}
