# -*- coding: utf-8 -*-
"""GAMAK 2026 üç fazlı standart asenkron motor kataloğu çıkarımı.

Kaynak: ``GAMAK Teknik Katalog TR 2026.pdf`` (176 fiziksel sayfa).

Yalnız vinçlerde kullanılan standart 3 faz, 400 V, 50 Hz, S1, IP55 AC motorlar
alınır. Monofaze (s.56-60), kompakt (s.85-86), ex-proof ve özel uygulama
serileri ayrı ürün aileleridir; standart motor seçicisine karıştırılmaz.

Teknik tablolar
---------------

* s.69-72: alüminyum gövde IE2/IE3, 2/4/6/8 kutup
* s.73-74: alüminyum gövde IE4, 2/4 ve 6/8 kutup
* s.76-79: pik gövde IE3, 2/4/6/8 kutup
* s.80-83: pik gövde IE4, 2/4/6/8 kutup

Motor boyutları
----------------

* s.88: alüminyum motorlar, ayaklı B3 (ayrıca B6/B7/B8/B15/V5/V6)
* s.89: pik motorlar, ayaklı B3 (ayrıca B6/B7/B8/B15/V5/V6)

Her ürün ``technical_page`` ve ``dimension_page`` taşır. Katalog sayfası
üreticisi böylece teknik tablo ile doğru malzemenin B3 "MOTOR BOYUTLARI"
yaprağını aynı ürün altında birleştirebilir.

Aynı (güç, kutup) için seçim sırası eski katalogla aynıdır: en yüksek verim
sınıfı -> pik gövde -> küçük gövde -> hafif motor. Bu, katalog seçicisinin
tek bir güç/kutup satırı önermesi davranışını korur.
"""
import re

import fitz

import motors_common as mc


# 1 tabanlı fiziksel sayfalar. Aradaki s.75 bölüm kapağıdır.
PERF_PAGES = tuple(range(69, 75)) + tuple(range(76, 84))
DIMENSION_PAGES = {
    "Alüminyum gövde": 88,
    "Pik (dökme) gövde": 89,
}

# Teknik tablo veri sütunlarının x bantları (A4 dikey sayfa).
PERF_BANDS = [
    ("power", 42, 84),
    ("model", 84, 153),
    ("speed", 153, 192),
    ("current", 192, 223),
    ("torque", 223, 246),
    ("cos", 246, 281),
    ("eff100", 281, 309),
    ("eff75", 309, 329),
    ("eff50", 329, 359),
    ("start_current", 359, 390),
    ("start_current_yd", 390, 412),
    ("start_torque", 412, 443),
    ("start_torque_yd", 443, 466),
    ("breakdown", 466, 503),
    ("inertia", 503, 544),
    ("weight", 544, 578),
]

# AGM3EL 132 M 4b / GM4E 315 L 8d / GMM3E 400 L 2d
MODEL_RE = re.compile(
    r"^(?P<family>A?GMM?)(?P<eff>[234])E(?P<line>L?)\s+"
    r"(?P<frame>\d{2,3})\s*(?P<letter>[A-Z]+)\s*"
    r"(?P<poles>[2468])(?P<step>[a-z])$"
)

DIM_BANDS = [("label", 42, 103), ("shaft", 468, 493)]
DIM_ROW_RE = re.compile(
    r"^(?P<frame>\d{2,3})\s*(?P<letter>[SMLH])"
    r"(?:\s*\((?P<pole_group>[^)]+)\))?$",
    re.I,
)

CLASS_RANK = {"IE4": 0, "IE3": 1, "IE2": 2}


def _clean(text):
    return " ".join(str(text or "").split())


def shaft_table(doc):
    """{(malzeme, gövde, kutup): D mil çapı} — s.88-89 B3 tabloları."""
    out = {}
    for material, pnum in DIMENSION_PAGES.items():
        page = doc[pnum - 1]
        for yc, row_words in mc.rows_by_y(mc.words(page)):
            if yc < 343:
                continue
            cells = mc.banded_cells(row_words, DIM_BANDS)
            label = _clean(cells.get("label"))
            match = DIM_ROW_RE.match(label)
            shaft = mc.num(cells.get("shaft"))
            if not match or shaft is None:
                continue
            frame = int(match.group("frame"))
            group = (match.group("pole_group") or "").lower()
            if group:
                poles = ([2] if re.search(r"\b2\b", group) and "4" not in group
                         else [4, 6, 8])
            else:
                poles = [2, 4, 6, 8]
            for pole in poles:
                out[(material, frame, pole)] = shaft
    return out


def _row(pnum, yc, row_words, shafts):
    cells = mc.banded_cells(row_words, PERF_BANDS)
    model = _clean(cells.get("model"))
    match = MODEL_RE.match(model)
    if not match:
        return None

    required = {
        "power_kw": mc.num(cells.get("power")),
        "speed_rpm": mc.num(cells.get("speed")),
        "current_a": mc.num(cells.get("current")),
        "torque_nm": mc.num(cells.get("torque")),
        "power_factor": mc.num(cells.get("cos")),
        "efficiency_pct": mc.num(cells.get("eff100")),
    }
    if any(value is None for value in required.values()):
        return ("missing", pnum, round(yc, 1), model, cells)

    frame = int(match.group("frame"))
    poles = int(match.group("poles"))
    material = ("Alüminyum gövde" if match.group("family").startswith("A")
                else "Pik (dökme) gövde")
    shaft = shafts.get((material, frame, poles))
    if shaft is None:
        return ("missing_shaft", pnum, round(yc, 1), model,
                material, frame, poles)

    return {
        "power_kw": required["power_kw"],
        "poles": poles,
        "speed_rpm": int(required["speed_rpm"]),
        "torque_nm": required["torque_nm"],
        "frame_size": f"{frame}{match.group('letter')}",
        "efficiency_pct": required["efficiency_pct"],
        # s.77 GMM3E 355 L 4e / 450 kW satırında üretici ağırlığı "-"
        # yayımlar. Bilinmeyen alan satırı düşürmez; JSON yazıcısı None alanı
        # UYDURMA bir değerle doldurmak yerine hiç yazmaz.
        "weight_kg": mc.num(cells.get("weight")),
        "shaft_diameter_mm": shaft,
        "current_a": required["current_a"],
        "power_factor": required["power_factor"],
        "series": material,
        "ip_class": "IP55",
        "model": model,
        "efficiency_class": f"IE{match.group('eff')}",
        "shaft_source": f"katalog (s.{DIMENSION_PAGES[material]})",
        "technical_page": pnum,
        "dimension_page": DIMENSION_PAGES[material],
        "_frame": frame,
        "_material": material,
    }


def dedupe(items):
    """Aynı güç/kutup için katalog seçicisinin tek önerisini bırakır."""
    def rank(item):
        return (
            CLASS_RANK[item["efficiency_class"]],
            0 if item["_material"].startswith("Pik") else 1,
            item["_frame"],
            item.get("weight_kg") if item.get("weight_kg") is not None else 9e9,
            item["technical_page"],
            item["model"],
        )

    groups = {}
    for order, item in enumerate(items):
        groups.setdefault((item["power_kw"], item["poles"]), []).append(
            (order, item)
        )

    keep, dropped = [], []
    for key in sorted(groups):
        rows = sorted(groups[key], key=lambda pair: (rank(pair[1]), pair[0]))
        keep.append(rows[0])
        dropped.extend(item for _, item in rows[1:])

    keep.sort(key=lambda pair: pair[0])
    out = []
    for _, item in keep:
        item.pop("_frame", None)
        item.pop("_material", None)
        out.append(item)
    for item in dropped:
        item.pop("_frame", None)
        item.pop("_material", None)
    return out, dropped


def extract():
    doc = fitz.open(mc.PDF["gamak"])
    shafts = shaft_table(doc)
    items, missing, pages_used = [], [], []
    for pnum in PERF_PAGES:
        page = doc[pnum - 1]
        before = len(items)
        for yc, row_words in mc.rows_by_y(mc.words(page)):
            parsed = _row(pnum, yc, row_words, shafts)
            if isinstance(parsed, dict):
                items.append(parsed)
            elif parsed is not None:
                missing.append(parsed)
        pages_used.append((pnum, len(items) - before))
    doc.close()
    items, dropped = dedupe(items)
    return items, pages_used, missing, dropped


META = {
    "brand": "GAMAK",
    "equipment_type": "motor",
    "series": "3 fazlı standart asenkron motorlar (IE2 / IE3 / IE4)",
    "source_pdf": "GAMAK Teknik Katalog TR 2026.pdf",
    "source_doc": "GAMAK Teknik Katalog TR 2026",
    "extraction_date": "2026-08-27",
    "page_range": (
        "Teknik tablolar s.69-74 ve s.76-83; B3 MOTOR BOYUTLARI "
        "alüminyum s.88, pik gövde s.89"
    ),
    "notes": (
        "Yalnız standart 3 fazlı AC motorlar: 400 V, 50 Hz, S1 sürekli çalışma, "
        "IP55. Monofaze, kompakt, ex-proof ve özel uygulama serileri alınmadı. "
        "Aynı (güç, kutup) çifti için en yüksek IE sınıfı, eşitlikte pik gövde, "
        "sonra küçük gövde ve hafif motor seçildi. technical_page ürünün teknik "
        "tablosunu; dimension_page ise aynı gövde malzemesinin ayaklı B3 "
        "MOTOR BOYUTLARI yaprağını gösterir. shaft_diameter_mm bu boyut "
        "yaprağındaki DØ değeridir."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "gamak.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, missing, dropped, path = build()
    print("GAMAK satır:", n, "->", path)
    for page, count in pages:
        print(f"  s.{page} · {count} ham satır")
    print("tekrar eden (güç,kutup) için elenen satır:", len(dropped))
    if missing:
        print("okunamayan satır:", len(missing))
        for row in missing[:20]:
            print("   ", row)
