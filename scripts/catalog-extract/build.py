# -*- coding: utf-8 -*-
"""catalog_data/reducers/yilmaz_{m,dr,h}.json dosyalarını üretir.

Performans satırlarını (extract.py) mil çaplarıyla (shafts.py) birleştirir ve
her satıra kullanım grubunu (yürütme / kaldırma) işler.
"""
import io
import json
import os
import re

import fitz

import extract
import shafts

OUT_DIR = os.path.join(shafts.BASE, "catalog_data", "reducers")
STAGE_LABEL = {2: "2 kademe", 3: "3 kademe", 4: "4 kademe", 5: "5 kademe", 6: "6 kademe"}


def frame_and_stage(model):
    """DT173 → ('17', 3) · HT0323 → ('03', 3) · MT002 → ('00', 2).

    Gövde büyüklüğü ilk iki basamak, KADEME SAYISI son basamaktır (katalog tip
    tanımlaması, M kataloğu s.10). H/B serisinde araya sabit bir tasarım kodu
    ("2") girer. Kademe okuması çevrim oranı aralığıyla doğrulanmıştır:
    HT0321 i=1,54…5,06 (tek kademe) · HT0322 i=5,33…19,18 · HT0323 i=20,7…75,1.
    """
    digits = re.sub(r"^[A-Z]+", "", model)
    if len(digits) < 3:
        return digits[:2], None
    return digits[:2], int(digits[-1])


def order_keys(it):
    """Anlamlı alan sırası — JSON elle de okunabilir olsun."""
    first = ["model", "series", "input_configuration", "performance_table_model",
             "application", "frame_size", "stages", "ratio",
             "output_torque_Nm", "output_speed_rpm", "input_speed_rpm",
             "nominal_power_kw", "thermal_power_kw", "thermal_power_fan_kw",
             "permitted_radial_load_output_N", "permitted_radial_load_input_N",
             "weight_kg", "output_shaft_diameter_mm", "input_shaft_diameter_mm",
             "hollow_bore_mm", "technical_page", "dimension_page"]
    out = {k: it[k] for k in first if k in it}
    for k in sorted(it):
        if k not in out:
            out[k] = it[k]
    return out


def write(name, meta, items):
    fields = []
    for it in items:
        for k in it:
            if k not in fields:
                fields.append(k)
    # Hiçbir satırda değeri olmayan alanı taşıma (o katalogda karşılığı yok)
    empty = [f for f in fields if all(i.get(f) is None for i in items)]
    if empty:
        print(f"  {name}: karşılığı olmayan alanlar atıldı: {empty}")
        fields = [f for f in fields if f not in empty]
        items = [{k: v for k, v in i.items() if k in fields} for i in items]
    meta["item_count"] = len(items)
    meta["model_count"] = len({i["model"] for i in items})
    path = os.path.join(OUT_DIR, name)
    io.open(path, "w", encoding="utf-8").write(
        json.dumps({"meta": meta, "fields": fields, "items": items},
                   ensure_ascii=False, indent=1))
    filled = {f: sum(1 for i in items if i.get(f) is not None) for f in fields}
    print(f"{name}: {len(items)} satır, {meta['model_count']} model")
    for f in fields:
        if filled[f] < len(items):
            print(f"    {f:34} dolu {filled[f]}/{len(items)}")


# ------------------------------------------------------------------- M serisi

def build_m():
    d = fitz.open(os.path.join(shafts.BASE, "YILMAZ M KATALOG.pdf"))
    items = []
    for p in range(320, 332):
        items += extract.parse_gear_unit_page(d[p - 1])
    d.close()
    ms, warn = shafts.m_series()
    assert not warn, warn
    for it in items:
        frame, stage = frame_and_stage(it["model"])
        it["series"] = it["model"][0]          # M ya da N
        it["application"] = "yurutme"
        it["frame_size"] = frame
        it["stages"] = stage
        sh = ms.get(it["model"])
        it["output_shaft_diameter_mm"] = sh[0] if sh else None
        it["input_shaft_diameter_mm"] = sh[1] if sh else None
        it["hollow_bore_mm"] = None
    write("yilmaz_m.json", {
        "brand": "Yılmaz Redüktör",
        "equipment_type": "reducer",
        "series": "M / N",
        "application": "yurutme",
        "source_pdf": "YILMAZ M KATALOG.pdf",
        "extraction_date": "2026-08-06",
        "page_range": "320-331 (Motorsuz Güç Devir Sayfaları)",
        "shaft_source": "Ölçü sayfaları s.333-393 (teknik resim Ø etiketleri)",
        "notes": (
            "M ve N serisi helisel dişli redüktörler, MOTORSUZ (gear unit) "
            "tablolarından. Uygulama redüktör ile motoru ayrı seçtiği için "
            "motorlu tablolar değil bunlar kullanıldı. Ma (anma momenti), n2 ve "
            "Fqam/Fqem değerleri n1=1450 d/dak içindir; diğer giriş devirlerine "
            "ait nominal güçler nominal_power_kw_n1_* alanlarındadır. "
            "Ma, katalog tanımıyla redüktörün fs=1 şartında mekanik olarak "
            "taşıdığı momenttir."
        ),
    }, [order_keys(i) for i in items])


# ------------------------------------------------------------------- D serisi

def build_dr():
    d = fitz.open(os.path.join(shafts.BASE, "YILMAZ DR KATALOG.pdf"))
    items = []
    for p in range(252, 263):
        items += extract.parse_gear_unit_page(d[p - 1])
    d.close()
    bores = shafts.d_series_bores()
    variants = []
    for it in items:
        performance_model = it["model"]
        frame, stage = frame_and_stage(performance_model)
        bore = bores.get(frame)
        for prefix, configuration, dimension_offset in [
            ("DT", "Motorsuz mil girişli", 0),
            ("DR", "Motor akuple", -170),
        ]:
            row = dict(it)
            row["model"] = prefix + performance_model[2:]
            # Teknik değerler D serisinin motorsuz performans tablosundaki aynı
            # gövde satırıdır. Bu alan, katalog sayfası keşfinde DR modelini
            # tabloda basılı DT koduyla aramak için açık bir kaynak bağıdır.
            row["performance_table_model"] = performance_model
            row["series"] = prefix
            row["input_configuration"] = configuration
            row["application"] = "yurutme"
            row["frame_size"] = frame
            row["stages"] = stage
            row["dimension_page"] += dimension_offset
            row["hollow_bore_mm"] = bore
            row["output_shaft_diameter_mm"] = bore  # D serisi delik milli teslim edilir
            row["input_shaft_diameter_mm"] = None
            variants.append(row)
    write("yilmaz_dr.json", {
        "brand": "Yılmaz Redüktör",
        "equipment_type": "reducer",
        "series": "DT / DR",
        "application": "yurutme",
        "source_pdf": "YILMAZ DR KATALOG.pdf",
        "extraction_date": "2026-08-06",
        "page_range": "252-262 (D Serisi Motorsuz Güç Devir Sayfaları)",
        "shaft_source": "s.322 'D serisi redüktör kovan ölçüleri' tablosu (d, H7)",
        "notes": (
            "D serisi paralel milli helisel redüktörler. DT (motorsuz mil "
            "girişli) ve DR (motor akuple) aynı redüktör gövdesinin iki giriş "
            "bağlantısıdır; mekanik performansları motorsuz (gear unit) "
            "tablosundaki aynı satırdan gelir. DR satırlarında "
            "performance_table_model karşılık gelen DT kodudur. Ölçü sayfası "
            "DT için katalogdaki sütundan, DR için kataloğun ayrı DR ölçü "
            "bölümünden alınır (DR = DT - 170 fiziksel sayfa). Motorun kendi "
            "verileri ve ağırlığı bu redüktör satırına eklenmez. D serisi "
            "DELİK MİLLİ (kovan) teslim edilir; "
            "output_shaft_diameter_mm = kovan delik çapı d (H7). Ma, n2 ve "
            "Fqam/Fqem n1=1450 d/dak içindir. Giriş mili çapı katalogda tablo "
            "hâlinde verilmediğinden boş bırakıldı."
        ),
    }, [order_keys(i) for i in variants])


# ----------------------------------------------------------------- H/B serisi

def build_h():
    d = fitz.open(os.path.join(shafts.BASE, "YILMAZ H KATALOG.pdf"))
    items = []
    for p in list(range(104, 234, 2)) + list(range(416, 506, 2)):
        # `p` performans tablosunun fiziksel sol sayfasıdır; sağdaki devam
        # sayfası `p + 1`dir. Model kodu ve sayısal değerlerle sonradan PDF
        # aramak H kataloğunda güvenli değildir: aynı model/oran rakamları beş
        # ayrı n1 bloğunda tekrar eder ve yakın bir blok yanlış eşleşebilir.
        # Bu yüzden çıkarım anında kesin sayfa kimliğini satıra yazıyoruz.
        spread = extract.parse_h_spread(d, p)
        for item in spread:
            item["technical_page"] = p
        items += spread
    d.close()
    sh, warn = shafts.hb_shafts(pages=list(range(236, 415)) + list(range(507, 577)))
    bores = shafts.hb_series_bores()
    if warn:
        print("  H/B mil uyarıları:", warn)
    for it in items:
        frame, stage = frame_and_stage(it["model"])
        it["series"] = it["model"][0]          # H ya da B
        it["application"] = "kaldirma"
        it["frame_size"] = frame
        it["stages"] = stage
        rec = sh.get(it["model"], {})
        it["output_shaft_diameter_mm"] = rec.get("output")
        it["hollow_bore_mm"] = rec.get("bore")
        it["shrinkdisc_bore_mm"] = bores.get(frame)
        inp = None
        for lo, hi, dia in rec.get("input_bands", []):
            if lo - 1e-9 <= it["ratio"] <= hi + 1e-9:
                inp = dia
                break
        it["input_shaft_diameter_mm"] = inp
    write("yilmaz_h.json", {
        "brand": "Yılmaz Redüktör",
        "equipment_type": "reducer",
        "series": "H / B",
        "application": "kaldirma",
        "source_pdf": "YILMAZ H KATALOG.pdf",
        "extraction_date": "2026-08-06",
        "page_range": "104-233 (H serisi) + 416-505 (B serisi), her ikisi de "
                      "n1 = 1400/900/750/450/300 için ayrı bloklar",
        "shaft_source": "Ölçü sayfaları s.236-414 ve s.507-576 (montaj düzeni 01 = "
                        "masif çıkış mili, düzen 00 = delik mil, alt tablo = "
                        "orana göre giriş mili) + s.579 sıkma bileziği tablosu",
        "notes": (
            "H (helisel-konik) ve B (helisel) serisi redüktörler. Her satır bir "
            "(model, çevrim oranı, giriş devri) üçlüsüdür — anma momenti giriş "
            "devrine göre değiştiği için beş devir bloğu da alındı. Radyal yükler "
            "katalogda kN basılıdır, burada N'a çevrildi. thermal_power_kw = Pt1 "
            "(ek soğutmasız), thermal_power_fan_kw = Pt2 (fanlı), 20 °C ortam. "
            "Giriş mili çapı aynı gövdede çevrim oranı bandına göre değişir."
        ),
    }, [order_keys(i) for i in items])


if __name__ == "__main__":
    build_m()
    print()
    build_dr()
    print()
    build_h()
