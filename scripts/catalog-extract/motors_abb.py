# -*- coding: utf-8 -*-
"""ABB Process Performance (M3BP) dökme gövde motor kataloğu çıkarımı.

Kaynak: `abb-ozel-elektrik-motor-katalog.pdf` (9AKK105944 EN 02-2020).

Sayfa seçimi
------------
Uygulama 400 V / 50 Hz şebeke için motor seçtirir; 60 Hz (460 V) tabloları
kapsam dışıdır. Gövde malzemesi vinç kullanımı için DÖKME (M3BP) seçilmiştir;
alüminyum bölümü (s.104-147) alınmaz.

Katalogda IE3 dökme gövde iki KUŞAK hâlinde basılıdır — ürün kodunun son harfi
kuşağı verir (bkz. yer imleri: "IE3 aluminum motors, J/L-generation" ve
"K-generation"):

    s.37-42  → K kuşağı (2 kutupta yalnız "B design" bölümü var)
    s.43-49  → L kuşağı (2/4/6 kutupta da CENELEC-design bölümü var)

L kuşağı alınır: üç kutup sayısında da AYNI tasarım ailesi (CENELEC-design)
basılıdır, gövde aralığı daha geniştir (71-355) ve gövde↔güç ataması IEC/CENELEC
kademelemesine uyar. Karışık kuşak/tasarım seçmek gövde-mil tutarlılığını bozar.

8 kutup IE3 dökme gövde bu katalogda YOKTUR (IE3 bölümü yalnız 2/4/6 kutup).
Bu yüzden 8 kutup IE2 CENELEC tablosundan (s.26) alınır — sapma meta.notes'a
ve README'ye yazılır. Uydurma satır üretilmez.

Her sayfada "CENELEC-design" ve "High-output design" bölümleri bulunabilir.
High-output satırları aynı (güç, kutup) çiftini daha büyük gövdeyle TEKRAR eder;
katalogda tek satır kalması için ALINMAZ.

Sütunlar sayfada çizgiyle ayrılmadığından (`grid.py` burada işe yaramaz) başlık
x konumlarından türetilmiş sabit bantlarla okunur (`motors_common.banded_cells`).
"""
import re

import fitz

import motors_common as mc

# (pdf indeksi, verim sınıfı, mil ölçü sayfasının pdf indeksi)
PERF_PAGES = [
    (42, "IE3", 87),   # s.43 · 3000 r/min = 2 kutup · CENELEC-design (L kuşağı)
    (43, "IE3", 87),   # s.44 · 1500 r/min = 4 kutup · CENELEC-design (L kuşağı)
    (45, "IE3", 87),   # s.46 · 1000 r/min = 6 kutup · CENELEC-design (L kuşağı)
    (25, "IE2", 85),   # s.26 ·  750 r/min = 8 kutup · CENELEC-design (IE2)
]

# Mil ölçü (boyut) tabloları: s.86 IE2 dökme · s.88 IE3 dökme
SHAFT_PAGES = {85: "IE2", 87: "IE3"}

# Performans tablosu başlık x merkezleri (bkz. dosya sonundaki __main__ dökümü):
# kW 48 · Motor type 92 · varyant ~116 · kutup ~133 · ürün kodu 169 · r/min 218 ·
# η100 243 · η75 271 · η50 300 · cosφ 328 · IN 352 · IS/IN 374 · TN 398 ·
# TI/TN 425 · Tb/TN 448 · GD² 478 · kg 509 · LPA 538
PERF_BANDS = [
    ("power", 38, 80),
    ("type", 80, 100),
    ("variant", 100, 121),
    ("poles", 121, 140),
    ("code", 140, 205),
    ("speed", 205, 232),
    ("eff100", 232, 260),
    ("eff75", 260, 289),
    ("eff50", 289, 317),
    ("cos", 317, 344),
    ("current", 344, 366),
    ("istart", 366, 388),
    ("torque", 388, 416),
    ("tstart", 416, 440),
    ("tbreak", 440, 462),
    ("inertia", 462, 500),
    ("weight", 500, 530),
    ("noise", 530, 560),
]

# Boyut tablosu: gövde kodu 38-86 · D (2 kutup) 86 · D (4-8 kutup) 116
SHAFT_BANDS = [
    ("frame", 38, 86),
    ("d2", 86, 105),
    ("d48", 105, 130),
]

SECTION_RE = re.compile(r"(\d+)\s*r/min\s*=\s*(\d+)\s*poles")
FOOTNOTE_RE = re.compile(r"(\d)\)")
# Dipnot tanımı: "3) Efficiency class IE1". NUMARALANDIRMA SAYFADAN SAYFAYA
# DEĞİŞİR (s.26'da 4) = IE1, s.43'te 3) = IE1), bu yüzden her sayfada yeniden
# okunur — sabit bir eşleme yanlış sınıf yazar.
FOOTDEF_RE = re.compile(r"^(\d)\)\s*Efficiency class (IE\d)\s*$", re.M)


def _sections(page):
    """Sayfadaki bölüm başlıklarını [(y, kutup, satır metni), ...] verir."""
    out = []
    for yc, rw in mc.rows_by_y(mc.words(page)):
        line = " ".join(w[4] for w in rw)
        m = SECTION_RE.search(line)
        if m:
            out.append((yc, int(m.group(2)), line))
    return out


def shaft_table(doc, page_index):
    """Boyut sayfasından {gövde kodu: (D_2kutup, D_4-8kutup)} çıkarır.

    Tablo bazı gövdeleri dipnotla ikiye böler ("160 1)" / "160 2)" = MLA 2 ve
    diğerleri); iki satırın D değeri aynı olduğundan dipnot işareti atılır ve
    ilk satır kazanır.
    """
    table = {}
    for yc, rw in mc.rows_by_y(mc.words(doc[page_index])):
        c = mc.banded_cells(rw, SHAFT_BANDS)
        frame = FOOTNOTE_RE.sub("", c.get("frame", "")).replace(" ", "").rstrip("_")
        if not re.match(r"^\d{2,3}[A-Z]*$", frame):
            continue
        d2, d48 = mc.num(c.get("d2")), mc.num(c.get("d48"))
        if d2 is None and d48 is None:
            continue
        table.setdefault(frame, (d2, d48))
    return table


def shaft_for(variant, poles, table):
    """Performans tablosundaki gövde varyantını boyut tablosuyla eşler.

    Performans tablosu güç kademesini varyant koduna ekler (132SMB, 100LKA);
    boyut tablosu ise ölçünün değiştiği yere kadar kısaltılmış kodu basar
    (132, 100LK). En UZUN önek eşleşmesi doğru satırı verir — "100LKA" önce
    "100LK" ile eşleşmeli, "100L" ile değil.
    """
    v = variant.replace(" ", "").rstrip("_")
    for n in range(len(v), 1, -1):
        hit = table.get(v[:n])
        if hit:
            return hit[0] if poles == 2 else hit[1]
    return None


def extract():
    doc = fitz.open(mc.PDF["abb"])
    shafts = {idx: shaft_table(doc, idx) for idx in SHAFT_PAGES}
    items, missing, pages_used = [], [], []

    for pidx, eff_class, shaft_idx in PERF_PAGES:
        page = doc[pidx]
        foot_class = dict(FOOTDEF_RE.findall(page.get_text("text")))
        secs = _sections(page)
        # Bölüm sınırı: bir başlıktan bir sonraki başlığa kadar
        bounds = []
        for i, (yc, sec_poles, line) in enumerate(secs):
            y_end = secs[i + 1][0] if i + 1 < len(secs) else 10_000
            bounds.append((yc, y_end, sec_poles, "High-output" in line))

        n_before = len(items)
        poles_here = set()
        for yc, rw in mc.rows_by_y(mc.words(page)):
            sec = next((b for b in bounds if b[0] < yc < b[1]), None)
            if sec is None or sec[3]:
                continue
            c = mc.banded_cells(rw, PERF_BANDS)
            if not c.get("type", "").startswith("M3BP"):
                continue
            poles = sec[2]
            # Güç hücresi dipnot taşıyabilir ("250 1)"); işaret ayrı okunur.
            raw_power = c.get("power", "")
            marks = FOOTNOTE_RE.findall(raw_power)
            power = mc.num(FOOTNOTE_RE.sub("", raw_power))
            row_class = next((foot_class[m] for m in marks if m in foot_class), eff_class)
            variant = c.get("variant", "").replace(" ", "")
            speed = mc.num(c.get("speed"))
            if power is None or speed is None or not variant:
                missing.append((pidx + 1, round(yc, 1), c))
                continue
            frame = mc.frame_number(variant)
            shaft = shaft_for(variant, poles, shafts[shaft_idx])
            shaft_src = "katalog"
            if shaft is None:
                shaft = mc.iec_shaft_mm(frame, poles)
                shaft_src = "IEC 60072-1"
            poles_here.add(poles)
            items.append({
                "power_kw": power,
                "poles": poles,
                "speed_rpm": int(speed),
                "torque_nm": mc.num(c.get("torque")),
                "frame_size": variant,
                "efficiency_pct": mc.num(c.get("eff100")),
                "weight_kg": mc.num(c.get("weight")),
                "shaft_diameter_mm": shaft,
                "current_a": mc.num(c.get("current")),
                "power_factor": mc.num(c.get("cos")),
                "series": "M3BP",
                "efficiency_class": row_class,
                "_nominal_class": eff_class,
                # Dipnotlu satır anma tasarımından sapar (sıcaklık artışı
                # sınıfı F, IE1/IE2 verim) — tekrar elemesinde geri plana atılır.
                "_footnoted": bool(marks),
                "ip_class": "IP55",
                "model": "M3BP " + variant,
                "shaft_source": shaft_src,
            })
        pages_used.append((pidx + 1, sorted(poles_here), len(items) - n_before))

    doc.close()
    items, dropped = dedupe(items)
    return items, pages_used, missing, dropped


def dedupe(items):
    """Aynı (güç, kutup) çifti için tek satır bırakır.

    Katalog bazı güçleri birden çok gövde/varyantla basar (315 kW 8 kutup:
    400LA · 400LKA · 355LKB). Seçim ölçütü sırayla:
      1. sayfanın anma verim sınıfına UYAN satır,
      2. DİPNOTSUZ satır (dipnot sıcaklık artışı sınıfı F ya da düşük verim
         sınıfı demektir; anma tasarımı tercih edilir),
      3. daha KÜÇÜK gövde (aynı güçte daha ekonomik seçim),
      4. daha HAFİF motor,
      5. katalogdaki basım sırası.
    Elenen satırlar geriye bildirilir; sessizce atılmaz.
    """
    def rank(it):
        return (
            0 if it["efficiency_class"] == it["_nominal_class"] else 1,
            1 if it["_footnoted"] else 0,
            mc.frame_number(it["frame_size"]) or 9999,
            it["weight_kg"] if it["weight_kg"] is not None else 9e9,
        )

    groups = {}
    for i, it in enumerate(items):
        groups.setdefault((it["power_kw"], it["poles"]), []).append((i, it))
    keep, dropped = [], []
    for key in sorted(groups):
        rows = sorted(groups[key], key=lambda p: (rank(p[1]), p[0]))
        keep.append(rows[0])
        dropped += [r[1] for r in rows[1:]]
    keep.sort(key=lambda p: p[0])
    out = []
    for _, it in keep:
        it.pop("_nominal_class", None)
        it.pop("_footnoted", None)
        out.append(it)
    return out, dropped


META = {
    "brand": "ABB",
    "equipment_type": "motor",
    "series": "Process performance motors M3BP (dökme gövde)",
    "source_pdf": "abb-ozel-elektrik-motor-katalog.pdf",
    "source_doc": "9AKK105944 EN 02-2020",
    "extraction_date": "2026-08-06",
    "page_range": "s.43 (2 kutup), s.44 (4 kutup), s.46 (6 kutup) IE3 CENELEC-design; "
                  "s.26 (8 kutup) IE2 CENELEC-design; mil çapları s.88 (IE3) ve s.86 (IE2) boyut tabloları",
    "notes": (
        "400 V / 50 Hz, IP55, IC411, yalıtım sınıfı F / sıcaklık artışı sınıfı B. "
        "Yalnız CENELEC-design satırları alınmıştır; aynı sayfalardaki "
        "'High-output design' bölümü aynı gücü daha büyük gövdeyle tekrarladığı "
        "için atlanmıştır. IE3 dökme gövde iki kuşak hâlinde basılıdır; L kuşağı "
        "(ürün kodu ...-••L, s.43-49) alınmıştır çünkü 2/4/6 kutupta da "
        "CENELEC-design bölümü vardır. SAPMA: ABB bu katalogda 8 kutuplu IE3 "
        "dökme gövde motor YAYINLAMIYOR; 8 kutuplu satırlar IE2 tablosundan "
        "(s.26) alınmıştır — her satırın efficiency_class alanı hangi sınıfa ait "
        "olduğunu taşır. shaft_diameter_mm, boyut tablosundaki D ölçüsüdür "
        "(2 kutup ve 4-8 kutup sütunları ayrıdır); kaynağı satır bazında "
        "shaft_source alanındadır."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "abb.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, miss, drop, path = build()
    print("ABB satır:", n, "->", path)
    for p, k, cnt in pages:
        print(f"  s.{p} · kutup {k} · {cnt} satır")
    if drop:
        print("tekrar eden (güç,kutup) için elenen satır:", len(drop))
        for it in drop:
            print(f"    {it['power_kw']} kW · {it['poles']} kutup · "
                  f"{it['frame_size']} · {it['efficiency_class']}")
    if miss:
        print("okunamayan satır:", len(miss))
        for m in miss[:10]:
            print("   ", m)
