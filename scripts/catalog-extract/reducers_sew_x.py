# -*- coding: utf-8 -*-
"""SEW-EURODRIVE X.. serisi endüstriyel redüktörler — `SEW X-SERİSİ REDUKTOR.pdf`
(Catalog 29125456/EN, 10/2019) ve X..e /HC — `SEW x-fcc.pdf` (26876248/EN).

X.. SERİSİ (böl. 9 "Selection tables", PDF indisi 172–297)
    Motorsuz seçim tabloları. Her tablo bir (redüktör tipi, giriş devri)
    çiftidir; başlığı "X.F110..,n1= 1000 1/min  8.50 kNm" biçimindedir ve
    sondaki değer o gövdenin MN2max'ıdır. Satırlar:

        iN (anma oranı) · iex (gerçek oran) · n2 [min-1] · MN2 [kNm] · PN1 [kW]

    ardından üç montaj konumu için termik güç sütunları gelir; onlar
    alınmaz (x < 180 süzgeci).

    KADEME SAYISI tabloda "X2F.." / "X3F.." / "X4F.." etiketiyle GRUP GRUP
    verilir: başlıktaki nokta kademe sayısının yer tutucusudur (X.F110 →
    X2F110 · X3F110). Grup sınırları sayfadaki YATAY ÇİZGİLERDEN okunur —
    etiket grubun ortasında durduğu için "en yakın etiket" kuralı yanlış
    kademe atardı.

X..e /HC (böl. 2.21.2, PDF indisi 41)
    Kaldırma uygulamaları için eksen mesafesi büyütülmüş özel seri. Katalog
    burada seçim tablosu değil TİP × BOY MATRİSİ basar: anma momenti MN2,
    anma oranı bandı iN, eksen mesafesi A ve ağırlık. Oran ve çıkış devri
    satır satır verilmediği için `ratio_range` alanı kullanılır — FLENDER
    MD 20.1 dosyasındaki desenin aynısı.

KULLANIM GRUBU: X serisi hem kaldırma hem yürütme tahrikinde kullanılır
(katalog md. 2.4.1 konveyör, md. 2.4.2 "Hoist gear unit"); tablo ayrım
yapmadığı için her satır iki gruba da yazılır. X..e /HC ise adı gibi yalnız
KALDIRMA içindir (katalogun kendi tanımı: "designed ... according to the
operating conditions of lifting applications").
"""
from __future__ import annotations

import re
import sys

import grid
import pdftable as pt
import reducers_common as rd

X_PDF = "SEW X-SERİSİ REDUKTOR.pdf"
HC_PDF = "SEW x-fcc.pdf"

X_PAGES = range(172, 298)
HC_PAGE = 41

HEADER_RE = re.compile(r"^(X\.\w+)\.\.,n1=\s*(\d+)\s*1/min\s*([\d.]+)\s*kNm$")
STAGE_RE = re.compile(r"^X(\d)([FKT])\.\.$")

# Sol beş sütunun çapaları başlık satırından okunur; sağdaki termik güç
# sütunları x < 180 süzgeciyle dışarıda kalır.
COL_ROLES = {"i": None, "n2": "n2", "MN2": "torque", "PN1": "power"}
# Termik güç sütunları bu x'in sağındadır ve alınmaz.
XMAX = 180.0
APPLICATIONS = ["kaldirma", "yurutme"]


def _tables(page):
    """[(y, tip, n1, MN2max)] — sayfadaki tablo başlıkları."""
    out = []
    for y, row in pt.rows_of(pt.words(page)):
        m = HEADER_RE.match(" ".join(w[4] for w in row))
        if m:
            out.append((y, m.group(1), int(m.group(2)), float(m.group(3))))
    return out


def _col_anchors(page):
    """"iN iex n2 MN2 PN1" başlık satırından (rol, x) çapaları.

    SEW sütun başlığını SAYFA BAŞINA BİR KEZ basar; aynı sayfadaki ikinci
    tablo (öteki giriş devri) başlıksızdır ve aynı çapaları kullanır."""
    for _, row in pt.rows_of(pt.words(page)):
        texts = [w[4] for w in row]
        if texts.count("i") == 2 and "n2" in texts and "MN2" in texts:
            anchors, seen_i = [], 0
            for w in row:
                if w[0] > XMAX:
                    continue
                if w[4] == "i":
                    seen_i += 1
                    anchors.append(("ratio_nominal" if seen_i == 1 else "ratio", w[0]))
                elif w[4] in COL_ROLES:
                    anchors.append((COL_ROLES[w[4]], w[0]))
            return anchors
    return None


def _stage_labels(page):
    """[(y, kademe, harf)] — "X2F.." biçimli grup etiketleri."""
    out = []
    for y, row in pt.rows_of(pt.words(page)):
        for w in row:
            m = STAGE_RE.match(w[4])
            if m:
                out.append((y, int(m.group(1)), m.group(2)))
    return out


def build_x():
    doc = pt.open_src(X_PDF)
    items = []
    for pno in X_PAGES:
        page = doc[pno]
        tables = _tables(page)
        if not tables:
            continue
        _, hy = grid.rules(page)
        labels = _stage_labels(page)
        anchors = _col_anchors(page)
        if not anchors:
            sys.exit(f"SEW X s.{pno}: sütun başlığı bulunamadı")
        bottoms = [t[0] for t in tables[1:]] + [page.rect.height]
        for (y_head, gtype, n1, mn2max), y_end in zip(tables, bottoms):
            # Gövde üst sınırı ARANMAZ: başlık satırlarında (i / n2 / MN2 /
            # kNm / min-1) sayı yoktur, veri satırı ise hem oranı hem momenti
            # sayı olarak taşır. Ayıklama aşağıdaki `continue` ile olur.
            rules = [h for h in hy if y_head < h <= y_end]
            for y, cells in pt.read_rows(page, anchors, y_head, y_end,
                                         tol=2.5, xmax=XMAX):
                ratio = pt.num(pt.cell_text(cells, "ratio"))
                torque = pt.num(pt.cell_text(cells, "torque"))
                if ratio is None or torque is None:
                    continue
                lo = max([h for h in rules if h < y], default=y_head)
                hi = min([h for h in rules if h > y], default=y_end)
                stage = next(((s, ltr) for ly, s, ltr in labels if lo < ly < hi), None)
                if stage is None:
                    continue
                stages, letter = stage
                model = f"X{stages}{letter}{gtype[3:]}"
                for app in APPLICATIONS:
                    items.append({
                        "model": model,
                        "series": f"X{letter}",
                        "application": app,
                        "frame_size": gtype[3:],
                        # Katalogun kendi başlık kodu ("X.F110"): model kodu
                        # sayfada BÖYLE basılır, "X3F110" diye geçmez. Katalog
                        # sayfası defteri ürünü bu dizgiyle bulur.
                        "catalog_type": gtype,
                        "stages": stages,
                        "ratio": ratio,
                        "ratio_nominal": pt.num(pt.cell_text(cells, "ratio_nominal")),
                        "output_torque_Nm": round(torque * 1000, 1),
                        "max_torque_Nm": round(mn2max * 1000, 1),
                        "output_speed_rpm": pt.num(pt.cell_text(cells, "n2")),
                        "input_speed_rpm": n1,
                        "nominal_power_kw": pt.num(pt.cell_text(cells, "power")),
                    })
    doc.close()
    if not items:
        sys.exit("SEW X: satır okunamadı")
    _verify_x(items)

    rd.write("sew_x.json", {
        "brand": "SEW-EURODRIVE",
        "equipment_type": "reducer",
        "series": "X",
        "source_pdf": X_PDF,
        "source_doc": "SEW-EURODRIVE Industrial Gear Units X.. Series, 29125456/EN 10/2019",
        "extraction_date": "2026-08-09",
        "page_range": "böl. 9 Selection tables — PDF indisi 172-297 "
                      "(X.F helisel · X.K konik-helisel · X.T konik-helisel dikey)",
        "notes": (
            "Motorsuz seçim tabloları, tork sınıfı 6,8 kNm – 475 kNm. "
            "output_torque_Nm o çevrim oranındaki anma momenti MN2, max_torque_Nm "
            "gövdenin tablo başlığındaki MN2max'ıdır (ikisi kNm basılıdır, Nm'ye "
            "çevrildi). ratio_nominal = iN katalog anma oranı, ratio = iex gerçek "
            "oran. Kademe sayısı tablodaki X2F/X3F/X4F grup etiketinden gelir ve "
            "model kodunun içine yazılır. Termik güç sütunları (PTH20, montaj "
            "konumuna göre) ALINMAMIŞTIR — üç montaj konumu için ayrı basılır ve "
            "tek alana sığmaz. Ağırlık ve mil çapları seçim tablosunda basılı "
            "değildir, ölçü sayfalarındadır."),
    }, items)
    return items


def _verify_x(items):
    """n2 = n1/i ve MN2 ≤ MN2max.

    Sütun kayması bu iki bağıntıyı TOPTAN bozar; katalogun kendi yuvarlaması
    ise tek tük satırı bozar. Bu yüzden sapan satır sayılır: %1'i aşarsa
    okuma yanlıştır ve betik durur, altında kalırsa katalog tutarsızlığı
    olarak bildirilir."""
    warn = []
    for it in items:
        n1, i, n2 = it["input_speed_rpm"], it["ratio"], it.get("output_speed_rpm")
        if n2 and abs(n2 - n1 / i) > 0.5 + 0.03 * n1 / i:
            warn.append(f"{it['model']} n1={n1} i={i}: n2={n2} ≠ {n1 / i:.1f}")
        if it["output_torque_Nm"] > it["max_torque_Nm"] * 1.001:
            sys.exit(f"SEW X {it['model']}: MN2={it['output_torque_Nm']} > "
                     f"MN2max={it['max_torque_Nm']}")
    if len(warn) > len(items) * 0.01:
        sys.exit(f"SEW X: {len(warn)}/{len(items)} satırda n2 ≠ n1/i — okuma hatalı\n"
                 + "\n".join(warn[:10]))
    for w in sorted(set(warn)):
        print(f"  KATALOG TUTARSIZLIĞI: {w}")


# ------------------------------------------------------------- X..e /HC serisi

def _pick(row_words, x, tol=24.0):
    """Satırın x sütununa düşen hücresi (yoksa None)."""
    hit = min(row_words, key=lambda w: abs(w[0] - x), default=None)
    return hit[4] if hit is not None and abs(hit[0] - x) < tol else None


def build_hc():
    """s.42 matrisi: satır etiketi solda, sütun başlığı boy kodudur (X120…X220).

    Matris üç katmanlıdır ve BOY BAŞINA TEK SATIR DEĞİLDİR:
      · MN2 anma momenti boya bağlıdır ve iki tasarım için de aynıdır.
      · X3..e/HC bloğu bir (iN, A) çifti + ağırlık taşır.
      · X4..e/HC bloğu İKİ (iN, A) çifti taşır — aynı boy iki farklı çevrim
        oranı bandında, iki farklı eksen mesafesiyle yapılır. İkisi de ayrı
        satırdır; biri atlanırsa katalogun yarısı kaybolur.
    Blok sonu AĞIRLIK satırıdır; tasarım adı bloğun içinde dikey ortalanmıştır.
    """
    doc = pt.open_src(HC_PDF)
    page = doc[HC_PAGE]
    rows = pt.rows_of(pt.words(page))
    doc.close()

    sizes, torques = None, {}
    design_labels: list = []
    blocks: list = []       # [(tasarım, [(iN satırı, A satırı)], ağırlık satırı)]
    pending: list = []
    pend_ratio = None

    def cells(row):
        return [w for w in row if w[0] > sizes[0][0] - 22]

    for y, row in rows:
        texts = [w[4] for w in row]
        if sizes is None:
            if sum(1 for t in texts if re.fullmatch(r"X\d{3}", t)) > 5:
                sizes = [(w[0], w[4]) for w in row if re.fullmatch(r"X\d{3}", w[4])]
            continue
        for w in row:
            if re.fullmatch(r"X\d\.\.e/HC", w[4]):
                design_labels.append((y, w[4]))
        if texts[0] == "MN2":
            torques = {s: pt.num(_pick(cells(row), x)) for x, s in sizes}
        elif texts[0] == "iN":
            pend_ratio = (y, cells(row))
        elif texts[0] == "A" and "mm" in texts and pend_ratio:
            pending.append((pend_ratio, (y, cells(row))))
            pend_ratio = None
        elif pending and len(cells(row)) >= len(sizes) - 2 and texts[0] not in ("Weight", "kg"):
            blocks.append((pending, cells(row)))
            pending = []

    if not sizes or not blocks:
        sys.exit("SEW X..e/HC: tip × boy matrisi okunamadı")

    items = []
    for bands, weight_row in blocks:
        y0 = bands[0][0][0]
        y1 = max(w[1] for w in weight_row)
        design = next((d for ly, d in design_labels if y0 - 12 <= ly <= y1 + 12), None)
        if design is None:
            sys.exit(f"SEW X..e/HC: {y0:.0f}-{y1:.0f} bandının tasarım adı yok")
        stages = int(design[1])
        for (_, ratio_row), (_, dist_row) in bands:
            for x, size in sizes:
                rng = _pick(ratio_row, x)
                if not rng or "-" not in rng:
                    continue
                lo, hi = rng.split("-")
                items.append({
                    "model": f"X{stages}{size[1:]}e/HC",
                    "series": "X..e/HC",
                    "application": "kaldirma",
                    "frame_size": size[1:],
                    "stages": stages,
                    "ratio_range": f"1:{lo}…{hi}",
                    "output_torque_Nm": torques.get(size),
                    "weight_kg": pt.num(_pick(weight_row, x)),
                    "center_distance_mm": pt.num(_pick(dist_row, x)),
                })
    if not items:
        sys.exit("SEW X..e/HC: satır üretilmedi")

    rd.write("sew_xe_hc.json", {
        "brand": "SEW-EURODRIVE",
        "equipment_type": "reducer",
        "series": "X..e/HC",
        "application": "kaldirma",
        "source_pdf": HC_PDF,
        "source_doc": "SEW-EURODRIVE X..e Series /HC Design, 26876248/EN 12/2021",
        "extraction_date": "2026-08-09",
        "page_range": "böl. 2.21.2 (PDF indisi 41) — anma momentleri, eksen "
                      "mesafeleri ve ağırlıklar matrisi",
        "notes": (
            "KALDIRMA için özel seri: eksen mesafesi motor ve tamburun aynı "
            "tarafa monte edilebilmesi için büyütülmüştür. Katalog bu seride "
            "seçim tablosu DEĞİL tip × boy matrisi basar — çevrim oranı satır "
            "satır değil BANT olarak verilir (ratio_range), çıkış devri ve "
            "nominal güç yayımlanmaz. Katalogun kendi uyarısı: küçük toplam "
            "çevrim oranlarında MN2 düşebilir."),
    }, items)
    return items


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build_x()
    build_hc()
