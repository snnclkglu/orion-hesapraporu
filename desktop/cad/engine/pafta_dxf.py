# -*- coding: utf-8 -*-
"""
pafta_dxf.py — AutoCAD OLMADAN, bir DXF dosyasindan paftalari ve malzeme
listelerini cozumleyip rapor/JSON/Excel uretir.

Kullanim:
    pip install ezdxf openpyxl
    python pafta_dxf.py "cizim.dxf" --out cikti --paper A3

Ne ise yarar:
  * pafta_ayikla.py (AutoCAD COM) ile AYNI cekirdek mantigi kullanir; boylece
    "hangi paftalar bulundu, olcekler dogru mu" kontrolunu AutoCAD acmadan,
    saniyeler icinde yapabilirsiniz.
  * PDF uretmez (bunun icin AutoCAD gerekir), malzeme listelerini cikarir.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

try:
    import ezdxf
    from ezdxf import bbox
except ImportError:
    sys.exit("ezdxf kurulu degil.  ->  pip install ezdxf")

from pafta_core import (AttrItem, BoxItem, TableItem, TextItem, build_sheets,
                        clean_mtext, dedupe_sheets, iptal_isaretle,
                        output_names, rev_etiketlerini_ata)
import pafta_report
import pafta_tani


# ---------------------------------------------------------------------------
def _cluster(vals: list[float], tol: float) -> list[float]:
    """1 boyutlu basit kumeleme; kume merkezlerini sirali dondurur."""
    if not vals:
        return []
    vals = sorted(vals)
    groups = [[vals[0]]]
    for v in vals[1:]:
        if v - groups[-1][-1] <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sum(g) / len(g) for g in groups]


def _table_grid(doc, tbl) -> list[list[str]]:
    """ACAD_TABLE'in anonim blok icerigini satir/sutun matrisine cevirir.

    Sutun/satir sinirlari tablonun KENDI CIZGILERINDEN alinir (kumeleme degil),
    boylece ortalanmis hucreler ve birlestirilmis hucreler karismaz.
    """
    try:
        blk = doc.blocks.get(tbl.get_block_name())
    except Exception:
        return []
    if blk is None:
        return []

    items = []
    vx: list[float] = []
    hy: list[float] = []
    for e in blk:
        t = e.dxftype()
        if t == "MTEXT":
            items.append((e.dxf.insert.x, e.dxf.insert.y, clean_mtext(e.text)))
        elif t == "TEXT":
            items.append((e.dxf.insert.x, e.dxf.insert.y, clean_mtext(e.dxf.text)))
        elif t == "LINE":
            s, en = e.dxf.start, e.dxf.end
            if abs(s.x - en.x) < 1e-6 and abs(s.y - en.y) > 1e-6:
                vx.append(s.x)
            elif abs(s.y - en.y) < 1e-6 and abs(s.x - en.x) > 1e-6:
                hy.append(s.y)
        elif t == "LWPOLYLINE":
            pts = [(p[0], p[1]) for p in e.get_points()]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + (pts[:1] if e.closed else [])):
                if abs(x1 - x2) < 1e-6 and abs(y1 - y2) > 1e-6:
                    vx.append(x1)
                elif abs(y1 - y2) < 1e-6 and abs(x1 - x2) > 1e-6:
                    hy.append(y1)
    items = [i for i in items if i[2]]
    if not items:
        return []

    xs = [i[0] for i in items]
    ys = [i[1] for i in items]
    span_x = (max(xs) - min(xs)) or 1.0
    span_y = (max(ys) - min(ys)) or 1.0

    col_b = _cluster(vx, span_x * 0.004)
    row_b = _cluster(hy, span_y * 0.004)

    if len(col_b) < 2 or len(row_b) < 2:      # cizgi yoksa kumelemeye dus
        n_rows = int(getattr(tbl.dxf, "n_rows", 0) or 0)
        n_cols = int(getattr(tbl.dxf, "n_cols", 0) or 0)
        col_c = _cluster(sorted(set(xs)), span_x * 0.02)
        row_c = sorted(_cluster(sorted(set(ys)), span_y * 0.01), reverse=True)
        grid = [["" for _ in col_c] for _ in row_c]
        for x, y, txt in items:
            ri = min(range(len(row_c)), key=lambda i: abs(row_c[i] - y))
            ci = min(range(len(col_c)), key=lambda i: abs(col_c[i] - x))
            grid[ri][ci] = (grid[ri][ci] + " " + txt).strip() if grid[ri][ci] else txt
        return grid

    n_cols = len(col_b) - 1
    n_rows = len(row_b) - 1
    grid = [["" for _ in range(n_cols)] for _ in range(n_rows)]

    def slot(v: float, bounds: list[float]) -> int:
        for i in range(len(bounds) - 1):
            if bounds[i] - 1e-6 <= v <= bounds[i + 1] + 1e-6:
                return i
        return 0 if v < bounds[0] else len(bounds) - 2

    for x, y, txt in items:
        ci = slot(x, col_b)
        ri_bottom = slot(y, row_b)
        ri = n_rows - 1 - ri_bottom            # 0 = en ust satir
        cur = grid[ri][ci]
        grid[ri][ci] = (cur + " " + txt).strip() if cur else txt
    return grid


# ---------------------------------------------------------------------------
def analyse(path: str, paper: str = "A3", title_layers=None, info=None):
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    cache = bbox.Cache()

    texts: list[TextItem] = []
    boxes: list[BoxItem] = []
    tables: list[TableItem] = []
    attrs: list[AttrItem] = []

    for i, e in enumerate(msp):
        t = e.dxftype()
        if t == "TEXT":
            p = e.dxf.insert
            texts.append(TextItem(p.x, p.y, e.dxf.text,
                                  float(getattr(e.dxf, "height", 0) or 0), e.dxf.layer))
        elif t == "MTEXT":
            p = e.dxf.insert
            texts.append(TextItem(p.x, p.y, e.text,
                                  float(getattr(e.dxf, "height", 0) or 0), e.dxf.layer))
        elif t == "INSERT":
            try:
                for at in e.attribs:
                    p = at.dxf.insert
                    a = AttrItem(p.x, p.y, at.dxf.tag, at.dxf.text,
                                 at.dxf.layer,
                                 float(getattr(at.dxf, "height", 0) or 0),
                                 str(e.dxf.name))
                    attrs.append(a)
                    if a.value:
                        texts.append(TextItem(a.x, a.y, a.value, a.height, a.layer))
            except Exception:
                pass
            try:
                bb = bbox.extents([e], cache=cache)
            except Exception:
                continue
            if bb.has_data:
                boxes.append(BoxItem(f"BLOK '{e.dxf.name}' [{e.dxf.layer}]",
                                     bb.extmin.x, bb.extmin.y,
                                     bb.extmax.x, bb.extmax.y))
        elif t == "LWPOLYLINE" and e.closed and len(e) in (4, 5):
            pts = [(p[0], p[1]) for p in e.get_points()]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            boxes.append(BoxItem(f"LWPL#{i}", min(xs), min(ys), max(xs), max(ys)))
        elif t == "ACAD_TABLE":
            try:
                bb = bbox.extents([e], cache=cache)
                xmin, ymin, xmax, ymax = bb.extmin.x, bb.extmin.y, bb.extmax.x, bb.extmax.y
            except Exception:
                p = e.dxf.insert
                xmin = ymin = xmax = ymax = 0.0
                xmin, ymin, xmax, ymax = p.x, p.y, p.x, p.y
            tables.append(TableItem(f"TBL#{i}", xmin, ymin, xmax, ymax,
                                    rows=_table_grid(doc, e)))

    sheets = build_sheets(texts, boxes, tables, forced_paper=paper,
                          title_layers=title_layers, attributes=attrs,
                          info=info)
    return sheets, texts, boxes, tables, attrs, _iptal_bolgeleri(msp, sheets)


def main() -> int:
    ap = argparse.ArgumentParser(description="DXF icindeki paftalari ve malzeme listelerini cozumler.")
    ap.add_argument("dxf", nargs="+", help="DXF dosyalari")
    ap.add_argument("--out", default="pafta_cikti", help="cikti klasoru")
    ap.add_argument("--paper", default="A3", help="A0/A1/A2/A3/A4 veya AUTO")
    ap.add_argument("--antet-katman", default="", help="antet metinlerinin katmani (bos = hepsi)")
    ap.add_argument("--kopya", default="oto",
                    choices=("oto", "alt", "ust", "hepsi"),
                    help="eski revizyon da cizimdeyse hangi kopya alinsin: "
                         "oto (iptal caprazi > REV etiketi > konum) / "
                         "alt / ust / hepsi")
    a = ap.parse_args()

    paper = None if a.paper.upper() == "AUTO" else a.paper.upper()
    layers = [a.antet_katman] if a.antet_katman else None

    os.makedirs(a.out, exist_ok=True)
    all_rows: list[dict] = []
    all_sheets: list[dict] = []

    for path in a.dxf:
        stem = os.path.splitext(os.path.basename(path))[0]
        info: dict = {}
        sheets, texts, boxes, tables, attrs, iptal_bolgeleri = analyse(
            path, paper, layers, info)
        if iptal_bolgeleri:
            iptal_isaretle(sheets, iptal_bolgeleri)
        rev_etiketlerini_ata(sheets, texts)
        sheets, atlanan = dedupe_sheets(sheets, keep=a.kopya)
        names = output_names(sheets, stem)
        print(f"\n=== {os.path.basename(path)} — {len(sheets)} pafta ===")
        if atlanan:
            print(f"    ! Eski revizyon da cizimde: {len(atlanan)} birebir ayni "
                  f"kopya atlandi ({a.kopya} kume tutuldu)")
            print(f"      Tersi icin: --kopya {'ust' if a.kopya == 'alt' else 'alt'}"
                  f"   Hepsi icin: --kopya hepsi")
        for sh, nm in zip(sheets, names):
            print(f"  {sh.index:2d}. {sh.drawing_no or '(resim no yok)':20s} "
                  f"{sh.paper} {sh.scale_label:8s} "
                  f"cerceve {sh.frame.w:.1f}x{sh.frame.h:.1f}  "
                  f"malzeme {len(sh.bom):3d} satir  -> {nm}")
            for w in sh.warnings:
                print(f"        ! {w}")
            d = pafta_report.sheet_dict(sh, stem, nm)
            all_sheets.append(d)
            for r in sh.bom:
                row = {"dosya": stem, "pafta": sh.drawing_no}
                row.update(r)
                all_rows.append(row)
        tani = pafta_tani.tani_json(path, sheets, info, texts, boxes, tables,
                                    attrs, atlanan)
        pafta_tani.yaz(os.path.join(a.out, f"tani_{stem}.json"), tani)

    pafta_report.write_json(os.path.join(a.out, "malzeme_listesi.json"), all_sheets)
    pafta_report.write_xlsx(os.path.join(a.out, "malzeme_listesi.xlsx"), all_sheets, all_rows)
    pafta_report.write_csv(os.path.join(a.out, "pafta_raporu.csv"), all_sheets)
    print(f"\nCikti klasoru: {os.path.abspath(a.out)}")
    return 0

# ---------------------------------------------------------------------------
def _iptal_bolgeleri(msp, sheets) -> list[BoxItem]:
    """DXF tarafinda iptal caprazi tespiti.

    Kopya kumelerinin her birinin MERKEZINDEN gecen, kume kosegeni kadar
    uzun bir cizgi varsa o kume iptal edilmis demektir. (Bir dikdortgenin
    kosegeni her zaman merkezden gecer.)
    """
    import math
    gruplar: dict[tuple, list] = {}
    for sh in sheets:
        k = (sh.drawing_no.strip().upper(), sh.content_hash)
        if k[0] and k[1]:
            gruplar.setdefault(k, []).append(sh)
    coklu = [g for g in gruplar.values() if len(g) > 1]
    if not coklu:
        return []
    n = max(len(g) for g in coklu)
    kumeler: list[list] = [[] for _ in range(n)]
    for g in coklu:
        g.sort(key=lambda s: (-s.frame.cy, s.frame.cx))
        for i, s in enumerate(g):
            kumeler[min(i, n - 1)].append(s)

    cizgiler = []
    for e in msp.query("LINE"):
        a, b = e.dxf.start, e.dxf.end
        cizgiler.append((a.x, a.y, b.x, b.y, math.hypot(b.x - a.x, b.y - a.y)))

    out: list[BoxItem] = []
    for i, kume in enumerate(kumeler):
        if not kume:
            continue
        xmin = min(s.frame.xmin for s in kume); ymin = min(s.frame.ymin for s in kume)
        xmax = max(s.frame.xmax for s in kume); ymax = max(s.frame.ymax for s in kume)
        w, h = xmax - xmin, ymax - ymin
        kosegen = math.hypot(w, h)
        cx, cy = (xmin + xmax) / 2, (ymin + ymax) / 2
        pad = max(w, h) * 0.008
        for x1, y1, x2, y2, uz in cizgiler:
            if uz < kosegen * 0.55:
                continue
            # cizgi merkezdeki kucuk kareyi kesiyor mu?
            dx, dy = x2 - x1, y2 - y1
            if abs(dx) < 1e-9 and abs(dy) < 1e-9:
                continue
            t = ((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy)
            t = max(0.0, min(1.0, t))
            px, py = x1 + t * dx, y1 + t * dy
            if abs(px - cx) <= pad and abs(py - cy) <= pad:
                out.append(BoxItem(f"IPTAL-KUME-{i + 1}", xmin, ymin, xmax, ymax))
                break
    return out

if __name__ == "__main__":
    raise SystemExit(main())
