# -*- coding: utf-8 -*-
"""SIBRE kaplin kataloğu (02_SIBRE_Coupling-catalogue.pdf) → JSON.

Bu PDF'in METİN KATMANI VARDIR (29 sayfada ~55 000 karakter), bu yüzden
tablolar elle yazılmaz: sayfa `page.get_text("words")` ile okunur, kelimeler
y'ye göre satıra kümelenir ve x'e göre sütuna eşlenir.

Kataloğun kaplin bölümleri (PDF indisi 0 tabanlı):

  idx  başlık                          yön        seri
  ---  ------------------------------  ---------  --------------------
    5  FLEXIBLE COUPLING ALC-A         satır      ALC-A
    6  FLEXIBLE COUPLING ALC-AS/ALC-AT satır      ALC-AS (sol) / ALC-AT (sağ)
    7  FLEXIBLE COUPLING AFC-A/AFC-AS  sütun      AFC-A (sol) / AFC-AS (sağ)
    8  PIN COUPLING APC-A              sütun      APC-A
    9  PIN COUPLING APC-AS (2 yayım)   sütun      APC-AS
   10  PIN COUPLING APC-AT / APC-BT    sütun      APC-AT (sol) / APC-BT (sağ)
   12  GEAR COUPLING ZKES              sütun      ZKES
   23  DRUM COUPLING ABC-V — Tablo 3   sütun      ABC-V

KAPSAM DIŞI: idx 14-16'daki BRAKE DISCS (BS) ve BRAKE DRUM (DIN 15431)
sayfaları KAPLİN DEĞİLDİR — kaplinin üzerine takılan fren elemanlarıdır ve
bu katalog dosyalarına alınmamıştır.

ABC-V'DE ANMA MOMENTİ YOKTUR.  Basılı Tablo 3 tek bir moment sütunu verir:
"Torque(1) Tk max".  Kataloğun kendi çözümlü örneği (s.46) seçimi doğrudan
bu değerle yapar: T'Amax = 156 600 Nm ≤ Tkmax = 180 000 Nm.  Bu yüzden hem
nominal_torque_Nm hem max_torque_Nm bu tek değeri taşır.  Önceki
sibre_abc_drum.json'daki `nominal = Tkmax / 1.6` bölmesi katalogda YOKTUR
(1.6, işletme katsayısı Cerf'in M6 değeridir ve TAHRİK momentine uygulanır,
kaplini derate etmez) — kaldırılmıştır.
"""

from __future__ import annotations

import fitz

from couplings_common import PDF_SIBRE, item, remove_stale, write_catalog

BRAND = "SIBRE"
SRC = "02_SIBRE_Coupling-catalogue.pdf"
DATE = "2026-08-06"


# ------------------------------------------------------------ sayfa okuma

def page_rows(page, xmin=0.0, xmax=1e9, ytol=3.0):
    """Sayfayı (y → [(x, metin), ...]) satırlarına çevirir."""
    words = [w for w in page.get_text("words") if xmin <= w[0] <= xmax]
    rows = {}
    for w in words:
        y = (w[1] + w[3]) / 2.0
        key = None
        for k in rows:
            if abs(k - y) < ytol:
                key = k
                break
        if key is None:
            rows[y] = []
            key = y
        rows[key].append((w[0], w[4]))
    return {y: sorted(v) for y, v in sorted(rows.items())}


def num(tok):
    """'1,5' / '425.5' / '-' → float | None."""
    t = tok.strip().replace(",", ".")
    if t in ("-", "", "*"):
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return int(v) if v == int(v) else v


def find_row(rows, first_tokens, skip=0):
    """İlk kelimeleri `first_tokens` ile başlayan satırı döndürür."""
    hits = []
    for y, cells in rows.items():
        toks = [c[1] for c in cells]
        if toks[:len(first_tokens)] == list(first_tokens):
            hits.append((y, cells))
    if len(hits) <= skip:
        raise LookupError("satir bulunamadi: %r" % (first_tokens,))
    return hits[skip]


def value_row(rows, label_tokens, anchors, skip=0):
    """Etiketli bir satırın sayılarını sütun x çapalarına eşler.

    `anchors` sütun merkezleridir; her sayı EN YAKIN çapaya yazılır.  Bu,
    "-" yer tutucusu basılmamış satırlarda kaymayı önler.
    """
    _, cells = find_row(rows, label_tokens, skip)
    out = [None] * len(anchors)
    for x, tok in cells:
        v = num(tok)
        if v is None:
            continue
        j = min(range(len(anchors)), key=lambda k: abs(anchors[k] - x))
        if abs(anchors[j] - x) <= 30 and out[j] is None:
            out[j] = v
    return out


def opt_row(rows, candidates, anchors):
    """İlk bulunan etiket satırını okur; hiçbiri yoksa boş liste döndürür."""
    for label in candidates:
        try:
            return value_row(rows, label, anchors)
        except LookupError:
            continue
    return [None] * len(anchors)


def row_anchors(rows, first_tokens, skip=0):
    """Boy başlığı satırından sütun x merkezlerini ve boy adlarını okur."""
    _, cells = find_row(rows, first_tokens, skip)
    rest = cells[len(first_tokens):]
    return [c[0] for c in rest], [c[1] for c in rest]


def _meta(series, ctype, page, note):
    return {
        "brand": BRAND,
        "equipment_type": "coupling",
        "coupling_type": ctype,
        "series": series,
        "source_pdf": SRC,
        "source_page": page,
        "extraction_date": DATE,
        "extraction_method": (
            "PDF metin katmanindan koordinat tabanli okuma "
            "(scripts/catalog-extract/couplings_sibre.py)."
        ),
        "notes": note,
    }


# ------------------------------------------------------- satır yönlü ALC

def alc_rows(page, xmin, xmax, series, columns):
    """ALC tabloları satır yönlüdür: her satır bir boy, sütunlar sabittir."""
    rows = page_rows(page, xmin, xmax)
    out = []
    for y, cells in rows.items():
        toks = [c[1] for c in cells]
        vals = [num(t) for t in toks]
        if len(vals) != len(columns):
            continue
        if vals[0] is None or not (30 <= vals[0] <= 200):
            continue
        rec = dict(zip(columns, vals))
        out.append((y, rec))
    return [r for _, r in sorted(out)]


ALC_A_COLS = ["size", "Tkn", "Tkmax", "nmax", "pilot", "D4max", "D5max",
              "D6", "D14", "dR", "L1", "L2", "L3", "LE", "S", "F", "I", "G"]
ALC_S_COLS = ["size", "Tkn", "Tkmax", "pilot", "D4max", "D5max", "D6",
              "D2", "D14", "D15", "dR", "L1", "L2", "L3", "L4", "LE", "S",
              "F", "bolt", "Z", "Ma1", "I", "G"]


def build_alc(doc):
    # ---- ALC-A (idx 5, sağ yarı)
    recs = alc_rows(doc[5], 600, 1200, "ALC-A", ALC_A_COLS)
    items = [item(
        model="ALC-A %g" % r["size"],
        coupling_type="flexible",
        series="ALC-A",
        nominal_torque_Nm=r["Tkn"],
        max_torque_Nm=r["Tkmax"],
        max_bore_mm=max(r["D4max"], r["D5max"]),
        weight_kg=r["G"],
        outer_diameter_mm=r["D6"],
        max_speed_rpm=r["nmax"],
    ) for r in recs]
    write_catalog(
        "sibre_alc_a.json",
        _meta("ALC-A", "flexible", "s.10-11 (PDF idx 5)",
              "Elastik kaplin, motor-reduktor baglantisi. max_bore_mm motor "
              "(D4) ve reduktor (D5) taraflarinin buyuk olanidir; ikisi bu "
              "seride esittir. Agirlik ve atalet EN BUYUK delik icin "
              "basilidir."),
        items)

    # ---- ALC-AS (idx 6, sol) ve ALC-AT (idx 6, sağ)
    for series, xmin, xmax, note in (
        ("ALC-AS", 0, 600,
         "Fren DISKLI elastik kaplin. Fren diski capina bagli agirlik ve "
         "izin verilen fren torku sayfanin ust tablosundadir; buradaki "
         "weight_kg kaplinin fren diski OLMADAN agirligidir."),
        ("ALC-AT", 600, 1200,
         "Fren KASNAKLI elastik kaplin. Buradaki weight_kg kaplinin fren "
         "kasnagi OLMADAN agirligidir."),
    ):
        recs = alc_rows(doc[6], xmin, xmax, series, ALC_S_COLS)
        items = [item(
            model="%s %g" % (series, r["size"]),
            coupling_type="flexible",
            series=series,
            nominal_torque_Nm=r["Tkn"],
            max_torque_Nm=r["Tkmax"],
            max_bore_mm=max(r["D4max"], r["D5max"]),
            weight_kg=r["G"],
            outer_diameter_mm=r["D6"],
        ) for r in recs]
        write_catalog("sibre_%s.json" % series.lower().replace("-", "_"),
                      _meta(series, "flexible", "s.12-13 (PDF idx 6)", note),
                      items)


# ------------------------------------------------- sütun yönlü tablolar

def build_afc(doc):
    page = doc[7]
    for series, xmin, xmax, note in (
        ("AFC-A", 0, 640,
         "Tam-flex elastik kaplin (flansli). Katalog bu tabloda agirlik "
         "basmaz — weight_kg yazilmadi."),
        ("AFC-AS", 640, 1200,
         "Fren diskli tam-flex elastik kaplin. Sayfadaki agirlik tablosu "
         "fren diski capina gore verilmistir; tek bir kaplin agirligi "
         "basili degildir — weight_kg yazilmadi."),
    ):
        rows = page_rows(page, xmin, xmax)
        anchors, names = row_anchors(rows, ("Coupling", "Size"))
        tkn = value_row(rows, ("Tkn", "Nm"), anchors)
        tkmax = value_row(rows, ("Tkmax", "Nm"), anchors)
        nmax = value_row(rows, ("nmax", "rpm"), anchors)
        bore = value_row(rows, ("max.", "bore", "mm"), anchors)
        dh = value_row(rows, ("Ø", "DH", "mm"), anchors)
        items = [item(
            model="%s %s" % (series, names[i].split("-")[-1]),
            coupling_type="flexible",
            series=series,
            nominal_torque_Nm=tkn[i],
            max_torque_Nm=tkmax[i],
            max_bore_mm=bore[i],
            outer_diameter_mm=dh[i],
            max_speed_rpm=nmax[i],
        ) for i in range(len(names))]
        write_catalog("sibre_%s.json" % series.lower().replace("-", "_"),
                      _meta(series, "flexible", "s.14-15 (PDF idx 7)", note),
                      items)


APC_PAGES = [
    # (seri, PDF idx, xmin, xmax, başlık kelimeleri, atlanacak eşleşme, not)
    ("APC-A", 8, 600, 1200, ("Coupling", "Type"), 0,
     "Pimli (elastik burclu) kaplin — standart. Reduktor-teker "
     "baglantisinda kullanilir."),
    ("APC-AS", 9, 0, 620, ("Coupling", "Type"), 0,
     "Fren diskli pimli kaplin. Sayfanin sag yarisi fren diski capina gore "
     "agirlik tablosudur; buradaki weight_kg fren diski OLMADAN, en buyuk "
     "delik icin basilan Gges degeridir."),
    ("APC-AT", 10, 0, 620, ("coupling", "type"), 0,
     "Fren kasnakli pimli kaplin."),
    ("APC-BT", 10, 620, 1200, ("coupling", "type"), 0,
     "Fren kasnakli pimli kaplin, kisa govde. Anma momentleri APC-AT'den "
     "DUSUKTUR (kasnak govdesi kisadir)."),
]


def build_apc(doc):
    for series, idx, xmin, xmax, head, skip, note in APC_PAGES:
        rows = page_rows(doc[idx], xmin, xmax)
        anchors, names = row_anchors(rows, head, skip)
        # Boy adi sayfaya gore "APC160A" ya da "APC" "160" "AS" biciminde
        # bolunmus olabilir; yalniz SAYIYI aliriz ve model adini seriden
        # tekdüze uretiriz.
        anchors, labels = _apc_sizes(names, anchors)
        tkn = value_row(rows, ("TKN", "Nm"), anchors)
        tkmax = value_row(rows, ("TKmax", "Nm"), anchors)
        nmax = value_row(rows, ("nmax", "min-1"), anchors)
        d4 = value_row(rows, ("Max", "Ø", "D4", "mm"), anchors)
        d5 = value_row(rows, ("Max", "Ø", "D5", "mm"), anchors)
        d6 = value_row(rows, ("Ø", "D6", "mm"), anchors)
        weight = opt_row(rows, [("Gges*", "kg"), ("Gges", "kg")], anchors)
        items = []
        for i, lab in enumerate(labels):
            bores = [b for b in (d4[i], d5[i]) if b is not None]
            items.append(item(
                model="%s %s" % (series, lab),
                coupling_type="pin",
                series=series,
                nominal_torque_Nm=tkn[i],
                max_torque_Nm=tkmax[i],
                max_bore_mm=max(bores) if bores else None,
                weight_kg=weight[i],
                outer_diameter_mm=d6[i],
                max_speed_rpm=nmax[i],
            ))
        write_catalog("sibre_%s.json" % series.lower().replace("-", "_"),
                      _meta(series, "pin", "PDF idx %d" % idx, note), items)


def _apc_sizes(names, anchors):
    """Boy başlıklarından (x, boy_numarası) çiftlerini çıkarır.

    Basılı başlık kimi sayfada tek kelime ("APC160A"), kiminde üç kelimedir
    ("APC" "160" "AS").  İkisinde de anlamlı olan tek şey 160/200/…/500
    boy numarasıdır; model adı seriden tekdüze üretilir.
    """
    out = []
    for x, tok in zip(anchors, names):
        digits = "".join(ch for ch in tok if ch.isdigit())
        if not digits:
            continue
        size = int(digits)
        if not (100 <= size <= 900):
            continue
        if out and abs(out[-1][0] - x) < 40 and out[-1][1] == size:
            continue
        out.append((x, size))
    return [x for x, _ in out], [str(s) for _, s in out]


def build_zkes(doc):
    rows = page_rows(doc[12], 600, 1200)
    anchors, names = row_anchors(rows, ("Coupling", "Type"))
    # 'ZKES' '02' ikilileri
    sizes = []
    i = 0
    while i < len(names):
        if names[i] == "ZKES" and i + 1 < len(names):
            sizes.append((anchors[i], "ZKES %s" % names[i + 1]))
            i += 2
        else:
            i += 1
    anchors = [a for a, _ in sizes]
    labels = [n for _, n in sizes]
    tkn = value_row(rows, ("TKN", "Nm"), anchors)
    tkmax = value_row(rows, ("TKNmax", "Nm"), anchors)
    nmax = value_row(rows, ("nmax", "1/min"), anchors)
    bore_g = value_row(rows, ("max.", "boring", "mm"), anchors, skip=0)
    bore_m = value_row(rows, ("max.", "boring", "mm"), anchors, skip=1)
    dh = value_row(rows, ("ØDH", "mm"), anchors)
    items = []
    for i, lab in enumerate(labels):
        bores = [b for b in (bore_g[i], bore_m[i]) if b is not None]
        items.append(item(
            model=lab,
            coupling_type="gear",
            series="ZKES",
            nominal_torque_Nm=tkn[i],
            max_torque_Nm=tkmax[i],
            max_bore_mm=max(bores) if bores else None,
            outer_diameter_mm=dh[i],
            max_speed_rpm=nmax[i],
        ))
    write_catalog(
        "sibre_zkes.json",
        _meta("ZKES", "gear", "s.24-25 (PDF idx 12)",
              "Disli kaplin; fren diskiyle kombine edilebilir. max_bore_mm "
              "reduktor (dG) ve motor (dM) taraflarinin buyuk olanidir. "
              "Katalog tek bir kaplin agirligi basmaz (agirlik fren diski "
              "capina gore verilmistir) — weight_kg yazilmadi."),
        items)


def build_abc(doc):
    rows = page_rows(doc[23], 600, 1200)
    anchors, names = row_anchors(rows, ("Size",))
    torque = value_row(rows, ("Torque(1)", "Tk", "[Nm]"), anchors)
    radial = value_row(rows, ("Radial", "load", "Fr", "[N]"), anchors)
    weight = value_row(rows, ("Weight(3)", "[kg]"), anchors)
    d1min = value_row(rows, ("Ø", "d1min", "H7", "[mm]"), anchors)
    d1max = value_row(rows, ("Ø", "d1max", "H7", "[mm]"), anchors)
    d6 = value_row(rows, ("Ød6", "[mm]"), anchors)
    items = [item(
        model="ABC-V %s" % names[i],
        coupling_type="drum",
        series="ABC-V",
        nominal_torque_Nm=torque[i],
        max_torque_Nm=torque[i],
        max_bore_mm=d1max[i],
        min_bore_mm=d1min[i],
        max_radial_load_N=radial[i],
        weight_kg=weight[i],
        outer_diameter_mm=d6[i],
    ) for i in range(len(names))]
    write_catalog(
        "sibre_abc_v.json",
        _meta("ABC-V", "drum", "s.47 Tablo 3 (PDF idx 23)",
              "TAMBUR KAPLINI (rope drum coupling), SEB 666 212'ye gore "
              "tasarlanmistir. Katalog TEK moment sutunu basar: 'Torque(1) "
              "Tk max'; secim kriteri de dogrudan budur (katalogun s.46 "
              "cozumlu ornegi: T'Amax = 156600 Nm <= Tkmax = 180000 Nm). Bu "
              "yuzden nominal_torque_Nm ile max_torque_Nm ayni degeri "
              "tasir. Onceki sibre_abc_drum.json'daki nominal = Tkmax/1.6 "
              "bolmesi katalogda YOKTUR, kaldirildi. Dipnot (1): verilen "
              "momentler mil-gobek baglantisini KAPSAMAZ, o ayrica "
              "kontrol edilmelidir. Agirlik ve atalet en buyuk delik "
              "capi (od1) icindir.",
              ),
        items)


def build():
    print("SIBRE kaplin katalogu:")
    remove_stale(["sibre_alc_flexible.json", "sibre_apc_pin.json",
                  "sibre_abc_drum.json"])
    doc = fitz.open(PDF_SIBRE)
    build_alc(doc)
    build_afc(doc)
    build_apc(doc)
    build_zkes(doc)
    build_abc(doc)


if __name__ == "__main__":
    build()
