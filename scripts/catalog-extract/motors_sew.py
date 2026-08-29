# -*- coding: utf-8 -*-
"""SEW-EURODRIVE standart üç fazlı AC motor kataloğu çıkarımı.

Kaynak: ``SEW_AC motor.pdf`` (692 fiziksel sayfa),
``Catalog AC Motors DR.71 - 315, DT56, DR63``, 19290411/EN, 10/2014.

Standart 400 V, 50 Hz, S1 motorların teknik tabloları s.96-108'dir:

* DRS.. IE1: 2, 4 ve 6 kutup
* DRE.. IE2: 2, 4 ve 6 kutup
* DRP.. IE3: 2, 4 ve 6 kutup

DT56 ve DR63 satırları aynı bölümde yayımlanır; ancak verim sınıfı ve verim
değerleri katalogda ``-`` bırakılmıştır. Zorunlu bir seçim verisini uydurmak
yerine bu satırlar alınmaz. Pole-changing, tork motoru, servo motor ve
MOVI-SWITCH/MOVIMOT aileleri standart AC motor seçicisine karıştırılmaz.

Her motor, kendi performans tablosu ile s.203-301 arasındaki gerçek gövde ölçü
föyüne bağlanır. Büyük 4 kutuplu DRP gövdelerinde katalog IEC'nin genel kasa
çapından farklı mil ucu yayımlar (DRP250M4=60, DRP280S4=65,
DRP315K/S4=70 mm); bu değerler model bazında korunur.
"""
from __future__ import annotations

import re

import fitz

import motors_common as mc


PERF_PAGES = tuple(range(96, 109))

MODEL_RE = re.compile(
    r"^(?P<series>DRS|DRE|DRP)(?P<frame>\d{2,3})"
    r"(?P<suffix>[A-Z]*)(?P<poles>[246])$"
)
CLASS_RANK = {"IE3": 0, "IE2": 1, "IE1": 2}

# Teknik tablonun ilk yarısı: model, güç, moment, devir, 400 V akımı,
# cos(phi), verim sınıfı ve yüzde 100 yükte verim.
PERFORMANCE_BANDS = [
    ("model", 50, 115),
    ("power", 115, 150),
    ("torque", 150, 180),
    ("speed", 180, 215),
    ("current", 215, 250),
    ("power_factor", 290, 325),
    ("efficiency_class", 325, 350),
    ("efficiency", 408, 438),
]

# Aynı sayfaların ikinci yarısı motor ağırlığı ile varsayılan fren tipini ve
# fren momentini taşır. Tablo bir sonraki sayfaya devam edebilir; eşleme bu
# yüzden (model, güç) anahtarıyladır.
WEIGHT_BANDS = [
    ("model", 50, 115),
    ("power", 115, 145),
    ("weight", 220, 260),
    ("brake", 315, 355),
    ("brake_torque", 395, 435),
]

# 1 tabanlı fiziksel sayfalar. İlk yaprakta B3 ayaklı yapı ve mil ucu ölçüsü
# vardır; onu izleyen yapraklar fiş/enkoder/fren seçenekleridir ve standart
# çıplak motorun ölçü föyü olarak kullanılmaz.
DIMENSION_PAGE_BY_FRAME = {
    "71S": 203,
    "71M": 207,
    "80S": 211,
    "80M": 215,
    "90M": 219,
    "90L": 223,
    "100M": 227,
    "100L": 231,
    "100LC": 235,
    "112M": 239,
    "132S": 243,
    "132M": 247,
    "132MC": 251,
    "160S": 255,
    "160M": 259,
    "160MC": 259,
    "180S": 263,
    "180M": 267,
    "180L": 271,
    "180LC": 275,
    "200L": 279,
    "225S": 283,
    "225M": 287,
    "225MC": 291,
    "250M": 295,
    "280S": 295,
    "280M": 296,
    "315K": 299,
    "315S": 299,
    "315M": 301,
    "315L": 301,
}

# Ölçü föyünde standart IEC kasa çapından ayrılan büyük 4 kutuplu DRP
# motorlar. Komşu DRS/DRE satırlarının çapları bu değerlere kopyalanmaz.
CATALOG_SHAFT_OVERRIDES = {
    "DRP250M4": 60.0,  # s.295
    "DRP280S4": 65.0,  # s.295
    "DRP315K4": 70.0,  # s.299
    "DRP315S4": 70.0,  # s.299
}


def _clean(text) -> str:
    return "".join(str(text or "").split())


def _model(cells) -> tuple[str, re.Match[str]] | None:
    value = _clean(cells.get("model"))
    match = MODEL_RE.match(value)
    return (value, match) if match else None


def _performance_rows(page, pnum):
    rows, missing = [], []
    for yc, words in mc.rows_by_y(mc.words(page), tol=2.0):
        cells = mc.banded_cells(words, PERFORMANCE_BANDS)
        found = _model(cells)
        if not found:
            continue
        model, match = found
        efficiency_class = _clean(cells.get("efficiency_class"))
        parsed = {
            "power_kw": mc.num(cells.get("power")),
            "torque_nm": mc.num(cells.get("torque")),
            "speed_rpm": mc.num(cells.get("speed")),
            "current_a": mc.num(cells.get("current")),
            "power_factor": mc.num(cells.get("power_factor")),
            "efficiency_pct": mc.num(cells.get("efficiency")),
        }

        # Aynı x bantlarında bulunan ağırlık tablosu satırları model desenine
        # uyar; ancak orada IE ve verim hücreleri yoktur. Sessizce atlanır.
        if not efficiency_class.startswith("IE"):
            continue
        if any(value is None for value in parsed.values()):
            missing.append(("missing_performance", pnum, round(yc, 1), model, cells))
            continue

        frame = int(match.group("frame"))
        suffix = match.group("suffix")
        poles = int(match.group("poles"))
        frame_size = f"{frame}{suffix}"
        dimension_page = DIMENSION_PAGE_BY_FRAME.get(frame_size)
        shaft = CATALOG_SHAFT_OVERRIDES.get(
            model, mc.iec_shaft_mm(frame, poles)
        )
        if dimension_page is None or shaft is None:
            missing.append((
                "missing_dimension",
                pnum,
                model,
                frame_size,
                dimension_page,
                shaft,
            ))
            continue

        rows.append({
            "power_kw": parsed["power_kw"],
            "poles": poles,
            "speed_rpm": int(parsed["speed_rpm"]),
            "torque_nm": parsed["torque_nm"],
            "frame_size": frame_size,
            "efficiency_pct": parsed["efficiency_pct"],
            "shaft_diameter_mm": shaft,
            "current_a": parsed["current_a"],
            "power_factor": parsed["power_factor"],
            "series": f"{match.group('series')} ({efficiency_class})",
            "model": model,
            "efficiency_class": efficiency_class,
            "shaft_source": f"katalog ölçü föyü (s.{dimension_page})",
            "technical_page": pnum,
            "dimension_page": dimension_page,
            "_frame": frame,
        })
    return rows, missing


def _weight_rows(page):
    rows = {}
    for _yc, words in mc.rows_by_y(mc.words(page), tol=2.0):
        cells = mc.banded_cells(words, WEIGHT_BANDS)
        found = _model(cells)
        if not found:
            continue
        model, _match = found
        power = mc.num(cells.get("power"))
        weight = mc.num(cells.get("weight"))
        brake = _clean(cells.get("brake"))
        if power is None or weight is None or not re.match(r"^(?:BE|BR|BMG)\d", brake):
            continue
        row = {"weight_kg": weight, "brake_type": brake}
        brake_torque = mc.num(cells.get("brake_torque"))
        if brake_torque is not None:
            row["brake_torque_nm"] = brake_torque
        rows[(model, power)] = row
    return rows


def dedupe(items):
    """Aynı güç/kutup için seçicide tek ve en verimli katalog tipini bırakır."""
    def rank(item):
        return (
            CLASS_RANK[item["efficiency_class"]],
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
        candidates = sorted(groups[key], key=lambda pair: (rank(pair[1]), pair[0]))
        keep.append(candidates[0])
        dropped.extend(item for _, item in candidates[1:])

    keep.sort(key=lambda pair: pair[0])
    out = []
    for _, item in keep:
        item.pop("_frame", None)
        out.append(item)
    for item in dropped:
        item.pop("_frame", None)
    return out, dropped


def extract():
    doc = fitz.open(mc.PDF["sew"])
    raw_items, missing, pages_used = [], [], []
    weights = {}
    for pnum in PERF_PAGES:
        page_items, page_missing = _performance_rows(doc[pnum - 1], pnum)
        raw_items.extend(page_items)
        missing.extend(page_missing)
        weights.update(_weight_rows(doc[pnum - 1]))
        pages_used.append((pnum, len(page_items)))
    doc.close()

    for item in raw_items:
        extra = weights.get((item["model"], item["power_kw"]))
        if extra:
            item.update(extra)
        else:
            missing.append((
                "missing_weight",
                item["technical_page"],
                item["model"],
                item["power_kw"],
            ))

    items, dropped = dedupe(raw_items)
    return items, pages_used, missing, dropped


META = {
    "brand": "SEW-EURODRIVE",
    "equipment_type": "motor",
    "series": "DRS (IE1) / DRE (IE2) / DRP (IE3)",
    "source_pdf": "SEW_AC motor.pdf",
    "source_doc": (
        "SEW-EURODRIVE Catalog AC Motors DR.71 - 315, DT56, DR63, "
        "19290411/EN 10/2014"
    ),
    "extraction_date": "2026-08-29",
    "page_range": (
        "Standart 400 V / 50 Hz / S1 teknik tablolar s.96-108; "
        "DR.. motor ölçü föyleri s.203-301"
    ),
    "notes": (
        "Yalnız standart üç fazlı AC motorlar alınmıştır. DRS IE1, DRE IE2 "
        "ve DRP IE3 aileleri; 400 V, 50 Hz, S1; 2/4/6 kutup. Verim değeri "
        "yayımlanmayan DT56/DR63, pole-changing, tork/servo motorlar ile "
        "MOVI-SWITCH/MOVIMOT aileleri alınmadı. Aynı (güç, kutup) çifti için "
        "en yüksek IE sınıfı, eşitlikte küçük gövde ve hafif motor seçildi. "
        "technical_page ürünün performans tablosunu; dimension_page o tipin "
        "B3 ayaklı ölçü çizimini gösterir. Mil çapları ölçü föyünden gelir; "
        "DRP250M4, DRP280S4 ve DRP315K/S4'ün katalogdaki özel çapları model "
        "bazında korunmuştur."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "sew_ac.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, missing, dropped, path = build()
    print("SEW-EURODRIVE satır:", n, "->", path)
    for page, count in pages:
        print(f"  s.{page} · {count} ham performans satırı")
    print("tekrar eden (güç,kutup) için elenen satır:", len(dropped))
    if missing:
        print("okunamayan/eksik satır:", len(missing))
        for row in missing[:30]:
            print("   ", row)
