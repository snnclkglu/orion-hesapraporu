// EL KİTABINA GİDEN PANO ŞEMALARI (KITAP-22 · PANO-16).
//
// El kitabı şemayı DONMUŞ alır: ekleme anında çözülür ve belgeye yazılır.
// Canlı olsaydı teslim edilmiş bir kılavuz, elektrik projesi yeniden
// okunduğunda (ELEKTRIK-6: satırlar silinip yeniden üretilir) sessizce başka
// bir panoyu anlatırdı.
//
// Katalog SAF tutuldu ki sınanabilsin — uç dosyası `server-only`dir ve içine
// yazılan bir mantık hiçbir testten geçemezdi. Buradaki asıl ölçüt: LİSTEDE
// GÖRÜNEN HER ŞEMA GERÇEKTEN ÇİZİLEBİLMELİ. Seçilebilir görünüp boş dönen bir
// satır, hiç göstermemekten kötüdür.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import { KITAP_OLCEGI, panoSemaKatalogu } from "../panoKitap";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+LVD1-F1",
    installation: "T1",
    location: "LVD1",
    device: "F1",
    qty: 1,
    designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
    typeNo: "5SL6310-7",
    supplier: "Siemens",
    partNo: "SIE.5SL6310-7",
    page: 1,
    ...over,
  };
}

function salterler(n: number, konum: string): ElectricalPart[] {
  return Array.from({ length: n }, (_, i) =>
    parca({ location: konum, device: `F${i + 1}`, deviceTag: `=T1+${konum}-F${i + 1}` })
  );
}

const KAPAKLI = parca({
  location: "LVD1",
  device: "S1",
  deviceTag: "=T1+LVD1-S1",
  designation: "Harmony Stil 4 - Metal series XB4 - Emergency Stop",
  typeNo: "XB4BS8442",
  supplier: "SE",
  partNo: "SE.XB4BS8442",
});

describe("pano şema katalogu", () => {
  it("oda ve saha dizisi için birer dizilim şeması verir", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(4, "LVD1"), ...salterler(4, "TB1")],
    });
    const anahtarlar = panoSemaKatalogu(sonuc).map((x) => x.kayit.key);
    expect(anahtarlar).toContain("pano:oda");
    expect(anahtarlar).toContain("pano:saha");
  });

  it("SAHA DİZİSİ YOKSA o şema listeye GİRMEZ", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(4, "LVD1") });
    expect(sonuc.field).toHaveLength(0);
    const anahtarlar = panoSemaKatalogu(sonuc).map((x) => x.kayit.key);
    expect(anahtarlar).toContain("pano:oda");
    expect(anahtarlar).not.toContain("pano:saha");
  });

  it("KAPAK ELEMANI OLMAYAN panonun kapak görünüşü listeye GİRMEZ", () => {
    // `panoKapakDiagram` zaten `null` döner; boş bir kapak resmi bilgi
    // taşımaz ve seçilebilir görünmemeli.
    const kapaksiz = computeSwitchboardLayout({ parts: salterler(4, "LVD1") });
    expect(panoSemaKatalogu(kapaksiz).map((x) => x.kayit.key)).not.toContain(
      "pano:kapak:LVD1"
    );

    const kapakli = computeSwitchboardLayout({ parts: [...salterler(4, "LVD1"), KAPAKLI] });
    expect(panoSemaKatalogu(kapakli).map((x) => x.kayit.key)).toContain("pano:kapak:LVD1");
  });

  it("her pano için bir iç yerleşim şeması vardır", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(4, "LVD1"), ...salterler(4, "LVD2")],
    });
    const anahtarlar = panoSemaKatalogu(sonuc).map((x) => x.kayit.key);
    for (const p of sonuc.room) expect(anahtarlar).toContain(`pano:ic:${p.code}`);
  });

  it("LİSTEDEKİ HER ŞEMA GERÇEKTEN ÇİZİLİR", () => {
    // Kataloğun tek sözü budur: gösterdiğin her satır seçilince bir model
    // vermeli. Boş dönen bir satır kullanıcıyı yanıltır.
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(6, "LVD1"), KAPAKLI, ...salterler(3, "TB1")],
    });
    const katalog = panoSemaKatalogu(sonuc);
    expect(katalog.length).toBeGreaterThan(3);
    for (const x of katalog) {
      const d = x.ciz();
      expect(d, `${x.kayit.key} çizilemedi`).not.toBeNull();
      expect(d?.els.length, `${x.kayit.key} boş`).toBeGreaterThan(0);
      expect(d?.width).toBeGreaterThan(0);
      expect(d?.height).toBeGreaterThan(0);
    }
  });

  it("anahtarlar BENZERSİZDİR", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(4, "LVD1"), KAPAKLI, ...salterler(4, "TB1")],
    });
    const anahtarlar = panoSemaKatalogu(sonuc).map((x) => x.kayit.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("kayıt el kitabı seçicisinin beklediği alanları taşır", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(4, "LVD1") });
    for (const { kayit } of panoSemaKatalogu(sonuc)) {
      expect(kayit.key).toBeTruthy();
      expect(kayit.baslik).toBeTruthy();
      expect(kayit.modul).toBe("Pano Yerleşimi");
      expect(kayit.bolum).toBeTruthy();
    }
  });

  it("ÇİZİM YOKSA katalog BOŞTUR — boş bir liste hata değildir", () => {
    // Yalnız saha aygıtı olan bir iş: hiçbir pano açılmaz.
    const sonuc = computeSwitchboardLayout({
      parts: [
        parca({
          device: "M1",
          deviceTag: "=T1+LVD1-M1",
          designation: "Cast iron motor 5.5kW, 1430rpm",
          typeNo: "AGM 132 M 6B",
          supplier: "GAM",
          partNo: "GAM.AGM132",
        }),
      ],
    });
    expect(panoSemaKatalogu(sonuc)).toEqual([]);
  });

  it("EL KİTABI ÖLÇEĞİ 1:4'tür ve çizime GEÇER", () => {
    // Kılavuzu okuyan bakımcı panonun tamamını bir sayfada görmek ister.
    expect(KITAP_OLCEGI).toBe(4);
    const sonuc = computeSwitchboardLayout({ parts: salterler(6, "LVD1") });
    const ic = panoSemaKatalogu(sonuc).find((x) => x.kayit.key.startsWith("pano:ic:"));
    const d = ic?.ciz();
    const metinler = (d?.els ?? [])
      .filter((e): e is Extract<typeof e, { kind: "text" }> => e.kind === "text")
      .map((e) => e.text)
      .join(" ");
    expect(metinler).toContain("ölçek 1:4");
  });
});
