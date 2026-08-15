// HAMMADDE HAVUZU — birleştirme, çarpan, boy planı ve şema ayrışması.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adediCoz,
  boyaYerlestir,
  hamAnahtar,
  hammaddeHavuzu,
  type HammaddeKaynagi,
  type HammaddePaketi,
} from "../havuz";
import { HAMMADDE_SINIFLARI } from "../siniflar";

const PAKETLER: HammaddePaketi[] = [
  {
    packageId: "p1",
    label: "0053-01-0150 · BOJİ",
    itemNo: "0053-01",
    jobNo: "0053",
    jobTitle: "LITEC PORTAL VİNÇ",
    customer: "LITEC",
    carpan: 2,
    carpanBelirsiz: false,
  },
  {
    packageId: "p2",
    label: "0057-00-0500 · MONORAY",
    itemNo: "0057-00",
    jobNo: "0057",
    jobTitle: "MONORAY",
    customer: "ASTOR",
    carpan: 1,
    carpanBelirsiz: true,
  },
];

function kaynak(over: Partial<HammaddeKaynagi> = {}): HammaddeKaynagi {
  return {
    packageId: "p1",
    partKey: "0053-01-0150-02",
    partCode: "0053-01-0150-02",
    tanim: "SAC 15x375x1500",
    malzeme: "S355JR",
    kategori: "Plazma",
    kind: "imalat",
    qty: 4,
    groupCode: "0053-01-0150",
    groupName: "BOJİ",
    ...over,
  };
}

describe("stok kalemi birleştirme", () => {
  it("aynı kalınlık ve kaliteden gelen FARKLI parçalar TEK stok kalemidir", () => {
    const h = hammaddeHavuzu(PAKETLER, [
      kaynak(),
      kaynak({ partCode: "0053-01-0150-03", tanim: "SAC 15x300x850", qty: 2 }),
      kaynak({ partCode: "0053-01-0150-04", tanim: "SAC 15x150x225", qty: 8 }),
    ]);
    expect(h.satirlar).toHaveLength(1);
    expect(h.satirlar[0].tanim).toBe("SAC 15 MM S355JR");
    expect(h.satirlar[0].parcaSayisi).toBe(3);
  });

  it("KALİTE ANAHTARIN PARÇASIDIR — S235 ile S355 aynı plaka değildir", () => {
    const h = hammaddeHavuzu(PAKETLER, [
      kaynak(),
      kaynak({ partCode: "x", tanim: "SAC 15x300x850", malzeme: "S235JR" }),
    ]);
    expect(h.satirlar).toHaveLength(2);
  });

  it("ADETLER İŞ KALEMİ ADEDİYLE ÇARPILIR (md. 6)", () => {
    const h = hammaddeHavuzu(PAKETLER, [kaynak({ qty: 4 })]);
    // 4 resimde × 2 iş kalemi adedi = 8 kesilecek parça
    expect(h.satirlar[0].parcaAdedi).toBe(8);
    expect(h.satirlar[0].parcalar[0].carpan).toBe(2);
  });

  it("BELİRSİZ ÇARPAN YAYILIR — sessizce 1 sayılmaz", () => {
    const h = hammaddeHavuzu(PAKETLER, [kaynak({ packageId: "p2" })]);
    expect(h.satirlar[0].carpanBelirsiz).toBe(true);
    expect(h.belirsizKalem).toBe(1);
  });

  it("çok projeli kalem TEK satırdır ve payları iş sırasındadır", () => {
    const h = hammaddeHavuzu(PAKETLER, [
      kaynak({ packageId: "p2", partCode: "0057-00-0500-01" }),
      kaynak(),
    ]);
    expect(h.satirlar).toHaveLength(1);
    expect(h.satirlar[0].isSayisi).toBe(2);
    expect(h.satirlar[0].paylar.map((p) => p.itemNo)).toEqual(["0053-01", "0057-00"]);
    expect(h.cokIsliKalem).toBe(1);
  });

  it("ağırlık parçaların ADETLE ÇARPILMIŞ toplamıdır", () => {
    const h = hammaddeHavuzu(PAKETLER, [kaynak({ tanim: "SAC 10x1000x1000", qty: 3 })]);
    // 10 × 1000 × 1000 mm³ × 7,85e-6 = 78,5 kg; × 3 resim × 2 kalem = 471 kg
    expect(h.satirlar[0].toplamAgirlikKg).toBeCloseTo(471, 0);
  });

  it("SATIN ALMA SATIRI havuza girmez — bölünme artıksızdır", () => {
    const h = hammaddeHavuzu(PAKETLER, [
      kaynak({ kind: "satinalma", tanim: "CİVATA M16x70 DIN931" }),
      kaynak({ partCode: "", tanim: "SOMUN M20 DIN934" }),
    ]);
    expect(h.satirlar).toHaveLength(0);
    expect(h.kaynakSatiri).toBe(0);
  });
});

describe("boy planı", () => {
  it("PROFİL 12 metrelik boydan sayılır", () => {
    const h = hammaddeHavuzu(PAKETLER, [
      kaynak({ tanim: "NPU 100 L=5000", kategori: "Testere", malzeme: "S235JR", qty: 1 }),
    ]);
    const s = h.satirlar[0];
    // 5000 mm × 1 resim × 2 kalem = 10 m toplam ama İKİ ayrı 5 m parça:
    // ikisi de tek bir 12 m boya sığar.
    expect(s.stokBoyuMm).toBe(12000);
    expect(s.toplamBoyMm).toBe(10000);
    expect(s.boyAdedi).toBe(1);
  });

  it("NAİF `toplam/boy` HESABI YANLIŞTIR — yerleştirme yapılır", () => {
    // Üç tane 5 m: toplam 15 m. Naif hesap ⌈15/12⌉ = 2 der ve DOĞRUDUR;
    // ama üç tane 7 m'de naif ⌈21/12⌉ = 2 der, gerçek 3'tür.
    expect(boyaYerlestir([7000, 7000, 7000], 12000).boyAdedi).toBe(3);
    expect(boyaYerlestir([5000, 5000, 5000], 12000).boyAdedi).toBe(2);
    expect(boyaYerlestir([12000, 12000], 12000).boyAdedi).toBe(2);
  });

  it("STOK BOYUNDAN UZUN parça ayrıca sayılır, bir boya sığdırılmaz", () => {
    const r = boyaYerlestir([17000, 3000], 12000);
    expect(r.asan).toBe(1);
    expect(r.boyAdedi).toBe(1);
  });

  it("SACDA BOY YOKTUR — plaka ölçüsü yerleşim modülünün kararıdır", () => {
    const h = hammaddeHavuzu(PAKETLER, [kaynak()]);
    expect(h.satirlar[0].stokBoyuMm).toBeNull();
    expect(h.satirlar[0].boyAdedi).toBeNull();
  });
});

describe("adet çözümü — kesim boyu bir ADET KANITIDIR", () => {
  it("`Item QTY` yokken adet TOPLAM BOYDAN türetilir", () => {
    // CANLI VERİDE ÖLÇÜLDÜ (15.08.2026): `Item QTY` sütunu olmayan sayfalarda
    // defterin adedi 24.000 yazıyordu — o sayı adet değil TOPLAM KESİM BOYU.
    expect(adediCoz(null, 24000, 6000)).toEqual({ adet: 4, kaynak: "kesimBoyu" });
    expect(adediCoz(24000, 24000, 6000)).toEqual({ adet: 4, kaynak: "kesimBoyu" });
  });

  it("defter ile kesim boyu UYUŞUYORSA sonuç aynıdır", () => {
    // NERVÜRLÜ DEMİR Ø22 L=1128 → 790 adet, 891.120 mm toplam.
    expect(adediCoz(790, 891120, 1128).adet).toBe(790);
  });

  it("BÖLME TAM ÇIKMAZSA deftere dönülür — uydurma adet üretilmez", () => {
    expect(adediCoz(3, 10000, 3333)).toEqual({ adet: 3, kaynak: "kesimBoyu" });
    // %1'den fazla sapma: birim boy yanlış okunmuş demektir.
    expect(adediCoz(3, 10000, 2500.5)).toEqual({ adet: 4, kaynak: "kesimBoyu" });
    expect(adediCoz(7, 10000, 900)).toEqual({ adet: 7, kaynak: "defter" });
  });

  it("kesim boyu yoksa defter adedi kullanılır", () => {
    expect(adediCoz(5, null, 1200)).toEqual({ adet: 5, kaynak: "defter" });
    expect(adediCoz(null, null, 1200)).toEqual({ adet: null, kaynak: "defter" });
  });

  it("havuz bu düzeltmeyi UYGULAR ve ağırlık gerçekçi çıkar", () => {
    const h = hammaddeHavuzu(
      [{ ...PAKETLER[0], carpan: 1, carpanBelirsiz: false }],
      [
        kaynak({
          tanim: "NPL 120x120x10 L=6000",
          kategori: "Testere",
          malzeme: "S235JR",
          qty: 24000,
          kesimBoyuMm: 24000,
        }),
      ]
    );
    const s = h.satirlar[0];
    expect(s.parcaAdedi).toBe(4);
    expect(s.toplamBoyMm).toBe(24000);
    // 18,2 kg/m × 24 m = 437 kg — 24.000 adet sanılsaydı 2.600 TON çıkardı.
    expect(s.toplamAgirlikKg).toBeCloseTo(437, 0);
  });

  it("adet HİÇBİR kaynaktan okunamazsa satır bunu SÖYLER", () => {
    const h = hammaddeHavuzu(PAKETLER, [kaynak({ qty: null, kesimBoyuMm: null })]);
    expect(h.satirlar[0].eksikler).toContain("adet okunamadı");
    expect(h.satirlar[0].parcaAdedi).toBe(0);
  });
});

describe("düzeltme defteri", () => {
  it("SINIF TAŞIMA stok kaleminin ADINI da taşır", () => {
    const temel = hammaddeHavuzu(PAKETLER, [
      kaynak({ tanim: "BURÇ Ø70 L=30", kategori: "Talaşlı İmalat" }),
    ]);
    expect(temel.satirlar[0].sinif).toBe("DOLU");
    const anahtar = temel.satirlar[0].kaynakAnahtar;

    const tasinmis = hammaddeHavuzu(
      PAKETLER,
      [kaynak({ tanim: "BURÇ Ø70 L=30", kategori: "Talaşlı İmalat" })],
      { sinifDuzeltmeleri: new Map([[anahtar, "BORU"]]) }
    );
    expect(tasinmis.satirlar[0].sinif).toBe("BORU");
    expect(tasinmis.satirlar[0].tanim).toContain("BORU");
    expect(tasinmis.satirlar[0].sinifElle).toBe(true);
    // KAYNAK ANAHTAR DEĞİŞMEZ: düzeltme bir sonraki okumada kendini bulmalı.
    expect(tasinmis.satirlar[0].kaynakAnahtar).toBe(anahtar);
  });

  it("HARİÇ TUTULAN kalem havuza hiç girmez", () => {
    const temel = hammaddeHavuzu(PAKETLER, [kaynak()]);
    const anahtar = temel.satirlar[0].kaynakAnahtar;
    const h = hammaddeHavuzu(PAKETLER, [kaynak()], { haricler: new Set([anahtar]) });
    expect(h.satirlar).toHaveLength(0);
  });

  it("ETİKET DÜZELTMESİ görünen adı ezer, anahtarı DEĞİL", () => {
    const temel = hammaddeHavuzu(PAKETLER, [kaynak()]);
    const anahtar = temel.satirlar[0].kaynakAnahtar;
    const h = hammaddeHavuzu(PAKETLER, [kaynak()], {
      etiketDuzeltmeleri: new Map([[anahtar, "SAC 15 MM S355J2+N"]]),
    });
    expect(h.satirlar[0].tanim).toBe("SAC 15 MM S355J2+N");
    expect(h.satirlar[0].key).toBe(anahtar);
  });

  it("anahtar Türkçe katlanır — yazım farkı iki satır üretmez", () => {
    expect(hamAnahtar("Sac 15 mm S355jr")).toBe(hamAnahtar("SAC 15 MM S355JR"));
    expect(hamAnahtar("çelik  boru")).toBe("CELIK BORU");
  });
});

describe("veritabanı şemasıyla ayrışmaz", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260815000001_hammadde.sql"),
    "utf8"
  );

  it("iki tablonun kısıtı da AYNI sınıf listesini taşıyor", () => {
    // Liste TS sabitinden ÜRETİLİR, elle yazılmaz (`vat.test.ts`in numarası):
    // biri değişip diğeri kalırsa bu test kırılır.
    const liste = HAMMADDE_SINIFLARI.map((s) => `'${s}'`).join(", ");
    const kalip = new RegExp(liste.replace(/[()']/g, "\\$&"), "g");
    expect(migration.match(kalip)?.length).toBe(2);
  });

  it("RLS `can_see_purchasing` ile kapalı, `using (true)` DEĞİL", () => {
    expect(migration).toContain("public.can_see_purchasing()");
    expect(migration).toContain("public.can_edit_purchasing()");
    expect(migration).not.toMatch(/for select to authenticated\s*'\s*'using \(true\)/);
  });

  it("her iki tabloda da RLS açık ve updated_at tetikleyicisi var", () => {
    for (const t of ["purchase_raw_meta", "purchase_raw_manual"]) {
      expect(migration).toContain(`alter table public.${t} enable row level security`);
      expect(migration).toContain(`'${t}'`);
    }
    expect(migration).toContain("public.touch_updated_at()");
  });
});
