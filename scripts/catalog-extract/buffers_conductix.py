"""Conductix-Wampfler kauçuk (Program 0170) ve hücresel (Program 0180) tampon
ürün tabloları.

Kaynak: `KAT0170-0002-EN Rubber and Cellular Buffers, Programs 0170_0180.pdf`

Tablo düzeni iki özellik taşır ve okuyucu ikisini de açıkça karşılar:

1. **Sütunlar ORTALANMIŞTIR.** Hücrelerin x MERKEZLERİ sütun başına sabittir
   (sağ/sol kenar değil). Sütun merkezleri veri hücrelerinden kümelenerek
   bulunur; sabit indise ya da başlık konumuna güvenilmez.
2. **Bazı sütunlar BİRLEŞTİRİLMİŞTİR** (merged): değer bir çap grubu boyunca
   yalnız bir kez, kapsadığı satır bloğunun DÜŞEY ORTASINA basılır. Bu, dört
   tabloda da (kauçuk s.12/13, hücresel s.23/24) doğrulanmıştır. Bu yüzden
   birleştirilmiş sütunlarda değer, ardışık basılı değerlerin ORTA NOKTALARIYLA
   sınırlanan bir "aralık" (span) olarak çözülür. Hücresel tabloda d2 ve s
   sütunları İKİ çap grubunu birden kapsar; orta nokta kuralı bunu da doğru
   çözer, çap grubunun y aralığına bakan bir kural çözemez.

Çıktılar:
  catalog_data/buffers/conductix_rubber.json
  catalog_data/buffers/conductix_cellular.json
"""

from __future__ import annotations

import re

import fitz

from buffers_common import PDF_CONDUCTIX_PRODUCTS, clean, num, write_json

PART_RE = re.compile(r"^(\d{6})-(\d+)(?:x(\d+(?:,\d+)?))?")

# Katalog s.4 ("Rubber and Cellular Buffers at a glance") ve s.6 (Project
# Planning) sıkışma sınırlarını verir: kauçuk %50, hücresel %80. Diyagram
# sayfaları da "Max. deflection = 50%" yazar (KAT0170-0003).
RUBBER_MAX_COMPRESSION_PCT = 50
CELLULAR_MAX_COMPRESSION_PCT = 80

# Tablo alanının x sınırları: sol kenarda parça numarası, sağ kenarda sayfa
# numarası vardır; ikisi de veri hücresi değildir.
CELL_X_MIN = 110.0
CELL_X_MAX = 530.0

ROW_TOL = 6.0   # bir satırın y toleransı
COL_TOL = 15.0  # bir hücrenin sütun merkezine uzaklık toleransı


def _cells_and_parts(page: "fitz.Page", y_from: float, y_to: float):
    """Sayfanın bir bandındaki parça numaralarını ve veri hücrelerini toplar."""
    parts: list[tuple[float, str, bool]] = []   # (y, parça no, standart mı)
    cells: list[tuple[float, float, str]] = []  # (y, x merkezi, metin)
    words = page.get_text("words")

    for w in words:
        text = w[4].strip()
        if not text or not (y_from <= w[1] <= y_to):
            continue
        cx = (w[0] + w[2]) / 2
        if w[0] < CELL_X_MIN:
            if PART_RE.match(text):
                # yıldız aynı satırda ayrı bir belirteç olabilir ya da parça
                # numarasına yapışık gelebilir; ikisini de yakala
                star = text.endswith("*") or any(
                    x[4].strip() == "*" and abs(x[1] - w[1]) < ROW_TOL
                    and x[0] < CELL_X_MIN
                    for x in words
                )
                parts.append((w[1], text.rstrip("*"), star))
        elif cx <= CELL_X_MAX:
            if num(text) is not None or re.fullmatch(r"M\d+", text):
                cells.append((w[1], cx, text))

    return sorted(parts), cells


def _cluster(values: list[float], gap: float = 20.0) -> list[float]:
    """1B kümeleme: sıralı x merkezlerini sütunlara böler, küme ortalamalarını verir."""
    cols: list[list[float]] = []
    for v in sorted(values):
        if cols and v - cols[-1][-1] <= gap:
            cols[-1].append(v)
        else:
            cols.append([v])
    return [sum(g) / len(g) for g in cols]


def parse_product_table(
    page: "fitz.Page",
    y_from: float,
    y_to: float,
    col_names: list[str],
    merged_cols: set[str],
    expected_rows: int,
) -> list[dict]:
    """Bir ürün tablosunu okur ve satır başına {sütun adı: ham metin} verir.

    col_names   — parça numarası SONRASINDAKİ sütunların soldan sağa adları.
    merged_cols — çap grubu (ya da gruplar) boyunca bir kez basılan sütunlar.
    expected_rows — basılı sayfadan sayılmış satır adedi (koruma kontrolü).
    """
    parts, cells = _cells_and_parts(page, y_from, y_to)
    if len(parts) != expected_rows:
        raise RuntimeError(
            f"s.{page.number + 1}: satır sayısı uyuşmadı — "
            f"bulunan {len(parts)}, beklenen {expected_rows}"
        )

    columns = _cluster([c[1] for c in cells])
    if len(columns) != len(col_names):
        raise RuntimeError(
            f"s.{page.number + 1}: sütun sayısı uyuşmadı — bulunan {len(columns)} "
            f"({[round(c) for c in columns]}), beklenen {len(col_names)}"
        )

    def column_of(cx: float) -> int | None:
        j = min(range(len(columns)), key=lambda k: abs(columns[k] - cx))
        return j if abs(columns[j] - cx) < COL_TOL else None

    row_ys = [p[0] for p in parts]

    # Birleştirilmiş sütunlar: her satıra hangi basılı değerin düştüğü
    per_row_merged: dict[str, list[str | None]] = {}
    for name in merged_cols:
        j = col_names.index(name)
        vals = sorted((c[0], c[2]) for c in cells if column_of(c[1]) == j)
        per_row_merged[name] = _resolve_merged(row_ys, vals, name, page.number + 1)

    out: list[dict] = []
    for i, (y, part, star) in enumerate(parts):
        rec: dict[str, str] = {}
        for cy, cx, text in cells:
            if abs(cy - y) > ROW_TOL:
                continue
            j = column_of(cx)
            if j is None or col_names[j] in merged_cols:
                continue
            rec[col_names[j]] = text
        for name in merged_cols:
            v = per_row_merged[name][i]
            if v is not None:
                rec[name] = v
        rec["part_no"] = part
        rec["standard_range"] = star
        out.append(rec)
    return out


def _resolve_merged(
    row_ys: list[float],
    vals: list[tuple[float, str]],
    name: str,
    page_no: int,
) -> list[str | None]:
    """Birleştirilmiş bir sütunun değerlerini satırlara dağıtır.

    Birleştirilmiş hücrenin metni, kapsadığı satır bloğunun DÜŞEY ORTASINA
    basılır. Buradan blok sınırları TAM olarak geri çözülebilir: blok ilk
    satırdan başlar ve `son = 2 × y_metin − y_ilk` konumuna EN YAKIN satırda
    biter. Öne doğru süpürerek bütün bloklar bulunur.

    "En yakın basılı değer" ya da "orta nokta" kestirmeleri blok uzunlukları
    farklı olduğunda YANLIŞ satıra atar (ör. kauçuk s.12'de Ø63 grubu 6, Ø80
    grubu 3 satırdır; 063x063 satırı Ø80'in M12'sini kapar). Bu yüzden burada
    kestirme kullanılmaz.
    """
    result: list[str | None] = [None] * len(row_ys)
    if not vals:
        return result

    start = 0
    for k, (y_val, text) in enumerate(vals):
        if start >= len(row_ys):
            raise RuntimeError(
                f"s.{page_no} '{name}': birleşik değer sayısı satır sayısını aştı"
            )
        y_first = row_ys[start]
        y_last_target = 2 * y_val - y_first
        end = min(
            range(start, len(row_ys)),
            key=lambda i: abs(row_ys[i] - y_last_target),
        )
        if k == len(vals) - 1:
            end = len(row_ys) - 1  # son blok tabloyu kapatır
        for i in range(start, end + 1):
            result[i] = text
        start = end + 1

    if start != len(row_ys):
        raise RuntimeError(
            f"s.{page_no} '{name}': {len(row_ys) - start} satır açıkta kaldı"
        )
    return result


def _thread(rec: dict) -> str | None:
    """Vidalı saplama ölçüsü: 'M12' biçimindeki d2 ya da d3 sütunu."""
    for key in ("d3", "d2"):
        v = str(rec.get(key, ""))
        if v.startswith("M"):
            return v
    return None


# --------------------------------------------------------------------------
# Kauçuk — Program 0170
# --------------------------------------------------------------------------

# (sayfa indeksi, y aralığı, sütun adları, birleşik sütunlar, satır adedi,
#  montaj, biçim)
RUBBER_TABLES = [
    (10, 330, 470,
     ["wmax", "f", "weight", "d1", "h", "a", "d2", "r", "s", "pu"],
     set(), 10, "çelik taban plakalı", None),
    (10, 680, 765,
     ["wmax", "f", "weight", "d1", "h", "l", "d2", "r", "s", "pu"],
     set(), 6, "saplamalı", "silindirik"),
    (11, 280, 810,
     ["wmax", "f", "weight", "d1", "d2", "d3", "h1", "h2", "l", "pu"],
     {"d1", "d3", "h2", "l"}, 39, "konik saplamalı", "konik"),
    (12, 170, 340,
     ["wmax", "f", "weight", "d1", "d2", "d3", "h1", "h2", "l", "pu"],
     {"d1", "d3", "h2", "l"}, 12, "konik saplamalı", "konik"),
]


def build_rubber() -> tuple[str, int]:
    doc = fitz.open(PDF_CONDUCTIX_PRODUCTS)
    items: list[dict] = []

    for page_no, y0, y1, names, merged, n_rows, mounting, form in RUBBER_TABLES:
        for rec in parse_product_table(
            doc[page_no], y0, y1, names, merged, n_rows
        ):
            part = rec["part_no"]
            m = PART_RE.match(part)
            # s.11 dipnot 2): 017110-* serisi KONİK biçimlidir (çizim s.13)
            row_form = form or ("konik" if part.startswith("017110") else "silindirik")
            items.append({
                "model": part,
                "type": "kauçuk",
                "program": "0170",
                "diameter_mm": clean(num(m.group(2))),
                # gerçek gövde yüksekliği: h (s.11) ya da h1 (s.12/13)
                "height_mm": clean(num(rec.get("h") or rec.get("h1"))),
                "energy_capacity_j": clean(num(rec.get("wmax"))),
                "max_force_kn": clean(num(rec.get("f"))),
                "max_compression_pct": RUBBER_MAX_COMPRESSION_PCT,
                "weight_kg": clean(num(rec.get("weight"))),
                "mounting": mounting,
                "form": row_form,
                "thread": _thread(rec),
                "packing_unit": clean(num(rec.get("pu"))),
                "standard_range": rec["standard_range"],
            })
    doc.close()

    items.sort(key=lambda r: (r["diameter_mm"], r["height_mm"] or 0, r["model"]))
    path = write_json(
        "conductix_rubber.json",
        {
            "brand": "Conductix-Wampfler",
            "equipment_type": "buffer",
            "buffer_type": "kauçuk",
            "program": "0170",
            "source_pdf": "KAT0170-0002-EN Rubber and Cellular Buffers, "
                          "Programs 0170_0180.pdf",
            "source_pages": "11 (taban plakalı + saplamalı), 12-13 (konik saplamalı)",
            "extraction_date": "2026-08-06",
            "max_compression_pct": RUBBER_MAX_COMPRESSION_PCT,
            "material": "NR / N kalite doğal kauçuk, 70 Shore A ±5 (katalog s.10)",
            "operating_temperature_c": "-30 … +70",
            "notes": (
                "Kauçuk YAY KARAKTERİSTİĞİ DOĞRUSAL DEĞİLDİR: energy_capacity_j "
                "(Wmax) ve max_force_kn (F) yalnız %50 sıkışmadaki UÇ "
                "değerlerdir; ara nokta bu ikisinden formülle türetilemez. "
                "Ara noktalar conductix_curves.json'daki enerji-strok ve "
                "kuvvet-strok eğrilerinden okunur (katalog s.6: 'Calculate the "
                "expected compression length from diagram'). "
                "max_compression_pct = 50 katalog s.4 ve s.6'dan DOĞRULANMIŞTIR "
                "('Compression travel up to 50% buffer height'). "
                "017211-* / 017221-* kauçuk-metal elemanlar (s.15-20) BİLEREK "
                "ALINMAMIŞTIR: katalog s.14 bunların belirlenmiş bir enerji "
                "yutma değeri olmadığını söyler, Wmax/F basılmaz — enerjiye "
                "göre seçilemezler. Ayrıca 'yalnız talep üzerine' satılırlar. "
                "height_mm tablodaki GERÇEK gövde yüksekliğidir; parça "
                "numarasındaki ikinci ölçü anma değeridir (ör. 017110-040x032N "
                "→ h = 35 mm). 017110-* serisi konik biçimlidir (s.11 dipnot 2). "
                "standard_range = katalogda * ile işaretli, stoktan teslim edilen "
                "standart ürün."
            ),
        },
        ["model", "type", "program", "diameter_mm", "height_mm",
         "energy_capacity_j", "max_force_kn", "max_compression_pct",
         "weight_kg", "mounting", "form", "thread", "packing_unit",
         "standard_range"],
        items,
    )
    return path, len(items)


# --------------------------------------------------------------------------
# Hücresel — Program 0180
# --------------------------------------------------------------------------

CELLULAR_TABLES = [
    (22, 300, 505,
     ["wmax_static", "wmax_4ms", "f", "weight", "d1", "h1", "a", "d2", "e",
      "s", "pu"],
     {"f", "d1", "a", "d2", "e", "s"}, 15, "plastik taban plakalı"),
    (22, 570, 800,
     ["wmax_static", "wmax_4ms", "f", "weight", "d1", "h1", "a", "d2", "e",
      "s", "pu"],
     {"f", "d1", "a", "d2", "e", "s"}, 17, "çelik taban plakalı"),
    (23, 280, 600,
     ["wmax_static", "wmax_4ms", "f", "weight", "d1", "h1", "d2", "l", "pu"],
     {"f", "d1", "d2", "l"}, 23, "saplamalı"),
]


def build_cellular() -> tuple[str, int]:
    doc = fitz.open(PDF_CONDUCTIX_PRODUCTS)
    items: list[dict] = []

    for page_no, y0, y1, names, merged, n_rows, mounting in CELLULAR_TABLES:
        for rec in parse_product_table(
            doc[page_no], y0, y1, names, merged, n_rows
        ):
            part = rec["part_no"]
            m = PART_RE.match(part)
            items.append({
                "model": part,
                "type": "hücresel",
                "program": "0180",
                "diameter_mm": clean(num(m.group(2))),
                "height_mm": clean(num(rec.get("h1"))),
                "energy_capacity_kj": clean(num(rec.get("wmax_4ms"))),
                "energy_capacity_static_kj": clean(num(rec.get("wmax_static"))),
                "max_force_kn": clean(num(rec.get("f"))),
                "max_compression_pct": CELLULAR_MAX_COMPRESSION_PCT,
                "weight_kg": clean(num(rec.get("weight"))),
                "mounting": mounting,
                "thread": _thread(rec),
                "packing_unit": clean(num(rec.get("pu"))),
                "standard_range": rec["standard_range"],
            })
    doc.close()

    items.sort(key=lambda r: (r["diameter_mm"], r["height_mm"] or 0, r["model"]))
    path = write_json(
        "conductix_cellular.json",
        {
            "brand": "Conductix-Wampfler",
            "equipment_type": "buffer",
            "buffer_type": "hücresel",
            "program": "0180",
            "source_pdf": "KAT0170-0002-EN Rubber and Cellular Buffers, "
                          "Programs 0170_0180.pdf",
            "source_pages": "23 (taban plakalı), 24 (saplamalı)",
            "extraction_date": "2026-08-06",
            "max_compression_pct": CELLULAR_MAX_COMPRESSION_PCT,
            "material": "hücresel poliüretan elastomer (PUR), 0,53 g/cm³ "
                        "(katalog s.22)",
            "operating_temperature_c": "-20 … +80",
            "notes": (
                "Wmax İKİ SÜTUN hâlinde basılıdır: 'static' ve '4 m/s'. Hücresel "
                "malzeme hız duyarlıdır; katalog dipnotu: 'Lower speeds reduce "
                "the maximum energy absorption'. energy_capacity_kj = 4 m/s "
                "sütunu (dinamik, çarpma hâli — vinç tamponu bu koşulda "
                "çalışır), energy_capacity_static_kj = statik sütun. ARA HIZLAR "
                "İÇİN katalogda değer YOKTUR; hücresel yük diyagramları KAT0180 "
                "ayrı bir dokümandır ve bu pakette VERİLMEMİŞTİR — hücresel "
                "tampon için eğri dosyası ÜRETİLMEMİŞTİR, uydurulmamıştır. "
                "max_force_kn, d1/a/d2/e/s ile birlikte birleştirilmiş "
                "sütundur; d2 ve s İKİ çap grubunu birden kapsar. "
                "max_compression_pct = 80 katalog s.4 ve s.6'dan DOĞRULANMIŞTIR. "
                "018112-200x200-A / -300-A satırları çelik taban plakalı "
                "varyanttır (aynı ölçü, farklı plaka ve paketleme). "
                "018112 serisinin tamamında entegre düşme emniyeti vardır "
                "(katalog s.22): 3 m ve üzeri montaj yüksekliğinde bu seri "
                "önerilir."
            ),
        },
        ["model", "type", "program", "diameter_mm", "height_mm",
         "energy_capacity_kj", "energy_capacity_static_kj", "max_force_kn",
         "max_compression_pct", "weight_kg", "mounting", "thread",
         "packing_unit", "standard_range"],
        items,
    )
    return path, len(items)


if __name__ == "__main__":
    for path, n in (build_rubber(), build_cellular()):
        print(f"yazıldı: {path}  ({n} satır)")
