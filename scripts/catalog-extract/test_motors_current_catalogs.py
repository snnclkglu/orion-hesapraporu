# -*- coding: utf-8 -*-
"""GAMAK 2026 ve ELK motor kataloglarının kaynak/sayfa regresyonları."""

import json
import unittest
from collections import Counter
from pathlib import Path


MOTORS_DIR = Path(__file__).resolve().parents[3] / "catalog_data" / "motors"


def load(name):
    return json.loads((MOTORS_DIR / name).read_text(encoding="utf-8"))


class CurrentMotorCatalogTest(unittest.TestCase):
    def check_common(self, data, expected_count, expected_poles):
        items = data["items"]
        self.assertEqual(len(items), expected_count)
        self.assertEqual(Counter(row["poles"] for row in items), expected_poles)
        self.assertEqual(
            len({(row["power_kw"], row["poles"]) for row in items}),
            expected_count,
        )
        for row in items:
            self.assertIsInstance(row["technical_page"], int)
            self.assertIsInstance(row["dimension_page"], int)
            self.assertGreater(row["technical_page"], 0)
            self.assertGreater(row["dimension_page"], 0)
            self.assertIn("katalog (s.", row["shaft_source"])

    def test_gamak_2026_pages_and_scope(self):
        data = load("gamak.json")
        self.assertEqual(data["meta"]["source_pdf"], "GAMAK Teknik Katalog TR 2026.pdf")
        self.check_common(data, 138, Counter({4: 37, 2: 35, 6: 34, 8: 32}))
        items = data["items"]
        self.assertEqual(
            {row["technical_page"] for row in items},
            set(range(69, 75)) | set(range(76, 84)),
        )
        self.assertEqual({row["dimension_page"] for row in items}, {88, 89})
        for row in items:
            expected_page = 88 if row["series"].startswith("Alüminyum") else 89
            self.assertEqual(row["dimension_page"], expected_page)
            self.assertIn(row["efficiency_class"], {"IE2", "IE3", "IE4"})

        # Üretici s.77'de ağırlığı "-" yayımlar; bilinmeyen değer uydurulmaz.
        model = next(row for row in items if row["model"] == "GMM3E 355 L 4e")
        self.assertNotIn("weight_kg", model)
        self.assertEqual((model["technical_page"], model["dimension_page"]), (77, 89))

    def test_elk_pages_and_printed_cells(self):
        data = load("elk.json")
        self.assertEqual(data["meta"]["source_pdf"], "elk-motor-katalog-tr.pdf")
        self.check_common(data, 78, Counter({4: 27, 2: 26, 6: 25}))
        items = data["items"]
        self.assertEqual(
            {row["technical_page"] for row in items},
            {32, 33, 34, 37, 38, 39},
        )
        self.assertEqual({row["dimension_page"] for row in items}, {41})

        by_model = {row["model"]: row for row in items}
        self.assertEqual(by_model["3EL090L4D"]["speed_rpm"], 1445)
        self.assertEqual(by_model["3EL090L4D"]["torque_nm"], 9.91)
        self.assertEqual(by_model["3EL100L4C"]["torque_nm"], 14.5)
        self.assertEqual(by_model["3EL100L6B"]["speed_rpm"], 955)


if __name__ == "__main__":
    unittest.main()
