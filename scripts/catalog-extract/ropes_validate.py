# -*- coding: utf-8 -*-
"""catalog_data/ropes/*.json fiziğe ve katalogun kendi tutarlılığına karşı sınar.

Excel'e ya da başka bir tabloya değil; halatın kendi büyüklüklerine bakar:

  1. Kopma kuvveti çapın KARESİYLE büyür. K = F / (d² · R) "yapım faktörü"dür
     (fill factor × spin factor) ve gerçek halatlarda 0,30–0,80 bandındadır.
     Bir satır bu bandın dışına düşerse sütun kayması vardır.
  2. Aynı ürün + aynı sınıfta çap arttıkça kopma kuvveti ARTAR.
  3. Aynı çapta mukavemet sınıfı arttıkça kopma kuvveti ARTAR.
  4. Metre ağırlığı da çapın karesiyle büyür: w / d² ürün içinde ±%12 bandında
     kalmalıdır. Katalogun kendi dizgi hataları burada yakalanır.
Çıktı sıfır satırsa hata yok demektir; her uyarı ürün + çap ile basılır.
"""
from __future__ import annotations

import glob
import json
import os
import sys
from collections import defaultdict

import ropes_common as rc

K_MIN, K_MAX = 0.30, 0.80
WEIGHT_BAND = 0.12


def check(path):
    d = json.load(open(path, encoding="utf-8"))
    name = os.path.basename(path)
    items = d["items"]
    warn = []

    # 1 — yapım faktörü bandı
    for it in items:
        grade = it.get("grade_mpa")
        if not grade:
            continue
        k = it["breaking_load_kN"] * 1000 / (it["diameter_mm"] ** 2 * grade)
        if not (K_MIN <= k <= K_MAX):
            warn.append(f"yapım faktörü Ø{it['diameter_mm']} {grade} MPa → {k:.3f}")

    # 2 — çap ↑ ⇒ kopma kuvveti ↑ (ÖZ TİPİ + sınıf başına; FC ile IWRC aynı
    # çapta farklı kopma kuvveti verir, ikisi tek diziye konursa yanlış alarm olur)
    by_grade = defaultdict(list)
    for it in items:
        key = (it.get("core_type"), it.get("grade_mpa"))
        by_grade[key].append((it["diameter_mm"], it["breaking_load_kN"]))
    for (core, grade), pts in by_grade.items():
        pts.sort()
        for (d0, f0), (d1, f1) in zip(pts, pts[1:]):
            if d1 > d0 and f1 < f0:
                warn.append(f"{core} {grade} MPa: Ø{d0}→{f0} kN ama Ø{d1}→{f1} kN (azalıyor)")

    # 3 — sınıf ↑ ⇒ kopma kuvveti ↑ (çap başına)
    by_dia = defaultdict(dict)
    for it in items:
        if it.get("grade_mpa"):
            by_dia[(it["diameter_mm"], it.get("core_type"))][it["grade_mpa"]] = it["breaking_load_kN"]
    for dia, g in by_dia.items():
        seq = [g[k] for k in sorted(g)]
        if any(b < a for a, b in zip(seq, seq[1:])):
            warn.append(f"Ø{dia}: sınıf artarken kopma kuvveti düşüyor {g}")

    # 4 — metre ağırlığı / d² bandı
    ratios = [(it["diameter_mm"], it["weight_kg_per_m"] / it["diameter_mm"] ** 2)
              for it in items if it.get("weight_kg_per_m")]
    if ratios:
        vals = sorted(r for _, r in ratios)
        med = vals[len(vals) // 2]
        for dia, r in sorted(set(ratios)):
            if abs(r - med) / med > WEIGHT_BAND:
                warn.append(f"metre ağırlığı Ø{dia}: {r * dia ** 2:.2f} kg/m "
                            f"(w/d² {r:.5f}, ortanca {med:.5f})")

    return name, len(items), warn


def main():
    paths = sorted(glob.glob(os.path.join(rc.OUT_DIR, "*.json")))
    total = 0
    problems = 0
    for p in paths:
        name, n, warn = check(p)
        total += n
        if warn:
            problems += 1
            print(f"\n{name} ({n} satır)")
            for w in warn:
                print(f"    {w}")
    print(f"\n{len(paths)} dosya · {total} satır · {problems} dosyada uyarı")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
