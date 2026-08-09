# -*- coding: utf-8 -*-
"""SEW-EURODRIVE R / F / K / S / W redüktörleri — `SEW R serisi.pdf`
(Catalog "Gear Units", 26878585/EN 11/2021).

Katalog seçim tablolarını iki kez basar: motor adaptörlü (AMS..) ve giriş
milli (AD..). İKİSİNİN DE redüktör verisi aynıdır — i · na · Ma · FRa — fark
yalnız sağdaki adaptör/motor sütunlarındadır. Bu yüzden her iki bölüm de
okunur ve (model, giriş devri, çevrim oranı) üçlüsüyle TEKİLLEŞTİRİLİR.

Tablo başlığı gövdeyi ve giriş devrini verir:

    R67, ne = 1400 min-1, Ma max/Nm  134 Nm

Sütunlar: i (çevrim oranı) · na (çıkış devri, min-1) · Ma (anma momenti, Nm) ·
FRa (izin verilen radyal yük, N) · φ(/R). Sağdaki AMS/AD sütunları IEC motor
gövdesine göre izin verilen momenttir ve alınmaz (`XMAX` süzgeci) — motor bu
uygulamada ayrı bölümde seçilir.

Ağırlık seçim tablosunda değil, tablonun altındaki küçük "m/kg" kutusunda
adaptör başına verilir; redüktörün kendi ağırlığı olmadığı için yazılmaz.

KULLANIM GRUBU: R (helisel), F (paralel milli helisel) ve K (helisel-konik)
gövdeler vinç YÜRÜTME tahrikinin klasik seçimidir; katalog kaldırma/yürütme
ayrımı yapmaz ama SEW kaldırma için ayrı bir seri yayımlar (G..7 kaldırma
redüktörlü motorları ve X..e/HC). Bu yüzden bu dosya YÜRÜTME grubuna yazılır.
S (helisel-sonsuz) ve W (SPIROPLAN) gövdeleri de aynı bölümde basılıdır ve
alınır; seçicide seri süzgeciyle ayrılırlar.
"""
from __future__ import annotations

import re
import sys

import pdftable as pt
import reducers_common as rd

PDF = "SEW R serisi.pdf"

HEADER_RE = re.compile(
    r"^([A-Z]{1,3}\d{2,3}[A-Z]?),\s*ne\s*=\s*(\d+)\s*min-1,\s*Ma\s*max/Nm\s*([\d.]+)\s*Nm")

# Adaptör/motor sütunları bu x'in sağındadır ve alınmaz.
XMAX = 215.0
COL_ROLES = {"i": "ratio", "na": "n2", "Ma": "torque", "FRa": "radial"}

SERIES_LABEL = {
    "R": "R (helisel)",
    "F": "F (paralel milli helisel)",
    "K": "K (helisel-konik)",
    "S": "S (helisel-sonsuz)",
    "W": "W (SPIROPLAN)",
}


def _tables(page):
    """[(y, tip, ne, Ma max)] — başlık kelimeleri iki satıra bölünmüş olabilir,
    bu yüzden satırlar SABİT KOVA yerine boşlukla kümelenir."""
    out = []
    for y, row in pt.rows_by_gap(pt.words(page), 4.0):
        m = HEADER_RE.match(" ".join(w[4] for w in sorted(row)))
        if m:
            out.append((y, m.group(1), int(m.group(2)), float(m.group(3))))
    return out


def _col_anchors(page):
    for _, row in pt.rows_of(pt.words(page)):
        texts = [w[4] for w in row]
        if "i" in texts and "na" in texts and "Ma" in texts and "FRa" in texts:
            return [(COL_ROLES.get(w[4]), w[0]) for w in row if w[0] < XMAX]
    return None


def build():
    doc = pt.open_src(PDF)
    seen: set = set()
    items = []
    for pno in range(doc.page_count):
        page = doc[pno]
        tables = _tables(page)
        if not tables:
            continue
        anchors = _col_anchors(page)
        if not anchors:
            continue
        bottoms = [t[0] for t in tables[1:]] + [page.rect.height]
        for (y_head, gtype, ne, ma_max), y_end in zip(tables, bottoms):
            for _, cells in pt.read_rows(page, anchors, y_head, y_end, xmax=XMAX):
                ratio = pt.num(pt.cell_text(cells, "ratio"))
                torque = pt.num(pt.cell_text(cells, "torque"))
                n2 = pt.num(pt.cell_text(cells, "n2"))
                if ratio is None or torque is None or n2 is None:
                    continue
                key = (gtype, ne, ratio)
                if key in seen:
                    continue
                seen.add(key)
                letter = gtype[0]
                items.append({
                    "model": gtype,
                    "series": SERIES_LABEL.get(letter, letter),
                    "application": "yurutme",
                    "frame_size": re.sub(r"^[A-Z]+", "", gtype),
                    "ratio": ratio,
                    "output_torque_Nm": torque,
                    "max_torque_Nm": ma_max,
                    "output_speed_rpm": n2,
                    "input_speed_rpm": ne,
                    "permitted_radial_load_output_N": pt.num(
                        pt.cell_text(cells, "radial")),
                })
    doc.close()
    if not items:
        sys.exit("SEW R: satır okunamadı")
    _verify(items)

    rd.write("sew_r.json", {
        "brand": "SEW-EURODRIVE",
        "equipment_type": "reducer",
        "series": "R / F / K / S / W",
        "application": "yurutme",
        "source_pdf": PDF,
        "source_doc": "SEW-EURODRIVE Gear Units, 26878585/EN 11/2021",
        "extraction_date": "2026-08-09",
        "page_range": "böl. 8-12 seçim tabloları (AMS.. motor adaptörlü ve AD.. "
                      "giriş milli bölümlerinin ikisi de okunur, satırlar "
                      "tekilleştirilir)",
        "notes": (
            "Motorsuz seçim tabloları. output_torque_Nm = o çevrim oranındaki "
            "anma momenti Ma; max_torque_Nm = tablo başlığındaki Ma max. "
            "permitted_radial_load_output_N = FRa (katalogda N). Sağdaki AMS/AD "
            "sütunları IEC motor gövdesine göre izin verilen momenttir ve "
            "ALINMAMIŞTIR — motor ayrı bölümde seçilir. Ağırlık redüktörün "
            "kendisi için basılı değildir (tablo altındaki m/kg kutusu adaptör "
            "ağırlığıdır). Aynı gövde birden çok giriş devriyle basılıdır; "
            "her devir ayrı satırdır."),
    }, items)
    return items


def _verify(items):
    warn = []
    for it in items:
        n1, i, n2 = it["input_speed_rpm"], it["ratio"], it["output_speed_rpm"]
        if abs(n2 - n1 / i) > 0.5 + 0.03 * n1 / i:
            warn.append(f"{it['model']} ne={n1} i={i}: na={n2} ≠ {n1 / i:.1f}")
        if it["output_torque_Nm"] > it["max_torque_Nm"] * 1.001:
            warn.append(f"{it['model']} i={i}: Ma={it['output_torque_Nm']} > "
                        f"Ma max={it['max_torque_Nm']}")
    if len(warn) > len(items) * 0.01:
        sys.exit(f"SEW R: {len(warn)}/{len(items)} satır tutarsız — okuma hatalı\n"
                 + "\n".join(warn[:10]))
    for w in sorted(set(warn)):
        print(f"  KATALOG TUTARSIZLIĞI: {w}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build()
