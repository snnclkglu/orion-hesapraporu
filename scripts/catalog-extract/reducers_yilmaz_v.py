"""VR gövde/oran defteri: motorlu kombinasyonlar kapasite olarak kullanılmaz.

V0500-1018 s.356-357: basılı fs=1 anma momenti, 1400 d/d performansı.
V0601-0920 s.38-342: oran ve motorlu ağırlık kanıtları; s.344-350: ölçüler.
Çalıştırma: python scripts/catalog-extract/reducers_yilmaz_v.py
"""
from pathlib import Path
import json
import re
import hashlib
import importlib.util
import sys
import pymupdf as fitz

REPO = Path(__file__).resolve().parents[2]
WORKSPACE = REPO.parent
SOURCE = WORKSPACE / "YILMAZ V SERİSİ.pdf"
PERFORMANCE = WORKSPACE / "Diğer kataloglar/YILMAZ V PERFORMANS V0500-1018.pdf"
OUT = WORKSPACE / "catalog_data/reducers/yilmaz_v.json"
NUMBER = r"\d+(?:,\d+)?"
ROW = re.compile(rf"^\s*(\d+)\s+(\d+,\d+)\s+({NUMBER})\s+(?:(\d+)\s+(VR\d{{3}})\.{{3}}\s+)?((?:{NUMBER}\s+){{8}}\d+)\s*$")
MOTOR_ROW = re.compile(r"(\d+,\d+)\s+(VR\d{3})\.1K-(\S+)\s+(\d+)\s+(\d+)(?:\s+(\d{3}))?\s*$")
SPLINES = ["W35x2x30x16x8f", "W45x2x30x21x8f", "W50x2x30x24x8f", "W70x3x30x22x8f", "W95x3x30x30x8f", "W110x4x30x26x8f", "W120x4x30x28x8f"]


def number(value):
    return float(value.replace(",", "."))


def extract():
    source = fitz.open(SOURCE)
    performance = fitz.open(PERFORMANCE)
    assert len(source) == 358 and len(performance) == 382
    observed = {}
    page_reference_errors = []
    for page_index in range(37, 342):
        for line in source[page_index].get_text(sort=True).splitlines():
            match = MOTOR_ROW.search(line)
            if not match:
                continue
            ratio, model, motor, radial, weight, dimension = match.groups()
            key = (model, number(ratio))
            observed.setdefault(key, []).append({"motor": motor, "weight_kg": int(weight), "page": page_index + 1})
            if dimension and int(dimension) != 342 + int(model[2]):
                page_reference_errors.append({"page": page_index + 1, "model": model, "printed_dimension_page": int(dimension)})

    items = []
    for page_number in (356, 357):
        text = performance[page_number - 1].get_text(sort=True)
        assert "n1=1400" in text
        model = None
        for line in text.splitlines():
            match = ROW.match(line)
            if not match:
                continue
            torque, ratio, speed, rpm, current_model, tail = match.groups()
            if current_model:
                model = current_model
                assert rpm == "1400"
            assert model is not None
            ratio = number(ratio)
            values = [number(v) for v in tail.split()]
            assert len(values) == 9 and values[-1] > 1000
            assert abs(number(speed) - 1400 / ratio) <= 1.01, (model, ratio, speed)
            evidence = observed.get((model, ratio))
            assert evidence, ("2020 kataloğunda oran bulunamadı", model, ratio)
            size = int(model[2])
            dimension = 342 + size
            dimension_text = source[dimension - 1].get_text()
            spline = SPLINES[size - 2]
            assert model in dimension_text and spline in dimension_text
            weights = sorted({e["weight_kg"] for e in evidence})
            item = {
                "model": model + ".1K", "series": "VR", "frame_size": model,
                "application": "kaldirma", "stages": 3,
                "input_configuration": "Motor akuple", "ratio": ratio,
                "input_speed_rpm": 1400, "output_speed_rpm": round(1400 / ratio, 4),
                "printed_output_speed_rpm": number(speed), "output_speed_basis": "n2 = 1400 / i; basılı yuvarlatılmış devir ayrıca korunur.",
                "output_torque_Nm": int(torque), "nominal_power_kw": values[7],
                "permitted_radial_load_output_N": int(values[8]),
                "output_spline": spline + " DIN 5480", "output_connection": "1K çoklu kamalı mil",
                "technical_page": page_number, "dimension_page": dimension,
                "geared_motor_weight_min_kg": min(weights), "geared_motor_weight_max_kg": max(weights),
                "weight_basis": "Motorlu kombinasyon ağırlığıdır. Motorsuz redüktör ağırlığı yayımlanmamıştır; ayrı motor ağırlığıyla toplanmaz.",
                "torque_basis": "V0500-1018: fs=1 anma momenti, n1=1400 d/d. Orana özgüdür; gövde maksimumu veya ani tepe momenti değildir.",
                "source": f"YILMAZ V0500-1018 s.{page_number}; V0601-0920 ölçü s.{dimension}",
                "catalog_source_url": "https://salter.com.tr/files/reduktorler/yilmaz-katalog-vinc-reduktoru.pdf",
                "nominal_power_by_iso_class_kw": {f"M{i+2}": v for i, v in enumerate(values[:7])},
                "weight_source_pages": sorted({e["page"] for e in evidence}),
            }
            items.append(item)
    assert {r["frame_size"] for r in items} == {f"VR{i}73" for i in range(2, 9)}
    assert len({(r["model"], r["ratio"]) for r in items}) == len(items)
    imported = {(r["frame_size"], r["ratio"]) for r in items}
    unmatched = [{"model": model, "ratio": ratio,
                  "source_pages": sorted({r["page"] for r in observed[(model, ratio)]}),
                  "reason": "Bağımsız anma momenti tablosunda bu model/oran yok; yakın orana veya komşu gövdeye dönüştürülmedi."}
                 for model, ratio in sorted(set(observed) - imported)]
    for item in items:
        item["frame_max_nominal_torque_nm"] = max(r["output_torque_Nm"] for r in items if r["model"] == item["model"])
    meta = {
        "brand": "YILMAZ REDÜKTÖR", "series": "VR", "equipment_type": "reducer",
        "source_pdf": SOURCE.name, "performance_pdf": PERFORMANCE.name,
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "performance_sha256": hashlib.sha256(PERFORMANCE.read_bytes()).hexdigest(),
        "extraction_date": "2026-09-12", "item_count": len(items), "model_count": 7,
        "printed_dimension_reference_errors": page_reference_errors,
        "unmatched_motor_table_combinations": unmatched,
        "notes": "Gövde + tahvil oranı; 1400 d/d fs=1 tablosu. Motor/tambur/tonaj seçimi aktarılmaz. Gövde maksimumu yalnız bilgi alanıdır. Motorsuz ağırlık ve düz mil çapı uydurulmaz.",
    }
    OUT.write_text(json.dumps({"meta": meta, "fields": list(items[0]), "items": items}, ensure_ascii=False, indent=1), encoding="utf-8")
    for model in sorted({r["model"] for r in items}):
        group = [r for r in items if r["model"] == model]
        print(model, len(group), "oran; anma momenti", min(r["output_torque_Nm"] for r in group), "-", max(r["output_torque_Nm"] for r in group), "Nm")
    print("Yazıldı:", OUT, len(items), "satır")


def build_sheets():
    """Ortak MANUAL kurallarını uygular; diğer katalog kayıtlarını korur."""
    spec = importlib.util.spec_from_file_location("catalog_sheets", REPO / "scripts/catalog-sheets.py")
    sheets = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sheets)
    records = []
    produced = {}
    for entry in sheets.MANUAL:
        if entry[4] != "yilmaz_v_performance":
            continue
        kind, brand, series, _, key, pages, printed, title = entry[:8]
        _, problem = sheets.verify_manual(entry, sheets.Source.get(key))
        assert not problem, problem
        references = [(key, i) for i in pages] + entry[9]
        images = []
        for n, (source_key, index) in enumerate(references):
            token = (source_key, index)
            if token not in produced:
                name = f"{kind}/{sheets.slugify(brand)}-{sheets.slugify(series)}-p{n+1}.webp"
                target = REPO / "catalog-sheets" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                sheets.render(sheets.Source.get(source_key), index, str(target))
                produced[token] = name
            images.append(produced[token])
        records.append({"id": f"{kind}/{sheets.slugify(brand)}-{sheets.slugify(series)}",
                        "kind": kind, "brand": brand, "series": series, "title": title,
                        "source": " + ".join(dict.fromkeys(sheets.PDFS[k] for k, _ in references)),
                        "printedPages": printed, "images": images,
                        "models": list(dict.fromkeys(sheets.db_model(kind, r) for r in sheets.manual_items(entry)))})
    assert len(records) == 7 and len(produced) == 9
    manifest_path = Path(sheets.MANIFEST)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ids = {r["id"] for r in records}
    manifest["sheets"] = [r for r in manifest["sheets"] if r["id"] not in ids] + records
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("VR föyleri: 7 kayıt, 9 kaynak sayfa; diğer kayıtlar korundu.")


if __name__ == "__main__":
    if "--sheets" in sys.argv:
        build_sheets()
    else:
        extract()
