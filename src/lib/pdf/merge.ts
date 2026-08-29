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

import {
  EncryptedPDFError,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFPage,
  PDFString,
  StandardFonts,
  rgb,
} from "pdf-lib";

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

// ---------------------------------------------------- kapak + ek yerleştirme

/** Kapağının ardına yerleştirilecek tek bir ek. */
export interface YerlestirilecekEk {
  /** Yalnız rapor için — dosya adı değil. */
  ad: string;
  bytes: Uint8Array;
  /** Ek içindeki adlandırılmış hedef → 0 tabanlı yerel sayfa. */
  destinations?: Readonly<Record<string, number>>;
  /** Eklenen bütün yaprakların dış kenarında gösterilecek bölüm etiketi. */
  sectionLabel?: string;
}

export interface EkYerlestirmeSecenekleri {
  /** Birleştirme bittikten sonra bütün yapraklara nihai `NN / TOPLAM` foliosu bas. */
  finalFolio?: boolean;
}

export interface EkYerlestirmeSonucu {
  bytes: Uint8Array<ArrayBuffer>;
  /** Kaç EK yerleştirildi (sayfa değil). */
  eklenen: number;
  /** Yerleştirilen toplam sayfa. */
  eklenenSayfa: number;
  atlananlar: AtlananPdf[];
}

export interface PdfSonaEklemeSecenekleri {
  /**
   * Temel belgenin sonunda yerinde kalacak sayfa sayısı.
   * Ekipman listesindeki kullanıcı ek kapakları sondadır; elektrik kataloğu
   * bu kapaklardan önce girer ki bütün katalog yaprakları tek blok kalsın.
   */
  sondakiSayfalardanOnce?: number;
}

/**
 * PDF eklerini temel belgeyi KOPYALAMADAN belirtilen konuma ekler.
 *
 * `pdfBirlestir` kullanılamaz: yeni belge kurarken react-pdf'in bölüm/katalog
 * hedef ağacını düşürür. Bu yol temel belgeyi yerinde açar, ek sayfaları
 * kopyalar ve hem temel listedeki hem ek dizinindeki adlandırılmış bağlantıları
 * doğrudan nihai sayfa nesnelerine çevirir. Böylece elektrik ekipman adı artık
 * oturumlu dış URL'ye değil aynı PDF'in sonundaki teknik föye gider.
 */
export async function pdfEkleriniSonaEkle(
  temelPdf: Uint8Array,
  ekler: readonly YerlestirilecekEk[],
  secenekler: PdfSonaEklemeSecenekleri = {}
): Promise<EkYerlestirmeSonucu> {
  const hedef = await PDFDocument.load(temelPdf, { updateMetadata: false });
  const atlananlar: AtlananPdf[] = [];
  const hedefSayfalar = new Map<string, PDFPage>();
  let eklenen = 0;
  let eklenenSayfa = 0;
  const sondaki = Math.max(0, Math.floor(secenekler.sondakiSayfalardanOnce ?? 0));
  if (sondaki > hedef.getPageCount()) {
    throw new Error("PDF sona ekleme sözleşmesi bozuldu: sondaki sayfa sayısı belgeyi aşıyor.");
  }
  let eklemeIndisi = hedef.getPageCount() - sondaki;

  for (const ek of ekler) {
    const ad = ek.ad.trim() || "(adsız belge)";
    if (!ek.bytes || ek.bytes.byteLength === 0) {
      atlananlar.push({ ad, sebep: "dosya boş geldi" });
      continue;
    }
    try {
      const kaynak = await PDFDocument.load(ek.bytes, { updateMetadata: false });
      const indisler = kaynak.getPageIndices();
      if (indisler.length === 0) {
        atlananlar.push({ ad, sebep: "belgede hiç sayfa yok" });
        continue;
      }
      const sayfalar = await hedef.copyPages(kaynak, indisler);
      sayfalar.forEach((sayfa, index) => hedef.insertPage(eklemeIndisi + index, sayfa));
      if (ek.destinations) {
        for (const [name, yerelSayfa] of Object.entries(ek.destinations)) {
          if (yerelSayfa < 0 || yerelSayfa >= sayfalar.length) continue;
          hedefSayfalar.set(name, sayfalar[yerelSayfa]);
        }
      }
      eklemeIndisi += sayfalar.length;
      eklenen += 1;
      eklenenSayfa += sayfalar.length;
    } catch (e) {
      atlananlar.push({ ad, sebep: sebepMetni(e) });
    }
  }

  if (hedefSayfalar.size > 0) {
    baglantilariHedefSayfalaraBagla(hedef, hedef.getPages(), hedefSayfalar);
  }
  const ham = await hedef.save({
    useObjectStreams: false,
    objectsPerTick: SAVE_NESNE_ADIMI,
  });
  return {
    bytes: new Uint8Array(ham.buffer as ArrayBuffer, ham.byteOffset, ham.byteLength),
    eklenen,
    eklenenSayfa,
    atlananlar,
  };
}

/**
 * Ekleri, TEMEL BELGENİN SON SAYFALARINDAKİ kapaklarının hemen ardına
 * yerleştirir.
 *
 * SÖZLEŞME: temel belgenin SON `ekler.length` sayfası, `ekler` ile AYNI
 * SIRADAKİ kapaklardır. Çağıran (ekipman listesi PDF'i) kapakları tam bu
 * sırayla basar; sözleşme bozulursa ek yanlış kapağın altına düşer.
 *
 * NEDEN `pdfBirlestir` DEĞİL: o, sayfaları YENİ bir belgeye kopyalar ve
 * kaynağın `/Root /Names /Dests` ağacı yeni belgeye taşınmaz. Ekipman
 * listesindeki "ekipman adına tıkla, ekine git" bağlantıları tam olarak o
 * ağaçtan çalışır (@react-pdf `View id` → adlandırılmış hedef); birleştirme
 * sonrası hepsi ÖLÜRDÜ. Burada temel belge YERİNDE açılır ve sayfalar İÇİNE
 * eklenir: katalog, ad ağacı ve bağlantı çapaları olduğu gibi kalır. Sayfa
 * ekleme çapaları bozmaz — hedefler sayfa SIRA NUMARASINA değil sayfa
 * NESNESİNE bağlıdır.
 *
 * BOZUK EK BÜTÜN BELGEYİ DÜŞÜRMEZ (merge.ts başlığındaki ilkenin aynısı) ama
 * KAPAĞI DA KALMAZ: okunamayan ekin kapağı silinir. Kalsaydı belge "bundan
 * sonraki 3 sayfa şu ekipmanın ekidir" der, ardından başka bir ekipmanın
 * kapağı gelirdi — sessiz bir yalan. Atlananlar adıyla ve sebebiyle döner ve
 * çağıran bunu kullanıcıya taşımak ZORUNDADIR.
 */
export async function pdfEkleriYerlestir(
  temelPdf: Uint8Array,
  ekler: readonly YerlestirilecekEk[],
  secenekler: EkYerlestirmeSecenekleri = {}
): Promise<EkYerlestirmeSonucu> {
  const hedef = await PDFDocument.load(temelPdf, { updateMetadata: false });
  const atlananlar: AtlananPdf[] = [];
  let eklenen = 0;
  let eklenenSayfa = 0;
  const eklenenGruplar: { pages: PDFPage[]; sectionLabel?: string }[] = [];

  // Kapak indisleri BAŞTAN hesaplanır ve SONDAN BAŞA işlenir: her yerleştirme
  // yalnız kendisinden SONRAKİ indisleri kaydırır, öndekiler geçerli kalır.
  const kapakSayisi = ekler.length;
  const ilkKapak = hedef.getPageCount() - kapakSayisi;
  if (ilkKapak < 0) {
    throw new Error(
      "Ek yerleştirme sözleşmesi bozuldu: temel belgede kapak sayısı kadar sayfa yok."
    );
  }

  for (let i = kapakSayisi - 1; i >= 0; i--) {
    const ek = ekler[i];
    const ad = ek.ad.trim() || "(adsız belge)";
    const kapakIndisi = ilkKapak + i;

    if (!ek.bytes || ek.bytes.byteLength === 0) {
      atlananlar.push({ ad, sebep: "dosya boş geldi" });
      hedef.removePage(kapakIndisi);
      continue;
    }

    try {
      const kaynak = await PDFDocument.load(ek.bytes, { updateMetadata: false });
      const indisler = kaynak.getPageIndices();
      if (indisler.length === 0) {
        atlananlar.push({ ad, sebep: "belgede hiç sayfa yok" });
        hedef.removePage(kapakIndisi);
        continue;
      }
      // ÖNCE hepsi kopyalanır, SONRA eklenir: kopyalama ortasında hata çıkarsa
      // belgeye yarım bir ek girmiş olmaz.
      const sayfalar = await hedef.copyPages(kaynak, indisler);
      if (ek.destinations) {
        ekBaglantilariniYenidenKur(hedef, sayfalar, ek.destinations);
      }
      sayfalar.forEach((sayfa, k) => hedef.insertPage(kapakIndisi + 1 + k, sayfa));
      eklenenGruplar.push({ pages: sayfalar, sectionLabel: ek.sectionLabel });
      eklenen += 1;
      eklenenSayfa += sayfalar.length;
    } catch (e) {
      atlananlar.push({ ad, sebep: sebepMetni(e) });
      hedef.removePage(kapakIndisi);
    }
  }

  if (secenekler.finalFolio) {
    await nihaiFolioyuBas(hedef, eklenenGruplar);
  }

  const ham = await hedef.save({
    useObjectStreams: false,
    objectsPerTick: SAVE_NESNE_ADIMI,
  });
  // Kopya DEĞİL görünüm (yukarıdaki gerekçe).
  const bytes = new Uint8Array(ham.buffer as ArrayBuffer, ham.byteOffset, ham.byteLength);
  // Döngü SONDAN BAŞA gitti; rapor BELGE SIRASINDA okunmalı. Ters sıradaki bir
  // atlama listesi, "kaçıncı ek eksik" sorusunu okuyanın kafasında çevirmesini
  // isterdi.
  atlananlar.reverse();
  return { bytes, eklenen, eklenenSayfa, atlananlar };
}

function hedefAdi(value: unknown): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  if (value instanceof PDFName) return value.asString().replace(/^\//, "");
  return null;
}

/** Kopyalanan ekin named-destination bağlantılarını nihai sayfa referansına çevirir. */
function ekBaglantilariniYenidenKur(
  document: PDFDocument,
  pages: readonly PDFPage[],
  destinations: Readonly<Record<string, number>>
): void {
  const hedefSayfalar = new Map<string, PDFPage>();
  for (const [name, localPage] of Object.entries(destinations)) {
    if (localPage < 0 || localPage >= pages.length) continue;
    hedefSayfalar.set(name, pages[localPage]);
  }
  baglantilariHedefSayfalaraBagla(document, pages, hedefSayfalar);
}

/** Bağlantı adlarını doğrudan nihai sayfa referanslarına çevirir. */
function baglantilariHedefSayfalaraBagla(
  document: PDFDocument,
  pages: readonly PDFPage[],
  destinations: ReadonlyMap<string, PDFPage>
): void {
  for (const page of pages) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) continue;
    for (const ref of annots.asArray()) {
      const annot = document.context.lookupMaybe(ref, PDFDict);
      if (!annot) continue;
      let holder = annot;
      let key = PDFName.of("Dest");
      let value = annot.get(key);
      if (!value) {
        const action = annot.lookupMaybe(PDFName.of("A"), PDFDict);
        if (!action) continue;
        holder = action;
        key = PDFName.of("D");
        value = action.get(key);
      }
      const name = hedefAdi(value);
      const targetPage = name === null ? undefined : destinations.get(name);
      if (!targetPage) continue;
      holder.set(
        key,
        document.context.obj([targetPage.ref, PDFName.of("XYZ"), null, null, null])
      );
    }
  }
}

/** Nihai toplam bilindikten sonra gövde ve eklerin tamamına tek folio basar. */
async function nihaiFolioyuBas(
  document: PDFDocument,
  inserted: readonly { pages: readonly PDFPage[]; sectionLabel?: string }[]
): Promise<void> {
  const font = await document.embedFont(StandardFonts.Helvetica);
  const allPages = document.getPages();
  const total = allPages.length;
  const red = rgb(164 / 255, 30 / 255, 30 / 255);
  const gray = rgb(107 / 255, 102 / 255, 99 / 255);
  const white = rgb(1, 1, 1);
  const sectionByPage = new Map<PDFPage, string>();
  for (const group of inserted) {
    if (!group.sectionLabel) continue;
    for (const page of group.pages) sectionByPage.set(page, group.sectionLabel);
  }

  allPages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const label = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    const size = 6;
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawRectangle({ x: width - 46 - textWidth, y: 16, width: textWidth + 8, height: 11, color: white });
    page.drawText(label, { x: width - 42 - textWidth, y: 19, size, font, color: gray });

    const sectionLabel = sectionByPage.get(page);
    if (!sectionLabel) return;
    const tabWidth = 28;
    const tabHeight = 34;
    const tabY = height - 168;
    page.drawRectangle({
      x: width - tabWidth,
      y: tabY,
      width: tabWidth,
      height: tabHeight,
      color: white,
      borderColor: red,
      borderWidth: 1,
    });
    const tabSize = sectionLabel.length > 4 ? 5.5 : 7;
    const tabTextWidth = font.widthOfTextAtSize(sectionLabel, tabSize);
    page.drawText(sectionLabel, {
      x: width - tabWidth + (tabWidth - tabTextWidth) / 2,
      y: tabY + (tabHeight - tabSize) / 2,
      size: tabSize,
      font,
      color: red,
    });
  });
}
