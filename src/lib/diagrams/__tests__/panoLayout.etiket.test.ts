// ETİKET MERDİVENİ ve SABİT YAZILAR (PANO-13).
//
// Şema iki kanaldan okunur: RESİM yerleşimi verir, LİSTE kimliği verir. Bu
// sözleşme yalnız etiketin nereye düştüğü doğruysa çalışır ve merdivenin üç
// basamağı vardır — sığan etiket, sığmayan yerine NUMARA, o da sığmıyorsa
// HİÇBİR ŞEY. Üçüncü basamak bir kayıp değil bir karardır: 1,3 birimlik bir
// klemensin üstüne yazılan 6 puntoluk bir yazı komşusunun üstüne taşar ve
// çizimi okunmaz yapar.
//
// İkinci sözleşme: cihaz etiketleri `fixed: true` taşır. `resolveTextOverlaps`
// çakışan yazıları KAÇIRIR; sabitlenmemiş bir cihaz etiketi başka bir cihazın
// üstüne kaçar ve o cihazı yanlış adlandırırdı. Ölçüldü: bu bayrak olmadan
// etiket ile ait olduğu kutu arasındaki bağ görsel olarak KOPUYOR.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import type { Diagram, DiagramEl } from "../model";
import { panoIcYerlesim, panoNumaralari } from "../panoLayout";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+P1-F1",
    installation: "T1",
    location: "P1",
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
 * Üç ayrı ende cihaz: geniş bir sürücü (etiket sığar), orta boy şalterler
 * (numara sığar), ve 5,2 mm'lik klemensler (hiçbiri sığmaz).
 */
const KARISIK: ElectricalPart[] = [
  ...Array.from({ length: 4 }, (_, i) =>
    parca({ device: `F${i + 1}`, deviceTag: `=T1+P1-F${i + 1}` })
  ),
  parca({
    device: "X1",
    deviceTag: "=T1+P1-X1",
    designation: "Feed-through terminal block UT 2,5",
    typeNo: "UT 2,5",
    supplier: "Phoenix Contact",
    partNo: "PXC.3044076",
    qty: 40,
  }),
];

function yazilar(d: Diagram): Extract<DiagramEl, { kind: "text" }>[] {
  return d.els.filter((e): e is Extract<DiagramEl, { kind: "text" }> => e.kind === "text");
}

const sonuc = computeSwitchboardLayout({ parts: KARISIK });
const pano = sonuc.room[0];
const ayar = sonuc.settings;

describe("etiket merdiveni", () => {
  it("GENİŞ cihaz TAM ETİKETİNİ alır", () => {
    // 1:2'de üç kutuplu bir şalter 26 birim — etiket rahat sığar.
    const { diagram } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 });
    const metinler = yazilar(diagram).map((t) => t.text);
    expect(metinler).toContain("F1");
  });

  it("MERDİVENİN ÜÇ BASAMAĞI aynı cihazda görünür", () => {
    // Üç kutuplu bir şalter 52,5 mm. Ölçek düştükçe aynı cihaz üç ayrı
    // basamağa iner ve bu, kuralın kendisinin ölçüsüdür:
    //   1:2 → 26,3 birim → TAM ETİKET
    //   1:5 → 10,5 birim → NUMARA (12'nin altında, 7'nin üstünde)
    //   ...ve 1 kutuplu bir şalter 1:4'te 4,4 birime iner → HİÇBİR ŞEY.
    const metinlerde = (olcek: 2 | 4 | 5) =>
      new Set(yazilar(panoIcYerlesim({ panel: pano, settings: ayar, olcek }).diagram).map((t) => t.text));

    expect(metinlerde(2).has("F1")).toBe(true);

    const dar = metinlerde(5);
    expect(dar.has("F1")).toBe(false);
    // Numaralar `panoNumaralari` haritasından gelir ve cihaz listesindeki
    // numarayla AYNIDIR — resmin ile listenin bağı budur.
    const numaralar = [...panoNumaralari(pano).values()].map(String);
    expect(numaralar.filter((n) => dar.has(n)).length).toBeGreaterThan(0);
  });

  it("HİÇBİR ŞEY basamağı gerçekten var", () => {
    // Tek kutuplu bir şalter 17,5 mm: 1:4'te 4,4 birim, numara eşiğinin (7)
    // altında. `yazisiz` sayacı bunu söyler ve altyazı kullanıcıya iletir.
    const tekKutup = computeSwitchboardLayout({
      parts: Array.from({ length: 6 }, (_, i) =>
        parca({
          device: `F${i + 1}`,
          deviceTag: `=T1+P1-F${i + 1}`,
          designation: "CIRCUIT BREAKER 400V 6KA, 1POLE, C, 10A",
          typeNo: "5SL6110-7",
          partNo: "SIE.5SL6110-7",
        })
      ),
    });
    const cizim = panoIcYerlesim({
      panel: tekKutup.room[0],
      settings: tekKutup.settings,
      olcek: 4,
    });
    expect(cizim.yazisiz).toBeGreaterThan(0);
    expect(yazilar(cizim.diagram).map((t) => t.text).join(" ")).toContain("sığmadı");
  });

  it("KLEMENS üstüne hiçbir şey yazılmaz", () => {
    // Tek bir klemens 1:2'de 2,6 birim; oraya yazılan 6 puntoluk bir yazı
    // komşusunun üstüne taşardı.
    const { diagram } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 });
    const metinler = yazilar(diagram);
    // Şeridin kendi etiketi (`X1·40`) sığar; TEK klemensin üstünde yazı YOK.
    // Ölçüt: hiçbir yazı 4 birimden dar bir kutunun ortasına düşmemeli.
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 });
    const dar = kutular.filter((k) => k.w < 4);
    for (const k of dar) {
      const ustunde = metinler.filter(
        (t) => t.x > k.x && t.x < k.x + k.w && t.y > k.y && t.y < k.y + k.h
      );
      expect(ustunde.map((t) => t.text), `${k.label} üstünde yazı var`).toEqual([]);
    }
  });

  it("ÖLÇEK küçüldükçe yazısız cihaz sayısı ARTAR, azalmaz", () => {
    const iki = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 }).yazisiz;
    const dort = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 4 }).yazisiz;
    const bes = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 5 }).yazisiz;
    expect(dort).toBeGreaterThanOrEqual(iki);
    expect(bes).toBeGreaterThanOrEqual(dort);
  });

  it("şemaya yazılan her NUMARA gerçekten o cihazın numarasıdır", () => {
    // Numara ile kutu aynı anahtardan gelir; ayrışırlarsa resim yanlış cihazı
    // gösterir ve kimse fark etmez.
    const { kutular } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 4 });
    const numaralar = panoNumaralari(pano);
    for (const k of kutular) {
      if (k.no === null) continue;
      expect(numaralar.get(k.anahtar)).toBe(k.no);
    }
  });
});

describe("cihaz yazıları SABİTTİR", () => {
  it("cihaz etiketleri `fixed` taşır", () => {
    // `resolveTextOverlaps` sabitlenmemiş yazıları kaçırır. Bir cihaz etiketi
    // kaçarsa komşu cihazın üstüne düşer ve onu YANLIŞ adlandırır.
    const { diagram, kutular } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 2 });
    const kutuIcinde = yazilar(diagram).filter((t) =>
      kutular.some((k) => t.x > k.x && t.x < k.x + k.w && t.y > k.y && t.y < k.y + k.h)
    );
    expect(kutuIcinde.length).toBeGreaterThan(0);
    for (const t of kutuIcinde) {
      expect(t.fixed, `"${t.text}" sabit değil`).toBe(true);
    }
  });

  it("efsane ve ölçü yazıları da sabittir", () => {
    const { diagram } = panoIcYerlesim({ panel: pano, settings: ayar, olcek: 4 });
    const efsane = yazilar(diagram).filter((t) => t.text === "Renk grubu");
    expect(efsane).toHaveLength(1);
    expect(efsane[0].fixed).toBe(true);
  });

  it("hiçbir cihaz yazısı okunurluk tabanının ALTINA inmez", () => {
    // Taban çizim birimi cinsindendir ve ölçekle KÜÇÜLMEZ (MOBIL-9).
    for (const olcek of [2, 4, 5] as const) {
      const { diagram } = panoIcYerlesim({ panel: pano, settings: ayar, olcek });
      for (const t of yazilar(diagram)) {
        expect(t.size, `ölçek 1:${olcek} · "${t.text}"`).toBeGreaterThanOrEqual(6);
      }
    }
  });
});
