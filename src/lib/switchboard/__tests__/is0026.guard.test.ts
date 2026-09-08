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
import { mountRuleFor } from "../mount";

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

  it("FREN DİRENCİ sürücü ailesindedir ama PANOYA GİRMEZ", () => {
    // Kullanıcı kararı (08.09.2026): 75 kW'lık direnç kendi havalandırmalı
    // kafesinde, panonun dışında durur.
    const k = coz("Braking Resistor 75kW, 3 Ohm", "BRSD-836SW-7503", "RESSA");
    expect(k.category).toBe("Sürücüler ve Güç Elektroniği");
    expect(k.mountType).toBe("saha");
  });

  it("kVA ile anılan cihaz TRAFODUR ve raya oturmaz", () => {
    // MATIS 4000'in tanımında ne "trafo" ne "transformer" geçiyor.
    const k = coz("400-230V , 4kVA", "MATIS 4000", "ETA");
    expect(k.category).toBe("Güç Kaynakları ve Trafolar");
    expect(k.mountType).toBe("plaka");
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

describe("PANO YANI ekipmanı (PANO-27)", () => {
  const yanlar: [string, string][] = [
    ["40W 108dB Siren", "SNT-SL190-22"],
    ["1 Layer Pipe Horns 12-30VAC/DC-RED", "SNT-B710-1"],
    ["3 Floor Light Columns 24VDC", "SNT-7024-S3"],
    ["60W LED Safety Spot--Line light- RED", "SNT-BL186-1"],
    ["160W 5000K 230VAC LED Floodlight", "N1000-P-2/160W.5000K"],
  ];

  for (const [tanim, tip] of yanlar) {
    it(`${tip} pano yanına asılır`, () => {
      expect(coz(tanim, tip, "MC").mountType).toBe("yan");
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
