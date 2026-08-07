# -*- coding: utf-8 -*-
"""Çıkarılan katalog verisini fiziğe ve iç tutarlılığa karşı doğrular."""
import json
import os
import collections

BASE = r"C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD\catalog_data\reducers"


def check(name):
    j = json.load(open(os.path.join(BASE, name), encoding="utf-8"))
    it = j["items"]
    bad = collections.Counter()
    ex = {}

    def flag(key, item):
        bad[key] += 1
        ex.setdefault(key, item)

    for x in it:
        i, n1, n2 = x.get("ratio"), x.get("input_speed_rpm"), x.get("output_speed_rpm")
        # 1) n2 ≈ n1 / i  (katalog n2'yi tam sayıya yuvarlıyor → %3 tolerans)
        if i and n1 and n2:
            if abs(n2 - n1 / i) / max(n2, 1) > 0.03:
                flag("n2 != n1/i", x)
        # 2) anma momenti ≈ Pn·9550/n2 (fs=1) → %25 tolerans (kademe verimi, yuvarlama)
        t, p = x.get("output_torque_Nm"), x.get("nominal_power_kw")
        if t and p and n2:
            calc = p * 9550.0 / n2
            if not (0.7 <= t / calc <= 1.45):
                flag("Ma ile Pn tutarsiz", x)
        # 3) ölçek kontrolleri
        if t is not None and not (10 <= t <= 2_000_000):
            flag("tork araligi", x)
        if i is not None and not (1 <= i <= 30000):
            flag("oran araligi", x)
        r = x.get("permitted_radial_load_output_N")
        if r is not None and not (50 <= r <= 3_000_000):
            flag("radyal yuk araligi", x)
        w = x.get("weight_kg")
        if w is not None and not (3 <= w <= 30000):
            flag("agirlik araligi", x)
        so, si = x.get("output_shaft_diameter_mm"), x.get("input_shaft_diameter_mm")
        if so is not None and not (15 <= so <= 400):
            flag("cikis mili araligi", x)
        if so and si and si > so:
            flag("giris mili > cikis mili", x)

    # 4) aynı model+devir içinde oran arttıkça çıkış devri azalmalı
    grp = collections.defaultdict(list)
    for x in it:
        grp[(x["model"], x.get("input_speed_rpm"))].append(x)
    for k, rows in grp.items():
        rows.sort(key=lambda r: r["ratio"])
        for a, b in zip(rows, rows[1:]):
            if a["output_speed_rpm"] and b["output_speed_rpm"] and \
               b["output_speed_rpm"] > a["output_speed_rpm"] + 0.5:
                flag("oran arttikca n2 artmis", {"model": k[0], **b})
                break

    # 5) aynı model tek bir çıkış mili çapına sahip olmalı
    per_model = collections.defaultdict(set)
    for x in it:
        if x.get("output_shaft_diameter_mm"):
            per_model[x["model"]].add(x["output_shaft_diameter_mm"])
    multi = {m: s for m, s in per_model.items() if len(s) > 1}

    print(f"=== {name}: {len(it)} satır, {len({x['model'] for x in it})} model")
    if not bad:
        print("    tüm kontroller temiz")
    for k, n in bad.most_common():
        print(f"    ! {k}: {n}")
        print(f"        örnek: {json.dumps(ex[k], ensure_ascii=False)[:190]}")
    if multi:
        print(f"    ! aynı modelde birden çok çıkış mili çapı: {multi}")

    # bilgi: uç değerler
    tq = [x["output_torque_Nm"] for x in it if x.get("output_torque_Nm")]
    rt = [x["ratio"] for x in it if x.get("ratio")]
    print(f"    tork {min(tq):.0f}…{max(tq):.0f} Nm · oran {min(rt):.2f}…{max(rt):.2f}")


for f in ["yilmaz_m.json", "yilmaz_dr.json", "yilmaz_h.json"]:
    check(f)
    print()
