# -*- coding: utf-8 -*-
"""SKF NA (iğneli, iç bilezikli) ve NNF (çift sıralı tam donanımlı silindirik)
rulman ürün tablolarını PDF'ten çıkarır ve `catalog_data/bearings/skf.json`
dosyasına EKLER.

NEDEN AYRI BİR BETİK: `catalogs_galvi_skf.py` skf.json'u BAŞTAN YAZAR ve o
dosya artık betiğin ürettiğinden fazlasını taşır (230xx serisi, konik delikli
222xx/230xx ayrımı, `datasheet_url` alanı — hepsi sonraki migration'larla
geldi). Ana betiği yeniden koşturmak bu satırları sessizce silerdi. Bu betik
yalnız EKLER: var olan tanımlamaya dokunmaz, yenisini araya sokar ve dosyayı
aynı sırayla geri yazar.

NEDEN BU İKİ SERİ: halat dengeleme elemanının (denge traversi / denge makarası)
rulmanı NA ya da NNF tipidir — kesit yüksekliği düşük, radyal yük kapasitesi
yüksek olmalıdır. Bu iki seri katalogda yoktu ve bölüm katalogdan seçilemiyordu.

Kaynak: SKF genel-rulman-katalogu.pdf (PUB BU/P1 17000 EN, Haziran 2018)
  · NA  — bölüm 7.4, basılı sayfa 636-646 (PDF 638-648)
  · NNF — bölüm 6.5, basılı sayfa 576-578 (PDF 578-580)

Çalıştırma (repo kökünden):
    python scripts/catalog-extract/bearings_na_nnf.py
    python scripts/catalog-extract/bearings_validate.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = REPO_ROOT.parent
SKF_PDF = WORKSPACE / "SKF genel-rulman-katalogu.pdf"
TARGET = WORKSPACE / "catalog_data" / "bearings" / "skf.json"

# PDF sayfaları (1 tabanlı). Ürün tabloları ÇİFT sayfalarda basılıdır; tek
# sayfalar aynı ürünün ölçü/pah tablolarıdır ve buraya girmez.
NA_PAGES = [638, 640, 642, 644, 646, 648]
NNF_PAGES = [578, 580]

# Sütun bantları (x aralığı). Tablo başlıkları sabit x'tedir; satır okuma
# konumsaldır çünkü hücreler boş kalabilir ("–") ve indise güvenilmez.
NA_BANDS = {
    "bore": (30, 65),
    "outer": (65, 100),
    "width": (100, 136),
    "dynamic": (180, 218),
    "static": (218, 262),
    "limiting_speed": (358, 400),
    "mass": (410, 460),
    "model": (470, 560),
}
NNF_BANDS = {
    "bore": (30, 62),
    "outer": (62, 96),
    "width": (96, 130),
    "dynamic": (170, 210),
    "static": (210, 252),
    "limiting_speed": (300, 340),
    "mass": (340, 385),
    "model": (392, 470),
}


def rows(page: fitz.Page, min_y: float) -> list[list[tuple[float, str]]]:
    """Yakın taban çizgilerindeki sözcükleri tek katalog satırında toplar."""
    out: list[list[tuple[float, float, str]]] = []
    for x0, y0, _x1, _y1, text, *_ in page.get_text("words", sort=True):
        if y0 < min_y:
            continue
        if not out or abs(y0 - out[-1][0][0]) > 2.2:
            out.append([(y0, x0, text)])
        else:
            out[-1].append((y0, x0, text))
    return [[(x, text) for _y, x, text in line] for line in out]


def cell(line: list[tuple[float, str]], band: tuple[float, float]) -> str:
    left, right = band
    return " ".join(t for x, t in line if left <= x < right and t != "▶")


def number(value: str) -> float | None:
    """'1 040' ve '45,7' biçimlerini sayıya çevirir; '–' None döner."""
    value = value.replace(" ", "").replace(" ", "").replace(",", ".")
    if not value or value in {"–", "-", "—"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


# NA serisi: yalnız NA 49xx / NA 69xx (ve .2RS kapaklı eşleri). Aynı tabloda
# basılan NKI / NKIS iğneli rulmanlar İÇ BİLEZİKSİZ ailenin farklı bir kolu
# değil ayrı bir sipariş adlandırmasıdır; kullanıcı NA ve NNF istedi, tablo
# onlarla sınırlı tutulur — istenmeyen bir seriyi listeye doldurmak seçiciyi
# gürültüye boğar.
NA_MODEL = re.compile(r"^NA\s?(49|69)\d{2}(\.2RS)?$")
# NNF serisi: NNF 50xx (çift sıralı tam donanımlı silindirik makaralı).
# Aynı tabloda basılan salt sayısal kodlar (319426 B-2LS) SKF'in özel imalat
# tanımlamalarıdır, standart seri değildir.
NNF_MODEL = re.compile(r"^NNF\s?50\d{2}\s?[A-Z0-9-]*$")


def series_of(model: str) -> str | None:
    """
    Model kodundan seri adı.

    CONTALI (.2RS) SATIRLAR AYRI BİR SERİDİR — 222xx konik delik ayrımının aynı
    gerekçesi (bkz. skf.json meta notu): contalı rulmanın sınır devri açık
    olanın üçte biri kadardır (NA 4901 26 000 d/dak, NA 4901.2RS 11 000 d/dak)
    ve iki aile aynı listede delik çapına göre iç içe dizildiğinde ne seçici
    okunur ne de doğrulayıcının artan-delik/artan-kapasite denetimi anlamlı
    kalır. Seçicinin ilk süzgeç adımı contalıyı açıktan ayırır.
    """
    clean = model.replace(" ", "")
    sealed = clean.endswith(".2RS")
    if clean.startswith("NA49"):
        return "NA 49xx İğneli Makaralı" + (" (Contalı)" if sealed else " (İç Bilezikli)")
    if clean.startswith("NA69"):
        return "NA 69xx İğneli Makaralı" + (" (Contalı)" if sealed else " (İç Bilezikli)")
    if clean.startswith("NNF50"):
        return "NNF 50xx Silindirik Makaralı (Çift Sıra Tam Donanımlı)"
    return None


def extract(doc: fitz.Document, pages: list[int], bands: dict, pattern: re.Pattern) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for page_no in pages:
        # d sütunu yalnız DEĞİŞTİĞİNDE basılır: aynı delik çapının alt
        # satırları boş gelir ve bir öncekinden devralınır.
        previous_bore: float | None = None
        for line in rows(doc[page_no - 1], 285):
            model = compact(cell(line, bands["model"]))
            bore = number(cell(line, bands["bore"]))
            if bore is not None:
                previous_bore = bore
            else:
                bore = previous_bore
            if not pattern.match(model):
                continue
            series = series_of(model)
            values = {
                k: number(cell(line, bands[k]))
                for k in ("outer", "width", "dynamic", "static", "limiting_speed", "mass")
            }
            if series is None or bore is None or any(v is None for v in values.values()):
                continue
            if model in seen:
                continue
            seen.add(model)
            items.append(
                {
                    "designation": model,
                    "series": series,
                    "bore_mm": bore,
                    "outer_diameter_mm": values["outer"],
                    "width_mm": values["width"],
                    "dynamic_load_kN": values["dynamic"],
                    "static_load_kN": values["static"],
                    "limiting_speed_rpm": values["limiting_speed"],
                    "weight_kg": values["mass"],
                }
            )
    return items


def main() -> None:
    if not SKF_PDF.exists():
        raise SystemExit(f"Katalog PDF'i bulunamadı: {SKF_PDF}")
    doc = fitz.open(SKF_PDF)
    fresh = (
        extract(doc, NA_PAGES, NA_BANDS, NA_MODEL)
        + extract(doc, NNF_PAGES, NNF_BANDS, NNF_MODEL)
    )
    if not fresh:
        raise SystemExit("NA/NNF satırı okunamadı — sayfa numaraları ya da bantlar değişmiş olabilir.")

    data = json.loads(TARGET.read_text(encoding="utf-8"))
    have = {item["designation"] for item in data["items"]}
    added = [item for item in fresh if item["designation"] not in have]
    data["items"] = sorted(
        data["items"] + added,
        key=lambda item: (item["series"], item["bore_mm"], item["designation"]),
    )
    note = (
        " NA 49xx/69xx (iğneli, iç bilezikli — bölüm 7.4, basılı s.636-646) ve "
        "NNF 50xx (çift sıralı tam donanımlı silindirik — bölüm 6.5, basılı "
        "s.576-578) serileri 24.08.2026'da EKLENMİŞTİR: halat dengeleme "
        "elemanının rulmanı bu iki tipten seçilir ve bölüm katalogdan "
        "seçilemiyordu (bkz. scripts/catalog-extract/bearings_na_nnf.py). "
        "Aynı tabloda basılan NKI/NKIS iğneli rulmanlar ile SKF'in özel imalat "
        "kodları (319426 gibi) ALINMAMIŞTIR."
    )
    if "bearings_na_nnf" not in data["meta"].get("notes", ""):
        data["meta"]["notes"] = data["meta"].get("notes", "") + note
    TARGET.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    by_series: dict[str, int] = {}
    for item in added:
        by_series[item["series"]] = by_series.get(item["series"], 0) + 1
    print(f"okunan {len(fresh)} · eklenen {len(added)} · toplam {len(data['items'])}")
    for series, count in sorted(by_series.items()):
        print(f"  {count:3d}  {series}")
    if len(fresh) != len(added):
        print(f"  (zaten kayıtlı olan {len(fresh) - len(added)} satır atlandı)")


if __name__ == "__main__":
    main()
