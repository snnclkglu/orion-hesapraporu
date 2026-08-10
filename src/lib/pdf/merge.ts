// Var olan PDF'leri TEK belgede birleştirir.
//
// NEDEN `pdf-lib`, `@react-pdf/renderer` DEĞİL: react-pdf bir belge ÜRETİR
// (React ağacından sayfa çizer) ama var olan bir PDF'i OKUYAMAZ, sayfalarını
// kopyalayamaz. Atölyeye inen ölçülü resimler ressamın çizip yazdırdığı
// dosyalardır; onları yeniden üretmenin yolu yoktur, yalnız birleştirilir.
// Evin bütün öbür PDF'leri react-pdf'tir ve öyle kalır — bu modül tek
// istisnadır ve sebebi budur.
//
// SAFTIR: DB, HTTP, depo, dosya sistemi yok. Girdisi bayt listesi, çıktısı tek
// bayt dizisi ve NE ATLANDIĞININ raporu (`derive.ts` ile aynı ruh: çağıran
// veriyi getirir, burada yalnız iş vardır).
//
// BOZUK TEK DOSYA BÜTÜN BİRLEŞTİRMEYİ DÜŞÜRMEZ — `import/route.ts`
// başlığındaki emsalin aynısı: dosya atlanır, SEBEBİ raporda yazar, döngü
// sürer. 171 resimlik bir pakette tek şifreli ya da yarım inmiş dosya yüzünden
// atölyenin HİÇBİR resmi olmaması, bu modülün kabul etmediği sonuçtur.
//
// SESSİZ ATLAMA DA YOKTUR: atlanan her dosya adıyla ve sebebiyle döner.
// Çağıranın bu raporu kullanıcıya taşıması ZORUNLUDUR; taşımazsa deste eksik
// basılır ve kimse fark etmez.

import { EncryptedPDFError, PDFDocument } from "pdf-lib";

/** Birleştirilecek tek bir kaynak. `ad` yalnız rapor içindir, dosya adı değil. */
export interface BirlesecekPdf {
  ad: string;
  bytes: Uint8Array;
}

export interface AtlananPdf {
  ad: string;
  /** Türkçe, SUÇLAMAYAN sebep: "okunamadı: …", "şifreli …", "sayfası yok". */
  sebep: string;
}

/** Birleşik belgenin künyesi. Hepsi seçimliktir; boş olan yazılmaz. */
export interface PdfUstverisi {
  baslik?: string;
  konu?: string;
  uretici?: string;
  olusturan?: string;
}

/** Künye yazılmadan hemen önceki durum. */
export interface BirlestirmeOzeti {
  sayfaSayisi: number;
  birlesen: number;
  atlananlar: readonly AtlananPdf[];
}

/**
 * Künye ya sabittir ya da ÖZETTEN TÜRER.
 *
 * Fonksiyon biçiminin sebebi zamanlamadır: "kaç sayfa oldu, ne atlandı"
 * ancak birleştirme bittiğinde bilinir ama künye belgeye SAVE'DEN ÖNCE
 * yazılmak zorundadır. Bu kanca olmasaydı çağıran, künyeyi eklemek için
 * belgeyi ikinci kez ayrıştırıp yeniden kaydetmek zorunda kalırdı — bu ucun
 * asıl kısıtı süre olduğu için kabul edilemez bir bedel.
 */
export type UstveriKaynagi = PdfUstverisi | ((ozet: BirlestirmeOzeti) => PdfUstverisi);

export interface BirlestirmeSonucu {
  /**
   * Birleşik belge. HİÇ SAYFA EKLENEMEDİYSE SIFIR UZUNLUKTADIR.
   *
   * Boş bir PDF üretmek yerine boş dizi dönmenin sebebi: "hiç uygun resim yok"
   * ile "hepsi bozuk çıktı" AYNI cümle değildir ve hangisinin söyleneceğine
   * yalnız çağıran karar verebilir. Sıfır sayfalı bir PDF ise zaten geçersiz
   * bir belgedir; okuyucular onu bozuk dosya olarak açar.
   *
   * Tip `Uint8Array<ArrayBuffer>`tır, çıplak `Uint8Array` değil: TS 5.7'den
   * beri `BufferSource` yalnız `ArrayBuffer` tabanlı görünümleri kabul ediyor
   * ve `Response` gövdesine çıplak biçim GEÇMİYOR. Daraltma burada yapılır ki
   * her çağıran aynı dönüşümü yeniden yazmasın.
   */
  bytes: Uint8Array<ArrayBuffer>;
  sayfaSayisi: number;
  /** Kaç KAYNAK dosya girdi (sayfa değil). */
  birlesen: number;
  atlananlar: AtlananPdf[];
}

/**
 * Hata metninin raporda kaplayacağı en çok harf.
 *
 * pdf-lib bozuk bir belgede nesne dökümü taşıyan çok uzun iletiler üretebilir;
 * dosya adına ve belge künyesine giden bir metnin sınırsız olması dosyayı
 * kullanılamaz yapardı.
 */
const SEBEP_EN_COK_HARF = 200;

/**
 * `save()` sırasında olay döngüsüne dönmeden işlenecek nesne sayısı.
 *
 * pdf-lib öntanımlı olarak her 50 nesnede bir `setTimeout(0)` ile tick bekler.
 * Node'da bir tick ~1 ms'tir; yüz sayfalık bir vektör resim destesinde bu
 * binlerce tick, yani saniyeler demektir ve bu ucun asıl kısıtı SÜREDİR.
 * Sunucu tarafında olay döngüsünü bloklamanın bir bedeli yok: istek zaten tek
 * bir belgeyi bekliyor.
 */
const SAVE_NESNE_ADIMI = 2000;

function kirp(metin: string): string {
  const t = metin.trim();
  return t.length > SEBEP_EN_COK_HARF ? `${t.slice(0, SEBEP_EN_COK_HARF - 1)}…` : t;
}

/**
 * Hatayı Türkçe ve SUÇLAMAYAN bir cümleye çevirir.
 *
 * "standart dışı" değil "tanıyamadım" ilkesi (AGENTS, Teknik Resimler md. 4):
 * dosya bozuk OLMAYABİLİR — pdf-lib'in çözemediği bir şifreleme ya da
 * desteklemediği bir sıkıştırma da olabilir. Metin bunu iddia etmez.
 */
function sebepMetni(e: unknown): string {
  if (e instanceof EncryptedPDFError) return "şifreli (parola korumalı); açılamadı";
  const ileti = e instanceof Error ? e.message : "";
  return ileti ? `okunamadı: ${kirp(ileti)}` : "okunamadı";
}

/**
 * PDF'leri VERİLEN SIRADA birleştirir.
 *
 * Sıra çağıranın sorumluluğudur ve burada YENİDEN SIRALANMAZ: bu deste defter
 * sırasıyla basılıyor ve o sıra `drawing_parts.sort`tan gelir; ikinci bir
 * sıralama, ekrandaki ağaç ile elindeki destenin sessizce ayrışması demekti
 * (`derive.ts`teki `imalatListesi` ile aynı gerekçe).
 */
export async function pdfBirlestir(
  girdiler: readonly BirlesecekPdf[],
  ustveriKaynagi: UstveriKaynagi = {}
): Promise<BirlestirmeSonucu> {
  const hedef = await PDFDocument.create();
  const atlananlar: AtlananPdf[] = [];
  let birlesen = 0;

  for (const girdi of girdiler) {
    const ad = girdi.ad.trim() || "(adsız dosya)";

    if (!girdi.bytes || girdi.bytes.byteLength === 0) {
      atlananlar.push({ ad, sebep: "dosya boş geldi" });
      continue;
    }

    try {
      // `updateMetadata: false` — pdf-lib öntanımlı olarak KAYNAĞIN künyesine
      // kendi damgasını yazar. Kaynağı hiç değiştirmeyeceğimiz için bu yalnız
      // boşuna iştir; üstelik ressamın antedinden gelen üretici bilgisini
      // ezmek de doğru olmazdı.
      const kaynak = await PDFDocument.load(girdi.bytes, { updateMetadata: false });

      const sayfaIndisleri = kaynak.getPageIndices();
      if (sayfaIndisleri.length === 0) {
        atlananlar.push({ ad, sebep: "belgede hiç sayfa yok" });
        continue;
      }

      // ÖNCE hepsi kopyalanır, SONRA eklenir. Kopyalama ortasında hata çıkarsa
      // hedefe yarım bir resim girmiş olmaz — atlanan dosya tamamen atlanır.
      const sayfalar = await hedef.copyPages(kaynak, sayfaIndisleri);
      for (const s of sayfalar) hedef.addPage(s);
      birlesen += 1;
    } catch (e) {
      atlananlar.push({ ad, sebep: sebepMetni(e) });
    }
  }

  const sayfaSayisi = hedef.getPageCount();
  if (sayfaSayisi === 0) {
    return { bytes: new Uint8Array(0), sayfaSayisi: 0, birlesen: 0, atlananlar };
  }

  // Künye UTF-16BE olarak yazılır (pdf-lib `PDFHexString.fromText`), yani
  // Türkçe harfler burada güvenlidir. Sayfa ÜZERİNE yazı basmak öyle değildir:
  // gömülü standart fontlar WinAnsi'dir ve "ş · ğ · ı · İ" harflerini
  // kodlayamaz, TTF gömmek de `@pdf-lib/fontkit` ister. Bu yüzden birleşik
  // belgeye kapak/uyarı SAYFASI basılmaz; söylenecek şey künyede ve dosya
  // adında durur.
  const ustveri =
    typeof ustveriKaynagi === "function"
      ? ustveriKaynagi({ sayfaSayisi, birlesen, atlananlar })
      : ustveriKaynagi;

  if (ustveri.baslik) hedef.setTitle(ustveri.baslik);
  if (ustveri.konu) hedef.setSubject(ustveri.konu);
  if (ustveri.uretici) hedef.setProducer(ustveri.uretici);
  if (ustveri.olusturan) hedef.setCreator(ustveri.olusturan);
  const simdi = new Date();
  hedef.setCreationDate(simdi);
  hedef.setModificationDate(simdi);

  // `useObjectStreams: false` — İKİ sebep birden:
  //   1. SÜRE: nesne akışı kurmak belgeyi bir kez daha gezmek demektir ve bu
  //      ucun tavanı süredir.
  //   2. UYUMLULUK: deste atölyede yazdırılacak; nesne akışı PDF 1.5 ile
  //      gelmiştir ve eski tezgâh yazıcılarının sürücülerinde en zayıf halka
  //      odur. Kazanç yalnız birkaç yüzde dosya boyudur — sayfa içerikleri
  //      zaten sıkıştırılmış olarak kopyalanır.
  const ham = await hedef.save({
    useObjectStreams: false,
    objectsPerTick: SAVE_NESNE_ADIMI,
  });

  // KOPYA DEĞİL, GÖRÜNÜM: `new Uint8Array(ham)` baytları çoğaltırdı ve deste
  // onlarca MB. Buradaki tek iş, pdf-lib'in `ArrayBufferLike` bildirimini
  // `Response` gövdesinin istediği `ArrayBuffer` tabanına daraltmak.
  const bytes = new Uint8Array(ham.buffer as ArrayBuffer, ham.byteOffset, ham.byteLength);

  return { bytes, sayfaSayisi, birlesen, atlananlar };
}
