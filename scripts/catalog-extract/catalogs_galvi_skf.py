# -*- coding: utf-8 -*-
"""Galvi N.HYD/NV.HYD frenleri ve SKF temel rulman serilerini PDF'ten çıkarır.

Kaynak PDF'ler workspace kökünde tutulur. Çıktılar ise katalog veri klasörüne
yazılır; seed betiği bu JSON dosyalarını Supabase'e taşır.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz


WORKSPACE = Path(__file__).resolve().parents[3]
CATALOG = WORKSPACE / "catalog_data"
GALVI_PDF = WORKSPACE / "Galvi Kasnak Fren.pdf"
SKF_PDF = WORKSPACE / "SKF genel-rulman-katalogu.pdf"


def rows(page: fitz.Page, min_y: float) -> list[list[tuple[float, str]]]:
    """Yakın taban çizgilerindeki sözcükleri tek katalog satırında toplar."""
    out: list[list[tuple[float, str]]] = []
    for x0, y0, _x1, _y1, text, *_ in page.get_text("words", sort=True):
        if y0 < min_y:
            continue
        if not out or abs(y0 - out[-1][0][0]) > 2.2:
            out.append([(y0, x0, text)])
        else:
            out[-1].append((y0, x0, text))
    return [[(x, text) for _y, x, text in line] for line in out]


def cell(line: list[tuple[float, str]], left: float, right: float) -> str:
    return " ".join(text for x, text in line if left <= x < right and text != "▶")


def number(value: str) -> float | None:
    value = value.replace(" ", "").replace(",", ".")
    if not value or value in {"–", "-"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("▶", "")).strip()


def galvi_items() -> list[dict]:
    page = fitz.open(GALVI_PDF)[0]
    items: list[dict] = []
    for line in rows(page, 385):
        model = compact(cell(line, 240, 330))
        if not model.startswith("N(NV)."):
            continue
        torque_values = [number(value) for value in re.findall(r"\d+(?:,\d+)?", cell(line, 330, 365))]
        torque_values = [value for value in torque_values if value is not None]
        torque_min, torque_max = torque_values if len(torque_values) == 2 else (None, None)
        drum_diameter = number(cell(line, 365, 392))
        weight = number(cell(line, 913, 950))
        if None in {torque_min, torque_max, drum_diameter, weight}:
            raise ValueError(f"Galvi satırı eksik okundu: {model}")
        values = {
            "b_mm": number(cell(line, 392, 415)),
            "c_mm": number(cell(line, 415, 441)),
            "d_mm": number(cell(line, 441, 466)),
            "e_mm": number(cell(line, 466, 491)),
            "f_mm": number(cell(line, 491, 515)),
            "g_max_mm": number(cell(line, 515, 540)),
            "h_mm": number(cell(line, 540, 566)),
            "i_mm": number(cell(line, 566, 595)),
            "l_mm": number(cell(line, 595, 620)),
            "mount_bore_mm": number(cell(line, 620, 645)),
            "n_mm": number(cell(line, 645, 669)),
            "o_max_mm": number(cell(line, 669, 691)),
            "p_max_mm": number(cell(line, 691, 716)),
            "r_min_mm": number(cell(line, 716, 742)),
            "s_mm": number(cell(line, 742, 766)),
            "shoe_width_cd_mm": number(cell(line, 766, 792)),
            "shoe_width_cl_mm": number(cell(line, 792, 816)),
            "w_mm": number(cell(line, 816, 840)),
            "y_mm": number(cell(line, 840, 864)),
            "v_mm": number(cell(line, 864, 889)),
            "z_mm": number(cell(line, 889, 913)),
        }
        items.append(
            {
                "model": model,
                "brake_type": "drum",
                "drum_diameter_mm": drum_diameter,
                "min_torque_Nm": torque_min,
                "max_torque_Nm": torque_max,
                "brake_torque_Nm": torque_max,
                "thruster_type": "HYD " + model.split(".HYD.", 1)[1],
                "weight_kg": weight,
                **{key: value for key, value in values.items() if value is not None},
            }
        )
    if len(items) != 33:
        raise ValueError(f"Galvi: 33 satır bekleniyordu, {len(items)} okundu")
    return items


def skf_series(model: str) -> str | None:
    clean = model.replace(" ", "")
    if re.match(r"^60\d{2}", clean):
        return "60xx Sabit Bilyalı"
    if re.match(r"^62\d{2}", clean):
        return "62xx Sabit Bilyalı"
    if re.match(r"^63\d{2}", clean):
        return "63xx Sabit Bilyalı"
    if re.match(r"^222\d{2}", clean):
        return "222xx Küresel Makaralı"
    if re.match(r"^223\d{2}", clean):
        return "223xx Küresel Makaralı"
    if re.match(r"^512\d{2}", clean):
        return "512xx Eksenel Bilyalı"
    match = re.match(r"^(NU|NJ)\s*(\d+)", model)
    if match:
        prefix, code = match.groups()
        dimension = code[:-2] if len(code) > 2 else code[0]
        return f"{prefix} {dimension}xx Silindirik Makaralı"
    return None


def skf_rows(doc: fitz.Document, pages: list[int], kind: str) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for page_no in pages:
        previous_bore: float | None = None
        for line in rows(doc[page_no - 1], 285):
            # Tüm bu ürün tablolarında d/D/B/C/C0/Pu/sürat/kütle kolonları
            # sabit x bandındadır. Yalnız model sütunu aileye göre değişir.
            bore = number(cell(line, 30, 65)) or previous_bore
            outer = number(cell(line, 65, 97))
            width = number(cell(line, 97, 125))
            if kind == "thrust":
                dynamic = number(cell(line, 145, 191))
                static = number(cell(line, 191, 239))
                speed = number(cell(line, 385, 425))
                mass = number(cell(line, 425, 475))
            elif kind == "spherical":
                outer = number(cell(line, 60, 90))
                width = number(cell(line, 90, 120))
                dynamic = number(cell(line, 120, 155))
                static = number(cell(line, 155, 190))
                speed = number(cell(line, 255, 300))
                mass = number(cell(line, 290, 330))
            else:
                dynamic = number(cell(line, 125, 158))
                static = number(cell(line, 158, 197))
                speed = number(cell(line, 290, 340))
                mass = number(cell(line, 340, 390))
            model_left = {"deep": 400, "thrust": 475, "cyl": 390, "spherical": 340}[kind]
            model_right = {"deep": 480, "thrust": 560, "cyl": 480, "spherical": 450}[kind]
            model = compact(cell(line, model_left, model_right))
            series = skf_series(model)
            if bore is not None:
                previous_bore = bore
            if (
                not series
                or bore is None
                or outer is None
                or width is None
                or dynamic is None
                or static is None
                or speed is None
                or mass is None
                or model in seen
            ):
                continue
            # Vinç hesaplarında kullanılan standart seri ölçü aralığı. Büyük
            # özel tasarımlar (N1MAS, /xxx vb.) farklı iç geometriler taşıdığı
            # için aynı ISO serisinin monotonluk denetimine dahil edilmez.
            if bore > 200 or "/" in model:
                continue
            if kind == "deep" and not re.fullmatch(r"(?:60|62|63)\d{2}", model):
                continue
            if kind == "thrust" and not re.fullmatch(r"512\d{2}", model):
                continue
            if kind == "cyl" and not re.fullmatch(r"(?:NU|NJ) \d{3,4} ECP", model):
                continue
            if kind == "spherical" and not re.fullmatch(r"(?:222|223)\d{2} (?:E|CC)", model):
                continue
            seen.add(model)
            items.append(
                {
                    "designation": model,
                    "series": series,
                    "bore_mm": bore,
                    "outer_diameter_mm": outer,
                    "width_mm": width,
                    "dynamic_load_kN": dynamic,
                    "static_load_kN": static,
                    "limiting_speed_rpm": speed,
                    "weight_kg": mass,
                }
            )
    return items


def skf_items() -> list[dict]:
    doc = fitz.open(SKF_PDF)
    pages = {
        "deep": [262, 264, 266, 268, 270, 272, 274, 276, 278, 280, 282, 284, 286, 288, 290, 292, 294, 296, 298, 300, 302, 304, 306, 308, 312, 314, 316, 330, 332, 334],
        "thrust": [474, 476, 478, 480, 482, 484, 486],
        "cyl": [518, 520, 522, 524, 526, 528, 530, 532, 534, 536, 538, 540, 542, 544, 546, 548, 550],
        "spherical": [794, 796, 798, 800, 802, 804, 806, 808, 810, 812, 814, 816, 818, 820, 822, 824, 826, 828, 830, 832, 834, 836, 838, 840],
    }
    items = [item for kind, numbers in pages.items() for item in skf_rows(doc, numbers, kind)]
    return sorted(items, key=lambda item: (item["series"], item["bore_mm"], item["designation"]))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    galvi = galvi_items()
    write_json(
        CATALOG / "brakes" / "galvi_nhyd_nvhyd.json",
        {
            "meta": {
                "brand": "GALVI NEWCOMEN",
                "equipment_type": "brake",
                "brake_type": "drum",
                "series": "N.HYD / NV.HYD",
                "source_pdf": "Galvi Kasnak Fren.pdf",
                "extraction_date": "2026-08-07",
                "page_range": "Katalog sayfa 4-5 (tek PDF sayfası)",
                "notes": "DIN 15435 fail-safe shoe brakes; all catalogue dimensions are mm and torque is stated for μ=0.42.",
            },
            "fields": sorted({key for item in galvi for key in item}),
            "items": galvi,
        },
    )
    skf = skf_items()
    write_json(
        CATALOG / "bearings" / "skf.json",
        {
            "meta": {
                "brand": "SKF",
                "equipment_type": "bearing",
                "series": "Standart vinç uygulama serileri",
                "source_pdf": "SKF genel-rulman-katalogu.pdf (PUB BU/P1 17000 EN, Haziran 2018)",
                "extraction_date": "2026-08-07",
                "page_range": "Basılı sayfa 260-838: 60/62/63, 222/223, 512, NU/NJ ürün tabloları",
                "notes": "Tüm sınır ölçüleri mm; yükler kN; hız alanı katalogdaki limiting speed değeridir. Aynı modelin tek taraf kapaklı alternatifleri tekrar kaydı oluşturmamak için alınmamıştır.",
            },
            "fields": [
                "designation", "series", "bore_mm", "outer_diameter_mm", "width_mm",
                "dynamic_load_kN", "static_load_kN", "limiting_speed_rpm", "weight_kg",
            ],
            "items": skf,
        },
    )
    print(f"GALVI: {len(galvi)} fren")
    print(f"SKF: {len(skf)} rulman")


if __name__ == "__main__":
    main()
