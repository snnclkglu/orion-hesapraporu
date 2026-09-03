// EL KİTABININ GÜVENLİK İŞARETLERİ — VEKTÖR, raster değil.
//
// NEDEN VEKTÖR (ölçüldü, ORC-BK-0019-00-R01 s. 4, 430 dpi yakınlaştırma):
// piktogramlar `public/manual-assets/` altında RGB PNG'ydi ve ÜÇÜNÜN DE ZEMİNİ
// OPAKTI (köşe pikseli `(255,255,255)`, alfa kanalı yok). Uyarı kutusunun
// zemini kâğıt tonundadır; her piktogram o zeminin üzerinde BEYAZ BİR KARE
// olarak basılıyordu. "NOT" piktogramı ayrıca 64×101 pikseldi ve sinyal
// çizelgesi görselinden kırpıldığı için bulanıktı.
//
// Vektör bunu kökünden çözer: zemin yoktur, çözünürlük yoktur, dosya yoktur.
// `pdf/diagram.tsx` @react-pdf'in SVG ilkellerini zaten kullanıyor.
//
// ŞEKİL BURADA DEĞİL `lib/manual/marks.ts`TE tanımlıdır: aynı üçgeni editörün
// kâğıt önizlemesi de çizer ve iki çizici tek geometriden okur.

import { Circle, Path, Polygon, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { BRAND, FONTS, T, trUpper } from "./brand";
import {
  markForLevel,
  markSlotWidth,
  markWidthForHeight,
  type MarkDef,
} from "@/lib/manual/marks";
import {
  MANUAL_NOTE_LABELS,
  MANUAL_NOTE_LEVELS,
  MANUAL_NOTE_MEANING,
  type ManualNoteLevel,
} from "@/lib/manual/types";

/**
 * PİKTOGRAMIN KUTUDAKİ YÜKSEKLİĞİ — ölçü ile çizim TEK sayıdan okur.
 *
 * `manual/pdf-layout.ts` uyarı kutusunun yüksekliğini hesaplarken metne kalan
 * genişliği bu slottan çıkarır; sayı iki yerde yazılsaydı ölçü ile çizim
 * ayrışır ve @react-pdf taşan satırı sessizce kırpardı.
 */
export const NOT_PIKTOGRAM_BOY = 15;

/** Üç düzeyin de sığdığı slot genişliği (en geniş şekil üçgendir). */
export const NOT_PIKTOGRAM_SLOT = markSlotWidth(NOT_PIKTOGRAM_BOY);

/** Piktogram ile metin arasındaki oluk. */
export const NOT_PIKTOGRAM_OLUK = 6;

/** Saf şekil tanımını @react-pdf ilkellerine çevirir. */
function Sekil({ mark, boy }: { mark: MarkDef; boy: number }) {
  const en = markWidthForHeight(mark, boy);
  return (
    <Svg width={en} height={boy} viewBox={`0 0 ${mark.vb.w} ${mark.vb.h}`}>
      {mark.parts.map((p, i) => {
        if (p.t === "polygon") return <Polygon key={i} points={p.points} fill={p.fill} />;
        if (p.t === "path") return <Path key={i} d={p.d} fill={p.fill} />;
        if (p.t === "circle") return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />;
        return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />;
      })}
    </Svg>
  );
}

/**
 * DÜZEY → İŞARET, kutunun solunda.
 *
 * Şekiller AYNI YÜKSEKTEDİR ve ortak bir slotta ortalanır: kutunun ilk satırı
 * üç düzeyde de aynı yerden başlamalı, yoksa üst üste dizilmiş kutularda
 * başlıklar birbirini tutmazdı.
 */
export function ManualNotIsareti({
  level,
  boy = NOT_PIKTOGRAM_BOY,
}: {
  level: ManualNoteLevel;
  boy?: number;
}) {
  return (
    <View style={{ width: markSlotWidth(boy), alignItems: "center" }}>
      <Sekil mark={markForLevel(level)} boy={boy} />
    </View>
  );
}

/**
 * SİNYAL KELİMELERİ ÇİZELGESİ — belgenin kendi açıklama tablosu.
 *
 * ÖNCEDEN BİR EKRAN GÖRÜNTÜSÜYDÜ (`sinyal-kelimeleri.png`, 959×428): kaynak
 * Word belgesinden alınmıştı ve kendi çerçevesini, kendi yazı tipini, kendi
 * hücre kenarlıklarını taşıyordu. Belgenin ilk okunan sayfasında, kılavuzun
 * kendi tipografisinin yanında YABANCI duruyordu; ayrıca metni seçilemez,
 * aranamaz, büyütülemezdi ve çizelgedeki tanımlar `types.ts`teki
 * `MANUAL_NOTE_MEANING` ile ayrışabilirdi — bir görselin içindeki cümleyi
 * hiçbir test okuyamaz.
 *
 * ÇİZELGE EN CİDDİDEN BAŞLAR: `MANUAL_NOTE_LEVELS` artan ciddiyettedir ve
 * bir güvenlik çizelgesinde gözün ilk gördüğü satır TEHLİKE olmalıdır.
 */
export function ManualSinyalCizelgesi({ genislik }: { genislik: number }) {
  const sirali = [...MANUAL_NOTE_LEVELS].reverse();
  const piktBoy = SINYAL_PIKT_BOY;
  const slot = markSlotWidth(piktBoy) + 12;
  const etiketEn = 58;
  return (
    <View style={{ width: genislik, marginVertical: 6 }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: BRAND.paper150,
          borderBottomWidth: 0.75,
          borderBottomColor: BRAND.line350,
          paddingVertical: 3,
        }}
      >
        <View style={{ width: slot }} />
        <Text style={[T.kickerInk, { width: etiketEn, fontSize: 6.5 }]}>SİNYAL</Text>
        <Text style={[T.kickerInk, { flex: 1, fontSize: 6.5 }]}>ANLAMI</Text>
      </View>
      {sirali.map((d) => (
        <View
          key={d}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 0.4,
            borderBottomColor: BRAND.hairline,
            paddingVertical: SINYAL_SATIR_PAY,
          }}
          wrap={false}
        >
          <View style={{ width: slot, alignItems: "center" }}>
            <Sekil mark={markForLevel(d)} boy={piktBoy} />
          </View>
          <Text
            style={{
              width: etiketEn,
              fontFamily: FONTS.sans,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: 0.6,
              color: d === "tehlike" || d === "uyari" ? BRAND.red : BRAND.ink,
            }}
          >
            {trUpper(MANUAL_NOTE_LABELS[d])}
          </Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONTS.sans,
              fontSize: 7.5,
              lineHeight: 1.4,
              color: BRAND.gray700,
            }}
          >
            {MANUAL_NOTE_MEANING[d]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Çizelgedeki piktogramın boyu. */
export const SINYAL_PIKT_BOY = 22;
/** Çizelge satırının dikey payı (iki yandan). */
const SINYAL_SATIR_PAY = 4;

/**
 * ÇİZELGENİN ÖLÇÜLMÜŞ YÜKSEKLİĞİ — yerleşim çekirdeği bunu okur.
 *
 * Çekirdek React'i tanımaz (değişmez md. 7), bu yüzden bileşeni ölçemez;
 * sayı BURADA yaşar ve bileşenin stilleriyle birlikte değişir. Aritmetik
 * yukarıdaki stillerin kendisidir ve KOPYALANMAZ, TEKRARLANIR:
 * başlık satırı (6,5×1,2 + 3+3 dolgu + 0,75 çizgi) + beş satır
 * (piktogram boyu + 4+4 dolgu + 0,4 çizgi) + 6+6 dikey pay.
 */
export const SINYAL_CIZELGE_YUKSEKLIGI =
  6.5 * 1.2 + 6 + 0.75 + 5 * (SINYAL_PIKT_BOY + 2 * SINYAL_SATIR_PAY + 0.4) + 12;
