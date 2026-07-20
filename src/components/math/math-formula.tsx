// Web formül görüntüleyici — MathNode ağacını HTML/CSS ile 2B matematik olarak
// dizer (kesir yığını, radikal, üs/alt indis). Dizgiye uygun olmayan formüller
// düz italik metne düşer. Serif (matematik) görünüm; değişkenler italik.

import { Fragment } from "react";
import { parseFormula, type MathNode } from "@/lib/math/formula";

function isVar(v: string): boolean {
  // tek/çift harfli latin/yunan değişken → italik; sayı/operatör düz
  return /[A-Za-zÇĞİÖŞÜçğıöşüσταπηλκψαβγδωρφθµ]/.test(v);
}

function Node({ node }: { node: MathNode }): React.ReactElement {
  switch (node.t) {
    case "text": {
      if (node.kind === "rel") return <span className="mx-[0.35em] text-foreground/70">{node.v}</span>;
      if (node.kind === "op") {
        if (node.v === " ") return <span className="inline-block w-[0.22em]" />;
        return <span className="mx-[0.18em] text-foreground/60">{node.v}</span>;
      }
      if (node.kind === "num") return <span className="tabular-nums">{node.v}</span>;
      return <span className={isVar(node.v) ? "italic" : ""}>{node.v}</span>;
    }
    case "row":
      return (
        <span className="inline-flex items-center">
          {node.items.map((it, i) => (
            <Fragment key={i}><Node node={it} /></Fragment>
          ))}
        </span>
      );
    case "frac":
      return (
        <span className="mx-[0.15em] inline-flex flex-col items-center align-middle text-center leading-tight">
          <span className="px-[0.3em] pb-[0.05em]"><Node node={node.num} /></span>
          <span className="my-[0.5px] h-px w-full bg-current" />
          <span className="px-[0.3em] pt-[0.05em]"><Node node={node.den} /></span>
        </span>
      );
    case "sup":
      return (
        <span className="inline-flex items-start">
          <Node node={node.base} />
          <span className="ml-[0.05em] text-[0.72em] leading-none" style={{ transform: "translateY(-0.15em)" }}>
            <Node node={node.exp} />
          </span>
        </span>
      );
    case "sub":
      return (
        <span className="inline-flex items-end">
          <Node node={node.base} />
          <span className="ml-[0.04em] text-[0.72em] leading-none" style={{ transform: "translateY(0.15em)" }}>
            <Node node={node.sub} />
          </span>
        </span>
      );
    case "sqrt":
      return (
        <span className="inline-flex items-stretch">
          <span className="mr-[0.05em] self-center text-[1.1em] leading-none">√</span>
          <span className="border-t border-current px-[0.15em] pt-[0.05em]"><Node node={node.inner} /></span>
        </span>
      );
    case "paren":
      return (
        <span className="inline-flex items-center">
          <span className="text-foreground/70">{node.l}</span>
          <Node node={node.inner} />
          <span className="text-foreground/70">{node.r}</span>
        </span>
      );
  }
}

/**
 * Formül dizesini matematiksel olarak dizer. Ayrıştırılamazsa `fallback`
 * (varsayılan: kaynak dize) italik serif olarak gösterilir.
 */
export function MathFormula({ formula, className }: { formula: string; className?: string }) {
  const node = parseFormula(formula);
  if (!node) {
    return (
      <span className={className} style={{ fontFamily: "var(--font-serif, Georgia), serif", fontStyle: "italic" }}>
        {formula}
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{ fontFamily: "var(--font-serif, Georgia), serif" }}
    >
      <Node node={node} />
    </span>
  );
}
