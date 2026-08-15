// KESİM PLANI PDF'i — atölyeye giden yerleşim belgesi.
//
// ═══════════════════════════════════════════ NEDEN AYRI BİR BELGE
//
// Talep PDF'i (`purchase-request.tsx`) tedarikçiye gider ve FİYATSIZDIR; kesim
// planı ATÖLYEYE gider ve fiyat orada zaten aranmaz. İkisinin okuyucusu, kâğıt
// yönü ve içeriği farklıdır: plan YATAY basılır çünkü 12 m'lik bir plaka dikey
// A4'e sığdırıldığında parça numaraları okunmaz olur.
//
// ÇİZİM `lib/diagrams` MODELİNDEN GELİR — ekranla AYNI model. İki ayrı çizici
// yazılsaydı kâğıttaki plan ile ekrandaki plan bir gün ayrışırdı ve o fark
// yanlış kesilmiş bir sac demektir.
//
// DENETİM ÖZETİ BELGEYE BASILIR: kâğıda bakan kişi ekranı görmüyor ve planın
// kontrol edilip edilmediğini oradan öğrenemez.

import {
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  Line as PdfLine,
  Rect as PdfRect,
  pdf,
} from "@react-pdf/renderer";
import type { Diagram, DiagramEl } from "@/lib/diagrams/model";
import { parcaNumaralari, yerlesimDiyagrami } from "@/lib/diagrams/nesting";
import type { DenetimSonucu, YerlesimSonucu } from "@/lib/purchasing/hammadde/nesting";
import { plakaAgirligiKg } from "@/lib/purchasing/hammadde/siniflar";
// `brand.tsx` içe aktarıldığı anda fontları kaydeder (modül yan etkisi).
import { BrandBand, CompanyBlock, type CompanyInfo } from "./brand";

const S = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontSize: 8.5 },
  h1: { fontSize: 12, fontFamily: "Archivo", fontWeight: 700, marginBottom: 2 },
  h2: { fontSize: 10, fontFamily: "Archivo", fontWeight: 700, marginTop: 10, marginBottom: 4 },
  kunye: { fontSize: 7.5, color: "#6B6560", marginBottom: 8 },
  serit: { flexDirection: "row", gap: 14, marginBottom: 6 },
  kutu: { flexDirection: "column" },
  kutuBaslik: { fontSize: 6.5, color: "#8A8480", letterSpacing: 0.6, textTransform: "uppercase" },
  kutuDeger: { fontSize: 10, fontFamily: "IBMPlexMono" },
  satir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#DCD9D7" },
  baslikSatir: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    paddingBottom: 2,
    marginTop: 4,
  },
  hucre: { paddingVertical: 2.5, paddingRight: 6, fontSize: 8 },
  mono: { fontFamily: "IBMPlexMono" },
  denetim: { fontSize: 7.5, marginBottom: 1.5 },
  uyari: { color: "#A41E1E" },
});

export interface KesimPlaniGrubu {
  tanim: string;
  kalite: string;
  kalinlikMm: number | null;
  sonuc: YerlesimSonucu;
  denetim: DenetimSonucu[];
  olcusuzParca: number;
}

export interface KesimPlaniProps {
  gruplar: KesimPlaniGrubu[];
  meta: { docCode: string; generatedAt: string; preparedBy: string; scopeText: string };
  company: CompanyInfo;
}

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

/** `DiagramEl` → react-pdf SVG. `report.tsx`teki çevirinin aynısı. */
function pdfEl(el: DiagramEl, i: number) {
  switch (el.kind) {
    case "line":
      return (
        <PdfLine
          key={i}
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          strokeDasharray={el.dash}
        />
      );
    case "rect":
      return (
        <PdfRect
          key={i}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          fill={el.fill ?? "none"}
          stroke={el.stroke ?? "none"}
          strokeWidth={el.strokeWidth ?? 0}
        />
      );
    case "polygon":
      return (
        <Path
          key={i}
          d={`M ${el.points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`}
          fill={el.fill ?? "none"}
          stroke={el.stroke ?? "none"}
          strokeWidth={el.strokeWidth ?? 0}
        />
      );
    case "path":
      return (
        <Path
          key={i}
          d={el.d}
          fill={el.fill ?? "none"}
          stroke={el.stroke ?? "none"}
          strokeWidth={el.strokeWidth ?? 0}
        />
      );
    case "text":
      return (
        <Text
          key={i}
          x={el.x}
          y={el.y}
          style={{
            // DejaVu ZORUNLU: Ø ve Türkçe harfler gömülü WinAnsi fontlarda yok
            // (md. 19'un dersi).
            fontFamily: "DejaVu",
            fontSize: el.size,
            fill: el.fill ?? "#262626",
          }}
          textAnchor={el.anchor}
        >
          {el.text}
        </Text>
      );
    default:
      return null;
  }
}

function PdfDiagram({ diagram, width }: { diagram: Diagram; width: number }) {
  const oran = diagram.height / diagram.width;
  return (
    <Svg
      width={width}
      height={width * oran}
      viewBox={`${diagram.x0 ?? 0} ${diagram.y0 ?? 0} ${diagram.width} ${diagram.height}`}
    >
      {diagram.els.map(pdfEl)}
    </Svg>
  );
}

/** Alınacak plakaların özeti — ölçü + kalınlık + kalite başına adet ve kilo. */
function plakaOzeti(gruplar: KesimPlaniGrubu[]) {
  const m = new Map<
    string,
    { enMm: number; boyMm: number; kalinlikMm: number | null; kalite: string; adet: number; kg: number }
  >();
  for (const g of gruplar) {
    const { enMm, boyMm } = g.sonuc.plaka;
    const k = `${enMm}x${boyMm}|${g.kalinlikMm ?? "?"}|${g.kalite}`;
    const v = m.get(k);
    if (v) {
      v.adet += g.sonuc.plakalar.length;
      v.kg += g.sonuc.plakaAgirlikKg ?? 0;
    } else {
      m.set(k, {
        enMm,
        boyMm,
        kalinlikMm: g.kalinlikMm,
        kalite: g.kalite,
        adet: g.sonuc.plakalar.length,
        kg: g.sonuc.plakaAgirlikKg ?? 0,
      });
    }
  }
  return [...m.values()].sort(
    (a, b) => (a.kalinlikMm ?? 0) - (b.kalinlikMm ?? 0) || a.enMm - b.enMm || a.boyMm - b.boyMm
  );
}

export function KesimPlaniDocument({ gruplar, meta, company }: KesimPlaniProps) {
  const toplamPlaka = gruplar.reduce((t, g) => t + g.sonuc.plakalar.length, 0);
  const plakaKg = gruplar.reduce((t, g) => t + (g.sonuc.plakaAgirlikKg ?? 0), 0);
  const parcaKg = gruplar.reduce((t, g) => t + (g.sonuc.parcaAgirlikKg ?? 0), 0);
  const fire = plakaKg > 0 ? 100 - (parcaKg / plakaKg) * 100 : 0;
  const CIZIM_EN = 760; // A4 yatay iç genişliği ≈ 786 pt

  return (
    <Document title={`Kesim Planı ${meta.docCode}`} author={company.company}>
      <Page size="A4" orientation="landscape" style={S.page}>
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} />
        <Text style={S.h1}>SAC KESİM PLANI</Text>
        <Text style={S.kunye}>
          {meta.scopeText}
          {meta.preparedBy ? ` · Hazırlayan: ${meta.preparedBy}` : ""}
        </Text>

        <View style={S.serit}>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>Plaka</Text>
            <Text style={S.kutuDeger}>{say(toplamPlaka)}</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>Plaka Ağırlığı</Text>
            <Text style={S.kutuDeger}>{say(Math.round(plakaKg))} kg</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>Parça Ağırlığı</Text>
            <Text style={S.kutuDeger}>{say(Math.round(parcaKg))} kg</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>Fire</Text>
            <Text style={S.kutuDeger}>%{say(fire, 1)}</Text>
          </View>
        </View>

        {/* ALINACAK PLAKALAR — belgenin ilk cevabı. Ekrandaki özetin aynısı;
            tedarikçiye giden sayı budur. */}
        <View style={S.baslikSatir}>
          <Text style={[S.hucre, { width: 130 }]}>Plaka Ölçüsü</Text>
          <Text style={[S.hucre, { width: 70 }]}>Kalınlık</Text>
          <Text style={[S.hucre, { width: 90 }]}>Kalite</Text>
          <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>Plaka Adet</Text>
          <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>kg / Plaka</Text>
          <Text style={[S.hucre, S.mono, { width: 70, textAlign: "right" }]}>Toplam kg</Text>
        </View>
        {plakaOzeti(gruplar).map((r) => (
          <View key={`${r.enMm}-${r.boyMm}-${r.kalinlikMm}-${r.kalite}`} style={S.satir}>
            <Text style={[S.hucre, S.mono, { width: 130 }]}>
              {say(r.enMm)} × {say(r.boyMm)} mm
            </Text>
            <Text style={[S.hucre, S.mono, { width: 70 }]}>
              {r.kalinlikMm == null ? "—" : `${say(r.kalinlikMm, 1)} mm`}
            </Text>
            <Text style={[S.hucre, { width: 90 }]}>{r.kalite || "—"}</Text>
            <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>{say(r.adet)}</Text>
            <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
              {say(Math.round(plakaAgirligiKg(r.kalinlikMm, r.enMm, r.boyMm) ?? 0))}
            </Text>
            <Text style={[S.hucre, S.mono, { width: 70, textAlign: "right" }]}>
              {say(Math.round(r.kg))}
            </Text>
          </View>
        ))}

        {gruplar.map((g) => {
          const numaralar = parcaNumaralari(g.sonuc.plakalar);
          const liste = [...numaralar.entries()]
            .map(([id, no]) => {
              const ornek = g.sonuc.plakalar.flatMap((p) => p.parcalar).find((p) => p.id === id);
              const adet = g.sonuc.plakalar.reduce(
                (t, p) => t + p.parcalar.filter((x) => x.id === id).length,
                0
              );
              return {
                no,
                id,
                ad: ornek?.ad ?? id,
                en: ornek?.kaynakEnMm ?? 0,
                boy: ornek?.kaynakBoyMm ?? 0,
                adet,
              };
            })
            .sort((a, b) => a.no - b.no);

          return (
            <View key={g.tanim} break={false}>
              <Text style={S.h2}>
                {g.tanim} — {g.sonuc.plakalar.length} × {say(g.sonuc.plaka.enMm)}×
                {say(g.sonuc.plaka.boyMm)} mm · pay {g.sonuc.payMm} mm · doluluk %
                {say(g.sonuc.dolulukYuzde, 1)}
              </Text>

              {/* DENETİM ÖZETİ — kâğıda bakan kişi ekranı görmüyor. */}
              {g.denetim.map((d) => (
                <Text key={d.ad} style={[S.denetim, ...(d.gecti ? [] : [S.uyari])]}>
                  {d.gecti ? "✓" : "!"} {d.ad}: {d.ozet}
                </Text>
              ))}
              {g.olcusuzParca > 0 && (
                <Text style={[S.denetim, S.uyari]}>
                  ! {say(g.olcusuzParca)} parçanın ölçüsü okunamadığı için yerleşime girmedi.
                </Text>
              )}
              {g.sonuc.sigmayanlar.map((x) => (
                <Text key={x.id} style={[S.denetim, S.uyari]}>
                  ! {x.adet} × {x.ad} — {x.neden}
                </Text>
              ))}

              {g.sonuc.plakalar.map((plaka) => (
                <View key={plaka.sira} wrap={false} style={{ marginTop: 6 }}>
                  <PdfDiagram
                    diagram={yerlesimDiyagrami({
                      plaka,
                      numaralar,
                      baslik: `${g.tanim} · Plaka ${plaka.sira}/${g.sonuc.plakalar.length}`,
                      altNot: `${say(plaka.parcalar.length)} parça · doluluk %${say(plaka.dolulukYuzde, 1)}`,
                    })}
                    width={CIZIM_EN}
                  />
                </View>
              ))}

              <View style={S.baslikSatir}>
                <Text style={[S.hucre, S.mono, { width: 28 }]}>No</Text>
                <Text style={[S.hucre, { flex: 1 }]}>Parça</Text>
                <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>En</Text>
                <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>Boy</Text>
                <Text style={[S.hucre, S.mono, { width: 50, textAlign: "right" }]}>Adet</Text>
              </View>
              {liste.map((r) => (
                <View key={r.id} style={S.satir} wrap={false}>
                  <Text style={[S.hucre, S.mono, { width: 28 }]}>{r.no}</Text>
                  <Text style={[S.hucre, { flex: 1 }]}>{r.ad}</Text>
                  <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
                    {say(r.en)}
                  </Text>
                  <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
                    {say(r.boy)}
                  </Text>
                  <Text style={[S.hucre, S.mono, { width: 50, textAlign: "right" }]}>
                    {say(r.adet)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <CompanyBlock
          company={company.company}
          address={company.address}
          phone={company.phone}
          email={company.email}
          web={company.web}
        />
      </Page>
    </Document>
  );
}

export async function renderKesimPlaniPdf(props: KesimPlaniProps): Promise<Buffer> {
  const belge = await pdf(<KesimPlaniDocument {...props} />).toBuffer();
  const parcalar: Buffer[] = [];
  for await (const yigin of belge as unknown as AsyncIterable<Buffer>) parcalar.push(yigin);
  return Buffer.concat(parcalar);
}
