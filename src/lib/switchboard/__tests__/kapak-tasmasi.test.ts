// KAPAĞA SIĞMAYAN AYGIT SESSİZCE DÜŞMEZ (PANO-10).
//
// `kapagaDiz` son satırı taşan cihazda `break` ediyordu: aygıt ne kapak
// resminde, ne kuyrukta, ne uyarıda görünüyordu. Bir aygıtın hiçbir yerde
// görünmemesi bu modülün en çok kaçındığı sonuçtur — 0019'da 494 saha aygıtı
// tam da bu yüzden tek tek sebebiyle kuyruğa yazılıyor.
//
// Kapak ızgarası hâlâ bir KROKİDİR (90 mm kare adım, PANO-22); bu test kesim
// koordinatını değil, TAŞAN AYGITIN GÖRÜNÜRLÜĞÜNÜ sabitler.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "../compute";

function buton(i: number, konum: string): ElectricalPart {
  return {
    deviceTag: `=T1+${konum}-S${i}`,
    installation: "T1",
    location: konum,
    device: `S${i}`,
    qty: 1,
    designation: "PUSH BUTTON, GREEN, 22MM, 1NO",
    typeNo: `XB4BA31-${i}`,
    supplier: "Schneider",
    partNo: `SCH.XB4BA31-${i}`,
    page: 40,
  };
}

describe("kapak taşması", () => {
  // EN KİLİTLİ: kilitli pano BÖLÜNMEZ (`bolerekCoz`), dolayısıyla taşma
  // gerçekten taşma olarak kalır. Kilit olmasaydı sistem panoyu ikiye ayırıp
  // aygıtı yerleştirirdi — istenen davranış odur, bu test ise son çareyi
  // sınar.
  const girdi = {
    parts: Array.from({ length: 40 }, (_, i) => buton(i + 1, "TBK")),
    panelOverrides: [
      {
        code: "TBK",
        name: "",
        kind: "saha" as const,
        widthMm: 400,
        heightMm: 300,
        depthMm: null,
        baseMm: null,
        doorConfig: null,
        widthLocked: true,
        heightLocked: true,
        depthLocked: false,
        orderIndex: null,
        note: "",
      },
    ],
  };

  it("taşan kapak aygıtı KUYRUĞA düşer, yok olmaz", () => {
    const r = computeSwitchboardLayout(girdi);
    const cizilen = r.field.flatMap((p) => p.doorPlacements).length;
    const kuyruk = r.unplaced.filter((u) => u.reason === "sigmadi").length;

    expect(cizilen).toBeGreaterThan(0);
    expect(kuyruk).toBeGreaterThan(0);
    // HİÇBİR AYGIT KAYBOLMAZ: çizilen + kuyruk = kırk buton.
    expect(cizilen + kuyruk).toBe(40);
  });

  it("panonun KENDİ uyarı listesi de söyler", () => {
    const r = computeSwitchboardLayout(girdi);
    const uyari = r.field.flatMap((p) => p.warnings).join(" | ");
    expect(uyari).toContain("kapak yüzeyine sığmadı");
  });
});
