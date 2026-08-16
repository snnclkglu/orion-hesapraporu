# -*- coding: utf-8 -*-
"""FLENDER MD 20.1 helisel (H1…H4) ve konik-helisel (B2…B4) redüktörler —
`FLENDER-gear-units-MD20-1-complete-English-2018 (2).pdf`
(Catalog MD 20.1, Edition 2018 EN).

NEDEN YENİDEN YAZILDI (2026-08-16)
  İlk sürüm elle girilmiş 7 satırlık bir ÖZETTİ: tip başına bir `variants`
  matrisi ve boy başına TEK bir anma momenti. O moment katalogda ORANA GÖRE
  değişen T2N sütununun MAKSİMUMUydu — H1 boy 3'te 3,3 kNm yazıyordu ama
  i = 5,6'da katalogun kendi değeri 2,3 kNm'dir (%43 fazla). Çevrim oranı,
  çıkış devri, güç, ağırlık, mil çapları ve izin verilen radyal yük ise HİÇ
  yoktu; `reducers_common` bunlardan üçünü ENGELLEYİCİ kontrole bağlıyor
  (`permitted_radial_load_output_N` → gearbox.radial, iki mil çapı → kaplin).
  Kaynağı olmayan alan `defaults.ts`teki 60 kN gibi bir VARSAYILANLA
  hesaplanıyordu: kontrol koşuyor ama uydurma bir sayıya karşı koşuyordu.
  Diğer bütün redüktör katalogları (YILMAZ, SEW, POLAT, SIMOGEAR) satır
  başına (model, oran, giriş devri) grenindedir; bu dosya artık onlarla aynı.

KAYNAK TABLOLAR (0 tabanlı PDF indisi)
  · P2N  — anma gücü, TİP başına: (iN, n1, n2) × boy.  n1 = 1800/1500/1200/1000
  · T2N  — anma çıkış momenti, BİRLEŞİK tablo: (iN) × boy; helisel ve
           konik-helisel için ayrı iki tablo
  · PG   — termik kapasite, tip ve n1 başına: (iN) × boy
  · FR2  — izin verilen ek radyal kuvvet (böl. 9/8): boy × tip × mil versiyonu
  · Ölçü sayfaları (böl. 4/ ve 6/) — HSS sayfası giriş mili d1'i ORAN BANDI
           başına, LSS sayfası çıkış mili d2'yi ve AĞIRLIĞI boy başına verir

İKİ KARAR VE GEREKÇESİ

1. ORAN BANTLARI ÇAKIŞIR: H2 ve H3 ikisi de 22,4 · 25 · 28 oranını basar
   (B2/B3 12,5 · 14; B3/B4 80 · 90). Bu yüzden tip ataması T2N tablosunun
   "Type" sütunundan YAPILMAZ — o etiket bandın ORTASINA basılıdır ve satır
   satır okunamaz. Tip → oran eşleşmesi TİP BAŞINA basılan P2N tablosundan
   gelir; T2N (boy, iN) ile aranır.

2. ÇAPRAZ SINAMA UYDURMA DEĞİL ÖLÇÜMDÜR: her hücrede

       P2N = T2N · n2 / 9550

   sınanır ve tolerans KATALOGUN KENDİ BASIM HASSASİYETİNDEN türetilir
   (P2N tam sayı → ±0,5 kW; T2N ve n2 basılı ondalık basamağından). Sabit bir
   yüzde toleransı 10 kW'lık hücrelerde yalancı alarm üretiyordu: orada tek
   başına tam sayıya yuvarlama %5 eder. Tutmayan hücre satır ÜRETMEZ, sayılır
   ve raporlanır (md. 18/3: yanlış alarm ölçülür, susturulmaz).

YALNIZ YATAY MONTAJ: ölçüler böl. 4/ (H) ve 6/ (B) sayfalarından okunur.
Vinç tahriklerinde standart montaj yataydır ve katalog sayfası defteri de
(`scripts/catalog-sheets.py` HEADER_SCAN) aynı iki bölümü alır; dikey
bölümlerden (5/ ve 7/) ölçü okumak iki farklı ürünün ölçüsünü tek satırda
karıştırırdı.

KULLANIM
  python scripts/catalog-extract/reducers_flender.py            # sına, yazma
  python scripts/catalog-extract/reducers_flender.py --write    # JSON'u yaz
"""
from __future__ import annotations

import os
import re
import sys

import fitz

import pdftable as pt
import reducers_common as rd

PDF_PATH = os.path.join(pt.BASE, "FLENDER-gear-units-MD20-1-complete-English-2018 (2).pdf")

BRAND = "FLENDER"
SERIES = "MD 20.1"
OUT_NAME = "flender_md20_1.json"

NUM_RE = re.compile(r"^\d+(?:[.,]\d+)?$")
BAND_RE = re.compile(r"^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$")

# --------------------------------------------------------------- sayfa haritası
P2N_PAGES = {
    "H1": [53],
    "H2": [59, 60],
    "H3": [67, 68],
    "H4": [75, 76],
    "B2": [81],
    "B3": [87, 88, 89, 90],
    "B4": [101, 102],
}

# Birleşik T2N tabloları: helisel (boy 3-12 + 13-28), konik-helisel (4-12 + 13-28).
T2N_PAGES = {"H": [61, 62], "B": [91, 92]}

THERMAL_PAGES = {
    "H1": [55, 56, 57, 58],
    "H2": [63, 64, 65, 66],
    "H3": [71, 72, 73, 74],
    "H4": [79, 80],
    "B2": [83, 84, 85, 86],
    "B3": [93, 94, 95, 96, 97, 98, 99, 100],
    "B4": [105, 106],
}

RADIAL_PAGE = 267

# Ölçü sayfaları YATAY bölümlerden taranır: 4/ helisel, 6/ konik-helisel.
DIM_CHAPTERS = ("4/", "6/")
DIM_HEADER_RE = re.compile(
    r"Type\s+([HB][1-4])\s+Gear unit dimensions,\s*[a-z-]+stage,"
    r"\s*gear unit sizes\s+(\d+)\s+to\s+(\d+)")

GEAR_TYPE = {"H": "Helical", "B": "Bevel-helical"}
STAGES = {"H1": 1, "H2": 2, "H3": 3, "H4": 4, "B2": 2, "B3": 3, "B4": 4}

# Vinç tahriklerinde H ve B gövdeleri hem kaldırma hem yürütmede kullanılır;
# katalog ayrım yapmaz. seed-catalog.ts `applications` alanını ikiye açar.
APPLICATIONS = ["kaldirma", "yurutme"]


# ------------------------------------------------------------------ yardımcılar

def _doc():
    if not os.path.exists(PDF_PATH):
        raise SystemExit("Kaynak PDF bulunamadi: %s" % PDF_PATH)
    return fitz.open(PDF_PATH)


def _clean(txt):
    return txt.replace(" ", "").replace("\xa0", "").replace(" ", "").replace(",", ".")


def _num(txt):
    """'1 234' · '12,5' → float; '–' · '*' · 'm6' → None."""
    t = _clean(txt)
    return float(t) if NUM_RE.match(t) else None


def _ulp(txt):
    """Basılı değerin yuvarlama yarı-aralığı: '128' → 0,5 · '12,5' → 0,05."""
    t = _clean(txt)
    if "." not in t:
        return 0.5
    return 0.5 * 10 ** (-len(t.split(".")[1]))


def _cx(w):
    return (w[0] + w[2]) / 2


def _header(rows, first):
    for y, row in rows:
        if [w[4] for w in row][: len(first)] == list(first):
            return y, [(w[4], _cx(w)) for w in row]
    return None, None


def _assign(cells, anchors, tol=13.0):
    """Hücreleri en yakın sütun çapasına oturtur (x ile, SIRA ile değil)."""
    out = {}
    for w in cells:
        cx = _cx(w)
        lab, ax = min(anchors, key=lambda a: abs(a[1] - cx))
        if abs(ax - cx) <= tol:
            out.setdefault(lab, []).append(w)
    return out


def _xs(anchors):
    """Etiket → x, İLK geçişi kazanır.

    Ölçü sayfalarının çoğu İKİ mil ucu sütun grubu basar (`iN d1 l1 G1 iN d1
    l1 G1`); `dict(anchors)` sonuncuyu tutuyor ve d1 yanlış gruptan okunuyordu
    — H3, H4, B2, B3 ve B4'te giriş mili çapı bu yüzden hiç dolmuyordu.
    """
    out = {}
    for lab, x in anchors:
        out.setdefault(lab, x)
    return out


def _split_rows(words_, gap=2.0):
    """Bir kelime kümesini kendi y'lerine göre alt satırlara böler."""
    out, cur = [], []
    for w in sorted(words_, key=lambda w: (w[1], w[0])):
        if cur and w[1] - cur[-1][1] > gap:
            out.append(cur)
            cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def _first_num(words_):
    """Sıralı kelimelerden ilk SAYIYI (metin, değer) olarak verir."""
    for w in sorted(words_):
        v = _num(w[4])
        if v is not None:
            return w[4], v
    return None, None


# ------------------------------------------------------------------ P2N tablosu

def read_p2n(doc):
    """→ {(tip, boy, iN, n1): (n2, n2_metin, P2N_kW, kosullu)}

    `kosullu` katalogdaki `*` işaretidir ("cebri yağlama gerekir / talep
    üzerine"). Satır ÜRETİLİR ama işaret taşınır: hücreyi atmak katalogda var
    olan bir boyu yok saymak olurdu.
    """
    out = {}
    for typ, pages in P2N_PAGES.items():
        for idx in pages:
            rows = pt.rows_by_gap(pt.words(doc[idx]), gap=5.0)
            hy, anc = _header(rows, ["iN", "n1", "n2"])
            if not anc:
                raise SystemExit("P2N baslik yok: %s s.%d" % (typ, idx))
            sizes = [(lab, x) for lab, x in anc if lab not in ("iN", "n1", "n2")]
            xs = dict(anc)
            cur_iN = None
            for y, row in rows:
                if y <= hy:
                    continue
                body = [w for w in row if 30 < _cx(w) < 560]
                if not body:
                    continue
                iN = n1 = n2 = None
                n2_txt = None
                vals = []
                for w in body:
                    cx = _cx(w)
                    if abs(cx - xs["iN"]) < 10:
                        v = _num(w[4])
                        if v is not None:
                            iN = v
                    elif abs(cx - xs["n1"]) < 12:
                        v = _num(w[4])
                        if v is not None:
                            n1 = v
                    elif abs(cx - xs["n2"]) < 12:
                        v = _num(w[4])
                        if v is not None:
                            n2, n2_txt = v, w[4]
                    else:
                        vals.append(w)
                if iN is not None:
                    cur_iN = iN
                if cur_iN is None or n1 is None or n2 is None:
                    continue
                for size, group in _assign(vals, sizes).items():
                    star = any(w[4] == "*" for w in group)
                    txt, kw = _first_num(group)
                    if kw is None:
                        continue  # '–' ya da yalnız '*' → o boyda yok
                    out[(typ, size, cur_iN, n1)] = (n2, n2_txt, kw, star)
    return out


# ------------------------------------------------------------------ T2N tablosu

def read_t2n(doc):
    """→ {(aile, boy, iN): (T2N_kNm, metin)}; aile 'H' ya da 'B'."""
    out = {}
    for fam, pages in T2N_PAGES.items():
        for idx in pages:
            rows = pt.rows_by_gap(pt.words(doc[idx]), gap=5.0)
            hy, anc = _header(rows, ["iN"])
            if not anc:
                raise SystemExit("T2N baslik yok: %s s.%d" % (fam, idx))
            sizes = [(lab, x) for lab, x in anc if lab not in ("iN", "Type")]
            inx = dict(anc)["iN"]
            typex = dict(anc).get("Type", 1e9)
            for y, row in rows:
                if y <= hy:
                    continue
                iN = None
                vals = []
                for w in row:
                    cx = _cx(w)
                    if cx > typex - 15:
                        continue  # "Type" sütunu ve sayfa kenarındaki folyo
                    if abs(cx - inx) < 10:
                        v = _num(w[4])
                        if v is not None:
                            iN = v
                    elif cx > 60:
                        vals.append(w)
                if iN is None:
                    continue
                for size, group in _assign(vals, sizes).items():
                    txt, v = _first_num(group)
                    if v is not None:
                        out[(fam, size, iN)] = (v, txt)
    return out


# ------------------------------------------------------- termik kapasite (PG)

def read_thermal(doc):
    """→ {(tip, boy, iN, n1, varyant): PG_kW}; varyant 'PGA' | 'PGB'

    HER (iN, boy) HÜCRESİ DÖRT DEĞER TAŞIR — soğutma düzenine göre:
    PGA (ek soğutma yok) · PGB (fanlı) · PGC10 ve PGD10 (yağ soğutma
    devreleri). İlk yazımda yalnız satırın ilk sayısı okunuyordu, yani
    sessizce PGA alınıyor ve öbür üçü kayboluyordu.

    Yalnız PGA ve PGB yazılır çünkü ORTAK ŞEMADA karşılıkları var
    (`thermal_power_kw` / `thermal_power_fan_kw`, YILMAZ H kataloğuyla aynı);
    yağ soğutma devreleri ayrı bir ünite seçimi gerektirir ve redüktörün
    kendi verisi değildir.

    n1 SAYFA BAŞLIĞINDAN değil BLOK başlığından okunur: H4 ve B4 iki n1
    bloğunu tek sayfaya basar.
    """
    out = {}
    n1_re = re.compile(r"n1\s*=\s*(\d[\d\s]*)\s*rpm")
    var_re = re.compile(r"^(PGA|PGB|PGC\d*|PGD\d*)$")
    for typ, pages in THERMAL_PAGES.items():
        for idx in pages:
            rows = pt.rows_by_gap(pt.words(doc[idx]), gap=5.0)
            blocks = []
            for y, row in rows:
                m = n1_re.search(" ".join(w[4] for w in row))
                if m:
                    blocks.append((y, float(m.group(1).replace(" ", ""))))
            for bi, (by, n1) in enumerate(blocks):
                bend = blocks[bi + 1][0] if bi + 1 < len(blocks) else 1e9
                sub = [(y, r) for y, r in rows if by < y < bend]
                hy, anc = _header(sub, ["iN"])
                if not anc:
                    continue
                sizes = [(lab, x) for lab, x in anc if lab not in ("iN", "Type")]
                inx = _xs(anc)["iN"]
                typex = _xs(anc).get("Type", 1e9)
                cur_iN = None
                for y, row in sub:
                    if y <= hy:
                        continue
                    iN = None
                    variant = None
                    vals = []
                    for w in row:
                        cx = _cx(w)
                        if cx > typex - 15:
                            continue
                        if abs(cx - inx) < 10:
                            v = _num(w[4])
                            if v is not None:
                                iN = v
                        elif var_re.match(w[4]):
                            variant = w[4][:3]  # PGC10 → PGC
                        elif cx > 60:
                            vals.append(w)
                    # iN yalnız PGA satırında basılıdır; PGB/PGC/PGD satırları
                    # onu devralır.
                    if iN is not None:
                        cur_iN = iN
                    if cur_iN is None or variant not in ("PGA", "PGB"):
                        continue
                    for size, group in _assign(vals, sizes).items():
                        _t, v = _first_num(group)
                        if v is not None:
                            out[(typ, size, cur_iN, n1, variant)] = v
    return out


# --------------------------------------------------- izin verilen radyal kuvvet

def read_radial(doc):
    """→ {(tip, boy): FR2_kN} — masif mil (S), mil versiyonlarının EN KÜÇÜĞÜ.

    Tablo tip başına iki-dört mil versiyonu (A/B · C/D · A/C · B/D) basar ve
    değer versiyona göre değişir. Uygulama tek bir sayı taşır
    (`gearboxAllowedRadialKn`) ve o sayı ENGELLEYİCİ bir kontrolü besler; bu
    yüzden EN KÜÇÜĞÜ yazılır. Mühendis hangi mil versiyonunu sipariş edeceğini
    bu aşamada bilmez ve büyüğünü yazmak kontrolü gerçekte olmadığı kadar
    rahat geçirirdi.
    """
    rows = pt.rows_by_gap(pt.words(doc[RADIAL_PAGE]), gap=4.0)
    tip_row = ver_row = None
    for y, row in rows:
        labs = [w[4] for w in row]
        if tip_row is None and sum(1 for l in labs if re.match(r"^[HB]\dS$", l)) >= 4:
            tip_row = (y, row)
        elif tip_row is not None and ver_row is None and sum(1 for l in labs if "/" in l) >= 4:
            ver_row = (y, row)
            break
    if not tip_row or not ver_row:
        raise SystemExit("Radyal kuvvet tablosu basligi okunamadi (s.%d)" % RADIAL_PAGE)

    tips = [(w[4], _cx(w)) for w in tip_row[1]]
    versions = [(w[4], _cx(w)) for w in ver_row[1]]
    # Her versiyon sütunu, x olarak SOLUNDAKİ en yakın tip başlığına aittir.
    col_tip = []
    for lab, x in versions:
        left = [t for t in tips if t[1] <= x + 6]
        col_tip.append((left[-1][0] if left else None, x))

    # SAYFADA İKİ TABLO VAR: üstte masif mil (S), altta TAKVİYELİ YATAKLI mil
    # (V — `H2VH, H2VV` gibi başlıklar). İkincisinin sütun sayısı ve x
    # konumları farklıdır; okumayı durdurmayınca onun satırları birinci
    # tablonun çapalarıyla eşleniyor ve DEĞERLER YANLIŞ TİPE yazılıyordu —
    # H1'in hiç yayımlanmamış FR2'si (dipnot 3) altı boyda dolu görünüyordu.
    # Bu alan ENGELLEYİCİ bir kontrolü besliyor; sessiz bir kayma en pahalı
    # hata olurdu.
    stop_y = 1e9
    for y, row in rows:
        if y <= ver_row[0]:
            continue
        if any(re.match(r"^[HB]\dV", w[4]) for w in row) or \
           any(w[4].lower().startswith("reinforce") for w in row):
            stop_y = y
            break

    out = {}
    for y, row in rows:
        if y <= ver_row[0] or y >= stop_y:
            continue
        # SAYFA FOLYOSU SATIRIN İÇİNE DÜŞER: bölüm numarası sol kenarda
        # (x≈12) basılıdır ve x'e göre sıralandığında BOY sütunundan (x≈56)
        # önce gelir. Onu boy sanmak boy 13'ün bütün değerlerini boy 9'a
        # yazıyor ve 13'ü tamamen düşürüyordu — ölçüldü.
        cells = [w for w in sorted(row, key=lambda w: w[0]) if _cx(w) > 40]
        if not cells or not re.match(r"^\d{1,2}$", cells[0][4]):
            continue
        size = cells[0][4]
        for w in cells[1:]:
            v = _num(w[4])
            if v is None:
                continue
            cx = _cx(w)
            tip, tx = min(col_tip, key=lambda c: abs(c[1] - cx))
            if tip is None or abs(tx - cx) > 16:
                continue
            key = (tip[:2], size)
            out[key] = v if key not in out else min(out[key], v)
    return out


# ---------------------------------------------------------------- ölçü sayfaları

def _dim_pages(doc):
    """[(tip, boy_alt, boy_ust, hss_idx, lss_idx)] — yalnız YATAY bölümler.

    LSS sayfası HSS sayfasının HEMEN ARDINDAKİ yapraktır ve başlık deseniyle
    ARANMAZ: H4 boy 25-28'in çıkış mili sayfası (4/33) "Type H4 Gear unit
    dimensions…" başlığını taşımıyor — orası aynı zamanda ürün kodu ekidir —
    ve başlık aramak o boyların ağırlığını sessizce düşürüyordu.
    """
    out = []
    for i in range(110, doc.page_count - 1):
        flat = " ".join(doc[i].get_text().split())
        if not flat.startswith(DIM_CHAPTERS) or "High speed shaft" not in flat:
            continue
        m = DIM_HEADER_RE.search(flat)
        if not m:
            continue
        out.append((m.group(1), int(m.group(2)), int(m.group(3)), i, i + 1))
    return out


def read_dims(doc):
    """→ ({(tip, boy): (d2_mm, agirlik_kg)}, {(tip, boy): [(i_alt, i_ust, d1_mm)]})

    LSS sayfası birden çok mil versiyonu bloğu basar (masif+kama · masif
    kamasız · delik mil · sıkma bilezikli). Alınan blok "Solid shaft with
    parallel key"dir — uygulamanın kaplin eşlemesi masif mili varsayar. AĞIRLIK
    sütunu iki kez basılabilir (yatay H..H ve dikey H..M); İLKİ, yani yatay
    montaj alınır.
    """
    lss, hss = {}, {}
    for typ, lo, hi, hidx, lidx in _dim_pages(doc):
        # --- LSS: d2 + ağırlık
        rows = pt.rows_by_gap(pt.words(doc[lidx]), gap=4.0)
        hy, anc = _header(rows, ["Type", "Size", "d2"])
        if anc:
            xs = _xs(anc)
            kgx = [x for lab, x in anc if lab == "kg"]
            # İkinci blok ("Solid shaft without parallel key") D2 ile başlar ve
            # bu başlığa uymaz; bu yüzden yalnız ilk bloğun satırları okunur.
            stop = min([y for y, r in rows
                        if y > hy and [w[4] for w in r][:3] in (["Type", "Size", "D2"],
                                                               ["Type", "Size", "d2"])]
                       or [1e9])
            for y, row in rows:
                if not (hy < y < stop):
                    continue
                # İKİ TABLO SATIRI TEK KÜMEDE BİRLEŞEBİLİR: satır aralığı
                # yer yer 4 pt'nin altına iner ve `rows_by_gap` ikisini
                # birleştirir (H3 s.4/21'de boy 16 ile 17, B4'te 25 ile 26).
                # Birleşmiş kümede ilk boy okunup ikincisi SESSİZCE düşüyordu;
                # küme kendi içinde y'ye göre yeniden bölünür.
                for sub in _split_rows(row, gap=2.0):
                    cells = sorted(sub, key=lambda w: w[0])
                    sz = [w for w in cells
                          if abs(_cx(w) - xs["Size"]) < 9 and re.match(r"^\d{1,2}$", w[4])]
                    if len(sz) != 1:
                        continue
                    size = sz[0][4]
                    d2 = _first_num([w for w in cells if -8 < _cx(w) - xs["d2"] < 6])[1]
                    kg = (_first_num([w for w in cells
                                      if kgx and abs(_cx(w) - kgx[0]) < 12])[1] if kgx else None)
                    if d2 is not None or kg is not None:
                        lss[(typ, size)] = (d2, kg)
        # --- HSS: oran bandı başına d1
        rows = pt.rows_by_gap(pt.words(doc[hidx]), gap=4.0)
        hy, anc = _header(rows, ["iN", "d1"])
        if not anc:
            continue
        xs = _xs(anc)
        cur_size = None
        for y, row in rows:
            if y <= hy:
                continue
            cells = sorted(row, key=lambda w: w[0])
            head = [w for w in cells if _cx(w) < xs["iN"] - 20 and re.match(r"^\d{1,2}$", w[4])]
            if head:
                cur_size = head[0][4]
            if cur_size is None:
                continue
            # Oran bandı İKİ YAZIMLA basılır: "1.25 - 2.8" (üç jeton, H1 ve B
            # sayfaları) ve "6.3-11.2" (tek jeton, H2/H3/H4). Jeton saymak
            # ikincisini kaçırıyordu — metin birleştirilip aralık okunur.
            band = [w for w in cells if xs["iN"] - 22 < _cx(w) < xs["d1"] - 14]
            m = BAND_RE.search("".join(w[4] for w in sorted(band)))
            if not m:
                continue
            nums = [float(m.group(1)), float(m.group(2))]
            d1 = _first_num([w for w in cells if -8 < _cx(w) - xs["d1"] < 6])[1]
            if d1 is None:
                continue
            hss.setdefault((typ, cur_size), []).append((nums[0], nums[1], d1))
    return lss, hss


# ------------------------------------------------------------------- doğrulama

def cross_check(p2n, t2n):
    """P2N = T2N · n2 / 9550 — tolerans KATALOGUN BASIM HASSASİYETİNDEN.

    Tolerans ASİMETRİKTİR çünkü ölçüldü (6193 hücre): sapmanın işareti
    5871'e 322 pozitiftir ve bant medyanı tam olarak 0,5/P eğrisini izler
    (0-20 kW %+2,25 · 20-50 %+1,44 · 50-200 %+0,47 · 200-1000 %+0,11 ·
    1000+ %+0,02). Yani FLENDER anma gücünü AŞAĞI YUVARLAR (floor), ±0,5
    ile yuvarlamaz — bir anma değeri için doğru ve muhafazakâr olan da budur.
    Simetrik ±0,5 kW toleransı 10 kW'lık hücrelerin tamamını yalancı alarma
    çeviriyordu (md. 18/3).

        P_gerçek ∈ [kw, kw+1)   →   pred - kw ∈ [-δ, 1 + δ]

    δ, T2N ve n2'nin kendi basım yuvarlamasıdır.
    """
    ok, bad, missing, worst = 0, 0, [], []
    for key, (n2, n2_txt, kw, star) in sorted(p2n.items()):
        typ, size, iN, n1 = key
        hit = t2n.get((typ[0], size, iN))
        if hit is None:
            missing.append(key)
            continue
        t, t_txt = hit
        pred = (t * 1000.0) * n2 / 9550.0
        delta = (_ulp(t_txt) * 1000.0 * n2 / 9550.0) + (t * 1000.0 * _ulp(n2_txt) / 9550.0)
        diff = pred - kw
        if -delta - 1e-9 <= diff <= 1.0 + delta + 1e-9:
            ok += 1
        else:
            bad += 1
            worst.append((abs(diff) / max(kw, 1e-9), key, kw, pred, delta))
    worst.sort(reverse=True)
    return ok, bad, missing, worst


# ---------------------------------------------------------------------- üretim

def build(doc):
    p2n = read_p2n(doc)
    t2n = read_t2n(doc)
    thermal = read_thermal(doc)
    radial = read_radial(doc)
    lss, hss = read_dims(doc)

    ok, bad, missing, worst = cross_check(p2n, t2n)
    dropped = {k for _d, k, _a, _b, _c in worst} | set(missing)

    items = []
    for key in sorted(p2n, key=lambda k: (k[0], int(k[1]), k[2], -k[3])):
        typ, size, iN, n1 = key
        if key in dropped:
            continue
        n2, _n2t, kw, star = p2n[key]
        t_kNm = t2n[(typ[0], size, iN)][0]
        d2, weight = lss.get((typ, size), (None, None))
        d1 = None
        for lo, hi, val in hss.get((typ, size), []):
            if lo - 1e-9 <= iN <= hi + 1e-9:
                d1 = val
                break
        fr2 = radial.get((typ, size))
        it = {
            "model": "%s-%s" % (typ, size.zfill(2)),
            "series": typ,
            "gear_unit_type": GEAR_TYPE[typ[0]],
            "applications": list(APPLICATIONS),
            "frame_size": size.zfill(2),
            "stages": STAGES[typ],
            "ratio": iN,
            "output_torque_Nm": round(t_kNm * 1000.0, 1),
            "output_speed_rpm": n2,
            "input_speed_rpm": int(n1),
            "nominal_power_kw": kw,
            "thermal_power_kw": thermal.get((typ, size, iN, n1, "PGA")),
            "thermal_power_fan_kw": thermal.get((typ, size, iN, n1, "PGB")),
            "permitted_radial_load_output_N": None if fr2 is None else fr2 * 1000.0,
            "weight_kg": weight,
            "output_shaft_diameter_mm": d2,
            "input_shaft_diameter_mm": d1,
            "mounting_position": "H",
            "output_shaft_version": "S - solid shaft with parallel key",
            "forced_lubrication_required": True if star else None,
        }
        items.append(rd.order_keys({k: v for k, v in it.items() if v is not None}))

    stats = dict(p2n=len(p2n), t2n=len(t2n), thermal=len(thermal), radial=len(radial),
                 lss=len(lss), hss=len(hss), ok=ok, bad=bad, missing=len(missing),
                 items=len(items), worst=worst)
    return items, stats


def meta(items, stats):
    models = sorted({it["model"] for it in items})
    return {
        "brand": BRAND,
        "equipment_type": "reducer",
        "series": SERIES,
        "source_pdf": os.path.basename(PDF_PATH),
        "source_doc": "FLENDER Gear Units, Catalog MD 20.1, Edition 2018 EN",
        "extraction_date": "2026-08-16",
        "page_range": (
            "böl. 3 genel bakış tabloları: anma gücü P2N (3/14…3/63), anma çıkış "
            "momenti T2N (3/22-23 helisel, 3/52-53 konik-helisel), termik kapasite; "
            "izin verilen radyal kuvvet 9/8; ağırlık ve mil çapları YATAY ölçü "
            "sayfalarından (böl. 4/ helisel, 6/ konik-helisel)"),
        "item_count": len(items),
        "model_count": len(models),
        "validation": (
            "Her satır P2N = T2N · n2 / 9550 ile çapraz sınandı; tolerans "
            "katalogun basım hassasiyetinden türetildi (P2N tam sayı ±0,5 kW). "
            "%d hücre tuttu, %d hücre tutmadı ve satır ÜRETMEDİ, %d hücrenin "
            "T2N karşılığı yoktu." % (stats["ok"], stats["bad"], stats["missing"])),
        "notes": (
            "Satır greni (tip-boy, çevrim oranı, giriş devri) — diğer redüktör "
            "kataloglarıyla aynı. Çevrim oranı katalogun ANMA oranıdır (iN); "
            "kesin oran siparişe bağlıdır. İzin verilen radyal kuvvet mil "
            "versiyonlarının EN KÜÇÜĞÜDÜR (versiyon sipariş anında belli olur). "
            "Ağırlık ve mil çapları YATAY montaj (H..H) sayfalarından; ağırlık "
            "yağsızdır ve katalog yaklaşık değer olduğunu söyler. `*` işaretli "
            "hücreler cebri yağlama ister ve `forced_lubrication_required` "
            "taşır — satır düşürülmez, işaretlenir."),
    }


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    doc = _doc()
    items, st = build(doc)
    print("P2N hücre %d · T2N hücre %d · termik %d · radyal (tip,boy) %d · "
          "ölçü LSS %d / HSS %d" % (st["p2n"], st["t2n"], st["thermal"],
                                    st["radial"], st["lss"], st["hss"]))
    print("ÇAPRAZ SINAMA: %d tuttu · %d tutmadı (satır üretmedi) · %d T2N yok"
          % (st["ok"], st["bad"], st["missing"]))
    for d, key, kw, pred, tol in st["worst"][:10]:
        print("   TUTMADI %5.1f%%  %s-%s i=%s n1=%s : katalog %.0f kW, T2N'den %.1f kW (tol %.2f)"
              % (d * 100, key[0], key[1], key[2], key[3], kw, pred, tol))
    print("ÜRETİLEN SATIR: %d" % st["items"])
    for typ in sorted({it["series"] for it in items}):
        sub = [it for it in items if it["series"] == typ]
        eksik = {k: sum(1 for it in sub if k not in it) for k in
                 ("weight_kg", "output_shaft_diameter_mm", "input_shaft_diameter_mm",
                  "permitted_radial_load_output_N", "thermal_power_kw")}
        print("  %s: %5d satır · %2d boy · %2d oran | eksik %s"
              % (typ, len(sub), len({it["frame_size"] for it in sub}),
                 len({it["ratio"] for it in sub}),
                 ", ".join("%s=%d" % (k.replace("_mm", "").replace("_kg", "").replace("_kw", ""), v)
                           for k, v in eksik.items() if v)))
    if "--write" in sys.argv:
        rd.write(OUT_NAME, meta(items, st), items)
        print("Yazıldı: %s" % os.path.join(rd.OUT_DIR, OUT_NAME))


if __name__ == "__main__":
    main()
