# -*- coding: utf-8 -*-
"""PDF rapor yerleşim denetçisi — üretilen raporu SAYARAK doğrular.

Neden: rapor yerleşimi (sayfa bölme, etiket konumu) React ağacından okunamaz;
yalnız basılmış PDF'te görülür. Bu betik pymupdf ile PDF'i açar ve üç şeyi
ÖLÇER:

  1. DUL BAŞLIK  — bir bölüm/alt başlık sayfanın en altında YALNIZ kalmış mı
     (ardından o sayfada içerik gelmiyorsa dul sayılır).
  2. ÇAKIŞAN ETİKET — üst üste binen metin kutuları (özellikle diyagram/grafik
     etiketleri: DejaVu ile dizilirler).
  3. İÇİNDEKİLER — içindekiler tablosundaki sayfa numarası bölümün GERÇEK
     başlangıç sayfasıyla uyuşuyor mu.

Kullanım:
    python scripts/check-pdf-layout.py [pdf ya da dizin ...]
    python scripts/check-pdf-layout.py --baseline .test-output/baseline   # karşılaştırma

Varsayılan girdi `.test-output/` altındaki raporlardır (npx tsx scripts/test-pdf.ts
bunları üretir). Çıkış kodu: sorun bulunursa 1.
"""

from __future__ import annotations

import argparse
import io
import os
import sys
from dataclasses import dataclass, field

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    print("pymupdf gerekli:  pip install pymupdf", file=sys.stderr)
    raise SystemExit(2)

# Windows konsolunda Türkçe/Yunan glifleri UTF-8 basılsın
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ---------------------------------------------------------------- renk kodları
# brand.tsx ile birebir: başlıkları renginden tanırız (metinden değil).
COL_SECTION_TITLE = 0xF4F1EF   # BRAND.paper100 — koyu bantlı bölüm başlığı
COL_SECTION_NO = 0xF1C9C7      # BRAND.redPale  — bölüm numarası
COL_SUBHEAD = 0x8A8480         # BRAND.gray500  — alt başlık (kicker)
COL_INK = 0x262626

A4_H = 841.89
# BrandPage: paddingBottom = mm(13)+14 ≈ 50,8 → içerik alanı burada biter.
CONTENT_BOTTOM = A4_H - 50.0
# Altbilgi (fixed) bu çizginin altındadır; "içerik" sayılmaz.
FOOTER_TOP = A4_H - 40.0


@dataclass
class Span:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    size: float
    color: int
    font: str

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def h(self) -> float:
        return self.y1 - self.y0


@dataclass
class Findings:
    orphans: list[str] = field(default_factory=list)
    overlaps: list[str] = field(default_factory=list)
    toc: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    toc_checked: int = 0
    links_checked: int = 0
    headings: int = 0
    labels: int = 0

    def problem_count(self) -> int:
        return len(self.orphans) + len(self.overlaps) + len(self.toc) + len(self.links)


def page_spans(page) -> list[Span]:
    out: list[Span] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            for sp in line["spans"]:
                txt = sp["text"]
                if not txt.strip():
                    continue
                x0, y0, x1, y1 = sp["bbox"]
                out.append(Span(x0, y0, x1, y1, txt, sp["size"], sp["color"], sp["font"]))
    return out


# ------------------------------------------------------------- 1. dul başlıklar

def is_section_tag(sp: Span) -> bool:
    """Koyu bantlı bölüm başlığı (SectionTag) — açık renkli metinle tanınır."""
    return sp.color in (COL_SECTION_TITLE, COL_SECTION_NO) and sp.size >= 9.0


def is_letter_spaced(text: str) -> bool:
    """`letterSpacing` ile dizilmiş metin: harfler arasına boşluk girer.

    Ayırt edici olması ŞART — KvRow'un birim etiketi de gri mono küçük punto
    ("cm", "MPa", "kg/m") ve harf aralığı olmadan yalnız punto ile ayrılır.
    """
    t = text.strip()
    letters = [c for c in t if not c.isspace()]
    return len(letters) >= 3 and t.count(" ") >= len(letters) - 2


def is_subhead(sp: Span) -> bool:
    """Alt başlık bandı (SubHead): 7pt mono kicker, gri, BÜYÜK ve harf aralıklı."""
    return (
        sp.color == COL_SUBHEAD
        and 6.9 <= sp.size <= 7.5
        and "PlexMono" in sp.font
        and sp.y1 < FOOTER_TOP
        and is_letter_spaced(sp.text)
        and sp.text.strip().upper() == sp.text.strip()
    )


def heading_spans(spans: list[Span]) -> list[Span]:
    return [sp for sp in spans if is_section_tag(sp) or is_subhead(sp)]


def content_below(page, spans: list[Span], head: Span) -> bool:
    """Başlığın ALTINDA (aynı sayfada) gerçek içerik var mı?"""
    limit = head.y1 + 1.5
    for sp in spans:
        if sp.y0 <= limit or sp.y1 >= FOOTER_TOP:
            continue
        return True
    # Metin yoksa çizim (diyagram/tablo çizgisi/kutu) da içerik sayılır.
    for dr in page.get_drawings():
        r = dr["rect"]
        if r.y0 > limit + 2 and r.y1 < FOOTER_TOP and (r.height > 2 or r.width > 2):
            return True
    return False


def check_orphans(doc, f: Findings) -> None:
    for pno in range(doc.page_count):
        page = doc[pno]
        spans = page_spans(page)
        heads = heading_spans(spans)
        if not heads:
            continue
        # Aynı satırdaki parçalar tek başlık sayılır (numara + başlık + rozet).
        # Sabit kovaya bölmek YETMEZ: "2.4" (11pt) ile "MOTOR" (10pt) taban
        # çizgileri 2pt kayar ve kova sınırına denk gelirse başlık iki kez
        # sayılır. Bu yüzden y'ye göre sıralanıp 5pt toleransla öbeklenir.
        groups: list[list[Span]] = []
        for sp in sorted(heads, key=lambda s: s.y0):
            if groups and sp.y0 - groups[-1][0].y0 <= 5.0:
                groups[-1].append(sp)
            else:
                groups.append([sp])
        for group in groups:
            f.headings += 1
            bottom = max(sp.y1 for sp in group)
            probe = Span(0, 0, 0, bottom, "", 0, 0, "")
            if not content_below(page, spans, probe):
                label = " ".join(sp.text for sp in group).strip()
                f.orphans.append(
                    f"s.{pno + 1}: «{label}» sayfa dibinde YALNIZ "
                    f"(alt kenar y={bottom:.0f}, içerik sınırı {CONTENT_BOTTOM:.0f})"
                )


# ------------------------------------------------------------ 2. çakışan etiket

def overlap_area(a: Span, b: Span) -> float:
    dx = min(a.x1, b.x1) - max(a.x0, b.x0)
    dy = min(a.y1, b.y1) - max(a.y0, b.y0)
    return dx * dy if dx > 0 and dy > 0 else 0.0


def is_diagram_label(sp: Span) -> bool:
    """Diyagram/grafik etiketi: model.ts metinleri DejaVu ile dizilir."""
    return sp.font.startswith("DejaVu")


def check_overlaps(doc, f: Findings, min_ratio: float = 0.16) -> None:
    """Üst üste binen metin kutularını bulur.

    Yalnız diyagram etiketleri (DejaVu) karşılaştırılır: rapor gövdesinde
    komşu hücreler zaten kutu ölçüsüyle değil, düzenle hizalanır ve küçük
    teğetler yanlış alarm üretir. Ölçüt: kesişim alanı KÜÇÜK kutunun
    `min_ratio` katından büyükse çakışma.
    """
    for pno in range(doc.page_count):
        spans = [sp for sp in page_spans(doc[pno]) if is_diagram_label(sp)]
        f.labels += len(spans)
        # Aynı satırın parçaları (aynı taban çizgisi, yan yana) atlanır.
        for i in range(len(spans)):
            a = spans[i]
            for j in range(i + 1, len(spans)):
                b = spans[j]
                if b.y0 > a.y1:
                    continue
                ar = overlap_area(a, b)
                if ar <= 0:
                    continue
                small = min(a.w * a.h, b.w * b.h)
                if small <= 0 or ar / small < min_ratio:
                    continue
                f.overlaps.append(
                    f"s.{pno + 1}: «{a.text.strip()}» ↔ «{b.text.strip()}» "
                    f"kesişim %{100 * ar / small:.0f}"
                )


# ------------------------------------------------------------- 3. içindekiler

def find_toc_page(doc) -> int | None:
    for pno in range(min(4, doc.page_count)):
        if "İÇİNDEKİLER" in doc[pno].get_text().upper():
            return pno
    return None


def toc_rows(page) -> list[tuple[str, str, str]]:
    """İçindekiler satırları: (no, başlık, basılan sayfa)."""
    rows: list[tuple[str, str, str]] = []
    # Satır parçaları taban çizgisine göre öbeklenir. Sabit kova KULLANILMAZ:
    # numara (9pt) ile başlık (9,5pt) taban çizgileri ~1pt kayar ve kova
    # sınırına denk gelen satırlar ikiye bölünüp "3 parçadan az" diye sessizce
    # elenirdi — içindekilerin yarısı hiç doğrulanmıyordu.
    clusters: list[list[Span]] = []
    for sp in sorted((s for s in page_spans(page) if s.y1 <= FOOTER_TOP), key=lambda s: s.y0):
        if clusters and sp.y0 - clusters[-1][0].y0 <= 5.0:
            clusters[-1].append(sp)
        else:
            clusters.append([sp])
    for cluster in clusters:
        group = sorted(cluster, key=lambda s: s.x0)
        # Satır düzeni: [no] [BAŞLIK] ... [sayfa]
        if len(group) < 3:
            continue
        no = group[0].text.strip()
        page_no = group[-1].text.strip()
        title = " ".join(s.text for s in group[1:-1]).strip()
        if not title or not (page_no.isdigit() or page_no == "—"):
            continue
        rows.append((no, title, page_no))
    return rows


def heading_pages(doc) -> dict[str, int]:
    """Sayfa başlığı (PageHeader) ve bölüm etiketi metni → ilk görüldüğü sayfa."""
    out: dict[str, int] = {}
    for pno in range(doc.page_count):
        for sp in page_spans(doc[pno]):
            big = sp.size >= 13 and "Archivo" in sp.font
            tag = is_section_tag(sp) and sp.size >= 9.5
            if not (big or tag):
                continue
            key = norm(sp.text)
            if key and key not in out:
                out[key] = pno + 1
    return out


def norm(text: str) -> str:
    """Karşılaştırma için normalleştirir.

    Türkçe noktalı/noktasız i katlanır: içindekiler metni tr-TR büyütmesiyle
    ("Özeti" → "ÖZETİ"), Python'un `upper()`i ise noktasız üretir; katlanmazsa
    aynı başlık iki farklı dizeye düşer ve satır sessizce doğrulanmadan geçer.
    """
    folded = text.replace("İ", "I").replace("ı", "i")
    return " ".join(folded.upper().split())


def check_toc(doc, f: Findings) -> None:
    tp = find_toc_page(doc)
    if tp is None:
        f.toc.append("İçindekiler sayfası bulunamadı")
        return
    pages = heading_pages(doc)
    for no, title, printed in toc_rows(doc[tp]):
        key = norm(title)
        if key in ("İÇİNDEKİLER",) or not key:
            continue
        actual = pages.get(key)
        if actual is None:
            # Başlık belgede bulunamadı — yalnız numara basılmışsa atla
            continue
        f.toc_checked += 1
        if printed == "—":
            f.toc.append(f"«{title}» için sayfa numarası basılmamış (gerçek: {actual})")
        elif int(printed) != actual:
            f.toc.append(f"«{title}»: içindekiler {int(printed)}, gerçek {actual}")


# -------------------------------------------------- 4. kontrol özeti sayfa no

def check_summary_pages(doc, f: Findings) -> None:
    """Kontrol özetindeki sol sütun sayfa numarası GERÇEĞİ gösteriyor mu?

    Her numara aynı zamanda bir belge içi bağlantıdır (ilgili hesap bölümünün
    çapasına gider). Bağlantının çözüldüğü sayfa ile basılan sayı karşılaştırılır
    — böylece numara "makul görünüyor" diye değil, ÖLÇÜLEREK doğrulanır.
    """
    for pno in range(doc.page_count):
        page = doc[pno]
        # Yalnız DAR bağlantılar: kontrol özetindeki sol sütun sayfa numarası.
        # İçindekiler satırı da bağlantıdır ama satırın TAMAMINI kaplar ve
        # içinde bölüm numarası da geçer; onu `check_toc` zaten doğrular.
        links = [
            lk for lk in page.get_links()
            if lk.get("page", -1) >= 0 and lk["from"].width < 40
        ]
        if not links:
            continue
        spans = page_spans(page)
        for lk in links:
            r = lk["from"]
            # Bağlantı dikdörtgeninin içindeki mono sayı
            texts = [
                sp.text.strip()
                for sp in spans
                if sp.x0 >= r.x0 - 1 and sp.x1 <= r.x1 + 1
                and sp.y0 >= r.y0 - 2 and sp.y1 <= r.y1 + 2
            ]
            printed = next((t for t in texts if t.isdigit()), None)
            if printed is None:
                continue
            f.links_checked += 1
            actual = lk["page"] + 1
            if int(printed) != actual:
                f.links.append(
                    f"s.{pno + 1}: sayfa numarası {int(printed)} basılmış, "
                    f"bağlantı s.{actual}'e gidiyor"
                )


# ---------------------------------------------------------------------- rapor

def check_file(path: str) -> Findings:
    f = Findings()
    with fitz.open(path) as doc:
        check_orphans(doc, f)
        check_overlaps(doc, f)
        check_toc(doc, f)
        check_summary_pages(doc, f)
        f.pages = doc.page_count  # type: ignore[attr-defined]
    return f


def print_findings(path: str, f: Findings, verbose: bool) -> None:
    print(f"\n=== {os.path.basename(path)} ({getattr(f, 'pages', '?')} sayfa) ===")
    print(f"  Başlık sayısı        : {f.headings}")
    print(f"  Dul başlık           : {len(f.orphans)}")
    print(f"  Diyagram etiketi     : {f.labels}")
    print(f"  Çakışan etiket çifti : {len(f.overlaps)}")
    print(f"  İçindekiler satırı   : {f.toc_checked} doğrulandı, {len(f.toc)} hatalı")
    print(f"  Sayfa no bağlantısı  : {f.links_checked} doğrulandı, {len(f.links)} hatalı")
    limit = None if verbose else 12
    for title, items in (
        ("DUL BAŞLIK", f.orphans),
        ("ÇAKIŞMA", f.overlaps),
        ("İÇİNDEKİLER", f.toc),
        ("SAYFA NO", f.links),
    ):
        for line in items[:limit]:
            print(f"    [{title}] {line}")
        if limit is not None and len(items) > limit:
            print(f"    [{title}] … {len(items) - limit} kayıt daha (--verbose)")


# `scripts/test-pdf.ts` çıktılarının ekleri. Bir DİZİN tarandığında yalnız
# bunlar alınır: aynı klasörde ekipman listesi / iş emri gibi başka şablonların
# ve elle üretilmiş eski denemelerin PDF'leri de durur; onları hesap raporu
# ölçütleriyle denetlemek yanıltıcı sayı üretir. Dosya adı açıkça verilirse
# ek gözetilmez.
REPORT_SUFFIXES = ("-detayli.pdf", "-standart.pdf", "-ozet.pdf")


def collect_pdfs(targets: list[str], every: bool = False) -> list[str]:
    out: list[str] = []
    for t in targets:
        if os.path.isdir(t):
            for name in sorted(os.listdir(t)):
                low = name.lower()
                if not low.endswith(".pdf"):
                    continue
                if not every and not low.endswith(REPORT_SUFFIXES):
                    continue
                out.append(os.path.join(t, name))
        elif t.lower().endswith(".pdf"):
            out.append(t)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF rapor yerleşim denetçisi")
    ap.add_argument("targets", nargs="*", default=[], help="PDF dosyası ya da dizin")
    ap.add_argument("--baseline", help="karşılaştırılacak önceki çıktı dizini/dosyası")
    ap.add_argument("--verbose", action="store_true", help="tüm bulguları yaz")
    ap.add_argument("--all", action="store_true", help="dizindeki TÜM PDF'leri dene")
    args = ap.parse_args()

    targets = args.targets or [os.path.join(os.getcwd(), ".test-output")]
    pdfs = collect_pdfs(targets, args.all)
    if not pdfs:
        print("PDF bulunamadı. Önce: npx tsx scripts/test-pdf.ts", file=sys.stderr)
        return 2

    total = 0
    results: dict[str, Findings] = {}
    for p in pdfs:
        f = check_file(p)
        results[os.path.basename(p)] = f
        print_findings(p, f, args.verbose)
        total += f.problem_count()

    if args.baseline:
        base = {os.path.basename(p): check_file(p) for p in collect_pdfs([args.baseline], args.all)}
        print("\n=== ÖNCE / SONRA ===")
        print(f"  {'dosya':38s} {'dul':>12s} {'çakışma':>14s} {'içindekiler':>14s}")
        for name, f in results.items():
            b = base.get(name)
            if b is None:
                continue
            print(
                f"  {name:38s} "
                f"{b.orphans.__len__():5d} → {len(f.orphans):4d} "
                f"{len(b.overlaps):7d} → {len(f.overlaps):4d} "
                f"{len(b.toc):9d} → {len(f.toc):4d}"
            )

    print(f"\nTOPLAM SORUN: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
