// Orion Cranes PDF marka altyapısı — Marka Kimliği Kılavuzu REV 01 · 2026.
// Tüm PDF şablonları (hesap raporu, iş emri, ekipman listesi) bu modülü kullanır:
// fontlar, renkler, A4 sayfa anatomisi (kırmızı omurga + başlık bandı + folio altbilgi).
// Yalnızca sunucuda çalışır (Font.register dosya sisteminden okur).

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Document, Font, Image, Line, Link, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

const MARKA_DIR = path.join(process.cwd(), "public", "brand");

/**
 * Orion Cranes lockup logosu (kırmızı kilit + kelime markası, şeffaf zemin).
 *
 * Vercel trace'ine `next.config.ts` outputFileTracingIncludes ile dahil edilir.
 * Dosya BUFFER olarak okunur: react-pdf string `src`yi URL sayıp fetch etmeye
 * çalışır ve Windows dosya yolunda başarısız olur.
 */
export const BRAND_LOGO: Buffer = fs.readFileSync(path.join(MARKA_DIR, "orion-logo.png"));

/** Logonun gerçek oranı (596×67 px) — genişlik verilip yükseklik buradan çıkar. */
export const LOGO_RATIO = 67 / 596;

/**
 * KAĞIT RENKLİ lockup ve KÖMÜR monogram — `scripts/make-icons.ts` ÜRETİR.
 *
 * Kömür bant üzerinde tam renkli lockup okunmaz (kırmızı kilit koyu zemine
 * gömülür, "CRANES" grisi kaybolur); beyaz kartın köşesindeki küçük işaret ise
 * kelime markasını değil YALNIZ monogramı ister — firma adı zaten kartın
 * içinde yazılıdır. İkisi de vektörden türetilir, elle çizilmez.
 *
 * ORAN DOSYANIN KENDİSİNDEN OKUNUR (`pngOrani`): elle yazılmış bir sabit,
 * görsel yeniden üretildiğinde sessizce yanlışa dönerdi — logo esner ya da
 * ezilir, kimse fark etmez.
 */
export const BRAND_LOGO_PAPER: Buffer = fs.readFileSync(path.join(MARKA_DIR, "orion-logo-paper.png"));
export const BRAND_LOGO_INK: Buffer = fs.readFileSync(path.join(MARKA_DIR, "orion-logo-ink.png"));
export const BRAND_SYMBOL_INK: Buffer = fs.readFileSync(path.join(MARKA_DIR, "orion-symbol-ink.png"));

/** PNG başlığından (IHDR) yükseklik/genişlik oranı — 8 imza + 8 öbek başı = 16. bayt. */
function pngOrani(buf: Buffer): number {
  return buf.readUInt32BE(20) / buf.readUInt32BE(16);
}

/** Kağıt ve kömür lockup AYNI VEKTÖRDEN üretilir; oranları da aynıdır. */
export const LOGO_MONO_RATIO = pngOrani(BRAND_LOGO_PAPER);
export const SYMBOL_INK_RATIO = pngOrani(BRAND_SYMBOL_INK);

// Archivo — görünen her metin; IBM Plex Mono — her sayı, kod, etiket, kicker.
// DejaVu yalnız ✓/✗ glifleri için kalır (Archivo/Plex Mono bu glifleri içermez).
Font.register({
  family: "Archivo",
  fonts: [
    { src: path.join(FONT_DIR, "Archivo-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Archivo-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Archivo-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONT_DIR, "Archivo-ExtraBold.ttf"), fontWeight: 800 },
    { src: path.join(FONT_DIR, "Archivo-Black.ttf"), fontWeight: 900 },
  ],
});
Font.register({
  family: "PlexMono",
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexMono-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "IBMPlexMono-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({
  family: "DejaVu",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSans.ttf") },
    { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// ---------------------------------------------------------------- Sabitler
//
// PALET VE ÖLÇÜ BURADA DEĞİL `palette.ts`TE yaşar ve buradan YENİDEN DIŞA
// AKTARILIR: bu dosya `node:fs` taşır, yani istemciye giremez. El kitabı
// editörünün kâğıt önizlemesi ise bir istemci bileşenidir ve belgeyle AYNI
// renkleri kullanmak zorundadır. Kopyalanan bir palet bir gün ayrışırdı;
// tek tanım ikisini birden besler.

export { BRAND, PAGE, mm, trUpper } from "./palette";
import { BRAND, PAGE, mm, trUpper } from "./palette";

/**
 * Font aileleri — HER BİRİ DejaVu ile yedeklenir.
 *
 * Archivo ve IBM Plex Mono Yunan harflerini (σ τ η ψ λ ω φ Σ) ve ✓/✗ gliflerini
 * TAŞIMAZ. Yedek verilmezse @react-pdf bu kod noktalarını sıfır genişlikli
 * `.notdef` olarak dizer: harf komşusunun ÜZERİNE biner ("σmaks" → "Ǎmaks").
 * Mühendislik raporunun her sayfasında Yunan harfi geçtiği için yedek şarttır.
 * react-pdf 4.x `fontFamily` alanında dizi kabul eder ve eksik glifi sıradaki
 * aileden alır (kod noktası bazında yerine koyma).
 */
export const FONTS: { sans: string[]; mono: string[]; glyph: string[] } = {
  sans: ["Archivo", "DejaVu"],
  mono: ["PlexMono", "DejaVu"],
  glyph: ["DejaVu"],
};

// ---------------------------------------------------------------- Ortak stiller

/** Kılavuzun A4 tip rolleri — şablonlar spread ile kullanır: {...T.kicker} */
export const T = StyleSheet.create({
  display: { fontFamily: FONTS.sans, fontSize: 30, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.05, color: BRAND.ink },
  heading: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: 800, letterSpacing: -0.15, lineHeight: 1.15, color: BRAND.ink },
  subhead: { fontFamily: FONTS.sans, fontSize: 10.5, fontWeight: 700, color: BRAND.ink },
  body: { fontFamily: FONTS.sans, fontSize: 8.5, fontWeight: 400, lineHeight: 1.55, color: BRAND.gray700 },
  caption: { fontFamily: FONTS.sans, fontSize: 7.5, fontWeight: 500, lineHeight: 1.45, color: BRAND.gray600 },
  // kicker/kickerInk büyük harf GÖRÜNÜR ama dönüşüm stilde yapılmaz: metin
  // çağrı yerinde `trUpper()` ile (ya da doğrudan büyük yazılarak) verilir.
  kicker: { fontFamily: FONTS.mono, fontSize: 7, fontWeight: 600, letterSpacing: 1.5, color: BRAND.red },
  kickerInk: { fontFamily: FONTS.mono, fontSize: 7, fontWeight: 600, letterSpacing: 1.5, color: BRAND.gray500 },
  data: { fontFamily: FONTS.mono, fontSize: 8, fontWeight: 500, letterSpacing: 0.3, color: BRAND.ink },
  micro: { fontFamily: FONTS.mono, fontSize: 6, fontWeight: 400, letterSpacing: 0.4, color: BRAND.gray500 },
});

// ---------------------------------------------------------------- Bileşenler

/** Kicker altındaki 44×5 kırmızı çizginin PDF karşılığı (ölçek: 16×2pt) */
export function RuleRed({ width = 16 }: { width?: number }) {
  return <View style={{ width, height: 2, backgroundColor: BRAND.red, marginTop: 2 }} />;
}

/**
 * 135° ÇAPRAZ ŞERİT ALANI — kılavuzun altı grafik aygıtından biri.
 *
 * Kömür bir zemini düz bırakmak yerine dokulandırır: marka kitabı bu alanı hem
 * fotoğrafı olmayan görsel yuvalarında hem de kapak yönlerinde kullanır.
 * Kontrast BİLEREK ÇOK DÜŞÜKTÜR (#2F2E2C ⟷ #262626 ≈ 1,05:1) — doku ancak
 * ışık düştüğünde okunur, üzerindeki metni hiç etkilemez.
 *
 * NEDEN SVG: @react-pdf `repeating-linear-gradient` bilmez ve döndürülmüş
 * kutulardan şerit kurmak her kutuyu ayrı bir yerleşim düğümü yapardı. SVG
 * kendi görüntü alanına KIRPAR, yani çizgiler kutunun dışına taşmaz.
 *
 * Ölçü kaynağı kılavuzun CSS'idir: dik yönde 12 px şerit / 24 px periyot
 * (= 9 pt / 18 pt). 45°'lik bir çizgide aynı periyodun x ekseni karşılığı
 * √2 katıdır — çarpan düşerse şeritler sıkışır.
 */
export function StripeField({ width, height }: { width: number; height: number }) {
  const adim = 18 * Math.SQRT2;
  const cizgiler: number[] = [];
  for (let x = -height; x < width + adim; x += adim) cizgiler.push(x);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill={BRAND.ink} />
      {cizgiler.map((x, i) => (
        <Line key={i} x1={x} y1={0} x2={x + height} y2={height} stroke={BRAND.inkGhost} strokeWidth={9} />
      ))}
    </Svg>
  );
}

/** ✓ / ✗ glifi — yalnız DejaVu'da mevcut; ✗ kırmızı, ✓ yeşil */
export function CheckGlyph({ pass, size = 8 }: { pass: boolean; size?: number }) {
  return (
    <Text style={{ fontFamily: FONTS.glyph, fontSize: size, color: pass ? BRAND.success : BRAND.red }}>
      {pass ? "✓" : "✗"}
    </Text>
  );
}

/**
 * Çapraz marka filigranı — teslim edilen her sayfada.
 *
 * AMAÇ belgeyi işaretlemektir, süslemek değil: sayfa tarandığında ya da
 * fotokopilendiğinde kimin belgesi olduğu görünsün. Bu yüzden iki kural
 * pazarlıksızdır:
 *
 *  - **Okunurluğu bozmaz.** Opaklık %6'da; kömür metnin (#262626) kağıt
 *    üzerindeki kontrastı 15:1 iken filigranın kendi kontrastı 1,05:1
 *    civarındadır — göz onu ancak arayınca görür, satır okurken görmez.
 *    Kırmızı da bu yüzden soluk kalır: marka kuralı kırmızıyı VURGU olarak
 *    tanımlar, bir zemin dokusu olarak değil.
 *  - **İçeriğin ALTINDA kalır.** react-pdf boyama sırası belge sırasıdır;
 *    filigran `children`den ÖNCE çizilir, dolgulu tablo hücreleri ve
 *    diyagram zeminleri onu kendiliğinden örter.
 *
 * `fixed` olduğu için her sayfada yeniden basılır; sayfa yönü değişse de
 * dört kenara yaslandığından kendini ortalar.
 */
function Watermark() {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        src={BRAND_LOGO}
        style={{
          width: 430,
          height: 430 * LOGO_RATIO,
          opacity: 0.06,
          transform: "rotate(-45deg)",
        }}
      />
    </View>
  );
}

export interface CompanyInfo {
  company: string;
  address: string;
  phone?: string;
  email?: string;
  web?: string;
}

export interface PageFrameProps {
  /** Altbilgi sol satırı: `ORION CRANES · HESAP RAPORU · REV 03 · 2026` */
  docLine: string;
  /** Altbilgi orta: doküman kodu (`ORC-HR-412-R03`) — opsiyonel */
  docCode?: string;
  children: React.ReactNode;
  /**
   * Firma künyesi altbilgiye eklenir (ad · adres · telefon · e-posta · web).
   *
   * KÜNYE ALTBİLGİNİN İÇİNDEDİR, ayrı bir blok değil. Ayrı durduğunda künyenin
   * kendi çizgisi ile altbilgi çizgisi alt alta iki çizgi olarak basılıyor,
   * aralarında da doldurulmamış bir şerit kalıyordu. Tek çerçevede toplanınca
   * çizgi bir tane olur ve boşluk kendiliğinden kapanır; sayfanın alt payı da
   * künyenin varlığına göre burada ayarlanır (çağıranın elle pay vermesi
   * gerekmez — unutulduğunda içerik künyenin üstüne binerdi).
   */
  company?: CompanyInfo;
  /** Kapak sayfasında altbilgi çizgisi istenmezse */
  hideFooterRule?: boolean;
  /** El kitabında dış kenarda sürekli görünen bölüm sekmesi (ör. `4`, `EK-F`). */
  sectionLabel?: string;
  /** Sonradan birleştirilen eklerde folio, nihai belge numarasıyla damgalanır. */
  hidePageNumber?: boolean;
  /** Yalnız geniş tablo ve çizelgelerde A4 yatay kullanılır. */
  orientation?: "portrait" | "landscape";
  /** Kapak dışındaki sayfalarda üst sağ güvenli alanda tekrarlanan firma logosu. */
  topRightLogo?: BrandBandLogo;
  /**
   * TAM KANAMA SAYFA — kapak gibi kenardan kenara boyanan yapraklar için.
   *
   * Üç şeyi birden değiştirir ve üçü de aynı sebebe bağlıdır (içerik artık
   * sayfanın KENDİSİDİR, marj içindeki bir metin değil):
   *  - içerik payı sıfırlanır; payı bölgeler kendi içinde verir,
   *  - kırmızı omurga içerikten SONRA çizilir — akış sırası boyama sırasıdır
   *    ve tam kanamalı bir bant omurganın üstünü örterdi,
   *  - filigran basılmaz: kömür bant, lockup ve omurga markayı zaten
   *    taşır; %6 opaklıklı ikinci bir işaret orada gürültü olurdu.
   */
  bleed?: boolean;
  /**
   * MARKALI ALTBİLGİ — kapak tasarımının altbilgi dili (kullanıcı tasarımı,
   * 22.08.2026), belgenin BÜTÜN yapraklarında aynı.
   *
   * Varsayılan altbilgi tek satır gri mono'dur ve teslim edilen bir teklifte
   * belge kimliği o kadar silik kalamaz. Bu kipte doküman satırı kömür ve yarı
   * kalın basılır, folionun önünde 5 pt'lik kırmızı kare durur ve (verilirse)
   * doküman satırının ALTINA gri künye satırı eklenir.
   *
   * OPT-IN'DİR: hesap raporu, iş emri, bordro ve ekipman listesi bugünkü
   * altbilgisiyle kalır — teklifin kapak dilini bütün belgelere yaymak ayrı
   * bir karardır ve yerleşim denetçilerini birlikte götürür.
   */
  brandFooter?: { note?: string };
  style?: object;
}

/** Künyenin altbilgide kapladığı yükseklik (çizgi + iki satır + aralık). */
const COMPANY_FOOTER_HEIGHT = 28;

/** Kırmızı omurga — her sayfada, tam boy, solda; hiçbir şey içine taşmaz. */
function Spine() {
  return (
    <View
      fixed
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: PAGE.spine, backgroundColor: BRAND.red }}
    />
  );
}

/** Markalı altbilginin tipografisi (bkz. `PageFrameProps.brandFooter`). */
const F = StyleSheet.create({
  docLine: { fontFamily: FONTS.mono, fontSize: 6.4, fontWeight: 600, letterSpacing: 0.9, color: BRAND.ink },
  note: { fontFamily: FONTS.mono, fontSize: 5.6, letterSpacing: 0.4, color: BRAND.gray500, marginBottom: 3 },
  folio: { fontFamily: FONTS.mono, fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, color: BRAND.ink },
  square: { width: 3.75, height: 3.75, backgroundColor: BRAND.red, marginRight: 7.5 },
});

/** `07 / 25` — folio her zaman iki hanelidir (kılavuz yazımı). */
const folioYazisi = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
  `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;

/**
 * Markalı A4 sayfa: solda tam boy 8mm kırmızı omurga (hiçbir şey üzerine taşmaz),
 * sabit altbilgi (doküman satırı + folio "07 / 25"), doğru marjlarla içerik alanı.
 * Şablonlar <Page> yerine bunu kullanır.
 */
export function BrandPage({
  docLine,
  docCode,
  children,
  company,
  hideFooterRule,
  sectionLabel,
  hidePageNumber,
  orientation = "portrait",
  topRightLogo,
  bleed,
  brandFooter,
  style,
}: PageFrameProps) {
  return (
    <Page
      size="A4"
      orientation={orientation}
      style={{
        fontFamily: FONTS.sans,
        fontSize: 8.5,
        color: BRAND.ink,
        backgroundColor: BRAND.white,
        paddingTop: bleed ? 0 : PAGE.marginTop,
        paddingBottom: bleed ? 0 : PAGE.marginBottom + 14 + (company ? COMPANY_FOOTER_HEIGHT : 0),
        paddingLeft: bleed ? 0 : PAGE.contentLeft,
        paddingRight: bleed ? 0 : PAGE.marginOuter,
        ...style,
      }}
    >
      {/* Çapraz filigran — İÇERİKTEN ÖNCE çizilir ki altında kalsın */}
      {bleed ? null : <Watermark />}
      {bleed ? null : <Spine />}
      {topRightLogo ? (
        <View
          fixed
          style={{
            width: "100%",
            height: 18,
            alignItems: "flex-end",
            justifyContent: "center",
            marginBottom: 5,
          }}
        >
          <Image
            src={topRightLogo.src}
            style={{
              width: Math.min(72, 18 / topRightLogo.ratio),
              height: Math.min(18, 72 * topRightLogo.ratio),
              objectFit: "contain",
            }}
          />
        </View>
      ) : null}
      {sectionLabel ? (
        <View
          fixed
          style={{
            position: "absolute",
            top: mm(47),
            right: 0,
            width: mm(10),
            minHeight: mm(12),
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderLeftWidth: 1,
            borderColor: BRAND.red,
            backgroundColor: BRAND.white,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.mono,
              fontSize: sectionLabel.length > 3 ? 6.5 : 9,
              fontWeight: 600,
              color: BRAND.red,
            }}
          >
            {sectionLabel}
          </Text>
        </View>
      ) : null}
      {children}
      {/* TAM KANAMADA OMURGA EN SONDA: boyama sırası akış sırasıdır ve
          kenardan kenara bir bant, önce çizilmiş omurganın üstünü örterdi. */}
      {bleed ? <Spine /> : null}
      {/* Altbilgi: (varsa) firma künyesi + doküman kimliği + folio.
          Ayırıcı çizgi TEK: künye varsa çizgi künyenin üstündedir ve doküman
          satırı kendi çizgisini çizmez.

          ALTBİLGİ TAM KANAMADA DA MARJDADIR: sayfanın payı sıfırlansa bile
          folio yerini değiştirmez — okur onu her yaprakta aynı noktada arar. */}
      <View
        fixed
        style={{
          position: "absolute",
          left: PAGE.contentLeft,
          right: PAGE.marginOuter,
          bottom: mm(7),
        }}
      >
        {company ? <CompanyBlock {...company} /> : null}
        {brandFooter ? (
          <View
            style={{
              borderTopWidth: hideFooterRule ? 0 : 0.75,
              borderTopColor: BRAND.line300,
              paddingTop: 6.75,
            }}
          >
            {/* KÜNYE SATIRI DOKÜMAN SATIRININ ÜSTÜNDEDİR, altında değil.
                Tasarımda sıra terstir ama oradaki adres kısaltılmıştı; firmanın
                TESCİLLİ adresi telefon, e-posta ve web ile birlikte içerik
                genişliğinin TAMAMINI ister ve künye TEK SATIR kalmak zorundadır
                (satır sonu, dört alanın aynı satırda olduğunu kanıtlayan testin
                de ölçtüğü şeydir). Yanına folio konulsaydı ya künye sarardı ya
                da folio kağıdın dışına taşardı — ikisi de oldu, ölçüldü.

                Sıra tersine dönünce folio DOKÜMAN SATIRIYLA kalır ve sayfa
                numarasının kağıt dibine uzaklığı künyeli kapakta da künyesiz iç
                sayfada da AYNIDIR. */}
            {brandFooter.note ? <Text style={F.note}>{brandFooter.note}</Text> : null}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
              }}
            >
              {/* `flexBasis: 0` ŞART: temel genişlik "auto" bırakılırsa yoga
                  metnin ÖLÇÜLEN uzunluğunu taban alır, esnek satırda daralan
                  kutuda metni YENİDEN SARMAZ ve uzun bir konu folionun üstüne
                  biner. Sıfır tabanla satır yalnız ARTAN yeri kaplar. */}
              <Text style={[F.docLine, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]}>{docLine}</Text>
              {docCode ? <Text style={[F.docLine, { flexShrink: 0 }]}>{docCode}</Text> : null}
              {hidePageNumber ? null : (
                <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0 }}>
                  <View style={F.square} />
                  <Text style={F.folio} render={folioYazisi} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View
            style={{
              borderTopWidth: hideFooterRule ? 0 : 0.75,
              borderTopColor: BRAND.line300,
              paddingTop: 4,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={T.micro}>{docLine}</Text>
            {docCode ? <Text style={T.micro}>{docCode}</Text> : null}
            {hidePageNumber ? null : <Text style={T.micro} render={folioYazisi} />}
          </View>
        )}
      </View>
    </Page>
  );
}

/**
 * Marka bandı: solda lockup logo, sağda doküman kimliği, altında kömür kural.
 *
 * Müşteriye TESLİM EDİLEN her belgenin ilk sayfası markayı taşımalıdır; kırmızı
 * omurga ve folio tek başına logonun yerini tutmaz. Hesap raporunun kapağında
 * bu bant zaten vardı, ekipman listesinde yoktu — aynı bileşene çekildi ki iki
 * belge aynı yerde aynı yüksekliğe otursun.
 */
export function BrandBand({
  docCode,
  lines = [],
  logoWidth = 150,
  centerLogo,
  rightLogo,
  manualHeight,
  marginBottom = 10,
}: {
  docCode?: string;
  /** Sağ sütuna alt alta yazılan mono satırlar (ör. "REV 01 · 09.08.2026") */
  lines?: string[];
  logoWidth?: number;
  /** El kitabında orta yuvaya yerleşen partner logosu. */
  centerLogo?: BrandBandLogo;
  /** El kitabında sağ yuvaya yerleşen partner logosu. */
  rightLogo?: BrandBandLogo;
  /** El kitabının her sayfasında kullanılan sabit bant yüksekliği. */
  manualHeight?: number;
  /** Bandın ardından bırakılan akış payı. */
  marginBottom?: number;
}) {
  const manual = manualHeight !== undefined;
  const ortakMarka = Boolean(centerLogo || rightLogo);

  if (manual) {
    const meta = [docCode, ...lines].filter(Boolean).join("  ·  ");
    return (
      <View
        wrap={false}
        style={{
          height: manualHeight,
          borderBottomWidth: 1.4,
          borderBottomColor: BRAND.ink,
          marginBottom,
          justifyContent: "space-between",
        }}
      >
        {ortakMarka ? (
          <View style={{ flexDirection: "row", alignItems: "center", height: 23 }}>
            <LogoSlot align="left" logo={{ src: BRAND_LOGO, ratio: LOGO_RATIO }} maxWidth={132} />
            <LogoSlot align="center" logo={centerLogo} maxWidth={118} />
            <LogoSlot align="right" logo={rightLogo} maxWidth={118} />
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              height: 28,
            }}
          >
            <LogoSlot align="left" logo={{ src: BRAND_LOGO, ratio: LOGO_RATIO }} maxWidth={132} />
            {meta ? <Text style={{ ...T.data, color: BRAND.gray600 }}>{meta}</Text> : null}
          </View>
        )}
        {ortakMarka && meta ? (
          <Text style={{ ...T.micro, color: BRAND.gray600, textAlign: "right", marginBottom: 3 }}>
            {meta}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottomWidth: 1.4,
        borderBottomColor: BRAND.ink,
        paddingBottom: 8,
        marginBottom,
      }}
    >
      <Image style={{ width: logoWidth, height: logoWidth * LOGO_RATIO }} src={BRAND_LOGO} />
      <View style={{ alignItems: "flex-end" }}>
        {docCode ? <Text style={{ ...T.data, color: BRAND.gray600 }}>{docCode}</Text> : null}
        {lines.map((line, i) => (
          <Text key={i} style={{ ...T.data, color: BRAND.gray600, marginTop: 1.5 }}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** React-PDF'e verilecek logo baytları ve ölçülmüş yükseklik/genişlik oranı. */
export interface BrandBandLogo {
  src: Buffer;
  ratio: number;
}

function LogoSlot({
  logo,
  align,
  maxWidth,
}: {
  logo?: BrandBandLogo;
  align: "left" | "center" | "right";
  maxWidth: number;
}) {
  const maxHeight = 19;
  const oran = logo && Number.isFinite(logo.ratio) && logo.ratio > 0 ? logo.ratio : 1;
  const width = Math.min(maxWidth, maxHeight / oran);
  return (
    <View
      style={{
        width: "33.333%",
        alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        justifyContent: "center",
      }}
    >
      {logo ? <Image src={logo.src} style={{ width, height: width * oran, objectFit: "contain" }} /> : null}
    </View>
  );
}

/**
 * Firma künyesi — sayfa dibinde, folio satırının ÜSTÜNDE.
 *
 * Üç satır alt alta mono gri metin okunmuyordu: firma adı adresten ayrışmıyor,
 * iletişim satırı da adresin devamı gibi duruyordu. Blok iki sütuna ayrıldı —
 * solda KİMLİK (firma adı kömür/kalın + adres), sağda İLETİŞİM — ve firma adı
 * gövde ailesine alındı; künye artık bir imza gibi okunuyor.
 *
 * **AYIRICI ÇİZGİ KÜNYENİN ÜSTÜNDE DEĞİL ALTINDADIR** (kullanıcı bildirimi,
 * 12.08.2026: *"ilk sayfa footer bana hâlâ karmaşık geliyor"*). Çizgi üstteyken
 * künye ile folio satırı tek bir üç satırlık gri yığın olarak okunuyordu —
 * adresin nerede bitip doküman satırının nerede başladığı ayırt edilemiyordu.
 * Çizgi araya alınınca iki bölge ayrışır: üstte FİRMA KİMLİĞİ, altta BELGE
 * KİMLİĞİ. Çizgi hâlâ TEKTİR; künye yokken aynı çizgiyi folio satırı çizer.
 */
export function CompanyBlock({
  company,
  address,
  phone,
  email,
  web,
}: {
  company: string;
  address: string;
  phone?: string;
  email?: string;
  web?: string;
}) {
  const contact = [email, web].map((v) => (v ?? "").trim()).filter(Boolean).join("  ·  ");
  return (
    <View style={{ marginBottom: 5 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.sans,
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: 0.2,
              color: BRAND.ink,
            }}
          >
            {company}
          </Text>
          {address ? (
            <Text style={{ ...T.micro, color: BRAND.gray600, marginTop: 2 }}>{address}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          {phone ? <Text style={{ ...T.micro, color: BRAND.gray600 }}>{phone}</Text> : null}
          {contact ? (
            <Text style={{ ...T.micro, color: BRAND.gray600, marginTop: 2 }}>{contact}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Sayfa başlık bandı: mono kicker + kırmızı çizgi, büyük harf başlık,
 * sağda mono meta; altında 2pt kömür kural (kılavuz sayfa anatomisi).
 * Kicker ve başlık Türkçe kurala göre (`trUpper`) büyütülür — şablonlar
 * metni Title Case verebilir.
 */
export function PageHeader({ kicker, title, meta }: { kicker: string; title: string; meta?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={T.kicker}>{trUpper(kicker)}</Text>
          <RuleRed />
          <Text style={{ ...T.heading, marginTop: 5 }}>{trUpper(title)}</Text>
        </View>
        {meta ? (
          <Text style={{ ...T.data, fontSize: 7.5, color: BRAND.gray500, flexShrink: 0 }}>{meta}</Text>
        ) : null}
      </View>
      <View style={{ height: 1.4, backgroundColor: BRAND.ink, marginTop: 5 }} />
    </View>
  );
}

/**
 * Bölüm etiketi (kömür section-tag): mono numara + Türkçe başlık.
 * Rapor tamamen Türkçedir; İngilizce yan metin (gloss) taşınmaz.
 *
 * `minPresenceAhead` başlığın sayfa dibinde YALNIZ kalmasını engeller: altında
 * en az bu kadar boşluk yoksa başlık bir sonraki sayfaya taşınır. Varsayılan,
 * başlığın ardından en az birkaç satır içerik sığdıracak kadar yüksektir.
 */
export function SectionTag({
  no,
  title,
  status,
  minPresenceAhead = 90,
}: {
  no: string;
  title: string;
  /** Bölümün kontrol sayacı — başlığın sağında rozet olarak basılır */
  status?: { pass: number; total: number };
  minPresenceAhead?: number;
}) {
  const allOk = status ? status.pass === status.total : true;
  return (
    <View
      wrap={false}
      minPresenceAhead={minPresenceAhead}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: BRAND.ink,
        paddingVertical: 5,
        paddingLeft: 8,
        paddingRight: 6,
        marginBottom: 8,
        gap: 8,
      }}
    >
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: BRAND.redPale, flexShrink: 0 }}>{no}</Text>
      <Text style={{ fontFamily: FONTS.sans, fontSize: 10, fontWeight: 800, color: BRAND.paper100, flexGrow: 1, flexShrink: 1 }}>
        {trUpper(title)}
      </Text>
      {status && status.total > 0 ? (
        <View
          style={{
            paddingVertical: 1.5,
            paddingHorizontal: 5,
            flexShrink: 0,
            backgroundColor: allOk ? BRAND.success : BRAND.red,
          }}
        >
          <Text style={{ fontFamily: FONTS.mono, fontSize: 7, fontWeight: 600, letterSpacing: 0.6, color: BRAND.white }}>
            {status.pass}/{status.total} UYGUN
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export { Document, Image, Link, Page };
