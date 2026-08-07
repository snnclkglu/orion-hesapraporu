// Orion Cranes PDF marka altyapısı — Marka Kimliği Kılavuzu REV 01 · 2026.
// Tüm PDF şablonları (hesap raporu, iş emri, ekipman listesi) bu modülü kullanır:
// fontlar, renkler, A4 sayfa anatomisi (kırmızı omurga + başlık bandı + folio altbilgi).
// Yalnızca sunucuda çalışır (Font.register dosya sisteminden okur).

import path from "node:path";
import React from "react";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

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

/** mm → pt (react-pdf point kullanır) */
export const mm = (n: number): number => n * 2.834645669;

/** Marka renkleri (tokens/colors.css ile birebir) */
export const BRAND = {
  red: "#A41E1E",
  redDeep: "#7D1717",
  redPale: "#F1C9C7",
  ink: "#262626",
  inkDeep: "#211F1D",
  steel: "#1F5C7A",
  slate: "#37474F",
  paper50: "#FAF8F7",
  paper100: "#F4F1EF",
  paper150: "#F1EEEC",
  paper200: "#E7E4E2",
  hairline: "#EDEAE8",
  line300: "#DCD9D7",
  line350: "#C6C2BF",
  gray400: "#B8B2AE",
  gray450: "#9A9591",
  gray500: "#8A8480",
  gray600: "#6B6663",
  gray700: "#48433F",
  white: "#FFFFFF",
  success: "#1F8A5B",
} as const;

/** A4 sayfa anatomisi (kılavuz: 8mm omurga, 16/16/14/11mm marjlar) */
export const PAGE = {
  spine: mm(8),
  marginTop: mm(16),
  marginOuter: mm(16),
  marginInner: mm(14),
  marginBottom: mm(13),
  /** İçerik alanı sol kenarı = omurga + iç marj */
  contentLeft: mm(8) + mm(14),
} as const;

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

/**
 * Türkçe büyük harf. @react-pdf'in `textTransform: "uppercase"` uygulaması
 * locale'siz `toUpperCase()` çağırır; bu da "i" harfini "I" yapar
 * ("Müşteri Bilgileri" → "MÜŞTERI BILGILERI"). Bu yüzden PDF şablonlarında
 * `textTransform` KULLANILMAZ, metin çağrı yerinde bu yardımcıyla büyütülür.
 */
export function trUpper(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}

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

/** ✓ / ✗ glifi — yalnız DejaVu'da mevcut; ✗ kırmızı, ✓ yeşil */
export function CheckGlyph({ pass, size = 8 }: { pass: boolean; size?: number }) {
  return (
    <Text style={{ fontFamily: FONTS.glyph, fontSize: size, color: pass ? BRAND.success : BRAND.red }}>
      {pass ? "✓" : "✗"}
    </Text>
  );
}

export interface PageFrameProps {
  /** Altbilgi sol satırı: `ORION CRANES · HESAP RAPORU · REV 03 · 2026` */
  docLine: string;
  /** Altbilgi orta: doküman kodu (`ORC-HR-412-R03`) — opsiyonel */
  docCode?: string;
  children: React.ReactNode;
  /** Kapak sayfasında altbilgi çizgisi istenmezse */
  hideFooterRule?: boolean;
  /** Yalnız geniş tablo ve çizelgelerde A4 yatay kullanılır. */
  orientation?: "portrait" | "landscape";
  style?: object;
}

/**
 * Markalı A4 sayfa: solda tam boy 8mm kırmızı omurga (hiçbir şey üzerine taşmaz),
 * sabit altbilgi (doküman satırı + folio "07 / 25"), doğru marjlarla içerik alanı.
 * Şablonlar <Page> yerine bunu kullanır.
 */
export function BrandPage({
  docLine,
  docCode,
  children,
  hideFooterRule,
  orientation = "portrait",
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
        paddingTop: PAGE.marginTop,
        paddingBottom: PAGE.marginBottom + 14,
        paddingLeft: PAGE.contentLeft,
        paddingRight: PAGE.marginOuter,
        ...style,
      }}
    >
      {/* Kırmızı omurga — her sayfada, tam boy, solda */}
      <View
        fixed
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: PAGE.spine, backgroundColor: BRAND.red }}
      />
      {children}
      {/* Altbilgi: doküman kimliği + folio */}
      <View
        fixed
        style={{
          position: "absolute",
          left: PAGE.contentLeft,
          right: PAGE.marginOuter,
          bottom: mm(7),
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
        <Text
          style={T.micro}
          render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`}
        />
      </View>
    </Page>
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

export { Document, Link, Page };
