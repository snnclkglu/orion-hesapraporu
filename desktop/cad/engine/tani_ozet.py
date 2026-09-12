# -*- coding: utf-8 -*-
"""
tani_ozet.py — Birikmis tani kayitlarini tek bir ozete indirger.

Kullanim:
    python tani_ozet.py C:\\...\\tanilar            > ozet.md
    python tani_ozet.py C:\\...\\tanilar --json     > ozet.json

Nicin var
---------
Bu aracin mantigi buyuk olcude sezgisel; her yeni cizim yeni bir sablon
surprizi cikarabiliyor. Her calisma bir `tani_<dosya>.json` birakir.
Bu betik onlarin hepsini tarayip "kodun nerede zorlandigini" gosteren
yogun bir rapor uretir.

Uretilen `ozet.md` dosyasini bir AI'a verip "bu bulgular isiginda
pafta_core.py'yi gelistir" demek icin tasarlandi. Ham `tani_*.txt`
dokumleri de yaninda durur; AI takildigi ornegi oradan acar.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pafta_tani


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Birikmis tani_*.json dosyalarini tek ozete indirger.")
    ap.add_argument("klasor", nargs="+",
                    help="tani_*.json dosyalarini iceren klasor(ler)")
    ap.add_argument("--json", action="store_true",
                    help="markdown yerine ham birlesik JSON ver")
    ap.add_argument("--out", default="", help="dosyaya yaz (bos = ekrana)")
    ap.add_argument("--ornek", type=int, default=3,
                    help="bulgu basina gosterilecek ornek sayisi")
    a = ap.parse_args()

    kayitlar: list[dict] = []
    for k in a.klasor:
        kayitlar.extend(pafta_tani.yukle_klasor(k))
    if not kayitlar:
        print("Hic tani_*.json bulunamadi.", file=sys.stderr)
        return 1

    if a.json:
        cikti = json.dumps({"kayit_sayisi": len(kayitlar), "kayitlar": kayitlar},
                           ensure_ascii=False, indent=1)
    else:
        cikti = pafta_tani.ozet_markdown(kayitlar, a.ornek)

    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(cikti)
        print(f"{len(kayitlar)} tani kaydi -> {a.out}", file=sys.stderr)
    else:
        print(cikti)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
