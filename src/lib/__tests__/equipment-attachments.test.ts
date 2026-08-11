// "Ek Belge" — sıralama ve özet metni.
//
// SIRA BİR SÖZLEŞMEDİR: `orderAttachmentsForAppendix` hangi sırayı üretirse
// ekipman listesi PDF'i kapakları o sırada basar ve `pdfEkleriYerlestir` de
// ekleri o sırayla kapakların ardına koyar. Sıra kayarsa ek YANLIŞ EKİPMANIN
// kapağının altına düşer ve bunu hiçbir tip hatası yakalamaz.

import { describe, expect, it } from "vitest";
import { attachmentSummaryText, type EqGroup } from "@/lib/excel/equipment";
import {
  attachmentsByRowKey,
  orderAttachmentsForAppendix,
  type EquipmentAttachmentRow,
} from "@/lib/equipment-attachments";

const ek = (
  id: string,
  rowKey: string,
  fileName: string,
  pageCount = 1,
  sort = 0
): EquipmentAttachmentRow => ({
  id,
  rowKey,
  fileName,
  storagePath: `rev/${id}.pdf`,
  pageCount,
  sort,
});

const satir = (rowKey: string | undefined, component: string) => ({
  rowKey,
  component,
  brand: "-",
  model: "-",
  spec: "",
  qty: 1,
});

describe("attachmentsByRowKey", () => {
  it("satır anahtarına göre toplar", () => {
    const map = attachmentsByRowKey([
      ek("1", "main:gearbox", "a.pdf", 2),
      ek("2", "main:gearbox", "b.pdf", 1),
      ek("3", "bridge:wheel", "c.pdf", 4),
    ]);
    expect(map["main:gearbox"]).toHaveLength(2);
    expect(map["bridge:wheel"][0].pageCount).toBe(4);
  });

  it("anahtarsız satırı atar", () => {
    expect(attachmentsByRowKey([ek("1", "", "a.pdf")])).toEqual({});
  });
});

describe("özet metni", () => {
  it("tek belgede sayfa adedi + dosya adı", () => {
    expect(attachmentSummaryText([{ fileName: "olcu.pdf", pageCount: 3 }])).toBe(
      "3 sayfa · olcu.pdf"
    );
  });

  it("çok belgede ad yerine sayı", () => {
    expect(
      attachmentSummaryText([
        { fileName: "a.pdf", pageCount: 2 },
        { fileName: "b.pdf", pageCount: 1 },
      ])
    ).toBe("2 belge · 3 sayfa");
  });

  it("ek yoksa hücre boştur", () => {
    expect(attachmentSummaryText()).toBe("");
    expect(attachmentSummaryText([])).toBe("");
  });

  it("sayfası okunamamış dosyada sayı iddia etmez", () => {
    expect(attachmentSummaryText([{ fileName: "a.pdf", pageCount: 0 }])).toBe(
      "sayfa okunamadı · a.pdf"
    );
  });
});

describe("ek sırası listeyi izler", () => {
  const groups: EqGroup[] = [
    {
      name: "Ana Kaldırma",
      rows: [satir("main:rope", "Çelik Halat"), satir("main:gearbox", "Redüktör")],
    },
    { name: "Köprü Yürütme", rows: [satir("bridge:wheel", "Teker")] },
  ];

  it("tablo sırasına dizer, yükleme sırasına değil", () => {
    const sirali = orderAttachmentsForAppendix(groups, [
      ek("3", "bridge:wheel", "teker.pdf"),
      ek("1", "main:gearbox", "reduktor.pdf"),
      ek("2", "main:rope", "halat.pdf"),
    ]);
    expect(sirali.map((a) => a.fileName)).toEqual([
      "halat.pdf",
      "reduktor.pdf",
      "teker.pdf",
    ]);
  });

  it("kapakta listedeki ekipman adı yazar", () => {
    const [ilk] = orderAttachmentsForAppendix(groups, [ek("1", "main:gearbox", "a.pdf")]);
    expect(ilk.component).toBe("Redüktör");
  });

  it("aynı satırın birden çok eki kendi sırasını korur", () => {
    const sirali = orderAttachmentsForAppendix(groups, [
      ek("1", "main:rope", "birinci.pdf", 1, 0),
      ek("2", "main:rope", "ikinci.pdf", 1, 1),
    ]);
    expect(sirali.map((a) => a.fileName)).toEqual(["birinci.pdf", "ikinci.pdf"]);
  });

  it("alternatif satır aynı anahtarı taşısa da ek İKİ KEZ basılmaz", () => {
    const altLi: EqGroup[] = [
      {
        name: "Ana Kaldırma",
        rows: [
          satir("main:gearbox", "Redüktör"),
          { ...satir("main:gearbox", "Redüktör"), alt: 2 },
        ],
      },
    ];
    expect(orderAttachmentsForAppendix(altLi, [ek("1", "main:gearbox", "a.pdf")])).toHaveLength(1);
  });

  it("listede karşılığı olmayan ek basılmaz", () => {
    // Satır artık listede yoksa (vinç yapılandırması değişmiş) kapağı da
    // olmamalıdır; aksi hâlde deste hiçbir ekipmana bağlanmayan sayfa taşır.
    expect(orderAttachmentsForAppendix(groups, [ek("1", "aux:drum", "a.pdf")])).toHaveLength(0);
  });
});
