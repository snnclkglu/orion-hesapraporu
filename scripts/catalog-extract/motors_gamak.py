# -*- coding: utf-8 -*-
"""GAMAK üç fazlı asenkron motor kataloğu çıkarımı.

Kaynak: `GAMAK MOTOR.pdf` — GAMAK Teknik Katalog 2022 (Türkçe).

Sayfa düzeni
------------
Katalog YATAY YAYIM basılıdır: her PDF sayfası iki basılı sayfayı yan yana
taşır (sol yarı x < 600, sağ yarı x > 600) ve bir yarıda üst üste İKİ tablo
olabilir (üstte alüminyum gövde, altta pik/dökme gövde). Tabloların dikey
çizgileri vardır ama SATIR çizgileri yoktur; bu yüzden sütunlar `grid.rules`
ile, satırlar y kümelemesiyle bulunur (`grid.rows_of`).

    PDF s.21-22 · Yüksek verimli (IE2) 2 ve 4 kutup · alüminyum + pik
    PDF s.23    · IE2 6 kutup (sol) · standart seri 2 kutup (sağ)
    PDF s.24    · standart seri 4 kutup (sol) · 6 kutup (sağ)
    PDF s.25    · standart seri 8 kutup (tek sütun, alüminyum + pik)
    PDF s.26    · Premium verimli (IE3) 2 kutup (sol) · 4 kutup (sağ), pik

Verim sınıfı ve gövde malzemesi BAŞLIKTAN DEĞİL TİP KODUNDAN okunur — başlık
konumu yayım düzenine bağlıdır, tip kodu ise satırın kendi verisidir:

    A GM  2E  132 S 4a
    │  │   │   │  │ │└ güç kademesi
    │  │   │   │  │ └ kutup sayısı
    │  │   │   │  └ gövde uzunluk harfi
    │  │   │   └ yapı büyüklüğü
    │  │   └ verim sınıfı: 2E = IE2 · 3E = IE3 · yok = IE1 (standart seri)
    │  └ GM / GMM = pik (dökme) gövde
    └ A = alüminyum gövde

Satır seçimi
------------
Aynı (güç, kutup) çifti birden çok tabloda geçer (alüminyum ve pik gövde, farklı
verim sınıfları). Tek satır bırakılır; ölçüt sırayla: EN YÜKSEK verim sınıfı →
pik gövde (vinç tahriki dökme gövde ister) → küçük gövde → hafif motor.

SAPMA: GAMAK bu katalogda 8 kutuplu yüksek/premium verimli motor
YAYINLAMIYOR; 8 kutuplu satırların tamamı standart seridir (IE1). Aynı şekilde
IE3 yalnız 55-400 kW arası 2 ve 4 kutupta vardır. Her satırın
`efficiency_class` alanı hangi sınıfa ait olduğunu taşır.

Mil çapı (DØ)
-------------
Boyut tabloları PDF s.31 (yapı büyüklüğü 56-200) ve s.32 (132-450). Bu tablolar
birleştirilmiş hücreler içerdiğinden `grid.py` yerine PyMuPDF'in kendi
`find_tables` çözümleyicisi kullanılır — birleşik hücreyi doğru satıra dağıtan
tek yol budur. 225 ve üstü gövdelerde DØ kutupla değişir (2 kutup daha ince
mil); tablo bunu ayrı satırlarda basar.
"""
import re

import fitz

import grid
import motors_common as mc

MID_X = 600.0        # yayımın sol/sağ yarı sınırı
PERF_PAGES = (20, 21, 22, 23, 24, 25)   # pdf indeksi (basılı s.21-26)
SHAFT_PAGES = (30, 31)                  # pdf indeksi (basılı s.31-32)

# Performans tablosu sütunları (her iki yarıda ve her sayfada aynı sırada).
COL = {
    "power": 0, "type": 1, "speed": 2, "current": 3, "torque": 4,
    "cos": 5, "eff100": 6, "weight": 15,
}

# "AGM2E 132 S 4a" · "GMM 450 H 2b" · "GM3E 250 M 2a"
TYPE_RE = re.compile(
    r"^(?P<alu>A?)(?P<fam>GMM|GM)(?P<eff>2E|3E)?\s+"
    r"(?P<frame>\d{2,3})\s*(?P<letter>[A-Z]*)\s*(?P<poles>\d)(?P<step>[a-z])$"
)

EFF_CLASS = {"3E": "IE3", "2E": "IE2", None: "IE1", "": "IE1"}
CLASS_RANK = {"IE3": 0, "IE2": 1, "IE1": 2}

FRAME_IN_CELL_RE = re.compile(r"\b(\d{2,3})\b")
POLE_GROUP_RE = re.compile(r"^\s*\d(?:\s*-\s*\d)*\s*$")


# --------------------------------------------------------------------------
# Mil çapı tablosu
# --------------------------------------------------------------------------

def shaft_table(doc):
    """{(yapı büyüklüğü, kutup): DØ mm} — s.31 ve s.32 boyut tablolarından.

    Birleşik hücre nedeniyle bir satırda kutup grubu, DØ değeri bir SONRAKİ
    satırda basılabiliyor. Kutup grupları bir kuyruğa alınır ve her DØ değeri
    kuyruktaki ilk grubu tüketir; yeni bir yapı büyüklüğü başlayınca kuyruk
    sıfırlanır (aksi hâlde önceki gövdeden artan grup yanlış satıra yapışır).
    """
    out = {}
    for pidx in SHAFT_PAGES:
        for table in doc[pidx].find_tables(strategy="lines").tables:
            rows = table.extract()
            if len(rows) < 3:
                continue
            header = [" ".join((c or "").split()) for c in rows[1]]
            d_col = next((i for i, h in enumerate(header)
                          if h.split(" ")[0] == "DØ"), None)
            if d_col is None:
                continue
            frame, queue, last = None, [], None
            for r in rows[2:]:
                cell_frame = _frame_of(r[0])
                if cell_frame and cell_frame != frame:
                    frame, queue = cell_frame, []
                for g in str(r[1] or "").split("\n"):
                    if POLE_GROUP_RE.match(g):
                        queue.append(g.strip())
                d = mc.num((r[d_col] or "").split("\n")[0])
                if d is None or frame is None:
                    continue
                group = queue.pop(0) if queue else last
                if group is None:
                    continue
                last = group
                for pole in group.split("-"):
                    out.setdefault((frame, int(pole)), d)
    return out


def _frame_of(cell):
    """'S\\nM\\n315\\nL\\nH' / '200 L' → 315 / 200 | None."""
    m = FRAME_IN_CELL_RE.search(str(cell or ""))
    return int(m.group(1)) if m else None


# --------------------------------------------------------------------------
# Performans tabloları
# --------------------------------------------------------------------------

def _halves(page):
    """Sayfanın sol ve sağ tablosunun sütun sınırlarını verir."""
    vx, _ = grid.rules(page)
    vx = grid.cluster(vx, 5.0)
    for cols in ([v for v in vx if v < MID_X], [v for v in vx if v > MID_X]):
        if len(cols) > COL["weight"] + 1:
            yield cols


def extract():
    doc = fitz.open(mc.PDF["gamak"])
    shafts = shaft_table(doc)
    items, missing, pages_used = [], [], []
    rejected = []

    for pidx in PERF_PAGES:
        page = doc[pidx]
        n_before = len(items)
        for cols in _halves(page):
            for yc, rw in grid.rows_of(grid.words(page)):
                c = grid.cells(rw, cols)
                m = TYPE_RE.match((c.get(COL["type"]) or "").strip())
                if not m:
                    continue
                power = mc.num(c.get(COL["power"]))
                speed = mc.num(c.get(COL["speed"]))
                if power is None or speed is None:
                    missing.append((pidx + 1, round(yc, 1), c))
                    continue
                eff = mc.num(c.get(COL["eff100"]))
                if eff is not None and not (0 < eff <= 100):
                    # Basılı sayfanın kendi dizgi hatası (s.25'te 0,25 kW
                    # 8 kutup satırında verim "630" basılmıştır; ondalık
                    # ayracı hem içerik akışında hem BASILI SAYFADA yoktur).
                    # Doğru değer okunamadığından satır ALINMAZ — tahmin
                    # edilmiş bir verim uydurma veri olur.
                    rejected.append((pidx + 1, (c.get(COL["type"]) or "").strip(),
                                     f"verim %{eff} okunamıyor"))
                    continue
                poles = int(m.group("poles"))
                frame = int(m.group("frame"))
                shaft = shafts.get((frame, poles))
                src = "katalog"
                if shaft is None:
                    shaft = mc.iec_shaft_mm(frame, poles)
                    src = "IEC 60072-1"
                items.append({
                    "power_kw": power,
                    "poles": poles,
                    "speed_rpm": int(speed),
                    "torque_nm": mc.num(c.get(COL["torque"])),
                    "frame_size": f"{frame}{m.group('letter')}",
                    "efficiency_pct": eff,
                    "weight_kg": mc.num(c.get(COL["weight"])),
                    "shaft_diameter_mm": shaft,
                    "current_a": mc.num(c.get(COL["current"])),
                    "power_factor": mc.num(c.get(COL["cos"])),
                    "series": "Alüminyum gövde" if m.group("alu") else "Pik (dökme) gövde",
                    "efficiency_class": EFF_CLASS[m.group("eff")],
                    "ip_class": "IP55",
                    "model": (c.get(COL["type"]) or "").strip(),
                    "shaft_source": src,
                    "_alu": bool(m.group("alu")),
                    "_frame": frame,
                })
        pages_used.append((pidx + 1, len(items) - n_before))

    doc.close()
    items, dropped = dedupe(items)
    return items, pages_used, missing + rejected, dropped


def dedupe(items):
    """Aynı (güç, kutup) için tek satır bırakır (ölçüt modül başlığında)."""
    def rank(it):
        return (
            CLASS_RANK[it["efficiency_class"]],
            1 if it["_alu"] else 0,
            it["_frame"],
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
        it.pop("_alu", None)
        it.pop("_frame", None)
        out.append(it)
    return out, dropped


META = {
    "brand": "GAMAK",
    "equipment_type": "motor",
    "series": "Üç fazlı sincap kafesli asenkron motorlar (standart / yüksek verimli / premium verimli)",
    "source_pdf": "GAMAK MOTOR.pdf",
    "source_doc": "GAMAK Teknik Katalog 2022",
    "extraction_date": "2026-08-06",
    "page_range": "PDF s.21-26 işletme değerleri tabloları; mil çapları PDF s.31 "
                  "(yapı büyüklüğü 56-200) ve s.32 (132-450) boyut tabloları",
    "notes": (
        "3 faz, 400 V, 50 Hz, S1 sürekli çalışma, IP55. Verim sınıfı ve gövde "
        "malzemesi tip kodundan okunur (2E = IE2, 3E = IE3, ekssiz = IE1 "
        "standart seri; baştaki A = alüminyum gövde). Aynı (güç, kutup) çifti "
        "için en yüksek verim sınıfı, eşitlikte pik (dökme) gövde seçilmiştir. "
        "SAPMA: GAMAK bu katalogda 8 kutuplu yüksek verimli (IE2) ya da premium "
        "verimli (IE3) motor yayınlamıyor — 8 kutuplu satırların tamamı standart "
        "seridir (IE1). IE3 yalnız 55-400 kW arası 2 ve 4 kutupta basılıdır. "
        "shaft_diameter_mm boyut tablosundaki DØ ölçüsüdür; 225 ve üstü "
        "gövdelerde kutupla değişir. "
        "ALINMAYAN SATIR: PDF s.25 (8 kutup, standart seri) 0,25 kW "
        "AGM 80 M 8b satırının anma verimi BASILI SAYFADA '630' yazmaktadır — "
        "ondalık ayracı hem PDF içerik akışında hem basılı görüntüde yoktur. "
        "Doğru değer okunamadığından satır alınmamıştır; tahmin edilen bir "
        "verim yazılmamıştır."
    ),
}


def build():
    items, pages, missing, dropped = extract()
    path = mc.os.path.join(mc.CATALOG_DATA, "motors", "gamak.json")
    n = mc.write_catalog(path, META, items)
    return n, pages, missing, dropped, path


if __name__ == "__main__":
    n, pages, miss, drop, path = build()
    print("GAMAK satır:", n, "->", path)
    for p, cnt in pages:
        print(f"  s.{p} · {cnt} ham satır")
    print("tekrar eden (güç,kutup) için elenen satır:", len(drop))
    if miss:
        print("okunamayan satır:", len(miss))
        for m in miss[:10]:
            print("   ", m)
