// ŞEMA ÖLÇEĞİ ve TIKLAMA KUTULARI.
//
// İki söz verildi ve ikisinin de sınanması gerekiyor:
//
//  1. Ölçek SEÇİLEBİLİR (kullanıcı 1:2'yi fazla buldu, öntanım 1:4 oldu) ve
//     altyazıdaki "ölçek 1:N" ibaresi DEĞERDEN ÜRETİLİR. Elle yazılmış bir
//     ibare, ölçek değişince sessizce yalan söylerdi — nitekim söylüyordu.
//
//  2. Şemada bir cihaza tıklanınca ne olduğu görünecek. Bunun için gereken
//     dikdörtgenler çizimin KENDİ geçişinden toplanır; ikinci bir hesap
//     yazılsaydı bir gün ayrışır ve baloncuk YANLIŞ cihazı anlatırdı
//     (`pdf/diagram.tsx`in başındaki uyarının aynısı).

import { describe, expect, it } from "vitest";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import type { ElectricalPart } from "@/lib/electrical/types";
import type { Diagram } from "../model";
import {
  IC_OLCEKLERI,
  IC_OLCEK_ONTANIM,
  icOlcekCoz,
  kutuBul,
  olcekMetni,
  panoDizilimDiagram,
  panoIcYerlesim,
  panoIcYerlesimDiagram,
  panoNumaralari,
} from "../panoLayout";

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

const sonuc = computeSwitchboardLayout({
  parts: [
    ...Array.from({ length: 8 }, (_, i) =>
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
});
const pano = sonuc.room[0];
const ayar = sonuc.settings;

/** Diyagramdaki bütün yazıları düz metin olarak toplar. */
function yazilar(d: Diagram): string {
  return d.els
    .filter((e): e is Extract<typeof e, { kind: "text" }> => e.kind === "text")
    .map((e) => e.text)
    .join(" | ");
}

describe("ölçek metni DEĞERDEN üretilir", () => {
  it("tam sayı payda ondalık yazmaz", () => {
    expect(olcekMetni(4)).toBe("1:4");
    expect(olcekMetni(2)).toBe("1:2");
  });

  it("ondalık payda korunur", () => {
    expect(olcekMetni(6.25)).toBe("1:6,25");
  });

  it("adresten gelen ölçek yalnız İZİNLİ kümede geçerlidir", () => {
    expect(icOlcekCoz("2")).toBe(2);
    expect(icOlcekCoz("4")).toBe(4);
    expect(icOlcekCoz("5")).toBe(5);
    // 1:10'da hiçbir cihaz etiket ya da numara alamaz; küme bilerek dar.
    expect(icOlcekCoz("10")).toBe(IC_OLCEK_ONTANIM);
    expect(icOlcekCoz("abc")).toBe(IC_OLCEK_ONTANIM);
    expect(icOlcekCoz(undefined)).toBe(IC_OLCEK_ONTANIM);
  });

  it("öntanım 1:4'tür ve altyazıda YAZAR", () => {
    expect(IC_OLCEK_ONTANIM).toBe(4);
    expect(yazilar(panoIcYerlesimDiagram({ panel: pano, settings: ayar }))).toContain("ölçek 1:4");
  });

  it("seçilen ölçek altyazıya GEÇER", () => {
    for (const n of IC_OLCEKLERI) {
      const d = panoIcYerlesimDiagram({ panel: pano, settings: ayar, olcek: n });
      expect(yazilar(d)).toContain(`ölçek 1:${n}`);
    }
  });

  it("altyazı kapatılabilir (PDF sayfaya sığdırır, oran korunmaz)", () => {
    const d = panoIcYerlesimDiagram({ panel: pano, settings: ayar, olcekYazisi: false });
    expect(yazilar(d)).not.toContain("ölçek");
  });

  it("KAPAK YERLEŞİMİ ÜRETİLMEZ (PANO-37)", () => {
    // Kullanıcı kararı (09.09.2026): priz, aydınlatma ve buton yerleşime
    // girmez, kapakta da çizilmez. Cihazlar listede kalır — kaybolmazlar.
    for (const p of [...sonuc.room, ...sonuc.field]) {
      expect(p.doorPlacements).toHaveLength(0);
    }
  });
});

describe("ölçek GERÇEKTEN çizimi küçültür", () => {
  it("1:2 çizimi 1:4'ün iki katı gövde eni verir", () => {
    const gövdeEni = (olcek: 2 | 4) => {
      const d = panoIcYerlesimDiagram({ panel: pano, settings: ayar, olcek });
      const dikdortgenler = d.els.filter(
        (e): e is Extract<typeof e, { kind: "rect" }> => e.kind === "rect"
      );
      return Math.max(...dikdortgenler.map((r) => r.w));
    };
    expect(gövdeEni(2)).toBeCloseTo(gövdeEni(4) * 2, 5);
  });

  it("dizilim çizimi öntanımda ESKİ ölçeğini korur", () => {
    // `1 / 6.25 === 0.16` — eski sabitle bit-aynı; bu çizim değişmedi.
    const a = panoDizilimDiagram({ panels: sonuc.room, baslik: "T", olcek: 6.25 });
    const b = panoDizilimDiagram({ panels: sonuc.room, baslik: "T" });
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  it("yazı boyu ÖLÇEKLE KÜÇÜLMEZ", () => {
    // Okunurluk tabanı bir çizim birimi kuralıdır, mm kuralı değil (MOBIL-9:
    // diyagramlar küçülmez, kaydırılır). Ölçek düşerken yazı 3 px'e inerse
    // mühendis ekranda gördüğünü doğrulayamaz.
    for (const n of IC_OLCEKLERI) {
      const d = panoIcYerlesimDiagram({ panel: pano, settings: ayar, olcek: n });
      for (const e of d.els) {
        if (e.kind === "text") expect(e.size, `ölçek 1:${n}`).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

describe("tıklama kutuları çizimle AYNI geçişten gelir", () => {
  it("her yerleşimin TAM BİR kutusu vardır", () => {
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    expect(kutular).toHaveLength(pano.placements.length);
    expect(new Set(kutular.map((k) => k.anahtar)).size).toBe(kutular.length);
  });

  it("kutu anahtarı `panoNumaralari` anahtarıyla AYNIDIR", () => {
    // İki liste birbirine bağlanacak: şemadaki numara ile baloncuktaki cihaz.
    // Anahtarlar ayrışırsa bağ sessizce kopar.
    const numaralar = panoNumaralari(pano);
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    for (const k of kutular) expect(numaralar.has(k.anahtar), k.anahtar).toBe(true);
  });

  it("kutular ÇİZİLEN dikdörtgenlerle örtüşür", () => {
    const { diagram, kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    const dikdortgenler = diagram.els.filter(
      (e): e is Extract<typeof e, { kind: "rect" }> => e.kind === "rect"
    );
    for (const k of kutular) {
      const esles = dikdortgenler.some(
        (r) => Math.abs(r.x - k.x) < 0.01 && Math.abs(r.y - k.y) < 0.01 && Math.abs(r.w - k.w) < 0.01
      );
      expect(esles, `${k.label} için çizilmiş dikdörtgen yok`).toBe(true);
    }
  });

  it("kutular `fitDiagram` SONRASINDA da geçerlidir", () => {
    // `fitDiagram` yalnız ÖLÇER ve görüş kutusunu genişletir; hiçbir elemanı
    // ötelemez. Bu değişirse baloncuk yanlış cihazı gösterir — o yüzden burada
    // çivilenir.
    const { diagram, kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    const x0 = diagram.x0 ?? 0;
    const y0 = diagram.y0 ?? 0;
    for (const k of kutular) {
      expect(k.x).toBeGreaterThanOrEqual(x0);
      expect(k.y).toBeGreaterThanOrEqual(y0);
      expect(k.x + k.w).toBeLessThanOrEqual(x0 + diagram.width + 0.01);
      expect(k.y + k.h).toBeLessThanOrEqual(y0 + diagram.height + 0.01);
    }
  });

  it("kutuBul merkezde O kutuyu, uzakta hiçbir şeyi bulur", () => {
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    const hedef = kutular[0];
    expect(kutuBul(kutular, hedef.x + hedef.w / 2, hedef.y + hedef.h / 2)).toBe(hedef);
    expect(kutuBul(kutular, hedef.x - 500, hedef.y - 500)).toBeNull();
  });

  it("kutuBul HOŞGÖRÜLÜDÜR — ince cihaz da tıklanabilir", () => {
    // 1:4'te bir klemens 1,3 birime iner; hoşgörü olmadan parmakla hiç
    // tıklanamaz.
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar });
    const hedef = kutular[0];
    expect(kutuBul(kutular, hedef.x + hedef.w / 2, hedef.y - 2)).toBe(hedef);
  });
});

describe("etiketi sığmayan cihaz SAYILIR ve söylenir", () => {
  it("1:4'te sığmayan varsa altyazı bunu yazar", () => {
    const dar = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 5 });
    if (dar.yazisiz > 0) {
      expect(yazilar(dar.diagram)).toContain("sığmadı");
    }
    // Ölçek büyüdükçe sığmayan sayısı ARTMAZ.
    const genis = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 });
    expect(genis.yazisiz).toBeLessThanOrEqual(dar.yazisiz);
  });
});
