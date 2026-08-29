"use client";

// EL KİTABININ KÂĞIT ÖNİZLEMESİ — belgenin KENDİ yerleşim çekirdeğiyle.
//
// Kullanıcı isteği (20.08.2026): *"Kullanıcı oluştururken ne yaptığını pek
// anlayamıyor. Belki o bölümün önizlemesini felan görebilse çok daha iyi
// olur."* Editör bugüne kadar bir FORM'du: metin kutuları, açılır listeler,
// rozetler. Mühendis yazdığı paragrafın belgede nereye düşeceğini, hangi
// sütuna, hangi yaprağa gideceğini GÖREMİYORDU.
//
// ÖNİZLEME PDF'İ TAKLİT ETMEZ, AYNI ÇEKİRDEĞİ ÇALIŞTIRIR.
//
// `manualAtomlari` + `manualPdfSayfalari` (`lib/manual/pdf-layout.ts`) saf
// TypeScript'tir — DB, HTTP ve React taşımaz (değişmez md. 7) — ve bu yüzden
// tarayıcıda da çalışır. Önizleme atomları ve sayfaları PDF'in kullandığı
// fonksiyonlardan alır: sütun bölünmesi, tam genişlik kararı, sayfa kırılması
// ve numaralandırma AYNI koddan gelir. İkinci bir yerleşim yazılsaydı önizleme
// bir gün belgeden başka bir şey söylerdi ve o an önizlemenin hiçbir değeri
// kalmazdı.
//
// ÖLÇEK CSS'TEDİR, JAVASCRIPT'TE DEĞİL. Yaprak `container-type: inline-size`
// taşıyan bir kabın içindedir ve bütün ölçüler `--pt` biriminden türetilir
// (1 pt = 100/595,28 cqw). Böylece PDF'teki HER SAYI buraya olduğu gibi
// yazılabilir — 8,5 punto gövde metni burada da 8,5'tir — ve kap ne kadar
// genişse yaprak o kadar büyür. `ResizeObserver` ile ölçmek gerekmez; gizli
// bir sekmede ResizeObserver tetiklenmez ve önizleme boş açılırdı.
//
// RENK `pdf/palette.ts`TEN GELİR, `globals.css`ten DEĞİL: ekranda gördüğü
// kırmızı ile bastığı kırmızı ayrışırsa önizleme yalan söyler. Bu, değişmez
// md. 6'nın ("renk hex değil AÇIdır") istisnası değil KAPSAMI DIŞIDIR — burada
// çizilen şey uygulamanın arayüzü değil, BASILACAK KÂĞIDIN kendisidir.

import React, { useMemo } from "react";
import { BRAND, PAGE, mm, trUpper } from "@/lib/pdf/palette";
import { markForLevel, markSlotWidth, markWidthForHeight, type MarkDef } from "@/lib/manual/marks";
import {
  SUTUN_BOSLUK,
  SUTUN_GENISLIK,
  TAM_GENISLIK,
  MANUAL_DIZIN_SAYFA_KAPASITESI,
  MANUAL_UST_BANT_ALT_BOSLUK,
  MANUAL_UST_BANT_YUKSEKLIK,
  bolumSayfalari,
  manualAnaBolumSayfalari,
  type ManualAtom,
  type ManualPdfSayfa,
} from "@/lib/manual/pdf-layout";
import { flattenManual, numberManual, printedManual } from "@/lib/manual/payload";
import { autoTableFor, type ManualSourceData } from "@/lib/manual/sources";
import {
  MANUAL_APPENDIX_LABELS,
  MANUAL_NOTE_LABELS,
  MANUAL_NOTE_LEVELS,
  MANUAL_NOTE_MEANING,
  type ManualAppendixKind,
  type ManualBlock,
  type ManualNoteLevel,
  type ManualPayload,
  type ManualTable,
} from "@/lib/manual/types";

const A4_GENISLIK = 595.28;
const A4_YUKSEKLIK = 841.89;

/** 1 pt kaç `cqw` eder — kabın genişliği A4 genişliğine denk sayılır. */
const PT_CQW = 100 / A4_GENISLIK;

/** PDF'teki pt değerini CSS uzunluğuna çevirir. */
const pt = (n: number): string => `calc(${n} * var(--oc-pt))`;

/** Uyarı kutusu renkleri — `pdf/manual.tsx`teki `NOT_RENGI` ile aynı sıra. */
const NOT_RENGI: Record<ManualNoteLevel, { kenar: string; zemin: string; metin: string }> = {
  not: { kenar: BRAND.line350, zemin: BRAND.paper100, metin: BRAND.gray700 },
  onemli: { kenar: BRAND.steel, zemin: BRAND.paper50, metin: BRAND.slate },
  dikkat: { kenar: BRAND.steel, zemin: BRAND.paper100, metin: BRAND.inkDeep },
  uyari: { kenar: BRAND.red, zemin: BRAND.paper50, metin: BRAND.inkDeep },
  tehlike: { kenar: BRAND.redDeep, zemin: BRAND.redPale, metin: BRAND.redDeep },
};

/** Görselin adresi ve ölçüsü — çağıran çözer (şablon varlığı ya da imzalı URL). */
export interface OnizlemeGorsel {
  url: string;
  /** Yükseklik / genişlik. Yerleşim çekirdeği de aynı oranı okur. */
  oran: number;
}

export interface ManualPaperProps {
  payload: ManualPayload;
  sources: ManualSourceData;
  /** `assetKey` ya da `imageId` → adres. */
  gorseller: ReadonlyMap<string, OnizlemeGorsel>;
  /** Altbilgi sol satırı — belgedekiyle aynı. */
  docLine: string;
  docCode: string;
  /** Vurgulanacak bölüm: o bölümün atomları kâğıtta işaretlenir. */
  vurguId?: string;
}

/** Önizlemenin dışarıya verdiği bilgi: hangi bölüm hangi yaprakta. */
export interface ManualPaperOlcu {
  sayfalar: ManualPdfSayfa[];
  /** Bölüm kimliği → belge sayfası (kapak ve içindekiler dahil). */
  sayfaNo: ReadonlyMap<string, number>;
  /** Gövdenin belgedeki ilk yaprağı. */
  govdeOfset: number;
}

/**
 * Gövdenin yerleşimi — editör bunu sayfa numarası göstermek için de çağırır.
 *
 * `pdf/manual.tsx`teki aritmetiğin AYNISI: ek kapsayıcısı gövdeden ayrılır,
 * her ana bölüm yeni sayfadan başlar, 9. bölüm tek sütundur; ofset kapak +
 * içindekiler kadardır.
 */
export function manualOnizlemeOlcusu(
  payload: ManualPayload,
  sources: ManualSourceData,
  oranlar: ReadonlyMap<string, number>
): ManualPaperOlcu {
  const numarali = numberManual(printedManual(payload).sections);
  const ekKapsayici = numarali.find((b) => b.children.some((c) => c.appendix)) ?? null;
  const govdeBolumleri = numarali.filter((b) => b !== ekKapsayici);
  const sayfalar = manualAnaBolumSayfalari(govdeBolumleri, sources, oranlar);
  const govdeBolumSayisi = flattenManual(govdeBolumleri).length;
  const dizinSayfasi = Math.ceil(govdeBolumSayisi / MANUAL_DIZIN_SAYFA_KAPASITESI);
  const govdeOfset = 1 + dizinSayfasi;
  return { sayfalar, sayfaNo: bolumSayfalari(sayfalar, govdeOfset), govdeOfset };
}

export function ManualPaper({
  payload,
  sources,
  gorseller,
  docLine,
  docCode,
  vurguId,
}: ManualPaperProps) {
  const oranlar = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, g] of gorseller) m.set(k, g.oran);
    return m;
  }, [gorseller]);

  const olcu = useMemo(
    () => manualOnizlemeOlcusu(payload, sources, oranlar),
    [payload, sources, oranlar]
  );
  const ortaLogo = gorseller.get(payload.partnerLogos.centerImageId ?? "");
  const sagLogo = gorseller.get(payload.partnerLogos.rightImageId ?? "");
  const kapakGorseli = gorseller.get(payload.coverImageId ?? "");

  return (
    <div className="grid gap-4">
      <div className="border-l-2 border-l-primary bg-card/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Kapak ve gövde önizlemesi. İçindekiler ile ek ayraçları nihai PDF
        çıktısında üretilir.
      </div>
      <Yaprak no={1} docLine={docLine} docCode={docCode} id="oc-yaprak-1">
        <KagitBrandBand
          docCode={docCode}
          centerLogo={ortaLogo}
          rightLogo={sagLogo}
        />
        <KapakIcerigi
          payload={payload}
          docCode={docCode}
          coverImage={kapakGorseli}
        />
      </Yaprak>
      {olcu.sayfalar.map((sayfa, i) => (
        <Yaprak
          key={i}
          no={i + olcu.govdeOfset}
          docLine={docLine}
          docCode={docCode}
          id={`oc-yaprak-${i + olcu.govdeOfset}`}
        >
          <KagitBrandBand
            docCode={docCode}
            centerLogo={ortaLogo}
            rightLogo={sagLogo}
          />
          {sayfa.bantlar.map((bant, bi) =>
            bant.kind === "full" ? (
              <div key={bi}>
                {bant.atoms.map((a, ai) => (
                  <Atom
                    key={ai}
                    atom={a}
                    sources={sources}
                    gorseller={gorseller}
                    genislik={TAM_GENISLIK}
                    vurguId={vurguId}
                  />
                ))}
              </div>
            ) : (
              <div key={bi} style={{ display: "flex", gap: pt(SUTUN_BOSLUK) }}>
                {[bant.sol, bant.sag].map((kol, ki) => (
                  <div key={ki} style={{ width: pt(SUTUN_GENISLIK), flexShrink: 0 }}>
                    {kol.map((a, ai) => (
                      <Atom
                        key={ai}
                        atom={a}
                        sources={sources}
                        gorseller={gorseller}
                        genislik={SUTUN_GENISLIK}
                        vurguId={vurguId}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )
          )}
        </Yaprak>
      ))}
      {olcu.sayfalar.length === 0 && (
        <p className="rounded-none border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belgede basılacak içerik yok. Bir bölüme metin girin ya da gizlenmiş
          bölümleri geri açın.
        </p>
      )}
    </div>
  );
}

function KagitBrandBand({
  docCode,
  centerLogo,
  rightLogo,
}: {
  docCode: string;
  centerLogo?: OnizlemeGorsel;
  rightLogo?: OnizlemeGorsel;
}) {
  const ortakMarka = Boolean(centerLogo || rightLogo);
  return (
    <div
      style={{
        height: pt(MANUAL_UST_BANT_YUKSEKLIK),
        marginBottom: pt(MANUAL_UST_BANT_ALT_BOSLUK),
        borderBottom: `${pt(1.4)} solid ${BRAND.ink}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {ortakMarka ? (
        <div style={{ height: pt(23), display: "flex", alignItems: "center" }}>
          <KagitLogoSlot align="left" url="/brand/orion-logo.png" oran={67 / 596} />
          <KagitLogoSlot align="center" url={centerLogo?.url} oran={centerLogo?.oran} />
          <KagitLogoSlot align="right" url={rightLogo?.url} oran={rightLogo?.oran} />
        </div>
      ) : (
        <div
          style={{
            height: pt(28),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/orion-logo.png"
            alt="ORION CRANES"
            style={{ width: pt(132), height: "auto", display: "block" }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: pt(8),
              color: BRAND.gray600,
            }}
          >
            {docCode}
          </span>
        </div>
      )}
      {ortakMarka ? (
        <div
          style={{
            marginBottom: pt(3),
            textAlign: "right",
            fontFamily: "var(--font-mono)",
            fontSize: pt(6),
            color: BRAND.gray600,
          }}
        >
          {docCode}
        </div>
      ) : null}
    </div>
  );
}

function KagitLogoSlot({
  url,
  oran,
  align,
}: {
  url?: string;
  oran?: number;
  align: "left" | "center" | "right";
}) {
  const guvenliOran = oran && oran > 0 ? oran : 1;
  const maxHeight = 19;
  const maxWidth = align === "left" ? 132 : 118;
  const width = Math.min(maxWidth, maxHeight / guvenliOran);
  return (
    <div
      style={{
        width: "33.333%",
        display: "flex",
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        alignItems: "center",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: pt(width), height: pt(width * guvenliOran), objectFit: "contain" }} />
      ) : null}
    </div>
  );
}

function KapakIcerigi({
  payload,
  docCode,
  coverImage,
}: {
  payload: ManualPayload;
  docCode: string;
  coverImage?: OnizlemeGorsel;
}) {
  return (
    <div>
      <div
        style={{
          marginTop: pt(coverImage ? mm(12) : mm(32)),
          fontSize: pt(24),
          fontWeight: 800,
          letterSpacing: pt(0.4),
        }}
      >
        {trUpper(payload.coverTitle || payload.identity.product)}
      </div>
      <div style={{ marginTop: pt(6), fontSize: pt(14), fontWeight: 500, color: BRAND.gray700 }}>
        {trUpper(payload.docTitle)}
      </div>
      <div style={{ marginTop: pt(8), width: pt(64), height: pt(2), background: BRAND.red }} />
      <div
        style={{
          marginTop: pt(7),
          fontFamily: "var(--font-mono)",
          fontSize: pt(7.5),
          letterSpacing: pt(0.8),
          color: BRAND.gray600,
        }}
      >
        OPERATÖR GÜVENLİĞİ · KULLANIM · BAKIM · MUAYENE
      </div>
      <div
        style={{
          marginTop: pt(mm(10)),
          fontFamily: "var(--font-mono)",
          fontSize: pt(11),
          fontWeight: 700,
          letterSpacing: pt(1.2),
        }}
      >
        {docCode}
      </div>
      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage.url}
          alt="Kapak görseli"
          style={{
            display: "block",
            width: "90%",
            maxHeight: pt(mm(63.5)),
            objectFit: "contain",
            margin: `${pt(14)} auto 0`,
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A4 yaprağı — kırmızı omurga, marjlar ve altbilgi `BrandPage` ile aynıdır.
 *
 * `content-visibility: auto` yirmi yaprağı ekranda tutmanın bedelini düşürür:
 * görünmeyen yaprak dizilmez. `containIntrinsicSize` olmadan kaydırma çubuğu
 * zıplardı — yüksekliği önceden söylemek zorunludur.
 */
function Yaprak({
  no,
  docLine,
  docCode,
  id,
  children,
}: {
  no: number;
  docLine: string;
  docCode: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="oc-sheet-wrap"
      style={{ containerType: "inline-size", width: "100%" }}
    >
      <div
        style={
          {
            "--oc-pt": `${PT_CQW}cqw`,
            position: "relative",
            width: "100%",
            height: pt(A4_YUKSEKLIK),
            background: BRAND.white,
            color: BRAND.ink,
            fontFamily: "var(--font-sans)",
            boxShadow: "0 1px 2px rgba(0,0,0,.10), 0 8px 24px rgba(0,0,0,.06)",
            overflow: "hidden",
            contentVisibility: "auto",
            containIntrinsicSize: `auto ${A4_YUKSEKLIK}px`,
          } as React.CSSProperties
        }
      >
        {/* Kırmızı omurga — belgedeki gibi tam boy, solda, hiçbir şey üstüne taşmaz */}
        <div
          style={{
            position: "absolute",
            insetBlock: 0,
            left: 0,
            width: pt(PAGE.spine),
            background: BRAND.red,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: pt(PAGE.contentLeft),
            right: pt(PAGE.marginOuter),
            top: pt(PAGE.marginTop),
            bottom: pt(PAGE.marginBottom + 14),
          }}
        >
          {children}
        </div>
        {/* Altbilgi: doküman satırı + kod + folio */}
        <div
          style={{
            position: "absolute",
            left: pt(PAGE.contentLeft),
            right: pt(PAGE.marginOuter),
            bottom: pt(mm(7)),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `${pt(0.75)} solid ${BRAND.line300}`,
            paddingTop: pt(4),
            fontFamily: "var(--font-mono)",
            fontSize: pt(6),
            letterSpacing: pt(0.4),
            color: BRAND.gray500,
          }}
        >
          <span>{docLine}</span>
          <span>{docCode}</span>
          <span>{String(no).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————— atomlar

const BASLIK_STIL: React.CSSProperties[] = [
  { fontSize: pt(14), fontWeight: 800, marginTop: pt(14), marginBottom: pt(5) },
  { fontSize: pt(11), fontWeight: 700, marginTop: pt(10), marginBottom: pt(4) },
  { fontSize: pt(9.5), fontWeight: 700, marginTop: pt(8), marginBottom: pt(3) },
  { fontSize: pt(9), fontWeight: 600, marginTop: pt(6), marginBottom: pt(2), color: BRAND.gray700 },
];

function Atom({
  atom,
  sources,
  gorseller,
  genislik,
  vurguId,
}: {
  atom: ManualAtom;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, OnizlemeGorsel>;
  genislik: number;
  vurguId?: string;
}) {
  if (atom.kind === "heading") {
    const b = atom.section;
    const stil = BASLIK_STIL[Math.min(b.depth, 4) - 1];
    return (
      <div
        data-oc-bolum={b.id}
        style={{ display: "flex", alignItems: "flex-start", ...vurgu(b.id === vurguId) }}
      >
        {b.number ? (
          <span
            style={{
              ...stil,
              fontFamily: "var(--font-mono)",
              color: BRAND.red,
              marginRight: pt(5),
              whiteSpace: "nowrap",
            }}
          >
            {b.number}
          </span>
        ) : null}
        <span style={{ ...stil, flex: 1 }}>{b.title}</span>
      </div>
    );
  }

  if (atom.kind === "block") {
    return (
      <Blok
        blok={atom.block}
        sources={sources}
        gorseller={gorseller}
        genislik={genislik}
        dilim={atom}
      />
    );
  }

  return null;
}

/** Seçili bölümün kâğıttaki izi — okuyanın gözü yazdığı yeri bulsun. */
function vurgu(acik: boolean): React.CSSProperties {
  if (!acik) return {};
  return {
    boxShadow: `${pt(-3)} 0 0 0 ${BRAND.red}`,
    background: "rgba(164,30,30,.05)",
  };
}

function Blok({
  blok,
  sources,
  gorseller,
  genislik,
  dilim,
}: {
  blok: ManualBlock;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, OnizlemeGorsel>;
  genislik: number;
  dilim?: ManualAtom;
}) {
  const govde: React.CSSProperties = {
    fontSize: pt(8.5),
    lineHeight: 1.5,
    marginBottom: pt(4),
    whiteSpace: "pre-wrap",
  };

  switch (blok.kind) {
    case "text":
      return (
        <div>
          {blok.margin?.trim() ? (
            <div
              style={{
                fontSize: pt(7.5),
                fontWeight: 700,
                letterSpacing: pt(0.6),
                color: BRAND.red,
                marginBottom: pt(2),
              }}
            >
              {trUpper(blok.margin)}
            </div>
          ) : null}
          <p style={govde}>{blok.text}</p>
        </div>
      );

    case "list": {
      const maddeler =
        dilim?.kind === "block" && dilim.items ? dilim.items : blok.items.filter((i) => i.trim());
      const ofset = dilim?.kind === "block" ? (dilim.itemOffset ?? 0) : 0;
      const sonucBas = dilim?.kind === "block" ? dilim.sonuc !== false : true;
      return (
        <div style={{ marginBottom: pt(4) }}>
          {maddeler.map((i, k) => (
            <div key={k} style={{ display: "flex", marginBottom: pt(2) }}>
              <span style={{ width: pt(12), fontSize: pt(8.5), color: BRAND.red, flexShrink: 0 }}>
                {blok.ordered ? `${ofset + k + 1}.` : "•"}
              </span>
              <span style={{ flex: 1, fontSize: pt(8.5), lineHeight: 1.45 }}>{i}</span>
            </div>
          ))}
          {sonucBas && blok.result?.trim() ? (
            <div style={{ display: "flex", marginTop: pt(2), marginBottom: pt(4) }}>
              <span style={{ width: pt(12), fontSize: pt(8.5), color: BRAND.red, flexShrink: 0 }}>
                →
              </span>
              <span style={{ flex: 1, fontSize: pt(8.5), lineHeight: 1.45, color: BRAND.gray700 }}>
                {blok.result}
              </span>
            </div>
          ) : null}
        </div>
      );
    }

    case "note": {
      const renk = NOT_RENGI[blok.level];
      const boy = 15;
      return (
        <div
          style={{
            borderLeft: `${pt(3)} solid ${renk.kenar}`,
            background: renk.zemin,
            padding: pt(6),
            marginBlock: pt(5),
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: pt(markSlotWidth(boy)), marginRight: pt(6), flexShrink: 0 }}>
            <Isaret level={blok.level} boy={boy} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: pt(8),
                fontWeight: 800,
                letterSpacing: pt(0.8),
                marginBottom: pt(2),
                color: renk.kenar,
              }}
            >
              {blok.title?.trim() || MANUAL_NOTE_LABELS[blok.level]}
            </div>
            <p style={{ ...govde, marginBottom: 0, color: renk.metin }}>{blok.text}</p>
          </div>
        </div>
      );
    }

    case "table":
      return <Tablo table={blok.table} dilim={dilim} />;

    case "image": {
      if (blok.assetKey === "sinyalKelimeleri") {
        return (
          <div>
            <SinyalCizelgesi />
            {blok.caption?.trim() ? (
              <div style={{ fontSize: pt(7), color: BRAND.gray600, marginTop: pt(2) }}>
                {blok.caption}
              </div>
            ) : null}
          </div>
        );
      }
      const g = gorseller.get(blok.assetKey ?? blok.imageId ?? "");
      if (!g) return null;
      const en = (blok.widthPct ?? 100) / 100;
      return (
        <figure style={{ marginBlock: pt(6) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={g.url}
            alt={blok.caption ?? ""}
            style={{ width: `${en * 100}%`, display: "block" }}
          />
          {blok.caption?.trim() ? (
            <figcaption style={{ fontSize: pt(7), color: BRAND.gray600, marginTop: pt(2) }}>
              {blok.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "auto": {
      const tablo = autoTableFor(blok, sources);
      if (tablo.rows.length === 0) {
        return blok.emptyText?.trim() ? (
          <p style={{ ...govde, color: BRAND.gray600 }}>{blok.emptyText}</p>
        ) : null;
      }
      return <Tablo table={tablo} dilim={dilim} />;
    }
  }
  void genislik;
  return null;
}

function Isaret({ level, boy }: { level: ManualNoteLevel; boy: number }) {
  const mark: MarkDef = markForLevel(level);
  const en = markWidthForHeight(mark, boy);
  return (
    <svg
      viewBox={`0 0 ${mark.vb.w} ${mark.vb.h}`}
      style={{ width: pt(en), height: pt(boy), display: "block", margin: "0 auto" }}
    >
      {mark.parts.map((p, i) => {
        if (p.t === "polygon") return <polygon key={i} points={p.points} fill={p.fill} />;
        if (p.t === "path") return <path key={i} d={p.d} fill={p.fill} />;
        if (p.t === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />;
        return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />;
      })}
    </svg>
  );
}

/** PDF'deki seçilebilir vektör sinyal çizelgesinin tarayıcı karşılığı. */
function SinyalCizelgesi() {
  const sirali = [...MANUAL_NOTE_LEVELS].reverse();
  const piktBoy = 22;
  const slot = markSlotWidth(piktBoy) + 12;
  const etiketEn = 58;
  return (
    <div style={{ width: "78%", marginBlock: pt(6) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: BRAND.paper150,
          borderBottom: `${pt(0.75)} solid ${BRAND.line350}`,
          paddingBlock: pt(3),
        }}
      >
        <div style={{ width: pt(slot), flexShrink: 0 }} />
        <div
          style={{
            width: pt(etiketEn),
            fontFamily: "var(--font-mono)",
            fontSize: pt(6.5),
            color: BRAND.gray500,
          }}
        >
          SİNYAL
        </div>
        <div
          style={{
            flex: 1,
            fontFamily: "var(--font-mono)",
            fontSize: pt(6.5),
            color: BRAND.gray500,
          }}
        >
          ANLAMI
        </div>
      </div>
      {sirali.map((duzey) => (
        <div
          key={duzey}
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: `${pt(0.4)} solid ${BRAND.hairline}`,
            paddingBlock: pt(4),
          }}
        >
          <div style={{ width: pt(slot), flexShrink: 0 }}>
            <Isaret level={duzey} boy={piktBoy} />
          </div>
          <div
            style={{
              width: pt(etiketEn),
              flexShrink: 0,
              fontSize: pt(8),
              fontWeight: 800,
              letterSpacing: pt(0.6),
              color: duzey === "tehlike" || duzey === "uyari" ? BRAND.red : BRAND.ink,
            }}
          >
            {trUpper(MANUAL_NOTE_LABELS[duzey])}
          </div>
          <div style={{ flex: 1, fontSize: pt(7.5), lineHeight: 1.4, color: BRAND.gray700 }}>
            {MANUAL_NOTE_MEANING[duzey]}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tablo — sütun payları `pdf/manual.tsx`teki AYNI kuralla çıkar.
 *
 * Aritmetik kopyalanmaz, TEKRARLANIR: en uzun hücrenin karakter sayısıyla
 * orantılı, 4–40 arasında kelepçeli, toplamı 100'e normalize.
 */
function Tablo({ table, dilim }: { table: ManualTable; dilim?: ManualAtom }) {
  const satirlar = dilim?.kind === "block" && dilim.rows ? dilim.rows : table.rows;
  const altyaziBas = dilim?.kind === "block" ? dilim.altyazi !== false : true;
  const sutun = Math.max(table.head.length, ...table.rows.map((r) => r.length), 1);
  const uzunluk = Array.from({ length: sutun }, (_, j) => {
    let en = (table.head[j] ?? "").length;
    for (const r of table.rows) en = Math.max(en, (r[j] ?? "").length);
    return Math.min(40, Math.max(4, en));
  });
  const toplam = uzunluk.reduce((a, b) => a + b, 0);
  const pay = uzunluk.map((u) => `${((u / toplam) * 100).toFixed(2)}%`);
  const hucre: React.CSSProperties = { padding: pt(3), fontSize: pt(7.5), lineHeight: 1.35 };

  return (
    <div style={{ marginBlock: pt(5) }}>
      <div
        style={{
          display: "flex",
          background: BRAND.paper150,
          borderBottom: `${pt(0.75)} solid ${BRAND.line350}`,
        }}
      >
        {Array.from({ length: sutun }).map((_, j) => (
          <div key={j} style={{ ...hucre, width: pay[j], fontWeight: 700 }}>
            {table.head[j] ?? ""}
          </div>
        ))}
      </div>
      {satirlar.map((r, i) => (
        <div key={i} style={{ display: "flex", borderBottom: `${pt(0.4)} solid ${BRAND.hairline}` }}>
          {Array.from({ length: sutun }).map((_, j) => (
            <div key={j} style={{ ...hucre, width: pay[j] }}>
              {r[j] ?? ""}
            </div>
          ))}
        </div>
      ))}
      {altyaziBas && table.caption?.trim() ? (
        <div style={{ fontSize: pt(7), color: BRAND.gray600, marginTop: pt(2) }}>
          {table.caption}
        </div>
      ) : null}
    </div>
  );
}

void MANUAL_APPENDIX_LABELS;
export type { ManualAppendixKind };
