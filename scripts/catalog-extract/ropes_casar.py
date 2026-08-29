# -*- coding: utf-8 -*-
"""CASAR (WireCo) özel vinç halatları — `CASAR CRANE ROPES.pdf` (02/2024).

Katalog TEK PDF ama ONALTI AYRI ÜRÜNdür; her ürün kendi konstrüksiyonu, kendi
çap bandı ve kendi mukavemet sınıflarıyla basılır. Bu yüzden ürün başına bir
`catalog_data/ropes/casar_<ürün>.json` yazılır — seçicinin ilk süzgeç adımı
`construction` (meta.series) olduğu için tek dosyada toplamak ürünleri
birbirine karıştırırdı.

SAYFA DÜZENİ: her ürün bir AÇIKLAMA sayfası (RCN, damar/tel sayısı, dolgu
faktörü, çap bandı) + bir TABLO sayfası olarak basılır; tablo sayfası
"mm / inch / kg/m / lb/ft" başlık satırıyla bulunur ve mukavemet sınıfı
sayısı üründen ürüne değişir (bir ile üç arası).

ÖZ TİPİ TAHMİN EDİLMEZ: katalogun kendi "Rope Properties / Seileigenschaften"
matrisinden (s. C12–C13) okunur. "With internal plastic jacket" işaretli ürün
`IWRC-PC` (plastik kaplı çelik öz), diğerleri `IWRC` taşır. Aynı matristen
`rotation_resistant`, `swaged`, `compacted` ve `parallel_lay` nitelikleri de
alınır — vinç halatı seçiminde tek katlı ve kılavuzsuz yükte dönmeye dirençli
halat şarttır, bu nitelik seçicide görünmelidir.

CASAR STARLIFT XTRA'nın tablosunda mukavemet SINIFI BASILI DEĞİLDİR (katalog
onu yalnız kopma kuvvetiyle tanımlar); o ürünün satırlarında `grade_mpa`
yoktur ve uydurulmaz.
"""
from __future__ import annotations

import re
import sys

import ropes_common as rc

PDF = "CASAR CRANE ROPES.pdf"

# Ürün özellikleri matrisi (s. C12 dönmeye dirençli · C13 dönmeye dirençsiz).
# Satır etiketi → nitelik adı.
PROPERTY_ROWS = {
    "Swaged": "swaged",
    "Compacted": "compacted",
    "With": "plastic_jacket",       # "With internal plastic jacket"
    "Parallel": "parallel_lay",
}

HEADER_ROLES = {"mm": "mm", "inch": "inch", "kg/m": "kg_per_m", "lb/ft": None, "kN": "kN"}

# Açıklama sayfasındaki etiket → alan
# KATALOGUN KENDİ DİZGİ HATALARI. Basılı değer KORUNUR — düzeltilmez, çünkü
# kaynak katalog satın almanın ve garantinin dayanağıdır. `ropes_validate.py`
# bunları her koşuda yeniden bildirir; burada yalnız ürünün notuna yazılır ki
# seçici ekranında mühendis nedenini görsün.
KNOWN_TYPOS = {
    "BETALIFT": ("KATALOG HATASI: Ø17 metre ağırlığı 1,16 kg/m basılmıştır ve "
                 "komşu çaplarla (Ø16 1,30 · Ø18 1,65) tutarsızdır. Aynı satırın "
                 "2160 N/mm² sütununda ton karşılığı da 38,35 basılmıştır (kN "
                 "değeri 476,1 → 48,55 t olmalıydı); kN sütunu doğrudur."),
    "POWERPLAST": ("KATALOG HATASI: 1/2\" (Ø12,7) metre ağırlığı 1,19 kg/m "
                   "basılmıştır ve komşu çaplarla (Ø12 0,73 · Ø13 0,87) "
                   "tutarsızdır."),
    "TECHNOLIFT": ("KATALOG HATASI: 1 1/8\" (Ø28,58) satırının kopma kuvveti "
                   "469,0 kN basılmıştır — Ø26 satırının değerinin aynısı. Ø28 "
                   "540,6 kN, Ø29 587,4 kN olduğuna göre değer ~560 kN olmalıydı; "
                   "basılı değer EMNİYETLİ yöndedir (düşük) ve korunmuştur."),
}

SPEC_LABELS = {
    "RCN": "rcn",
    "Number of Outer Strands": "outer_strands",
    "Number of Wires": "total_wires",
    "Number of Outer Load Bearing Wires": "outer_load_bearing_wires",
    "Average Fill Factor": "fill_factor",
}


def _columns(page):
    """{sütun x → ürün adı}. Ürün adları DİK basılıdır; aynı x'e düşen kelimeler
    tek addır ("STARLIFT" + "PLUS"). Ad SIRASI PDF kelime sırasına bırakılmaz —
    eşleme kelime KÜMESİYLE yapılır (bkz. `_lookup`)."""
    cols: dict[int, list] = {}
    for w in rc.words(page):
        if 195 < w[1] < 298 and w[4].isupper() and len(w[4]) > 2:
            cols.setdefault(round(w[0] / 6), []).append(w[4])
    return {k * 6: parts for k, parts in cols.items()}


def _label_grid(page):
    """s. C12'deki nitelik satırlarının y konumları: {nitelik: y}.

    Satır ETİKETLERİ yalnız SOL sayfada (C12) basılıdır; C13 aynı yayımın sağ
    yarısıdır ve etiketsizdir. Bu yüzden ızgara sol sayfadan okunur, sağ sayfa
    aynı y konumlarından çözülür."""
    grid = {}
    for y, row in rc.rows_of(rc.words(page)):
        if not (300 < y < 370):
            continue
        label = next((w[4] for w in row if w[4] in PROPERTY_ROWS), None)
        if label:
            grid[PROPERTY_ROWS[label]] = y
    return grid


def _matrix_page(page, grid, rotation_resistant):
    """Bir matris sayfasından {(kelime kümesi): {nitelik: bool}} çıkarır."""
    cols = _columns(page)
    if not cols:
        return {}
    rows = rc.rows_of(rc.words(page))
    out = {frozenset(parts): {"rotation_resistant": rotation_resistant}
           for parts in cols.values()}
    for attr, gy in grid.items():
        marks = [w[0] for y, row in rows if abs(y - gy) < 3 for w in row if w[4] == "X"]
        for x, parts in cols.items():
            out[frozenset(parts)][attr] = any(abs(x - mx) < 8 for mx in marks)
    return out


def properties():
    """s. C12 (dönmeye dirençli) + C13 (dirençsiz) matrislerini birleştirir."""
    d = rc.open_src(PDF)
    grid = _label_grid(d[11])
    if len(grid) != len(PROPERTY_ROWS):
        sys.exit(f"CASAR özellik matrisi: {len(grid)}/{len(PROPERTY_ROWS)} satır bulundu")
    props = {}
    props.update(_matrix_page(d[11], grid, True))
    props.update(_matrix_page(d[12], grid, False))
    d.close()
    return props


def _lookup(props, product):
    """Ürün adını matris sütunuyla KELİME KÜMESİ üzerinden eşler."""
    return props.get(frozenset(product.upper().split()), {})


def _table_pages(doc):
    """(sayfa indisi, ürün adı) — başlık satırı "mm inch kg/m lb/ft" olan sayfalar."""
    out = []
    for i in range(doc.page_count):
        ws = rc.words(doc[i])
        header = None
        for y, row in rc.rows_of(ws):
            texts = [w[4] for w in row]
            if "mm" in texts and "kg/m" in texts and "lb/ft" in texts:
                header = (y, row)
        if header is None:
            continue
        title = [w[4] for w in sorted(w for w in ws if w[1] < 40) if w[4] != "CASAR"]
        title = [t for t in title if not re.fullmatch(r"C\d+", t)]
        out.append((i, " ".join(title).title(), header))
    return out


def _grades(page, header_y):
    """Başlığın üstündeki "1960 N/mm²" etiketlerini (x'e göre sıralı) verir."""
    ws = [w for w in rc.words(page) if w[1] < header_y]
    ws = list({(round(w[0], 1), round(w[1], 1), w[4]): w for w in ws}.values())
    out = []
    for _, row in rc.rows_of(ws):
        for i, w in enumerate(row):
            if w[4] == "N/mm²" and i and re.fullmatch(r"\d{4}", row[i - 1][4]):
                out.append(int(row[i - 1][4]))
    return out


def _specs(page):
    """Açıklama sayfasındaki teknik veri listesini okur (etiket satırı + değer satırı)."""
    lines = [ln.strip() for ln in page.get_text().split("\n")]
    out = {}
    for i, ln in enumerate(lines):
        label = ln.split(" _ ")[0].strip()
        if label in SPEC_LABELS and i + 1 < len(lines):
            val = lines[i + 1].strip()
            key = SPEC_LABELS[label]
            if key == "rcn":
                out[key] = val or None
            else:
                out[key] = rc.num(val)
    return out


def build():
    doc = rc.open_src(PDF)
    props = properties()
    written = []
    for idx, product, (header_y, header_row) in _table_pages(doc):
        page = doc[idx]
        anchors = rc.anchors_from(header_row, HEADER_ROLES)
        kn_x = sorted(x for role, x in anchors if role == "kN")
        grades = _grades(page, header_y)
        if grades and len(grades) != len(kn_x):
            sys.exit(f"{product}: {len(grades)} mukavemet sınıfı ama {len(kn_x)} kN sütunu")

        rows = rc.read_rows(page, anchors, header_y + 4, 815)
        spec = _specs(doc[idx - 1])
        prop = _lookup(props, product)
        if not prop:
            sys.exit(f"{product}: özellik matrisinde sütunu yok (s. C12/C13)")
        core = "IWRC-PC" if prop.get("plastic_jacket") else "IWRC"

        items = []
        for _, cells in rows:
            dia = rc.num(rc.cell_text(cells, "mm"))
            inch = rc.cell_join(cells, "inch")
            inch = rc.inch_label(inch) if inch else None
            if dia is None and inch:
                dia = rc.inch_to_mm(inch)
            if dia is None:
                continue
            weight = rc.num(rc.cell_text(cells, "kg_per_m"))
            loads = [rc.num(v) for v in rc.by_anchor(cells, "kN", kn_x)]
            for gi, load in enumerate(loads):
                if load is None:
                    continue
                it = {
                    "diameter_mm": dia,
                    "core_type": core,
                    "grade_mpa": grades[gi] if grades else None,
                    "breaking_load_kN": load,
                    "weight_kg_per_m": weight,
                    "rotation_resistant": prop.get("rotation_resistant"),
                    "compacted": prop.get("compacted"),
                    "swaged": prop.get("swaged"),
                }
                if inch:
                    it["diameter_inch"] = inch
                it.update({k: v for k, v in spec.items() if v is not None})
                items.append(it)

        if not items:
            sys.exit(f"{product}: satır okunamadı (s. {idx})")
        slug = re.sub(r"[^a-z0-9]+", "_", product.lower()).strip("_")
        meta = {
            # Kaynak katalog adıyla "CASAR CRANE ROPES"tur; on altı ürünün
            # tamamı vinç halatıdır (seçicinin kullanım alanı süzgeci).
            "typical_application": "Vinç",
            "brand": "CASAR",
            "equipment_type": "rope",
            "series": product,
            "source_pdf": PDF,
            "source_doc": "WireCo Special Wire Ropes, Edition 02/2024 (tablolar 10.2022)",
            "extraction_date": "2026-08-09",
            "page_range": f"{idx} (0-tabanlı PDF indisi), açıklama {idx - 1}",
            "notes": " ".join(x for x in (
                "Vinç özel halatı. Öz tipi ve nitelikler katalogun kendi "
                "'Rope Properties' matrisinden (s. C12–C13) okunmuştur.",
                "" if grades else "Katalog bu üründe mukavemet SINIFI basmaz; "
                                  "yalnız kopma kuvveti verilir.",
                KNOWN_TYPOS.get(product.upper(), ""),
            ) if x),
        }
        rc.write(f"casar_{slug}.json", meta, items, extra_fields=(
            "diameter_inch", "rotation_resistant", "compacted", "swaged",
            "rcn", "outer_strands", "total_wires", "outer_load_bearing_wires",
            "fill_factor"))
        written.append(slug)
    doc.close()
    return written


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build()
