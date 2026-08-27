# -*- coding: utf-8 -*-
"""Redüktör kataloglarının ortak alan sırası ve JSON yazıcısı.

Şema `catalog_data/reducers/*.json` dosyalarının hâlihazırdaki biçimidir
(yilmaz_{dr,m,h} · flender_md20_1 · simogear_parallel). seed-catalog.ts bu
alanları bekler ve `src/lib/catalog-mapping.ts` şu dördünü ENGELLEYİCİ
kontrollere bağlar:

    output_torque_Nm  → gearbox.torque      (gereken tork ≤ anma momenti)
    permitted_radial_load_output_N → gearbox.radial
    output_shaft_diameter_mm / input_shaft_diameter_mm → kaplin mil çapı

`application` (kaldirma | yurutme) 2.3 ve 5.5 bölümlerinin KİLİTLİ süzgecidir;
kaynağı olmayan katalogda seed varsayılan atar.

KAYNAK SEÇİMİ: motorsuz (gear unit) tablolar kullanılır. Motorlu tablo her
satırda bir motoru zorunlu kılar; uygulama redüktörle motoru ayrı bölümlerde
seçtiği için o biçim modele uymaz (bkz. README).
"""
from __future__ import annotations

import io
import json
import os

from pdftable import BASE, CATALOG_DATA  # noqa: F401

OUT_DIR = os.path.join(CATALOG_DATA, "reducers")

FIRST = [
    "model", "series", "input_configuration", "performance_table_model",
    "application", "frame_size", "stages", "ratio",
    "output_torque_Nm", "output_speed_rpm", "input_speed_rpm",
    "nominal_power_kw", "thermal_power_kw", "thermal_power_fan_kw",
    "permitted_radial_load_output_N", "permitted_radial_load_input_N",
    "weight_kg", "output_shaft_diameter_mm", "input_shaft_diameter_mm",
    "hollow_bore_mm", "dimension_page",
]


def order_keys(it):
    """Anlamlı alan sırası — JSON elle de okunabilir olsun."""
    out = {k: it[k] for k in FIRST if k in it}
    for k in sorted(it):
        if k not in out:
            out[k] = it[k]
    return out


def write(name, meta, items):
    """catalog_data/reducers/<name> yazar; hiç dolmayan alanı taşımaz."""
    items = [order_keys(it) for it in items]
    fields: list[str] = []
    for it in items:
        for k in it:
            if k not in fields:
                fields.append(k)
    empty = [f for f in fields if all(i.get(f) is None for i in items)]
    if empty:
        print(f"  {name}: karşılığı olmayan alanlar atıldı: {empty}")
        fields = [f for f in fields if f not in empty]
    items = [{k: v for k, v in i.items() if k in fields and v is not None} for i in items]
    meta["item_count"] = len(items)
    meta["model_count"] = len({i["model"] for i in items})
    os.makedirs(OUT_DIR, exist_ok=True)
    io.open(os.path.join(OUT_DIR, name), "w", encoding="utf-8").write(
        json.dumps({"meta": meta, "fields": fields, "items": items},
                   ensure_ascii=False, indent=1))
    filled = {f: sum(1 for i in items if i.get(f) is not None) for f in fields}
    print(f"{name:32} {len(items):5d} satır · {meta['model_count']:3d} model")
    for f in fields:
        if filled[f] < len(items):
            print(f"    {f:34} dolu {filled[f]}/{len(items)}")
    return items
