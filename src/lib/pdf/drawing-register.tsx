// Parça defteri PDF'i — atölyeye/satınalmaya basılıp gidecek döküm.
//
// A4 YATAY: on üç sütunlu bir defter dikey sayfada okunmaz hâle gelirdi.
// Marka altyapısı (kırmızı omurga, bant, künye, folio) `brand.tsx`ten gelir —
// hesap raporu ve ekipman listesiyle aynı çerçeve, çünkü üçü de müşteriye ya
// da atölyeye TESLİM EDİLEN belgelerdir.
//
// Excel çıktısıyla AYNI süzgeçten geçer ve aynı künyeyi taşır; iki dosya yan
// yana konduğunda birbirini tutmalıdır.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, T, trUpper } from "@/lib/pdf/brand";
import type { CompanyInfo } from "@/lib/pdf/brand";
import type { RegisterMeta, RegisterPartOut } from "@/lib/excel/drawing-register";

/** Sütun payları — toplamı 100. Yatay A4'te on üç sütun ancak böyle sığar. */
const SUTUNLAR: { baslik: string; pay: number; sag?: boolean; orta?: boolean }[] = [
  { baslik: "Kod", pay: 13 },
  { baslik: "Tanım", pay: 22 },
  { baslik: "Montaj", pay: 13 },
  { baslik: "Tür", pay: 7 },
  { baslik: "Malz.", pay: 7 },
  { baslik: "Kal.", pay: 5, sag: true },
  { baslik: "Kategori", pay: 9 },
  { baslik: "Adet", pay: 4, sag: true },
  { baslik: "Boy", pay: 6, sag: true },
  { baslik: "Ağırlık", pay: 7, sag: true },
  { baslik: "MOD", pay: 2.3, orta: true },
  { baslik: "PDF", pay: 2.3, orta: true },
  { baslik: "DXF", pay: 2.4, orta: true },
];

const S = StyleSheet.create({
  satir: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2.2 },
  ayrac: { borderBottomWidth: 0.4, borderBottomColor: BRAND.line300 },
  baslikSatiri: {
    flexDirection: "row",
    backgroundColor: BRAND.ink,
    paddingVertical: 3,
    marginBottom: 1,
  },
  baslikYazi: { fontSize: 6.4, color: BRAND.white, fontFamily: FONTS.sans, paddingHorizontal: 2 },
  hucre: { fontSize: 6.6, paddingHorizontal: 2 },
  kod: { fontSize: 6.6, fontFamily: FONTS.mono, paddingHorizontal: 2 },
  montajSatiri: { backgroundColor: BRAND.paper200 },
});

function say(v: number | null, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

export interface RegisterDocProps {
  parts: RegisterPartOut[];
  meta: RegisterMeta;
  company: CompanyInfo;
}

export function RegisterDocument({ parts, meta, company }: RegisterDocProps) {
  return (
    <Document
      title={`${meta.packageTitle} — Parça Defteri`}
      author="Orion Cranes"
      subject={meta.docCode}
    >
      <BrandPage
        orientation="landscape"
        docLine={trUpper(`Orion Cranes · Parça Defteri · ${meta.packageTitle}`)}
        docCode={meta.docCode}
        company={company}
      >
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} logoWidth={130} />

        <Text style={[T.heading, { fontSize: 11, marginBottom: 2 }]}>
          {trUpper(meta.packageTitle)}
        </Text>
        <Text style={[T.micro, { marginBottom: 6 }]}>
          {[
            meta.itemNo ? `Kalem ${meta.itemNo}` : "Kalem eşleşmemiş",
            meta.groupCode && `Grup ${meta.groupCode}`,
            `${parts.length} satır`,
            meta.recognitionPct != null && `Tanıma %${meta.recognitionPct}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={[T.micro, { marginBottom: 8, color: BRAND.gray600 }]}>
          Süzgeç: {meta.filterText}
        </Text>

        {/* Başlık satırı her sayfada tekrar eder — sekizinci sayfada hangi
            sütunun ne olduğunu hatırlamak zorunda kalmamalı. */}
        <View style={S.baslikSatiri} fixed>
          {SUTUNLAR.map((s) => (
            <Text
              key={s.baslik}
              style={[
                S.baslikYazi,
                {
                  width: `${s.pay}%`,
                  textAlign: s.sag ? "right" : s.orta ? "center" : "left",
                },
              ]}
            >
              {s.baslik}
            </Text>
          ))}
        </View>

        {parts.map((p, i) => {
          const degerler = [
            p.partCode || "—",
            p.description,
            p.assemblyTitle,
            p.kindLabel,
            p.material,
            say(p.thicknessMm, 1),
            p.category,
            p.qty == null ? "" : String(p.qty),
            say(p.cutLengthMm, 1),
            say(p.weightKg, 3),
            p.hasModel ? "•" : "",
            p.hasSheet ? "•" : "",
            p.hasCut ? "•" : "",
          ];
          return (
            <View
              key={`${p.partCode}-${i}`}
              style={[S.satir, S.ayrac, ...(p.isMontaj ? [S.montajSatiri] : [])]}
              wrap={false}
            >
              {SUTUNLAR.map((s, c) => (
                <Text
                  key={s.baslik}
                  style={[
                    c === 0 ? S.kod : S.hucre,
                    {
                      width: `${s.pay}%`,
                      textAlign: s.sag ? "right" : s.orta ? "center" : "left",
                      fontWeight: p.isMontaj && c <= 1 ? 700 : 400,
                    },
                  ]}
                >
                  {degerler[c]}
                </Text>
              ))}
            </View>
          );
        })}
      </BrandPage>
    </Document>
  );
}

export function renderRegisterPdf(props: RegisterDocProps): Promise<Buffer> {
  return renderToBuffer(<RegisterDocument {...props} />);
}
