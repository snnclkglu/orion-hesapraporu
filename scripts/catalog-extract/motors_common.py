# -*- coding: utf-8 -*-
"""Motor kataloğu çıkarımının ortak parçaları.

Üç motor kataloğu (ABB, INNOMOTICS/Siemens, GAMAK) üç ayrı sayfa düzeni
kullanır; ancak hepsinde aynı büyüklükler aranır. Bu modül düzenden bağımsız
olan kısmı toplar: sütun sınırlarına dayalı satır okuyucu, IEC 60072-1 mil ucu
çapı defteri, gövde (frame) kodu ayrıştırma ve JSON yazımı.

`grid.py` çizgi ızgarası olan sayfalar (GAMAK) için hazır altyapıdır ve
oradan İÇE AKTARILIR; ABB ve Siemens sayfalarında çizgi yoktur, sütunlar
başlık x konumlarından türetilir (`banded_rows`).
"""
import json
import os
import re
import sys

import fitz  # noqa: F401  (çağıranlar fitz'i bu modül üzerinden almaz; belge amaçlı)

# Windows konsolu cp1254'tür; marka/sayfa özetlerindeki "·" ve Türkçe harfler
# bozuk çıkar ya da çökertir. Üç çıkarım betiği de bu modülü içe aktardığından
# akışı burada bir kez UTF-8'e sabitlemek yeterlidir.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # yönlendirilmiş/eski akış
        pass

# Depo kökü: scripts/catalog-extract/.. /.. → orion-hesapraporu, onun da üstü workspace
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
WORKSPACE = os.path.dirname(REPO)
CATALOG_DATA = os.path.join(WORKSPACE, "catalog_data")

PDF = {
    "abb": os.path.join(WORKSPACE, "abb-ozel-elektrik-motor-katalog.pdf"),
    "siemens": os.path.join(WORKSPACE, "SIEMENS MOTOR KATALOG.pdf"),
    "gamak": os.path.join(WORKSPACE, "GAMAK MOTOR.pdf"),
}


# --------------------------------------------------------------------------
# Sayfa okuma
# --------------------------------------------------------------------------

def words(page):
    """(x0, y0, x1, y1, metin) beşlileri."""
    return [w[:5] for w in page.get_text("words")]


def rows_by_y(ws, tol=2.0):
    """Kelimeleri y merkezine göre satırlara kümeler; (yc, [kelime...]) verir."""
    items = sorted(ws, key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    out = []
    for w in items:
        yc = (w[1] + w[3]) / 2
        if out and abs(yc - out[-1][0]) <= tol:
            out[-1][1].append(w)
        else:
            out.append([yc, [w]])
    return [(yc, sorted(g, key=lambda w: w[0])) for yc, g in out]


def banded_cells(row_words, bands):
    """Bir satırın kelimelerini x bantlarına göre adlandırılmış hücrelere böler.

    `bands` = [(ad, x_alt, x_ust), ...]. Bant dışında kalan kelime atılır;
    aynı banda düşen kelimeler boşlukla birleşir.
    """
    out = {}
    for w in row_words:
        xm = (w[0] + w[2]) / 2
        for name, lo, hi in bands:
            if lo <= xm < hi:
                out[name] = (out.get(name, "") + " " + w[4]).strip()
                break
    return out


NUM_RE = re.compile(r"^-?\d+(?:[.,]\d+)?$")


def num(s):
    """'3,62' / '13.1' / '-' → float | None."""
    if s is None:
        return None
    s = s.strip().replace(" ", " ").replace(" ", "")
    if s in ("", "-", "–", "—", "/", "*"):
        return None
    s = s.replace(",", ".")
    if not NUM_RE.match(s):
        return None
    try:
        return float(s)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# Gövde (frame) kodu
# --------------------------------------------------------------------------

FRAME_RE = re.compile(r"^(\d{2,3})\s*([A-Z]*)")


def frame_number(code):
    """'132SMB' / '315 S' / '90SL_' → 132 / 315 / 90 (int) | None."""
    if not code:
        return None
    m = FRAME_RE.match(code.strip().replace(" ", ""))
    return int(m.group(1)) if m else None


# --------------------------------------------------------------------------
# IEC 60072-1 mil ucu çapı (D, mm) — yalnız katalogda okunamayan satırlar için
# --------------------------------------------------------------------------
# Kaynak: IEC 60072-1 Tablo 4 (IM B3 gövdeler, silindirik mil ucu). 225 ve
# üstü gövdelerde 2 kutuplu makine daha ince mille çıkar; sözlük bu yüzden
# (gövde, kutup grubu) anahtarlıdır.
IEC_SHAFT_MM = {
    56: (9, 9), 63: (11, 11), 71: (14, 14), 80: (19, 19), 90: (24, 24),
    100: (28, 28), 112: (28, 28), 132: (38, 38), 160: (42, 42),
    180: (48, 48), 200: (55, 55), 225: (55, 60), 250: (60, 65),
    280: (65, 75), 315: (65, 80), 355: (75, 100), 400: (80, 110),
    450: (80, 120),
}


def iec_shaft_mm(frame, poles):
    """IEC 60072-1'e göre gövde + kutup sayısı → mil ucu çapı (mm) | None."""
    pair = IEC_SHAFT_MM.get(frame)
    if pair is None:
        return None
    return float(pair[0] if poles == 2 else pair[1])


# --------------------------------------------------------------------------
# JSON yazımı
# --------------------------------------------------------------------------

FIELD_ORDER = [
    "power_kw", "poles", "speed_rpm", "torque_nm", "frame_size",
    "efficiency_pct", "weight_kg", "shaft_diameter_mm",
    "current_a", "power_factor", "series", "ip_class", "model",
    "efficiency_class", "shaft_source",
]


def ordered(item):
    """Alanları sabit sıraya sokar (JSON okunabilirliği için)."""
    out = {}
    for k in FIELD_ORDER:
        if k in item and item[k] is not None:
            out[k] = item[k]
    for k in item:
        if k not in out and item[k] is not None:
            out[k] = item[k]
    return out


def write_catalog(path, meta, items):
    """catalog_data/motors/<marka>.json yazar; satırlar kutup → güç sıralı."""
    items = [ordered(it) for it in items]
    items.sort(key=lambda it: (it["poles"], it["power_kw"]))
    fields = []
    for it in items:
        for k in it:
            if k not in fields:
                fields.append(k)
    # Diğer katalog dosyalarıyla aynı biçim: her ürün TEK satır.
    lines = ["{"]
    lines.append('  "meta": ' + json.dumps(meta, ensure_ascii=False, indent=4).replace("\n", "\n  ") + ",")
    lines.append('  "fields": ' + json.dumps(fields, ensure_ascii=False) + ",")
    lines.append('  "items": [')
    prev_poles = None
    body = ""
    for i, it in enumerate(items):
        sep = ",\n" if i else ""
        if prev_poles is not None and it["poles"] != prev_poles:
            sep = ",\n\n"
        prev_poles = it["poles"]
        body += sep + "    " + json.dumps(it, ensure_ascii=False)
    lines.append(body)
    lines.append("  ]")
    lines.append("}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(items)
