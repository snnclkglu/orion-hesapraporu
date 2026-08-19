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

/** Sütunlar arası oluk — teklifle aynı gerekçe (bkz. `offers/pdf-layout.ts`). */
export const SUTUN_BOSLUK = 18;

export const SUTUN_GENISLIK = (ICERIK_GENISLIK - SUTUN_BOSLUK) / 2;

/** Tam genişlik bandı — geniş tablolar ve büyük görseller buraya düşer. */
export const TAM_GENISLIK = ICERIK_GENISLIK;

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

/** Uyarı kutusu kabuğu: 6+6 dolgu + 5+5 dikey pay + başlık satırı. */
const KUTU_PAY = 6 + 6 + 5 + 5 + (8 * 1.2 + 2);

/** Tablo altyazısı (7 punto + 2 üst pay). */
const ALTYAZI_YUK = 7 * 1.2 + 2;

/** Görselin dikey payı (`marginVertical: 6` iki yandan). */
const GORSEL_PAY = 12;

/**
 * GENİŞ TABLO TAM GENİŞLİK BANDINA DÜŞER.
 *
 * Altı sütunlu elektrik malzeme listesi 234 pt'lik bir sütuna sığmaz: her
 * hücre 39 pt kalır ve "6ES7511-1AL03-0AB0" harf harf sarar. Eşik DÖRTTÜR —
 * üç sütunlu bir tablo (resim no · ad · durum) yarım sütunda hâlâ okunur,
 * dördüncü sütun onu okunmaz yapar.
 */
export const TAM_GENISLIK_SUTUN_ESIGI = 4;

/**
 * Görsel tam genişlik bandına DÜŞER mi?
 *
 * Sayfa genişliğinin yarısından fazlasını isteyen bir görsel yarım sütunda
 * küçültülürse okunmaz olur — bir HMI ekran görüntüsünün yazısı zaten küçük.
 */
export const TAM_GENISLIK_GORSEL_ESIGI = 55;

// ————————————————————————————————————————————————————————————— tipler

/** Yerleşimin en küçük parçası — bölünemez bir çizim birimi. */
export type ManualAtom =
  | { kind: "heading"; section: NumberedSection; h: number; tam: false }
  | { kind: "block"; block: ManualBlock; table?: ManualTable; h: number; tam: boolean }
  | { kind: "appendixCover"; section: NumberedSection; h: number; tam: true };

/** Sayfadaki bir bant: ya iki sütun ya tam genişlik. */
export type ManualBant =
  | { kind: "cols"; sol: ManualAtom[]; sag: ManualAtom[] }
  | { kind: "full"; atoms: ManualAtom[] };

export interface ManualPdfSayfa {
  bantlar: ManualBant[];
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

/** Tablonun yüksekliği — sütun payları `pdf/manual.tsx`teki kuralın aynısı. */
export function tabloYuksekligi(table: ManualTable, genislik: number): number {
  const sutun = Math.max(table.head.length, ...table.rows.map((r) => r.length), 1);
  const uzunluk = Array.from({ length: sutun }, (_, j) => {
    let en = (table.head[j] ?? "").length;
    for (const r of table.rows) en = Math.max(en, (r[j] ?? "").length);
    return Math.min(40, Math.max(4, en));
  });
  const toplam = uzunluk.reduce((a, b) => a + b, 0);
  const paylar = uzunluk.map((u) => (u / toplam) * genislik);

  const satirYuk = (hucreler: readonly string[]): number => {
    let enCok = 1;
    for (let j = 0; j < sutun; j++) {
      enCok = Math.max(enCok, satirSayisi(hucreler[j] ?? "", TABLO_PUNTO, paylar[j] - TABLO_HUCRE_PAY));
    }
    return enCok * TABLO_SATIR + TABLO_HUCRE_PAY;
  };

  let h = satirYuk(table.head);
  for (const r of table.rows) h += satirYuk(r);
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

/** Bloğun ölçüsü ve tam genişlik isteyip istemediği. */
export function blokOlcusu(
  block: ManualBlock,
  sources: ManualSourceData,
  oranlar: GorselOranlari = new Map()
): { h: number; tam: boolean; table?: ManualTable } {
  const sutun = SUTUN_GENISLIK;

  switch (block.kind) {
    case "text": {
      const kenar = block.margin?.trim() ? KENAR_NOT_YUK : 0;
      return { h: kenar + satirSayisi(block.text, GOVDE_PUNTO, sutun) * GOVDE_SATIR + PARAGRAF_PAY, tam: false };
    }

    case "list": {
      // Madde işareti 12 pt'lik bir kutu; metne kalan sütunun geri kalanıdır.
      const alan = sutun - 12;
      let h = 0;
      for (const i of block.items) {
        if (!i.trim()) continue;
        h += Math.max(1, satirSayisi(i, GOVDE_PUNTO, alan)) * MADDE_YUK;
      }
      // Sonuç satırı (okla basılan) kendi üst/alt payını da taşır.
      if (block.result?.trim()) h += satirSayisi(block.result, GOVDE_PUNTO, alan) * MADDE_YUK + 4;
      return { h: h + PARAGRAF_PAY, tam: false };
    }

    case "note": {
      const alan = sutun - 12; // 6+6 dolgu
      return { h: KUTU_PAY + satirSayisi(block.text, GOVDE_PUNTO, alan) * GOVDE_SATIR, tam: false };
    }

    case "table": {
      const tam = block.table.head.length >= TAM_GENISLIK_SUTUN_ESIGI;
      return { h: tabloYuksekligi(block.table, tam ? TAM_GENISLIK : sutun), tam, table: block.table };
    }

    case "auto": {
      const tablo = autoTableFor(block, sources);
      if (tablo.rows.length === 0) {
        return block.emptyText?.trim()
          ? { h: satirSayisi(block.emptyText, GOVDE_PUNTO, sutun) * GOVDE_SATIR + PARAGRAF_PAY, tam: false }
          : { h: 0, tam: false };
      }
      const tam = tablo.head.length >= TAM_GENISLIK_SUTUN_ESIGI;
      return { h: tabloYuksekligi(tablo, tam ? TAM_GENISLIK : sutun), tam, table: tablo };
    }

    case "image": {
      const pct = block.widthPct ?? 100;
      const tam = pct > TAM_GENISLIK_GORSEL_ESIGI;
      const genislik = ((tam ? TAM_GENISLIK : sutun) * pct) / 100;
      // ORAN BİLİNMİYORSA KARE VARSAYILIR ve bu FAZLA ölçmenin yönüdür:
      // gerçek görseller çoğunlukla yatıktır, kare tahmini onlardan yüksek
      // çıkar ve sütunu erken kapatır.
      const olculen = oranlar.get(block.imageId);
      const oran = olculen && olculen > 0 ? olculen : 1;
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
  oranlar: GorselOranlari = new Map()
): ManualAtom[] {
  const out: ManualAtom[] = [];
  const gez = (liste: readonly NumberedSection[]) => {
    for (const s of liste) {
      if (s.appendix) {
        // EK KAPAĞI KENDİ YAPRAĞINDA KALIR (`pdfEkleriYerlestir` sözleşmesi);
        // akışa girmez, çağıran onu ayrı sayfa olarak basar.
        continue;
      }
      out.push({ kind: "heading", section: s, h: baslikYuksekligi(s.depth), tam: false });
      for (const b of s.blocks) {
        if (b.hidden || !blockHasContent(b)) continue;
        const olcu = blokOlcusu(b, sources, oranlar);
        if (olcu.h <= 0) continue;
        out.push({ kind: "block", block: b, table: olcu.table, h: olcu.h, tam: olcu.tam });
      }
      gez(s.children);
    }
  };
  gez(sections);
  return out;
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
  atomlar: readonly ManualAtom[],
  sutunKapasite: number = ICERIK_YUKSEKLIK
): ManualPdfSayfa[] {
  const kapasite = Number.isFinite(sutunKapasite) ? sutunKapasite * KAPASITE_PAYI : 0;
  if (kapasite <= 0 || atomlar.length === 0) return [];

  const sayfalar: ManualPdfSayfa[] = [];
  let sayfa: ManualPdfSayfa = { bantlar: [] };
  let bant: Extract<ManualBant, { kind: "cols" }> | null = null;
  let sagda = false;
  let kalan = kapasite;
  /** Sayfanın tam genişlik bantlarının yediği dikey yer. */
  let sayfaTamYuk = 0;

  const sayfayiKapat = () => {
    if (sayfa.bantlar.length > 0) sayfalar.push(sayfa);
    sayfa = { bantlar: [] };
    bant = null;
    sagda = false;
    kalan = kapasite;
    sayfaTamYuk = 0;
  };

  const sutunAc = () => {
    if (!bant) {
      bant = { kind: "cols", sol: [], sag: [] };
      sayfa.bantlar.push(bant);
      sagda = false;
      kalan = kapasite - sayfaTamYuk;
    }
  };

  for (let i = 0; i < atomlar.length; i++) {
    const atom = atomlar[i];

    // ————————————————————————————————— tam genişlik bandı
    if (atom.tam) {
      const kullanilan = bant ? kapasite - sayfaTamYuk - kalan : 0;
      // Bant açıksa iki sütunun DOLU olanı kadar yer yenmiştir; tam genişlik
      // atomu onun ALTINA gelir ve sayfada kalan yer buna göre ölçülür.
      const sayfadaKalan = kapasite - sayfaTamYuk - (sagda ? kapasite : kullanilan);
      if (atom.h > sayfadaKalan && sayfa.bantlar.length > 0) sayfayiKapat();

      const son = sayfa.bantlar[sayfa.bantlar.length - 1];
      if (son && son.kind === "full") son.atoms.push(atom);
      else sayfa.bantlar.push({ kind: "full", atoms: [atom] });
      sayfaTamYuk += atom.h;
      // Açık sütun bandı KAPANIR: ondan sonrası yeni bir bantta akar.
      bant = null;
      sagda = false;
      kalan = Math.max(0, kapasite - sayfaTamYuk);
      if (kalan <= 0) sayfayiKapat();
      continue;
    }

    // ————————————————————————————————— iki sütunlu akış
    sutunAc();

    // BAŞLIK KENDİNDEN SONRAKİNİ DE İSTER: tek başına dipte kalmamalı.
    const sonraki = atomlar[i + 1];
    const gereken =
      atom.kind === "heading" && sonraki && !sonraki.tam
        ? atom.h + Math.min(sonraki.h, BASLIK_KUYRUK)
        : atom.h;

    if (gereken > kalan) {
      // Sütun bomboşken reddetmek anlamsızdır: bir sonraki sütun da aynı
      // boydadır ve atom sonsuza dek kaçardı (teklifin `zorla` dersi).
      const bosSutun = kalan >= kapasite - sayfaTamYuk - 0.01;
      if (!bosSutun) {
        if (sagda) {
          sayfayiKapat();
          sutunAc();
        } else {
          sagda = true;
          kalan = kapasite - sayfaTamYuk;
        }
      }
    }

    const hedef = sagda ? bant!.sag : bant!.sol;
    hedef.push(atom);
    kalan -= atom.h;
  }

  if (sayfa.bantlar.length > 0) sayfalar.push(sayfa);
  return sayfalar;
}
