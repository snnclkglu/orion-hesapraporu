# -*- coding: utf-8 -*-
"""Rulman kataloğu doğrulaması — catalog_data/bearings/*.json.

Rulman verisi ELLE ya da katalogdan çıkarımla üretilir; bu betik üretilen
tabloyu FİZİĞE ve ISO 15 sınır ölçülerine karşı sınar. Amaç, uydurulmuş ya da
yanlış kopyalanmış bir C0 değerinin `bearing.static` ENGELLEYİCİ kontrolünü
sessizce "uygun" yapmasını önlemektir.

Çalıştırma:
    python bearings_validate.py [dosya.json ...]
Varsayılan: catalog_data/bearings/ altındaki tüm .json dosyaları.

Çıkış kodu 0 = hata yok, 1 = en az bir HATA var (UYARI çıkış kodunu etkilemez).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Windows konsolu cp1254'tür ve Türkçe olmayan işaretlerde (ör. "->") çöker.
# Rapor ortasında çökmek en tehlikeli davranıştır: kullanıcı kısmi hata
# listesini görüp gerisini "geçti" sanır. Çıktıyı UTF-8'e sabitle.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # yönlendirilmiş/eski akış
        pass

# --------------------------------------------------------------------------
# Yollar
# --------------------------------------------------------------------------

# .../orion-hesapraporu/scripts/catalog-extract/bearings_validate.py
#  -> workspace kökü: dört üst dizin
REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = REPO_ROOT.parent
BEARINGS_DIR = WORKSPACE_ROOT / "catalog_data" / "bearings"
ISO15_REF = BEARINGS_DIR / "iso15_reference.json"

# --------------------------------------------------------------------------
# Delik çapı kodu -> d (mm).  ISO 15 md. 4: 04 ve üstü kod için d = 5 × kod.
# --------------------------------------------------------------------------

BORE_CODE_EXCEPTIONS = {0: 10, 1: 12, 2: 15, 3: 17}


def bore_from_designation(designation: str) -> int | None:
    """Tanımdan (ör. '22212 E', '6210', 'NU210 ECP') delik çapını türetir.

    Tanımın sayısal gövdesinin SON İKİ basamağı delik çapı kodudur.
    Kod ≥ 04 ise d = 5 × kod; 00/01/02/03 için ISO 15 istisna tablosu geçerlidir.
    """
    # Sayısal gövde: baştaki harfleri (NU, NJ, ...) ve sondaki son ekleri at.
    match = re.search(r"\d+", designation)
    if not match:
        return None
    digits = match.group(0)
    if len(digits) < 3:
        return None
    code = int(digits[-2:])
    if code in BORE_CODE_EXCEPTIONS:
        return BORE_CODE_EXCEPTIONS[code]
    if code < 4:
        return None
    return 5 * code


def dimension_series(designation: str) -> str | None:
    """Tanımdan ISO 15 boyut serisini çıkarır (ör. '6210' -> '02').

    Boyut serisi = genişlik serisi + çap serisi. Uygulamanın kapsamındaki
    aileler için tanım gövdesinden okunur.
    """
    match = re.search(r"\d+", designation)
    if not match:
        return None
    digits = match.group(0)
    prefix = re.match(r"[A-Z]*", designation.upper()).group(0)

    # Eksenel bilyalı: 511xx/512xx/513xx/514xx -> boyut serisi 11/12/13/14
    if len(digits) == 5 and digits.startswith("5"):
        return digits[1:3]
    # Küresel makaralı: 222xx/223xx -> boyut serisi 22/23
    if len(digits) == 5 and digits.startswith("22"):
        return digits[2] and "2" + digits[2]
    # Sabit bilyalı 60xx/62xx/63xx -> boyut serisi 10/02/03
    if prefix == "" and len(digits) == 4 and digits.startswith("6"):
        return {"0": "10", "2": "02", "3": "03"}.get(digits[1])
    # Silindirik makaralı NU2xx/NJ2xx/NU3xx -> çap serisi 2/3, genişlik serisi 0
    if prefix in ("NU", "NJ", "N", "NUP") and len(digits) == 3:
        return {"2": "02", "3": "03", "10": "10"}.get(digits[0])
    return None


# --------------------------------------------------------------------------
# ISO 15 sınır ölçüleri referansı
# --------------------------------------------------------------------------


def load_iso15_reference() -> dict:
    """ISO 15 sınır ölçü tablosunu yükler.

    Tablo (boyut serisi, delik kodu) -> {"D": …, "B": …} eşlemesidir. Dosya
    yoksa ISO 15 çapraz kontrolü ATLANIR — uydurulmuş bir referansa karşı
    doğrulama yapmaktansa kontrolü atlamak doğrudur.
    """
    if not ISO15_REF.exists():
        return {}
    raw = json.loads(ISO15_REF.read_text(encoding="utf-8"))
    table = {}
    for series, entries in raw.get("series", {}).items():
        for code, dims in entries.items():
            table[(series, int(code))] = dims
    return table


# --------------------------------------------------------------------------
# Doğrulanmış referans değerler (basılı katalog + skf.com ile teyit edilmiş)
# --------------------------------------------------------------------------

# Bu iki değer Örnek Hesap Raporu.xlsx ile uyumludur ve 2026-08-06 tarihinde
# skf.com ürün sayfalarından ayrıca teyit edilmiştir.
KNOWN_GOOD = {
    "22212 E": {"static_load_kN": 166},
    "51214": {"static_load_kN": 160},
}


# --------------------------------------------------------------------------
# Doğrulama
# --------------------------------------------------------------------------


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.skipped: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def skip(self, msg: str) -> None:
        self.skipped.append(msg)


REQUIRED_FIELDS = [
    "designation",
    "series",
    "bore_mm",
    "outer_diameter_mm",
    "width_mm",
    "dynamic_load_kN",
    "static_load_kN",
    "limiting_speed_rpm",
    "weight_kg",
]


def validate_item(item: dict, iso15: dict, rep: Report) -> None:
    name = item.get("designation", "<tanımsız>")

    # -- alan varlığı ------------------------------------------------------
    for field in REQUIRED_FIELDS:
        if field not in item:
            rep.error(f"{name}: '{field}' alanı eksik")
            return

    d = item["bore_mm"]
    outer = item["outer_diameter_mm"]
    width = item["width_mm"]
    dyn = item["dynamic_load_kN"]
    stat = item["static_load_kN"]
    speed = item["limiting_speed_rpm"]
    weight = item["weight_kg"]

    # -- temel geometri ve pozitiflik --------------------------------------
    if outer is None or d is None or not (outer > d):
        rep.error(f"{name}: D ({outer}) > d ({d}) değil")
    if not (isinstance(width, (int, float)) and width > 0):
        rep.error(f"{name}: B ({width}) pozitif değil")
    if not (isinstance(dyn, (int, float)) and dyn > 0):
        rep.error(f"{name}: C ({dyn}) pozitif değil")
    if not (isinstance(stat, (int, float)) and stat > 0):
        rep.error(f"{name}: C0 ({stat}) pozitif değil")
    if not (isinstance(speed, (int, float)) and speed > 0):
        rep.error(f"{name}: limiting_speed ({speed}) pozitif değil")
    if not (isinstance(weight, (int, float)) and weight > 0):
        rep.error(f"{name}: weight ({weight}) pozitif değil")

    # -- tanım ↔ delik çapı uyumu -----------------------------------------
    expected = bore_from_designation(name)
    if expected is None:
        rep.skip(f"{name}: delik kodu tanımdan okunamadı, uyum kontrolü atlandı")
    elif expected != d:
        rep.error(
            f"{name}: tanım {expected} mm delik gerektiriyor, veride d = {d} mm"
        )

    # -- ISO 15 sınır ölçü çapraz kontrolü ---------------------------------
    series = dimension_series(name)
    code = None
    match = re.search(r"\d+", name)
    if match and len(match.group(0)) >= 3:
        code = int(match.group(0)[-2:])
    if series is None or code is None:
        rep.skip(f"{name}: boyut serisi çözülemedi, ISO 15 kontrolü atlandı")
    else:
        ref = iso15.get((series, code))
        if ref is None:
            rep.skip(
                f"{name}: ISO 15 referansı yok (seri {series}, kod {code:02d}), atlandı"
            )
        else:
            if ref.get("D") is not None and ref["D"] != outer:
                rep.error(
                    f"{name}: ISO 15 D = {ref['D']} mm, veride {outer} mm"
                )
            if ref.get("B") is not None and ref["B"] != width:
                rep.error(
                    f"{name}: ISO 15 B = {ref['B']} mm, veride {width} mm"
                )

    # -- bilinen doğrulanmış değerler --------------------------------------
    known = KNOWN_GOOD.get(name)
    if known:
        for field, value in known.items():
            if item.get(field) != value:
                rep.error(
                    f"{name}: doğrulanmış {field} = {value}, veride {item.get(field)}"
                )


def validate_series_monotonic(items: list[dict], rep: Report) -> None:
    """Aynı seride d arttıkça C ve C0 artmalı, limiting_speed azalmalı."""
    by_series: dict[str, list[dict]] = {}
    for item in items:
        by_series.setdefault(item.get("series", "<seri yok>"), []).append(item)

    for series, rows in sorted(by_series.items()):
        usable = [
            r
            for r in rows
            if all(
                isinstance(r.get(f), (int, float))
                for f in ("bore_mm", "dynamic_load_kN", "static_load_kN", "limiting_speed_rpm")
            )
        ]
        usable.sort(key=lambda r: r["bore_mm"])
        for prev, cur in zip(usable, usable[1:]):
            if cur["bore_mm"] == prev["bore_mm"]:
                continue
            tag = f"{series}: {prev['designation']} -> {cur['designation']}"
            if cur["dynamic_load_kN"] < prev["dynamic_load_kN"]:
                rep.error(
                    f"{tag}: d artarken C düşüyor "
                    f"({prev['dynamic_load_kN']} -> {cur['dynamic_load_kN']} kN)"
                )
            if cur["static_load_kN"] < prev["static_load_kN"]:
                rep.error(
                    f"{tag}: d artarken C0 düşüyor "
                    f"({prev['static_load_kN']} -> {cur['static_load_kN']} kN)"
                )
            if cur["limiting_speed_rpm"] > prev["limiting_speed_rpm"]:
                rep.error(
                    f"{tag}: d artarken limiting_speed yükseliyor "
                    f"({prev['limiting_speed_rpm']} -> {cur['limiting_speed_rpm']} d/dak)"
                )
            if cur["weight_kg"] < prev["weight_kg"]:
                rep.warn(
                    f"{tag}: d artarken ağırlık düşüyor "
                    f"({prev['weight_kg']} -> {cur['weight_kg']} kg)"
                )


def validate_file(path: Path, iso15: dict) -> Report:
    rep = Report()
    data = json.loads(path.read_text(encoding="utf-8"))

    fields = data.get("fields", [])
    missing = [f for f in REQUIRED_FIELDS if f not in fields]
    if missing:
        rep.error(f"meta: 'fields' listesinde eksik alan(lar): {', '.join(missing)}")

    meta = data.get("meta", {})
    if not meta.get("extraction_date"):
        rep.warn("meta: extraction_date boş")
    if not (meta.get("source_url") or meta.get("source_pdf")):
        rep.warn("meta: source_url / source_pdf boş — kaynak izlenemiyor")

    items = data.get("items", [])
    if not items:
        rep.error("items boş")
        return rep

    seen: dict[str, int] = {}
    for item in items:
        name = item.get("designation", "<tanımsız>")
        seen[name] = seen.get(name, 0) + 1
        validate_item(item, iso15, rep)
    for name, count in seen.items():
        if count > 1:
            rep.error(f"{name}: {count} kez tekrarlanmış")

    validate_series_monotonic(items, rep)
    return rep


def main(argv: list[str]) -> int:
    if argv:
        paths = [Path(a).resolve() for a in argv]
    else:
        paths = sorted(BEARINGS_DIR.glob("*.json"))
        paths = [p for p in paths if p.name != ISO15_REF.name]

    if not paths:
        print(f"Doğrulanacak dosya bulunamadı: {BEARINGS_DIR}")
        return 1

    iso15 = load_iso15_reference()
    if not iso15:
        print(
            f"NOT: ISO 15 referans tablosu yok ({ISO15_REF.name}); "
            "sınır ölçü çapraz kontrolü atlanacak.\n"
        )

    total_errors = 0
    for path in paths:
        rep = validate_file(path, iso15)
        total_errors += len(rep.errors)

        print(f"=== {path.name} ===")
        print(
            f"  HATA: {len(rep.errors)}   UYARI: {len(rep.warnings)}   "
            f"ATLANAN: {len(rep.skipped)}"
        )
        for msg in rep.errors:
            print(f"  [HATA]  {msg}")
        for msg in rep.warnings:
            print(f"  [UYARI] {msg}")
        if rep.skipped:
            print(f"  [ATLANDI] {len(rep.skipped)} kontrol — ilk 10:")
            for msg in rep.skipped[:10]:
                print(f"      {msg}")
        print()

    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
