# -*- coding: utf-8 -*-
"""SEW-EURODRIVE DRN.. (IE3) ve DR2S.. (IE1) motorları — `SEW Dr serisi.pdf`
(Catalog "DRN.. Gearmotors (IE3)", 24832936/EN 09/2018) böl. 13.

Katalogun gövdesi REDÜKTÖRLÜ MOTOR seçim tablolarıdır ve o biçim uygulamanın
modeline uymaz (her satır bir redüktörü zorunlu kılar; uygulama redüktörle
motoru ayrı bölümlerde seçer). Böl. 13 ise MOTORUN KENDİ teknik verisidir ve
`catalog_data/motors/` şemasına birebir oturur.

Her kutup sayısı için katalog İKİ tablo basar ve ikisi de gerekir:
  13.x.1 "Information on motors"  → PN · MN · nN · IN · cosφ · η100%
  13.x.2 "Further information …"  → mMot (ağırlık) · BE.. (fren) · MB (fren
                                     momenti)
İkisi MOTOR TİPİ ile eşlenir.

MİL ÇAPI KATALOGDA BASILI DEĞİLDİR: DRN bu katalogda redüktöre flanşlı
(redüktörlü motor) satılır, çıplak mil ucu ölçüsü ayrı verilmez. `shaft_mm`
kaplin bölümünü beslediği için alan boş bırakılmaz; ABB/GAMAK/SIMOTICS
çıkarımlarındaki KURULU YOL izlenir: değer IEC 60072-1 Tablo 4'ten gövde
büyüklüğüne göre alınır ve `shaft_source` alanı "IEC 60072-1" yazar — yani
sayının katalogtan gelmediği satırın kendisinde görünür.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys

import motors_common as mc
import pdftable as pt

PDF = "SEW Dr serisi.pdf"
OUT = os.path.join(pt.CATALOG_DATA, "motors", "sew_drn.json")

SECTION_RE = re.compile(
    r"(IE\d)\s+(DRN|DR2S)\.\.\s+motors[,.]\s*400\s*V,\s*50\s*Hz,\s*(\d+)[‑-]pole")
INFO_RE = re.compile(r"^13\.\d+\.1\b")
FURTHER_RE = re.compile(r"^13\.\d+\.2\b")
MODEL_RE = re.compile(r"^(DRN|DR2S)\w+$")

INFO_ROLES = {"Motor": "model", "DRN..": "model", "DR2S..": "model", "PN": "power_kw", "MN": "torque_nm", "nN": "speed_rpm",
              "IN": "current_a", "cosφ": "power_factor", "η100%": "efficiency_pct"}
FURTHER_ROLES = {"Motor": "model", "DRN..": "model", "DR2S..": "model", "PN": "_pn", "MN": "_mn", "nN": "_nn", "mMot": "weight_kg",
                 "BE..": "brake_type", "MB": "brake_torque_nm"}


def _anchors(page, roles, y0=0.0):
    """Sütun başlığı satırından (rol, x) çapaları.

    Model sütununun başlığı sayfadan sayfaya değişir ("Motor type" ya da
    "DRN.. motor type"); ikisi de `roles` sözlüğünde karşılanır."""
    for y, row in pt.rows_by_gap(pt.words(page), 4.0):
        if y < y0:
            continue
        texts = [w[4] for w in row]
        if "PN" in texts and "MN" in texts and "nN" in texts:
            return [(roles.get(w[4]), w[0]) for w in row]
    return None


def _table(page, roles, y0=95, y1=None):
    """Motor tipi → {alan: değer}."""
    anchors = _anchors(page, roles, y0)
    if not anchors:
        return {}
    out = {}
    for _, cells in pt.read_rows(page, anchors, y0, y1 or page.rect.height - 30, gap=4.0):
        # Dipnot işareti tipe yapışık basılır ("DRN63MS41)"): temizlenir.
        raw = pt.cell_text(cells, "model") or ""
        model = re.sub(r"\d?\)$", "", raw)
        if not MODEL_RE.match(model):
            continue
        row = {}
        for role in set(roles.values()):
            if role is None or role == "model" or role.startswith("_"):
                continue
            txt = pt.cell_text(cells, role)
            row[role] = txt if role == "brake_type" else pt.num(txt)
        out[model] = row
    return out


def _section_y(page, pattern):
    """Bölüm başlığının y konumu — 13.x.1 ile 13.x.2 aynı sayfada olabilir."""
    for y, row in pt.rows_by_gap(pt.words(page), 4.0):
        if row and pattern.match(row[0][4]):
            return y
    return None


def build():
    doc = pt.open_src(PDF)
    sections: list = []       # (kutup, verim sınıfı, seri, info sayfası, further sayfası)
    cur = None
    for i in range(830, doc.page_count):
        txt = doc[i].get_text()
        m = SECTION_RE.search(txt.replace("\n", " "))
        if not m:
            continue
        key = (int(m.group(3)), m.group(1), m.group(2))
        if cur is None or cur[0] != key:
            cur = (key, {"info": None, "further": None})
            sections.append(cur)
        for line in txt.split("\n"):
            if INFO_RE.match(line.strip()) and cur[1]["info"] is None:
                cur[1]["info"] = i
            if FURTHER_RE.match(line.strip()) and cur[1]["further"] is None:
                cur[1]["further"] = i

    items = []
    for (poles, eff_class, series), pages in sections:
        if pages["info"] is None:
            continue
        # 13.x.1 ile 13.x.2 AYNI sayfada olabilir (8 kutupta öyledir): her
        # tablo kendi bölüm başlığının altından okunur, yoksa sayfa başından.
        page_info = doc[pages["info"]]
        info = _table(page_info, INFO_ROLES,
                      y0=_section_y(page_info, INFO_RE) or 95.0,
                      y1=_section_y(page_info, FURTHER_RE))
        further = {}
        if pages["further"] is not None:
            page_f = doc[pages["further"]]
            further = _table(page_f, FURTHER_ROLES,
                             y0=_section_y(page_f, FURTHER_RE) or 95.0)
        for model, row in info.items():
            frame = re.sub(r"^(DRN|DR2S)", "", model)
            extra = further.get(model, {})
            shaft = mc.iec_shaft_mm(mc.frame_number(frame), poles)
            items.append({
                "model": model,
                "series": series,
                "poles": poles,
                "efficiency_class": eff_class,
                "frame_size": frame,
                **row,
                **{k: v for k, v in extra.items() if v is not None},
                "shaft_diameter_mm": shaft,
                "shaft_source": "IEC 60072-1" if shaft else None,
            })
    doc.close()
    if not items:
        sys.exit("SEW DRN: satır okunamadı")
    _verify(items)

    fields: list = []
    for it in items:
        for k in it:
            if k not in fields:
                fields.append(k)
    items = [{k: v for k, v in it.items() if v is not None} for it in items]
    meta = {
        "brand": "SEW-EURODRIVE",
        "equipment_type": "motor",
        "series": "DRN (IE3) / DR2S (IE1)",
        "source_pdf": PDF,
        "source_doc": "SEW-EURODRIVE DRN.. Gearmotors (IE3), 24832936/EN 09/2018",
        "extraction_date": "2026-08-09",
        "page_range": "böl. 13 Technical data of the motors (400 V / 50 Hz)",
        "notes": (
            "400 V / 50 Hz. Her kutup sayısı iki tablodan derlenir: 'Information "
            "on motors' (güç, moment, devir, akım, cosφ, verim) ve 'Further "
            "information' (ağırlık mMot, fren tipi BE.., fren momenti MB); "
            "eşleme MOTOR TİPİ üzerindendir. efficiency_pct = η100%. "
            "MİL ÇAPI KATALOGDA BASILI DEĞİLDİR: bu katalog motoru redüktöre "
            "flanşlı satar. shaft_diameter_mm IEC 60072-1 Tablo 4'ten gövde "
            "büyüklüğüne göre alınmıştır ve shaft_source alanı bunu satırın "
            "kendisinde belirtir (ABB/GAMAK çıkarımlarındaki desenin aynısı)."),
        "item_count": len(items),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(
        json.dumps({"meta": meta, "fields": fields, "items": items},
                   ensure_ascii=False, indent=1))
    poles = sorted({i["poles"] for i in items})
    print(f"sew_drn.json {len(items)} satır · kutup {poles} · "
          f"{min(i['power_kw'] for i in items)}-{max(i['power_kw'] for i in items)} kW")
    return items


def _verify(items):
    """MN = 9550·PN/nN — sütun kayması burada çıkar."""
    warn = []
    for it in items:
        p, n, t = it.get("power_kw"), it.get("speed_rpm"), it.get("torque_nm")
        if not (p and n and t):
            warn.append(f"{it['model']}: eksik alan (P={p} n={n} M={t})")
            continue
        exp = 9550 * p / n
        if abs(t - exp) / exp > 0.05:
            warn.append(f"{it['model']}: MN={t} ama 9550·P/n={exp:.2f}")
    if len(warn) > len(items) * 0.02:
        sys.exit(f"SEW DRN: {len(warn)}/{len(items)} satır tutarsız\n"
                 + "\n".join(warn[:10]))
    for w in warn:
        print(f"  UYARI: {w}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build()
