# -*- coding: utf-8 -*-
"""YILMAZ K serisi ve Planet serisi redüktörler — motorsuz (gear unit) tablolar.

İki kaynak, iki tablo biçimi:

  `YILMAZ KR KATALOG.pdf`   — K serisi helisel-konik. Tablo biçimi mevcut
      D/M/H kataloglarıyla AYNIdır (Ma [Nm] · i · n2 · Pe · Fqam · Fqem ·
      ağırlık · ölçü sayfası), bu yüzden `extract.parse_gear_unit_page`
      olduğu gibi kullanılır — ikinci bir okuyucu yazılmaz.

  `YILMAZ R PL PLANET REDÜKTÖRLER.pdf` — planet redüktörler. Tablo biçimi
      FARKLIdır: anma momenti ÖMÜRE BAĞLI dört sütun hâlinde (10000 / 5000 /
      2000 / 1000 saat) ve kNm cinsinden basılır, ayrıca maksimum moment ve
      verim sütunları vardır. Üç alt aile ayrı bölümlerde yayımlanır:
      düz planet · konik girişli · sonsuz eklemeli.

ÖMÜR SEÇİMİ: `output_torque_Nm` 10000 saatlik anma momentidir — vinç
uygulamasının kabulü budur ve dört sütunun EN DÜŞÜĞÜdür. Diğer üç ömür
`output_torque_Nm_<saat>h` alanlarında saklanır; hiçbiri atılmaz.

KULLANIM GRUBU: iki katalog da vinci uygulama alanı olarak sayar (K serisi
s.16 "Cranes"; planet kataloğunun kendi seçim örneği s.29 "4 donanımlı 12,5
tonluk vinç kaldırma redüktörü"). Hangisinin kaldırma hangisinin yürütme
olduğunu katalog SÖYLEMEZ, bu yüzden ikisi de her iki gruba yazılır —
FLENDER MD 20.1'de olduğu gibi seed satırı kullanım grubu başına açar.
"""
from __future__ import annotations

import re
import sys

import extract
import grid
import pdftable as pt
import reducers_common as rd

KR_PDF = "YILMAZ KR KATALOG.pdf"
PL_PDF = "YILMAZ R PL PLANET REDÜKTÖRLER.pdf"

# K serisi motorsuz güç–devir tabloları (basılı s.459 → PDF indisi 458)
KR_PAGES = range(458, 469)

APPLICATIONS = ["kaldirma", "yurutme"]

# Planet: (bölüm başlığı, PDF indis aralığı, alt aile kodu, seri adı)
PL_SECTIONS = [
    ("Motorsuz Planet Redüktörler", range(289, 403), "planet", "P"),
    ("Motorsuz Konik Girişli Planet Redüktörler", range(405, 475), "konik", "PK"),
    ("Motorsuz Sonsuz Eklemeli Planet Redüktörler", range(531, 541), "sonsuz", "PS"),
]

PL_MODEL_RE = re.compile(r"^[A-Z]{2}\d{4}[A-Z]?(?:-[A-Z0-9]+)?$")
LIFETIMES = [10000, 5000, 2000, 1000]


# --------------------------------------------------------------- K serisi

def build_kr():
    doc = pt.open_src(KR_PDF)
    rows = []
    for i in KR_PAGES:
        rows += extract.parse_gear_unit_page(doc[i])
    doc.close()
    if not rows:
        sys.exit("YILMAZ K: satır okunamadı")

    items = []
    for it in rows:
        model = it["model"]
        digits = re.sub(r"^[A-Z]+", "", model)
        for app in APPLICATIONS:
            row = dict(it)
            row["series"] = "K"
            row["application"] = app
            row["frame_size"] = digits[:2]
            row["stages"] = int(digits[-1]) if digits[-1].isdigit() else None
            items.append(row)

    rd.write("yilmaz_k.json", {
        "brand": "Yılmaz Redüktör",
        "equipment_type": "reducer",
        "series": "K",
        "source_pdf": KR_PDF,
        "source_doc": "Yılmaz Redüktör K0905-0422",
        "extraction_date": "2026-08-09",
        "page_range": "basılı s.459-469 (PDF indisi 458-468) — Motorsuz Güç Devir "
                      "Tabloları / Gear Units Performance Tables",
        "notes": (
            "K serisi helisel-konik redüktör, motorsuz tablolar. Anma momenti Ma "
            "n1 = 1450 d/dak içindir; diğer giriş devirlerinin nominal güçleri "
            "nominal_power_kw_n1_* alanlarındadır. Radyal yükler katalogda N "
            "basılıdır. Kademe sayısı model kodunun SON basamağıdır (KT002 → 2 "
            "kademe), gövde büyüklüğü ilk iki basamaktır. "
            "KULLANIM GRUBU: katalog vinci uygulama alanı olarak sayar (s.16 "
            "'Cranes') ama kaldırma/yürütme ayrımı yapmaz; her satır iki grup "
            "için de yazılmıştır."),
    }, items)
    return items


# ------------------------------------------------------------ Planet serisi

def _pl_header(page):
    """Sütun indislerini başlık etiketlerinden çözer: {alan: sütun}."""
    vx, hy = grid.rules(page)
    if len(vx) < 8:
        return None, None, None
    ws = grid.words(page)
    fields: dict = {}
    life_cols: list = []
    head_bottom = None
    for yc, rw in grid.rows_of(ws):
        cells = grid.cells(rw, vx)
        for col, txt in cells.items():
            t = txt.strip()
            if t.startswith("Ma [kNm]") or t.startswith("Ma [Nm]"):
                fields.setdefault("_ma_first", col)
            elif t.startswith("Mamak."):
                fields["max_torque"] = col
            elif t == "i":
                fields["ratio"] = col
            elif t.startswith("n2"):
                fields["n2"] = col
            elif t.startswith("PN") or t == "[kW]":
                fields.setdefault("power", col)
            elif t == "η":
                fields["efficiency"] = col
            elif t.startswith("Fqam"):
                fields["fqam"] = col
            elif t.startswith("Fqem"):
                fields["fqem"] = col
            elif t == "[kg]":
                fields["weight"] = col
            elif t in ("Sayfası", "Page", "Seite"):
                fields.setdefault("dim_page", col)
            elif re.fullmatch(r"(10000|5000|2000|1000)( \[h\])?", t):
                life_cols.append((col, int(t.split()[0])))
        if any(re.fullmatch(r"(10000|5000|2000|1000)( \[h\])?", v.strip())
               for v in cells.values()):
            head_bottom = yc
    if head_bottom is None or "ratio" not in fields:
        return None, None, None
    # Ömür sütunları: anma momenti bloğunun altındaki 10000/5000/2000/1000
    # başlıkları. Fqam/Fqem'in altındaki "10000 [h]" bunlara KARIŞMAMALI.
    life = [(c, h) for c, h in sorted(set(life_cols))
            if c < fields.get("fqam", 99) and c != fields.get("power")]
    body_top = min((h for h in hy if h > head_bottom + 1), default=None)
    return fields, life, body_top


def _pl_blocks(page, body_top):
    vx, hy = grid.rules(page)
    seps = [h for h in hy if h >= body_top - 0.5]
    ws = [w for w in grid.words(page) if w[1] > body_top - 1]
    rows = grid.rows_of(ws)
    out = []
    for lo, hi in zip(seps, seps[1:]):
        blk = [(yc, rw) for yc, rw in rows if lo < yc < hi]
        if blk:
            out.append(blk)
    return out, vx


def _pl_page(page, n1, family, series):
    fields, life, body_top = _pl_header(page)
    if not fields or body_top is None:
        return []
    blocks, vx = _pl_blocks(page, body_top)
    items = []
    for blk in blocks:
        models, rows = [], []
        for _, rw in blk:
            c = grid.cells(rw, vx)
            name = c.get(0, "").strip()
            if PL_MODEL_RE.match(name):
                models.append(name)
            ratio = grid.num(c.get(fields["ratio"]))
            if ratio is None:
                continue
            torques = {h: grid.num(c.get(col)) for col, h in life}
            if not life:  # sonsuz eklemeli ailede tek anma momenti sütunu var
                torques = {10000: grid.num(c.get(fields.get("_ma_first")))}
            rows.append({
                "ratio": ratio,
                "torques": torques,
                "output_speed_rpm": grid.num(c.get(fields.get("n2", -1))),
                "nominal_power_kw": grid.num(c.get(fields.get("power", -1))),
                "efficiency": grid.num(c.get(fields.get("efficiency", -1))),
                "max_torque_Nm": _kn(grid.num(c.get(fields.get("max_torque", -1)))),
                "permitted_radial_load_output_N": _kn(
                    grid.num(c.get(fields.get("fqam", -1)))),
                "permitted_radial_load_input_N": _kn(
                    grid.num(c.get(fields.get("fqem", -1)))),
                "weight_kg": grid.num(c.get(fields.get("weight", -1))),
                "dimension_page": grid.num(c.get(fields.get("dim_page", -1))),
            })
        for model in models:
            for r in rows:
                base = {k: v for k, v in r.items() if k != "torques"}
                base["output_torque_Nm"] = _kn(r["torques"].get(10000))
                for h in LIFETIMES[1:]:
                    val = _kn(r["torques"].get(h))
                    if val is not None:
                        base[f"output_torque_Nm_{h}h"] = val
                if base["output_torque_Nm"] is None:
                    continue
                dp = base.pop("dimension_page", None)
                items.append({
                    **base,
                    "model": model,
                    "series": series,
                    "input_speed_rpm": n1,
                    "planet_family": family,
                    "dimension_page": int(dp) if dp else None,
                })
    return items


def _kn(v):
    """kNm / kN → Nm / N."""
    return None if v is None else round(v * 1000, 1)


def build_pl():
    doc = pt.open_src(PL_PDF)
    items = []
    for title, pages, family, series in PL_SECTIONS:
        for i in pages:
            page = doc[i]
            txt = page.get_text()
            if title not in txt:
                continue
            m = re.search(r"n1=(\d+)", txt)
            if not m:
                continue
            items += _pl_page(page, int(m.group(1)), family, series)
    doc.close()
    if not items:
        sys.exit("YILMAZ Planet: satır okunamadı")

    out = []
    for it in items:
        digits = re.sub(r"^[A-Z]+", "", it["model"]).split("-")[0]
        for app in APPLICATIONS:
            row = dict(it)
            row["application"] = app
            row["frame_size"] = digits[:2]
            row["stages"] = int(digits[3]) if len(digits) > 3 and digits[3].isdigit() else None
            out.append(row)

    rd.write("yilmaz_planet.json", {
        "brand": "Yılmaz Redüktör",
        "equipment_type": "reducer",
        "series": "P (planet)",
        "source_pdf": PL_PDF,
        "source_doc": "Yılmaz Redüktör P0600-0626",
        "extraction_date": "2026-08-09",
        "page_range": "Motorsuz Planet Redüktörler (PDF indisi 289-402) · Konik "
                      "Girişli (405-474) · Sonsuz Eklemeli (531-540); her bölüm "
                      "n1 = 1450/950/725/475/360 için ayrı bloklar",
        "notes": (
            "Planet redüktör, motorsuz tablolar. ANMA MOMENTİ ÖMÜRE BAĞLIDIR: "
            "katalog 10000/5000/2000/1000 saat için ayrı Ma basar. "
            "output_torque_Nm = 10000 saat (en düşük, vinç kabulü); diğerleri "
            "output_torque_Nm_<saat>h alanlarındadır. max_torque_Nm = Mamak. "
            "Momentler ve radyal yükler katalogda kNm/kN basılıdır, burada "
            "Nm/N'a çevrilmiştir. planet_family alt aileyi ayırır: planet (düz) "
            "· konik (konik dişli girişli) · sonsuz (sonsuz vida eklemeli). "
            "Ağırlık ve ölçü sayfası yalnız sonsuz eklemeli ailede basılıdır. "
            "KULLANIM GRUBU: katalogun kendi seçim örneği bir vinç KALDIRMA "
            "redüktörüdür (s.29) ama tablo kaldırma/yürütme ayrımı yapmaz; "
            "her satır iki grup için de yazılmıştır."),
    }, out)
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build_kr()
    build_pl()
