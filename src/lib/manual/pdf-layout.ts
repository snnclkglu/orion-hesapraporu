// EL KİTABI PDF'İNİN İKİ SÜTUNLU YERLEŞİMİ — saf çekirdek (DB/HTTP/React yok).
//
// Kullanıcı isteği (19.08.2026): *"PDF'te sayfayı bölebildiğin her yerde
// yatayda ikiye böl, daha kompakt ve düzgün bir doküman istiyorum"* — ve
// örnek olarak TEKLİF PDF'i verildi. Bu dosya `offers/pdf-layout.ts`in
// kardeşidir ve ondan öğrendiklerini taşır.
//
// NEDEN GEREKLİ (ölçüldü, kullanıcının indirdiği ORC-BK-0019-00-R01, 34 sayfa):
// her ana bölüm kendi yaprağında başlıyordu ve sayfalar yarı boş kalıyordu —
// 6. sayfada 776, 8. sayfada 604 karakter. Bir kılavuz vincin yanında asılı
// durur ve okuyan onu ayakta çevirir; boş yaprak orada bedeldir.
//
// DAĞITIM BURADA, ÇİZİM `pdf/manual.tsx`TE. @react-pdf'in kırma motoru SAYFA
// kırar, SÜTUN kırmaz: iki `View`in yan yana durması, birincisi dolunca
// içeriğin ikincisine akmasını sağlamaz. Akışın nereye gideceği bu yüzden
// çizimden ÖNCE karara bağlanır ve karar bir VERİDİR — çizerken verilen bir
// karar sınanamazdı.
//
// ÖLÇÜ YAKLAŞIKTIR VE BİLEREK FAZLA ÖLÇER (`KAPASITE_PAYI`, teklifin dersi):
// fazla ölçmek sütunu erken kapatır, dipte bir parmak boşluk kalır. Eksik
// ölçmek satırı sayfa dışına taşırır ve @react-pdf taşanı SESSİZCE kırpar —
// bir bakım talimatının yarısının kaybolması, boş bir dipten kat kat kötüdür.

import { blockHasContent } from "./payload";
import type { NumberedSection } from "./payload";
import { markSlotWidth } from "./marks";
import { autoTableFor, type ManualSourceData } from "./sources";
import type { ManualBlock, ManualTable } from "./types";

// ————————————————————————————————————————————————————————————— ölçüler
//
// `pdf/brand.tsx`in ve `pdf/manual.tsx`in GERÇEĞİDİR ama oradan içe
// AKTARILAMAZ (o dosyalar React ve @react-pdf taşır, bu çekirdek taşımaz).
// Sayı kopyalanmaz, ARİTMETİĞİ tekrarlanır: marj değişirse buradaki türetme de
// yanlış cevap verir ve donmuş test düşer.

const A4_GENISLIK = 595.28;
const A4_YUKSEKLIK = 841.89;
const mm = (n: number) => (n * 72) / 25.4;

/** `BrandPage` içerik alanı: A4 − (omurga 8 + iç marj 14) − dış marj 16. */
const ICERIK_GENISLIK = A4_GENISLIK - mm(8 + 14) - mm(16);

/** İçerik yüksekliği: A4 − üst marj 16 − (alt marj 13 + altbilgi 14). */
export const ICERIK_YUKSEKLIK = A4_YUKSEKLIK - mm(16) - (mm(13) + 14);

/**
 * Her gövde yaprağındaki ortak marka bandı.
 *
 * PDF ve tarayıcı önizlemesi aynı iki sayıyı okur. Akış yüksekliği sütun
 * kapasitesinden düşülmezse dağıtıcı kâğıtta var olmayan 48 pt'yi kullanır
 * ve @react-pdf son satırları sessizce kırpar.
 */
export const MANUAL_UST_BANT_YUKSEKLIK = 40;
export const MANUAL_UST_BANT_ALT_BOSLUK = 8;
export const MANUAL_UST_BANT_AKIS = MANUAL_UST_BANT_YUKSEKLIK + MANUAL_UST_BANT_ALT_BOSLUK;

/** Marka bandından sonra gövde atomlarına gerçekten kalan yükseklik. */
export const MANUAL_GOVDE_YUKSEKLIK = ICERIK_YUKSEKLIK - MANUAL_UST_BANT_AKIS;

/**
 * İçindekilerde bir yaprağa sığan azami bölüm satırı.
 *
 * PDF ile tarayıcı önizlemesi aynı ofseti kullanmalıdır; bu sayı iki tarafta
 * ayrı yazılırsa editörde görülen sayfa numarası teslim PDF'inden bir yaprak
 * sapar. 70 satır, gövde dizininde sütun başına 35 kısa satıra karşılık
 * gelir. Yeni dizin satırları 18 pt taban yüksekliğinde ve ana bölümler bantlı
 * olduğundan, uzun başlıkların sarma payı için sütun başına en çok 32 satır
 * kullanılır. Standart kılavuz dizini böylece tek yaprakta kalır.
 */
export const MANUAL_DIZIN_SAYFA_KAPASITESI = 64;

/** Sütunlar arası oluk — teklifle aynı gerekçe (bkz. `offers/pdf-layout.ts`). */
export const SUTUN_BOSLUK = 18;

export const SUTUN_GENISLIK = (ICERIK_GENISLIK - SUTUN_BOSLUK) / 2;

/** Tam genişlik bandı — geniş tablolar ve büyük görseller buraya düşer. */
export const TAM_GENISLIK = ICERIK_GENISLIK;

/**
 * SÜTUN BÜTÇESİ %94'E KELEPÇELENİR ve ölçüler BİLEREK FAZLA ölçer.
 *
 * Sayı `offers/pdf-layout.ts` ile aynıdır ve DENENDİ: 0,96 · 0,97'de belge
 * yine 22 sayfa çıkıyor (hiçbir şey kazanılmıyor), 0,98'de 21'e iniyor ama
 * geriye ~15 pt emniyet payı kalıyor. Bir güvenlik kılavuzunda tek sayfa
 * uğruna sessiz kırpılma riskini almak yanlış tarafa yanılmaktır — @react-pdf
 * taşan içeriği uyarmadan keser ve kaybolan şey bir bakım talimatı olur.
 *
 * Dipteki boşluğun asıl sebebi bu pay değil BÖLÜNEMEYEN ATOMlardır (uyarı
 * kutusu, görsel); liste ve tablo zaten `atomuBol` ile sütunu doldurur.
 */
export const KAPASITE_PAYI = 0.94;

// —————————————————————————————————————————————————————————— tipografi

/** Gövde metni: 8,5 punto × 1,5 satır yüksekliği. */
const GOVDE_PUNTO = 8.5;
const GOVDE_SATIR = GOVDE_PUNTO * 1.5;

/**
 * Archivo KARIŞIK YAZIMDA karakter başına 0,482 em ölçüldü (teklifin fontkit
 * ölçümü). 0,50 yazılır — fazla ölçmek seçilmiş yöndür.
 */
const SANS_KATSAYI = 0.5;

/** IBM Plex Mono SABİT genişliktir: her karakter tam 0,6 em. */
const MONO_KATSAYI = 0.6;

/** Tablo hücresi: 7,5 punto × 1,35 + 3+3 dolgu. */
const TABLO_PUNTO = 7.5;
const TABLO_SATIR = TABLO_PUNTO * 1.35;
const TABLO_HUCRE_PAY = 6;
/**
 * React-pdf satır kutusuna font metriklerinden gelen küçük fazlalık.
 *
 * Yalnız teorik `punto × lineHeight + padding` kullanıldığında 20+ satırlık
 * tam geniş tablolarda fark birikiyor ve son satırlar çerçevesiz örtük bir
 * sayfaya taşıyordu (0019, 7.4). İki punto emniyet, ölçümün seçilmiş yönünü
 * yeniden "biraz fazla" yapar.
 */
const TABLO_SATIR_EMNIYET = 2;

/** Tam geniş devam sayfasında tek tabloda basılacak azami veri satırı. */
const TAM_TABLO_DILIM_SATIRI = 14;

/**
 * Başlık yükleri — `pdf/manual.tsx`teki `s.h1…s.h4` stillerinden.
 * (punto × 1,2 satır) + üst pay + alt pay.
 */
const BASLIK_YUK = [14 * 1.2 + 14 + 5, 11 * 1.2 + 10 + 4, 9.5 * 1.2 + 8 + 3, 9 * 1.2 + 6 + 2];

/** Paragraf altı payı (`s.p.marginBottom`). */
const PARAGRAF_PAY = 4;

/** Kenar notu satırı (7,5 punto + 2 alt pay). */
const KENAR_NOT_YUK = 7.5 * 1.2 + 2;

/** Madde satırı: 8,5 punto × 1,45 satır yüksekliği + 2 pt alt pay. */
const MADDE_YUK = GOVDE_PUNTO * 1.45 + 2;

/** Uyarı kutusu dış kabuğu: 6+6 dolgu + 5+5 dikey pay. */
const KUTU_DIS_PAY = 6 + 6 + 5 + 5;

/** Uyarı kutusu başlığı (8 punto × 1,2 + 2 alt pay). */
const KUTU_BASLIK_YUK = 8 * 1.2 + 2;

/** PDF'deki vektör işaretinin boyu ve metinle arasındaki oluk. */
const NOT_PIKTOGRAM_BOY = 15;
const NOT_PIKTOGRAM_OLUK = 6;
export const NOT_PIKTOGRAM_SLOT_PAYI = markSlotWidth(NOT_PIKTOGRAM_BOY) + NOT_PIKTOGRAM_OLUK;

/** Tablo altyazısı (7 punto + 2 üst pay). */
const ALTYAZI_YUK = 7 * 1.2 + 2;

/** Görselin dikey payı (`marginVertical: 6` iki yandan). */
const GORSEL_PAY = 12;

/**
 * Vektör sinyal çizelgesinin yüksekliği (`pdf/manual-marks.tsx` ile aynı
 * stil aritmetiği). Saf çekirdek React bileşenini içe aktaramaz; boyutlar
 * burada çizimdeki sayılardan yeniden türetilir.
 */
const SINYAL_PIKT_BOY = 22;
const SINYAL_SATIR_PAY = 4;
export const SINYAL_CIZELGE_YUKSEKLIGI =
  6.5 * 1.2 + 6 + 0.75 + 5 * (SINYAL_PIKT_BOY + 2 * SINYAL_SATIR_PAY + 0.4) + 12;

/**
 * TABLO TAM GENİŞLİK İSTER Mİ — SÜTUN SAYARAK DEĞİL, ÖLÇEREK.
 *
 * İlk kural "dört sütundan geniş tablo tam genişliğe düşer" idi ve yanlış
 * çıktı (ölçüldü, s. 16-17): beş sütunlu ama hücreleri kısa bir ekipman
 * listesi (Ekipman · Marka · Model · Adet · Grup) yarım sütunda RAHAT
 * okunuyor; tam genişliğe düşünce tek satırlık bir tablo koca bir yaprağı
 * kaplıyor ve başlığından koparak bir önceki sayfada kalıyordu.
 *
 * Doğru soru sütun sayısı değil SIKIŞMA'dır: aynı tablo dar kapta ne kadar
 * uzuyor? Hücreleri kısaysa neredeyse hiç (satırlar sarmaz); uzunsa katlanır.
 * Eşik 1,6'dır — dar kapta yarıdan fazla uzayan tablo sıkışıyor demektir.
 */
export const TAM_GENISLIK_SISME_ESIGI = 1.6;

/**
 * Görsel tam genişlik bandına DÜŞER mi?
 *
 * Sayfa genişliğinin yarısından fazlasını isteyen bir görsel yarım sütunda
 * küçültülürse okunmaz olur — bir HMI ekran görüntüsünün yazısı zaten küçük.
 * ŞABLON AÇIKÇA İSTEYEBİLİR (`fullWidth`): halat hasar şekilleri geniş ve
 * alçaktır, yarım sütunda da okunur ve orada iki kolona yayılınca sayfa
 * yarı yarıya kısalır (ölçüldü: s. 12'de bandın %40'ı boştaydı).
 */
export const TAM_GENISLIK_GORSEL_ESIGI = 55;

// ————————————————————————————————————————————————————————————— tipler

/**
 * Yerleşimin en küçük parçası.
 *
 * ÇOĞU ATOM BÖLÜNMEZ ama LİSTE VE TABLO BÖLÜNEBİLİR. Bölünmeselerdi dokuz
 * maddelik bir liste sütunun dibine sığmadığında oraya koca bir boşluk
 * bırakırdı (ölçüldü: s. 8 ve s. 10'da sütunun dörtte biri boştu). Teklif
 * PDF'i aynı sorunu `blokBol` ile çözüyor; buradaki onun karşılığıdır.
 *
 * DİLİM ASLINI DEĞİŞTİRMEZ: `block` bölünse de aynı nesnedir, dilime ait
 * olan `items`/`rows`tur. Kopya bir blok üretilseydi iki dilim iki ayrı blok
 * gibi görünür ve `id` ile kurulan bağ kopardı.
 */
export type ManualAtom =
  | { kind: "heading"; section: NumberedSection; h: number; tam: boolean }
  | {
      kind: "block";
      block: ManualBlock;
      table?: ManualTable;
      h: number;
      tam: boolean;
      /** Bu dilim bir öncekinin DEVAMI — tablo başlığı tekrar basılır. */
      devam?: boolean;
      /** Liste dilimi: bu dilimde basılacak maddeler. */
      items?: string[];
      /** Liste diliminin ilk maddesinin 0 tabanlı sırası (numaralı listede). */
      itemOffset?: number;
      /** Liste diliminde sonuç satırı basılır mı (yalnız SON dilimde). */
      sonuc?: boolean;
      /** Tablo dilimi: bu dilimde basılacak satırlar. */
      rows?: string[][];
      /** Tablo diliminde altyazı basılır mı (yalnız SON dilimde). */
      altyazi?: boolean;
    }
  | { kind: "appendixCover"; section: NumberedSection; h: number; tam: true };

/** Sayfadaki bir bant: ya iki sütun ya tam genişlik. */
export type ManualBant =
  | { kind: "cols"; sol: ManualAtom[]; sag: ManualAtom[] }
  | { kind: "full"; atoms: ManualAtom[] };

export interface ManualPdfSayfa {
  bantlar: ManualBant[];
}

/**
 * BÖLÜM KİMLİĞİ → BELGE SAYFASI (1 tabanlı, gövdenin ilk yaprağı 1).
 *
 * İçindekiler bunu okur. Sayfa numarası ÖNCEDEN bilinemez: bir bölümün hangi
 * yaprağa düştüğü bütün dağıtım bittikten sonra belli olur. Bu yüzden dizin
 * dağıtımın SONUCUNDAN türetilir — çizerken tahmin edilseydi numara ile
 * belge ayrışırdı.
 */
export type BolumSayfalari = ReadonlyMap<string, number>;

/**
 * Dağıtılmış sayfalardan bölüm → sayfa haritası çıkarır.
 *
 * `ofset` gövdenin belgede kaçıncı yapraktan başladığıdır (kapak +
 * içindekiler). Çağıran verir; çekirdek kapağın var olup olmadığını bilmez.
 */
export function bolumSayfalari(
  sayfalar: readonly ManualPdfSayfa[],
  ofset = 0
): BolumSayfalari {
  const harita = new Map<string, number>();
  sayfalar.forEach((sayfa, i) => {
    const no = i + 1 + ofset;
    for (const bant of sayfa.bantlar) {
      const atomlar = bant.kind === "full" ? bant.atoms : [...bant.sol, ...bant.sag];
      for (const a of atomlar) {
        // İLK GEÇİŞ KAZANIR: bölünmüş bir bölüm dizinde BAŞLADIĞI sayfayla
        // anılır, bittiği sayfayla değil.
        if (a.kind === "heading" && !harita.has(a.section.id)) {
          harita.set(a.section.id, no);
        }
      }
    }
  });
  return harita;
}

// ————————————————————————————————————————————————————————————— ölçme

/** Metnin `genislik` içinde kaç satır saracağı. */
function satirSayisi(metin: string, punto: number, genislik: number, mono = false): number {
  const t = metin ?? "";
  if (!t.trim()) return 0;
  const katsayi = mono ? MONO_KATSAYI : SANS_KATSAYI;
  // SATIR SONLARI KORUNUR: `pdf/manual.tsx` metni olduğu gibi basar ve
  // "\n" gerçek bir satır kırar. Tek parça sayılsaydı çok satırlı bir
  // paragraf olduğundan kısa ölçülürdü.
  let toplam = 0;
  for (const parca of t.split("\n")) {
    const en = parca.length * katsayi * punto;
    toplam += Math.max(1, Math.ceil(en / Math.max(1, genislik)));
  }
  return toplam;
}

/**
 * Tek bir liste maddesinin yüksekliği.
 *
 * Madde işareti 12 pt'lik bir kutudur; metne sütunun geri kalanı kalır.
 * DIŞA AÇIK çünkü liste bölünürken her dilimin yüksekliği madde madde
 * toplanır — ölçünün iki ayrı yerde yazılması, dilimin bütünden farklı
 * ölçülmesi demekti.
 */
export function maddeYuksekligi(metin: string, genislik = SUTUN_GENISLIK): number {
  if (!metin.trim()) return 0;
  return Math.max(1, satirSayisi(metin, GOVDE_PUNTO, genislik - 12)) * MADDE_YUK;
}

/** Tablonun sütun payları (pt) — çizimdeki yüzdelerin mutlak karşılığı. */
export function tabloPaylari(table: ManualTable, genislik: number): number[] {
  const sutun = Math.max(table.head.length, ...table.rows.map((r) => r.length), 1);
  // Elektrik listesinde ilk sütun sayıdır; Tanım, Tip No ve Malzeme Kodu ise
  // sipariş kimliğini taşır. En uzun tek hücreye göre pay vermek, bozuk bir
  // EPLAN açıklamasının bütün tabloyu ezmesine yol açıyordu. Bu tablo için
  // mühendislik anlamına göre sabit oran kullanılır; çizim de aynı yardımcıyı
  // okur, böylece ölçü ile PDF birbirinden ayrışmaz.
  if (
    sutun === 6 &&
    table.head.join("|") === "Adet|Tanım|Tip No|Tedarikçi|Malzeme Kodu|Panolar"
  ) {
    return [0.06, 0.25, 0.18, 0.13, 0.2, 0.18].map((oran) => oran * genislik);
  }
  const uzunluk = Array.from({ length: sutun }, (_, j) => {
    let en = (table.head[j] ?? "").length;
    for (const r of table.rows) en = Math.max(en, (r[j] ?? "").length);
    return Math.min(40, Math.max(4, en));
  });
  const toplam = uzunluk.reduce((a, b) => a + b, 0);
  return uzunluk.map((u) => (u / toplam) * genislik);
}

/** Tek bir tablo satırının yüksekliği — sütun payları `paylar`dan gelir. */
export function tabloSatirYuksekligi(
  hucreler: readonly string[],
  paylar: readonly number[]
): number {
  let enCok = 1;
  for (let j = 0; j < paylar.length; j++) {
    enCok = Math.max(enCok, satirSayisi(hucreler[j] ?? "", TABLO_PUNTO, paylar[j] - TABLO_HUCRE_PAY));
  }
  return enCok * TABLO_SATIR + TABLO_HUCRE_PAY + TABLO_SATIR_EMNIYET;
}

/** Tablonun yüksekliği — sütun payları `pdf/manual.tsx`teki kuralın aynısı. */
export function tabloYuksekligi(table: ManualTable, genislik: number): number {
  const paylar = tabloPaylari(table, genislik);
  let h = tabloSatirYuksekligi(table.head, paylar);
  for (const r of table.rows) h += tabloSatirYuksekligi(r, paylar);
  if (table.caption?.trim()) h += ALTYAZI_YUK;
  return h + 10; // marginVertical 5 + 5
}

/**
 * GÖRSEL ORANLARI — `imageId` → yükseklik/genişlik.
 *
 * Oran BLOĞUN İÇİNDE saklanmaz, dışarıdan verilir: `manual_images` satırı
 * ölçülmüş `width`/`height` taşıyor ve aynı sayıyı `payload`a kopyalamak, bir
 * görsel yeniden yüklendiğinde ikisinin sessizce ayrışması demekti. Oranı
 * bilinmeyen görsel KARE varsayılır (bkz. `blokOlcusu`).
 */
export type GorselOranlari = ReadonlyMap<string, number>;

/**
 * Tablonun ölçüsü ve tam genişlik isteyip istemediği — ikisi birlikte, çünkü
 * karar ölçümün kendisinden çıkar (bkz. `TAM_GENISLIK_SISME_ESIGI`).
 */
function tabloOlcusu(table: ManualTable): { h: number; tam: boolean; table: ManualTable } {
  const dar = tabloYuksekligi(table, SUTUN_GENISLIK);
  const genis = tabloYuksekligi(table, TAM_GENISLIK);
  const tam = genis > 0 && dar / genis > TAM_GENISLIK_SISME_ESIGI;
  return { h: tam ? genis : dar, tam, table };
}

/** Bloğun ölçüsü ve tam genişlik isteyip istemediği. */
export function blokOlcusu(
  block: ManualBlock,
  sources: ManualSourceData,
  oranlar: GorselOranlari = new Map(),
  tamGenislik = false
): { h: number; tam: boolean; table?: ManualTable } {
  const sutun = tamGenislik ? TAM_GENISLIK : SUTUN_GENISLIK;

  switch (block.kind) {
    case "text": {
      const kenar = block.margin?.trim() ? KENAR_NOT_YUK : 0;
      return { h: kenar + satirSayisi(block.text, GOVDE_PUNTO, sutun) * GOVDE_SATIR + PARAGRAF_PAY, tam: tamGenislik };
    }

    case "list": {
      let h = 0;
      for (const i of block.items) h += maddeYuksekligi(i, sutun);
      // Sonuç satırı (okla basılan) kendi üst payını da taşır.
      if (block.result?.trim()) h += maddeYuksekligi(block.result, sutun) + 4;
      return { h: h + PARAGRAF_PAY, tam: tamGenislik };
    }

    case "note": {
      // Metne yalnız dolgudan arta kalan genişlik değil, VEKTÖR PİKTOGRAMIN
      // slotu ve oluğu çıktıktan sonra kalan gerçek genişlik verilir. Önceki
      // ölçü yaklaşık 23 pt fazla alan sayıyor ve uzun uyarıları bir satır
      // kısa ölçüyordu.
      const alan = sutun - 12 - NOT_PIKTOGRAM_SLOT_PAYI;
      const metinYuk = KUTU_BASLIK_YUK + satirSayisi(block.text, GOVDE_PUNTO, alan) * GOVDE_SATIR;
      return {
        h: KUTU_DIS_PAY + Math.max(NOT_PIKTOGRAM_BOY, metinYuk),
        tam: tamGenislik,
      };
    }

    case "table":
      return tamGenislik
        ? { h: tabloYuksekligi(block.table, TAM_GENISLIK), tam: true, table: block.table }
        : tabloOlcusu(block.table);

    case "auto": {
      const tablo = autoTableFor(block, sources);
      if (tablo.rows.length === 0) {
        return block.emptyText?.trim()
          ? { h: satirSayisi(block.emptyText, GOVDE_PUNTO, sutun) * GOVDE_SATIR + PARAGRAF_PAY, tam: tamGenislik }
          : { h: 0, tam: false };
      }
      return tamGenislik
        ? { h: tabloYuksekligi(tablo, TAM_GENISLIK), tam: true, table: tablo }
        : tabloOlcusu(tablo);
    }

    case "image": {
      const pct = block.widthPct ?? 100;
      // ŞABLONUN AÇIK İSTEĞİ ÖNCELİKLİDİR; yoksa genişlik yüzdesine bakılır.
      const tam = tamGenislik || (block.fullWidth ?? pct > TAM_GENISLIK_GORSEL_ESIGI);
      if (block.assetKey === "sinyalKelimeleri") {
        const altyazi = block.caption?.trim() ? ALTYAZI_YUK : 0;
        return { h: SINYAL_CIZELGE_YUKSEKLIGI + altyazi, tam };
      }
      const genislik = ((tam ? TAM_GENISLIK : sutun) * pct) / 100;
      // ORAN BİLİNMİYORSA KARE VARSAYILIR ve bu FAZLA ölçmenin yönüdür:
      // gerçek görseller çoğunlukla yatıktır, kare tahmini onlardan yüksek
      // çıkar ve sütunu erken kapatır.
      // Şablon varlığının oranı DEFTERDEDİR, yüklenen görselinki ölçüldü;
            // ikisi de aynı haritadan okunur (çağıran birleştirir).
      const olculen = oranlar.get(block.assetKey ?? block.imageId ?? "");
      const oran = olculen && olculen > 0 ? olculen : 1;
      const altyazi = block.caption?.trim() ? ALTYAZI_YUK : 0;
      return { h: genislik * oran + altyazi + GORSEL_PAY, tam };
    }

    case "diagram": {
      // ŞEMANIN ORANI KENDİ MODELİNDEDİR: dosyaya bakmak gerekmez ve çekirdek
      // saf kalır (KITAP-12'nin "oran defterdedir" kuralının ikizi). Görselde
      // oran bilinmediğinde kare varsayılır; burada TAHMİN YOKTUR.
      const pct = block.widthPct ?? 100;
      const tam = tamGenislik || (block.fullWidth ?? pct > TAM_GENISLIK_GORSEL_ESIGI);
      const genislik = ((tam ? TAM_GENISLIK : sutun) * pct) / 100;
      const oran = block.diagram.height / block.diagram.width;
      const altyazi = block.caption?.trim() ? ALTYAZI_YUK : 0;
      return { h: genislik * oran + altyazi + GORSEL_PAY, tam };
    }
  }
}

/** Başlığın ölçüsü — derinlik başlık stilini seçer. */
export function baslikYuksekligi(depth: number): number {
  return BASLIK_YUK[Math.min(Math.max(depth, 1), 4) - 1];
}

// ————————————————————————————————————————————————————————————— akış

/**
 * Numaralanmış ağacı düz bir ATOM akışına çevirir.
 *
 * BAŞLIK BİR ATOMDUR, bir kap değil: iki sütunlu akışta bir bölümün gövdesi
 * sütun sınırını geçebilir ve başlığını kapsayan bir kutu bunu imkânsız
 * kılardı. Bölüm sırası korunur — okuyan belgeyi yukarıdan aşağıya, soldan
 * sağa okur.
 */
export function manualAtomlari(
  sections: readonly NumberedSection[],
  sources: ManualSourceData,
  oranlar: GorselOranlari = new Map(),
  tamGenislik = false
): ManualAtom[] {
  const out: ManualAtom[] = [];
  const gez = (liste: readonly NumberedSection[]) => {
    for (const s of liste) {
      if (s.appendix) {
        // EK KAPAĞI KENDİ YAPRAĞINDA KALIR (`pdfEkleriYerlestir` sözleşmesi);
        // akışa girmez, çağıran onu ayrı sayfa olarak basar.
        continue;
      }
      out.push({ kind: "heading", section: s, h: baslikYuksekligi(s.depth), tam: tamGenislik });
      for (const b of s.blocks) {
        if (b.hidden || !blockHasContent(b)) continue;
        const olcu = blokOlcusu(b, sources, oranlar, tamGenislik);
        if (olcu.h <= 0) continue;
        out.push({
          kind: "block",
          block: b,
          table: olcu.table,
          h: olcu.h,
          tam: olcu.tam,
          // BÖLÜNEBİLİR İÇERİK ATOMDA TAŞINIR: dağıtıcı bloğun kendisine
          // değil bu alanlara bakar ve dilimlerken yalnız onları keser.
          ...(b.kind === "list" ? { items: b.items.filter((i) => i.trim()), sonuc: true } : {}),
          ...(olcu.table ? { rows: olcu.table.rows, altyazi: true } : {}),
        });
      }
      gez(s.children);
    }
  };
  gez(sections);
  return out;
}


// ————————————————————————————————————————————————————————————— bölme

/**
 * BİR DİLİMDE EN AZ İKİ SATIR BULUNUR.
 *
 * Sütun dibinde tek bir madde bırakmak, listeyi böldüğünü söylemeden
 * bölmektir: okuyan bir madde görür ve listenin bittiğini sanır. Teklif
 * PDF'indeki `EN_AZ_KUYRUK` kuralının aynısı.
 */
const EN_AZ_SATIR = 2;

/** Bölünebilir atom mu — yalnız liste ve tablo bölünür. */
function bolunebilir(atom: ManualAtom): boolean {
  if (atom.kind !== "block") return false;
  if (atom.block.kind === "list") return atom.block.items.filter((i) => i.trim()).length > 3;
  if (atom.table) return atom.table.rows.length > 3;
  return false;
}

/**
 * Atomu `alan` kadarına sığacak bir DİLİME ve KALANA böler.
 *
 * `null` = buraya konmaz (çağıran sütunu kapatır). `zorla`, sütun bomboşken
 * verilir ve İLERLEMEYİ GARANTİ EDER: tek satırı bile boş bir sütuna sığmayan
 * patolojik bir blok reddedilmeye devam etseydi döngü sonsuza girerdi.
 */
function atomuBol(
  atom: ManualAtom,
  alan: number,
  zorla: boolean
): { dilim: ManualAtom; kalan: ManualAtom | null } | null {
  if (atom.kind !== "block") return null;

  // ————————————————————————————————————————————————— liste
  if (atom.block.kind === "list" && atom.items) {
    const genislik = atom.tam ? TAM_GENISLIK : SUTUN_GENISLIK;
    const yuk = atom.items.map((item) => maddeYuksekligi(item, genislik));
    let n = 0;
    let h = 0;
    while (n < atom.items.length && h + yuk[n] <= alan) {
      h += yuk[n];
      n += 1;
    }
    const enAz = Math.min(EN_AZ_SATIR, atom.items.length);
    if (n < enAz) {
      if (!zorla) return null;
      n = Math.max(1, n);
      h = yuk.slice(0, n).reduce((t, x) => t + x, 0);
    }
    if (n >= atom.items.length) return null; // bölmeye gerek yok
    // ARTAN TEK MADDE BIRAKILMAZ: sonraki dilimde tek başına duran bir madde,
    // burada kaçındığımız kusurun ötekine düşmüş hâlidir.
    if (atom.items.length - n === 1 && n - 1 >= enAz) {
      n -= 1;
      h -= yuk[n];
    }
    return {
      dilim: { ...atom, items: atom.items.slice(0, n), h, sonuc: false },
      kalan: {
        ...atom,
        items: atom.items.slice(n),
        itemOffset: (atom.itemOffset ?? 0) + n,
        h: yuk.slice(n).reduce((t, x) => t + x, 0) + PARAGRAF_PAY,
        devam: true,
      },
    };
  }

  // ————————————————————————————————————————————————— tablo
  if (atom.table && atom.rows) {
    const paylar = tabloPaylari(atom.table, atom.tam ? TAM_GENISLIK : SUTUN_GENISLIK);
    const basYuk = tabloSatirYuksekligi(atom.table.head, paylar);
    const yuk = atom.rows.map((r) => tabloSatirYuksekligi(r, paylar));
    let n = 0;
    // BAŞLIK SATIRI HER DİLİMDE TEKRAR BASILIR (fiyat tablosunun `fixed`
    // başlığıyla aynı ilke): ikinci sütunda hangi sütunun ne olduğu
    // hatırlanmak zorunda değildir.
    let h = basYuk + 10;
    const enCokSatir = atom.tam ? TAM_TABLO_DILIM_SATIRI : atom.rows.length;
    while (n < atom.rows.length && n < enCokSatir && h + yuk[n] <= alan) {
      h += yuk[n];
      n += 1;
    }
    const enAz = Math.min(EN_AZ_SATIR, atom.rows.length);
    if (n < enAz) {
      if (!zorla) return null;
      n = Math.max(1, n);
      h = basYuk + 10 + yuk.slice(0, n).reduce((t, x) => t + x, 0);
    }
    if (n >= atom.rows.length) return null;
    if (atom.rows.length - n === 1 && n - 1 >= enAz) {
      n -= 1;
      h -= yuk[n];
    }
    return {
      dilim: { ...atom, rows: atom.rows.slice(0, n), h, altyazi: false },
      kalan: {
        ...atom,
        rows: atom.rows.slice(n),
        h: basYuk + 10 + yuk.slice(n).reduce((t, x) => t + x, 0),
        devam: true,
      },
    };
  }

  return null;
}

/**
 * BAŞLIK YALNIZ BAŞINA SÜTUN DİBİNDE BIRAKILMAZ.
 *
 * "4.12 Halatların Kontrolü" bir sütunun son satırıysa okuyan başlığı bir
 * yerde, gövdesini başka bir yerde bulur. Başlığın ardından en az bu kadar
 * yer kalmalıdır — teklifin `EN_AZ_KUYRUK` kuralının başlık karşılığı ve
 * `pdf/offer.tsx`teki `minPresenceAhead` ile aynı ruhta.
 */
const BASLIK_KUYRUK = 26;

/**
 * Ana bölümleri kullanıcının belge kurallarına göre ayrı ayrı dağıtır.
 *
 * Her ana bölüm yeni bir fiziksel sayfadan başlar. 9. bölüm bakım ve yedek
 * parça çizelgelerini taşır; bu bölümde bütün atomlar tam genişliktir ve
 * sayfanın ortasında iki sütun ayırıcı çizgisi oluşmaz.
 */
export function manualAnaBolumSayfalari(
  sections: readonly NumberedSection[],
  sources: ManualSourceData,
  oranlar: GorselOranlari = new Map()
): ManualPdfSayfa[] {
  return sections.flatMap((section) => {
    // Numara gizlenen bölümlerden sonra yeniden dizilir; kararı kararlı şablon
    // anahtarına bağlarız. Böylece “Yedek Parça Listeleri” 8'e düşse bile
    // tekrar iki sütuna dönmez.
    const tekSutun = section.key === "yedek";
    const atoms = manualAtomlari([section], sources, oranlar, tekSutun);
    return manualPdfSayfalari(atoms);
  });
}

/**
 * Atomları sayfalara, sütunlara ve tam genişlik bantlarına dağıtır.
 *
 * SIRA KORUNUR, DENGE ARANMAZ (teklifin kuralı): bloklar sırayla önce sol
 * sütunu doldurur, sol dolunca sağa, sağ dolunca yeni sayfaya geçer. Sütunları
 * eşitlemek için bölümleri yeniden dizmek sayfayı düzgün ama belgeyi YANLIŞ
 * yapardı.
 *
 * TAM GENİŞLİK ATOMU AÇIK SÜTUN BANDINI KAPATIR ve kendi bandını açar. Bir
 * geniş tabloyu iki sütunun ortasına sıkıştırmanın yolu yok; onu sayfanın
 * tamamına yaymak, kılavuzun okunur kalmasının bedelidir.
 */
export function manualPdfSayfalari(
  girdiAtomlari: readonly ManualAtom[],
  sutunKapasite: number = MANUAL_GOVDE_YUKSEKLIK
): ManualPdfSayfa[] {
  // Dizi DÖNGÜ İÇİNDE BÜYÜR: bölünen bir atomun kalanı sıradaki eleman
  // olarak araya sokulur. Girdi değiştirilmez (çağıranın dizisi kutsaldır).
  let atomlar: ManualAtom[] = [...girdiAtomlari];
  const kapasite = Number.isFinite(sutunKapasite) ? sutunKapasite * KAPASITE_PAYI : 0;
  if (kapasite <= 0 || atomlar.length === 0) return [];

  const sayfalar: ManualPdfSayfa[] = [];
  let sayfa: ManualPdfSayfa = { bantlar: [] };
  let bant: Extract<ManualBant, { kind: "cols" }> | null = null;
  let sagda = false;
  let kalan = kapasite;
  /** Sayfanın tam genişlik bantlarının yediği dikey yer. */
  let sayfaTamYuk = 0;
  /** Açık sütun bandında SOL sütunun yediği yer — sağa geçerken donar. */
  let solKullanilan = 0;

  /** Bandın içinde gerçekten bir şey var mı? */
  const doluBant = (b: ManualBant): boolean =>
    b.kind === "full" ? b.atoms.length > 0 : b.sol.length > 0 || b.sag.length > 0;

  const sayfayiKapat = () => {
    // BOŞ BANT SAYFAYA SAYILMAZ. `sutunAc` bandı içine bir şey konmadan ÖNCE
    // açıyor; ardından gelen tam genişlik atomu sayfayı kapatınca ortada
    // yalnız boş bir sütun bandı taşıyan bir yaprak kalıyordu (ölçüldü:
    // genişletilmiş şablonda 12. sayfa 80 karakterle bomboş çıktı).
    sayfa.bantlar = sayfa.bantlar.filter(doluBant);
    if (sayfa.bantlar.length > 0) sayfalar.push(sayfa);
    sayfa = { bantlar: [] };
    bant = null;
    sagda = false;
    kalan = kapasite;
    sayfaTamYuk = 0;
    solKullanilan = 0;
  };

  const sutunAc = () => {
    if (!bant) {
      bant = { kind: "cols", sol: [], sag: [] };
      sayfa.bantlar.push(bant);
      sagda = false;
      kalan = kapasite - sayfaTamYuk;
      solKullanilan = 0;
    }
  };

  for (let i = 0; i < atomlar.length; i++) {
    let atom = atomlar[i];

    // ————————————————————————————————— tam genişlik bandı
    if (atom.tam) {
      // Bir tam-geniş tablo diliminin devamı yeni yaprakta başlar. Aynı
      // sayfada ikinci kez başlık satırı basmak hem iki ayrı tablo izlenimi
      // veriyor hem de küçük teorik ölçüm farklarının üst üste binip
      // çerçevesiz örtük sayfa üretmesine izin veriyordu.
      if (
        atom.kind === "block" &&
        atom.table &&
        atom.devam &&
        sayfa.bantlar.length > 0
      ) {
        sayfayiKapat();
      }
      // AÇIK BANDIN YEDİĞİ YER, İKİ SÜTUNUN DOLU OLANIDIR. Tam genişlik atomu
      // bandın ALTINA gelir; altına inebilmesi için sol ve sağ sütunun
      // UZUNUNUN bitmesi gerekir. Sağ sütundayken "bütün sayfa dolu" saymak
      // (eski hâl) yarı boş bir sayfayı erken kapatıyordu.
      const buSutun = bant ? kapasite - sayfaTamYuk - kalan : 0;
      let bantYuk = bant ? Math.max(solKullanilan, sagda ? buSutun : 0, buSutun) : 0;
      let sayfadaKalan = kapasite - sayfaTamYuk - bantYuk;

      // Tam genişlik tablo/liste de SAYFALAR ARASINDA dilimlenir. Eski dal
      // doğrudan ekliyordu; uzun elektrik malzeme tablosu çekirdeğin haberi
      // olmadan @react-pdf tarafından taşınıyor, sayfa haritası ve sonraki
      // başlıklar kayıyordu. Bölme kararı burada verilince çizim ile sayfa
      // numarası yeniden aynı gerçeği paylaşır.
      if (atom.kind === "heading") {
        const sonraki = atomlar[i + 1];
        const gereken = atom.h + (sonraki ? Math.min(sonraki.h, BASLIK_KUYRUK) : 0);
        if (gereken > sayfadaKalan && sayfa.bantlar.length > 0) {
          sayfayiKapat();
          bantYuk = 0;
          sayfadaKalan = kapasite;
        }
      }

      const tamTabloTavanaGeldi =
        atom.kind === "block" &&
        Boolean(atom.table) &&
        (atom.rows?.length ?? 0) > TAM_TABLO_DILIM_SATIRI;
      if (atom.h > sayfadaKalan || tamTabloTavanaGeldi) {
        const bosSayfa = sayfa.bantlar.length === 0;
        const bolunmus = bolunebilir(atom) ? atomuBol(atom, sayfadaKalan, bosSayfa) : null;
        if (bolunmus) {
          atom = bolunmus.dilim;
          if (bolunmus.kalan) {
            atomlar = [...atomlar.slice(0, i + 1), bolunmus.kalan, ...atomlar.slice(i + 1)];
          }
        } else if (!bosSayfa) {
          sayfayiKapat();
          i -= 1;
          continue;
        }
      }

      const son = sayfa.bantlar[sayfa.bantlar.length - 1];
      if (son && son.kind === "full") son.atoms.push(atom);
      else sayfa.bantlar.push({ kind: "full", atoms: [atom] });
      // Bandın altına inen atom, bandın yüksekliğini de yemiş olur.
      sayfaTamYuk += atom.h + bantYuk;
      // Açık sütun bandı KAPANIR: ondan sonrası yeni bir bantta akar.
      bant = null;
      sagda = false;
      solKullanilan = 0;
      kalan = Math.max(0, kapasite - sayfaTamYuk);
      if (kalan <= 0) sayfayiKapat();
      continue;
    }

    // ————————————————————————————————— iki sütunlu akış
    sutunAc();

    // BAŞLIK KENDİNDEN SONRAKİNİ DE İSTER: tek başına dipte kalmamalı.
    // TAM GENİŞLİK ATOMU DA SAYILIR ve bu bir düzeltmedir (ölçüldü, s. 16-17:
    // "9.1 Rulman Listesi" başlığı bir sayfada, tablosu ötekinde kalıyordu).
    // Böyle bir başlık kendinden sonrakiyle YAPIŞIKTIR: tablo bu sayfaya
    // sığmıyorsa başlık da sığmıyor demektir.
    const sonraki = atomlar[i + 1];
    let gereken = atom.h;
    if (atom.kind === "heading" && sonraki) {
      gereken += sonraki.tam
        ? Math.min(sonraki.h, kapasite)
        : Math.min(sonraki.h, BASLIK_KUYRUK);
    }

    let yerlesen: ManualAtom = atom;

    if (gereken > kalan) {
      const bosSutun = kalan >= kapasite - sayfaTamYuk - 0.01;
      // ÖNCE BÖLMEYİ DENE, sonra sütun değiştir: dokuz maddelik bir liste
      // sütunun dibine sığmıyorsa bir kısmı buraya, kalanı ötekine gider.
      // Bölmeden geçilseydi dipte koca bir boşluk kalırdı.
      const bolunmus = bolunebilir(atom) ? atomuBol(atom, kalan, bosSutun) : null;
      if (bolunmus) {
        yerlesen = bolunmus.dilim;
        // KALAN AYNI DÖNGÜDE İŞLENİR: diziye geri konur ve bir sonraki
        // turda yeni sütunda yerini alır.
        if (bolunmus.kalan) {
          atomlar = [...atomlar.slice(0, i + 1), bolunmus.kalan, ...atomlar.slice(i + 1)];
        }
      } else if (!bosSutun) {
        // Sütun bomboşken reddetmek anlamsızdır: bir sonraki sütun da aynı
        // boydadır ve atom sonsuza dek kaçardı (teklifin `zorla` dersi).
        if (sagda) {
          sayfayiKapat();
          sutunAc();
        } else {
          // SOLDAN SAĞA GEÇİŞ: solun yediği yer donar, sağ sütun sıfırdan
          // başlar. Tam genişlik atomu geldiğinde bandın yüksekliği ikisinin
          // UZUNUDUR (bkz. yukarıdaki `bantYuk`).
          solKullanilan = kapasite - sayfaTamYuk - kalan;
          sagda = true;
          kalan = kapasite - sayfaTamYuk;
        }
      }
    }

    const hedef = sagda ? bant!.sag : bant!.sol;
    hedef.push(yerlesen);
    kalan -= yerlesen.h;
  }

  if (sayfa.bantlar.length > 0) sayfalar.push(sayfa);
  return sayfalar;
}
