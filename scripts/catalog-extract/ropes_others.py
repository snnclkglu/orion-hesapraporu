# -*- coding: utf-8 -*-
"""Haşçelik · OLIVEIRA · DIEPA vinç halatı ürün sayfaları.

Beş ayrı PDF, hepsi TEK ürünün iki sayfalık ürün föyü: 1. sayfa konstrüksiyon
ve uygulama, 2. (DIEPA'da 2–4.) sayfa çap–kopma kuvveti–ağırlık tablosu.

Tabloların sütun düzeni markadan markaya değişir ama hepsi aynı yöntemle
okunur: başlık satırındaki birim etiketleri (mm · inç · kN · kg/m …) ÇAPA
kabul edilir, gövdedeki her sayı en yakın çapaya düşer. Sabit sütun indisine
güvenilmez — boş hücre (yalnız inç olarak basılan ara ölçüler) sırayı kaydırır.

MUKAVEMET SINIFI katalogun BASTIĞI sınıftır. Haşçelik ürün föylerinde tablo
başlığı "Class 1960" der, dipnot ise kopma kuvvetinin ortalama 2060 N/mm²
üzerinden hesaplandığını söyler: sınıf 1960'tır, 2060 üretim ortalamasıdır ve
seçim sınıfa göre yapılır.
"""
from __future__ import annotations

import sys

import ropes_common as rc

# ------------------------------------------------------------------ Haşçelik
# Başlık iki satıra bölünmüştür ("Class 1960" üstte, "kN" altta); çapa olarak
# ALT satır (birim satırı) kullanılır.
HASCELIK = [
    {
        "pdf": "Hasçelik H 18 LRC.pdf",
        "series": "18x7 LRC (H 18 LRC)",
        "core": "IWRC",
        "grades": [1960],
        "rotation_resistant": True,
        "compacted": True,
        "notes": ("Dönmeye dirençli, kalibreli 18 toron. 126 tel / 84 taşıyıcı tel, "
                  "dolgu faktörü 0,623. Kopma kuvveti katalogda ortalama 2060 N/mm² "
                  "tel dayanımına göre hesaplanmıştır; SINIF 1960'tır. "
                  "Fırdöndü ile en az 2 salımda kullanılabilir."),
    },
    {
        "pdf": "Hasçelik halat H 8K PI.pdf",
        "series": "8xK26/K31/K36 WS (H 8K PI)",
        "core": "IWRC-PI",
        "grades": [1960, 2160],
        "rotation_resistant": False,
        "compacted": True,
        "notes": ("8 compact toron + IWRC, plastik dolgulu. Önerilen konstrüksiyon "
                  "çap bandına göre değişir: 8xK26 WS 16–28,6 mm · 8xK31 WS 30–42 mm · "
                  "8xK36 WS 44–52 mm. Yalnız çapraz sarım. Kopma kuvveti ortalama "
                  "2060 N/mm² tel dayanımına göre hesaplanmıştır."),
    },
]

HASCELIK_ROLES = {"mm": "mm", "Inch": "inch", "mm²": "area", "kg/m": "kg_per_m", "kN": "kN"}

# -------------------------------------------------------- OLIVEIRA ve DIEPA
# Güven Çelik Halat ürün föyleri (04/2019). Başlık birim satırı parantezlidir.
GUVEN_ROLES = {
    "(mm)": "mm", "(inç)": "inch", "(kN)": "kN",
    "(kg/m)": "kg_per_m", "(kg/100": "kg_per_100m",
}

# `datasheet_url` seed tarafından `cat_equipment.datasheet_url` alanına yazılır
# ve ekipman listesinde MODEL hücresini üreticinin föyüne bağlar (KATALOG-13'te
# tarif edilen "yönetim panelinden girilen datasheet" yolunun katalogdan gelen
# hâli). Föyler bu adresten indirilmiştir.
GUVEN_URL = "https://guvencelikhalat.com.tr/wp-content/uploads/2026/01/"

GUVEN = [
    {
        "pdf": "OLIVEIRA-DP-8-K-PPI-urun.pdf",
        "brand": "OLIVEIRA",
        "series": "8xK12/K17/K26/K31 (DP 8 K PPI)",
        "core": "IWRC-PPI",
        "pages": [1],
        "rotation_resistant": False,
        "compacted": True,
        "notes": ("8 compact toron, plastik enjeksiyonlu (PPI). Kategori (RCN) çap "
                  "bandına göre: 8xK12 6,4–7,2 mm · 8xK17 8–17 mm · 8xK26 18–28,58 mm · "
                  "8xK31 30–38 mm. PPI seçeneği yalnız 13 mm üstü çaplarda; PPI'lı "
                  "halatta ağırlık %1,5 artar. Fırdöndü ile kullanılmaz, sapma açısı "
                  "1,3°'den küçük olmalıdır."),
    },
    {
        "pdf": "OLIVEIRA-HD-8-K-PPI-urun.pdf",
        "brand": "OLIVEIRA",
        "series": "8xK12/K17/K26/K31 (HD 8 K PPI)",
        "core": "IWRC-PPI",
        "pages": [1],
        "rotation_resistant": False,
        "compacted": True,
        "notes": ("8 compact toron, plastik enjeksiyonlu (PPI). Dönme direncinin "
                  "gerekmediği yerlerde (ikili vinç sistemi, düşük kaldırma yüksekliği) "
                  "kullanılır; kepçe açma-kapama halatı olarak da geçer. PPI seçeneği "
                  "yalnız 13 mm üstü çaplarda; PPI'lı halatta ağırlık %1,5 artar."),
    },
    {
        "pdf": "Diepa H43 Özellikler ve Teknik Bilgiler.pdf",
        "url": "DIEPA-H-43-1.pdf",
        "brand": "DIEPA",
        "series": "8 demetli plastik dolgulu (H 43)",
        "core": "IWRC-PI",
        "pages": [1, 2, 3],
        "rotation_resistant": False,
        "compacted": True,
        "notes": ("Özü ve damarları arası boşluk püskürtme yöntemiyle plastikle "
                  "doldurulmuş 8 demetli halat. Yalnız çapraz sarım; fırdöndü ile "
                  "kullanılmaz. Ağırlık katalogda kg/100 m basılıdır, burada kg/m'ye "
                  "çevrilmiştir. KATALOG HATASI: Ø30 satırının ağırlığı 499 kg/100 m "
                  "basılmıştır ve komşu çaplarla (Ø29 426 · Ø31 482) tutarsızdır; "
                  "basılı değer korunmuştur, düzeltilmemiştir."),
    },
]


def _header_row(page, roles, need):
    """Başlık BLOĞUNU bulur ve (gövde üst sınırı, çapalar) döndürür.

    Birim etiketleri tek satırda olmayabilir: Haşçelik föyünde "mm / Inch /
    kg/m" bir satırda, "mm² / kN" bir alttadır. Bu yüzden en alttaki etiket
    satırı bulunur ve onun 12 punto üstündeki etiketli satırlar da çapaya
    katılır."""
    rows = rc.rows_of(rc.words(page))
    labelled = [(y, row) for y, row in rows if any(w[4] in roles for w in row)]
    hit = next((y for y, row in labelled if need <= {w[4] for w in row}), None)
    if hit is None:
        # `need` etiketleri ayrı satırlarda olabilir; en alttaki etiket satırını al
        seen = set()
        for y, row in labelled:
            seen |= {w[4] for w in row}
            if need <= seen:
                hit = y
                break
    if hit is None:
        sys.exit(f"başlık satırı bulunamadı ({sorted(need)})")
    block = [w for y, row in labelled if hit - 12 <= y <= hit + 2 for w in row]
    return hit, rc.anchors_from(sorted(block), roles)


def _rows_to_items(rows, grades, kn_x, core, spec):
    items = []
    for _, cells in rows:
        dia = rc.num(rc.cell_text(cells, "mm"))
        inch = rc.cell_join(cells, "inch")
        inch = rc.inch_label(inch) if inch else None
        if dia is None and inch:
            dia = rc.inch_to_mm(inch)
        if dia is None:
            continue
        weight = rc.num(rc.cell_text(cells, "kg_per_m"))
        if weight is None:
            per100 = rc.num(rc.cell_text(cells, "kg_per_100m"))
            weight = round(per100 / 100, 4) if per100 is not None else None
        loads = [rc.num(v) for v in rc.by_anchor(cells, "kN", kn_x)]
        for grade, load in zip(grades, loads):
            if load is None:
                continue
            it = {
                "diameter_mm": dia,
                "core_type": core,
                "grade_mpa": grade,
                "breaking_load_kN": load,
                "weight_kg_per_m": weight,
            }
            if inch:
                it["diameter_inch"] = inch
            area = rc.num(rc.cell_text(cells, "area"))
            if area is not None:
                it["steel_area_mm2"] = area
            it.update(spec)
            items.append(it)
    return items


EXTRA = ("diameter_inch", "steel_area_mm2", "rotation_resistant", "compacted")


def build_hascelik():
    for cfg in HASCELIK:
        d = rc.open_src(cfg["pdf"])
        page = d[1]
        hy, anchors = _header_row(page, HASCELIK_ROLES, {"mm", "kN"})
        kn_x = sorted(x for role, x in anchors if role == "kN")
        if len(kn_x) != len(cfg["grades"]):
            sys.exit(f"{cfg['pdf']}: {len(kn_x)} kN sütunu, {len(cfg['grades'])} sınıf")
        rows = rc.read_rows(page, anchors, hy + 4, page.rect.height)
        spec = {"rotation_resistant": cfg["rotation_resistant"],
                "compacted": cfg["compacted"]}
        items = _rows_to_items(rows, cfg["grades"], kn_x, cfg["core"], spec)
        if not items:
            sys.exit(f"{cfg['pdf']}: satır okunamadı")
        name = "hascelik_" + cfg["series"].split("(")[1].strip(")").lower().replace(" ", "_")
        rc.write(f"{name}.json", {
            "brand": "Haşçelik",
            "equipment_type": "rope",
            # Her ikisi de vinç kaldırma halatıdır (seçicinin kullanım alanı
            # süzgeci); föylerin "Uygulamalar" kutusu böyle der.
            "typical_application": "Vinç",
            "series": cfg["series"],
            "source_pdf": cfg["pdf"],
            "extraction_date": "2026-08-09",
            "page_range": "2",
            "notes": cfg["notes"],
        }, items, extra_fields=EXTRA)
        d.close()


def build_guven():
    for cfg in GUVEN:
        d = rc.open_src(cfg["pdf"])
        items = []
        grades = None
        for pno in cfg["pages"]:
            page = d[pno]
            hy, anchors = _header_row(page, GUVEN_ROLES, {"(mm)", "(kN)"})
            # Mukavemet sınıfları başlığın üstündeki "1960 N/mm²" etiketlerinden
            page_grades = []
            ws = [w for w in rc.words(page) if w[1] < hy]
            for _, row in rc.rows_of(ws):
                for i, w in enumerate(row):
                    if w[4] == "N/mm²" and i and w and row[i - 1][4].isdigit():
                        page_grades.append(int(row[i - 1][4]))
            if grades is None:
                grades = page_grades
            elif page_grades != grades:
                sys.exit(f"{cfg['pdf']} s.{pno}: sınıflar sayfadan sayfaya değişiyor")
            kn_x = sorted(x for role, x in anchors if role == "kN")
            if len(kn_x) != len(grades):
                sys.exit(f"{cfg['pdf']} s.{pno}: {len(kn_x)} kN sütunu, {len(grades)} sınıf")
            rows = rc.read_rows(page, anchors, hy + 4, page.rect.height - 25)
            spec = {"rotation_resistant": cfg["rotation_resistant"],
                    "compacted": cfg["compacted"]}
            items += _rows_to_items(rows, grades, kn_x, cfg["core"], spec)
        if not items:
            sys.exit(f"{cfg['pdf']}: satır okunamadı")
        slug = cfg["series"].split("(")[1].strip(")").lower().replace(" ", "_")
        rc.write(f"{cfg['brand'].lower()}_{slug}.json", {
            "brand": cfg["brand"],
            "equipment_type": "rope",
            "typical_application": "Vinç",
            "series": cfg["series"],
            "source_pdf": cfg["pdf"],
            "source_doc": "Güven Çelik Halat ürün föyü, 04/2019",
            "datasheet_url": GUVEN_URL + cfg.get("url", cfg["pdf"]),
            "extraction_date": "2026-08-09",
            "page_range": ", ".join(str(p + 1) for p in cfg["pages"]),
            "notes": cfg["notes"],
        }, items, extra_fields=EXTRA)
        d.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build_hascelik()
    build_guven()
