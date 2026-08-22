// ÖLÇÜ PARÇALARI DEFTERLE AYRIŞMASIN — kural iki yerde yaşıyor (değişmez md. 8).
//
// `copySelections` (payload.ts) hangi parçanın "seçim" hangisinin "ölçü"
// olduğunu `OLCU_PARCALARI` adlı ELLE YAZILMIŞ bir kümeden okur; defterden
// (`registry.ts`) türetmez. Bu bilinçlidir ve türetilemez de: `power`, `rpm`
// ve `dia` parçaları LİSTELİDİR (`val.motorPower`, `val.motorRpm`,
// `val.wheelDia`) ama gerçekte birer ÖLÇÜDÜR — `list` alanına bakarak
// sınıflandıran bir kural onları "marka tercihi" sanır ve ikinci vincin
// motor gücünü birincininkiyle doldururdu.
//
// Bedeli, kuralın iki yerde yaşamasıdır: defterde yeni bir ölçü parçası
// açıldığında kümeye eklemek UNUTULABİLİR ve sonuç sessizdir — kopyalanan
// kalem, kopyalanmaması gereken bir sayıyı taşır ve kimse fark etmez. Bu test
// o boşluğu kapatır: iki kaynağı da OKUR ve karşılaştırır.

import { describe, expect, it } from "vitest";
import { OLCU_PARCALARI } from "../payload";
import { OFFER_GROUP_DEFS, TERM_ROW_DEFS, TEST_LOAD_ROW_DEFS } from "../registry";
import type { OfferPartDef, OfferRowDef } from "../types";

/** Defterdeki BÜTÜN satır tanımları — grup satırları + sahte gruplar. */
function butunSatirlar(): OfferRowDef[] {
  return [
    ...OFFER_GROUP_DEFS.flatMap((g) => g.rows),
    ...TEST_LOAD_ROW_DEFS,
    ...TERM_ROW_DEFS,
  ];
}

function butunParcalar(): { row: OfferRowDef; part: OfferPartDef }[] {
  return butunSatirlar().flatMap((row) => (row.parts ?? []).map((part) => ({ row, part })));
}

describe("OLCU_PARCALARI ile defter ayrışmaz", () => {
  it("kümedeki her anahtarın defterde GERÇEKTEN bir karşılığı vardır", () => {
    const defterdekiler = new Set(butunParcalar().map(({ part }) => part.key));
    for (const anahtar of OLCU_PARCALARI) {
      expect(defterdekiler.has(anahtar), `OLCU_PARCALARI["${anahtar}"] defterde yok`).toBe(true);
    }
  });

  it("SAYISAL ya da TÜRETİLEN her parça kümededir", () => {
    // Bir ölçü parçası defterde açılıp kümeye eklenmezse `copySelections` onu
    // "tercih" sayar ve taşır. Test o unutmayı yakalar.
    for (const { row, part } of butunParcalar()) {
      if (!part.numeric && !part.derived) continue;
      expect(OLCU_PARCALARI.has(part.key), `${row.key}.${part.key} ölçüdür ama kümede yok`).toBe(
        true
      );
    }
  });
});
