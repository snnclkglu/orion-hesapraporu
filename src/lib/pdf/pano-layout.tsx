// PANO YERLEŞİM BELGESİ — pano imalatçısına giden kâğıt.
//
// ═══════════════════════════════════════════ NEDEN AYRI BİR BELGE
//
// Ekipman listesi (`equipment-report.tsx`) satın almaya gider ve FİYAT/ADET
// sorusunu cevaplar; bu belge PANO İMALATÇISINA gider ve tek bir soruyu
// cevaplar: hangi gövdeden kaç tane, hangi ölçüde. Sipariş satırı ile yerleşim
// şeması aynı kâğıtta durmalı, yoksa imalatçı ölçüyü telefonla teyit eder.
//
// ÇİZİM `lib/diagrams` MODELİNDEN GELİR — ekranla AYNI model, aynı çevirici
// (`pdf/diagram.tsx`). İki ayrı çizici yazılsaydı kâğıttaki pano ile ekranda
// onaylanan pano bir gün ayrışırdı; o fark yanlış kesilmiş bir sac gövdedir.
//
// PARMAK İZİ ALTBİLGİDEDİR: plan saklanmıyor ve bu kâğıdın hangi girdiye
// dayandığı ancak burada yazılı kalır.

import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { PdfDiagram } from "./diagram";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
  panoNumaralari,
} from "@/lib/diagrams/panoLayout";
import { COLOR_GROUP_LABEL, MOUNT_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { PanelLayout } from "@/lib/switchboard/types";
// `brand.tsx` içe aktarıldığı anda fontları kaydeder (modül yan etkisi).
import { BRAND, BRAND_LOGO, FONTS, LOGO_RATIO, type CompanyInfo } from "./brand";

/** A4 dikey: dizilim yatay geniştir ama pano iç yerleşimi DİKEY uzar. */
const SAYFA_EN = 595;
const SAYFA_BOY = 842;
const KENAR = 28;
const ANTET_BOY = 42;
const ALTBILGI_BOY = 28;
const ICERIK_EN = SAYFA_EN - 2 * KENAR;
const ICERIK_BOY = SAYFA_BOY - 2 * KENAR - ANTET_BOY - ALTBILGI_BOY;

const S = StyleSheet.create({
  page: {
    paddingTop: KENAR,
    paddingBottom: KENAR + ALTBILGI_BOY,
    paddingHorizontal: KENAR,
    fontSize: 8.5,
    fontFamily: FONTS.sans,
    color: BRAND.ink,
  },
  antet: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1.2,
    borderBottomColor: BRAND.ink,
    paddingBottom: 5,
    marginBottom: 8,
    height: ANTET_BOY,
  },
  antetSol: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  antetBaslik: { fontSize: 12, fontWeight: 700, letterSpacing: -0.2 },
  antetKunye: { fontSize: 7, color: BRAND.gray600, marginTop: 1.5 },
  antetSag: { alignItems: "flex-end" },
  antetKod: { fontFamily: FONTS.mono, fontSize: 8, fontWeight: 600, color: BRAND.gray700 },
  antetGun: { fontFamily: FONTS.mono, fontSize: 7, color: BRAND.gray500, marginTop: 1.5 },
  altbilgi: {
    position: "absolute",
    left: KENAR,
    right: KENAR,
    bottom: KENAR - 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.5,
    borderTopColor: BRAND.line300,
    paddingTop: 4,
  },
  altbilgiMetin: { fontSize: 6.5, color: BRAND.gray500 },
  altbilgiMono: { fontFamily: FONTS.mono, fontSize: 6.5, color: BRAND.gray500 },

  bolumBaslik: {
    fontSize: 7,
    fontFamily: FONTS.mono,
    fontWeight: 600,
    letterSpacing: 1,
    color: BRAND.red,
    marginBottom: 3,
    marginTop: 10,
  },
  serit: { flexDirection: "row", gap: 18, marginBottom: 6 },
  kutu: { flexDirection: "column" },
  kutuBaslik: { fontSize: 6.5, color: BRAND.gray500, letterSpacing: 0.6 },
  kutuDeger: { fontSize: 10, fontFamily: FONTS.mono },
  baslikSatir: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.ink,
    paddingBottom: 2,
  },
  satir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.line300 },
  hucre: { paddingVertical: 2.5, paddingRight: 6, fontSize: 7.5 },
  mono: { fontFamily: FONTS.mono },
  uyari: { color: BRAND.red, fontSize: 7 },
  not: { fontSize: 7, color: BRAND.gray600, marginTop: 4 },
  cizimKutusu: { marginTop: 6, alignItems: "center" },
  panoBasi: { marginTop: 4 },
});

export interface PanoLayoutProps {
  sonuc: ComputeResult;
  meta: {
    docCode: string;
    generatedAt: string;
    preparedBy: string;
    scopeText: string;
    /** Elektrik projesinin sürümü — belgenin kaynağı. */
    sourceText: string;
    fingerprint: string;
    approvedText: string;
  };
  company: CompanyInfo;
}

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

function Antet({ meta }: { meta: PanoLayoutProps["meta"] }) {
  return (
    <View style={S.antet} fixed>
      <View style={S.antetSol}>
        <Image style={{ width: 88, height: 88 * LOGO_RATIO }} src={BRAND_LOGO} />
        <View>
          <Text style={S.antetBaslik}>PANO YERLEŞİMİ</Text>
          <Text style={S.antetKunye}>
            {meta.scopeText}
            {meta.preparedBy ? ` · Hazırlayan: ${meta.preparedBy}` : ""}
          </Text>
        </View>
      </View>
      <View style={S.antetSag}>
        <Text style={S.antetKod}>{meta.docCode}</Text>
        <Text
          style={S.antetGun}
          render={({ pageNumber, totalPages }) =>
            `${meta.generatedAt} · Sayfa ${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </View>
  );
}

function Altbilgi({ company, meta }: { company: CompanyInfo; meta: PanoLayoutProps["meta"] }) {
  const iletisim = [company.phone, company.email, company.web].filter(Boolean).join(" · ");
  return (
    <View style={S.altbilgi} fixed>
      <Text style={S.altbilgiMetin}>
        {company.company}
        {company.address ? ` · ${company.address}` : ""}
      </Text>
      <Text style={S.altbilgiMetin}>{iletisim}</Text>
      {/* PARMAK İZİ: plan saklanmıyor; bu kâğıdın hangi girdiye dayandığı
          yalnız burada yazılı kalır. */}
      <Text
        style={S.altbilgiMono}
        render={({ pageNumber, totalPages }) =>
          `${meta.fingerprint} · ${pageNumber}/${totalPages}`
        }
      />
    </View>
  );
}

/** Sipariş satırı — imalatçının ilk okuyacağı tablo. */
function SiparisTablosu({ panolar, baslik }: { panolar: PanelLayout[]; baslik: string }) {
  if (panolar.length === 0) return null;
  const toplamEn = panolar.reduce((t, p) => t + p.widthMm, 0);
  return (
    <>
      <Text style={S.bolumBaslik}>{baslik}</Text>
      <View style={S.baslikSatir}>
        <Text style={[S.hucre, { width: 78 }]}>Pano</Text>
        <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>En</Text>
        <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>Yükseklik</Text>
        <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>Derinlik</Text>
        <Text style={[S.hucre, S.mono, { width: 44, textAlign: "right" }]}>Baza</Text>
        <Text style={[S.hucre, { width: 46 }]}>Kapak</Text>
        <Text style={[S.hucre, S.mono, { width: 40, textAlign: "right" }]}>Ray</Text>
        <Text style={[S.hucre, S.mono, { width: 46, textAlign: "right" }]}>Cihaz</Text>
        <Text style={[S.hucre, { width: 90 }]}>Not</Text>
      </View>
      {panolar.map((p) => (
        <View key={p.code} style={S.satir} wrap={false}>
          <Text style={[S.hucre, S.mono, { width: 78 }]}>{p.code}</Text>
          <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>{say(p.widthMm)}</Text>
          <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>{say(p.heightMm)}</Text>
          <Text style={[S.hucre, S.mono, { width: 52, textAlign: "right" }]}>{say(p.depthMm)}</Text>
          <Text style={[S.hucre, S.mono, { width: 44, textAlign: "right" }]}>{say(p.baseMm)}</Text>
          <Text style={[S.hucre, { width: 46 }]}>{p.doorConfig === "cift" ? "Çift" : "Tek"}</Text>
          <Text style={[S.hucre, S.mono, { width: 40, textAlign: "right" }]}>{p.rails.length}</Text>
          <Text style={[S.hucre, S.mono, { width: 46, textAlign: "right" }]}>
            {p.placements.length}
          </Text>
          <Text style={[S.hucre, { width: 90 }]}>
            {p.splitOf ? `${p.splitOf} gözü` : p.warnings.length > 0 ? "uyarı var" : ""}
          </Text>
        </View>
      ))}
      <Text style={S.not}>
        {panolar.length} göz · toplam en {say(toplamEn)} mm · panolar bitişik dizilir, baza tek
        parçadır.
      </Text>
    </>
  );
}

function PanoSayfasi({ panel, sonuc }: { panel: PanelLayout; sonuc: ComputeResult }) {
  const numaralar = panoNumaralari(panel);
  // KÂĞITTAKİ ORAN MODELİN ÖLÇEĞİ DEĞİLDİR ve bu yüzden yazılmaz.
  //
  // `PdfDiagram` çizimi `maxWidth`/`maxHeight` ile sayfaya yeniden sığdırır;
  // 400 x 2000 mm'lik bir pano 1:2 modelde ~520 x 1090 birimken kâğıtta
  // ~298 birime iner, yani basılan oran ~1:10'dur. Altyazıda "ölçek 1:2"
  // yazmak, cetvelle ölçen bir imalatçıya YALAN SÖYLEMEK olurdu. Model ölçeği
  // burada yalnız AYRINTI YOĞUNLUĞUNU belirler; en yoğunu seçilir.
  const PDF_OLCEK = 2;
  const ic = panoIcYerlesimDiagram({
    panel,
    settings: sonuc.settings,
    olcek: PDF_OLCEK,
    olcekYazisi: false,
  });
  const gerecler = [...panel.bodyDevices, ...panel.sideDevices];
  const sirali = [...panel.placements].sort(
    (a, b) => a.railIndex - b.railIndex || a.xMm - b.xMm
  );

  return (
    <>
      <Text style={S.bolumBaslik} break>
        {panel.code} — İÇ YERLEŞİM
      </Text>
      <View style={S.serit}>
        <View style={S.kutu}>
          <Text style={S.kutuBaslik}>GÖVDE</Text>
          <Text style={S.kutuDeger}>
            {say(panel.widthMm)}×{say(panel.heightMm)}×{say(panel.depthMm)}
          </Text>
        </View>
        <View style={S.kutu}>
          <Text style={S.kutuBaslik}>BAZA</Text>
          <Text style={S.kutuDeger}>{say(panel.baseMm)}</Text>
        </View>
        <View style={S.kutu}>
          <Text style={S.kutuBaslik}>KAPAK</Text>
          <Text style={S.kutuDeger}>{panel.doorConfig === "cift" ? "Çift" : "Tek"}</Text>
        </View>
        <View style={S.kutu}>
          <Text style={S.kutuBaslik}>DOLULUK</Text>
          <Text style={S.kutuDeger}>%{say(Math.round(panel.fillRatio * 100))}</Text>
        </View>
      </View>

      {panel.warnings.map((u) => (
        <Text key={u} style={S.uyari}>
          ! {u}
        </Text>
      ))}

      {/* İKİ ÖLÇÜ BİRDEN ZORUNLU: kareye yakın bir çizimde yalnız `maxWidth`
          verilirse `wrap={false}` onu sonraki sayfaya iter ve orada da taşar
          (`pdf/diagram.tsx`teki ölçülmüş hata, 15.08.2026). */}
      <View style={S.cizimKutusu}>
        <PdfDiagram diagram={ic} maxWidth={ICERIK_EN} maxHeight={ICERIK_BOY - 90} />
      </View>

      <Text style={S.bolumBaslik}>{panel.code} — CİHAZ LİSTESİ</Text>
      <View style={S.baslikSatir}>
        <Text style={[S.hucre, S.mono, { width: 26, textAlign: "right" }]}>No</Text>
        <Text style={[S.hucre, S.mono, { width: 62 }]}>Aygıt</Text>
        <Text style={[S.hucre, { width: 92 }]}>Bölge</Text>
        <Text style={[S.hucre, { width: 78 }]}>Montaj</Text>
        <Text style={[S.hucre, S.mono, { width: 34, textAlign: "right" }]}>Ray</Text>
        <Text style={[S.hucre, S.mono, { width: 96, textAlign: "right" }]}>Ölçü (mm)</Text>
        <Text style={[S.hucre, { width: 60 }]}>Kaynak</Text>
        <Text style={[S.hucre, { width: 90 }]}>Grup</Text>
      </View>
      {sirali.map((y) => (
        <View
          key={`${y.deviceKey}-${y.railIndex}-${Math.round(y.xMm)}`}
          style={S.satir}
          wrap={false}
        >
          <Text style={[S.hucre, S.mono, { width: 26, textAlign: "right" }]}>
            {numaralar.get(`${y.deviceKey}#${y.railIndex}#${Math.round(y.xMm)}`) ?? "—"}
          </Text>
          <Text style={[S.hucre, S.mono, { width: 62 }]}>{y.label}</Text>
          <Text style={[S.hucre, { width: 92 }]}>{ZONE_LABEL[y.zone]}</Text>
          <Text style={[S.hucre, { width: 78 }]}>{MOUNT_LABEL[y.mountType]}</Text>
          <Text style={[S.hucre, S.mono, { width: 34, textAlign: "right" }]}>
            {y.railIndex + 1}
          </Text>
          <Text style={[S.hucre, S.mono, { width: 96, textAlign: "right" }]}>
            {Math.round(y.widthMm)}×{Math.round(y.heightMm)}×{Math.round(y.depthMm)}
            {y.unitCount > 1 ? ` (${y.unitCount}×)` : ""}
          </Text>
          <Text
            style={[S.hucre, { width: 60 }, y.dimSource === "tahmin" ? S.uyari : {}]}
          >
            {y.dimSource}
          </Text>
          <Text style={[S.hucre, { width: 90 }]}>{COLOR_GROUP_LABEL[y.colorGroup]}</Text>
        </View>
      ))}

      {/* ÇİZİLMEYEN AMA SİPARİŞ EDİLEN KALEMLER AYNI SAYFADA DURUR.
          Gövde gereci (fan, termostat, pano lambası) montaj plakasına
          girmez; pano yanı ekipmanı (siren, projektör) panonun dışına asılır.
          İkisi de bu panonun parçası ve imalatçının listesinde olmalı — ayrı
          bir belgeye bırakılsalar o belge unutulurdu. */}
      {gerecler.length > 0 && (
        <>
          <Text style={S.bolumBaslik}>{panel.code} — GÖVDE GERECİ ve PANO YANI</Text>
          <View style={S.baslikSatir}>
            <Text style={[S.hucre, S.mono, { width: 62 }]}>Aygıt</Text>
            <Text style={[S.hucre, { width: 78 }]}>Yer</Text>
            <Text style={[S.hucre, { width: 150 }]}>Ürün</Text>
            <Text style={[S.hucre, { width: 96, textAlign: "right" }]}>Ölçü (mm)</Text>
            <Text style={[S.hucre, { width: 152 }]}>Tanım</Text>
          </View>
          {gerecler.map((d) => (
            <View key={d.key} style={S.satir} wrap={false}>
              <Text style={[S.hucre, S.mono, { width: 62 }]}>{d.label}</Text>
              <Text style={[S.hucre, { width: 78 }]}>
                {d.mountType ? MOUNT_LABEL[d.mountType] : "—"}
              </Text>
              <Text style={[S.hucre, S.mono, { width: 150 }]}>
                {d.supplier} {d.typeNo}
              </Text>
              <Text style={[S.hucre, S.mono, { width: 96, textAlign: "right" }]}>
                {d.widthMm !== null
                  ? `${Math.round(d.widthMm)}×${Math.round(d.heightMm ?? 0)}×${Math.round(
                      d.depthMm ?? 0
                    )}`
                  : "ölçü yok"}
              </Text>
              <Text style={[S.hucre, { width: 152 }]}>{d.designation}</Text>
            </View>
          ))}
        </>
      )}
    </>
  );
}

export function PanoLayoutDocument({ sonuc, meta, company }: PanoLayoutProps) {
  const panolar = [...sonuc.room, ...sonuc.field];
  const hataliDenetim = sonuc.audits.filter((a) => !a.result.ok);

  return (
    <Document title={`Pano Yerleşimi ${meta.docCode}`} author={company.company}>
      <Page size="A4" style={S.page}>
        <Antet meta={meta} />
        <Altbilgi company={company} meta={meta} />

        {/* BAŞLIKLAR ELLE BÜYÜK YAZILIR: @react-pdf'in `textTransform`u
            locale'siz `toUpperCase()` çağırır ve "i" harfini "I" yapar. */}
        <View style={S.serit}>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>ODA PANOSU</Text>
            <Text style={S.kutuDeger}>{say(sonuc.room.length)}</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>SAHA PANOSU</Text>
            <Text style={S.kutuDeger}>{say(sonuc.field.length)}</Text>
          </View>
          {/* HER DİZİ KENDİ ÖLÇÜSÜNÜ BASAR (PANO-2). Tek kutu iki diziye
              birden hizmet edince, yalnız saha panosu olan bir işte bu kâğıt
              hiç var olmayan bir odanın ölçüsünü imalatçıya gönderiyordu. */}
          {sonuc.roomSize.panelCount > 0 && (
            <>
              <View style={S.kutu}>
                <Text style={S.kutuBaslik}>ODA YÜKSEKLİK</Text>
                <Text style={S.kutuDeger}>{say(sonuc.roomSize.heightMm)}</Text>
              </View>
              <View style={S.kutu}>
                <Text style={S.kutuBaslik}>ODA DERİNLİK</Text>
                <Text style={S.kutuDeger}>{say(sonuc.roomSize.depthMm)}</Text>
              </View>
            </>
          )}
          {sonuc.fieldSize.panelCount > 0 && (
            <>
              {/* SAHADA ORTAK YÜKSEKLİK YOKTUR (PANO-33): kutu başına
                  seçilir. Tek bir sayıyı "SAHA YÜKSEKLİK" diye basmak,
                  imalatçıya beş kutunun beşini de o boyda kestirirdi. */}
              <View style={S.kutu}>
                <Text style={S.kutuBaslik}>
                  {sonuc.fieldSize.sharedHeight ? "SAHA YÜKSEKLİK" : "SAHA EN YÜKSEK"}
                </Text>
                <Text style={S.kutuDeger}>{say(sonuc.fieldSize.heightMm)}</Text>
              </View>
              <View style={S.kutu}>
                <Text style={S.kutuBaslik}>SAHA DERİNLİK</Text>
                <Text style={S.kutuDeger}>{say(sonuc.fieldSize.depthMm)}</Text>
              </View>
            </>
          )}
          {/* BAZA DA DİZİ BAŞINADIR: oda gövdesi 200 mm baza üstünde durur,
              duvara asılan saha kutusunun bazası hiç olmayabilir. Tek bir kutu
              basmak, imalatçıya var olmayan bir ortak karar bildirirdi. */}
          {sonuc.roomSize.panelCount > 0 && (
            <View style={S.kutu}>
              <Text style={S.kutuBaslik}>ODA BAZA</Text>
              <Text style={S.kutuDeger}>{say(sonuc.settings.room.baseMm)}</Text>
            </View>
          )}
          {sonuc.fieldSize.panelCount > 0 && (
            <View style={S.kutu}>
              <Text style={S.kutuBaslik}>SAHA BAZA</Text>
              <Text style={S.kutuDeger}>{say(sonuc.settings.field.baseMm)}</Text>
            </View>
          )}
        </View>

        <Text style={S.not}>
          Kaynak: {meta.sourceText}. {meta.approvedText}
        </Text>

        {sonuc.estimatedCount > 0 && (
          <Text style={S.uyari}>
            ! {say(sonuc.estimatedCount)} aygıtın ölçüsü DOĞRULANMAMIŞTIR (kural tabanlı tahmin,
            şemada taralı). Gövde ölçüsü bu aygıtlar yüzünden değişebilir.
          </Text>
        )}

        <SiparisTablosu panolar={sonuc.room} baslik="ELEKTRİK ODASI PANOLARI" />
        <SiparisTablosu panolar={sonuc.field} baslik="SAHA PANOLARI" />

        {sonuc.room.length > 0 && (
          <View style={S.cizimKutusu} break>
            <PdfDiagram
              diagram={panoDizilimDiagram({
                panels: sonuc.room,
                baslik: "Pano dizilimi",
                not: `${sonuc.room.length} göz · ön görünüş · panolar bitişik`,
                yanCihazlar: sonuc.roomSideDevices,
              })}
              maxWidth={ICERIK_EN}
              maxHeight={ICERIK_BOY / 2}
            />
          </View>
        )}
        {sonuc.field.length > 0 && (
          <View style={S.cizimKutusu}>
            <PdfDiagram
              diagram={panoDizilimDiagram({
                panels: sonuc.field,
                baslik: "Saha panoları",
                not: `${sonuc.field.length} göz · elektrik odasına girmez`,
                yanCihazlar: sonuc.fieldSideDevices,
              })}
              maxWidth={ICERIK_EN}
              maxHeight={ICERIK_BOY / 2}
            />
          </View>
        )}

        {panolar.map((p) => (
          <PanoSayfasi key={p.code} panel={p} sonuc={sonuc} />
        ))}

        {/* DENETİM ÖZETİ KÂĞIDA BASILIR: kâğıda bakan kişi ekranı görmüyor ve
            planın kontrol edilip edilmediğini oradan öğrenemez. */}
        <Text style={S.bolumBaslik} break>
          YERLEŞİM DENETİMİ
        </Text>
        {/* GEÇENLER DE BASILIR (PANO-11). "Hepsi geçti" cümlesi imalatçıya
            neyin denetlendiğini söylemez; kâğıdın değeri hangi soruların
            sorulduğunun görünmesindedir. */}
        <Text style={S.not}>
          {say(sonuc.audits.length)} birim denetlendi;{" "}
          {hataliDenetim.length === 0
            ? "hepsi geçti"
            : `${say(hataliDenetim.length)} birimde hata var`}
          . Denetim yerleştiriciden bağımsızdır ve yalnız çıkan koordinatlara bakar.
        </Text>
        {sonuc.audits.map((a) => (
          <View key={a.code} wrap={false}>
            <Text style={[S.hucre, S.mono]}>{a.code}</Text>
            {a.result.checks.map((c) => (
              <Text key={c.key} style={c.ok ? S.not : S.uyari}>
                {c.ok ? "✓" : "✗"} {c.label} — {c.detail}
              </Text>
            ))}
          </View>
        ))}

        {sonuc.unplaced.length > 0 && (
          <>
            <Text style={S.bolumBaslik}>PANOYA GİRMEYEN AYGITLAR</Text>
            <Text style={S.not}>
              {say(sonuc.unplaced.length)} aygıt panoya girmedi. Bunlar sessizce düşmez; sebebi
              ekrandaki kuyruklarda satır satır durur.
            </Text>
          </>
        )}
      </Page>
    </Document>
  );
}

export async function renderPanoLayoutPdf(props: PanoLayoutProps): Promise<Buffer> {
  const belge = await pdf(<PanoLayoutDocument {...props} />).toBuffer();
  const parcalar: Buffer[] = [];
  for await (const yigin of belge as unknown as AsyncIterable<Buffer>) parcalar.push(yigin);
  return Buffer.concat(parcalar);
}
