// PDF formül görüntüleyici — MathNode ağacını react-pdf View/Text ile 2B
// matematik olarak dizer (flexbox: kesir yığını, radikal, üs/alt indis).
// Web görüntüleyiciyle aynı ağacı kullanır. Font: DejaVu (Türkçe glifler +
// oblique = italik değişkenler). Ayrıştırılamayan formül düz italik metne düşer.
//
// YERLEŞİM İLKESİ — üst/alt indisler NEGATİF MARJLA kaydırılmaz.
// Negatif marj kutunun ölçüsünü büyütmediği için üs, üstündeki kesir çizgisinin
// ya da kök çizgisinin ÜZERİNE biniyordu ("σeğ²" → çizgi ² içinden geçiyordu).
// Bunun yerine taban kutusuna simetrik dolgu verilir: kutu üssü/indisi gerçekten
// KAPSAR, satır yüksekliği doğru hesaplanır ve hiçbir şey komşusuna girmez.
// Simetri (üstte ve altta eşit dolgu) tabanın kutu merkezinde kalmasını sağlar;
// böylece `alignItems: center` ile dizilen satırlarda taban hizası bozulmaz.

import { Text, View } from "@react-pdf/renderer";
import { parseFormula, type MathNode } from "@/lib/math/formula";

const INK = "#262626";
const OP = "#6B6663";

/** Üs/indis kayma oranları (em) ve ölçek — klasik dizgi değerlerine yakın */
const SUP_RISE = 0.4;
const SUB_DROP = 0.28;
const SCRIPT_SCALE = 0.68;

function isVar(v: string): boolean {
  return /[A-Za-zÇĞİÖŞÜçğıöşüσταπηλκψαβγδωρφθνξεζχιµ]/.test(v);
}

/**
 * Düğümün kaba yüksekliği (em cinsinden, 1 = tek satır metin).
 *
 * Parantezleri içeriğe göre BÜYÜTMEK için gerekir: sabit boyutlu bir "("
 * iki katlı bir kesrin yanında gülünç kalıyor ve ifadeyi kavramıyordu.
 */
function heightEm(n: MathNode): number {
  switch (n.t) {
    case "text":
      return 1;
    case "row":
      return n.items.reduce((m, it) => Math.max(m, heightEm(it)), 1);
    case "frac":
      return heightEm(n.num) + heightEm(n.den) + 0.36;
    case "sup":
      return heightEm(n.base) + SUP_RISE;
    case "sub":
      return heightEm(n.base) + SUB_DROP;
    case "sqrt":
      return heightEm(n.inner) + 0.26;
    case "paren":
      return heightEm(n.inner);
  }
}

function Node({ node, size }: { node: MathNode; size: number }): React.ReactElement {
  switch (node.t) {
    case "text": {
      if (node.kind === "rel")
        return <Text style={{ fontSize: size, color: OP, marginHorizontal: 2.5 }}>{node.v}</Text>;
      if (node.kind === "op") {
        if (node.v === " ") return <View style={{ width: size * 0.22 }} />;
        return <Text style={{ fontSize: size, color: OP, marginHorizontal: 1.4 }}>{node.v}</Text>;
      }
      if (node.kind === "num")
        return <Text style={{ fontSize: size, color: INK }}>{node.v}</Text>;
      return (
        <Text style={{ fontSize: size, color: INK, fontStyle: isVar(node.v) ? "italic" : undefined }}>
          {node.v}
        </Text>
      );
    }
    case "row":
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {node.items.map((it, i) => (
            <Node key={i} node={it} size={size} />
          ))}
        </View>
      );
    case "frac": {
      // Pay/payda kesir çizgisine değmez: yazı boyuyla orantılı hava bırakılır.
      const gap = size * 0.2;
      return (
        <View style={{ flexDirection: "column", alignItems: "center", marginHorizontal: 2 }}>
          <View style={{ paddingHorizontal: 3, paddingBottom: gap }}>
            <Node node={node.num} size={size} />
          </View>
          <View style={{ height: 0.7, alignSelf: "stretch", backgroundColor: INK }} />
          <View style={{ paddingHorizontal: 3, paddingTop: gap }}>
            <Node node={node.den} size={size} />
          </View>
        </View>
      );
    }
    case "sup": {
      const rise = size * SUP_RISE;
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {/* Simetrik dolgu: taban kutunun ortasında kalır, üs kutunun tepesinde */}
          <View style={{ paddingTop: rise, paddingBottom: rise }}>
            <Node node={node.base} size={size} />
          </View>
          <View style={{ marginLeft: 0.6 }}>
            <Node node={node.exp} size={size * SCRIPT_SCALE} />
          </View>
        </View>
      );
    }
    case "sub": {
      const drop = size * SUB_DROP;
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View style={{ paddingTop: drop, paddingBottom: drop }}>
            <Node node={node.base} size={size} />
          </View>
          <View style={{ marginLeft: 0.5 }}>
            <Node node={node.sub} size={size * SCRIPT_SCALE} />
          </View>
        </View>
      );
    }
    case "sqrt": {
      // Kök çizgisi içeriğe DEĞMEZ: üstte paddingTop kadar boşluk bırakılır,
      // yoksa içerideki üsler (σ², τ²) çizginin içinden geçiyordu.
      const h = heightEm(node.inner);
      return (
        <View style={{ flexDirection: "row", alignItems: "stretch", marginHorizontal: 1 }}>
          {/* Radikal üste hizalanır: ortalanınca tepesi kök çizgisine
              yetişmiyor, işaretle çizgi arasında kopukluk kalıyordu. */}
          <Text
            style={{
              fontSize: size * Math.min(2.4, Math.max(1.15, h * 1.05)),
              color: INK,
              alignSelf: "flex-start",
            }}
          >
            √
          </Text>
          <View
            style={{
              borderTopWidth: 0.7,
              borderTopColor: INK,
              paddingHorizontal: 1.5,
              paddingTop: size * 0.24,
              justifyContent: "center",
            }}
          >
            <Node node={node.inner} size={size} />
          </View>
        </View>
      );
    }
    case "paren": {
      // Parantez içeriğin yüksekliğine göre büyür — kesir yığınlarını kavrar.
      const h = heightEm(node.inner);
      const glyph = size * Math.min(3.2, Math.max(1, h * 0.98));
      const style = { fontSize: glyph, color: OP, alignSelf: "center" as const };
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={style}>{node.l}</Text>
          <Node node={node.inner} size={size} />
          <Text style={style}>{node.r}</Text>
        </View>
      );
    }
  }
}

/**
 * Formül dizesini PDF'te matematiksel olarak dizer. Ayrıştırılamazsa düz
 * italik metin döner (mevcut mono görünümden daha profesyonel).
 */
export function PdfMath({ formula, size = 7.5 }: { formula: string; size?: number }) {
  const node = parseFormula(formula);
  if (!node) {
    return (
      <Text style={{ fontSize: size, color: OP, fontStyle: "italic" }}>{formula}</Text>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
      <Node node={node} size={size} />
    </View>
  );
}
