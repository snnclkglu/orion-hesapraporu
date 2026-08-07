# -*- coding: utf-8 -*-
"""SIMOTICS SD dökme gövde motor kataloğu çıkarımı (marka: INNOMATICS).

Kaynak: `SIEMENS MOTOR KATALOG.pdf` — Siemens Catalog D 81.1, 12/2021,
E86060-K5581-A111-B5, "SIMOTICS GP, SD, XP, DP Low-Voltage Motors".

MARKA ADI: Siemens'in bu ürün hattı INNOMATICS adıyla yenilenmiştir; üretilen
dosya `catalog_data/motors/innomatics.json` ve `meta.brand` = "INNOMATICS".
Kaynak PDF adı ve doküman numarası meta'da Siemens olarak korunur — veri
oradan gelmektedir, kaynağın gizlenmesi doğru olmaz.

Sayfa seçimi
------------
Vinç tahriki için DÖKME gövde (SIMOTICS SD) ve IE3 verim sınıfı seçilmiştir;
alüminyum seri (SIMOTICS GP), IE1/IE2/IE4, APAC/ABNT/Eagle bölgesel hatları ve
"with increased power" tabloları kapsam dışıdır. 400 V / 50 Hz.

IE3 dökme gövdede iki hat vardır ve KUTUP KAPSAMLARI birbirini tamamlar:

    1LE1503 Basic Line       s.150-153 (PDF) · 2K 0,37-200 · 4K 0,25-200 ·
                                              6K 0,18-160 · 8K 0,09-1,5 kW
    1LE1603 Performance Line s.154-157 (PDF) · 2K 3-200 · 4K 2,2-200 ·
                                              6K 1,5-160 · 8K 0,75-132 kW

Tek hat seçmek katalogu sakatlar: Basic Line'da 8 kutup 1,5 kW'ta biter,
Performance Line'da 2 kutup 3 kW'tan başlar. Bu yüzden İKİSİ DE alınır ve aynı
(güç, kutup) çifti için Performance Line tercih edilir (vinç tahrikinde daha
donanımlı gövde). Hangi hattın geldiği her satırda `series` alanındadır.
İki hat AYNI boyut tablosunu paylaşır (s.306-309 başlıkları hem "1LE15.3-" hem
"1LE16.3-" listeler), dolayısıyla gövde ölçüsü ve mil çapı ortaktır.

Mil çapı (D, DE mil ucu)
------------------------
    s.306 (PDF) — IE3 dökme gövde, gövde 71 M … 160 L: gövde sütunu, kutup
                  sütunu ve D sütunu aynı sayfadadır; D kutup sayısından
                  bağımsızdır.
    s.307+308   — gövde 180 M … 315 L: tablo iki sayfaya YAYILMIŞTIR. Sol
                  sayfada gövde + motor tipi kodu + kutup, sağ sayfada aynı
                  motor tipi kodu + D vardır; iki sayfa KOD DİZESİ üzerinden
                  eşlenir (satır y'leri birebir aynı değildir). Bu gövdelerde
                  D kutupla değişir (2 kutup daha ince mil) — eşleme performans
                  tablosundaki ürün numarası parçasıyla (ör. "3AA0") yapılır,
                  böylece kutup ayrımı kendiliğinden doğru olur.

Sayfada çizgi ızgarası yoktur; sütunlar başlık x konumlarından türetilmiş sabit
bantlarla okunur (`motors_common.banded_cells`).
"""
import re

import fitz

import motors_common as mc

# (pdf indeksi, kutup, seri kodu, seri adı)
PERF_PAGES = [
    (149, 2, "1LE1503", "1LE1503 Basic Line"),
    (150, 4, "1LE1503", "1LE1503 Basic Line"),
    (151, 6, "1LE1503", "1LE1503 Basic Line"),
    (152, 8, "1LE1503", "1LE1503 Basic Line"),
    (153, 2, "1LE1603", "1LE1603 Performance Line"),
    (154, 4, "1LE1603", "1LE1603 Performance Line"),
    (155, 6, "1LE1603", "1LE1603 Performance Line"),
    (156, 8, "1LE1603", "1LE1603 Performance Line"),
]

# Aynı (güç, kutup) için tercih sırası — küçük olan kazanır.
LINE_RANK = {"1LE1603": 0, "1LE1503": 1}

SHAFT_SMALL_PAGE = 306      # gövde 71 M … 160 L (tek sayfa)
SHAFT_WIDE_PAGES = (307, 308)   # gövde 180 M … 315 L (sol + sağ sayfa)

# Performans tablosu bantları. Başlık x merkezleri:
# P50 56 · P60 78 · gövde 98 + harf 108 · n 125 · T 146 · farklı IE sınıfı 163 ·
# η4/4 197 · η3/4 217 · η2/4 236 · cosφ 256 · I 280 · TLR 298 · ILR 316 ·
# TB 334 · LpfA 353 · LWA 375 · ürün no + ağırlık 400-500 · J 525
PERF_BANDS = [
    ("power", 46, 70),
    ("power60", 70, 90),
    ("frame_no", 90, 103),
    ("frame_letter", 103, 120),
    ("speed", 120, 138),
    ("torque", 138, 158),
    ("ie60", 158, 182),
    ("eff100", 185, 208),
    ("eff75", 208, 227),
    ("eff50", 227, 247),
    ("cos", 247, 268),
    ("current", 268, 292),
    ("tlr", 292, 308),
    ("ilr", 308, 325),
    ("tb", 325, 344),
    ("lpfa", 344, 364),
    ("lwa", 364, 390),
    ("article", 390, 512),
    ("inertia", 512, 560),
]

SHAFT_SMALL_BANDS = [
    ("frame", 50, 80),
    ("code", 80, 122),
    ("poles", 122, 152),
    ("d", 306, 330),
]
SHAFT_WIDE_LEFT_BANDS = [
    ("frame", 50, 80),
    ("code", 82, 185),
    ("poles", 185, 216),
]
SHAFT_WIDE_RIGHT_BANDS = [
    ("code", 52, 160),
    ("d", 306, 328),
]

# Ürün numarası ile AĞIRLIK bitişik basıldığından tek kelimeye yapışır:
# "1LE1503-0CA2■-■■■■13" → kod parçası "0CA2", ağırlık 13 kg.
ARTICLE_RE = re.compile(r"1LE1[0-9]{3}-([0-9A-Z]{4})[■■]-[■■]{4}([\d.,]+)")

# IEC 60072-1 gövde kademeleri — metin katmanı artığını onarmak için.
IEC_FRAMES = (56, 63, 71, 80, 90, 100, 112, 132, 160, 180, 200, 225, 250,
              280, 315, 355, 400, 450)


def clean_frame_no(raw):
    """Gövde sütunundaki sayıyı IEC kademesine oturtur.

    PDF'in metin katmanı 8 kutuplu sayfalarda "112" yerine "1112" üretiyor
    (s.153 ve s.157, 1,5 kW satırı). Baştaki fazla basamak atılarak geçerli
    IEC kademesi aranır; hiçbiri tutmazsa None döner ve satır eksik sayılır —
    tahmin edilmez.
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    for start in range(len(digits)):
        try:
            n = int(digits[start:])
        except ValueError:
            continue
        if n in IEC_FRAMES:
            return n
    return None


def _rows(page, bands, ymin=0):
    for yc, rw in mc.rows_by_y(mc.words(page)):
        if yc < ymin:
            continue
        yield yc, mc.banded_cells(rw, bands)


def _codes(cell):
    """'2BB2, 2BC2, 2BD2' → ['2BB2', '2BC2', '2BD2'] (yalnız 4 karakterli kod)."""
    if not cell:
        return []
    return [t for t in re.split(r"[,\s]+", cell) if re.fullmatch(r"[0-9A-Z]{4}", t)]


def shaft_small(doc):
    """s.306: {(gövde no, harf): D} ve {gövde no: {D}} verir."""
    by_key, by_no = {}, {}
    frame = None
    for yc, c in _rows(doc[SHAFT_SMALL_PAGE], SHAFT_SMALL_BANDS, ymin=500):
        f = c.get("frame")
        m = re.match(r"^(\d{2,3})\s*([A-Z]?)$", (f or "").strip())
        if m:
            frame = (int(m.group(1)), m.group(2))
        d = mc.num(c.get("d"))
        if d is None or frame is None:
            continue
        by_key.setdefault(frame, d)
        by_no.setdefault(frame[0], set()).add(d)
    return by_key, by_no


def shaft_wide(doc):
    """s.307+308: {ürün kodu parçası: D}.

    Sol sayfa gövde/kutup, sağ sayfa D taşır; ikisi KOD DİZESİ ile eşlenir.
    Kod dizesi olmayan ara satırlar bir önceki D'yi devralır (katalog yalnız
    değişen ölçüyü tekrar basar).
    """
    left = {}   # kod dizesi -> (gövde, kutuplar)
    frame = None
    for yc, c in _rows(doc[SHAFT_WIDE_PAGES[0]], SHAFT_WIDE_LEFT_BANDS, ymin=500):
        m = re.match(r"^(\d{2,3})\s*([A-Z]?)", (c.get("frame") or "").strip())
        if m:
            frame = (int(m.group(1)), m.group(2))
        codes = _codes(c.get("code"))
        if codes:
            left[tuple(codes)] = frame

    out, last_d = {}, None
    for yc, c in _rows(doc[SHAFT_WIDE_PAGES[1]], SHAFT_WIDE_RIGHT_BANDS, ymin=500):
        codes = _codes(c.get("code"))
        if not codes:
            continue
        d = mc.num(c.get("d"))
        if d is None:
            d = last_d
        else:
            last_d = d
        if d is None:
            continue
        for code in codes:
            out.setdefault(code, d)
    return out, left


def extract():
    doc = fitz.open(mc.PDF["siemens"])
    small_key, small_no = shaft_small(doc)
    wide, _ = shaft_wide(doc)

    items, missing, pages_used = [], [], []
    for pidx, poles, line_code, line_name in PERF_PAGES:
        n_before = len(items)
        for yc, c in _rows(doc[pidx], PERF_BANDS, ymin=180):
            m = ARTICLE_RE.search(c.get("article", ""))
            if not m:
                continue
            code, weight = m.group(1), mc.num(m.group(2))
            power = mc.num(c.get("power"))
            speed = mc.num(c.get("speed"))
            frame_no = clean_frame_no(c.get("frame_no"))
            letter = (c.get("frame_letter") or "").strip()
            if power is None or speed is None or frame_no is None:
                missing.append((pidx + 1, round(yc, 1), c))
                continue

            shaft, src = wide.get(code), "katalog (s.308)"
            if shaft is None:
                shaft = small_key.get((frame_no, letter))
                src = "katalog (s.306)"
            if shaft is None:
                cands = small_no.get(frame_no) or set()
                if len(cands) == 1:
                    shaft = next(iter(cands))
                    src = "katalog (s.306, gövde kademesi tek D taşıyor)"
            if shaft is None:
                shaft = mc.iec_shaft_mm(frame_no, poles)
                src = "IEC 60072-1"

            items.append({
                "power_kw": power,
                "poles": poles,
                "speed_rpm": int(speed),
                "torque_nm": mc.num(c.get("torque")),
                "frame_size": f"{frame_no}{letter}",
                "efficiency_pct": mc.num(c.get("eff100")),
                "weight_kg": weight,
                "shaft_diameter_mm": shaft,
                "current_a": mc.num(c.get("current")),
                "power_factor": mc.num(c.get("cos")),
                "series": line_name,
                "efficiency_class": "IE3",
                "ip_class": "IP55",
                "model": f"{line_code}-{code}",
                "shaft_source": src,
                "_line": line_code,
            })
        pages_used.append((pidx + 1, poles, line_code, len(items) - n_before))

    doc.close()
    items, dropped = dedupe(items)
    return items, pages_used, missing, dropped


def dedupe(items):
    """Aynı (güç, kutup) için tek satır: Performance Line kazanır.

    İki hat aynı güçleri kapsadığından örtüşme normaldir; elenen satırlar
    geriye bildirilir, sessizce atılmaz.
    """
    groups = {}
    for i, it in enumerate(items):
        groups.setdefault((it["power_kw"], it["poles"]), []).append((i, it))
    keep, dropped = [], []
    for key in sorted(groups):
        rows = sorted(groups[key], key=lambda p: (LINE_RANK[p[1]["_line"]], p[0]))
        keep.append(rows[0])
        dropped += [r[1] for r in rows[1:]]
    keep.sort(key=lambda p: p[0])
    out = []
    for _, it in keep:
        it.pop("_line", None)
        out.append(it)
    return out, dropped


META = {
    "brand": "INNOMATICS",
    "equipment_type": "motor",
    "series": "SIMOTICS SD 1LE1503 Basic Line / 1LE1603 Performance Line (dökme gövde, IE3)",
    "source_pdf": "SIEMENS MOTOR KATALOG.pdf",
    "source_doc": "Siemens Catalog D 81.1 · 12/2021 · E86060-K5581-A111-B5",
    "extraction_date": "2026-08-06",
    "page_range": "PDF s.150-153 (1LE1503, katalog 3/18-3/21) ve s.154-157 "
                  "(1LE1603, katalog 3/22-3/25); mil çapları PDF s.306 "
                  "(gövde 71-160) ve s.307-308 (gövde 180-315)",
    "notes": (
        "Siemens motor kataloğu; marka INNOMATICS olarak yenilendi. "
        "400 V / 50 Hz, IP55, IC411, termik sınıf 155 (F), IE3 Premium "
        "Efficiency. Dökme gövde SIMOTICS SD seçilmiştir; alüminyum SIMOTICS GP, "
        "IE1/IE2/IE4 ve bölgesel hatlar (APAC/ABNT/Eagle) kapsam dışıdır. "
        "SAPMA: tek bir ürün hattı dört kutup sayısını da kapsamadığı için "
        "(Basic Line 8 kutupta 1,5 kW'ta biter, Performance Line 2 kutupta "
        "3 kW'tan başlar) iki hat birleştirilmiştir; aynı (güç, kutup) çifti "
        "için Performance Line tercih edilir. Her satırın series alanı hangi "
        "hattan geldiğini taşır; iki hat aynı boyut tablosunu paylaştığından "
        "gövde ölçüleri ve mil çapları ortaktır. shaft_diameter_mm boyut "
        "tablosundaki D (DE mil ucu) ölçüsüdür; 180 ve üstü gövdelerde kutupla "
        "değiştiğinden ürün numarası üzerinden eşlenmiştir."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "innomatics.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, miss, drop, path = build()
    print("INNOMATICS satır:", n, "->", path)
    for p, k, line, cnt in pages:
        print(f"  s.{p} · {k} kutup · {line} · {cnt} satır")
    if drop:
        print("örtüşen (güç,kutup) için elenen satır:", len(drop))
    if miss:
        print("okunamayan satır:", len(miss))
        for m in miss[:10]:
            print("   ", m)
