# -*- coding: utf-8 -*-
"""İzmit A.Ş. ürün föylerindeki halat tablolarını katalog JSON'larına çıkarır.

Kaynakların tamamı Güven Çelik Halat'ın resmî İzmit Kırmızı Damar ürün
sayfasından indirilmiş iki sayfalık föylerdir. İlk sayfa ürün tanımı ve kullanım
alanlarını, ikinci sayfa gerçek teknik tabloyu taşır. Sayısal veriler yalnız
ikinci sayfadaki tablolardan alınır; başlıktaki çap/sınıf özeti tabloyla
çelişirse tablo esas alınır ve uyuşmazlık meta notunda saklanır.

KULLANIM
  python scripts/catalog-extract/ropes_izmit.py
"""
from __future__ import annotations

from pathlib import Path

import pdfplumber

import ropes_common as rc


SOURCE_DIR = Path(rc.BASE) / "Diğer kataloglar" / "İzmit AŞ"
SOURCE_BASE_URL = "https://guvencelikhalat.com.tr/wp-content/uploads/2026/01"
EXTRA_FIELDS = ("grade_label", "rotation_resistant")


def tr_number(value: object) -> float:
    """PDF tablosundaki Türkçe sayı yazımını sayıya çevirir."""
    text = str(value or "").strip().replace(".", "").replace(",", ".")
    if not text:
        raise ValueError("Boş sayısal hücre")
    return float(text)


def per_meter(value: object) -> float:
    """Föyün kg/100 m değerini kararlı ondalıkla kg/m'ye çevirir."""
    return round(tr_number(value) / 100, 5)


def table_rows(filename: str, table_index: int = 0) -> list[list[object]]:
    path = SOURCE_DIR / filename
    with pdfplumber.open(path) as pdf:
        tables = pdf.pages[1].extract_tables()
    if table_index >= len(tables):
        raise RuntimeError(f"{filename}: {table_index + 1}. tablo bulunamadı")
    rows = tables[table_index]
    if len(rows) <= 3:
        raise RuntimeError(f"{filename}: teknik tablo boş")
    return rows[3:]


def conventional_items(filename: str, *, has_2160: bool) -> list[dict]:
    """FC/IWRC ayrı yük ve ağırlık sütunlu standart tablolar."""
    items: list[dict] = []
    for row in table_rows(filename):
        diameter = tr_number(row[0])
        fc_weight = per_meter(row[6 if has_2160 else 5])
        iwrc_weight = per_meter(row[7 if has_2160 else 6])
        variants = [
            ("FC", 1770, row[1], fc_weight),
            ("IWRC", 1770, row[2], iwrc_weight),
            ("FC", 1960, row[3], fc_weight),
            ("IWRC", 1960, row[4], iwrc_weight),
        ]
        if has_2160:
            variants.append(("IWRC", 2160, row[5], iwrc_weight))
        for core, grade, breaking, weight in variants:
            items.append({
                "diameter_mm": diameter,
                "core_type": core,
                "grade_mpa": grade,
                "breaking_load_kN": tr_number(breaking),
                "weight_kg_per_m": weight,
                "rotation_resistant": False,
            })
    return items


def rotation_resistant_items(filename: str, *, fc_weight_only: bool) -> list[dict]:
    """Ortak kopma yükü basan NUFLEX tabloları.

    35Wx7 föyü IWRC için ağırlık yayımlamaz. O satırlar katalogda var olduğu
    için üretilir, fakat kaynakta bulunmayan metre ağırlığı uydurulmaz.
    """
    items: list[dict] = []
    for row in table_rows(filename):
        diameter = tr_number(row[0])
        weights = {"FC": per_meter(row[3])}
        if not fc_weight_only:
            weights["IWRC"] = per_meter(row[4])
        for core in ("FC", "IWRC"):
            for grade, breaking in ((1770, row[1]), (1960, row[2])):
                item = {
                    "diameter_mm": diameter,
                    "core_type": core,
                    "grade_mpa": grade,
                    "breaking_load_kN": tr_number(breaking),
                    "rotation_resistant": True,
                }
                if core in weights:
                    item["weight_kg_per_m"] = weights[core]
                items.append(item)
    return items


def elevator_items(filename: str) -> list[dict]:
    """FC ve IWRC asansör tablolarındaki tekli/ikili sınıfları çıkarır."""
    items: list[dict] = []
    configs = [
        (0, "FC", [(1, "1180/1770 N/mm²"), (2, "1370/1770 N/mm²"), (3, 1570)], 4),
        (1, "IWRC", [(1, "1180/1770 N/mm²"), (2, "1370/1770 N/mm²"),
                      (3, 1570), (4, 1770)], 5),
    ]
    for table_index, core, grades, weight_col in configs:
        for row in table_rows(filename, table_index):
            diameter = tr_number(row[0])
            weight = per_meter(row[weight_col])
            for load_col, grade in grades:
                item = {
                    "diameter_mm": diameter,
                    "core_type": core,
                    "breaking_load_kN": tr_number(row[load_col]),
                    "weight_kg_per_m": weight,
                    "rotation_resistant": False,
                }
                if isinstance(grade, int):
                    item["grade_mpa"] = grade
                else:
                    item["grade_label"] = grade
                items.append(item)
    return items


def write_series(
    filename: str,
    series: list[tuple[str, str]],
    items: list[dict],
    *,
    application: str,
    notes: str,
    include_grade_label_in_model: bool = False,
) -> int:
    total = 0
    source_url = f"{SOURCE_BASE_URL}/{filename}"
    for output_name, construction in series:
        meta = {
            "brand": "İzmit A.Ş.",
            "equipment_type": "rope",
            "series": construction,
            "source_pdf": f"Diğer kataloglar/İzmit AŞ/{filename}",
            "source_url": source_url,
            "extraction_date": "2026-09-03",
            "page_range": "PDF s.1-2 (teknik tablo s.2)",
            "notes": notes,
            "typical_application": application,
            "datasheet_url": source_url,
        }
        if include_grade_label_in_model:
            # İkili asansör sınıfları sayısal `grade_mpa` değildir. Aynı çap ve
            # özdeki iki gerçek ürünün model kimliğinde basılı sınıfı koru.
            meta["include_grade_label_in_model"] = True
        rc.write(output_name, meta, items, EXTRA_FIELDS)
        total += len(items)
    return total


def main() -> None:
    total = 0
    total += write_series(
        "IZMIT-A.S.-6x7-STD-urun.pdf",
        [("izmit_6x7_std.json", "6x7 (STD)")],
        conventional_items("IZMIT-A.S.-6x7-STD-urun.pdf", has_2160=False),
        application="Vinç",
        notes="6x7 standart halat; FC/IWRC öz ve 1770/1960 MPa değerleri resmî föyün teknik tablosundan çıkarıldı.",
    )
    total += write_series(
        "IZMIT-A.S.-6x19-M-STD-urun.pdf",
        [("izmit_6x19_m_std.json", "6x19 M (STD)")],
        conventional_items("IZMIT-A.S.-6x19-M-STD-urun.pdf", has_2160=False),
        application="Vinç",
        notes=("Föyün tanıtım sayfası Ø6-56 mm aralığı yazar; teknik tablo yalnız Ø3-7 mm "
               "değer yayımlar. Veri, uydurma genişletme yapılmadan yalnız teknik tabloyu taşır."),
    )
    class_6x19 = conventional_items("IZMIT-A.S.-6x19-SINIFI-urun.pdf", has_2160=True)
    total += write_series(
        "IZMIT-A.S.-6x19-SINIFI-urun.pdf",
        [("izmit_6x19_s.json", "6x19 S"), ("izmit_6x19_f.json", "6x19 F"),
         ("izmit_6x19_w.json", "6x19 W"), ("izmit_6x26_ws.json", "6x26 WS")],
        class_6x19,
        application="Vinç",
        notes="6x19 sınıfı ortak teknik tablo; 6x19 S/F/W ve 6x26 WS konstrüksiyonlarına uygulanır.",
    )
    class_6x36 = conventional_items("IZMIT-A.S.-6x36-SINIFI-urun.pdf", has_2160=True)
    total += write_series(
        "IZMIT-A.S.-6x36-SINIFI-urun.pdf",
        [("izmit_6x31_ws.json", "6x31 WS"), ("izmit_6x36.json", "6x36 WS"),
         ("izmit_6x41_ws.json", "6x41 WS")],
        class_6x36,
        application="Vinç",
        notes="6x36 sınıfı ortak teknik tablo; 6x31 WS, 6x36 WS ve 6x41 WS konstrüksiyonlarına uygulanır.",
    )
    total += write_series(
        "IZMIT-A.S.-8x36-WS-urun.pdf",
        [("izmit_8x36_ws.json", "8x36 WS")],
        conventional_items("IZMIT-A.S.-8x36-WS-urun.pdf", has_2160=True),
        application="Vinç",
        notes="8x36 WS teknik tablosu; FC/IWRC öz ve 1770/1960/2160 MPa sınıfları.",
    )
    class_8x19 = conventional_items("IZMIT-A.S.-8x19-SINIFI-urun.pdf", has_2160=True)
    total += write_series(
        "IZMIT-A.S.-8x19-SINIFI-urun.pdf",
        [("izmit_8x19_s.json", "8x19 S"), ("izmit_8x19_f.json", "8x19 F"),
         ("izmit_8x19_w.json", "8x19 W"), ("izmit_8x26_ws.json", "8x26 WS")],
        class_8x19,
        application="Vinç",
        notes="8x19 sınıfı ortak teknik tablo; 8x19 S/F/W ve 8x26 WS konstrüksiyonlarına uygulanır.",
    )
    total += write_series(
        "IZMIT-A.S.-18x7-NUFLEX-urun.pdf",
        [("izmit_18x7_nuflex.json", "18x7 NUFLEX")],
        rotation_resistant_items("IZMIT-A.S.-18x7-NUFLEX-urun.pdf", fc_weight_only=False),
        application="Vinç",
        notes="Dönmeye dirençli 18x7 NUFLEX; ortak FC/IWRC kopma yükleri ve iki özün ayrı ağırlıkları.",
    )
    total += write_series(
        "IZMIT-A.S.-35Wx7-NUFLEX-urun.pdf",
        [("izmit_35wx7_nuflex.json", "35Wx7 NUFLEX")],
        rotation_resistant_items("IZMIT-A.S.-35Wx7-NUFLEX-urun.pdf", fc_weight_only=True),
        application="Vinç",
        notes=("Dönmeye dirençli 35Wx7 NUFLEX. Tanıtım sayfası 1960/2160 sınıflarını "
               "yazar; teknik tablo 1770/1960 sütunları basar ve esas alınmıştır. Teknik tablo "
               "IWRC ağırlığı yayımlamadığı için o alan IWRC satırlarında boş bırakılmıştır."),
    )
    elevator = elevator_items("IZMIT-A.S.-8x19-SINIFI-asansor.pdf")
    total += write_series(
        "IZMIT-A.S.-8x19-SINIFI-asansor.pdf",
        [("izmit_8x19_s_elevator.json", "8x19 S (Asansör)"),
         ("izmit_8x19_f_elevator.json", "8x19 F (Asansör)"),
         ("izmit_8x19_w_elevator.json", "8x19 W (Asansör)")],
        elevator,
        application="Asansör",
        notes=("Asansör halatı ortak teknik tablosu; FC ve IWRC için tekli 1570/1770 MPa "
               "ile basılı ikili 1180/1770 ve 1370/1770 N/mm² sınıfları ayrı satırlardır."),
        include_grade_label_in_model=True,
    )
    if total != 1861:
        raise RuntimeError(f"Beklenen 1861 yerine {total} satır üretildi")
    print(f"İzmit A.Ş.: 19 konstrüksiyon / {total} satır")


if __name__ == "__main__":
    main()
