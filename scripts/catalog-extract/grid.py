# -*- coding: utf-8 -*-
"""Çizgi ızgarasına dayalı ortak tablo okuyucu.

YILMAZ katalog sayfaları tam çizgili tablolardır: dikey çizgiler sütun
sınırlarını, yatay çizgiler blok (model grubu) sınırlarını verir. Bu modül
sayfayı (satır, sütun) hücre metnine çevirir; alan anlamlandırması çağırana
aittir.
"""
import re
import fitz


def rules(page):
    """Sayfadaki dikey ve yatay çizgi koordinatlarını kümelenmiş olarak verir."""
    vx, hy = [], []
    for p in page.get_drawings():
        for it in p["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if abs(a.x - b.x) < 0.8 and abs(a.y - b.y) > 4:
                    vx.append((a.x + b.x) / 2)
                elif abs(a.y - b.y) < 0.8 and abs(a.x - b.x) > 4:
                    hy.append((a.y + b.y) / 2)
            elif it[0] == "re":
                r = it[1]
                if r.height > 4:
                    vx += [r.x0, r.x1]
                if r.width > 4:
                    hy += [r.y0, r.y1]
    return cluster(vx, 2.0), cluster(hy, 2.0)


def cluster(vals, tol):
    out = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]


def words(page):
    """(x0, y0, x1, y1, metin) — soldan sağa, yukarıdan aşağıya."""
    return [w[:5] for w in page.get_text("words")]


def rows_of(ws, tol=2.4):
    """Kelimeleri y merkezine göre satırlara kümeler."""
    items = sorted(ws, key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    out = []
    for w in items:
        yc = (w[1] + w[3]) / 2
        if out and abs(yc - out[-1][0]) <= tol:
            out[-1][1].append(w)
        else:
            out.append([yc, [w]])
    return [(yc, sorted(g, key=lambda w: w[0])) for yc, g in out]


def col_of(x, vx):
    """x koordinatı hangi sütuna düşüyor (0 tabanlı); dışarıdaysa None."""
    for i in range(len(vx) - 1):
        if vx[i] - 0.5 <= x < vx[i + 1] + 0.5:
            return i
    return None


def cells(row_words, vx):
    """Bir satırın kelimelerini sütun indisine göre birleştirir."""
    out = {}
    for w in row_words:
        c = col_of((w[0] + w[2]) / 2, vx)
        if c is None:
            continue
        out[c] = (out.get(c, "") + " " + w[4]).strip()
    return out


NUM = re.compile(r"^-?\d{1,3}(?:[.,]\d+)?$|^-?\d+$")


def num(s):
    """'3,62' / '1.234' / '-' → float | None. Binlik ayracı YOK (katalogda kullanılmıyor)."""
    if s is None:
        return None
    s = s.strip().replace(" ", " ")
    if s in ("", "-", "–", "—", "/"):
        return None
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None
