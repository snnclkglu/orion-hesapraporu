# -*- coding: utf-8 -*-
"""Kaplin katalog dosyalarını fiziğe ve seri tutarlılığına karşı sınar.

Kural (madde 5): AYNI SERİDE model büyüdükçe tork ve delik çapı MONOTON
ARTMALIDIR.  Buna ek olarak ölçek ilişkileri kontrol edilir.

Çıkış kodu 0 = HATA yok, 1 = en az bir HATA.
UYARI'lar (katalogun kendi yuvarlaması/tutarsızlığı) çıkışı bozmaz ama
listelenir — sessizce geçilmez.

    python couplings_validate.py                # catalog_data/couplings/*
    python couplings_validate.py <dosya.json>   # tek dosya
"""

from __future__ import annotations

import glob
import io
import json
import os
import sys

from couplings_common import OUT_DIR, VALID_TYPES

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                  errors="replace")

ERRORS = []
WARNINGS = []
SKIPPED = []


def err(f, msg):
    ERRORS.append("%s: %s" % (f, msg))


def warn(f, msg):
    WARNINGS.append("%s: %s" % (f, msg))


def skip(f, msg):
    SKIPPED.append("%s: %s" % (f, msg))


def num(it, key):
    v = it.get(key)
    return v if isinstance(v, (int, float)) else None


def check_file(path):
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    meta, items = doc["meta"], doc["items"]

    # --- şema
    for req in ("brand", "series", "coupling_type", "source_pdf"):
        if not meta.get(req):
            err(name, "meta.%s eksik" % req)
    if meta.get("coupling_type") not in VALID_TYPES:
        err(name, "gecersiz meta.coupling_type: %r" % meta.get("coupling_type"))

    seen = set()
    for it in items:
        m = it.get("model")
        if not m:
            err(name, "model alani bos bir satir var")
            continue
        if m in seen:
            err(name, "tekrar eden model: %s" % m)
        seen.add(m)
        if it.get("coupling_type") != meta.get("coupling_type"):
            err(name, "%s: satir coupling_type'i meta ile uyusmuyor" % m)
        if it.get("series") and it["series"] != meta.get("series"):
            err(name, "%s: satir series'i meta ile uyusmuyor" % m)

        tn = num(it, "nominal_torque_Nm")
        tx = num(it, "max_torque_Nm")
        if tn is not None and tn <= 0:
            err(name, "%s: anma momenti pozitif degil" % m)
        if tn is not None and tx is not None and tx < tn:
            err(name, "%s: tepe momenti (%s) anma momentinden (%s) kucuk"
                % (m, tx, tn))
        bmax = num(it, "max_bore_mm")
        bmin = num(it, "min_bore_mm")
        if bmax is not None and bmax <= 0:
            err(name, "%s: max_bore_mm pozitif degil" % m)
        if bmax is not None and bmin is not None and bmin > bmax:
            err(name, "%s: min_bore_mm (%s) > max_bore_mm (%s)"
                % (m, bmin, bmax))
        od = num(it, "outer_diameter_mm")
        if od is not None and bmax is not None and od <= bmax:
            err(name, "%s: dis cap (%s) delik capindan (%s) buyuk degil"
                % (m, od, bmax))
        for key in ("weight_kg", "weight_min_kg", "weight_max_kg",
                    "max_radial_load_N", "max_speed_rpm"):
            v = num(it, key)
            if v is not None and v <= 0:
                err(name, "%s: %s pozitif degil" % (m, key))
        wmin, wmax = num(it, "weight_min_kg"), num(it, "weight_max_kg")
        if wmin is not None and wmax is not None and wmin > wmax:
            err(name, "%s: weight_min_kg > weight_max_kg" % m)

    # --- seri içi monotonluk (madde 5)
    #     Sıralama anma momentine göre yapılır; sonra delik çapı ve dış
    #     çapın da artması beklenir.
    order_key = "nominal_torque_Nm"
    ordered = [it for it in items if num(it, order_key) is not None]
    if len(ordered) < 2:
        skip(name, "monotonluk kontrolu icin yeterli tork verisi yok")
    else:
        ordered = sorted(ordered, key=lambda it: it[order_key])
        if [it["model"] for it in ordered] != \
           [it["model"] for it in items if num(it, order_key) is not None]:
            warn(name, "katalog sirasi ile tork sirasi ayni degil")
        for a, b in zip(ordered, ordered[1:]):
            for key, label in (("max_bore_mm", "delik capi"),
                               ("outer_diameter_mm", "dis cap"),
                               ("max_torque_Nm", "tepe momenti"),
                               ("max_radial_load_N", "radyal yuk")):
                va, vb = num(a, key), num(b, key)
                if va is None or vb is None:
                    continue
                if vb < va:
                    err(name, "%s -> %s: tork artarken %s AZALIYOR (%s -> %s)"
                        % (a["model"], b["model"], label, va, vb))
                elif vb == va and key in ("max_bore_mm", "max_torque_Nm"):
                    warn(name, "%s -> %s: tork artarken %s AYNI kaliyor (%s)"
                         % (a["model"], b["model"], label, va))
            # devir sınırı boy büyüdükçe DÜŞMELİDİR
            ra, rb = num(a, "max_speed_rpm"), num(b, "max_speed_rpm")
            if ra is not None and rb is not None and rb > ra:
                warn(name, "%s -> %s: boy buyurken devir siniri ARTIYOR "
                           "(%s -> %s)" % (a["model"], b["model"], ra, rb))
            wa = num(a, "weight_kg") or num(a, "weight_max_kg")
            wb = num(b, "weight_kg") or num(b, "weight_max_kg")
            if wa is not None and wb is not None and wb < wa:
                warn(name, "%s -> %s: tork artarken agirlik AZALIYOR "
                           "(%s -> %s)" % (a["model"], b["model"], wa, wb))

    # --- eksik alanların sessiz geçmemesi
    for key in ("nominal_torque_Nm", "max_bore_mm", "weight_kg"):
        missing = [it["model"] for it in items if num(it, key) is None
                   and not (key == "weight_kg"
                            and num(it, "weight_max_kg") is not None)]
        if missing and len(missing) == len(items):
            skip(name, "%s hicbir satirda yok (katalog basmiyor)" % key)
        elif missing:
            skip(name, "%s su satirlarda yok: %s"
                 % (key, ", ".join(missing[:6])
                    + ("..." if len(missing) > 6 else "")))

    return len(items)


# ------------------------------------------------------ doğrulanmış değerler
# Basılı sayfayla BİREBİR karşılaştırılmış satırlar (marka başına en az iki).
GOLDEN = [
    # (dosya, model, alan, deger, kaynak)
    ("ozgun_j.json", "J6", "nominal_torque_Nm", 22600,
     "ozgun katalog s.33, TIP J tablosu, Tnominal satiri"),
    ("ozgun_j.json", "J6", "max_radial_load_N", 59400,
     "ozgun katalog s.33, TIP J tablosu, Radial Load satiri"),
    ("ozgun_j.json", "J6", "max_bore_mm", 130,
     "ozgun katalog s.33, TIP J tablosu, od max satiri"),
    ("ozgun_b3.json", "B3-2", "nominal_torque_Nm", 2850,
     "ozgun katalog s.18, TIP B3 (Brake 3) tablosu"),
    ("ozgun_a.json", "A6", "nominal_torque_Nm", 17200,
     "ozgun katalog s.15, TIP A tablosu"),
    ("sibre_abc_v.json", "ABC-V 450", "max_torque_Nm", 180000,
     "SIBRE s.47 Tablo 3 + s.46 cozumlu ornek (Tkmax = 180000 Nm)"),
    ("sibre_abc_v.json", "ABC-V 450", "max_radial_load_N", 150000,
     "SIBRE s.47 Tablo 3 + s.46 cozumlu ornek (Frmax = 150000 N)"),
    ("sibre_abc_v.json", "ABC-V 545", "max_torque_Nm", 320000,
     "SIBRE s.45 cozumlu ornek: secilen ABC-V-545, Tk = 320000 Nm"),
    ("sibre_alc_a.json", "ALC-A 65", "nominal_torque_Nm", 940,
     "SIBRE s.10 ALC-A tablosu"),
    ("sibre_apc_a.json", "APC-A 160", "nominal_torque_Nm", 270,
     "SIBRE s.16 APC-A tablosu"),
]


def check_golden():
    print("\nDOGRULANMIS DEGERLER (basili sayfaya karsi):")
    for filename, model, field, expected, source in GOLDEN:
        path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(path):
            err(filename, "golden dosya yok")
            continue
        with open(path, encoding="utf-8") as fh:
            items = json.load(fh)["items"]
        row = next((i for i in items if i["model"] == model), None)
        if row is None:
            err(filename, "golden model yok: %s" % model)
            continue
        got = row.get(field)
        ok = got == expected
        print("  %s %-22s %-20s %-10s %s"
              % ("OK  " if ok else "HATA", model, field, got, source))
        if not ok:
            err(filename, "%s.%s = %s, beklenen %s"
                % (model, field, got, expected))


def main():
    targets = sys.argv[1:]
    if targets:
        paths = targets
    else:
        paths = sorted(glob.glob(os.path.join(OUT_DIR, "*.json")))
    total = 0
    print("KAPLIN KATALOGU DOGRULAMA — %d dosya\n" % len(paths))
    for p in paths:
        total += check_file(p)

    check_golden()

    print("\nToplam satir: %d" % total)
    if SKIPPED:
        print("\nATLANAN KONTROLLER (%d):" % len(SKIPPED))
        for s in SKIPPED:
            print("  - %s" % s)
    if WARNINGS:
        print("\nUYARI (%d):" % len(WARNINGS))
        for w in WARNINGS:
            print("  - %s" % w)
    if ERRORS:
        print("\nHATA (%d):" % len(ERRORS))
        for e in ERRORS:
            print("  - %s" % e)
        return 1
    print("\nHATA YOK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
