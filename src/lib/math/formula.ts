// Formül dizgi motoru — düz metin bir formül dizesini ("M_m = M_ç / (i · η_r)")
// yüzeyden bağımsız bir MathNode ağacına çevirir. Web (HTML/CSS) ve PDF
// (react-pdf View/Text) ayrı ince görüntüleyicilerle aynı ağacı 2B matematik
// olarak dizer: kesirler yığılır, kökler radikal alır, üs/alt indis konumlanır.
//
// Karmaşık/tanımsal formüller (tablo referansı, koşullu ifade, serbest metin)
// güvenli biçimde `null` döner → çağıran taraf düz (italik) metne düşer.

export type MathNode =
  | { t: "row"; items: MathNode[] }
  | { t: "text"; v: string; kind: "ident" | "num" | "op" | "rel" }
  | { t: "frac"; num: MathNode; den: MathNode }
  | { t: "sup"; base: MathNode; exp: MathNode }
  | { t: "sub"; base: MathNode; sub: MathNode }
  | { t: "sqrt"; inner: MathNode }
  | { t: "paren"; inner: MathNode; l: string; r: string };

// ---------------------------------------------------------------- Ön eleme

// Bu kalıpları içeren dizeler matematiksel dizgiye zorlanmaz (düz metin daha
// okunur): tablo/standart referansları, koşul/serbest metin, Excel hücreleri.
const BAILOUT = /[;\[\]→!]|\b(?:min|max|f|sin|cos|log|aksi|yerine|köprüde|sınıf|sınıfı|tablo|tablosu|çekme|dayanım|dayanımı|mekanizma|sayısı|malzeme|çentik|grubu|adet|kademe)\b|\([A-ZÇĞİÖŞÜ]{2,}/;

// ---------------------------------------------------------------- Sözcükleme

type Tok =
  | { k: "num"; v: string }
  | { k: "ident"; v: string }
  | { k: "op"; v: string }
  | { k: "rel"; v: string }
  | { k: "lpar" }
  | { k: "rpar" }
  | { k: "sup"; v: string } // birleşik unicode üst simge (² ³ ⁶ ...)
  | { k: "sub"; v: string } // birleşik unicode alt simge (₀ ₁ ...)
  | { k: "caret" } // ^
  | { k: "under" } // _
  | { k: "sqrt" };

const SUP_MAP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5",
  "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "−", "ⁿ": "n",
};
const SUB_MAP: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5",
  "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

// Kimlik (değişken) karakterleri: latin+türkçe harf, yunan, prime, °, virgül
// (F_k,min gibi bileşik indisler için virgül alt-indiste ele alınır).
const IDENT_CH = /[A-Za-zÇĞİÖŞÜçğıöşüµΣΔΩ°′″σταπηλκψαβγδωρφθ']/;
const DIGIT_CH = /[0-9]/;

function tokenize(src: string): Tok[] | null {
  const t: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (SUP_MAP[ch]) {
      let v = "";
      while (i < n && SUP_MAP[src[i]]) { v += SUP_MAP[src[i]]; i++; }
      t.push({ k: "sup", v });
      continue;
    }
    if (SUB_MAP[ch]) {
      let v = "";
      while (i < n && SUB_MAP[src[i]]) { v += SUB_MAP[src[i]]; i++; }
      t.push({ k: "sub", v });
      continue;
    }
    if (DIGIT_CH.test(ch)) {
      let v = "";
      // tr sayı: 1.234,56 → grup ayıracı nokta, ondalık virgül
      while (i < n && (/[0-9.,]/.test(src[i]))) { v += src[i]; i++; }
      // sondaki virgülü (operatör olabilir) geri bırak
      v = v.replace(/,$/, (m) => { i--; return ""; });
      t.push({ k: "num", v });
      continue;
    }
    if (IDENT_CH.test(ch)) {
      let v = "";
      while (i < n && (IDENT_CH.test(src[i]) || DIGIT_CH.test(src[i]))) { v += src[i]; i++; }
      t.push({ k: "ident", v });
      continue;
    }
    switch (ch) {
      case "(": t.push({ k: "lpar" }); i++; continue;
      case ")": t.push({ k: "rpar" }); i++; continue;
      case "^": t.push({ k: "caret" }); i++; continue;
      case "_": t.push({ k: "under" }); i++; continue;
      case "√": t.push({ k: "sqrt" }); i++; continue;
      case "·": case "*": t.push({ k: "op", v: "·" }); i++; continue;
      case "/": t.push({ k: "op", v: "/" }); i++; continue;
      case "+": t.push({ k: "op", v: "+" }); i++; continue;
      case "−": case "-": t.push({ k: "op", v: "−" }); i++; continue;
      case "|": t.push({ k: "op", v: "|" }); i++; continue;
      case "=": t.push({ k: "rel", v: "=" }); i++; continue;
      case "≤": case "≥": case "<": case ">": case "≈":
        t.push({ k: "rel", v: ch }); i++; continue;
      default:
        return null; // bilinmeyen karakter → düz metne düş
    }
  }
  return t;
}

// ---------------------------------------------------------------- Ayrıştırma

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok | undefined { return this.toks[this.p++]; }

  // ilişki zinciri: expr (rel expr)*
  parseRelChain(): MathNode {
    const items: MathNode[] = [this.parseAdd()];
    while (this.peek()?.k === "rel") {
      const r = this.next() as Extract<Tok, { k: "rel" }>;
      items.push({ t: "text", v: r.v, kind: "rel" });
      items.push(this.parseAdd());
    }
    return items.length === 1 ? items[0] : { t: "row", items };
  }

  // toplama: term ((+|−) term)*
  private parseAdd(): MathNode {
    const items: MathNode[] = [this.parseMul()];
    while (this.peek()?.k === "op" && ((this.peek() as { v: string }).v === "+" || (this.peek() as { v: string }).v === "−")) {
      const op = this.next() as Extract<Tok, { k: "op" }>;
      items.push({ t: "text", v: op.v, kind: "op" });
      items.push(this.parseMul());
    }
    return items.length === 1 ? items[0] : { t: "row", items };
  }

  // çarpma/bölme (sol birleşen); / → kesir, · → satır içi çarpım, bitişiklik → örtük çarpım
  private parseMul(): MathNode {
    let left = this.parsePow();
    for (;;) {
      const tk = this.peek();
      if (tk?.k === "op" && tk.v === "/") {
        this.next();
        left = { t: "frac", num: left, den: this.parsePow() };
      } else if (tk?.k === "op" && tk.v === "·") {
        this.next();
        const right = this.parsePow();
        left = mergeRow(left, { t: "text", v: "·", kind: "op" }, right);
      } else if (isAtomStart(tk)) {
        // örtük çarpım (bitişik terimler) — ince boşlukla
        const right = this.parsePow();
        left = mergeRow(left, { t: "text", v: " ", kind: "op" }, right);
      } else {
        break;
      }
    }
    return left;
  }

  // üs / alt indis (postfix, atom'a bağlanır)
  private parsePow(): MathNode {
    let base = this.parseAtom();
    for (;;) {
      const tk = this.peek();
      if (tk?.k === "sup") { this.next(); base = { t: "sup", base, exp: { t: "text", v: tk.v, kind: "num" } }; }
      else if (tk?.k === "sub") { this.next(); base = { t: "sub", base, sub: { t: "text", v: tk.v, kind: "num" } }; }
      else if (tk?.k === "caret") { this.next(); base = { t: "sup", base, exp: this.parseScript() }; }
      else if (tk?.k === "under") { this.next(); base = { t: "sub", base, sub: this.parseScript() }; }
      else break;
    }
    return base;
  }

  // ^ veya _ sonrası script: (…) grubu ya da tek atom/kısa dizi
  private parseScript(): MathNode {
    const tk = this.peek();
    if (tk?.k === "lpar") {
      this.next();
      const inner = this.parseAdd();
      if (this.peek()?.k === "rpar") this.next();
      return inner;
    }
    if (tk?.k === "ident") { this.next(); return { t: "text", v: tk.v, kind: "ident" }; }
    if (tk?.k === "num") { this.next(); return { t: "text", v: tk.v, kind: "num" }; }
    return { t: "text", v: "", kind: "ident" };
  }

  private parseAtom(): MathNode {
    const tk = this.peek();
    if (!tk) return { t: "text", v: "", kind: "ident" };
    if (tk.k === "sqrt") {
      this.next();
      const nxt = this.peek();
      if (nxt?.k === "lpar") {
        this.next();
        const inner = this.parseAdd();
        if (this.peek()?.k === "rpar") this.next();
        return { t: "sqrt", inner };
      }
      return { t: "sqrt", inner: this.parsePow() };
    }
    if (tk.k === "lpar") {
      this.next();
      const inner = this.parseRelChain();
      if (this.peek()?.k === "rpar") this.next();
      return { t: "paren", inner, l: "(", r: ")" };
    }
    if (tk.k === "op" && tk.v === "|") {
      // mutlak değer |…|
      this.next();
      const inner = this.parseAdd();
      if (this.peek()?.k === "op" && (this.peek() as { v: string }).v === "|") this.next();
      return { t: "paren", inner, l: "|", r: "|" };
    }
    if (tk.k === "op" && tk.v === "−") {
      // tekli eksi
      this.next();
      return mergeRow({ t: "text", v: "−", kind: "op" }, this.parsePow());
    }
    if (tk.k === "num") { this.next(); return { t: "text", v: tk.v, kind: "num" }; }
    if (tk.k === "ident") { this.next(); return { t: "text", v: tk.v, kind: "ident" }; }
    // beklenmeyen (op/rel) — boş
    this.next();
    return { t: "text", v: "", kind: "ident" };
  }
}

function isAtomStart(tk: Tok | undefined): boolean {
  return !!tk && (tk.k === "num" || tk.k === "ident" || tk.k === "lpar" || tk.k === "sqrt");
}

function mergeRow(...nodes: MathNode[]): MathNode {
  const items: MathNode[] = [];
  for (const nd of nodes) {
    if (nd.t === "row") items.push(...nd.items);
    else items.push(nd);
  }
  return items.length === 1 ? items[0] : { t: "row", items };
}

/**
 * Formül dizesini MathNode ağacına çevirir. Dizgiye uygun değilse null döner
 * (çağıran taraf düz metne düşer).
 */
export function parseFormula(src: string): MathNode | null {
  const raw = src.trim();
  if (!raw) return null;
  if (BAILOUT.test(raw)) return null;
  const toks = tokenize(raw);
  if (!toks || toks.length === 0) return null;
  try {
    const parser = new Parser(toks);
    const node = parser.parseRelChain();
    return node;
  } catch {
    return null;
  }
}
