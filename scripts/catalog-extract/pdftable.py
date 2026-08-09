# -*- coding: utf-8 -*-
"""Sütun ÇAPALI PDF tablo okuyucu — markadan bağımsız ortak katman.

`grid.py`'den farkı: orada tablo ÇİZGİ ızgarasıyla çözülür (YILMAZ katalogları
hücreleri çizgiyle ayırır). Burada çizgi yoktur ya da güvenilmez; sütunlar
BAŞLIK ETİKETLERİNİN x konumundan bulunur ve gövdedeki her sayı en yakın
çapaya düşer.

Bu yöntem sabit sütun indisine güvenmekten sağlamdır çünkü katalog tabloları
BOŞ HÜCRE basar: büyük çaplarda üst mukavemet sınıfı yoktur, bazı satırda
ağırlık verilmez, bazı ölçü yalnız inç olarak basılır. Sırayla okumak bu
satırlarda sütunları kaydırır; x ile okumak kaydırmaz.
"""
from __future__ import annotations

import os
import re

import fitz

BASE = r"C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD"
SRC_DIR = os.path.join(BASE, "Diğer kataloglar")
CATALOG_DATA = os.path.join(BASE, "catalog_data")

# 3/16, 1 1/8, 7/16 … inç ölçüsü
FRACTION_RE = re.compile(r"^(?:(\d+)\s+)?(\d+)/(\d+)$")


def open_src(pdf_name):
    """`Diğer kataloglar/` altındaki kaynak PDF'i açar."""
    return fitz.open(os.path.join(SRC_DIR, pdf_name))


def words(page):
    """Sayfanın kelimeleri: (x0, y0, x1, y1, metin). Çift basılmış metin katmanı
    (aynı yerde aynı kelime) tekilleştirilir."""
    ws = [(w[0], w[1], w[2], w[3], w[4]) for w in page.get_text("words")]
    return list({(round(w[0], 1), round(w[1], 1), w[4]): w for w in ws}.values())


def rows_of(ws, tol=2.5):
    """Kelimeleri y ekseninde satırlara kümeler; x'e göre sıralı döndürür."""
    buckets: dict[int, list] = {}
    for w in ws:
        buckets.setdefault(round(w[1] / tol), []).append(w)
    return [(k * tol, sorted(v)) for k, v in sorted(buckets.items())]


def rows_by_gap(ws, gap=5.0):
    """Satırları SABİT KOVA yerine BOŞLUKLA kümeler.

    Bazı kataloglar bir satırın tek bir hücresini 2–3 punto kaydırarak basar
    (POLAT PCS'te anma momenti sütunu böyledir). Sabit kova bu hücreyi komşu
    satıra atar; boşluk kümelemesi atmaz: y farkı `gap`'ten küçük kaldığı
    sürece aynı satır sayılır."""
    out = []
    cur: list = []
    for w in sorted(ws, key=lambda w: (w[1], w[0])):
        if cur and w[1] - cur[-1][1] > gap:
            out.append((cur[0][1], sorted(cur)))
            cur = []
        cur.append(w)
    if cur:
        out.append((cur[0][1], sorted(cur)))
    return out


def num(tok):
    """'1.234,5' → 1234.5 · '92,0' → 92.0 · '–' → None."""
    if tok is None:
        return None
    t = str(tok).strip().replace("\u2013", "-").replace("\u2212", "-")
    if t in ("", "-", "–", "—", "*"):
        return None
    t = t.replace(" ", "").replace("\xa0", "")
    # NOKTA HEM BİNLİK HEM ONDALIK AYIRACI OLABİLİR. Türkçe/Almanca kataloglar
    # "1.322,0" yazar, İngilizce SEW katalogları "0.465" ve "8.160" yazar.
    # Üç haneli bir grup gördüğünde körü körüne binlik saymak "0.465"i 465
    # yapar — sessiz ve tehlikeli bir hata. Binlik sayılması için ayrıca
    # şunlardan biri gerekir: virgüllü ondalık kısım · birden çok grup ·
    # iki basamaklı baş grup. Baş grubu "0" olan sayı asla binlik değildir.
    m = re.fullmatch(r"([1-9]\d{0,2})((?:\.\d{3})+)(,\d+)?", t)
    if m and (m.group(3) or len(m.group(1)) >= 2 or m.group(2).count(".") > 1):
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def inch_parts(tok):
    """'7/16' → (0,7,16) · '1 1/8' → (1,1,8) · '2' → (2,0,1). Eşleşmezse None.

    **Boşluksuz basılan tam+kesir**: metin katmanında "1 1/8" çoğu zaman
    "11/8" olarak tek kelime çıkar. Bileşik kesir (pay > payda) katalogda
    KULLANILMAZ — inç ölçüsü daima "1 1/8" biçiminde basılır — bu yüzden
    pay paydadan büyükse ilk basamak TAM SAYIDIR: 11/8 → 1 1/8, 23/8 → 2 3/8.
    Gerçek bir proper kesir (13/16, 15/16, 11/16) bu kuraldan etkilenmez.
    """
    t = str(tok).strip()
    if re.fullmatch(r"\d+", t):
        return int(t), 0, 1
    m = FRACTION_RE.match(t)
    if not m:
        return None
    whole, numer, denom = int(m.group(1) or 0), int(m.group(2)), int(m.group(3))
    if not whole and numer > denom:
        head, rest = divmod(numer, 10 ** (len(str(numer)) - 1))
        if rest and rest < denom:
            whole, numer = head, rest
    return whole, numer, denom


def inch_label(tok):
    """Görüntülenecek inç dizgisi: '11/8' → '1 1/8'."""
    parts = inch_parts(tok)
    if parts is None:
        return str(tok).strip()
    whole, numer, denom = parts
    if not numer:
        return str(whole)
    return f"{whole} {numer}/{denom}" if whole else f"{numer}/{denom}"


def inch_to_mm(tok):
    """'7/16' → 11.11 · '1 1/8' → 28.58 · '2' → 50.8. Eşleşmezse None."""
    parts = inch_parts(tok)
    if parts is None:
        return None
    whole, numer, denom = parts
    return round((whole + numer / denom) * 25.4, 2)


def anchors_from(row, roles):
    """Başlık satırını (rol, x) çapalarına çevirir.

    `roles` metin → rol sözlüğüdür; sözlükte olmayan başlık kelimesi de çapa
    olur ama rolü `None`'dır. Bunun sebebi hizalamadır: bir satırdaki her sayı
    EN YAKIN çapaya düşer, dolayısıyla ilgilenmediğimiz sütunların (t, lbs,
    kp …) da çapası bulunmalıdır — yoksa o sayılar komşu sütuna kayar.
    """
    return [(roles.get(w[4]), w[0]) for w in row]


def assign(row, anchors):
    """Bir satırın kelimelerini rol → [(x, kelime)] sözlüğüne dağıtır."""
    cells: dict = {}
    for w in row:
        role = min(anchors, key=lambda a: abs(a[1] - w[0]))[0]
        if role is None:
            continue
        cells.setdefault(role, []).append((w[0], w[4]))
    return cells


def read_rows(page, anchors, y0, y1, tol=2.5, gap=None, xmax=None):
    """[y0, y1) bandındaki satırları rol → [(x, kelime)] sözlüğüne çevirir.

    `xmax` verilirse o x'in sağındaki kelimeler HİÇ okunmaz. Tablonun yalnız
    sol bloğu isteniyorsa (SEW X'te termik güç sütunları) çapa eklemekten
    daha sağlamdır: sağdaki sayı en yakın çapaya düşüp sütun kirletemez.
    """
    ws = [w for w in words(page) if y0 <= w[1] < y1 and (xmax is None or w[0] < xmax)]
    rows = rows_by_gap(ws, gap) if gap else rows_of(ws, tol)
    return [(y, cells) for y, cells in ((y, assign(rw, anchors)) for y, rw in rows) if cells]


def cell_text(cells, role):
    """Roldeki ilk kelime (yoksa None)."""
    vals = cells.get(role)
    return vals[0][1] if vals else None


def cell_join(cells, role):
    """Roldeki kelimeleri x sırasında birleştirir ('1' + '1/8' → '1 1/8')."""
    vals = cells.get(role)
    return " ".join(t for _, t in sorted(vals)) if vals else None


def by_anchor(cells, role, xs, tol=22.0):
    """Roldeki kelimeleri sütun çapalarına x'e göre oturtur; boş sütun None."""
    vals = cells.get(role, [])
    out = [None] * len(xs)
    for x, t in vals:
        i = min(range(len(xs)), key=lambda k: abs(xs[k] - x))
        if abs(xs[i] - x) <= tol and out[i] is None:
            out[i] = t
    return out
