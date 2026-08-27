# -*- coding: utf-8 -*-
"""ELK üç fazlı standart asenkron motor kataloğu çıkarımı.

Kaynak: ``elk-motor-katalog-tr.pdf`` (108 fiziksel sayfa).

Standart ürün teknik tabloları s.30 (IE2), s.32-34 (IE3) ve s.37-39
(IE4)'tür. s.35'teki kompakt seri, tek fazlı ve ex-proof motorlar standart
vinç motoru seçicisine karıştırılmaz. B3 ayaklı motor boyutları s.41'den
okunur. PDF'in boyut tablosu özel bir fontla kodlandığı için 0-9 rakamları
metin katmanında U+03EC..U+03F5 benzeri karakterler olarak çıkar; yalnız bu
sayfada görülen birebir glif dönüşümü uygulanır.
"""
import re

import fitz

import motors_common as mc


PERF_PAGES = (30, 32, 33, 34, 37, 38, 39)
DIMENSION_PAGE = 41

# 3EL063M2A / 3EG315L2F / 4EL132M4F*
MODEL_RE = re.compile(
    r"^(?P<eff>[234])E(?P<family>[LG])(?P<frame>\d{3})"
    r"(?P<letter>[A-Z]+?)(?P<poles>[2468])(?P<step>[A-Z])\*?$"
)
CLASS_RANK = {"IE4": 0, "IE3": 1, "IE2": 2}

# Bu üç hücre, katalogun özel fontunda metin katmanına kontrol karakteri
# olarak gömülmüştür. Değerler s.33-34'ün 300 dpi görselinden birebir
# okunmuştur; bağıntıyla tahmin edilmemiştir.
PRINTED_CELL_OVERRIDES = {
    "3EL090L4D": {"speed_rpm": 1445.0, "torque_nm": 9.91},
    "3EL100L4C": {"torque_nm": 14.5},
    "3EL100L6B": {"speed_rpm": 955.0},
}

# ELK s.41 boyut tablosunun gömülü fontundaki rakam glifleri.
ELK_DIGITS = str.maketrans({
    "Ϭ": "0", "ϭ": "1", "Ϯ": "2", "ϯ": "3", "ϰ": "4",
    "ϱ": "5", "ϲ": "6", "ϳ": "7", "ϴ": "8", "ϵ": "9",
    "Ͳ": "-", "͕": ",",
})
DIM_BANDS = [
    ("frame", 43, 70),
    ("poles", 101, 130),
    ("shaft", 130, 151),
]


def _clean(text):
    return "".join(str(text or "").split())


def _elk_text(text):
    return _clean(text).translate(ELK_DIGITS)


def shaft_table(doc):
    """{(gövde, kutup): D mil çapı} — s.41 B3 ayaklı yapı tablosu."""
    page = doc[DIMENSION_PAGE - 1]
    out = {}
    last_frame = None
    for yc, row_words in mc.rows_by_y(mc.words(page), tol=1.5):
        if yc < 290:
            continue
        cells = mc.banded_cells(row_words, DIM_BANDS)
        frame_text = _elk_text(cells.get("frame"))
        frame_match = re.search(r"(\d{3})", frame_text)
        if frame_match:
            last_frame = int(frame_match.group(1))
        pole_text = _elk_text(cells.get("poles"))
        shaft = mc.num(_elk_text(cells.get("shaft")))
        if last_frame is None or shaft is None or not re.search(r"[2468]", pole_text):
            continue
        poles = [int(value) for value in re.findall(r"[2468]", pole_text)]
        for pole in poles:
            out[(last_frame, pole)] = shaft
    return out


def _table_rows(page, pnum, shafts):
    rows, missing = [], []
    for table in page.find_tables(strategy="lines").tables:
        for raw in table.extract():
            cells = [_clean(cell) for cell in raw]
            model_idx = next(
                (index for index, cell in enumerate(cells) if MODEL_RE.match(cell)),
                None,
            )
            if model_idx is None:
                continue
            model_with_note = cells[model_idx]
            match = MODEL_RE.match(model_with_note)
            model = model_with_note.rstrip("*")
            values = cells[model_idx + 1:]
            if len(values) < 14:
                missing.append(("short_row", pnum, model, raw))
                continue
            parsed = {
                "power_kw": mc.num(values[0]),
                "speed_rpm": mc.num(values[1]),
                "current_a": mc.num(values[2]),
                "torque_nm": mc.num(values[3]),
                "power_factor": mc.num(values[4]),
                "efficiency_pct": mc.num(values[5]),
                "weight_kg": mc.num(values[12]),
            }
            parsed.update(PRINTED_CELL_OVERRIDES.get(model, {}))
            if any(value is None for value in parsed.values()):
                missing.append(("missing", pnum, model, values))
                continue
            frame = int(match.group("frame"))
            poles = int(match.group("poles"))
            shaft = shafts.get((frame, poles))
            if shaft is None:
                missing.append(("missing_shaft", pnum, model, frame, poles))
                continue
            material = ("Alüminyum gövde" if match.group("family") == "L"
                        else "Pik (dökme) gövde")
            rows.append({
                "power_kw": parsed["power_kw"],
                "poles": poles,
                "speed_rpm": int(parsed["speed_rpm"]),
                "torque_nm": parsed["torque_nm"],
                "frame_size": f"{frame}{match.group('letter')}",
                "efficiency_pct": parsed["efficiency_pct"],
                "weight_kg": parsed["weight_kg"],
                "shaft_diameter_mm": shaft,
                "current_a": parsed["current_a"],
                "power_factor": parsed["power_factor"],
                "series": material,
                "ip_class": "IP55",
                "model": model,
                "efficiency_class": f"IE{match.group('eff')}",
                "shaft_source": f"katalog (s.{DIMENSION_PAGE})",
                "technical_page": pnum,
                "dimension_page": DIMENSION_PAGE,
                "_frame": frame,
                "_material": material,
            })
    return rows, missing


def dedupe(items):
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
    doc = fitz.open(mc.PDF["elk"])
    shafts = shaft_table(doc)
    items, missing, pages_used = [], [], []
    for pnum in PERF_PAGES:
        page_items, page_missing = _table_rows(doc[pnum - 1], pnum, shafts)
        items.extend(page_items)
        missing.extend(page_missing)
        pages_used.append((pnum, len(page_items)))
    doc.close()
    items, dropped = dedupe(items)
    return items, pages_used, missing, dropped


META = {
    "brand": "ELK",
    "equipment_type": "motor",
    "series": "Üç fazlı standart asenkron motorlar (IE2 / IE3 / IE4)",
    "source_pdf": "elk-motor-katalog-tr.pdf",
    "source_doc": "ELK Motor Türkçe Katalog",
    "extraction_date": "2026-08-27",
    "page_range": (
        "Teknik tablolar s.30 (IE2), s.32-34 (IE3), s.37-39 (IE4); "
        "B3 Ayaklı Yapı MOTOR BOYUTLARI s.41"
    ),
    "notes": (
        "Yalnız standart 3 fazlı AC motorlar: 400 V, 50 Hz, S1 sürekli çalışma, "
        "IP55. Kompakt, monofaze ve ex-proof seriler alınmadı. Aynı "
        "(güç, kutup) çifti için en yüksek IE sınıfı, eşitlikte pik gövde, "
        "sonra küçük gövde ve hafif motor seçildi. technical_page ürünün teknik "
        "tablosunu, dimension_page aynı ürünün s.41 B3 Ayaklı Yapı boyut "
        "yaprağını gösterir. shaft_diameter_mm bu yapraktaki D ölçüsüdür."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "elk.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, missing, dropped, path = build()
    print("ELK satır:", n, "->", path)
    for page, count in pages:
        print(f"  s.{page} · {count} ham satır")
    print("tekrar eden (güç,kutup) için elenen satır:", len(dropped))
    if missing:
        print("okunamayan satır:", len(missing))
        for row in missing[:20]:
            print("   ", row)
