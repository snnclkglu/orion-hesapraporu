"""Tampon katalog çıkarımı — ortak yardımcılar.

Workspace kökünü (PDF/XLSX'lerin durduğu klasör) ve çıktı klasörünü çözer,
sayı ayrıştırma ve JSON yazımını tek yerde toplar.
"""

from __future__ import annotations

import json
import os
import re

# scripts/catalog-extract → orion-hesapraporu → workspace kökü
HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORKSPACE_ROOT = os.path.abspath(os.path.join(REPO_ROOT, ".."))
OUT_DIR = os.path.join(WORKSPACE_ROOT, "catalog_data", "buffers")

# Kaynak dosyalar (workspace kökünde, repo dışında)
PDF_SIBRE = os.path.join(WORKSPACE_ROOT, "SIBRE Produktkatalog2022_Puffer_SP.pdf")
PDF_CONDUCTIX_PRODUCTS = os.path.join(
    WORKSPACE_ROOT,
    "KAT0170-0002-EN Rubber and Cellular Buffers, Programs 0170_0180.pdf",
)
PDF_CONDUCTIX_CURVES = os.path.join(
    WORKSPACE_ROOT, "KAT0170-0003-EN Load Diagrams Rubber Buffers.pdf"
)
XLSX_FIRMA = os.path.join(WORKSPACE_ROOT, "Tampon Seçimi - Yeni Type S Tipi.xlsx")


def num(text: str | None) -> float | None:
    """'1.234,5' / '12,5' / '470' → float. '-' ve boş → None."""
    if text is None:
        return None
    s = str(text).strip().replace("–", "-").replace("—", "-")
    if s in ("", "-", "–", "=", "*"):
        return None
    # Katalog Alman yazımı kullanıyor: ondalık virgül, binlik nokta yok.
    s = s.replace(" ", "").replace(",", ".")
    m = re.fullmatch(r"[-+]?\d*\.?\d+", s)
    if not m:
        return None
    return float(s)


def clean(v: float | None) -> float | int | None:
    """Tam sayıya oturan float'ları int yapar (JSON'da 100.0 yerine 100)."""
    if v is None:
        return None
    r = round(v, 6)
    return int(r) if r == int(r) else r


def write_json(filename: str, meta: dict, fields: list[str], items: list[dict]) -> str:
    """catalog_data/buffers/<filename> yazar, yolu döndürür."""
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    payload = {"meta": meta, "fields": fields, "items": items}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return path


def read_json(filename: str) -> dict:
    with open(os.path.join(OUT_DIR, filename), encoding="utf-8") as fh:
        return json.load(fh)


def line_count(path: str) -> int:
    with open(path, encoding="utf-8") as fh:
        return sum(1 for _ in fh)
