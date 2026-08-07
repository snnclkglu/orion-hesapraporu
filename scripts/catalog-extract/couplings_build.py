# -*- coding: utf-8 -*-
"""Tüm kaplin katalog dosyalarını yeniden üretir ve doğrular.

    pip install pymupdf
    cd scripts/catalog-extract
    python couplings_build.py
"""

from __future__ import annotations

import sys

import couplings_jaure
import couplings_ozgun
import couplings_sibre
import couplings_validate


def main():
    couplings_ozgun.build()
    print()
    couplings_sibre.build()
    print()
    couplings_jaure.build()
    print()
    return couplings_validate.main()


if __name__ == "__main__":
    sys.exit(main())
