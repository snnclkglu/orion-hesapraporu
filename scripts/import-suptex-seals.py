"""SUPTEX .xls kataloğunu uygulamanın salt-okunur JSON defterine aktarır."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tmp" / "python-xlrd"))
import xlrd


def clean(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Kullanım: import-suptex-seals.py <kaynak.xls> <hedef.json>")
    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    workbook = xlrd.open_workbook(source)
    sheet = workbook.sheet_by_name("DMK-mm 2013")
    rows = []
    for index in range(8, sheet.nrows):
        values = [clean(sheet.cell_value(index, column)) for column in range(7)]
        if not any(values):
            continue
        rows.append(
            {
                "code": values[0],
                "shaftDiameter": values[1],
                "housingDiameter": values[2],
                "height": values[3],
                "type": values[4],
                "material": values[5],
                "msa": values[6],
            }
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(rows)} satır -> {target}")


if __name__ == "__main__":
    main()
