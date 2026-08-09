# -*- coding: utf-8 -*-
"""POLAT (PGR) PCS serisi kaldırma redüktörü — `POLAT KALDIRMA REDÜKTÖRÜ
pcs_catologue_2024.pdf`.

PCS bir VİNÇ KALDIRMA redüktörüdür: çıkışı tambura DIN 5480 çoklu kama
flanşıyla bağlanır, girişi motor adaptörüyle (PAM B5) motora oturur. Bu yüzden
`output_shaft_diameter_mm` / `input_shaft_diameter_mm` alanları YOKTUR —
kaplin mili değil, flanş bağlantısı vardır; çıkış bağlantısı `output_spline`
alanında DIN 5480 kodu olarak taşınır.

KAYNAK: "Performans Tabloları" (basılı s.448–453 = PDF indisi 452–456).
Katalogun MOTORLU güç–devir tabloları (s.19–446) kullanılmaz: her satır bir
motoru, bir tambur çapını ve bir halat donanımını zorunlu kılar. Performans
tabloları motorsuzdur ve redüktörün kendi anma momentini (Ma max) verir.

Her sayfa BİR giriş devridir (n1 = 2800 · 1400 · 900 · 750 · 450) ve anma
momenti devre göre değişir; beş sayfa da alınır.

VİNÇ SINIFI SÜTUNLARI: katalog nominal giriş gücünü fB=1 için ve FEM 9.511
(ISO 4301/1) sınıfları için ayrı ayrı basar. Bunlar `nominal_power_kw` (fB=1)
ve `nominal_power_kw_<sınıf>` alanlarına yazılır — kaldırma redüktörü seçimi
vinç sınıfına göre yapıldığı için mühendis bunları seçicide görmelidir.
"""
from __future__ import annotations

import re
import sys

import pdftable as pt
import reducers_common as rd

PDF = "POLAT KALDIRMA REDÜKTÖRÜ pcs_catologue_2024.pdf"

# Basılı s.448–453 → PDF indisi 452–456 (kapak + iç kapak nedeniyle +4 kayma;
# basılı 1 = indis 4). İlk sayfa (451) tablo YAPISINI anlatan örnektir.
PERF_PAGES = range(452, 457)
DIM_PAGES = range(458, 473)

# Sütun çapaları — başlık etiketleri sayfadan sayfaya aynı x'te basılıdır.
# (rol, x). Vinç sınıfı sütunları başlıktan okunur, burada yalnız sabitler.
COLUMNS = [
    ("n2", 110.0),
    ("ratio", 161.0),
    ("torque", 216.0),
]

CLASS_RE = re.compile(r"^\((M\d)\)$")
SPLINE_RE = re.compile(r"^W\d+x[\d,]+x\d+x\d+x\d+\w*$")
MODEL_RE = re.compile(r"^PCS$")


def _input_speed(page):
    """Sayfa başındaki "n1 = 2800 [r.p.m]" değeri."""
    txt = page.get_text().replace("\n", " ")
    m = re.search(r"n\s*=?\s*(\d{3,4})\s*1?\s*\[r\.p\.m\]", txt) or \
        re.search(r"n\s*=\s*(\d{3,4})", txt)
    return int(m.group(1)) if m else None


def _class_columns(page):
    """Vinç sınıfı sütunları: [("fb1", x), ("M4", x), …] — başlık satırından."""
    for _, row in pt.rows_of(pt.words(page)):
        texts = [w[4] for w in row]
        if "fB=1" not in texts:
            continue
        out = []
        for w in row:
            if w[4] == "fB=1":
                out.append(("fb1", w[0]))
            elif CLASS_RE.match(w[4]):
                out.append((CLASS_RE.match(w[4]).group(1), w[0]))
        return out
    return []


def _splines():
    """Ölçü sayfalarından model başına DIN 5480 tambur flanşı kodu."""
    doc = pt.open_src(PDF)
    out = {}
    for i in DIM_PAGES:
        page = doc[i]
        ws = pt.words(page)
        model = None
        for w in sorted(ws, key=lambda w: w[1]):
            if MODEL_RE.match(w[4]):
                nxt = [t for t in ws if abs(t[1] - w[1]) < 4 and 0 < t[0] - w[0] < 25]
                if nxt and re.fullmatch(r"\d+", nxt[0][4]):
                    model = f"PCS {nxt[0][4]}"
                    break
        if not model:
            continue
        for w in ws:
            if SPLINE_RE.match(w[4]):
                out.setdefault(model, w[4])
                break
    doc.close()
    return out


def _verify(items):
    """Model ataması ve fizik doğrulaması — sessiz sütun kayması burada çıkar.

      · Bir çevrim oranı yalnız TEK modele ait olabilir (POLAT oranları model
        başına ayrıdır) — nearest-label ataması buradan doğrulanır.
      · Her model beş giriş devrinde de AYNI oran kümesini taşımalıdır.
      · n2 = n1 / i (katalog yuvarlamasına %2 tolerans).
    """
    owner: dict[float, str] = {}
    per_model: dict[tuple, set] = {}
    for it in items:
        m, i, n1 = it["model"], it["ratio"], it["input_speed_rpm"]
        if owner.setdefault(i, m) != m:
            sys.exit(f"PCS: i={i} hem {owner[i]} hem {m} modeline atandı")
        per_model.setdefault((m, n1), set()).add(i)
        n2 = it.get("output_speed_rpm")
        # n2 katalogda TEK ONDALIKLA basılır: küçük devirlerde yuvarlamanın
        # kendisi %2'yi aşar (1,94 → 1,9), bu yüzden tolerans mutlak + orantılı.
        if n2 and abs(n2 - n1 / i) > 0.05 + 0.02 * n1 / i:
            sys.exit(f"PCS {m}: n2={n2} ama n1/i={n1 / i:.2f}")
    for m in {k[0] for k in per_model}:
        sets = {frozenset(v) for k, v in per_model.items() if k[0] == m}
        if len(sets) != 1:
            sys.exit(f"PCS {m}: giriş devrine göre oran kümesi değişiyor {sets}")
    missing = [m for m in {i["model"] for i in items}
               if not any(i["model"] == m and i.get("output_spline") for i in items)]
    if missing:
        print(f"  UYARI: tambur flanşı kodu bulunamayan model: {missing}")


def build():
    doc = pt.open_src(PDF)
    splines = _splines()
    items = []
    for pno in PERF_PAGES:
        page = doc[pno]
        n1 = _input_speed(page)
        classes = _class_columns(page)
        if n1 is None or not classes:
            sys.exit(f"PCS s.{pno}: giriş devri ya da sınıf başlıkları okunamadı")
        anchors = [(role, x) for role, x in COLUMNS] + \
                  [(f"p_{code}", x) for code, x in classes] + [("model", 60.0)]
        # Anma momenti sütunu bazı satırlarda 2–3 punto kayık basılır; satırlar
        # sabit kova yerine BOŞLUKLA kümelenir (bkz. pdftable.rows_by_gap).
        rows = pt.read_rows(page, anchors, 160, 600, gap=6.0)
        # MODEL ADI blokta DİKEY ORTALANMIŞ tek bir hücredir; kendi satırından
        # önceki satırlar da o modele aittir. Bu yüzden "son görülen etiket"
        # yerine EN YAKIN etikete göre atanır. Doğruluğu `_verify` sınar:
        # her modelin çevrim oranı kümesi beş giriş devri sayfasında da aynıdır.
        labels = [(y, pt.cell_join(cells, "model"))
                  for y, cells in rows if (pt.cell_join(cells, "model") or "").startswith("PCS")]
        if not labels:
            sys.exit(f"PCS s.{pno}: model etiketi bulunamadı")
        for y, cells in rows:
            ratio = pt.num(pt.cell_text(cells, "ratio"))
            torque = pt.num(pt.cell_text(cells, "torque"))
            n2 = pt.num(pt.cell_text(cells, "n2"))
            if ratio is None or torque is None:
                continue
            model = min(labels, key=lambda lb: abs(lb[0] - y))[1]
            it = {
                "model": model,
                "series": "PCS",
                "application": "kaldirma",
                "frame_size": model.split()[-1],
                "ratio": ratio,
                "output_torque_Nm": torque,
                "output_speed_rpm": n2,
                "input_speed_rpm": n1,
                "nominal_power_kw": pt.num(pt.cell_text(cells, "p_fb1")),
                "output_spline": splines.get(model),
            }
            for code, _ in classes:
                if code == "fb1":
                    continue
                it[f"nominal_power_kw_{code.lower()}"] = pt.num(
                    pt.cell_text(cells, f"p_{code}"))
            items.append(it)
    doc.close()

    if not items:
        sys.exit("PCS: satır okunamadı")
    _verify(items)
    rd.write("polat_pcs.json", {
        "brand": "POLAT (PGR)",
        "equipment_type": "reducer",
        "series": "PCS",
        "application": "kaldirma",
        "source_pdf": PDF,
        "source_doc": "PGR Drive Technologies, PCS Series Hoist Drive, 2024",
        "extraction_date": "2026-08-09",
        "page_range": "basılı s.448-453 (PDF indisi 452-456) performans tabloları; "
                      "tambur flanşı kodu ölçü sayfalarından (basılı s.455-469)",
        "notes": (
            "Vinç kaldırma redüktörü, 1…50 ton. Motorsuz performans tabloları: "
            "Ma max = anma momenti [Nm], iges = toplam çevrim oranı, n2 = çıkış "
            "devri. Anma momenti GİRİŞ DEVRİNE göre değiştiği için beş devir "
            "bloğu da (n1 = 2800/1400/900/750/450) ayrı satırlardır. "
            "nominal_power_kw fB=1 içindir; nominal_power_kw_m4…m8 alanları FEM "
            "9.511/86 (ISO 4301/1) vinç sınıflarına karşılık gelir. "
            "ÇIKIŞ MİLİ ÇAPI YOKTUR: çıkış tambura DIN 5480 flanşıyla bağlanır "
            "(output_spline), giriş motor adaptörüyledir — bu redüktörde kaplin "
            "mili bulunmaz. Ağırlık ve izin verilen radyal yük katalogda "
            "BASILI DEĞİLDİR."),
    }, items)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build()
