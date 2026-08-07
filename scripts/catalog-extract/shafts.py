# -*- coding: utf-8 -*-
"""Mil çaplarını ölçü sayfalarından çıkarır.

Üç kaynak, üç farklı biçim:
  * M/N serisi  — ölçü sayfası teknik resmindeki Ø etiketleri (solda çıkış,
                  sağda giriş mili). Doğrulama: her modelin bandında TAM iki
                  Ø olmalı ve çıkış ≥ giriş.
  * D serisi    — s.322 "kovan ölçüleri" tablosu (d = H7 delik çapı). Bu seri
                  delik milli (kovan) teslim edilir; çıkış mili çapı = delik.
  * H/B serisi  — s.579 sıkma bileziği tablosu (d1 = kovan deliği), ölçü
                  sayfası resminden masif çıkış mili Ø'si.
"""
import re
import fitz
import grid

BASE = r"C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD"
DIA = re.compile(r"^Ø(\d+(?:[.,]\d+)?)$")


def _dias(ws, y0, y1):
    """Bandın içindeki (x, çap) çiftleri."""
    out = []
    for w in ws:
        m = DIA.match(w[4])
        if m and y0 < w[1] < y1:
            out.append(((w[0] + w[2]) / 2, float(m.group(1).replace(",", "."))))
    return sorted(out)


def m_series(pdf="YILMAZ M KATALOG.pdf", pages=range(333, 394)):
    """{model: (çıkış_mm, giriş_mm)} — M/N serisi ölçü sayfalarından."""
    d = fitz.open(BASE + "\\" + pdf)
    out, warn = {}, []
    for p in pages:
        pg = d[p - 1]
        ws = grid.words(pg)
        names = [(w[1], w[4]) for w in ws if re.fullmatch(r"[MN]T\d{3}", w[4])]
        if not names:
            continue
        names.sort()
        # MT grubu üstte, NT grubu altta; iki grubun y sınırını bul
        mt = [n for n in names if n[1].startswith("MT")]
        nt = [n for n in names if n[1].startswith("NT")]
        if not mt:
            continue
        band_lo = max(y for y, _ in mt) + 2
        band_hi = min((y for y, _ in nt), default=pg.rect.height) - 2
        ds = _dias(ws, band_lo, band_hi)
        if len(ds) != 2:
            warn.append((p, [n[1] for n in mt], [round(x) for x, _ in ds], [v for _, v in ds]))
            continue
        outp, inp = ds[0][1], ds[1][1]
        for _, name in mt + nt:
            out[name] = (outp, inp)
    d.close()
    return out, warn


def _bore_table(pdf, page, key_re):
    """Satır etiketi key_re ile eşleşen tablodan {çerçeve kodu: ilk sayısal sütun}.

    Etiket her zaman ilk hücrede DEĞİLDİR (teknik resim yazıları aynı satıra
    düşebiliyor), bu yüzden etiketin sütunu bulunup ondan SONRAKİ ilk sayısal
    sütun okunur.
    """
    d = fitz.open(BASE + "\\" + pdf)
    pg = d[page - 1]
    out = {}
    for yc, rw in grid.rows_of(grid.words(pg)):
        line = " ".join(w[4] for w in rw)
        # Etiket satır başında olmayabilir: teknik resim yazıları (l2, t, u …)
        # aynı y'ye düşüp satırın önüne geçiyor.
        m = key_re.search(line)
        if not m:
            continue
        rest = line[m.end():]
        v = re.search(r"(\d+(?:[.,]\d+)?)", rest)
        if v:
            out.setdefault(m.group(1), float(v.group(1).replace(",", ".")))
    d.close()
    return out


def d_series_bores(pdf="YILMAZ DR KATALOG.pdf", page=322):
    """{çerçeve kodu ('07','17',...): delik çapı d} — kovan ölçü tablosu."""
    return _bore_table(pdf, page, re.compile(r"D\.(\d{2})\.\."))


def hb_series_bores(pdf="YILMAZ H KATALOG.pdf", page=579):
    """{çerçeve kodu ('03','04',...): sıkma bileziği delik çapı d1}."""
    return _bore_table(pdf, page, re.compile(r"H(\d{2})\s*-\s*B\d{2}"))


BAND_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)")
# Tolerans kodu normalde m6/k6/g6; katalogda s.301'de "(36)" dizgi hatası var,
# bu yüzden ilk karakter harf ya da rakam kabul edilir.
DL_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*\([a-z0-9]\d\)")


def hb_shafts(pdf="YILMAZ H KATALOG.pdf", pages=range(236, 415)):
    """{model: {"output": Ø, "bore": Ø, "input_bands": [(i_alt, i_ust, d)]}}.

    "Pozisyonlara Göre Mil Ölçüleri" bandında dört montaj düzeni yan yana
    basılıdır: 00 (delik mil), 01 (tek uçlu masif çıkış mili), 04 (iki uçlu),
    0S (sıkma bileziği). Her Ø etiketi, x ekseninde EN YAKIN düzen etiketine
    atanır. Uygulamanın istediği çıkış mili çapı 01 düzenidir — tambur kaplini
    masif mile bağlanır.

    Giriş mili çapı sayfa altındaki küçük tabloda ÇEVRİM ORANI BANDINA göre
    değişir (aynı gövde farklı kademe sayılarıyla farklı giriş mili taşır).
    """
    d = fitz.open(BASE + "\\" + pdf)
    out, warn = {}, []
    for p in pages:
        pg = d[p - 1]
        ws = grid.words(pg)
        title = [w for w in ws if re.fullmatch(r"[HB][TFA]\d{4}\.?", w[4]) and w[1] < 120]
        if not title:
            continue
        model = title[0][4].rstrip(".")
        if model in out:
            continue

        # --- düzen etiketleri ve Ø atamaları
        labels = sorted(
            ((w[0] + w[2]) / 2, w[4].rstrip("*"))
            for w in ws if re.fullmatch(r"0[0-9S]\*?", w[4]) and 430 < w[1] < 500
        )
        rec = {"output": None, "bore": None, "input_bands": []}
        if labels:
            bounds = [(labels[i][0] + labels[i + 1][0]) / 2 for i in range(len(labels) - 1)]
            for x, val in _dias(ws, 320, 430):
                idx = sum(1 for b in bounds if x > b)
                arr = labels[idx][1]
                if arr == "01" and rec["output"] is None:
                    rec["output"] = val
                elif arr == "00" and rec["bore"] is None:
                    rec["bore"] = val
            if rec["output"] is None:          # 01 yoksa 04 de tek uçlu ile aynı çaptır
                for x, val in _dias(ws, 320, 430):
                    if labels[sum(1 for b in bounds if x > b)][1] == "04":
                        rec["output"] = val
                        break
        if rec["output"] is None:
            warn.append((p, model, "cikis mili bulunamadi"))

        # --- giriş mili: oran bandı tablosu (kendi ince sütun yapısı olduğu
        #     için ızgara değil, satır metni üzerinden okunur)
        bands, dls = None, None
        for yc, rw in grid.rows_of([w for w in ws if w[1] > 470]):
            line = " ".join(w[4] for w in rw)
            if line.startswith("i ") and bands is None:
                b = BAND_RE.findall(line)
                if b:
                    bands = [(float(a.replace(",", ".")), float(c.replace(",", "."))) for a, c in b]
            if line.startswith("d / l") and dls is None:
                v = DL_RE.findall(line)
                if v:
                    dls = [float(x.replace(",", ".")) for x in v]
        if bands and dls and len(bands) == len(dls):
            rec["input_bands"] = [(lo, hi, dls[i]) for i, (lo, hi) in enumerate(bands)]
        elif bands or dls:
            warn.append((p, model, f"giris mili bandi eslesmedi {bands} {dls}"))
        out[model] = rec
    d.close()
    return out, warn


if __name__ == "__main__":
    ms, warn = m_series()
    print("M/N mil:", len(ms), "model | uyari:", len(warn))
    for w in warn[:10]:
        print("   ", w)
    print("   ornek:", dict(list(sorted(ms.items()))[:6]))
    print()
    db = d_series_bores()
    print("D kovan:", db)
    print()
    hb = hb_series_bores()
    print("H/B kovan:", hb)
    print()
    ho, hw = hb_shafts()
    print("H/B mil:", len(ho), "model | uyari:", len(hw))
    for w in hw[:8]:
        print("   ", w)
    for k in ["HT0321", "HT0322", "HT0323", "BT0322", "HT1024"]:
        if k in ho:
            print("   ", k, ho[k])
