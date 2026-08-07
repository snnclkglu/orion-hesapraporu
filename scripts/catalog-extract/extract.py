# -*- coding: utf-8 -*-
"""YILMAZ redüktör kataloglarından güç/devir tablolarını çıkarır.

Kaynak seçimi: motorsuz (gear unit) tabloları kullanılır. Uygulama redüktör ile
motoru AYRI seçtiği için, motorlu (geared motor) tablolarındaki satırlar bir
motoru zorunlu kılar ve modele uymaz. Motorsuz tablolar redüktörün kendi anma
momentini (Ma), izin verilen radyal yüklerini (Fqam/Fqem) ve ağırlığını verir.

Çıktı: catalog_data/reducers/yilmaz_{dr,m,h}.json
"""
import io
import json
import os
import re
import sys

import fitz

import grid

BASE = r"C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD"
OUT_DIR = os.path.join(BASE, "catalog_data", "reducers")

MODEL_RE = re.compile(r"^[A-Z]{2}\d{3,4}$")
CODE_RE = re.compile(r"^[A-Z]\d$")          # E3, R1 gibi soğutma/yağlama kodları


# --------------------------------------------------------------- ortak yardımcı

def header_map(page, vx, hy):
    """Başlık etiketlerini sütun indisine bağlar.

    Döndürür: (alan → sütun indisi, gövdenin başladığı y).
    """
    # "Ma [Nm]" etiketinin bulunduğu satır başlığın SON satırıdır.
    ws = grid.words(page)
    ma_y = None
    for yc, rw in grid.rows_of(ws):
        txt = " ".join(w[4] for w in rw)
        if "Ma" in txt and "[Nm]" in txt:
            ma_y = yc
            break
    if ma_y is None:
        return None, None
    body_top = min((h for h in hy if h > ma_y + 1), default=None)
    if body_top is None:
        return None, None

    fields = {}
    head_ws = [w for w in ws if w[1] < body_top]
    for yc, rw in grid.rows_of(head_ws):
        cells = grid.cells(rw, vx)
        for col, txt in cells.items():
            t = txt.strip()
            if t.startswith("Ma") and "[Nm]" in t:
                fields["torque_nm"] = col
            elif t == "i":
                fields["ratio"] = col
            elif t.startswith("n2"):
                fields["n2"] = col
            elif t.startswith("n1 ["):
                fields["n1"] = col
            elif t.startswith("Pn"):
                fields["power_kw"] = col
            elif t.startswith("Fqam"):
                fields["fqam"] = col
                fields["_fqam_unit"] = "kN" if "[kN]" in t else "N"
            elif t.startswith("Fqem"):
                fields["fqem"] = col
                fields["_fqem_unit"] = "kN" if "[kN]" in t else "N"
            elif t == "[kg]":
                fields["weight_kg"] = col
            elif t in ("Tipi", "Type", "Typ"):
                fields.setdefault("model", col)
            elif re.fullmatch(r"n1=(\d+)", t):
                fields[f"pe_{re.fullmatch(r'n1=(\d+)', t).group(1)}"] = col
            elif t in ("Sayfası", "Page", "Seite"):
                fields.setdefault("dim_page", col)
    return fields, body_top


def blocks_of(page, vx, hy, body_top):
    """Gövdeyi yatay çizgilere göre model bloklarına böler."""
    seps = [h for h in hy if h >= body_top - 0.5]
    ws = [w for w in grid.words(page) if w[1] > body_top - 1]
    rows = grid.rows_of(ws)
    out = []
    for i in range(len(seps) - 1):
        lo, hi = seps[i], seps[i + 1]
        blk = [(yc, rw) for yc, rw in rows if lo < yc < hi]
        if blk:
            out.append(blk)
    return out


def to_newtons(v, unit):
    if v is None:
        return None
    return v * 1000.0 if unit == "kN" else v


# ------------------------------------------------- motorsuz tablolar (DR ve M)

def parse_gear_unit_page(page):
    vx, hy = grid.rules(page)
    if len(vx) < 8:
        return []
    fields, body_top = header_map(page, vx, hy)
    if not fields or "ratio" not in fields or "model" not in fields:
        return []

    pe_cols = {int(k[3:]): c for k, c in fields.items() if k.startswith("pe_")}
    ref_n1 = 1450 if 1450 in pe_cols else (max(pe_cols) if pe_cols else None)
    items = []

    for blk in blocks_of(page, vx, hy, body_top):
        models, weights = [], []
        dim_page = None
        rows = []
        for yc, rw in blk:
            c = grid.cells(rw, vx)
            m = c.get(fields["model"], "").strip()
            if MODEL_RE.match(m):
                models.append(m)
            w = grid.num(c.get(fields.get("weight_kg", -1)))
            if w is not None:
                weights.append(w)
            dp = grid.num(c.get(fields.get("dim_page", -1)))
            if dp is not None and dim_page is None:
                dim_page = int(dp)
            ratio = grid.num(c.get(fields["ratio"]))
            if ratio is None:
                continue
            rows.append({
                "ratio": ratio,
                "output_torque_Nm": grid.num(c.get(fields.get("torque_nm", -1))),
                "output_speed_rpm": grid.num(c.get(fields.get("n2", -1))),
                "permitted_radial_load_output_N": to_newtons(
                    grid.num(c.get(fields.get("fqam", -1))), fields.get("_fqam_unit", "N")),
                "permitted_radial_load_input_N": to_newtons(
                    grid.num(c.get(fields.get("fqem", -1))), fields.get("_fqem_unit", "N")),
                "_pe": {n1: grid.num(c.get(col)) for n1, col in pe_cols.items()},
            })
        if not models or not rows:
            continue
        for idx, model in enumerate(models):
            wkg = weights[idx] if idx < len(weights) else None
            for r in rows:
                it = {k: v for k, v in r.items() if not k.startswith("_")}
                it["model"] = model
                it["input_speed_rpm"] = ref_n1
                it["nominal_power_kw"] = r["_pe"].get(ref_n1)
                for n1, val in sorted(r["_pe"].items()):
                    if n1 != ref_n1 and val is not None:
                        it[f"nominal_power_kw_n1_{n1}"] = val
                it["weight_kg"] = wkg
                it["dimension_page"] = dim_page
                items.append(it)
    return items


# ---------------------------------------------------- H/B serisi perf tabloları

def parse_h_right_page(page):
    """H/B yayımının SAĞ sayfası: blok başına ağırlık ve ölçü sayfası.

    Sol sayfa kimliği (model, tork, devir) taşır; ağırlık ile ölçü sayfası
    yalnız sağ sayfada basılıdır. Bloklar ilk çevrim oranına göre eşlenir.
    """
    vx, hy = grid.rules(page)
    if len(vx) < 8:
        return []
    ws = grid.words(page)
    # başlık: "i" ve "[kg]" aynı satırda; gövde onun altındaki ilk yatay çizgi
    head_y = None
    for yc, rw in grid.rows_of(ws):
        cells = grid.cells(rw, vx)
        vals = [v.strip() for v in cells.values()]
        if "i" in vals and "[kg]" in vals:
            head_y = yc
            cols = {v.strip(): k for k, v in cells.items()}
            break
    if head_y is None:
        return []
    body_top = min((h for h in hy if h > head_y + 1), default=None)
    if body_top is None:
        return []
    ratio_col, weight_col = cols.get("i"), cols.get("[kg]")
    # ölçü sayfası: ağırlıktan hemen sonraki sütun (başlık "Maße/Seite" ayrık basılı)
    dim_col = min((c for c in cols.values() if c > weight_col), default=None)
    if dim_col is None:
        dim_col = weight_col + 1

    out = []
    for blk in blocks_of(page, vx, hy, body_top):
        first_ratio, weight, dim_page = None, None, None
        for yc, rw in blk:
            c = grid.cells(rw, vx)
            r = grid.num(c.get(ratio_col))
            if r is not None and first_ratio is None:
                first_ratio = r
            w = grid.num(c.get(weight_col))
            if w is not None and weight is None:
                weight = w
            dp = grid.num(c.get(dim_col))
            if dp is not None and dim_page is None:
                dim_page = int(dp)
        if first_ratio is not None:
            out.append({"ratio0": first_ratio, "weight_kg": weight, "dimension_page": dim_page})
    return out


def parse_h_page(page):
    vx, hy = grid.rules(page)
    if len(vx) < 8:
        return []
    fields, body_top = header_map(page, vx, hy)
    if not fields or "ratio" not in fields or "n1" not in fields:
        return []

    # Termik güç sütunları: "-" yer tutucusu satırların ~%24'ünde hiç
    # basılmadığından soldan sağa sıra GÜVENİLMEZ; Pt1..Pt6 başlıklarının x
    # merkezleri çapa alınıp değerler konuma göre eşlenir.
    anchors = {}
    for w in grid.words(page):
        if re.fullmatch(r"Pt[1-6]", w[4]):
            anchors[int(w[4][2])] = (w[0] + w[2]) / 2
    items = []

    for blk in blocks_of(page, vx, hy, body_top):
        model = None
        n1 = None
        rows = []
        for yc, rw in blk:
            c = grid.cells(rw, vx)
            for col, txt in c.items():
                if MODEL_RE.match(txt.strip()) and model is None:
                    model = txt.strip()
            v = grid.num(c.get(fields["n1"]))
            if v is not None and n1 is None:
                n1 = v
            ratio = grid.num(c.get(fields["ratio"]))
            if ratio is None:
                continue
            pt = {}
            for i, ax in anchors.items():
                best = None
                for w in rw:
                    dx = abs((w[0] + w[2]) / 2 - ax)
                    if dx <= 14 and not CODE_RE.match(w[4]) and grid.num(w[4]) is not None:
                        if best is None or dx < best[0]:
                            best = (dx, grid.num(w[4]))
                if best:
                    pt[i] = best[1]
            rows.append({
                "ratio": ratio,
                "output_torque_Nm": grid.num(c.get(fields.get("torque_nm", -1))),
                "output_speed_rpm": grid.num(c.get(fields.get("n2", -1))),
                "nominal_power_kw": grid.num(c.get(fields.get("power_kw", -1))),
                "permitted_radial_load_output_N": to_newtons(
                    grid.num(c.get(fields.get("fqam", -1))), fields.get("_fqam_unit", "kN")),
                "permitted_radial_load_input_N": to_newtons(
                    grid.num(c.get(fields.get("fqem", -1))), fields.get("_fqem_unit", "kN")),
                "thermal_power_kw": pt.get(1),
                "thermal_power_fan_kw": pt.get(2),
            })
        if not model or n1 is None:
            continue
        for r in rows:
            it = {k: v for k, v in r.items() if not k.startswith("_")}
            it["model"] = model
            it["input_speed_rpm"] = n1
            it["_ratio0"] = rows[0]["ratio"]
            items.append(it)
    return items


def parse_h_spread(doc, left_pageno):
    """Sol + sağ sayfayı birleştirir; ağırlık/ölçü sayfası sağdan gelir."""
    items = parse_h_page(doc[left_pageno - 1])
    if not items:
        return []
    right = parse_h_right_page(doc[left_pageno])
    by_ratio = {r["ratio0"]: r for r in right}
    for it in items:
        extra = by_ratio.get(it.pop("_ratio0"))
        it["weight_kg"] = extra["weight_kg"] if extra else None
        it["dimension_page"] = extra["dimension_page"] if extra else None
    return items


# ------------------------------------------------------------------- çalıştırma

def run(pdf, pages, parser):
    d = fitz.open(os.path.join(BASE, pdf))
    out = []
    for p in pages:
        out += parser(d[p - 1])
    d.close()
    return out


if __name__ == "__main__":
    which = sys.argv[1]
    if which == "m":
        items = run("YILMAZ M KATALOG.pdf", range(320, 332), parse_gear_unit_page)
    elif which == "dr":
        items = run("YILMAZ DR KATALOG.pdf", range(252, 263), parse_gear_unit_page)
    elif which == "h":
        d = fitz.open(os.path.join(BASE, "YILMAZ H KATALOG.pdf"))
        items = []
        for p in list(range(104, 234, 2)) + list(range(416, 506, 2)):
            items += parse_h_spread(d, p)
        d.close()
    else:
        raise SystemExit("m|dr|h")
    print(which, "satir:", len(items))
    models = sorted({i["model"] for i in items})
    print("model:", len(models), models[:20])
    io.open(f"{which}_raw.json", "w", encoding="utf-8").write(
        json.dumps(items, ensure_ascii=False, indent=1))
