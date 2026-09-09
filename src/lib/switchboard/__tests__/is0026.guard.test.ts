// SÖZLÜK, ÜZERİNDE ÇALIŞILAN İŞİN KELİME DAĞARCIĞIYLA ÖLÇÜLÜR (PANO-25).
//
// Ölçüldü (08.09.2026): sınıflandırma 0019-00'ın Siemens/ABB yazımıyla
// kurulmuştu ve 0019'da 184 üründen YALNIZ BİRİ sınıflanamıyordu. Aynı kod
// 0026-01'e (Schneider ağırlıklı) uygulandığında 54 üründen 22'si — yüzde 41 —
// "Diğer" kalıyor, yani PANOYA HİÇ GİRMİYORDU. Kullanıcının ekranda gördüğü
// "Panoya girmeyen aygıtlar (50)" yığınının 35'i buydu ve gerçek eksikleri
// (ölçüsü olmayan dört sürücü) o yığın gizliyordu.
//
// Buradaki her satır 0026-01'in malzeme listesinden BİREBİR alınmıştır. Bir
// sonraki iş başka bir markayla geldiğinde bu dosyaya o işin satırları eklenir;
// ölçüt tek bir işte iyi çalışmak değil, YENİ BİR İŞİ TANIMAKTIR.

import { describe, expect, it } from "vitest";
import { electricalCategory } from "@/lib/electrical/category";
import { trKatla } from "@/lib/drawings/tr-text";
import { estimateFootprint, kutupOku } from "../footprint";
import { aksesuarYonu, mountRuleFor } from "../mount";
import { computeSwitchboardLayout } from "../compute";
import type { ElectricalPart } from "@/lib/electrical/types";
import type { DeviceModel } from "../types";

/** Gerçek satırdan kategori + montaj tipi. */
function coz(designation: string, typeNo: string, supplier = "SE", partNo = "") {
  const category = electricalCategory({ designation, typeNo, supplier, partNo });
  const kural = mountRuleFor({ category, designation, typeNo });
  return { category, mountType: kural.mountType, zone: kural.zone };
}

describe("0026-01 kelime dağarcığı — kategori", () => {
  const satirlar: [string, string, string][] = [
    // [tanım, tip no, beklenen kategori]
    [
      "ATV930 - 90kW - 400/480V - with braking unit - IP21",
      "ATV930D90N4",
      "Sürücüler ve Güç Elektroniği",
    ],
    [
      "ATV930 - 15kW - 400/480V - with braking unit - IP21",
      "ATV930D15N4",
      "Sürücüler ve Güç Elektroniği",
    ],
    ["Braking Resistor 75kW, 3 Ohm", "BRSD-836SW-7503", "Sürücüler ve Güç Elektroniği"],
    ["Automat. two-pole C 16 A", "A9F74216", "Şalterler ve Devre Kesiciler"],
    ["Automat. one-pole C 10 A", "A9F74110", "Şalterler ve Devre Kesiciler"],
    ["Auxiliary contact iOF, Acti9 A9A, 1 C/O", "A9A26904", "Şalterler ve Devre Kesiciler"],
    [
      "TeSys Giga, standard version, 3 pole/NO, AC-3 <=440V 185A",
      "LC1G185KUEN",
      "Kontaktörler",
    ],
    ["TeSys Giga auxiliary contact blocks 1NO/1NC", "LAG8N113", "Kontaktörler"],
    ["TeSys K contactor - 3P(3 NO) - AC-3 - <= 440 V 6 A", "LP1K0610BD", "Kontaktörler"],
    [
      "TeSys GV2 - Circuit breaker - thermal-magnetic - 13...18 A",
      "GV2ME20",
      "Motor Koruma ve Termik Röleler",
    ],
    [
      "TeSys GV2 & GV3 - auxiliary contact - 1 NO + 1 NC (fault)",
      "GVAE11",
      "Motor Koruma ve Termik Röleler",
    ],
    ["Radio Control Receiver-Transmitter", "ESX_MID 602", "Endüstriyel Haberleşme"],
    ["Counter-Weight Limit", "TYP013B", "Limit Şalterleri"],
    ["Metal stay put T rods lever square rod - 2X(2NC)", "CSM04", "Limit Şalterleri"],
    ["Cast iron motor 75kW, 1500rpm,145A", "GM4E280S4a", "Motorlar"],
    ["Cast iron motor 5.5kW, 1430rpm, 11.8A", "AGM 132 M 6B", "Motorlar"],
    ["LPW1 ,Crane Loadpin", "LPW1", "Ölçüm ve Enstrümantasyon"],
    ["3 Floor Light Columns 24VDC", "SNT-7024-S3", "Sinyal ve İkaz Elemanları"],
  ];

  for (const [tanim, tip, beklenen] of satirlar) {
    it(`${tip} → ${beklenen}`, () => {
      expect(coz(tanim, tip).category).toBe(beklenen);
    });
  }

  it("hiçbiri 'Diğer' değildir", () => {
    const kalanlar = satirlar.filter(([t, n]) => coz(t, n).category === "Diğer");
    expect(kalanlar.map(([, n]) => n)).toEqual([]);
  });
});

describe("0026-01 kelime dağarcığı — montaj yeri", () => {
  it("sürücü montaj plakasına vidalanır", () => {
    expect(coz("ATV930 - 90kW - 400/480V", "ATV930D90N4").mountType).toBe("plaka");
  });

  it("FREN DİRENCİ panonun YANINDA durur, içinde değil", () => {
    // Kullanıcı düzeltmesi (09.09.2026): 08.09'da "tamamen saha" denmişti,
    // şimdi dizilim şemasında panonun yanında GÖRÜNMESİ isteniyor —
    // 75 kW'lık bir direnç kafesi elektrik odasında panonun bitişiğinde
    // gerçekten yer kaplar. Panonun İÇİNE girmez.
    const k = coz("Braking Resistor 75kW, 3 Ohm", "BRSD-836SW-7503", "RESSA");
    expect(k.category).toBe("Sürücüler ve Güç Elektroniği");
    expect(k.mountType).toBe("yan");
  });

  it("kVA ile anılan cihaz TRAFODUR ve pano ZEMİNİNE oturur", () => {
    // MATIS 4000'in tanımında ne "trafo" ne "transformer" geçiyor.
    // Kullanıcı kararı (09.09.2026): "trafo pano içerisinde yere konuyor,
    // bundan dolayı pano yerleşiminde gösterilmesin."
    const k = coz("400-230V , 4kVA", "MATIS 4000", "ETA");
    expect(k.category).toBe("Güç Kaynakları ve Trafolar");
    expect(k.mountType).toBe("zemin");
  });

  it("TELSİZ KUMANDA panoya girmez", () => {
    // Kullanıcı kararı (09.09.2026): "Radio Control Receiver-Transmitter pano
    // dışında olur, içerisine yerleştirme." Ölçüldü: 0026'nın `LVD0`sunda
    // 170 x 320 x 120 mm'lik bu takım montaj plakasında yer kaplıyordu.
    expect(coz("Radio Control Receiver-Transmitter", "ESX_MID 602", "ELFA").mountType).toBe(
      "saha"
    );
  });

  it("DARBE AKIM RÖLESİ telsizle karışmaz ve panoda KALIR", () => {
    // 0019'da geçen "REMOTE SWITCH 1S AC230V 16A" bir röledir; çıplak
    // `REMOTE` işareti onu da sahaya atardı (PANO-25).
    expect(coz("REMOTE SWITCH 1S AC230V 16A", "5TT4101-0", "Siemens").mountType).toBe("din");
  });

  it("anahtarlamalı güç kaynağı RAYDA KALIR", () => {
    const k = coz("Power supply 240W, in: 1 phase 100-240VAC", "S8VKC24024", "OMR");
    expect(k.mountType).toBe("din");
  });

  it("makine prizi kapak/yan saca gömülür, klemens rayına değil", () => {
    const k = coz("230V/16A 2P+E Inclined Machine Plug-Socket", "BC1-1403-7420", "BEM");
    expect(k.mountType).toBe("kapak");
  });
});

describe("İKAZ VE AYDINLATMA SAHADADIR (PANO-37)", () => {
  // Kullanıcı düzeltmesi (09.09.2026): "pano yanı ekipmanlarından sadece
  // direnç gösterilsin; aydınlatma ve diğer saha ekipmanlara gerek yok."
  //
  // 08.09.2026'da bunlar `yan` yapılmıştı ve dizilim şeridi bir sirenle, dört
  // projektörle ve üç ikaz kolonuyla doluyordu. Hepsi vincin üstünde; `saha`
  // kuyruğunda sebebiyle görünürler, yani KAYBOLMAZLAR (PANO-10).
  const sahadakiler: [string, string][] = [
    ["40W 108dB Siren", "SNT-SL190-22"],
    ["1 Layer Pipe Horns 12-30VAC/DC-RED", "SNT-B710-1"],
    ["3 Floor Light Columns 24VDC", "SNT-7024-S3"],
    ["60W LED Safety Spot--Line light- RED", "SNT-BL186-1"],
    ["160W 5000K 230VAC LED Floodlight", "N1000-P-2/160W.5000K"],
  ];

  for (const [tanim, tip] of sahadakiler) {
    it(`${tip} sahadadır, pano yanında değil`, () => {
      expect(coz(tanim, tip, "MC").mountType).toBe("saha");
    });
  }

  it("PANO LAMBASI gövde gereci KALIR", () => {
    // Ayrım aile içindedir: sensörlü pano armatürü panonun İÇİNDEDİR.
    // GERÇEK SATIR: bu ürünün kimliği PARÇA NUMARASINDADIR (`EAE.51041`);
    // tanımdaki "with sensor" tek başına okunsaydı bir sensör sanılırdı.
    const k = coz("EG KL 220V AC 25 cm with sensor", "51041", "EAE", "EAE.51041");
    expect(k.category).toBe("Aydınlatma");
    expect(k.mountType).toBe("govde");
  });

  it("KAPAK SİNYAL LAMBASI kapakta KALIR", () => {
    expect(coz("Pilot light 22mm green 24VDC", "XB4BVB3", "SE").mountType).toBe("kapak");
  });

  it("THORN markası korna sanılmaz", () => {
    // Çıplak `HORN` işareti aydınlatma markası THORN'un içinde geçerdi.
    expect(coz("THORN LED lighting fixture 40W", "THORN-40", "THORN").mountType).not.toBe("yan");
  });

  it("pano yanı ekipmanına ölçü TAHMİN EDİLMEZ", () => {
    // 30 x 30 mm tahmini PANO-22'nin KAPAK kesim ölçüsüdür; bir sirene
    // uygulanırsa şemaya sahte bir kutu çizilir.
    const t = estimateFootprint({
      category: "Sinyal ve İkaz Elemanları",
      designation: "40W 108dB Siren",
      typeNo: "SNT-SL190-22",
      supplier: "MC",
      partNo: "",
      mountType: "yan",
    });
    expect(t.widthMm).toBeNull();
    expect(t.source).toBeNull();
  });

  it("KAPAK elemanı tahminini KAYBETMEZ", () => {
    const t = estimateFootprint({
      category: "Kumanda Elemanları",
      designation: "Harmony XB4 Emergency Stop",
      typeNo: "XB4BS8442",
      supplier: "SE",
      partNo: "",
      mountType: "kapak",
    });
    expect(t.widthMm).toBe(30);
  });
});

describe("kutup sayısı YAZIYLA da okunur (PANO-5)", () => {
  const vakalar: [string, number | null][] = [
    ["Automat. one-pole C 10 A", 1],
    ["Automat. two-pole C 16 A", 2],
    ["Automat. three-pole C 32 A", 3],
    ["CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A", 3],
    ["MCB 1+N C 16A", 2],
    ["Çift kutuplu otomat C 16 A", 2],
    ["GoPact MCCB 30kA, 60A", null],
  ];

  for (const [metin, beklenen] of vakalar) {
    it(`${JSON.stringify(metin)} → ${beklenen}`, () => {
      expect(kutupOku(trKatla(metin))).toBe(beklenen);
    });
  }

  it("Acti9 otomatı artık ölçüsüz kalmaz", () => {
    const t = estimateFootprint({
      category: "Şalterler ve Devre Kesiciler",
      designation: "Automat. two-pole C 16 A",
      typeNo: "A9F74216",
      supplier: "SE",
      partNo: "",
      mountType: "din",
    });
    expect(t.widthMm).toBe(35);
    expect(t.source).toBe("tahmin");
  });
});

describe("ağır besleme TAHMİN EDİLMEZ", () => {
  it("4 kVA trafo güç kaynağı ölçüsü almaz", () => {
    // Ölçüldü: `mount.ts` kVA'dan onu plakaya koyuyordu ama tahmin kuralının
    // kendi kelime listesi tutmadığı için 50 x 125 x 125 mm veriyordu.
    const t = estimateFootprint({
      category: "Güç Kaynakları ve Trafolar",
      designation: "400-230V , 4kVA",
      typeNo: "MATIS 4000",
      supplier: "ETA",
      partNo: "",
      mountType: "plaka",
    });
    expect(t.widthMm).toBeNull();
  });
});

describe("AKSESUAR EN EKLER Mİ (PANO-26)", () => {
  it("Acti9 yardımcı kontağı YANDAN takılır", () => {
    // Katalogun montaj kuralları sayfası "à esquerda" (sola) diyor.
    expect(
      aksesuarYonu({
        category: "Şalterler ve Devre Kesiciler",
        designation: "Auxiliary contact iOF, Acti9 A9A, 1 C/O",
        typeNo: "A9A26904",
      })
    ).toBe("yan");
  });

  it("GV2 yardımcı kontağı ÖNDEN takılır", () => {
    // "Front mounting add-on contact blocks" — ene 0 ekler.
    expect(
      aksesuarYonu({
        category: "Motor Koruma ve Termik Röleler",
        designation: "TeSys GV2 & GV3 - auxiliary contact - 1 NO + 1 NC (fault)",
        typeNo: "GVAE11",
      })
    ).toBe("on");
  });

  it("KANITI OLMAYAN aksesuar eni DEĞİŞTİRMEZ", () => {
    // Geniş bir `AUXILIARY CONTACT` işareti önden takılan blokları da
    // yakalar ve panoyu gereksizce genişletirdi (değişmez md. 4).
    expect(
      aksesuarYonu({
        category: "Kontaktörler",
        designation: "TeSys Giga auxiliary contact blocks 1NO/1NC",
        typeNo: "LAG8N113",
      })
    ).toBeNull();
    expect(
      aksesuarYonu({
        category: "Kumanda ve Güvenlik Röleleri",
        designation: "Socket, separate contact, 5 A, relay type RXG2",
        typeNo: "RGZE1S48M",
      })
    ).toBeNull();
  });
});

describe("yandan takılan aksesuarın eni AYGITA EKLENİR", () => {
  const DEFTER: DeviceModel[] = [
    {
      lookupKey: "SCHNEIDERELECTRIC|A9F74206",
      supplier: "Schneider Electric",
      typeNo: "A9F74206",
      widthMm: 36,
      heightMm: 85,
      depthMm: 78.5,
      moduleUnits: null,
      mountType: "din",
      zone: null,
      clearanceTopMm: null,
      clearanceBottomMm: null,
      heatW: null,
      source: "katalog",
      note: "",
    },
    {
      lookupKey: "SCHNEIDERELECTRIC|A9A26904",
      supplier: "Schneider Electric",
      typeNo: "A9A26904",
      widthMm: 9,
      heightMm: 86,
      depthMm: 67.5,
      moduleUnits: null,
      mountType: "din",
      zone: null,
      clearanceTopMm: null,
      clearanceBottomMm: null,
      heatW: null,
      source: "katalog",
      note: "",
    },
  ];

  function satir(typeNo: string, designation: string): ElectricalPart {
    return {
      deviceTag: "=100T+LVD0-F64",
      installation: "100T",
      location: "LVD0",
      device: "F64",
      qty: 1,
      designation,
      typeNo,
      supplier: "SE",
      partNo: `SE.${typeNo}`,
      page: 1,
    };
  }

  const otomat = satir("A9F74206", "Automat. two-pole C 6 A");
  const aux = satir("A9A26904", "Auxiliary contact iOF, Acti9 A9A, 1 C/O");
  const dolgu: ElectricalPart[] = Array.from({ length: 3 }, (_, i) => ({
    ...otomat,
    device: `F${i + 1}`,
    deviceTag: `=100T+LVD0-F${i + 1}`,
  }));

  it("aksesuarsız otomat DEFTERDEKİ enidir", () => {
    const r = computeSwitchboardLayout({ parts: [otomat, ...dolgu], models: DEFTER });
    const y = r.room[0].placements.find((p) => p.label === "F64");
    expect(y?.widthMm).toBe(36);
  });

  it("YANDAN takılan aksesuar eni BÜYÜTÜR", () => {
    const r = computeSwitchboardLayout({ parts: [otomat, aux, ...dolgu], models: DEFTER });
    const y = r.room[0].placements.find((p) => p.label === "F64");
    expect(y?.widthMm).toBe(45);
    // Aksesuar AYRI bir kutu açmaz — panoda iki kez yer kaplamaz.
    expect(r.room[0].placements.filter((p) => p.label === "F64")).toHaveLength(1);
  });

  it("ÖNDEN takılan aksesuar eni DEĞİŞTİRMEZ", () => {
    const gvae = { ...aux, typeNo: "GVAE11", partNo: "SE.GVAE11",
      designation: "TeSys GV2 & GV3 - auxiliary contact - 1 NO + 1 NC (fault)" };
    const r = computeSwitchboardLayout({ parts: [otomat, gvae, ...dolgu], models: DEFTER });
    const y = r.room[0].placements.find((p) => p.label === "F64");
    expect(y?.widthMm).toBe(36);
  });

  it("aksesuar ANA AYGITIN ölçü düzeltmesini ALMAZ", () => {
    // `placementOverrides` aygıt anahtarına bağlıdır; aksesuar da aynı anahtarı
    // taşır. Düzeltme ona da uygulansaydı en İKİ KEZ sayılırdı.
    const r = computeSwitchboardLayout({
      parts: [otomat, aux, ...dolgu],
      models: DEFTER,
      placementOverrides: [
        {
          deviceKey: "100T|LVD0|F64",
          panelCode: null,
          mountType: null,
          zone: null,
          railIndex: null,
          orderInRail: null,
          widthMm: 50,
          heightMm: 90,
          depthMm: 80,
          pinned: false,
          note: "",
        },
      ],
    });
    const y = r.room[0].placements.find((p) => p.label === "F64");
    // 50 (elle) + 9 (aksesuar defteri) = 59; 50 + 50 = 100 DEĞİL.
    expect(y?.widthMm).toBe(59);
  });
});
