# -*- coding: utf-8 -*-
"""
pafta_core.py — Pafta/antet/malzeme-listesi cozumleme cekirdegi.

Bu modul AutoCAD'e BAGIMLI DEGILDIR. Icine sadece "duz veri" verilir
(metinler, cerceve kutulari, tablo hucreleri) ve sonuc olarak paftalari
dondurur. Boylece ayni mantik hem AutoCAD COM uzerinden (pafta_ayikla.py)
hem de cevrimdisi DXF uzerinden (pafta_dxf.py) calisir ve test edilebilir.

Sinan Colakoglu / Orion Vinc icin hazirlandi.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, Optional, Sequence

# ---------------------------------------------------------------------------
# ISO kagit olculeri (mm), (uzun kenar, kisa kenar)
# ---------------------------------------------------------------------------
ISO_PAPERS: dict[str, tuple[float, float]] = {
    "A0": (1189.0, 841.0),
    "A1": (841.0, 594.0),
    "A2": (594.0, 420.0),
    "A3": (420.0, 297.0),
    "A4": (297.0, 210.0),
}

# Teknik resimde kullanilan makul olcekler (kucultme). 1/N icin N degerleri.
# Tam sayilarin hepsi gecerli sayilir: buro 1/3, 1/11, 1/14 gibi olcekleri de
# bilerek kullaniyor. Standart DISI olan, 1/1.2 veya 1/5.788 gibi kesirli,
# elle olceklenmis degerlerdir.
NICE_SCALES: tuple[float, ...] = tuple(sorted({
    0.1, 0.125, 0.2, 0.25, 0.4, 0.5, 0.75,    # buyutme: 10:1 ... 4:3
    *range(1, 51),                             # 1/1 ... 1/50
    1.25, 1.5, 2.5, 3.5, 4.5, 7.5, 12.5, 17.5, 22.5,
    60, 70, 75, 80, 90, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000,
}))

# Antette aranan etiketler (normalize edilmis halleriyle karsilastirilir)
LBL_DRAWING_NO = ("RESIM NO", "RESIMNO", "DRAWING NO", "RESIM NU", "RES NO", "PAFTA NO / DRAWING")
LBL_PROJECT_NO = ("IS / PROJECT NO", "PROJECT NO", "IS NO", "PROJE NO")
LBL_JOB_NAME = ("IS / JOB NAME", "JOB NAME", "IS ADI")
LBL_PROJECT = ("PROJE / PROJECT", "PROJE:", "PROJECT:")
LBL_SCALE = ("SCALE :", "SCALE:", "OLCEK /", "OLCEK:", "OLCEK")
LBL_SHEET_NO = ("SHT NO", "SHT. NO", "PAFTA NO")
LBL_CUSTOMER = ("FIRMA ADI", "CUSTOMER")

# Antet OZNITELIKLI (attribute) bir blok ise, etiket yerine oznitelik ETIKETI
# (tag) aranir. Tag'ler normalize edilip bu listelerle karsilastirilir.
ATTR_DRAWING_NO = ("RESIM NO", "RESIMNO", "RESIM_NO", "RESIMNU", "RESNO",
                   "DRAWING NO", "DRAWINGNO", "DWG NO", "DWGNO", "DRAWING NUMBER")
ATTR_PROJECT_NO = ("IS NO", "ISNO", "IS/PROJECT NO", "PROJE NO", "PROJENO",
                   "PROJECT NO", "PROJECTNO", "JOB NO", "JOBNO")
ATTR_JOB_NAME = ("IS ADI", "ISADI", "JOB NAME", "JOBNAME", "IS")
ATTR_PROJECT = ("PROJE", "PROJECT", "PARCA", "PARCA ADI", "PARCAADI",
                "PART", "PART NAME", "TANIM")
ATTR_SCALE = ("OLCEK", "SCALE")
ATTR_CUSTOMER = ("FIRMA", "FIRMA ADI", "MUSTERI", "CUSTOMER")
ATTR_SHEET_NO = ("PAFTA NO", "PAFTANO", "SHT NO", "SHTNO", "SHEET NO", "SHEETNO")

# Malzeme listesi basliklarinin kanonik karsiliklari
BOM_HEADER_MAP: tuple[tuple[tuple[str, ...], str], ...] = (
    (("POZ", "ITEM"), "poz"),
    (("RESIM NO", "DRAWING NO"), "resim_no"),
    (("ADET", "PIECE", "QTY"), "adet"),
    (("TANIM", "DESCRIPTION"), "tanim"),
    (("STD", "STANDART", "STANDARD"), "std"),
    (("MALZEME", "MATERIAL"), "malzeme"),
    (("NOT", "NOTES"), "notlar"),
    (("ADET AG", "UNIT W", "BIRIM AG", "ADET/UNIT", "AGIRLIK", "WEIGHT"),
     "birim_agirlik"),
    (("TOPLAM AG", "TOTAL W", "TOPLAM/TOTAL", "TOPLAM", "TOTAL"),
     "toplam_agirlik"),
)


# ---------------------------------------------------------------------------
# Metin temizleme yardimcilari
# ---------------------------------------------------------------------------
_MTEXT_UNI = re.compile(r"\\U\+([0-9A-Fa-f]{4})")
_MTEXT_FMT = re.compile(
    r"\\[FfHhCcTtQqWwAap][^;\\]*;"          # \fArial|b0;  \H2.5x;  \C1;  ...
    r"|\\[PpXx]"                             # paragraf / satir sonu
    r"|\\[LlOoKkNn]"                         # alt cizgi, ustu cizili vs.
    r"|\\S[^;]*;"                            # yigin (stack) ifadeleri
)
_WS = re.compile(r"[ \t\u00a0]+")


def clean_mtext(raw: Optional[str]) -> str:
    """MTEXT/TEXT icerigini duz metne cevirir.

    - \\U+011F gibi unicode kacislarini cozer
    - {\\fBahnschrift|b0;...} bicim kodlarini atar
    - \\P satir sonlarini bosluga cevirir
    """
    if raw is None:
        return ""
    s = str(raw)
    s = _MTEXT_UNI.sub(lambda m: chr(int(m.group(1), 16)), s)
    # AutoCAD ozel karakter kodlari
    for code, ch in (("%%c", "Ø"), ("%%C", "Ø"),
                     ("%%d", "°"), ("%%D", "°"),
                     ("%%p", "±"), ("%%P", "±"),
                     ("%%%", "%")):
        s = s.replace(code, ch)
    s = s.replace("\\P", " ").replace("\\p", " ")
    s = _MTEXT_FMT.sub("", s)
    s = s.replace("{", "").replace("}", "")
    s = s.replace("\\~", " ").replace("\\{", "{").replace("\\}", "}")
    s = s.replace("\t", " ").replace("\r", " ").replace("\n", " ")
    s = _WS.sub(" ", s)
    return s.strip()


def norm(s: Optional[str]) -> str:
    """Etiket karsilastirmasi icin normalize eder (TR harfleri dahil)."""
    if not s:
        return ""
    s = clean_mtext(s)
    s = (s.replace("İ", "I").replace("ı", "i").replace("Ş", "S").replace("ş", "s")
           .replace("Ğ", "G").replace("ğ", "g").replace("Ü", "U").replace("ü", "u")
           .replace("Ö", "O").replace("ö", "o").replace("Ç", "C").replace("ç", "c"))
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.upper()
    s = re.sub(r"[^A-Z0-9/:. ]+", " ", s)
    return _WS.sub(" ", s).strip()


_FN_BAD = re.compile(r'[\\/:*?"<>|\r\n\t]+')


def safe_filename(name: str, fallback: str = "PAFTA") -> str:
    s = _FN_BAD.sub("_", clean_mtext(name)).strip(" .")
    s = _WS.sub(" ", s)
    return s or fallback


# ---------------------------------------------------------------------------
# Veri yapilari
# ---------------------------------------------------------------------------
@dataclass
class TextItem:
    x: float
    y: float
    text: str
    height: float = 0.0
    layer: str = ""
    _n: str = field(default="", repr=False)

    def __post_init__(self) -> None:
        self.text = clean_mtext(self.text)
        self._n = norm(self.text)

    @property
    def n(self) -> str:
        return self._n


@dataclass
class AttrItem:
    """Oznitelikli antet bloklarindaki bir oznitelik (ATTRIB)."""
    x: float
    y: float
    tag: str
    value: str
    layer: str = ""
    height: float = 0.0
    block: str = ""
    _nt: str = field(default="", repr=False)

    def __post_init__(self) -> None:
        self.value = clean_mtext(self.value)
        self.tag = str(self.tag or "").strip()
        self._nt = norm(self.tag).replace(" ", "")

    @property
    def ntag(self) -> str:
        return self._nt


def _attr_match(attrs: Sequence["AttrItem"], keys: Sequence[str]) -> Optional["AttrItem"]:
    ks = [k.replace(" ", "") for k in keys]
    best = None
    for a in attrs:
        if not a.value:
            continue
        for i, k in enumerate(ks):
            if a.ntag == k:
                return a
            if a.ntag.startswith(k) or k in a.ntag:
                if best is None or i < best[0]:
                    best = (i, a)
    return best[1] if best else None


@dataclass
class BoxItem:
    ident: str
    xmin: float
    ymin: float
    xmax: float
    ymax: float
    bscale: float = 1.0          # blok referansinin X olcek carpani (tani icin)

    @property
    def w(self) -> float:
        return self.xmax - self.xmin

    @property
    def h(self) -> float:
        return self.ymax - self.ymin

    @property
    def area(self) -> float:
        return self.w * self.h

    @property
    def cx(self) -> float:
        return (self.xmin + self.xmax) / 2.0

    @property
    def cy(self) -> float:
        return (self.ymin + self.ymax) / 2.0

    def contains(self, x: float, y: float, tol: float = 0.0) -> bool:
        return (self.xmin - tol) <= x <= (self.xmax + tol) and \
               (self.ymin - tol) <= y <= (self.ymax + tol)


@dataclass
class TableItem(BoxItem):
    """ACAD_TABLE. rows: satir x sutun ham metin matrisi (0 = en ust satir)."""
    rows: list[list[str]] = field(default_factory=list)


@dataclass
class Sheet:
    index: int
    frame: BoxItem
    drawing_no: str = ""
    project_no: str = ""
    job_name: str = ""
    project: str = ""
    part_name: str = ""
    customer: str = ""
    sheet_no: str = ""
    scale_text: str = ""            # antette yazan ("1/5")
    scale_text_n: Optional[float] = None
    scale_n: float = 1.0            # KULLANILAN olcek (geometrik)
    scale_is_standard: bool = True  # cerceve standart bir olcege oturuyor mu
    scale_deviation: float = 0.0    # antetteki olcekten yuzde sapma
    paper: str = "A3"
    paper_w: float = 420.0
    paper_h: float = 297.0
    window_ll: tuple[float, float] = (0.0, 0.0)
    window_ur: tuple[float, float] = (0.0, 0.0)
    crop_mm: float = 0.0            # kagida sigmayan kisim (mm, toplam)
    bom: list[dict] = field(default_factory=list)
    bom_total_weight: str = ""
    content_hash: str = ""          # cerceve icerigi (kopya tespiti icin)
    text_count: int = 0
    iptal: bool = False             # uzerine capraz cizilmis (eski revizyon)
    rev_etiketi: str = ""           # yakininda bulunan "REV-A" / "REV . B"
    secim_gerekcesi: str = ""       # kopya secimi hangi kurala gore yapildi
    warnings: list[str] = field(default_factory=list)

    @property
    def scale_label(self) -> str:
        n = self.scale_n
        if n >= 1:
            return f"1/{_fmt_num(n)}"
        return f"{_fmt_num(1.0 / n)}/1"


def _fmt_num(v: float) -> str:
    if abs(v - round(v)) < 1e-6:
        return str(int(round(v)))
    return f"{v:g}"


# ---------------------------------------------------------------------------
# Olcek metni cozumleme
# ---------------------------------------------------------------------------
_SCALE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*[/:]\s*(\d+(?:[.,]\d+)?)")


def parse_scale_text(s: str) -> Optional[float]:
    """'1/5' -> 5.0 ; '2:1' -> 0.5 ; 'OLCEKSIZ' -> None"""
    if not s:
        return None
    t = norm(s)
    if "OLCEKSIZ" in t or "NTS" in t or t in ("-", "."):
        return None
    m = _SCALE_RE.search(t.replace(",", "."))
    if not m:
        return None
    try:
        a = float(m.group(1))
        b = float(m.group(2))
    except ValueError:
        return None
    if a <= 0 or b <= 0:
        return None
    return b / a


def snap_nice(n: float, tol: float = 0.005) -> float:
    """Olcegi standart bir degere yuvarlar (tolerans icindeyse)."""
    best, bestd = n, tol
    for cand in NICE_SCALES:
        d = abs(cand - n) / cand
        if d < bestd:
            best, bestd = float(cand), d
    return best


def nice_distance(n: float) -> float:
    """En yakin standart olcege bagil uzaklik (0 = tam oturuyor)."""
    if n <= 0:
        return 1.0
    return min(abs(c - n) / c for c in NICE_SCALES)


# ---------------------------------------------------------------------------
# Kagit / olcek cozumu
# ---------------------------------------------------------------------------
def resolve_paper(frame_w: float, frame_h: float,
                  forced_paper: Optional[str] = "A3",
                  scale_hint: Optional[float] = None
                  ) -> tuple[str, float, float, float, list[str]]:
    """Cerceve olcusunden kagit ve GEOMETRIK olcegi cozer.

    Doner: (kagit_adi, kagit_w, kagit_h, N, uyarilar)
    N: 1/N olcegi. Cerceve genisligi = kagit_w * N olur.

    ONEMLI: Antette yazan olcek metni burada YALNIZCA ipucu olarak kullanilir.
    Kullanilan deger her zaman cercevenin gercek olcusunden hesaplanir; boylece
    teknik ressam antete yanlis olcek yazsa bile PDF dogru olcekte cikar.
    """
    warns: list[str] = []
    landscape = frame_w >= frame_h

    def oriented(name: str) -> tuple[float, float]:
        lo, sh = ISO_PAPERS[name]
        return (lo, sh) if landscape else (sh, lo)

    candidates: list[tuple[float, str, float, float, float]] = []
    names = [forced_paper] if forced_paper and forced_paper.upper() in ISO_PAPERS else list(ISO_PAPERS)
    for name in names:
        name = name.upper()
        pw, ph = oriented(name)
        n_raw = frame_w / pw
        n = snap_nice(n_raw)
        # Puanlama (kucuk = iyi). Belirleyici olan, cerceve olcusunun STANDART
        # bir olcege tam oturmasi; antette yazan deger yalnizca zayif bir
        # ipucudur, cunku yanlis yazilmis olabilir.
        score = 0.0
        score += nice_distance(n_raw) * 200.0                        # nice'a uzaklik
        aspect_err = abs((frame_w / frame_h) - (pw / ph)) / (pw / ph)
        score += aspect_err * 10.0                                   # en/boy uyumu
        if n_raw < 0.09 or n_raw > 1200:
            score += 50.0
        if scale_hint:
            score += min(abs(n - scale_hint) / scale_hint, 1.0) * 0.8
        # Esitlikte kucuk kagit tercih edilir: buro standardi genelde A3/A4'tur,
        # cerceve buyutulerek olcek verilir.
        candidates.append((score, pw * ph, name, pw, ph, n))

    candidates.sort(key=lambda c: (round(c[0], 3), c[1]))
    _, _, name, pw, ph, n = candidates[0]
    if len(candidates) > 1 and abs(candidates[1][0] - candidates[0][0]) < 0.5:
        alt = candidates[1]
        warns.append(
            f"Kagit olcusu tek basina kesin degil: {name} 1/{_fmt_num(n)} "
            f"secildi, {alt[2]} 1/{_fmt_num(alt[5])} de mumkun. "
            f"Kesinlik icin --paper ile kagidi sabitleyin."
        )

    n_raw = frame_w / pw
    if abs(n - n_raw) / n_raw > 0.005:
        warns.append(
            f"Cerceve olcusu standart bir olcege tam oturmuyor "
            f"(hesaplanan {1/n_raw:.4f} -> {_fmt_num(n)} kabul edildi)."
        )
    aspect_err = abs((frame_w / frame_h) - (pw / ph)) / (pw / ph)
    if aspect_err > 0.02:
        warns.append(
            f"Cerceve en/boy orani {name} kagidina uymuyor "
            f"({frame_w:.1f}x{frame_h:.1f} -> %{aspect_err*100:.1f} sapma)."
        )
    return name, pw, ph, n, warns


# ---------------------------------------------------------------------------
# Antet okuma
# ---------------------------------------------------------------------------
def _starts_any(n: str, keys: Sequence[str]) -> bool:
    return any(n.startswith(k) or k in n for k in keys)


def _label_in(texts: Sequence[TextItem], keys: Sequence[str]) -> Optional[TextItem]:
    hits = [t for t in texts if _starts_any(t.n, keys)]
    if not hits:
        return None
    # birden fazlaysa en kucuk yazi yuksekligi = etiket olma ihtimali yuksek
    hits.sort(key=lambda t: (len(t.n), t.height))
    return hits[0]


# Antette / malzeme listesinde ALAN ADI olarak gecen kelimeler.
# Bunlar asla bir alan DEGERI olamaz.
_HEADER_WORDS = frozenset({
    "ITEM", "POZ", "ADET", "PIECE", "QTY", "TANIM", "TANIMI", "DESCRIPTION",
    "STD", "STANDART", "STANDARD", "MALZEME", "MATERIAL", "NOT", "NOTLAR",
    "NOTES", "RESIM NO", "DRAWING NO", "RESIM", "DRAWING", "ISIM", "NAME",
    "TARIH", "DATE", "IMZA", "SIGNATURE", "REV", "OLCEK", "SCALE",
    "PAFTA NO", "SHT NO", "SHT", "SHEET NO", "TOPLAM", "TOTAL", "KG",
    "UNIT W", "BIRIM", "TOTAL WEIGHT", "TOPLAM AGIRLIK", "NOTE", "CUSTOMER",
    "FIRMA ADI", "PROJE", "PROJECT", "IS", "JOB NAME", "CHANGED", "CIZEN",
    "ONAY", "APPROVED", "ACIKLAMA",
})


def _is_headerish(t: TextItem) -> bool:
    n = t.n.strip().rstrip(":").strip()
    if not n:
        return True
    if n in _HEADER_WORDS:
        return True
    # "Poz / Item", "Resim No / Drawing No" gibi bolunmus basliklar
    parts = [p.strip() for p in n.split("/") if p.strip()]
    return bool(parts) and all(p in _HEADER_WORDS for p in parts)


def _candidates_below(texts: Sequence[TextItem], label: TextItem, frame: BoxItem,
                      dx_frac: float, dy_frac: float) -> list[TextItem]:
    dxmax = frame.w * dx_frac
    dymax = frame.h * dy_frac
    dymin = frame.h * 0.002
    out = []
    for t in texts:
        if t is label or not t.text or t.n.endswith(":"):
            continue
        if _is_headerish(t):          # 'Item', 'Poz', 'Std' ... deger olamaz
            continue
        dy = label.y - t.y
        if dymin < dy <= dymax and abs(t.x - label.x) <= dxmax:
            out.append(t)
    # Etiketle ayni katmandaki metinler her zaman oncelikli:
    # boylece cizim icindeki kaynak sembolu, olcu yazisi vb. antet degeri
    # sanilmaz.
    same = [t for t in out if t.layer and t.layer == label.layer]
    return same if same else out


_HAS_DIGIT = re.compile(r"\d")


def value_below(texts: Sequence[TextItem], label: TextItem,
                frame: BoxItem, dx_frac: float = 0.06,
                dy_frac: float = 0.045,
                prefer_digits: bool = False) -> Optional[TextItem]:
    """Etiketin hemen altindaki deger metnini bulur.

    prefer_digits=True ise (resim no, is no gibi alanlar) icinde rakam gecen
    adaylar oncelikli secilir; boylece yanlislikla bir baslik yazisi
    alinmaz.
    """
    cands = _candidates_below(texts, label, frame, dx_frac, dy_frac)
    if not cands:
        return None
    if prefer_digits:
        withnum = [t for t in cands if _HAS_DIGIT.search(t.text)]
        if withnum:
            cands = withnum
    cands.sort(key=lambda t: (round(label.y - t.y, 6), abs(t.x - label.x)))
    return cands[0]


def values_below(texts: Sequence[TextItem], label: TextItem, frame: BoxItem,
                 dx_frac: float = 0.09, dy_frac: float = 0.045) -> list[TextItem]:
    """Etiketin altindaki tum satirlari (yukaridan asagi) dondurur."""
    out = _candidates_below(texts, label, frame, dx_frac, dy_frac)
    out.sort(key=lambda t: -t.y)
    return out


# ---------------------------------------------------------------------------
# Malzeme listesi (ACAD_TABLE) cozumleme
# ---------------------------------------------------------------------------
def _map_header(cells: Sequence[str]) -> dict[int, str]:
    """Baslik satirindaki hucreleri kanonik alan adlarina esler.

    Once "bastan eslesme" denenir, sonra "icinde gecme". Boylece
    'Notlar/Standart' hucresi 'Std' degil 'Notlar' olarak dogru eslesir.
    """
    out: dict[int, str] = {}
    used: set[str] = set()
    normed = [norm(c) for c in cells]

    for match_start in (True, False):
        for i, n in enumerate(normed):
            if not n or i in out:
                continue
            for keys, canon in BOM_HEADER_MAP:
                if canon in used:
                    continue
                hit = (any(n.startswith(k) for k in keys) if match_start
                       else any(k in n for k in keys))
                if hit:
                    out[i] = canon
                    used.add(canon)
                    break
    return out


# Elle cizilmis malzeme listesinin baslik satirinda gecen kelimeler.
BOM_VOCAB = frozenset({
    "POZ", "ITEM", "RESIM NO", "DRAWING NO", "ADET", "PIECE", "TANIM",
    "TANIMI", "DESCRIPTION", "STD", "STANDART", "STANDARD", "MALZEME",
    "MATERIAL", "NOT", "NOTLAR", "NOTES", "NOTLAR/STANDART",
    "NOTES/STANDARD", "ADET/UNIT", "TOPLAM/TOTAL", "AGIRLIK", "WEIGHT",
    "TOPLAM", "TOTAL", "BIRIM",
})


def _cluster_rows(items: Sequence[TextItem], tol: float) -> list[list[TextItem]]:
    """Metinleri y'ye gore satirlara ayirir (yukaridan asagi)."""
    if not items:
        return []
    ordered = sorted(items, key=lambda t: -t.y)
    rows: list[list[TextItem]] = [[ordered[0]]]
    for t in ordered[1:]:
        if abs(rows[-1][-1].y - t.y) <= tol:
            rows[-1].append(t)
        else:
            rows.append([t])
    for r in rows:
        r.sort(key=lambda t: t.x)
    return rows


def _row_is_header(row: Sequence[TextItem]) -> int:
    return sum(1 for t in row if t.n.strip().rstrip(":") in BOM_VOCAB)


def find_text_tables(texts: Sequence[TextItem], frame: BoxItem,
                     min_cols: int = 4) -> list[TableItem]:
    """ELLE CIZILMIS (AutoCAD tablosu olmayan) malzeme listelerini cozer.

    Eski cizimlerde malzeme listesi cizgi + yaziyla yapiliyor; ACAD_TABLE
    nesnesi yok. Bu fonksiyon baslik satirini ("Poz / Item / Resim No /
    Adet ...") bulur, basliktaki yazilarin x konumlarini SUTUN SINIRI kabul
    eder ve basligin ustundeki satirlari hucrelere dagitir.

    Metinler sola dayali yazildigi icin bir metin, x'i kendisinden kucuk
    veya esit en son sutun cizgisine aittir.
    """
    inside = [t for t in texts if t.text and frame.contains(t.x, t.y)]
    if len(inside) < min_cols:
        return []

    hdr_words = [t for t in inside if t.n.strip().rstrip(":") in BOM_VOCAB]
    if len(hdr_words) < min_cols:
        return []

    h0 = sorted(t.height for t in hdr_words if t.height > 0)
    h0 = h0[len(h0) // 2] if h0 else frame.h * 0.005
    tol = max(h0 * 0.6, frame.h * 0.001)

    out: list[TableItem] = []
    used: set[int] = set()

    for band in _cluster_rows(hdr_words, tol):
        if _row_is_header(band) < min_cols:
            continue
        if any(id(t) in used for t in band):
            continue

        # Baslik iki dilli olabilir: 'Poz' ustte, 'Item' altta.
        header_rows = [band]
        cand = [t for t in inside if id(t) not in used
                and abs(t.x - band[0].x) < frame.w]
        for extra in _cluster_rows(cand, tol):
            if extra is band or not extra:
                continue
            dy = band[0].y - extra[0].y
            if 0 < dy <= tol * 4 and _row_is_header(extra) >= 2:
                header_rows.append(extra)

        header_texts = [t for r in header_rows for t in r]
        for t in header_texts:
            used.add(id(t))

        # Sutun sinirlari = baslik yazilarinin x konumlari
        xs = sorted({round(t.x, 3) for t in header_texts})
        cols: list[float] = []
        for x in xs:
            if not cols or (x - cols[-1]) > h0 * 0.8:
                cols.append(x)
            else:
                cols[-1] = min(cols[-1], x)
        if len(cols) < min_cols:
            continue

        pad = h0 * 0.8
        x0 = cols[0] - pad
        row_texts = [t for t in inside if x0 <= t.x <= frame.xmax]
        head_top = max(t.y for t in header_texts)
        above = [t for t in row_texts if t.y > head_top + tol]
        # Basligin hemen ustunden baslayip YUKARI dogru ilerle; duzenli satir
        # araligi bozulup buyuk bir bosluk gorununce tablo bitmistir.
        rows_above = sorted(_cluster_rows(above, tol),
                            key=lambda r: min(t.y for t in r))
        data: list[list[TextItem]] = []
        pitch = None
        prev_y = head_top
        for r in rows_above:
            ry = min(t.y for t in r)
            gap = ry - prev_y
            if gap <= 0:
                continue
            if pitch is None:
                if gap > tol * 12:
                    break
                pitch = gap
            elif gap > pitch * 2.6:
                break
            data.append(r)
            prev_y = ry
            if len(data) > 300:
                break

        if not data:
            continue

        def cell_index(x: float) -> int:
            idx = 0
            for i, cx in enumerate(cols):
                if x >= cx - pad * 0.6:
                    idx = i
                else:
                    break
            return idx

        grid: list[list[str]] = []
        for r in reversed(data):                     # en ust satir once
            cells = ["" for _ in cols]
            for t in r:
                ci = cell_index(t.x)
                cells[ci] = (cells[ci] + " " + t.text).strip() if cells[ci] else t.text
            grid.append(cells)
        hdr_cells = ["" for _ in cols]
        for t in sorted(header_texts, key=lambda z: (-z.y, z.x)):
            ci = cell_index(t.x)
            hdr_cells[ci] = (hdr_cells[ci] + " " + t.text).strip() if hdr_cells[ci] else t.text
        grid.append(hdr_cells)                       # baslik en altta

        ys = [t.y for r in data for t in r] + [t.y for t in header_texts]
        xs2 = [t.x for r in data for t in r] + [t.x for t in header_texts]
        out.append(TableItem(
            f"ELLE CIZILMIS TABLO ({len(grid)}x{len(cols)})",
            min(xs2), min(ys), max(xs2), max(ys), rows=grid))
        for r in data:
            for t in r:
                used.add(id(t))
    return out


def _has_header_row(rows: Sequence[Sequence[str]]) -> bool:
    for r in rows:
        n = " ".join(norm(c) for c in r)
        if "POZ" in n or "ITEM" in n:
            return True
    return False


def _poz_sort_key(rec: dict) -> tuple[int, float, str]:
    p = str(rec.get("poz", "")).strip()
    m = re.match(r"^\s*(\d+(?:[.,]\d+)?)", p)
    if m:
        return (0, float(m.group(1).replace(",", ".")), "")
    return (1, 0.0, p)


def parse_bom_table(rows: Sequence[Sequence[str]],
                    fallback_colmap: Optional[dict] = None
                    ) -> tuple[list[dict], str, list[str], Optional[dict]]:
    """ACAD_TABLE hucre matrisinden malzeme listesi kayitlarini cikarir.

    Doner: (kayitlar, toplam_agirlik_metni, uyarilar, kullanilan_sutun_eslemesi)

    Tablonun en ustunde NOTE satiri, en altinda basliklar bulunur; veri
    satirlari poz numarasi buyukten kucuge dogru siralanmistir.

    Uzun listeler bazen ikinci bir bloga tasar ve o blokta baslik satiri
    tekrar edilmez. Boyle bir tablo icin ayni paftadaki BASKA bir tablonun
    sutun eslemesi (fallback_colmap) kullanilabilir.
    """
    warns: list[str] = []
    grid = [[clean_mtext(c) for c in r] for r in rows]
    if not grid:
        return [], "", ["Tablo bos."], None

    header_idx = None
    for i in range(len(grid) - 1, -1, -1):
        n0 = " ".join(norm(c) for c in grid[i])
        if "POZ" in n0 or "ITEM" in n0:
            header_idx = i
            break
    if header_idx is None:
        if fallback_colmap:
            colmap = dict(fallback_colmap)
            header_idx = -1               # baslik satiri yok, hepsi veri
            warns.append("Tabloda baslik satiri yok (devam tablosu); "
                         "sutunlar ayni paftadaki diger tablodan alindi.")
        else:
            warns.append("Tabloda 'Poz/Item' baslik satiri bulunamadi; "
                         "sutunlar sirayla kabul edildi.")
            header_idx = len(grid) - 1
            colmap = {i: c for i, (_, c) in enumerate(BOM_HEADER_MAP)
                      if i < len(grid[0])}
    else:
        colmap = _map_header(grid[header_idx])
        if not colmap:
            warns.append("Baslik satiri okunamadi; sutunlar sirayla kabul edildi.")
            colmap = {i: c for i, (_, c) in enumerate(BOM_HEADER_MAP) if i < len(grid[0])}

    total_weight = ""
    note_idx = None
    for i, r in enumerate(grid):
        joined = " ".join(norm(c) for c in r)
        if "TOPLAM AGIRLIK" in joined or "TOTAL WEIGHT" in joined:
            note_idx = i
            # Toplam agirlik degeri: ayni satirdaki, icinde RAKAM gecen en
            # sagdaki hucre ('kg.' gibi birim yazilari atlanir).
            for c in reversed(r):
                cc = clean_mtext(c)
                if not cc:
                    continue
                nn = norm(cc)
                if nn.startswith("TOPLAM") or "TOTAL WEIGHT" in nn:
                    continue
                if not _HAS_DIGIT.search(cc):
                    continue
                total_weight = cc
                break
            break

    records: list[dict] = []
    for i, r in enumerate(grid):
        if i == header_idx or i == note_idx:
            continue
        rec: dict[str, str] = {}
        for ci, canon in colmap.items():
            if ci < len(r):
                rec[canon] = r[ci]
        if not any(v.strip() for v in rec.values()):
            continue
        poz = rec.get("poz", "").strip()
        if not poz and not rec.get("resim_no", "").strip():
            continue
        rec["_satir"] = i
        records.append(rec)

    def poz_key(rec: dict) -> tuple[int, float, int]:
        p = rec.get("poz", "").strip()
        m = re.match(r"^\s*(\d+(?:[.,]\d+)?)", p)
        if m:
            return (0, float(m.group(1).replace(",", ".")), 0)
        return (1, 0.0, rec.get("_satir", 0))

    records.sort(key=poz_key)
    for r in records:
        r.pop("_satir", None)
    return records, total_weight, warns, colmap


# ---------------------------------------------------------------------------
# Ana cozumleme
# ---------------------------------------------------------------------------
def score_frames(frames: Sequence[BoxItem]) -> tuple[int, int]:
    """Bir cerceve kumesinin ne kadar 'inandirici' oldugunu puanlar.

    Doner: (standart olcege oturan cerceve sayisi, toplam cerceve sayisi).
    Gercek paftalar hep 'kagit x standart olcek' olcusundedir; rastgele
    kutular degildir. Buyuk olan kazanir.
    """
    good = 0
    for f in frames:
        w = max(f.w, f.h)
        best = 1.0
        for lo, _short in ISO_PAPERS.values():
            best = min(best, nice_distance(w / lo))
        if best < 0.01:
            good += 1
    return (good, len(frames))


def select_anchors(labels: Sequence[TextItem],
                   boxes: Sequence[BoxItem],
                   extra: Sequence = ()) -> tuple[str, list, list[BoxItem]]:
    """Hangi 'Resim No' metinlerinin ANTET etiketi oldugunu kendisi bulur.

    Cizimlerde "Resim No" yazisi iki yerde geciyor: antette alan etiketi
    olarak ve malzeme listesinin sutun basligi olarak. Ikisini birbirinden
    ayirmak sablona gore degisir; bu yuzden birkac aday kume denenir ve en
    tutarli pafta setini ureten kume secilir.

    Doner: (strateji adi, secilen etiketler, bulunan cerceveler)
    """
    cands: list[tuple[str, list]] = []

    colon = [t for t in labels if t.n.rstrip().endswith(":")]
    if colon:
        cands.append(("etiket ':' ile bitiyor", colon))

    both = [t for t in labels if "RESIM NO" in t.n and "DRAWING NO" in t.n]
    if both:
        cands.append(("'Resim No' ve 'Drawing No' ayni metinde", both))

    by_layer: dict[str, list] = {}
    for t in labels:
        by_layer.setdefault(t.layer, []).append(t)
    for lay, ts in sorted(by_layer.items(), key=lambda kv: -len(kv[1]))[:4]:
        cands.append((f"katman = {lay or '(bos)'}", ts))

    cands.append(("tum eslesmeler", list(labels)))

    best: Optional[tuple] = None
    for name, ts in cands:
        anchors = list(ts) + list(extra)
        if not anchors:
            continue
        fr = detect_frames(boxes, anchors)
        sc = score_frames(fr)
        if best is None or sc > best[0]:
            best = (sc, name, anchors, fr)
    if best is None:
        return ("bulunamadi", list(extra), [])
    return (best[1], best[2], best[3])


def _apply_paper(sh: "Sheet", paper: str, pw: float, ph: float, n: float) -> None:
    """Kagit/olcek atar ve plot penceresini yeniden hesaplar.

    Pencere, cerceve merkezine oturtulmus TAM kagit dikdortgenidir; boylece
    1:N olcek kagida birebir oturur, kaymaz.
    """
    fr = sh.frame
    sh.paper, sh.paper_w, sh.paper_h, sh.scale_n = paper, pw, ph, n
    hw, hh = pw * n / 2.0, ph * n / 2.0
    sh.window_ll = (fr.cx - hw, fr.cy - hh)
    sh.window_ur = (fr.cx + hw, fr.cy + hh)
    over_w = max(0.0, fr.w / n - pw)
    over_h = max(0.0, fr.h / n - ph)
    sh.crop_mm = round(max(over_w, over_h), 3)


def _paper_consensus(sheets: list["Sheet"]) -> None:
    """AUTO modda: cizimdeki paftalarin cogunlugu hangi kagitta ise,
    ayriksi kalanlari da ona cekmeye calisir.

    840x595 gibi bir cerceve hem 'A3 1/2' hem 'A1 1/1' olabilir; tek bir
    paftadan bunu ayirt etmek matematiksel olarak mumkun degildir. Ayni
    cizimdeki diger paftalarin ortak karari en guvenilir ipucudur.
    """
    if len(sheets) < 2:
        return
    votes: dict[str, int] = {}
    for sh in sheets:
        votes[sh.paper] = votes.get(sh.paper, 0) + 1
    winner, cnt = max(votes.items(), key=lambda kv: kv[1])
    if cnt * 2 <= len(sheets):
        return
    for sh in sheets:
        if sh.paper == winner:
            continue
        landscape = sh.frame.w >= sh.frame.h
        lo, short = ISO_PAPERS[winner]
        pw, ph = (lo, short) if landscape else (short, lo)
        n_raw = sh.frame.w / pw
        n = snap_nice(n_raw)
        if abs(n - n_raw) / n_raw > 0.01:
            sh.warnings.append(
                f"Bu pafta {sh.paper} olarak cozuldu; cizimdeki digerleri "
                f"{winner}. Cerceve olcusu {winner} ile uyusmadigi icin "
                f"{sh.paper} birakildi."
            )
            continue
        old = sh.paper
        _apply_paper(sh, winner, pw, ph, n)
        if old != winner:
            sh.warnings.append(
                f"Kagit, cizimdeki diger paftalarla ayni olsun diye "
                f"{old} yerine {winner} secildi.")


def detect_frames(boxes: Sequence[BoxItem],
                  labels: Sequence[TextItem],
                  min_ratio: float = 1.30,
                  max_ratio: float = 1.55) -> list[BoxItem]:
    """Antet etiketi iceren, A-serisi en/boy oranindaki kutulari pafta sayar.

    En kucukten baslayarak her kutu, iceride kalan HENUZ SAHIPLENILMEMIS bir
    etiketi sahiplenir. Boylece ic ice cerceveler ve tum paftalari kapsayan
    buyuk kutular dogal olarak elenir.
    """
    cands = []
    for b in boxes:
        if b.w <= 0 or b.h <= 0:
            continue
        ratio = max(b.w, b.h) / min(b.w, b.h)
        if not (min_ratio <= ratio <= max_ratio):
            continue
        if not any(b.contains(t.x, t.y) for t in labels):
            continue
        cands.append(b)

    out: list[BoxItem] = []
    claimed: set[int] = set()
    for b in sorted(cands, key=lambda z: z.area):
        unclaimed = [t for t in labels
                     if id(t) not in claimed and b.contains(t.x, t.y)]
        if len(unclaimed) != 1:
            continue
        claimed.add(id(unclaimed[0]))
        out.append(b)
    out.sort(key=lambda b: (round(-b.ymin, 3), b.xmin))
    return out


def build_sheets(texts: Sequence[TextItem],
                 boxes: Sequence[BoxItem],
                 tables: Sequence[TableItem] = (),
                 forced_paper: Optional[str] = "A3",
                 title_layers: Optional[Sequence[str]] = None,
                 attributes: Sequence[AttrItem] = (),
                 info: Optional[dict] = None,
                 ) -> list[Sheet]:
    """Cizimdeki tum paftalari cozumler.

    Antet iki bicimde olabilir:
      1) duz TEXT'ler  -> "Resim No" etiketinin altindaki metin okunur
      2) oznitelikli blok -> RESIM_NO gibi bir tag'in degeri dogrudan okunur
    Ikisi de desteklenir; oznitelik varsa ona oncelik verilir.
    """
    if title_layers:
        wanted = {l.lower() for l in title_layers}
        title_texts = [t for t in texts if t.layer.lower() in wanted] or list(texts)
    else:
        title_texts = list(texts)

    dn_labels = [t for t in title_texts if _starts_any(t.n, LBL_DRAWING_NO)
                 and not _starts_any(t.n, LBL_SHEET_NO)]
    dn_attrs = [a for a in attributes
                if _attr_match([a], ATTR_DRAWING_NO) is not None]

    # "Resim No" hem antette hem malzeme listesi basliginda geciyor.
    # Hangisinin antet oldugunu deneyerek buluyoruz.
    strategy, anchors, frames = select_anchors(dn_labels, boxes, dn_attrs)
    if info is not None:
        info["strategy"] = strategy
        info["anchor_count"] = len(anchors)
        info["label_count"] = len(dn_labels)
        info["frames"] = list(frames)

    sheets: list[Sheet] = []
    for idx, fr in enumerate(frames, 1):
        attrs_in = [a for a in attributes if fr.contains(a.x, a.y)]
        inside_all = [t for t in title_texts if fr.contains(t.x, t.y)]
        sh = Sheet(index=idx, frame=fr)

        # Cerceveyi bu paftaya baglayan capa etiketi kullan.
        # (Cizimde "Resim No" hem antette hem malzeme listesi basliginda
        #  gecebiliyor; capa secimi hangisinin antet oldugunu zaten cozdu.)
        anchors_in = [a for a in anchors
                      if isinstance(a, TextItem) and fr.contains(a.x, a.y)]
        if anchors_in:
            anchors_in.sort(key=lambda t: -t.height)
            lbl_dn = anchors_in[0]
        else:
            lbl_dn = _label_in([t for t in inside_all if t in dn_labels],
                               LBL_DRAWING_NO)
        # Antet metinleri, 'Resim No' etiketiyle ayni katmanda yazilir.
        # Bu katmani otomatik yakalayip antet okumasini onunla sinirliyoruz.
        inside = inside_all
        if lbl_dn is not None and lbl_dn.layer:
            same_layer = [t for t in inside_all if t.layer == lbl_dn.layer]
            if len(same_layer) >= 6:
                inside = same_layer
        if lbl_dn is not None:
            v = value_below(inside, lbl_dn, fr, prefer_digits=True)
            sh.drawing_no = v.text if v else ""
        if not sh.drawing_no:
            sh.warnings.append("Antette 'Resim No' degeri okunamadi.")

        for keys, attr in ((LBL_PROJECT_NO, "project_no"),
                           (LBL_JOB_NAME, "job_name"),
                           (LBL_CUSTOMER, "customer"),
                           (LBL_SHEET_NO, "sheet_no")):
            lbl = _label_in(inside, keys)
            if lbl is not None:
                v = value_below(inside, lbl, fr,
                                prefer_digits=(attr in ("project_no", "sheet_no")))
                if v:
                    setattr(sh, attr, v.text)

        lbl_pr = _label_in(inside, LBL_PROJECT)
        if lbl_pr is not None:
            vals = values_below(inside, lbl_pr, fr)
            if vals:
                sh.project = vals[0].text
                sh.part_name = vals[-1].text if len(vals) > 1 else ""

        lbl_sc = _label_in(inside, LBL_SCALE)
        if lbl_sc is not None:
            v = value_below(inside, lbl_sc, fr)
            if v:
                sh.scale_text = v.text

        # Oznitelikli antet varsa degerleri ondan al (daha guvenilir).
        if attrs_in:
            for keys, attr in ((ATTR_DRAWING_NO, "drawing_no"),
                               (ATTR_PROJECT_NO, "project_no"),
                               (ATTR_JOB_NAME, "job_name"),
                               (ATTR_PROJECT, "project"),
                               (ATTR_CUSTOMER, "customer"),
                               (ATTR_SHEET_NO, "sheet_no"),
                               (ATTR_SCALE, "scale_text")):
                a = _attr_match(attrs_in, keys)
                if a is not None and a.value:
                    setattr(sh, attr, a.value)
            if sh.drawing_no:
                sh.warnings = [w for w in sh.warnings
                               if not w.startswith("Antette 'Resim No'")]

        sh.scale_text_n = parse_scale_text(sh.scale_text)

        paper, pw, ph, n, warns = resolve_paper(fr.w, fr.h, forced_paper, sh.scale_text_n)
        _apply_paper(sh, paper, pw, ph, n)
        sh.warnings.extend(warns)

        geo_std = nice_distance(n) < 0.005
        sh.scale_is_standard = geo_std
        if sh.scale_text_n:
            sh.scale_deviation = round(
                abs(n - sh.scale_text_n) / sh.scale_text_n * 100.0, 1)
        if sh.scale_text_n and sh.scale_deviation > 1.0:
            d = sh.scale_deviation
            kucuk = "kucuk" if n > sh.scale_text_n else "buyuk"
            sebep = ("Cerceve standart olcude; duzeltilmesi gereken ANTET YAZISI."
                     if geo_std else
                     "Cerceve standart bir olcude degil; ANTET BLOGU elle "
                     "olceklenmis gorunuyor.")
            sh.warnings.append(
                f"OLCEK: antette '{sh.scale_text}', cercevenin gercek olcegi "
                f"{sh.scale_label} (%{d:g} sapma - basilan parca nominalden "
                f"%{d:g} {kucuk}). {sebep} PDF cerceveye gore basildi.")
        elif not geo_std:
            sh.warnings.append(
                f"Cerceve standart bir olcege oturmuyor ({sh.scale_label}); "
                f"antet blogu elle olceklenmis olabilir. PDF yine de tam "
                f"{sh.paper} olarak, cerceve eksiksiz basilir.")
        elif sh.scale_text and sh.scale_text_n is None:
            sh.warnings.append(
                f"Antetteki olcek metni ('{sh.scale_text}') okunamadi; "
                f"geometrik olcek {sh.scale_label} kullanildi."
            )

        if sh.crop_mm > 1.0:
            sh.warnings.append(
                f"Cerceve kagida {sh.crop_mm:.2f} mm tasiyor, kenarindan kirpilacak."
            )

        # Bu paftaya dusen malzeme listeleri.
        # Gercek AutoCAD tablosu yoksa, elle cizilmis listeyi metinlerden kur.
        my_tables = [tb for tb in tables if fr.contains(tb.cx, tb.cy)]
        if not my_tables:
            my_tables = find_text_tables(texts, fr)
            if my_tables:
                sh.warnings.append(
                    f"Malzeme listesi elle cizilmis (AutoCAD tablosu degil); "
                    f"{len(my_tables)} tablo metinlerden cozuldu.")
        # Cok dar tablolar (revizyon/aciklama kutulari) malzeme listesi degildir
        my_tables = [tb for tb in my_tables
                     if tb.rows and len(tb.rows[0]) >= 4]
        my_tables.sort(key=lambda tb: (-tb.ymax, tb.xmin))

        # Once baslikli tablolari coz; sutun eslemesini basliksiz
        # (devam) tablolarina devret.
        order = sorted(range(len(my_tables)),
                       key=lambda i: 0 if _has_header_row(my_tables[i].rows) else 1)
        recs: list[dict] = []
        colmap_hint: Optional[dict] = None
        for i in order:
            tb = my_tables[i]
            r, tw, w, cm = parse_bom_table(tb.rows, colmap_hint)
            if cm and _has_header_row(tb.rows):
                colmap_hint = cm
            recs.extend(r)
            if tw and not sh.bom_total_weight:
                sh.bom_total_weight = tw
            sh.warnings.extend(w)
        recs.sort(key=_poz_sort_key)
        sh.bom = recs

        # Icerik parmak izi: cerceveye GORE konumlanmis metinler. Ayni set
        # iki kez kopyalanmissa iki paftanin parmak izi ayni cikar.
        sig = []
        for t in texts:
            if fr.contains(t.x, t.y):
                sig.append((round((t.x - fr.xmin) / fr.w, 4),
                            round((t.y - fr.ymin) / fr.h, 4), t.text))
        sig.sort()
        sh.text_count = len(sig)
        sh.content_hash = hashlib.md5(repr(sig).encode("utf-8")).hexdigest()[:12]
        sheets.append(sh)

    if not forced_paper:
        _paper_consensus(sheets)

    # Ayni resim numarasi birden fazla paftada varsa: birebir kopya mi,
    # yoksa ayni numarayi tasiyan FARKLI iki pafta mi?
    groups: dict[str, list[Sheet]] = {}
    for sh in sheets:
        key = sh.drawing_no.strip().upper()
        if key:
            groups.setdefault(key, []).append(sh)
    for key, g in groups.items():
        if len(g) < 2:
            continue
        ayni = len({s.content_hash for s in g}) == 1
        for sh in g:
            if ayni:
                sh.warnings.append(
                    f"'{sh.drawing_no}' cizimde {len(g)} kez var ve kopyalar "
                    f"BIREBIR AYNI (set kopyalanmis gorunuyor).")
            else:
                sh.warnings.append(
                    f"DIKKAT: '{sh.drawing_no}' cizimde {len(g)} kez var ve "
                    f"ICERIKLERI FARKLI. Hangisinin gecerli oldugunu kontrol edin.")
    return sheets


# "REV-A", "REV . B", "REV:C", "REVIZYON B" gibi etiketler
_REV_RE = re.compile(r"^REV(?:IZYON)?\s*[.:\-]?\s*([A-Z0-9]{1,3})$")


def rev_sirasi(etiket: str) -> int:
    """REV etiketini siralanabilir bir sayiya cevirir. Bos = -1."""
    if not etiket:
        return -1
    t = norm(etiket)
    m = _REV_RE.match(t)
    if not m:
        return -1
    d = m.group(1)
    if d.isdigit():
        return int(d)
    return sum((ord(c) - 64) * (27 ** (len(d) - i - 1)) for i, c in enumerate(d))


def rev_etiketlerini_ata(sheets: Sequence[Sheet], texts: Sequence[TextItem],
                         yaricap_carpani: float = 1.2) -> None:
    """Cizimdeki 'REV-A' gibi etiketleri en yakin paftaya baglar.

    Etiket genelde bir grubun disinda, ustunde durur. Bu yuzden cerceve
    icinde aramak yetmez; cercevenin merkezine olan uzaklik kullanilir.
    """
    adaylar = [(t, rev_sirasi(t.text)) for t in texts]
    adaylar = [(t, r) for t, r in adaylar if r >= 0]
    if not adaylar or not sheets:
        return
    for t, _r in adaylar:
        en_yakin = None
        en_kisa = None
        for sh in sheets:
            fr = sh.frame
            dx = max(fr.xmin - t.x, 0.0, t.x - fr.xmax)
            dy = max(fr.ymin - t.y, 0.0, t.y - fr.ymax)
            d = math.hypot(dx, dy)
            if d > max(fr.w, fr.h) * yaricap_carpani:
                continue
            if en_kisa is None or d < en_kisa:
                en_kisa, en_yakin = d, sh
        if en_yakin is not None and not en_yakin.rev_etiketi:
            en_yakin.rev_etiketi = t.text.strip()

    # Ayni kopya kumesindeki paftalar etiketi paylasir: etiket genelde
    # kumenin tamamina bir kez yazilir.
    kume: dict[str, list[Sheet]] = {}
    for sh in sheets:
        kume.setdefault(sh.content_hash, []).append(sh)
    for sh in sheets:
        if sh.rev_etiketi:
            continue
        # ayni konum bandindaki (y'si yakin) etiketli bir paftadan devral
        for o in sheets:
            if o.rev_etiketi and abs(o.frame.cy - sh.frame.cy) < max(
                    sh.frame.h, o.frame.h) * 0.75:
                sh.rev_etiketi = o.rev_etiketi
                break


def sheet_clusters(sheets: Sequence[Sheet],
                   gap_carpani: float = 0.75) -> list[list[Sheet]]:
    """Paftalari uzaysal kumelere ayirir (birbirine yakin olanlar bir grup).

    Revizyon setleri cizimde birbirinden uzak duran obekler halindedir.
    Iptal caprazi bu OBEGIN tamamina cizilir; bu yuzden capraz aramadan
    once obekleri bulmak gerekir. Kopya iliskisine bakilmaz - revizyonlar
    birbirinden farkli olabilir.
    """
    n = len(sheets)
    if n == 0:
        return []
    if n == 1:
        return [list(sheets)]
    w = sorted(s.frame.w for s in sheets)
    esik = w[len(w) // 2] * gap_carpani

    parent = list(range(n))

    def bul(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        a = sheets[i].frame
        for j in range(i + 1, n):
            b = sheets[j].frame
            gx = max(0.0, max(a.xmin, b.xmin) - min(a.xmax, b.xmax))
            gy = max(0.0, max(a.ymin, b.ymin) - min(a.ymax, b.ymax))
            if gx <= esik and gy <= esik:
                ra, rb = bul(i), bul(j)
                if ra != rb:
                    parent[rb] = ra

    kume: dict[int, list[Sheet]] = {}
    for i, s in enumerate(sheets):
        kume.setdefault(bul(i), []).append(s)
    return list(kume.values())


def kume_kutusu(kume: Sequence[Sheet], ident: str = "KUME") -> BoxItem:
    return BoxItem(ident,
                   min(s.frame.xmin for s in kume), min(s.frame.ymin for s in kume),
                   max(s.frame.xmax for s in kume), max(s.frame.ymax for s in kume))


def iptal_isaretle(sheets: Sequence[Sheet],
                   iptal_bolgeleri: Sequence[BoxItem]) -> None:
    """Uzerine capraz cizilmis (iptal edilmis) bolgelerdeki paftalari isaretler."""
    for sh in sheets:
        for b in iptal_bolgeleri:
            if b.contains(sh.frame.cx, sh.frame.cy):
                sh.iptal = True
                sh.warnings.append(
                    "Bu pafta uzerine capraz cizilmis bir bolgede - "
                    "iptal edilmis eski revizyon olarak degerlendirildi.")
                break


def _oto_sec(g: list[Sheet]) -> tuple[Sheet, str]:
    """Bir kopya grubundan hangisinin gecerli oldugunu isaretlere gore secer."""
    # 1) Iptal caprazi: capraz cizilmemis olan(lar) kalir
    temiz = [s for s in g if not s.iptal]
    if temiz and len(temiz) < len(g):
        if len(temiz) == 1:
            return temiz[0], "uzerine capraz cizilmemis tek kopya"
        g, on_ek = temiz, "capraz cizilmemisler arasindan "
    else:
        on_ek = ""
        if not temiz:                      # hepsi capraz cizilmis
            on_ek = "hepsi capraz cizili, "

    # 2) REV etiketi: en buyuk harf/sayi yenidir
    revli = [(s, rev_sirasi(s.rev_etiketi)) for s in g]
    en_buyuk = max(r for _s, r in revli)
    if en_buyuk >= 0:
        ust = [s for s, r in revli if r == en_buyuk]
        if len(ust) < len(g):
            return ust[0], f"{on_ek}en yuksek revizyon etiketi ({ust[0].rev_etiketi})"

    # 3) Konum: okuma sirasinda sonuncu (once asagi, sonra saga)
    g = sorted(g, key=lambda s: (-s.frame.cy, s.frame.cx))
    return g[-1], f"{on_ek}konum (okuma sirasinda sonuncu)"


def dedupe_sheets(sheets: Sequence[Sheet],
                  keep: str = "oto") -> tuple[list[Sheet], list[Sheet]]:
    """Kopyalanmis pafta setlerini ayiklar.

    Teknik ressam revize ederken eski seti cizimde birakiyor. Yenisini
    bazen ALTINA, bazen SAGINA, bazen de USTUNE koyuyor - yani konum tek
    basina guvenilir bir isaret DEGIL. Bu yuzden sirayla su isaretlere
    bakilir:

      1. IPTAL CAPRAZI  : uzerine capraz cizilmis kopya elenir (en guvenilir)
      2. REV ETIKETI    : "REV-A" < "REV-B" - buyuk harf yenidir
      3. KONUM          : okuma sirasinda EN SONDAKI kopya
                          (once asagi, sonra saga -> hem "altina" hem
                           "sagina" koyma aliskanligini karsilar)

      keep = "oto"  -> yukaridaki sira (varsayilan)
      keep = "alt"  -> sadece konum: en alttaki/sagdaki
      keep = "ust"  -> sadece konum: en usttteki/soldaki
      keep = "hepsi"-> hicbiri atlanmaz

    Sadece icerigi BIREBIR AYNI olan kopyalar atlanir. Ayni resim numarasini
    tasiyan ama icerigi FARKLI paftalar asla atlanmaz - ikisi de kalir ve
    uyari verilir; hangisinin gecerli oldugu insan karari.

    Doner: (kalanlar, atlananlar)
    """
    if keep == "hepsi":
        return list(sheets), []

    atlanan: list[Sheet] = []
    aday = list(sheets)

    # 0) IPTAL CAPRAZI: uzerine capraz cizilmis pafta gecersizdir - kopyasi
    #    olsun olmasin dogrudan elenir. (Guvenlik: hepsi isaretliyse
    #    yanlis tespit varsayilir ve hicbiri elenmez.)
    if keep == "oto":
        iptalliler = [s for s in aday if s.iptal]
        if iptalliler and len(iptalliler) < len(aday):
            for s in iptalliler:
                s.secim_gerekcesi = "uzerine capraz cizilmis (iptal edilmis)"
            atlanan.extend(iptalliler)
            aday = [s for s in aday if not s.iptal]

    # 1) Ayni resim numarasindan birden fazla kalmissa birini sec
    gruplar: dict[str, list[Sheet]] = {}
    for sh in aday:
        no = sh.drawing_no.strip().upper()
        if no:
            gruplar.setdefault(no, []).append(sh)

    for no, g in gruplar.items():
        if len(g) < 2:
            continue
        # Okuma sirasi: once yukaridan asagi, sonra soldan saga.
        g.sort(key=lambda s: (-s.frame.cy, s.frame.cx))
        ayni_icerik = len({s.content_hash for s in g}) == 1

        if keep == "ust":
            tut, gerekce = g[0], "konum (ust/sol istendi)"
        elif keep == "alt":
            tut, gerekce = g[-1], "konum (alt/sag istendi)"
        elif ayni_icerik:
            tut, gerekce = _oto_sec(g)
        else:
            # Icerikler farkli: bunlar gercek revizyonlar olabilir.
            # Konuma bakarak secmek TEHLIKELI; sadece REV etiketi karar verir.
            revli = [(s, rev_sirasi(s.rev_etiketi)) for s in g]
            en_buyuk = max(r for _s, r in revli)
            ustler = [s for s, r in revli if r == en_buyuk]
            if en_buyuk >= 0 and len(ustler) < len(g):
                tut = ustler[0]
                gerekce = f"en yuksek revizyon etiketi ({tut.rev_etiketi})"
            else:
                for s in g:
                    s.warnings.append(
                        f"DIKKAT: '{no}' bu cizimde {len(g)} kez var, "
                        f"icerikleri FARKLI ve hangisinin gecerli oldugunu "
                        f"belirleyecek isaret (capraz / REV etiketi) yok. "
                        f"Hepsi basildi - kontrol edin.")
                continue

        tut.secim_gerekcesi = gerekce
        for s in g:
            if s is not tut:
                s.secim_gerekcesi = gerekce
                nerede = ("ustteki" if s.frame.cy > tut.frame.cy + 1e-6 else
                          "alttaki" if s.frame.cy < tut.frame.cy - 1e-6 else
                          "soldaki" if s.frame.cx < tut.frame.cx else "sagdaki")
                s.warnings.append(
                    f"Ayni paftanin {nerede} kopyasi; secim gerekcesi: {gerekce}.")
                atlanan.append(s)

    atl = {id(s) for s in atlanan}
    kalan = [s for s in sheets if id(s) not in atl]
    if not kalan:                       # her sey elenmisse hicbir sey eleme
        return list(sheets), []
    for i, sh in enumerate(kalan, 1):
        sh.index = i
    return kalan, atlanan


def output_names(sheets: Sequence[Sheet], dwg_stem: str, ext: str = ".pdf") -> list[str]:
    """Cakismayan PDF dosya adlari uretir."""
    used: dict[str, int] = {}
    names: list[str] = []
    for sh in sheets:
        base = safe_filename(sh.drawing_no) if sh.drawing_no.strip() else \
            safe_filename(f"{dwg_stem}-P{sh.index:02d}")
        k = base.upper()
        used[k] = used.get(k, 0) + 1
        if used[k] > 1:
            base = f"{base}_{used[k]}"
        names.append(base + ext)
    return names
