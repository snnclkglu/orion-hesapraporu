// PDF formül görüntüleyici — MathNode ağacını react-pdf View/Text ile 2B
// matematik olarak dizer (flexbox: kesir yığını, radikal, üs/alt indis).
// Web görüntüleyiciyle aynı ağacı kullanır. Font: DejaVu (Türkçe glifler +
// oblique = italik değişkenler). Ayrıştırılamayan formül düz italik metne düşer.

import { Text, View } from "@react-pdf/renderer";
import { parseFormula, type MathNode } from "@/lib/math/formula";

const INK = "#262626";
const OP = "#6B6663";

function isVar(v: string): boolean {
  return /[A-Za-zÇĞİÖŞÜçğıöşüσταπηλκψαβγδωρφθµ]/.test(v);
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
    case "frac":
      return (
        <View style={{ flexDirection: "column", alignItems: "center", marginHorizontal: 1.5 }}>
          <View style={{ paddingHorizontal: 2, paddingBottom: 0.5 }}>
            <Node node={node.num} size={size} />
          </View>
          <View style={{ height: 0.6, alignSelf: "stretch", backgroundColor: INK }} />
          <View style={{ paddingHorizontal: 2, paddingTop: 0.5 }}>
            <Node node={node.den} size={size} />
          </View>
        </View>
      );
    case "sup":
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Node node={node.base} size={size} />
          <View style={{ marginLeft: 0.4, marginTop: -size * 0.28 }}>
            <Node node={node.exp} size={size * 0.72} />
          </View>
        </View>
      );
    case "sub":
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Node node={node.base} size={size} />
          <View style={{ marginLeft: 0.3, marginBottom: -size * 0.18 }}>
            <Node node={node.sub} size={size * 0.72} />
          </View>
        </View>
      );
    case "sqrt":
      return (
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          <Text style={{ fontSize: size * 1.15, color: INK, alignSelf: "center" }}>√</Text>
          <View style={{ borderTopWidth: 0.6, borderTopColor: INK, paddingHorizontal: 1, paddingTop: 0.6 }}>
            <Node node={node.inner} size={size} />
          </View>
        </View>
      );
    case "paren":
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: size, color: OP }}>{node.l}</Text>
          <Node node={node.inner} size={size} />
          <Text style={{ fontSize: size, color: OP }}>{node.r}</Text>
        </View>
      );
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
