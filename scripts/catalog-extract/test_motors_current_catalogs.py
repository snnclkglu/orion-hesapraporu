# -*- coding: utf-8 -*-
"""GAMAK, ELK ve SEW motor kataloglarının kaynak/sayfa regresyonları."""

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
            self.assertIn("katalog", row["shaft_source"])
            self.assertIn("(s.", row["shaft_source"])

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

    def test_sew_ac_pages_scope_and_large_frame_shafts(self):
        data = load("sew_ac.json")
        self.assertEqual(data["meta"]["source_pdf"], "SEW_AC motor.pdf")
        self.check_common(data, 49, Counter({4: 27, 2: 11, 6: 11}))
        items = data["items"]
        self.assertEqual(
            {row["technical_page"] for row in items},
            {96, 97, 98, 99, 101, 102, 103, 104, 106, 107, 108},
        )
        self.assertTrue({row["dimension_page"] for row in items} <= set(range(203, 302)))
        self.assertEqual({row["efficiency_class"] for row in items}, {"IE1", "IE2", "IE3"})

        by_model_power = {(row["model"], row["power_kw"]): row for row in items}
        self.assertEqual(
            (by_model_power[("DRP250M4", 45.0)]["shaft_diameter_mm"],
             by_model_power[("DRP250M4", 45.0)]["dimension_page"]),
            (60.0, 295),
        )
        self.assertEqual(
            (by_model_power[("DRP280M4", 75.0)]["shaft_diameter_mm"],
             by_model_power[("DRP280M4", 75.0)]["dimension_page"]),
            (75.0, 296),
        )
        self.assertEqual(
            (by_model_power[("DRP315S4", 110.0)]["shaft_diameter_mm"],
             by_model_power[("DRP315S4", 110.0)]["dimension_page"]),
            (70.0, 299),
        )


if __name__ == "__main__":
    unittest.main()
