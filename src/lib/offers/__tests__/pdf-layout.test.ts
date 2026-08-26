// İKİ SÜTUNLU TEKNİK YERLEŞİMİN KORUMA TESTLERİ.
//
// Sınanan şey güzellik değil, BELGENİN DOĞRULUĞUDUR. Dağıtımın bozulduğu her
// yol müşteriye giden bir kâğıtta biter ve üçü de sessizdir:
//
//   · SIRA — sütunları eşitlemek uğruna blokların yeri değişirse belge düzgün
//     görünür ama yanlış okunur (defterdeki sıra belgenin sırasıdır);
//   · KAYIP — bölünen bir grubun kuyruğu düşerse eksilen tek bir teknik satır
//     olur ve bunu ancak müşteri fark eder;
//   · TAŞMA — sütun bütçesi aşılırsa @react-pdf taşan satırı KIRPAR, hata
//     mesajı vermez.
//
// FİKSTÜR GERÇEKTİR. Satır etiketleri defterden (`registry.ts`), değerler
// `scripts/test-offer-pdf.ts`in HABAŞ deseninden gelir. O dosya doğrudan içe
// aktarılamaz (modül düzeyinde `main()` çağırıp PDF üretir), bu yüzden aynı
// değerler burada defterden kurulur — uydurma kısa metinlerle sarma da,
// bölünme de hiç görülmezdi.

import { describe, expect, it } from "vitest";
import { groupFromKey } from "../payload";
import {
  BASLIK_YUK,
  DEVAM_EKI,
  KAPASITE_PAYI,
  SUTUN_BOSLUK,
  SUTUN_GENISLIK,
  blokBasligi,
  grupYuksekligi,
  offerPdfSayfalari,
  satirYuksekligi,
  type OfferPdfBlok,
  type OfferPdfSayfa,
} from "../pdf-layout";
import { offerGroupShort } from "../registry";
import type { OfferGroup, OfferRow } from "../types";

/**
 * Teknik sayfanın SÜTUN BÜTÇESİ.
 *
 * İçerik alanı 745,69pt (`BrandPage`); sayfa başlığı bloğu (kicker + kalem adı
 * + alt pay) onun üstünden ~43pt alır ve çizim tarafı 45 ayırır
 * (`pdf/offer.tsx` `PDF_SUTUN_KAPASITE`). Kalan, iki sütunun her birine verilen
 * ham yüksekliktir; %94 kelepçesini modülün kendisi uygular.
 */
const SUTUN_KAPASITE = 745.69 - 45;

/** Modülün gerçekten kullandığı bütçe. */
const KELEPCELI = SUTUN_KAPASITE * KAPASITE_PAYI;

// ————————————————————————————————————————————————————————— fikstür

function grup(key: string, degerler: Record<string, string>): OfferGroup {
  const g = groupFromKey(key);
  for (const row of g.rows) {
    const v = degerler[row.key];
    if (v !== undefined) row.value = v;
  }
  return g;
}

function kapsamiMusteri(g: OfferGroup, key: string) {
  const row = g.rows.find((r) => r.key === key);
  if (row) row.scope = "customer";
}

/** HABAŞ deseninin teknik gövdesi: 20T çift kirişli gezer köprülü vinç. */
function vincGruplari(): OfferGroup[] {
  const genel = grup("general", {
    capacity: "20.000 kg",
    environment: "Kapalı Alan, -10 / +40 º C",
    span: "22,5 m",
    liftHeight: "8 m",
    craneClass: "FEM 2m / ISO M5 - ISO/FEM A5 H3/B4",
    // VİNÇ TİPİ SATIRI YOK (md. 3, emekliye ayrıldı) — tip kalem künyesindedir.
    // YÜRÜME YOLU ARTIK BİR ÖLÇÜDÜR (md. 4): defterdeki `runway` satırı sayı +
    // " m" parçası taşır, serbest cümle değil.
    runway: "96 m",
  });
  kapsamiMusteri(genel, "runway");

  const araba = grup("trolley", {
    travelSpeed: "2-20 m/dk – Frekans İnvertörlü",
    motor: "2 x 1,5 kW 1500 d/dak",
    gearbox: "YILMAZ R. VR Tipi",
    brake: "Elektromanyetik Motor Freni x 2 Adet",
    driveSystem: "2 Tekerden Tahrik",
    wheel: "4 x Ø315 DIN15090 C4140 35-42 HRC",
    controlType: "İnvertör Kontrollü",
  });
  kapsamiMusteri(araba, "brake");

  const elektrik = grup("electrical", {
    supplyVoltage: "400 VAC 50 Hz",
    controlVoltage: "220 – 24 VDC",
    runwayPower: "Kapalı Kutu Bara Tesisatı",
    busbar: "Vasel",
    pendant: "Elfatek EN-MİD Serisi",
    drives: "SCHNEIDER ATV-320",
    crossLimit: "Terr",
    drumLimit: "Stromag",
    powerSupply: "Omron",
    terminals: "Phoenix",
    loadcell: "Esit",
    signalization: "Mucco",
    cable: "Üntel",
    resistors: "Ressa",
    switchgear: "Schneider",
    panel: "EAE, Kiriş Üzeri",
    kst: "Dahil",
  });
  kapsamiMusteri(elektrik, "runwayPower");

  return [
    genel,
    grup("mainHoist", {
      liftSpeed: "1-6 m/dk – Çift Hız Kontrolü (Frekans İnvertörlü)",
      reeving: "4/1",
      motor: "GAMAK 22 kW 1500 d/dak, Encoderli, F/S3",
      gearbox: "YILMAZ R. HT Sandık Tipi, Delik Milli, Emniyet: 1,5",
      brake: "SIBRE Elektrohidrolik Kasnak Fren x 2 Adet",
      drive: "SCHNEIDER ATV-340",
      hook: "DIN 15401/P Tek Ağızlı Kanca",
      rope: "Ø16 6x36 Halat 1960 N/mm2 Çelik Özlü",
      controlType: "İnvertör Kontrollü",
    }),
    araba,
    grup("bridge", {
      // YÜRÜME YOLU RAYI SATIRI YOK (md. 5) — köprü rayı yeter.
      rail: "A45",
      travelSpeed: "3-30 m/dk – Frekans İnvertörlü",
      travelSystem: "4 Teker",
      driveSystem: "2 Tekerden Tahrik",
      motor: "2 x 5,5 kW 1500 d/dak",
      gearbox: "YILMAZ R. HT Tipi, Delik Milli",
      brake: "Elektromanyetik Motor Freni x 2 Adet",
      drive: "SCHNEIDER ATV-320",
      wheel: "4 x Ø400 DIN15090 C4140 35-42 HRC",
      bearings: "SKF",
      controlType: "İnvertör Kontrollü",
    }),
    grup("steel", {
      girder: "Kutu Çelik Konstrüksiyon, St52",
      girderCalc: "FEM / DIN15018 - 1/1000 Maksimum Sehim",
      girderMaterial: "S355JR",
      platform: "Çift Taraflı Yürüme Platformu",
      paint: "Kumlama + Astar + Son Kat, Renk : RAL1007 Sarı",
    }),
    elektrik,
  ];
}

/** Fikstürün ELEKTRİK öbeği. Kimlik her kurulumda yenidir; bir dağıtımın
 *  bloklarıyla eşleştirilecekse grup O dağıtımın listesinden alınmalıdır. */
function elektrikGrubu(gruplar: OfferGroup[] = vincGruplari()): OfferGroup {
  const g = gruplar.find((x) => x.key === "electrical");
  if (!g) throw new Error("fikstürde elektrik grubu yok");
  return g;
}

/**
 * Tek sütuna sığmayacak kadar uzun bir öbek.
 *
 * Satırlar UYDURULMAZ, gerçek elektrik satırları döndürülerek çoğaltılır:
 * yerleşim metnin uzunluğuna bakar ve "Satır 37" gibi kısa dizgilerle hiçbir
 * sarma görülmezdi.
 */
function uzunGrup(n: number): OfferGroup {
  const kaynak = elektrikGrubu().rows;
  return {
    id: "uzun",
    key: "custom",
    title: "UZUN ÖBEK",
    rows: kaynak.slice(0, n).concat(
      Array.from({ length: Math.max(0, n - kaynak.length) }, (_, i) => ({
        ...kaynak[i % kaynak.length],
        key: `uzun-${i}`,
      }))
    ),
  };
}

// ————————————————————————————————————————————————————————— yardımcı

/** Okuma sırasına göre düzleştirilmiş bloklar: sayfa sayfa, sol sonra sağ. */
function duzBloklar(sayfalar: OfferPdfSayfa[]): OfferPdfBlok[] {
  return sayfalar.flatMap((s) => [...s.sol, ...s.sag]);
}

/** Grup kimliğiyle nitelenmiş satır anahtarı — "motor" iki grupta da geçer. */
function satirKimligi(group: OfferGroup, row: OfferRow): string {
  return `${group.id}:${row.key}`;
}

function sutunYuku(sutun: OfferPdfBlok[]): number {
  return sutun.reduce((t, b) => t + b.h, 0);
}

// ————————————————————————————————————————————————————————— ölçüler

describe("ölçülmüş taban", () => {
  it("iki sütun + oluk içerik alanını tam doldurur", () => {
    expect(SUTUN_GENISLIK).toBeCloseTo(234.78, 2);
    expect(SUTUN_GENISLIK * 2 + SUTUN_BOSLUK).toBeCloseTo(487.56, 2);
  });

  it("KAPSAM EKİ değerin uzunluğuna girer ve satırı sarabilir", () => {
    // Gerçek fikstür satırı: `Hol Boyu Elektrik : Kapalı Kutu Bara Tesisatı`
    // eksiz tek satırdır, " (Müşteri Kapsamında)" ekiyle ikiye çıkar. Ek
    // ölçüye girmeseydi bu satır sütun dibinde sessizce taşardı.
    const row = elektrikGrubu().rows.find((r) => r.key === "runwayPower");
    if (!row) throw new Error("fikstürde runwayPower satırı yok");
    expect(row.scope).toBe("customer");
    // Gerçek etiket iki satır olduğu için ekin getirdiği ikinci değer satırı
    // toplam yüksekliği değiştirmeyebilir. Etiketi kısaltarak burada yalnız
    // DEĞER sarmasını ölçeriz.
    const kapsamli: OfferRow = { ...row, label: "BARA" };
    const eksiz: OfferRow = { ...kapsamli, scope: undefined };
    expect(satirYuksekligi(kapsamli)).toBeGreaterThan(satirYuksekligi(eksiz));
  });

  /**
   * ÖLÇÜ, ÇİZİMİN MODELİDİR — VE BU, ÇİZİM TARAFINA VERİLMİŞ BİR SÖZDÜR.
   *
   * Satır iki SABİT kutudur: etiket solda %34, değer sağda kalan yerde ve
   * sağa yaslı (`pdf/offer.tsx` `OzellikSatiri`). Değer sardığında ikinci satır
   * etiketin altına taşmaz, kendi sütununda kalır — ölçü de bu yüzden değeri
   * `SUTUN_GENISLIK − etiket − oluk` genişliğine sarar.
   *
   * Eskiden ölçü bir AKIŞ modeliydi (etiket ve değer tek akışta, sarma noktası
   * sütunun tamamına göre) ve çizim de öyleydi. Düzen 18.08.2026'da çizelgeye
   * dönünce akış modeli EKSİK ölçmeye başladı: aynı satır akışta bir, sütunda
   * iki satır çiziyordu. Eksik ölçmek modülün adını koyarak reddettiği yöndür
   * (bkz. `KAPASITE_PAYI`) — @react-pdf taşan satırı SESSİZCE kırpar.
   *
   * Aşağıdaki sayı bir güzellik değil bir SÖZLEŞME dondurur: düşerse model
   * değişmiştir ve çizimle birlikte gözden geçirilmesi gerekir.
   */
  it("ÖLÇÜ SABİT İKİ SÜTUNDUR: uzun değer ikinci satıra kendi alanında iner", () => {
    const kaldirma = vincGruplari().find((g) => g.key === "mainHoist");
    const fren = kaldirma?.rows.find((r) => r.key === "brake");
    if (!fren) throw new Error("fikstürde kaldırma freni satırı yok");
    expect(fren.label).toBe("Fren");
    expect(fren.value).toBe("SIBRE Elektrohidrolik Kasnak Fren x 2 Adet");

    // Etiket sabit 234,78 × %34 = 79,8pt; değere 145pt kalır. Değer mono
    // 42 karakter × 4,44 = 186,5pt'tir ve iki satıra iner: 2 × 10 + 3,2.
    expect(satirYuksekligi(fren)).toBeCloseTo(23.2, 6);

    // Kısa etiket değere daha fazla yer AÇMAZ; bütün değerler aynı x
    // noktasından başlar. Kullanıcının bildirdiği iç içe görünümü bu
    // sabitlik kapatır.
    expect(satirYuksekligi({ ...fren, label: "X" })).toBe(satirYuksekligi(fren));

    // Etiket kendi sabit alanında üç satıra çıkarsa satır elbette büyür;
    // fakat DEĞER alanı daralmaz.
    const uzunEtiket = {
      ...fren,
      label: "Kaldırma Grubu Fren Donanımı Tipi ve Emniyet Sisteminin Teknik Tanımı",
    };
    expect(satirYuksekligi(uzunEtiket)).toBeGreaterThan(satirYuksekligi(fren));

    // Patolojik serbest etiket de sonlu kalır; değer alanını yiyemez.
    const devEtiket = { ...fren, label: "Kaldırma".repeat(12) };
    expect(satirYuksekligi(devEtiket)).toBeLessThan(200);
  });

  it("basılmayan grup bütçeden yer yemez", () => {
    const g = elektrikGrubu();
    expect(grupYuksekligi({ ...g, hidden: true })).toBe(0);
    expect(grupYuksekligi({ ...g, rows: [] })).toBe(0);
    // Grup yüksekliği = başlık + satırlar; başlık bloğun İÇİNDEDİR.
    const satirToplami = g.rows.reduce((t, r) => t + satirYuksekligi(r), 0);
    expect(grupYuksekligi(g)).toBeCloseTo(BASLIK_YUK + satirToplami, 6);
  });
});

// ————————————————————————————————————————————————————————— dağıtım

describe("offerPdfSayfalari — gerçek teklif gövdesi", () => {
  const gruplar = vincGruplari();
  const sayfalar = offerPdfSayfalari(gruplar, SUTUN_KAPASITE);


  it("SIRA KORUNUR: blokların düz sırası girdi sırasıdır", () => {
    const bloklar = duzBloklar(sayfalar);
    // Devam dilimleri aynı grubu tekrar eder; sıra sorusu grupların sırasıdır.
    const sira = bloklar
      .map((b) => b.group.id)
      .filter((id, i, hepsi) => i === 0 || hepsi[i - 1] !== id);
    expect(sira).toEqual(gruplar.map((g) => g.id));
  });

  it("HİÇBİR SATIR KAYBOLMAZ ve satır sırası da korunur", () => {
    const basilan = duzBloklar(sayfalar).flatMap((b) =>
      b.rows.map((r) => satirKimligi(b.group, r))
    );
    const beklenen = gruplar.flatMap((g) => g.rows.map((r) => satirKimligi(g, r)));
    expect(basilan).toEqual(beklenen);
    // Altı öbek, 66 satır — defterin bir vinç için getirdiği tam gövde.
    // 68 İDİ: `GENEL ÖZELLİKLER > Vinç Tipi` (md. 3) ve `KÖPRÜ > Yürüme Yolu
    // Rayı` (md. 5) emekliye ayrıldı. Sayı burada DONDURULUR ki defterden
    // sessizce bir satır düşmesi bu testte görünsün.
    expect(basilan.length).toBe(67);
  });

  it("HİÇBİR SÜTUN kelepçelenmiş bütçeyi aşmaz", () => {
    for (const s of sayfalar) {
      expect(sutunYuku(s.sol)).toBeLessThanOrEqual(KELEPCELI);
      expect(sutunYuku(s.sag)).toBeLessThanOrEqual(KELEPCELI);
    }
  });

  it("tam gövde TEK YAPRAĞIN İKİ SÜTUNUNA sığar", () => {
    // 68 satırlık gövde İKİ yapraktı ve sınıra çok yakındı; iki satırın
    // emekliye ayrılması (md. 3 ve md. 5) onu tek yaprağa indirdi. Sayı
    // dondurulur: müşteriye giden belgenin kaç yaprak olduğu bir yan etki
    // değil, defterde satır açıp kapatırken bilinmesi gereken bir sonuçtur.
    expect(sayfalar).toHaveLength(1);
    expect(sayfalar[0].sol.length).toBeGreaterThan(0);
    expect(sayfalar[0].sag.length).toBeGreaterThan(0);
    // İki sütun da dolu: sıkıştırma değil, sıranın doğal akışı.
    expect(sutunYuku(sayfalar[0].sol)).toBeGreaterThan(KELEPCELI * 0.9);
    expect(sutunYuku(sayfalar[0].sag)).toBeGreaterThan(KELEPCELI * 0.9);
  });

  it("başlıklar sayfadaki öbekleri SIRAYLA, YİNELENMEDEN ve KISA ADIYLA listeler", () => {
    for (const s of sayfalar) {
      const sayfaninGruplari = [...s.sol, ...s.sag]
        .map((b) => offerGroupShort(b.group.key, b.group.title))
        .filter((t, i, hepsi) => hepsi.indexOf(t) === i);
      expect(s.basliklar).toEqual(sayfaninGruplari);
      expect(new Set(s.basliklar).size).toBe(s.basliklar.length);
    }
    // KISA AD, TAM BAŞLIK DEĞİL: sayfa başlığı altı grupta üç satır sürerdi.
    // Kullanıcının paylaştığı ön çalışmanın düzeni budur ("GENEL · KALDIRMA ·
    // ARABA"); kısaltmalar defterde YAZILIDIR (`OFFER_GROUP_SHORT`), koddan
    // ek atarak türetilmez.
    expect(sayfalar[0].basliklar).toEqual([
      "GENEL",
      "KALDIRMA",
      "ARABA",
      "KÖPRÜ",
      "ÇELİK",
      "ELEKTRİK",
    ]);
  });

  it("22 SATIRLIK ELEKTRİK GRUBU bütün hâlinde yerleşir", () => {
    const elektrik = elektrikGrubu(gruplar);
    // Defterdeki öbek 21 satırdır ve kendi başına bir sütuna sığar. Gövde
    // kısalınca (md. 3 ve md. 5) sağ sütunun başına denk geldi ve artık
    // BÖLÜNMÜYOR. Bölünme kuralının kendisi hâlâ sınanır — bir alttaki köprü
    // testinde ve "bölünme" öbeğindeki uzun grup testlerinde.
    expect(elektrik.rows).toHaveLength(22);
    expect(grupYuksekligi(elektrik)).toBeLessThanOrEqual(KELEPCELI);

    const dilimler = duzBloklar(sayfalar).filter((b) => b.group.id === elektrik.id);
    expect(dilimler).toHaveLength(1);
    expect(dilimler[0].devam).toBe(false);
    expect(dilimler[0].rows).toHaveLength(22);
  });

  it("BÖLÜNEN KÖPRÜ GRUBU tek satır kaybetmez", () => {
    // Sütun dibine denk gelen öbek bölünür; belge sırası korunduğu için
    // devam dilimi bir SONRAKİ SÜTUNUN başına girer. Sığıyor diye sırayı bozup
    // bloğu bütün hâlinde sağa atmak daha dengeli ama yanlış bir belge
    // üretirdi.
    const kopru = gruplar.find((g) => g.key === "bridge");
    if (!kopru) throw new Error("fikstürde köprü grubu yok");
    const dilimler = duzBloklar(sayfalar).filter((b) => b.group.id === kopru.id);
    expect(dilimler).toHaveLength(2);
    expect(dilimler[0].devam).toBe(false);
    expect(dilimler[1].devam).toBe(true);
    expect(dilimler.reduce((t, b) => t + b.rows.length, 0)).toBe(kopru.rows.length);
  });

  it("EN AZ İKİ SATIR: hiçbir blok yalnız başlıkla ya da tek satırla yerleşmez", () => {
    for (const b of duzBloklar(sayfalar)) {
      expect(b.rows.length).toBeGreaterThanOrEqual(Math.min(2, b.group.rows.length));
    }
  });

  /**
   * SOL SÜTUN DOLDURULUR — blok DENGE için sağa kaydırılmaz.
   *
   * "Sıra korunur, denge aranmaz" kuralının test edilebilir hâli budur. Sıra
   * testi tek başına yetmez: sütunları eşitleyen bir uygulama da grupların
   * sırasını bozmadan çalışabilir (ÇELİK KONSTRÜKSİYON'u sol sütunda yer
   * varken sağa alarak). Burada sorulan şey sıradan sonraki soru: sağa geçen
   * blok soldan TAŞTIĞI için mi geçti?
   *
   * Ölçülen: sol sütunda 18,3pt kalıyor, sağa geçen ÇELİK KONSTRÜKSİYON'un
   * başlığı + ilk satırı 35,0pt. Yani blok gerçekten sığmıyordu.
   */
  it("SOL SÜTUN DOLDURULUR: sağa geçen blok soldan taştığı için geçer", () => {
    for (const s of sayfalar) {
      const ilkSag = s.sag[0];
      if (!ilkSag) continue;
      const solKalan = KELEPCELI - sutunYuku(s.sol);
      // Bloğun sola sığması için başlığı ve İLK satırı sığmalıydı; ikisi de
      // bölünemez (başlık bloğun içindedir, satır `wrap={false}` çizilir).
      expect(BASLIK_YUK + satirYuksekligi(ilkSag.rows[0])).toBeGreaterThan(solKalan);
    }
  });

  /**
   * KAPASİTE PAYI ÖLÇÜLEN BİR KARARDIR, bir süs değil.
   *
   * Bütün bütçe savları paydan TÜREDİĞİ için pay 1'e çekilse hiçbiri düşmezdi
   * — kelepçe sessizce kaldırılabilirdi. Bu test payı hem sabitler hem de NE
   * SATIN ALDIĞINI gösterir: aynı gövdede ÇELİK KONSTRÜKSİYON öbeği kelepçe
   * varken sağ sütuna geçer, kelepçe kalkarsa sol sütunun DİBİNE oturur —
   * ortalama karakter genişliğiyle ölçülmüş bir yerleşimde sayfa dibi tam da
   * yanılmanın en pahalı olduğu yerdir.
   */
  it("KAPASİTE PAYI dağıtımı gerçekten değiştirir", () => {
    expect(KAPASITE_PAYI).toBe(0.94);

    const kelepceli = offerPdfSayfalari(gruplar, SUTUN_KAPASITE);
    // Payı geri çarpmak kelepçeyi iptal eder: modül aynı ham bütçeye döner.
    const kelepcesiz = offerPdfSayfalari(gruplar, SUTUN_KAPASITE / KAPASITE_PAYI);

    // ÖLÇÜLEN: KÖPRÜ GRUBU iki sütuna bölünür ve BÖLÜNME NOKTASI kayar —
    // kelepçe varken sol sütunda 4 satır kalır, kelepçe kalkarsa 7. Yani
    // kelepçenin satın aldığı şey sütun dibindeki 42pt'lik boşluktur; ortalama
    // karakter genişliğiyle ölçülmüş bir yerleşimde sayfa dibi tam da
    // yanılmanın en pahalı olduğu yerdir.
    const koprununDilimleri = (s: OfferPdfSayfa[]) =>
      [...s[0].sol, ...s[0].sag].filter((b) => b.group.key === "bridge").map((b) => b.rows.length);
    expect(koprununDilimleri(kelepceli)).toEqual([4, 7]);
    expect(koprununDilimleri(kelepcesiz)).toEqual([7, 4]);
    // Kelepçenin bıraktığı dip boşluğu: bir satırın sığıp sığmadığını belirler.
    expect(SUTUN_KAPASITE - KELEPCELI).toBeCloseTo(42.04, 2);
  });
});

// ————————————————————————————————————————————————————————— bölünme

describe("offerPdfSayfalari — bölünme", () => {
  it("sütuna sığmayan grup BÖLÜNÜR; ikinci dilim devam:true taşır", () => {
    const uzun = uzunGrup(60);
    expect(grupYuksekligi(uzun)).toBeGreaterThan(KELEPCELI);

    const sayfalar = offerPdfSayfalari([uzun], SUTUN_KAPASITE);
    const bloklar = duzBloklar(sayfalar);
    expect(bloklar.length).toBeGreaterThan(1);
    expect(bloklar[0].devam).toBe(false);
    expect(bloklar[1].devam).toBe(true);
    // Devam dilimi başlığını TEKRAR basar — fiyat tablosunun `fixed` başlık
    // satırıyla aynı ilke.
    expect(blokBasligi(bloklar[0])).toBe("UZUN ÖBEK");
    expect(blokBasligi(bloklar[1])).toBe(`UZUN ÖBEK${DEVAM_EKI}`);
    // Bölünse de tek satır kaybolmaz.
    expect(bloklar.reduce((t, b) => t + b.rows.length, 0)).toBe(60);
    // İkinci dilim yalnız bir satırla açılmaz.
    for (const b of bloklar) expect(b.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("bölünen grup önce SOL sütunu bitirir, sonra sağa geçer", () => {
    const sayfalar = offerPdfSayfalari([uzunGrup(60)], SUTUN_KAPASITE);
    expect(sayfalar).toHaveLength(1);
    expect(sayfalar[0].sol).toHaveLength(1);
    expect(sayfalar[0].sag).toHaveLength(1);
    // Sol sütun DOLDUĞU için taşındı: kalan yer bir satır daha almıyordu.
    const sol = sayfalar[0].sol[0];
    const ilkKuyruk = sayfalar[0].sag[0].rows[0];
    expect(sol.h + satirYuksekligi(ilkKuyruk)).toBeGreaterThan(KELEPCELI);
  });

  it("başlık sayfa başına BİR KEZ girer, devam dilimi ikinci kez yazmaz", () => {
    const sayfalar = offerPdfSayfalari([uzunGrup(60)], SUTUN_KAPASITE);
    expect(sayfalar[0].basliklar).toEqual(["UZUN ÖBEK"]);
  });

  /**
   * BAŞLIK LİSTESİ SAYFA BAŞINA TEKİLLEŞTİRİLİR, BELGE BAŞINA DEĞİL.
   *
   * İki okuma mümkündü ve ikisi ayrı belge üretir: "ad yalnız grubun BAŞLADIĞI
   * sayfada geçer" denseydi, bir sayfayı baştan sona dolduran devam dilimi o
   * sayfanın başlık listesinde HİÇ görünmezdi — liste "bu sayfada ne var"
   * sorusunun cevabı olmaktan çıkar, bir sayfa öncesine bakmayı gerektirirdi.
   *
   * Seçilen okuma: liste O SAYFADA görünen öbeklerin adlarıdır. 120 satırlık
   * öbek iki sayfaya yayılır ve adı ikinci sayfanın listesinde de durur; aynı
   * sayfanın iki sütununa yayıldığında ise bir kez geçer (üstteki test).
   */
  it("SAYFAYI AŞAN grup ikinci sayfanın başlık listesine de girer", () => {
    const sayfalar = offerPdfSayfalari([uzunGrup(120)], SUTUN_KAPASITE);
    expect(sayfalar).toHaveLength(2);
    expect(sayfalar[0].basliklar).toEqual(["UZUN ÖBEK"]);
    expect(sayfalar[1].basliklar).toEqual(["UZUN ÖBEK"]);

    // İkinci sayfanın dilimi kendini "devamı" diye tanıtır — okuyucu bir
    // önceki yaprağa dönmek zorunda kalmaz.
    const ikinciSayfa = [...sayfalar[1].sol, ...sayfalar[1].sag];
    expect(ikinciSayfa.every((b) => b.devam)).toBe(true);
    expect(blokBasligi(ikinciSayfa[0])).toBe(`UZUN ÖBEK${DEVAM_EKI}`);

    // İki sayfaya yayılırken de tek satır düşmez.
    expect(duzBloklar(sayfalar).reduce((t, b) => t + b.rows.length, 0)).toBe(120);
  });

  it("bir sütunda tek satırlık kuyruk bırakmaktansa satır AŞAĞI itilir", () => {
    // Bütçe, son satırın YARISI kadar eksik seçilir: açgözlü doldurma 29
    // satırı yerleştirir ve geriye TEK satır kalır. Kural devredeyse bir satır
    // aşağı itilir ve devam dilimi iki satırla açılır.
    const g = uzunGrup(30);
    const yukler = g.rows.map(satirYuksekligi);
    const tam = BASLIK_YUK + yukler.reduce((t, h) => t + h, 0);
    const hedef = (tam - yukler[yukler.length - 1] / 2) / KAPASITE_PAYI;

    const bloklar = duzBloklar(offerPdfSayfalari([g], hedef));
    expect(bloklar).toHaveLength(2);
    expect(bloklar[0].rows).toHaveLength(28);
    expect(bloklar[1].rows).toHaveLength(2);
  });
});

// ————————————————————————————————————————————————————————— uç durumlar

describe("offerPdfSayfalari — uç durumlar", () => {
  it("boş grup listesi boş sayfa dizisi döndürür", () => {
    expect(offerPdfSayfalari([], SUTUN_KAPASITE)).toEqual([]);
  });

  it("tek gruplu belge tek sayfa / tek sütundur", () => {
    const elektrik = elektrikGrubu();
    const sayfalar = offerPdfSayfalari([elektrik], SUTUN_KAPASITE);
    expect(sayfalar).toHaveLength(1);
    expect(sayfalar[0].sol).toHaveLength(1);
    expect(sayfalar[0].sag).toEqual([]);
    expect(sayfalar[0].basliklar).toEqual(["ELEKTRİK"]);
  });

  it("gizli grup ve gizli satır dağıtıma HİÇ girmez", () => {
    // Çağıran `printedPayload`dan geçirir; bu yalnız savunmadır.
    const [genel, ...kalan] = vincGruplari();
    const gizliGrup = { ...kalan[0], hidden: true };
    const gizliSatirli: OfferGroup = {
      ...genel,
      rows: genel.rows.map((r, i) => (i === 0 ? { ...r, hidden: true } : r)),
    };
    const sayfalar = offerPdfSayfalari([gizliSatirli, gizliGrup], SUTUN_KAPASITE);
    const bloklar = duzBloklar(sayfalar);
    expect(bloklar).toHaveLength(1);
    expect(bloklar[0].rows).toHaveLength(genel.rows.length - 1);
    expect(bloklar[0].rows.some((r) => r.key === genel.rows[0].key)).toBe(false);
  });

  it("satırsız grup sayfa da başlık da açmaz", () => {
    const bos: OfferGroup = { id: "bos", key: "custom", title: "BOŞ ÖBEK", rows: [] };
    expect(offerPdfSayfalari([bos], SUTUN_KAPASITE)).toEqual([]);
  });

  it("kullanılabilir yükseklik yoksa dağıtım yapılmaz", () => {
    const g = elektrikGrubu();
    expect(offerPdfSayfalari([g], 0)).toEqual([]);
    expect(offerPdfSayfalari([g], Number.NaN)).toEqual([]);
  });

  it("boş sütuna bile sığmayan blok İLERLEMEYİ kilitlemez", () => {
    // Patolojik bütçe: tek satır bile sığmıyor. Sonsuz döngü sessiz bir
    // kilittir; taşarak basmak görünür bir hatadır ve yeğlenir.
    const sayfalar = offerPdfSayfalari([uzunGrup(6)], 25);
    expect(duzBloklar(sayfalar).reduce((t, b) => t + b.rows.length, 0)).toBe(6);
  });
});
