# -*- coding: utf-8 -*-
"""Üç motor kataloğunu tek komutla üretir.

    python motors_build.py        # catalog_data/motors/{abb,innomatics,gamak}.json
    python motors_validate.py     # tutarlılık raporu

Her marka kendi modülünde çözümlenir (sayfa düzenleri birbirine benzemez);
bu betik yalnız sırayla çağırıp özet basar.
"""
import sys

import motors_abb
import motors_common as mc
import motors_gamak
import motors_siemens

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

BUILDERS = [
    ("ABB", motors_abb),
    ("INNOMATICS (Siemens)", motors_siemens),
    ("GAMAK", motors_gamak),
]


def main():
    total = 0
    for name, module in BUILDERS:
        result = module.build()
        n, pages, missing, dropped, path = result
        total += n
        print("=" * 70)
        print(f"{name}: {n} satır -> {path}")
        by_poles = {}
        import json
        for it in json.loads(open(path, encoding="utf-8").read())["items"]:
            by_poles[it["poles"]] = by_poles.get(it["poles"], 0) + 1
        print("  kutup dağılımı:", dict(sorted(by_poles.items())))
        print(f"  elenen tekrar satırı: {len(dropped)} · "
              f"okunamayan satır: {len(missing)}")
        if missing:
            for m in missing[:5]:
                print("    okunamadı:", m)
    print("=" * 70)
    print("TOPLAM:", total, "satır ·", mc.CATALOG_DATA)


if __name__ == "__main__":
    main()
