"""Conductix-Wampfler kauçuk tampon YÜK DİYAGRAMLARI (enerji-strok ve
kuvvet-strok eğrileri).

Kaynak: `KAT0170-0003-EN Load Diagrams Rubber Buffers.pdf`

NEDEN EĞRİ ŞART: kauçuk yay karakteristiği doğrusal değildir. Ürün tablosundaki
Wmax ve Fmax yalnız %50 sıkışmadaki UÇ değerlerdir; W = F · s · η gibi kapalı
bir formülle ara nokta üretilemez. Katalog s.6 da seçimi "beklenen sıkışma
boyunu DİYAGRAMDAN oku" diye tarif eder.

YÖNTEM
1. Her sayfada iki grafik vardır. Grafik çerçevesi 0,659 pt kalınlıkta bir
   dikdörtgen çizimidir ('re' ya da 'qu'); çerçeve grafiğin piksel kutusunu
   verir.
2. Kalibrasyon eksen ETİKET METİNLERİNDEN kurulur: çerçevenin solundaki sayılar
   y eksenini, altındaki sayılar x eksenini tanımlar. İkisine de en küçük
   kareler ile doğrusal dönüşüm oturtulur (tek bir etikete güvenilmez).
3. Eğri 1,4 pt kalınlıkta, tamamı kübik Bézier'den oluşan ve çerçevenin içinde
   kalan tek çizimdir. Bézier'ler örneklenip veri koordinatlarına çevrilir,
   x'e göre sıralanır (bir sayfada eğri ters yönde çizilmiştir) ve istenen
   sıkışma yüzdelerinde doğrusal ara değerlenir.
4. DOĞRULAMA: her çapta eğrinin UÇ NOKTASI ürün tablosundaki Wmax / Fmax ile
   karşılaştırılır. Sonuç `endpoint_*_ratio` alanlarında ve README'de durur.

Çıktı: catalog_data/buffers/conductix_curves.json
"""

from __future__ import annotations

import json
import re

import fitz

from buffers_common import PDF_CONDUCTIX_CURVES, OUT_DIR, clean, write_json

# Diyagram sayfaları (0 tabanlı indis). s.3 (indis 2) Ø50'yi hesap örneğiyle
# birlikte TEKRAR basar; asıl Ø50 sayfası indis 4'tür — tekrar alınmaz, ancak
# çapraz kontrol olarak ölçülür (bkz. cross_check).
DIAGRAM_PAGES = list(range(3, 13))
DUPLICATE_PAGE = 2

# Örnekleme noktaları: %0'dan %50'ye 2,5 puan aralıklarla (21 nokta).
SAMPLE_PCT = [round(i * 2.5, 1) for i in range(21)]

BEZIER_STEPS = 40  # her Bézier parçasında örnek adedi
CURVE_WIDTH = 1.4
FRAME_WIDTH = 0.659


def _num(text: str) -> float | None:
    t = text.strip()
    if re.fullmatch(r"\d+(?:[.,]\d+)?", t):
        return float(t.replace(",", "."))
    return None


def _linfit(pairs: list[tuple[float, float]]) -> tuple[float, float]:
    """En küçük kareler: piksel → veri birimi (y = a·x + b)."""
    n = len(pairs)
    sx = sum(p[0] for p in pairs)
    sy = sum(p[1] for p in pairs)
    sxx = sum(p[0] * p[0] for p in pairs)
    sxy = sum(p[0] * p[1] for p in pairs)
    den = n * sxx - sx * sx
    if abs(den) < 1e-9:
        raise RuntimeError("kalibrasyon: eksen etiketleri tek noktaya düşmüş")
    a = (n * sxy - sx * sy) / den
    b = (sy - a * sx) / n
    return a, b


def _bezier_points(items) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for it in items:
        p0, p1, p2, p3 = it[1], it[2], it[3], it[4]
        for k in range(BEZIER_STEPS + 1):
            t = k / BEZIER_STEPS
            u = 1 - t
            x = (u ** 3 * p0.x + 3 * u * u * t * p1.x
                 + 3 * u * t * t * p2.x + t ** 3 * p3.x)
            y = (u ** 3 * p0.y + 3 * u * u * t * p1.y
                 + 3 * u * t * t * p2.y + t ** 3 * p3.y)
            pts.append((x, y))
    return pts


def _sig(v: float, digits: int = 3) -> float:
    """Anlamlı basamağa yuvarlar — çıkarımın doğruluğu ~%2, fazlası sahte hassasiyet."""
    if v == 0:
        return 0.0
    from math import floor, log10
    exp = floor(log10(abs(v)))
    return round(v, max(0, digits - 1 - exp))


def read_page(page: "fitz.Page") -> dict:
    """Bir diyagram sayfasından çap + iki eğriyi okur."""
    words = page.get_text("words")
    drawings = page.get_drawings()

    # --- çap: "Ø" belirtecini izleyen sayı
    diameter = None
    for w in words:
        if w[4].strip() == "Ø":
            after = sorted(
                (x for x in words if abs(x[1] - w[1]) < 2 and x[0] > w[2] - 1),
                key=lambda x: x[0],
            )
            if after and after[0][4].isdigit():
                diameter = int(after[0][4])
                break
    if diameter is None:
        raise RuntimeError(f"s.{page.number + 1}: çap etiketi bulunamadı")

    frames = [
        d for d in drawings
        if any(it[0] in ("qu", "re") for it in d["items"])
        and abs((d.get("width") or 0) - FRAME_WIDTH) < 0.05
    ]
    if len(frames) != 2:
        raise RuntimeError(
            f"s.{page.number + 1}: grafik çerçevesi sayısı {len(frames)}, beklenen 2"
        )

    out: dict = {"diameter_mm": diameter}
    for frame in frames:
        r = frame["rect"]

        y_labels: list[tuple[float, float]] = []
        x_labels: list[tuple[float, float]] = []
        for w in words:
            v = _num(w[4])
            if v is None:
                continue
            cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            if w[2] < r.x0 - 2 and r.y0 - 8 <= cy <= r.y1 + 8:
                y_labels.append((cy, v))
            elif r.y1 + 1 < w[1] < r.y1 + 20 and r.x0 - 8 <= cx <= r.x1 + 8:
                x_labels.append((cx, v))
        if len(y_labels) < 3 or len(x_labels) < 3:
            raise RuntimeError(
                f"s.{page.number + 1}: eksen etiketi yetersiz "
                f"(y={len(y_labels)}, x={len(x_labels)})"
            )
        ay, by = _linfit(y_labels)
        ax, bx = _linfit(x_labels)

        # eksen başlığı: hangi büyüklük çiziliyor
        kind = None
        for w in words:
            if w[4] in ("Energy", "Force") and w[2] < r.x0 \
                    and r.y0 - 10 <= (w[1] + w[3]) / 2 <= r.y1 + 10:
                kind = "energy" if w[4] == "Energy" else "force"
        if kind is None:
            raise RuntimeError(f"s.{page.number + 1}: eksen başlığı okunamadı")

        curves = [
            d for d in drawings
            if d["items"] and all(it[0] == "c" for it in d["items"])
            and abs((d.get("width") or 0) - CURVE_WIDTH) < 0.3
            and r.x0 - 3 <= d["rect"].x0 and d["rect"].x1 <= r.x1 + 3
            and r.y0 - 6 <= d["rect"].y0 and d["rect"].y1 <= r.y1 + 6
        ]
        if len(curves) != 1:
            raise RuntimeError(
                f"s.{page.number + 1} ({kind}): eğri sayısı {len(curves)}, beklenen 1"
            )

        pts = [
            (ax * px + bx, ay * py + by) for px, py in _bezier_points(curves[0]["items"])
        ]
        pts.sort(key=lambda p: p[0])
        out[kind] = pts
        out[kind + "_axis_max"] = _sig(max(v for _, v in y_labels), 4)
    return out


def sample(pts: list[tuple[float, float]]) -> list[list[float]]:
    """Eğriyi SAMPLE_PCT noktalarında doğrusal ara değerler."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    out: list[list[float]] = []
    for pct in SAMPLE_PCT:
        if pct <= xs[0]:
            v = ys[0]
        elif pct >= xs[-1]:
            v = ys[-1]
        else:
            i = max(k for k in range(len(xs)) if xs[k] <= pct)
            x0, x1 = xs[i], xs[i + 1]
            y0, y1 = ys[i], ys[i + 1]
            v = y0 if x1 == x0 else y0 + (y1 - y0) * (pct - x0) / (x1 - x0)
        # Sıkışmamış tampon ne enerji depolar ne kuvvet uygular: %0 → tam 0.
        # (Ölçülen başlangıç değerleri -0,1…+0,9 aralığında, yani çizim
        # doğruluğu içinde sıfırdır; yuvarlama uydurma değildir.)
        out.append([pct, 0.0 if pct == 0 else _sig(max(v, 0.0))])
    return out


def build() -> tuple[str, int]:
    doc = fitz.open(PDF_CONDUCTIX_CURVES)

    # Ürün tablosundan referans: DİYAGRAMIN geçerli olduğu ürünler.
    # Diyagram sayfası "Valid for solid-rubber buffers with h = 0,8 × d1" der —
    # yani SİLİNDİRİK gövde. Konik ürünler (017220-*, 017110-*) bu diyagramın
    # kapsamında DEĞİLDİR.
    with open(f"{OUT_DIR}/conductix_rubber.json", encoding="utf-8") as fh:
        rubber = json.load(fh)["items"]

    def reference(dia: int, cylindrical: bool):
        hits = [
            it for it in rubber
            if it["diameter_mm"] == dia
            and (it["form"] == "silindirik") == cylindrical
            and it["height_mm"]
            and abs(it["height_mm"] / it["diameter_mm"] - 0.8) <= 0.03
        ]
        if not hits:
            return [], None, None
        return (
            sorted(it["model"] for it in hits),
            hits[0]["energy_capacity_j"],
            hits[0]["max_force_kn"],
        )

    items: list[dict] = []
    validation: list[dict] = []

    for page_no in DIAGRAM_PAGES:
        rec = read_page(doc[page_no])
        dia = rec["diameter_mm"]
        e_pts, f_pts = rec["energy"], rec["force"]
        e_end, f_end = _sig(e_pts[-1][1], 4), _sig(f_pts[-1][1], 4)

        models, w_ref, f_ref = reference(dia, cylindrical=True)
        cone_models, w_cone, f_cone = reference(dia, cylindrical=False)

        e_ratio = round(e_end / w_ref, 4) if w_ref else None
        f_ratio = round(f_end / f_ref, 4) if f_ref else None

        items.append({
            "diameter_mm": dia,
            "height_mm": clean(round(0.8 * dia)),
            "form": "silindirik",
            "max_compression_pct": 50,
            "applies_to_models": models,
            "reference_energy_j": w_ref,
            "reference_force_kn": f_ref,
            "endpoint_energy_j": e_end,
            "endpoint_force_kn": f_end,
            "endpoint_energy_ratio": e_ratio,
            "endpoint_force_ratio": f_ratio,
            "energy_curve": sample(e_pts),
            "force_curve": sample(f_pts),
            "source_page": page_no + 1,
        })

        validation.append({
            "diameter_mm": dia,
            "endpoint_energy_j": e_end,
            "table_energy_j": w_ref,
            "energy_ratio": e_ratio,
            "endpoint_force_kn": f_end,
            "table_force_kn": f_ref,
            "force_ratio": f_ratio,
            "conical_models": cone_models,
            "conical_energy_j": w_cone,
            "conical_force_kn": f_cone,
            "conical_energy_ratio": round(e_end / w_cone, 4) if w_cone else None,
            "conical_force_ratio": round(f_end / f_cone, 4) if f_cone else None,
        })

    # Ø50 çapraz kontrolü: aynı diyagram s.3'te de basılıdır.
    dup = read_page(doc[DUPLICATE_PAGE])
    cross = {
        "duplicate_page": DUPLICATE_PAGE + 1,
        "diameter_mm": dup["diameter_mm"],
        "endpoint_energy_j": _sig(dup["energy"][-1][1], 4),
        "endpoint_force_kn": _sig(dup["force"][-1][1], 4),
    }
    doc.close()

    items.sort(key=lambda r: r["diameter_mm"])
    path = write_json(
        "conductix_curves.json",
        {
            "brand": "Conductix-Wampfler",
            "equipment_type": "buffer_load_diagram",
            "buffer_type": "kauçuk",
            "program": "0170",
            "source_pdf": "KAT0170-0003-EN Load Diagrams Rubber Buffers.pdf",
            "source_pages": "4-13 (Ø40 … Ø315); s.3 Ø50'nin tekrarıdır",
            "extraction_date": "2026-08-06",
            "extraction_method": (
                "PyMuPDF get_drawings(); eğri kübik Bézier olarak çizilidir. "
                "Kalibrasyon eksen etiketi metinlerinin konumundan en küçük "
                "karelerle kurulur, eğri 2,5 puanlık sıkışma adımlarında "
                "örneklenir. Değerler 3 anlamlı basamağa yuvarlanmıştır; "
                "çıkarım doğruluğu ±%2 mertebesindedir."
            ),
            "curve_units": {
                "energy_curve": "[sıkışma %, enerji J]",
                "force_curve": "[sıkışma %, kuvvet kN]",
            },
            "validation": validation,
            "cross_check": cross,
            "notes": (
                "Diyagram sayfası açıkça 'Valid for solid-rubber buffers with "
                "h = 0,8 × d1' der — yani SİLİNDİRİK gövdeli tamponlar. Katalogda "
                "silindirik gövde yalnız Ø80…Ø315'te vardır (017111-* taban "
                "plakalı, 017120-* saplamalı). O yedi çapta eğrinin uç noktası "
                "ürün tablosundaki Wmax ve Fmax ile %97,7…%101,8 aralığında "
                "UYUŞUR — kalibrasyon DOĞRULANMIŞTIR. "
                "Ø40, Ø50 ve Ø63'te silindirik ürün YOKTUR; o çaplarda "
                "applies_to_models ve reference_* alanları boştur, oran "
                "hesaplanmaz. Bu üç sayfadaki eğriler yine de alınmıştır çünkü "
                "kendi içlerinde tutarlıdır (W ≈ 0,317 · F · s bağıntısı on çapta "
                "da sağlanır ve W ∝ d³ ölçeklemesi korunur); ancak konik "
                "017220/017110 ürünlerinin tablo değerleriyle Ø40'ta %87, "
                "Ø50'de %111 sapma verirler — konik gövde farklı bir yay "
                "karakteristiğidir, o yüzden bu eğriler konik ürünlere "
                "UYGULANMAMALIDIR. Ayrıntı: meta.validation. "
                "HÜCRESEL tamponların yük diyagramları KAT0180 ayrı bir "
                "dokümandır ve bu pakette VERİLMEMİŞTİR — üretilmemiştir."
            ),
        },
        ["diameter_mm", "height_mm", "form", "max_compression_pct",
         "applies_to_models", "reference_energy_j", "reference_force_kn",
         "endpoint_energy_j", "endpoint_force_kn", "endpoint_energy_ratio",
         "endpoint_force_ratio", "energy_curve", "force_curve", "source_page"],
        items,
    )
    return path, len(items)


if __name__ == "__main__":
    path, n = build()
    print(f"yazıldı: {path}  ({n} çap)")
    with open(path, encoding="utf-8") as fh:
        meta = json.load(fh)["meta"]
    print("\nUÇ NOKTA DOĞRULAMASI (eğri ↔ ürün tablosu)")
    print(f"{'Ø':>5} {'eğri W':>9} {'tablo W':>9} {'oran':>7} "
          f"{'eğri F':>8} {'tablo F':>8} {'oran':>7}")
    for v in meta["validation"]:
        tw = v["table_energy_j"]
        tf = v["table_force_kn"]
        er = f"{v['energy_ratio']:.1%}" if v["energy_ratio"] else "  —"
        fr = f"{v['force_ratio']:.1%}" if v["force_ratio"] else "  —"
        print(f"{v['diameter_mm']:>5} {v['endpoint_energy_j']:>9} "
              f"{str(tw if tw is not None else '—'):>9} {er:>7} "
              f"{v['endpoint_force_kn']:>8} "
              f"{str(tf if tf is not None else '—'):>8} {fr:>7}")
    print(f"\nÇapraz kontrol s.{meta['cross_check']['duplicate_page']} "
          f"(Ø{meta['cross_check']['diameter_mm']} tekrarı): "
          f"W={meta['cross_check']['endpoint_energy_j']} J, "
          f"F={meta['cross_check']['endpoint_force_kn']} kN")
