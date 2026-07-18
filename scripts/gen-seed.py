# -*- coding: utf-8 -*-
"""KATSAYILAR dökümünden (reference/excel-dump/11_KATSAYILAR.txt) seed SQL üretir.

Kullanım: python scripts/gen-seed.py > supabase/migrations/20260718000003_seed_catalogs.sql
Döküm satır formatı: HÜCRE\tSTATIC\trepr(değer)  veya  HÜCRE\tFORMULA\t=formül\tVALUE=değer
"""
import ast
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")

DUMP = Path(__file__).resolve().parent.parent / "reference" / "excel-dump" / "11_KATSAYILAR.txt"


def load_cells():
    cells = {}
    for line in DUMP.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) < 3 or parts[1] not in ("STATIC", "FORMULA"):
            continue
        cell = parts[0]
        if parts[1] == "STATIC":
            try:
                cells[cell] = ast.literal_eval(parts[2])
            except (ValueError, SyntaxError):
                cells[cell] = parts[2]
        else:
            m = re.search(r"VALUE=(.*)$", line)
            raw = m.group(1) if m else ""
            try:
                cells[cell] = float(raw)
            except ValueError:
                cells[cell] = raw
    return cells


C = load_cells()

COLS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]


def col_range(start, end):
    return COLS[COLS.index(start): COLS.index(end) + 1]


def num(v):
    """SQL sayı literali; '1 000' gibi boşluklu Excel metinlerini de sayıya çevirir."""
    if v is None or v == "-" or v == "":
        return None
    if isinstance(v, str):
        cleaned = v.replace(" ", "").replace(" ", "").replace(",", ".")
        try:
            v = float(cleaned)
        except ValueError:
            return None
    v = float(v)
    return repr(int(v)) if v == int(v) else repr(round(v, 10))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


out = []
out.append("-- KATSAYILAR seed — scripts/gen-seed.py tarafından üretildi, elle düzenlemeyin.")
out.append("")

# --- cat_fem_classes -------------------------------------------------------
rows = []
for class_type, col, r0, r1 in [
    ("structure", "C", 9, 16), ("mechanism", "D", 9, 16), ("usage", "E", 9, 18),
    ("load_b", "F", 9, 14), ("hoist_h", "G", 9, 12),
]:
    for i, r in enumerate(range(r0, r1 + 1)):
        rows.append(f"({q(class_type)}, {q(C[f'{col}{r}'])}, {i})")
out.append("insert into public.cat_fem_classes (class_type, code, sort) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_rope_safety (A23:F30) --------------------------------------------
rows = [f"({q(C[f'A{r}'])}, {num(C[f'C{r}'])}, {num(C[f'F{r}'])})" for r in range(23, 31)]
out.append("\ninsert into public.cat_rope_safety (mech_class, zp_moving, zp_fixed) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_drum_sheave_coeff (A42:I49) --------------------------------------
rows = [f"({q(C[f'A{r}'])}, {num(C[f'C{r}'])}, {num(C[f'F{r}'])}, {num(C[f'I{r}'])})"
        for r in range(42, 50)]
out.append("\ninsert into public.cat_drum_sheave_coeff (mech_class, drum_h, sheave_h, equalizer_h) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_mechanism_life (A55:J64) -----------------------------------------
# T9'un üst sınırı yok (Excel'de 50000 < T); hours_max null olabilmeli.
out.append("\nalter table public.cat_mechanism_life alter column hours_max drop not null;")
rows = []
for r in range(55, 65):
    lo = num(C.get(f"C{r}"))
    hi = num(C.get(f"J{r}"))
    rows.append(f"({q(C[f'A{r}'])}, {lo or 'null'}, {hi or 'null'})")
out.append("\ninsert into public.cat_mechanism_life (usage_class, hours_min, hours_max) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_shaft_materials (E33:J36) ----------------------------------------
rows = []
for col in ["E", "F", "G", "I", "J"]:
    rows.append(f"({q(C[f'{col}33'])}, {num(C[f'{col}34'])}, {num(C[f'{col}35'])}, {num(C[f'{col}36'])})")
out.append("\ninsert into public.cat_shaft_materials (material, bending, shear, combined) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_rails (C68:O70) ---------------------------------------------------
rows = []
for i, col in enumerate(col_range("C", "O")):
    radius = num(C.get(f"{col}69"))
    rows.append(f"({q(C[f'{col}68'])}, {radius or 'null'}, {num(C[f'{col}70'])}, {i})")
out.append("\ninsert into public.cat_rails (code, radius, head_width, sort) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_wheel_c1 (A76:P87, başlık B75:P75) -------------------------------
rows = []
for r in range(76, 88):
    dia = num(C[f"A{r}"])
    for col in col_range("B", "P"):
        c1 = num(C.get(f"{col}{r}"))
        if c1 is not None:
            rows.append(f"({dia}, {num(C[f'{col}75'])}, {c1})")
out.append("\ninsert into public.cat_wheel_c1 (wheel_diameter, speed, c1) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_din15018_fatigue (A93:Q98) ---------------------------------------
BLOCKS = [("St37", col_range("B", "D")), ("St52", col_range("E", "G")),
          ("St37", col_range("H", "L")), ("St52", col_range("M", "Q"))]
rows = []
for r in range(93, 99):
    load_group = C[f"A{r}"]
    for material, cols in BLOCKS:
        for col in cols:
            rows.append(f"({q(material)}, {q(C[f'{col}92'])}, {q(load_group)}, {num(C[f'{col}{r}'])})")
out.append("\ninsert into public.cat_din15018_fatigue (material, notch_class, load_group, value) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_bolt_areas (P24:W26) ---------------------------------------------
rows = [f"({q(C[f'{col}24'])}, {num(C[f'{col}25'])}, {num(C[f'{col}26'])})"
        for col in col_range("P", "W")]
out.append("\ninsert into public.cat_bolt_areas (size, diameter, tensile_area) values\n  "
           + ",\n  ".join(rows) + ";")

# --- cat_couplings ---------------------------------------------------------
# Kaynak Excel'de JAURE TCBR serisinin son 3 boyu mükerrer isimli (TCBR 25/50/75
# adları tekrar ediyor ama dmax/Tnom farklı) — gerçek katalog verisi olduğundan
# hiçbirini atmamak için model bazlı unique kısıtı kaldırılıyor.
out.append("\nalter table public.cat_couplings drop constraint cat_couplings_coupling_type_brand_series_model_key;")
# (tip, marka, seri, boyut satırı, dmax satırı, tnom satırı, radial satırı|None)
BLOCKS = [
    ("drum",  "ÖZGÜN", "J",     126, 127, 128, 129),
    ("drum",  "JAURE", "TCBR",  132, 133, 134, 135),
    ("drum",  "MAINA", "GTS",   138, 139, 140, 141),
    ("drum",  "GOSAN", "AGBS",  144, 145, 146, 147),
    ("brake", "IŞIK",  "B3",    165, 166, 167, None),
    ("brake", "JAURE", "MTFS",  170, 171, 172, None),
    ("brake", "GOSAN", "AGT10", 175, 176, 177, None),
    ("gear",  "ÖZGÜN", "Da",    197, 198, 199, None),
    ("gear",  "ÖZGÜN", "Db",    202, 203, 204, None),
    ("gear",  "ÖZGÜN", "Dc",    207, 208, 209, None),
    ("gear",  "JAURE", "MT",    213, 214, 215, None),
    ("gear",  "JAURE", "MTD",   218, 219, 220, None),
    ("gear",  "JAURE", "MTCL",  223, 224, 225, None),
    ("gear",  "MAINA", "GO-A",  228, 229, 230, None),
    ("gear",  "GOSAN", "AGH10", 233, 234, 235, None),
]
rows = []
for ctype, brand, series, r_model, r_dmax, r_tnom, r_radial in BLOCKS:
    sort = 0
    for col in col_range("D", "Z"):
        model = C.get(f"{col}{r_model}")
        if model is None or model == "":
            continue
        dmax, tnom = num(C.get(f"{col}{r_dmax}")), num(C.get(f"{col}{r_tnom}"))
        if dmax is None or tnom is None:
            continue
        radial = num(C.get(f"{col}{r_radial}")) if r_radial else None
        rows.append(f"({q(ctype)}, {q(brand)}, {q(series)}, {q(model)}, {dmax}, {tnom}, "
                    f"{radial or 'null'}, {sort})")
        sort += 1
out.append("\ninsert into public.cat_couplings (coupling_type, brand, series, model, dmax, t_nominal, radial_load, sort) values\n  "
           + ",\n  ".join(rows) + ";")

print("\n".join(out))
