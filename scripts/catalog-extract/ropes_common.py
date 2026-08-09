# -*- coding: utf-8 -*-
"""Halat kataloglarının ortak şeması, sayfa okuyucusu ve JSON yazıcısı.

Şema `catalog_data/ropes/*.json` dosyalarının hâlihazırdaki biçimidir
(hascelik_6x36 / izmit_6x36); seed betiği bu alanları bekler:

    diameter_mm · core_type · grade_mpa · breaking_load_kN · weight_kg_per_m

`meta.series` halatın KONSTRÜKSİYONUDUR ("6x36 WS", "18x7 LRC", "8xK26 WS"):
seed onu `construction` alanına yazar ve seçicinin ilk süzgeç adımı odur.
Bu yüzden her konstrüksiyon KENDİ DOSYASINDADIR — CASAR kataloğu tek PDF
olmasına rağmen ürün başına bir dosya üretir.

ÖZ KODLARI (`core_type`) — `ATTR_VALUE_LABELS.core` ile birebir aynı olmalı:
    FC        elyaf öz
    IWRC      çelik öz
    WSC       çelik halat öz
    IWRC-PI   plastik dolgulu çelik öz (öz ile damarlar arası boşluk dolu)
    IWRC-PC   plastik kaplı çelik öz (CASAR "Plast" ailesi: öz ceketli)

BASILI OLMAYAN ALAN YAZILMAZ. Katalog bir mukavemet sınıfını basmıyorsa o
satır yoktur; ağırlık basılmıyorsa `weight_kg_per_m` yoktur.
"""
from __future__ import annotations

import io
import json
import os

# Genel PDF tablo okuyucu — halat betikleri bu adları `rc.` önekiyle kullanır.
from pdftable import (  # noqa: F401
    BASE, SRC_DIR, anchors_from, by_anchor, cell_join, cell_text, inch_label,
    inch_parts, inch_to_mm, num, open_src, read_rows, rows_by_gap, rows_of, words,
)

OUT_DIR = os.path.join(BASE, "catalog_data", "ropes")

FIELDS = ["diameter_mm", "core_type", "grade_mpa", "breaking_load_kN", "weight_kg_per_m"]


def write(name, meta, items, extra_fields=()):
    """catalog_data/ropes/<name> yazar; boş kalan alanı taşımaz."""
    fields = [f for f in FIELDS] + [f for f in extra_fields if f not in FIELDS]
    fields = [f for f in fields if any(i.get(f) is not None for i in items)]
    items = [{f: it[f] for f in fields if it.get(f) is not None} for it in items]
    meta["item_count"] = len(items)
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    io.open(path, "w", encoding="utf-8").write(
        json.dumps({"meta": meta, "fields": fields, "items": items},
                   ensure_ascii=False, indent=1))
    grades = sorted({i["grade_mpa"] for i in items if i.get("grade_mpa")})
    dias = [i["diameter_mm"] for i in items]
    cls = "/".join(str(int(g)) for g in grades) + " MPa" if grades else "sınıfsız"
    print(f"{name:34} {len(items):4d} satır · Ø{min(dias):g}-{max(dias):g} mm · {cls}")
    return items
