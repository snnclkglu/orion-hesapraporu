// Ekipman notlarının revizyondan revizyona taşınması (madde 34).
// Kopyalama gerçekten çalışıyor mu — dönüşümün kendisi burada sınanır;
// çağrı yolu `projects/actions.ts` içindeki `copyEquipmentNotes`tir.

import { describe, expect, it } from "vitest";
import { notesForRevision } from "./notes";

const YENI = "22222222-2222-4222-8222-222222222222";
const KULLANICI = "33333333-3333-4333-8333-333333333333";

describe("notesForRevision", () => {
  it("notu hedef revizyona taşır, satır anahtarını korur", () => {
    const sonuc = notesForRevision(
      [
        { row_key: "main:rope", note: "Galvanizli tercih edilecek" },
        { row_key: "bridge:wheel", note: "Müşteri rayı Ø60" },
      ],
      YENI,
      KULLANICI
    );
    expect(sonuc).toEqual([
      {
        revision_id: YENI,
        row_key: "main:rope",
        note: "Galvanizli tercih edilecek",
        updated_by: KULLANICI,
      },
      {
        revision_id: YENI,
        row_key: "bridge:wheel",
        note: "Müşteri rayı Ø60",
        updated_by: KULLANICI,
      },
    ]);
  });

  it("boş ve yalnız boşluktan oluşan notları taşımaz", () => {
    const sonuc = notesForRevision(
      [
        { row_key: "main:drum", note: "" },
        { row_key: "main:motor", note: "   " },
        { row_key: "main:brake", note: " İki fren " },
      ],
      YENI
    );
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0]).toMatchObject({ row_key: "main:brake", note: "İki fren" });
  });

  it("aynı satır anahtarını bir kez taşır (birincil anahtar çakışmasın)", () => {
    const sonuc = notesForRevision(
      [
        { row_key: "main:rope", note: "ilk" },
        { row_key: "main:rope", note: "ikinci" },
      ],
      YENI
    );
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].note).toBe("ilk");
  });

  it("kaynak notu yoksa boş liste döner (kopyalama sessizce geçilir)", () => {
    expect(notesForRevision(null, YENI)).toEqual([]);
    expect(notesForRevision(undefined, YENI)).toEqual([]);
    expect(notesForRevision([], YENI)).toEqual([]);
  });

  it("kullanıcı verilmezse updated_by null yazılır", () => {
    const sonuc = notesForRevision([{ row_key: "aux:hook", note: "x" }], YENI);
    expect(sonuc[0].updated_by).toBeNull();
  });
});
