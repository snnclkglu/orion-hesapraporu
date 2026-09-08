// ODA VE SAHA AYARLARI BAĞIMSIZDIR — ve parmak izi bunu GÖRMEK ZORUNDA.
//
// İki ayrı kusurun testidir:
//
// 1. Tek bir yükseklik/derinlik/baza ayarı iki diziye birden dayatılıyordu.
//    Kullanıcı elektrik odasını 2000 mm'ye çektiğinde duvara asılan saha
//    kutusu da 2000 mm oluyordu (kullanıcı bildirimi, 08.09.2026).
//
// 2. `fingerprintParts` ayarı `JSON.stringify(v, Object.keys(v).sort())` ile
//    serileştiriyordu. Dizi biçimindeki ikinci argüman bir PropertyList'tir ve
//    HER DÜZEYE uygulanır: ayar iç içe bir nesne taşıdığı anda o nesne `{}`
//    diye serileşirdi. Yani ODA YÜKSEKLİĞİNİ DEĞİŞTİRMEK PARMAK İZİNİ
//    DEĞİŞTİRMEZ, "onay eskidi" uyarısı hiç çıkmaz ve imalatçıya eski onayla
//    pano sipariş edilirdi — PANO-14'ün var oluş sebebinin tam tersi.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import { normalizeSettings } from "../settings";
import { DEFAULT_BASE_MM } from "../sizes";

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

/** Odada ve sahada birer pano açan en küçük iş. */
function ikiDizi(): ElectricalPart[] {
  return [
    ...Array.from({ length: 4 }, (_, i) =>
      parca({ location: "LVD1", device: `F${i + 1}`, deviceTag: `=T1+LVD1-F${i + 1}` })
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      parca({ location: "TB1", device: `F${i + 1}`, deviceTag: `=T1+TB1-F${i + 1}` })
    ),
  ];
}

describe("oda ve saha ölçüleri BİRBİRİNDEN BAĞIMSIZDIR", () => {
  it("iki dizi ayrı yükseklik alır", () => {
    const r = computeSwitchboardLayout({
      parts: ikiDizi(),
      settings: { room: { heightMm: 2000 }, field: { heightMm: 1400 } },
    });
    expect(r.roomSize.heightMm).toBe(2000);
    expect(r.fieldSize.heightMm).toBe(1400);
  });

  it("YALNIZ odaya ölçü verilirse saha kendi kararını verir", () => {
    const r = computeSwitchboardLayout({
      parts: ikiDizi(),
      settings: { room: { heightMm: 2000, depthMm: 600 } },
    });
    expect(r.roomSize.heightMm).toBe(2000);
    expect(r.roomSize.depthMm).toBe(600);
    // Saha dizisi 600 mm derinliği DEVRALMAZ: duvara asılan bir kutu, elektrik
    // odasının derinliğini taşımak zorunda değil.
    expect(r.fieldSize.depthMm).not.toBe(600);
    expect(r.fieldSize.heightMm).not.toBe(2000);
  });

  it("baza da dizi başınadır", () => {
    const r = computeSwitchboardLayout({
      parts: ikiDizi(),
      settings: { room: { baseMm: 300 }, field: { baseMm: 200 } },
    });
    for (const p of r.room) expect(p.baseMm).toBe(300);
    for (const p of r.field) expect(p.baseMm).toBe(200);
  });

  it("KISMİ ayar öteki alanları DÜŞÜRMEZ", () => {
    // Sığ bir yayma `room` nesnesinin tamamını değiştirir ve `baseMm`
    // `undefined` kalırdı; o değer panonun bazasına, çizime ve sipariş
    // tablosuna "undefined mm" olarak geçerdi.
    const a = resolveSettings({ room: { heightMm: 2000 } });
    expect(a.room.baseMm).toBe(DEFAULT_BASE_MM);
    expect(a.room.depthMm).toBeNull();
    expect(a.field.baseMm).toBe(DEFAULT_BASE_MM);
    expect(a.plateSideMm).toBeGreaterThan(0);
  });
});

describe("parmak izi ayarın HER alanını görür (PANO-14)", () => {
  const temel = { parts: ikiDizi() };
  const iz = (s?: Parameters<typeof resolveSettings>[0]) =>
    computeSwitchboardLayout({ ...temel, settings: s }).fingerprint;

  const bos = iz();

  it("oda yüksekliği değişince iz DEĞİŞİR", () => {
    expect(iz({ room: { heightMm: 2000 } })).not.toBe(bos);
  });

  it("saha yüksekliği değişince iz DEĞİŞİR", () => {
    expect(iz({ field: { heightMm: 1400 } })).not.toBe(bos);
  });

  it("oda ve saha AYRI izler üretir", () => {
    // Bu ikisi aynı çıksaydı, "hangi diziyi değiştirdim" sorusu onay kaydında
    // cevapsız kalırdı.
    expect(iz({ room: { heightMm: 2000 } })).not.toBe(iz({ field: { heightMm: 2000 } }));
  });

  it("baza değişince iz DEĞİŞİR", () => {
    expect(iz({ room: { baseMm: 300 } })).not.toBe(bos);
  });

  it("pay değişince iz DEĞİŞİR", () => {
    expect(iz({ railDuctMm: 80 })).not.toBe(bos);
  });

  it("AYNI ayar AYNI izi verir", () => {
    expect(iz({ room: { heightMm: 2000 } })).toBe(iz({ room: { heightMm: 2000 } }));
  });
});

describe("kayıtlı onay ayarı HOŞGÖRÜLÜ okunur", () => {
  it("ESKİ DÜZ biçim iki diziye birden uygulanır", () => {
    // 08.09.2026 öncesi onaylar böyleydi ve o değer gerçekten iki diziye
    // birden uygulanıyordu; onaylanan planı yeniden üretmenin tek yolu budur.
    const a = normalizeSettings({ heightMm: 1800, depthMm: 400, baseMm: 250 });
    expect(a.room).toEqual({ heightMm: 1800, depthMm: 400, baseMm: 250 });
    expect(a.field).toEqual({ heightMm: 1800, depthMm: 400, baseMm: 250 });
  });

  it("YENİ biçim düz alanı EZER", () => {
    const a = normalizeSettings({ heightMm: 1800, room: { heightMm: 2000 } });
    expect(a.room?.heightMm).toBe(2000);
    expect(a.field?.heightMm).toBe(1800);
  });

  it("paylar ve saha ön ekleri korunur", () => {
    const a = normalizeSettings({ railDuctMm: 80, fieldPrefixes: ["TB", "JB"] });
    expect(a.railDuctMm).toBe(80);
    expect(a.fieldPrefixes).toEqual(["TB", "JB"]);
  });

  it("BOZUK satır FIRLATMAZ", () => {
    // Bir onay kaydının okunamaması ekranı düşürmemeli.
    for (const ham of [null, undefined, [], 5, "metin", { room: 5 }, { room: { heightMm: "abc" } }]) {
      expect(() => normalizeSettings(ham)).not.toThrow();
    }
    expect(normalizeSettings({ room: { heightMm: "abc" } }).room).toEqual({});
    // Sıfır ve negatif bir ölçü DEĞİLDİR (değişmez md. 4).
    expect(normalizeSettings({ heightMm: 0 }).room).toEqual({});
    expect(normalizeSettings({ heightMm: -5 }).room).toEqual({});
  });
});
