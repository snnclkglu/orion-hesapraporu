// PANO ŞEMASI EL KİTABI SAYFASINA SIĞAR MI? (KITAP-22 · PANO-28)
//
// El kitabına eklenen şema tam genişlikte basılır ve yüksekliği kendi
// ORANINDAN gelir. `lib/pdf/diagram.tsx`in başındaki uyarı ölçülmüş bir hatayı
// anlatıyor: kareye yakın bir çizimde yalnız genişlik verilirse `wrap={false}`
// onu bir sonraki sayfaya iter ve orada da taşar.
//
// Pano şemaları el kitabına yeni girdi ve HESAP ŞEMALARINDAN ÇOK DAHA UZUNLAR:
// 2.000 mm'lik bir panonun iç yerleşimi 1:4'te 682 çizim birimi yüksekliğinde.
// Bu test o oranı gövde yüksekliğine karşı ölçer — bir gün gövde ızgarası ya da
// çizim payları değişirse burada patlar, teslim edilmiş bir kılavuzda değil.
//
// ÖLÇÜLDÜ (08.09.2026): en uzun şema 0019-00'ın 2.000 mm'lik panosunun kapak
// görünüşü, tam genişlikte ~666 pt. Gövde yüksekliği ~700 pt; pay dardı.
//
// ÖLÇÜLDÜ (09.09.2026): kapak görünüşü KALKTI (PANO-37) ve geriye kalan en
// uzun şema — aynı panonun iç yerleşimi — gövdeye TAM GENİŞLİKTE sığıyor.
// Yani bugün hiçbir şema küçültülmüyor. Bu test o durumu SABİTLER: sığdırma
// mantığı yine sınanır (sentetik bir çizimle), ama gerçek şemaların hepsinin
// %100'de kaldığı da yazılıdır — bir gün ızgara ya da paylar değişip şema
// uzarsa fark burada görünür.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import { panoSemaKatalogu } from "@/lib/diagrams/panoKitap";
import {
  MANUAL_GOVDE_YUKSEKLIK,
  TAM_GENISLIK,
  blokOlcusu,
  semaGenisligiYuzdesi,
} from "../pdf-layout";
import type { ManualSourceData } from "../sources";

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

/**
 * EN KÖTÜ DURUM: en yüksek gövde (2000 mm) ve en dar pano (400 mm).
 *
 * Dar pano çizimin GENİŞLİĞİNİ küçültür ama `fitDiagram` bir taban uygular
 * (520 birim), yani oran orada tepe yapar. Yükseklik ise doğrudan gövdeyle
 * büyür. İkisi birleşince en uzun şema çıkar.
 */
const ENKOTU = computeSwitchboardLayout({
  parts: [
    ...Array.from({ length: 5 }, (_, i) =>
      parca({ device: `F${i + 1}`, deviceTag: `=T1+LVD1-F${i + 1}` })
    ),
    parca({
      device: "S1",
      deviceTag: "=T1+LVD1-S1",
      designation: "Harmony Stil 4 - Metal series XB4 - Emergency Stop",
      typeNo: "XB4BS8442",
      supplier: "SE",
      partNo: "SE.XB4BS8442",
    }),
  ],
  settings: { room: { heightMm: 2000 } },
});

describe("pano şeması el kitabı gövdesine sığar", () => {
  it("fikstür gerçekten en kötü durumu kuruyor", () => {
    expect(ENKOTU.roomSize.heightMm).toBe(2000);
    expect(ENKOTU.room[0].widthMm).toBeLessThanOrEqual(500);
    // KAPAK GÖRÜNÜŞÜ ÜRETİLMEZ (PANO-37); cihaz listede kalır.
    expect(ENKOTU.room[0].doorPlacements).toHaveLength(0);
    expect(ENKOTU.room[0].bodyDevices.map((d) => d.mountType)).toContain("kapak");
  });

  it("SIĞDIRMA MANTIĞI gerçekten çalışıyor — sentetik uzun çizimle", () => {
    // Sorunu kanıtlamadan çözümü çivilemek gereksiz bir kural bırakmak olurdu.
    // Bugün gerçek şemaların hepsi sığdığı için taşan bir çizim ELDE ÜRETİLİR:
    // ölçülen şey `semaGenisligiYuzdesi`nin sözleşmesidir, o günkü fikstürün
    // rastlantısal boyu değil.
    const uzun = { width: 520, height: 2000, els: [] };
    expect((TAM_GENISLIK * uzun.height) / uzun.width).toBeGreaterThan(
      MANUAL_GOVDE_YUKSEKLIK
    );
    const pct = semaGenisligiYuzdesi(uzun);
    expect(pct).toBeLessThan(100);
    expect((TAM_GENISLIK * (pct / 100) * uzun.height) / uzun.width).toBeLessThanOrEqual(
      MANUAL_GOVDE_YUKSEKLIK
    );
  });

  it("SIĞDIRILMIŞ yüzdeyle hiçbir şema gövdeyi aşmaz", () => {
    for (const x of panoSemaKatalogu(ENKOTU)) {
      const d = x.ciz();
      expect(d, x.kayit.key).not.toBeNull();
      const diagram = d as NonNullable<typeof d>;
      const pct = semaGenisligiYuzdesi(diagram);
      // GERÇEK YERLEŞİM ÖLÇÜCÜSÜ kullanılır: altyazı ve görsel payı da
      // yüksekliğe girer ve ikinci bir formül yazmak ikisini ayrıştırırdı.
      const olcu = blokOlcusu(
        {
          id: "t",
          kind: "diagram",
          diagramKey: x.kayit.key,
          diagram: { width: diagram.width, height: diagram.height, els: diagram.els },
          caption: x.kayit.baslik,
          widthPct: pct,
        },
        {} as ManualSourceData,
        new Map(),
        true
      );
      expect(
        olcu.h,
        `${x.kayit.key}: %${pct} → ${Math.round(olcu.h)} pt (gövde ${Math.round(
          MANUAL_GOVDE_YUKSEKLIK
        )} pt)`
      ).toBeLessThanOrEqual(MANUAL_GOVDE_YUKSEKLIK);
    }
  });

  it("SIĞAN şema gereksiz KÜÇÜLTÜLMEZ", () => {
    // Dizilim şeması geniş ve alçaktır; ona dokunmak çizimi okunmaz yapardı.
    const dizilim = panoSemaKatalogu(ENKOTU).find((x) => x.kayit.key === "pano:oda");
    const d = dizilim?.ciz();
    expect(d).toBeTruthy();
    expect(semaGenisligiYuzdesi(d as NonNullable<typeof d>)).toBe(100);
  });

  it("payın ne kadar olduğu GÖRÜNÜR kalır", () => {
    // Bir sınır değil bir ÖLÇÜM: pay daralırsa test hâlâ geçer ama sayı
    // değişir ve bir sonraki okuyan durumu bilir.
    const enDar = Math.min(
      ...panoSemaKatalogu(ENKOTU).map((x) => {
        const d = x.ciz();
        return d ? semaGenisligiYuzdesi(d) : 100;
      })
    );
    // 08.09.2026'da ölçülen: en uzun şema (kapak görünüşü) %95'e iniyordu.
    // 09.09.2026: kapak görünüşü kalktı (PANO-37), hiçbir şema küçülmüyor.
    expect(enDar).toBe(100);
  });
});
