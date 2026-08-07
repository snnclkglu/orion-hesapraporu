"""SIBRE SP hidrolik tampon kataloğu çıkarımı.

Kaynak: `SIBRE Produktkatalog2022_Puffer_SP.pdf` (workspace kökü).

İki farklı basım aynı PDF'in içinde:
  * s.18  — M 1501 486 E-EN-2021-11: dört tipin ORTAK sayfası. Sönümleme
            kapasitesi (kJ) × strok matrisi = darbe kuvveti (kN) burada.
  * s.19–22 — M 1501 49x E-EN-08-2022: tip başına ayrı, DAHA YENİ sayfalar.
            Anma değerleri, kısma iğnesi (metering pin) tablosu, ağırlıklar.

Ürün değerlerinde 2022 sayfaları esas alınır; s.18 yalnız matris için okunur
ve iki basım arasındaki farklar `meta.discrepancies` altında raporlanır.

Çıktılar:
  catalog_data/buffers/sibre_sp_hydraulic.json
  catalog_data/buffers/sibre_sp_metering_pins.json
"""

from __future__ import annotations

import fitz

from buffers_common import PDF_SIBRE, clean, num, write_json

# Tip başına sayfa (0 tabanlı) ve tip kodu
TYPE_PAGES = {65: 18, 80: 19, 100: 20, 125: 21}
MATRIX_PAGE = 17

# Katalogun kendi kabulü (s.18): "The specified final forces are already
# applied with a damping efficiency of 0.85" → F = Ea / (s · 0,85)
DAMPING_EFFICIENCY = 0.85


def page_rows(page: "fitz.Page", tol: float = 2.0) -> list[tuple[float, list]]:
    """Sayfanın kelimelerini y'ye göre satırlara toplar, x'e göre sıralar."""
    buckets: dict[float, list] = {}
    for w in page.get_text("words"):
        key = round(w[1] / tol) * tol
        buckets.setdefault(key, []).append(w)
    return [(y, sorted(buckets[y], key=lambda w: w[0])) for y in sorted(buckets)]


# --------------------------------------------------------------------------
# 1) Tip sayfaları (s.19–22)
# --------------------------------------------------------------------------


def parse_type_page(page: "fitz.Page", sp_type: int) -> dict:
    """Bir tip sayfasından ana tablo + kısma iğnesi tablosu + ağırlıkları okur."""
    rows = page_rows(page)

    main: dict[int, dict] = {}          # strok → {energy, end_force, L1..b}
    pins: dict[int, dict[float, str]] = {}  # strok → {tasarım kütlesi üst sınırı: kod}
    weights: dict[int, dict] = {}       # strok → {ff, bf, restoring}
    mass_classes: list[float] = []
    mass_x: list[float] = []

    mode = "main"
    for _y, ws in rows:
        texts = [w[4] for w in ws]
        line = " ".join(texts)

        # --- bölüm geçişleri
        if "Design" in texts and "mass" in texts:
            mode = "pins"
            continue
        if "Weight" in texts:
            mode = "weights"
            continue
        if texts[:2] == ["up", "to"]:
            # "up to 5 | up to 10 | ..." başlığı: sınıf değerleri ve x merkezleri
            mass_classes, mass_x = [], []
            i = 0
            while i < len(ws) - 2:
                if ws[i][4] == "up" and ws[i + 1][4] == "to":
                    v = num(ws[i + 2][4])
                    if v is not None:
                        mass_classes.append(v)
                        mass_x.append((ws[i + 2][0] + ws[i + 2][2]) / 2)
                    i += 3
                else:
                    i += 1
            continue

        stroke = num(texts[0])
        if stroke is None or stroke != int(stroke or 0) or not (50 <= stroke <= 1000):
            continue
        stroke = int(stroke)

        if mode == "main" and "=" in texts:
            # [W, endForce, L1, L2, L3, d1, d2, d3, a, b] — yalnız "=" ayracı
            # düşer. "-" YER TUTUCUDUR ve None olarak KORUNUR: atılırsa sonraki
            # sütunlar sola kayar (SP 125 / 100 mm satırında L2 ve L3 "-"dir;
            # atıldığında d1 = 26, d2 = 210 gibi saçma bir kayma oluşur).
            vals = [None if t == "=" else num(t) for t in texts[1:]]
            vals = [v for t, v in zip(texts[1:], vals) if t != "="]
            if len([v for v in vals if v is not None]) >= 2:
                keys = ["energy_kj", "end_force_kn", "l1", "l2", "l3",
                        "d1", "d2", "d3", "a", "b"]
                if len(vals) != len(keys):
                    raise RuntimeError(
                        f"SP {sp_type} / {stroke} mm: ana tablo satırında "
                        f"{len(vals)} değer var, {len(keys)} bekleniyor: {texts}"
                    )
                main[stroke] = dict(zip(keys, vals))

        elif mode == "pins" and mass_classes:
            # Kodları x merkezine göre sınıf sütunlarına oturt ("-" boş geçer)
            row: dict[float, str] = {}
            for w in ws[1:]:
                cx = (w[0] + w[2]) / 2
                j = min(range(len(mass_x)), key=lambda k: abs(mass_x[k] - cx))
                if abs(mass_x[j] - cx) > 20:
                    continue
                if w[4].strip("-") == "":
                    continue
                row[mass_classes[j]] = w[4].strip()
            if row:
                pins[stroke] = row

        elif mode == "weights":
            vals = [num(t) for t in texts[1:]]
            ff = vals[0] if len(vals) > 0 else None
            bf = vals[1] if len(vals) > 1 else None
            rest = vals[2] if len(vals) > 2 else None
            if bf is None and rest is None and ff is not None and len(vals) == 2:
                # "-" atıldığı için kayma olabilir; ham metinden yeniden kur
                raw = [t for t in texts[1:]]
                ff = num(raw[0])
                bf = num(raw[1]) if len(raw) > 1 else None
                rest = num(raw[2]) if len(raw) > 2 else None
            # BF sütunu "-" ise (400 mm üstü strok) yalnız FF vardır
            if "-" in texts[1:] and rest is None and bf is not None:
                rest, bf = bf, None
            weights[stroke] = {"ff": ff, "bf": bf, "restoring_kn": rest}

    return {"type": sp_type, "main": main, "pins": pins, "weights": weights}


# --------------------------------------------------------------------------
# 2) Sönümleme kapasitesi × strok matrisi (s.18)
# --------------------------------------------------------------------------


def parse_matrix(page: "fitz.Page") -> tuple[list[dict], dict]:
    """s.18 darbe kuvveti matrisini ve o sayfadaki anma değerlerini okur.

    Dönüş: (matris satırları, {(tip, strok): son kuvvet})
    """
    rows = page_rows(page)

    # Sütun ızgarası: "X = Stroke [mm]" başlığının altındaki 21 sütunluk
    # strok satırı. Tek bir 21'li sayısal satır vardır.
    header_x: list[float] = []
    header_stroke: list[int] = []
    end_force_raw: list[float] = []
    matrix: list[dict] = []

    for _y, ws in rows:
        texts = [w[4] for w in ws]
        if not header_x and len(ws) == 21 and all(num(t) is not None for t in texts):
            header_x = [(w[0] + w[2]) / 2 for w in ws]
            header_stroke = [int(num(t)) for t in texts]
            continue
        if not header_x:
            continue
        if texts[:2] == ["End", "Force"]:
            end_force_raw = [num(w[4]) for w in ws[2:]]
            break  # matris bitti; sonrası ölçü satırları
        cap = num(texts[0])
        if cap is None or cap <= 0 or len(ws) < 2:
            continue
        cells: dict[int, float] = {}
        for w in ws[1:]:
            cx = (w[0] + w[2]) / 2
            j = min(range(21), key=lambda k: abs(header_x[k] - cx))
            if abs(header_x[j] - cx) > 8:
                cells = {}
                break
            v = num(w[4])
            if v is not None:
                cells[j] = v
        if cells:
            matrix.append({"capacity_kj": cap, "cells": cells})

    # Sütun → tip eşlemesi: blok sınırı, strok dizisinin yeniden başladığı yer.
    blocks = [65, 80, 100, 125]
    type_of_col: list[int] = []
    b = 0
    for i, s in enumerate(header_stroke):
        if i > 0 and s <= header_stroke[i - 1]:
            b += 1
        type_of_col.append(blocks[min(b, 3)])

    # s.18 SP 80 sütun başlıkları 600/800 basılmış; aynı sütunların L1/L2/L3
    # ölçüleri s.20'deki 500/600 mm satırlarıyla birebir aynıdır. Baskı hatası
    # düzeltilir (gerekçe dosya meta.notes'ta).
    for i, (t, s) in enumerate(zip(type_of_col, header_stroke)):
        if t == 80 and s == 600 and header_stroke[i - 1] == 400:
            header_stroke[i] = 500
        elif t == 80 and s == 800:
            header_stroke[i] = 600

    end_force = {
        (type_of_col[i], header_stroke[i]): v
        for i, v in enumerate(end_force_raw)
    } if len(end_force_raw) == 21 else {}

    out: list[dict] = []
    for row in matrix:
        for j in sorted(row["cells"]):
            out.append({
                "type": type_of_col[j],
                "stroke_mm": header_stroke[j],
                "capacity_kj": clean(row["capacity_kj"]),
                "impact_force_kn": clean(row["cells"][j]),
            })
    out.sort(key=lambda r: (r["type"], r["stroke_mm"], r["capacity_kj"]))
    return out, end_force


# --------------------------------------------------------------------------
# 3) Birleştirme
# --------------------------------------------------------------------------


def build() -> list[str]:
    doc = fitz.open(PDF_SIBRE)
    parsed = {t: parse_type_page(doc[p], t) for t, p in TYPE_PAGES.items()}
    matrix, matrix_end_force = parse_matrix(doc[MATRIX_PAGE])
    doc.close()

    # s.18 (2021) ile s.19–22 (2022) arasındaki farklar — uydurmadan raporla
    discrepancies: list[str] = []
    for t, data in parsed.items():
        for stroke, m in data["main"].items():
            old = matrix_end_force.get((t, stroke))
            if old is not None and old != m["end_force_kn"]:
                discrepancies.append(
                    f"SP {t} / {stroke} mm son kuvvet: s.18 (2021) {clean(old)} kN, "
                    f"s.{TYPE_PAGES[t] + 1} (2022) {clean(m['end_force_kn'])} kN"
                )
        for (mt, ms) in matrix_end_force:
            if mt == t and ms not in data["main"]:
                discrepancies.append(
                    f"SP {t}: s.18 matrisinde {ms} mm strok sütunu var, "
                    f"s.{TYPE_PAGES[t] + 1} ürün tablosunda yok"
                )

    # --- ürün dosyası: (tip, strok, montaj) üçlüsü bir üründür
    items: list[dict] = []
    for t in sorted(parsed):
        data = parsed[t]
        for stroke in sorted(data["main"]):
            m = data["main"][stroke]
            w = data["weights"].get(stroke, {})
            pin_row = data["pins"].get(stroke, {})
            mass_max = max(pin_row) if pin_row else None
            for mounting, key in (("FF", "ff"), ("BF", "bf")):
                weight = w.get(key)
                if weight is None:
                    continue  # o strokta o montaj basılmamış (BF yalnız ≤400 mm)
                items.append({
                    "model": f"SP {t} {mounting} {stroke}",
                    "type": "hidrolik",
                    "series": f"SP {t}",
                    "stroke_mm": stroke,
                    "energy_capacity_kj": clean(m["energy_kj"]),
                    "max_end_force_kn": clean(m["end_force_kn"]),
                    "max_impact_speed_mps": None,
                    "weight_kg": clean(weight),
                    "mounting": mounting,
                    "metering_pin_code": None,
                    "design_mass_t_max": clean(mass_max),
                    "max_restoring_energy_kn": clean(w.get("restoring_kn")),
                    "damping_efficiency": DAMPING_EFFICIENCY,
                    "length_l1_mm": clean(m.get("l1")),
                    "length_l2_mm": clean(m.get("l2")),
                    "length_l3_mm": clean(m.get("l3")),
                    "body_dia_d1_mm": clean(m.get("d1")),
                    "plunger_dia_d2_mm": clean(m.get("d2")),
                    "bolt_hole_d3_mm": clean(m.get("d3")),
                    "flange_a_mm": clean(m.get("a")),
                    "flange_b_mm": clean(m.get("b")),
                })

    p1 = write_json(
        "sibre_sp_hydraulic.json",
        {
            "brand": "SIBRE",
            "equipment_type": "buffer",
            "buffer_type": "hidrolik",
            "series": "SP",
            "source_pdf": "SIBRE Produktkatalog2022_Puffer_SP.pdf",
            "source_pages": "19-22 (M 1501 493/494/495/496 E-EN-08-2022)",
            "extraction_date": "2026-08-06",
            "damping_efficiency": DAMPING_EFFICIENCY,
            "notes": (
                "Model kodu tip + montaj plakası + strok'tur; SIBRE'nin kendi "
                "tanımlaması buna bir de kısma iğnesi (metering pin) numarası "
                "ekler (örn. SP 65 FF 106) — iğne numarası tasarım kütlesine "
                "göre sibre_sp_metering_pins.json'dan seçilir, bu yüzden ürün "
                "satırında metering_pin_code null'dır. design_mass_t_max o "
                "strokta iğne tablosunda basılı EN BÜYÜK tasarım kütlesi "
                "sınıfıdır (seçim tavanı). BF (arka flanş) yalnız 400 mm ve "
                "altı strokta üretilir; o yüzden uzun stroklarda tek satır "
                "(FF) vardır. max_impact_speed_mps katalogda BASILI DEĞİLDİR "
                "— uydurulmamış, null bırakılmıştır. Katalog darbe kuvvetini "
                "F = Ea / (s · 0,85) ile verir (s.18); enerji kapasitesi de "
                "W = Fson · s · 0,85 ile tutarlıdır."
            ),
            "discrepancies": discrepancies,
        },
        ["model", "type", "series", "stroke_mm", "energy_capacity_kj",
         "max_end_force_kn", "max_impact_speed_mps", "weight_kg", "mounting",
         "metering_pin_code", "design_mass_t_max", "max_restoring_energy_kn",
         "damping_efficiency", "length_l1_mm", "length_l2_mm", "length_l3_mm",
         "body_dia_d1_mm", "plunger_dia_d2_mm", "bolt_hole_d3_mm",
         "flange_a_mm", "flange_b_mm"],
        items,
    )

    # --- kısma iğnesi dosyası: tasarım kütlesi üst sınırı → iğne kodu
    pin_items: list[dict] = []
    for t in sorted(parsed):
        for stroke in sorted(parsed[t]["pins"]):
            row = parsed[t]["pins"][stroke]
            for mass in sorted(row):
                pin_items.append({
                    "series": f"SP {t}",
                    "type": t,
                    "stroke_mm": stroke,
                    "design_mass_t_max": clean(mass),
                    "metering_pin_code": row[mass],
                })

    p2 = write_json(
        "sibre_sp_metering_pins.json",
        {
            "brand": "SIBRE",
            "equipment_type": "buffer_metering_pin",
            "series": "SP",
            "source_pdf": "SIBRE Produktkatalog2022_Puffer_SP.pdf",
            "source_pages": "19-22 (Design mass [t] tabloları)",
            "extraction_date": "2026-08-06",
            "known_print_errors": [
                {"series": "SP 65", "stroke_mm": 600, "design_mass_t_max": 300,
                 "printed_code": "612", "expected_code": "614",
                 "reason": "bir önceki sütunla aynı basılmış; SP 80/100/125 "
                           "sayfalarındaki 614/616 örüntüsü bunu gösterir"},
                {"series": "SP 65", "stroke_mm": 800, "design_mass_t_max": 300,
                 "printed_code": "812", "expected_code": "814",
                 "reason": "aynı örüntü"},
                {"series": "SP 100", "stroke_mm": 200, "design_mass_t_max": 20,
                 "printed_code": "260", "expected_code": "206",
                 "reason": "komşuları 204 ve 208; rakamlar yer değiştirmiş"},
            ],
            "notes": (
                "Kısma iğnesi (throttle/metering pin) numarası SIPARİŞ KODUNUN "
                "son parçasıdır. Seçim: hesaplanan tasarım kütlesi ma (iki "
                "tampon paralel çalışıyorsa ma/2 — katalog s.14) verilen strok "
                "satırında design_mass_t_max değerlerinden BÜYÜK-EŞİT olan EN "
                "KÜÇÜĞÜ ile eşlenir. Sınıf üst sınırını aşan kütle için o "
                "strokta iğne YOKTUR (daha büyük tip/strok gerekir). "
                "Üç BASKI HATASI şüphesi BASILI HÂLİYLE alınmıştır, "
                "düzeltilmemiştir; hepsi meta.known_print_errors altında "
                "gerekçesi ve olması gereken değeriyle listelidir. Sipariş "
                "verilirken bu üç hücre için SIBRE'ye teyit ettirilmelidir."
            ),
        },
        ["series", "type", "stroke_mm", "design_mass_t_max", "metering_pin_code"],
        pin_items,
    )

    # --- sönümleme kapasitesi × strok matrisi
    p3 = write_json(
        "sibre_sp_force_matrix.json",
        {
            "brand": "SIBRE",
            "equipment_type": "buffer_force_matrix",
            "series": "SP",
            "source_pdf": "SIBRE Produktkatalog2022_Puffer_SP.pdf",
            "source_pages": "18 (M 1501 486 E-EN-2021-11)",
            "extraction_date": "2026-08-06",
            "damping_efficiency": DAMPING_EFFICIENCY,
            "known_print_errors": [
                {
                    "type": 65, "stroke_mm": 600, "capacity_kj": 50,
                    "printed_kn": 118, "expected_kn": 98,
                    "reason": "F = 50/(0,6·0,85) = 98,0 kN. Basılı 118 kN, "
                              "aynı sütunun 60 kJ satırının değeridir.",
                },
                {
                    "type": 65, "stroke_mm": 600, "capacity_kj": 60,
                    "printed_kn": 156, "expected_kn": 118,
                    "reason": "F = 60/(0,6·0,85) = 117,6 kN. Basılı 156 kN, "
                              "80 kJ satırının değerine (156,9) denk düşer; "
                              "o hücre son kuvvet sınırı 150 kN aşıldığı için "
                              "zaten basılmamalıydı.",
                },
            ],
            "notes": (
                "Sönümlenen enerji (capacity_kj) × strok → oluşan darbe kuvveti. "
                "Katalog bu tabloyu F = Ea / (s · 0,85) bağıntısından üretmiştir; "
                "buffers_validate.py her hücreyi bu bağıntıya karşı doğrular. "
                "Tablo yalnız F ≤ son kuvvet sınırı olan hücreleri basar; boş "
                "hücre 'o strokta o enerji sönümlenemez' demektir. "
                "s.18 SP 80 sütun başlıklarında son iki strok 600/800 yazar, "
                "oysa aynı sütunların L1/L2/L3 ölçüleri s.20'deki 500/600 mm "
                "satırlarıyla birebir aynıdır — başlık baskı hatasıdır ve "
                "burada 500/600 olarak DÜZELTİLMİŞTİR (gerekçe: ölçü eşleşmesi "
                "+ 1 kJ'de basılı 2 kN değeri 1/(0,6·0,85)=1,96'ya uyar, "
                "1/(0,8·0,85)=1,47'ye uymaz). "
                "SP 65 / 600 mm sütununun 50 ve 60 kJ hücreleri bağıntıyı "
                "SAĞLAMAZ; basılı hâliyle bırakılmış ve meta.known_print_errors "
                "altında hesaplanan doğru değerleriyle birlikte kayda "
                "geçirilmiştir — DÜZELTİLMEMİŞTİR, çünkü katalogun ne dediği "
                "ile ne demesi gerektiği ayrı bilgilerdir."
            ),
        },
        ["type", "stroke_mm", "capacity_kj", "impact_force_kn"],
        matrix,
    )

    return [p1, p2, p3]


if __name__ == "__main__":
    for path in build():
        print("yazıldı:", path)
