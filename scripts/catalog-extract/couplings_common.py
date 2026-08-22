# -*- coding: utf-8 -*-
"""Kaplin kataloğu çıkarımı — ortak şema ve yazıcı.

Tüm kaplin JSON'ları AYNI şemayı taşır; seçici (catalog-mapping.ts) bu
alanları okur.  Alan adları İngilizce lowerCamelCase/snake_case'tir, dosya
içeriği ise doğrudan katalog sayfasından gelir.

ORTAK ALANLAR
  model                model kodu (ör. "OZGUN J6", "SIBRE ABC-V 450")
  brand                marka (dosya meta'sında da vardır)
  coupling_type        "motor" | "drum" | "brake" | "flexible" | "gear" |
                       "pin" | "disc" | "chain" | "barrel"
  series               seri kodu — süzgeç faceti (ör. "J", "B1", "ALC-AT")
  nominal_torque_Nm    anma momenti (katalogda Tnominal / TKN / Tkn)
  max_torque_Nm        tepe/maksimum moment (Tpeak / TKmax / Tkmax)
  max_bore_mm          en büyük delik çapı (ød max)
  min_bore_mm          en küçük delik çapı (ød min) — varsa
  max_radial_load_N    izin verilen radyal yük — varsa (tambur kaplinleri)
  weight_kg            ağırlık
  weight_min_kg /
  weight_max_kg        ağırlık bir aralıksa (fren kasnağı/diski çapına bağlı)
  outer_diameter_mm    dış çap (katalogda ØD / Ød6 / ØDH)
  brake_drum_diameter_mm  fren kasnağı çapı (katalogda ØD1; kasnaklı seri)
  max_speed_rpm        izin verilen en yüksek devir

Bir büyüklük basılı sayfada YOKSA alan hiç yazılmaz — TAHMİN EDİLMEZ.
"""

from __future__ import annotations

import json
import os

# catalog_data kökü: <workspace>/catalog_data/couplings
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))          # orion-hesapraporu
WORKSPACE = os.path.dirname(REPO)                       # HESAP RAPORU KOD
OUT_DIR = os.path.join(WORKSPACE, "catalog_data", "couplings")

# Katalog PDF'leri workspace kökündedir (repo dışında).
PDF_OZGUN = os.path.join(WORKSPACE, "ozgun katalog 2019 1-b.pdf")
PDF_SIBRE = os.path.join(WORKSPACE, "02_SIBRE_Coupling-catalogue.pdf")

FIELD_ORDER = [
    "model",
    "coupling_type",
    "series",
    "nominal_torque_Nm",
    "max_torque_Nm",
    "max_bore_mm",
    "min_bore_mm",
    "max_radial_load_N",
    "weight_kg",
    "weight_min_kg",
    "weight_max_kg",
    "outer_diameter_mm",
    "brake_drum_diameter_mm",
    "max_speed_rpm",
]

VALID_TYPES = {
    "motor",
    "drum",
    "brake",
    "flexible",
    "gear",
    "pin",
    "disc",
    "chain",
    "barrel",
}


def item(**kw):
    """Boş (None) alanları atarak tek bir katalog satırı üretir."""
    out = {}
    for k, v in kw.items():
        if v is None:
            continue
        out[k] = v
    if out.get("coupling_type") not in VALID_TYPES:
        raise ValueError("gecersiz coupling_type: %r" % out.get("coupling_type"))
    return out


def write_catalog(filename, meta, items, extra_fields=()):
    """catalog_data/couplings/<filename> dosyasını yazar."""
    if not items:
        raise ValueError("bos katalog: %s" % filename)
    present = []
    for f in list(FIELD_ORDER) + list(extra_fields):
        if any(f in it for it in items) and f not in present:
            present.append(f)
    doc = {"meta": meta, "fields": present, "items": items}
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("  %-28s %3d satir" % (filename, len(items)))
    return path


def remove_stale(filenames):
    """Yerini yeni dosyaların aldığı eski katalog dosyalarını siler."""
    for name in filenames:
        path = os.path.join(OUT_DIR, name)
        if os.path.exists(path):
            os.remove(path)
            print("  silindi: %s" % name)
