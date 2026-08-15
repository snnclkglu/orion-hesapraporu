# -*- coding: utf-8 -*-
"""PROFİL KESİT TABLOSU ÜRETİCİSİ — Profiller.xls → src/lib/purchasing/hammadde/profil-kesitleri.ts

KAYNAK WORKSPACE'TEDİR, DEPODA DEĞİL: `../Profiller.xls` firmanın elindeki
ArcelorMittal kesit tablosudur (19 sayfa: UPN·IPN·L·IPE·HE·HD·HP·UB·UC·UAP·C…)
ve her satırda profilin ANMA metre ağırlığını (`G`, kg/m) taşır. Katalog
sayfalarında olduğu gibi (AGENTS md. 13) veri ÜRETİLİR, elle yazılmaz — kaynak
tablo yenilenirse betik yeniden koşturulur.

NEDEN TABLO, NEDEN GEOMETRİ DEĞİL: bir profilin kesit alanı köşe yarıçaplarını
ve flanş eğimini içerir; `t·(2a−t)` yaklaşımı L 50x50x5'te %1 düşük kalır.
Satın alma tonaj üzerinden fiyat aldığı için standardın anma değeri kazanır.
Tabloda OLMAYAN kesit (küçük köşebentler, kutu profil, lama) için çözücü
geometriye düşer ve satırı "hesaplandı" diye işaretler — uydurmaz, sayının
nereden geldiğini söyler.

Python'dur çünkü kaynak ESKİ BİÇİM .xls'tir (OLE2) ve uygulamanın exceljs'i
yalnız .xlsx okur; `scripts/catalog-sheets.py` ile aynı gerekçe.

    python scripts/gen-profile-sections.py

Çıktı DETERMİNİSTİKTİR: aynı kaynak iki kez koşturulunca bayt bayt aynı dosya
çıkar (sıra aile → kg/m → kod).
"""
import io
import json
import re
import sys
from pathlib import Path

import xlrd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")

KOK = Path(__file__).resolve().parent.parent
KAYNAK = KOK.parent / "Profiller.xls"
HEDEF = KOK / "src" / "lib" / "purchasing" / "hammadde" / "profil-kesitleri.ts"

# sayfa -> (aile, sütun düzeni)
#   "hb"   : [ad, G, h, b, …]
#   "hbt"  : [ad, G, h(=b), t, …]  eşit kenarlı köşebent
#   "hbt2" : [ad, G, h, b, t, …]   eşit olmayan köşebent
SAYFALAR = [
    ("UPN", "UPN", "hb"),
    ("IPN", "IPN", "hb"),
    ("IPE", "IPE", "hb"),
    ("HE", "HE", "hb"),
    ("HD", "HD", "hb"),
    ("HP", "HP", "hb"),
    ("UB", "UB", "hb"),
    ("UC", "UC", "hb"),
    ("UAP", "UAP", "hb"),
    ("C", "C", "hb"),
    ("L", "L", "hbt"),
    ("Li", "L", "hbt2"),
]


def sayi(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def oku():
    wb = xlrd.open_workbook(str(KAYNAK))
    gorulen = {}
    for sayfa, aile, duzen in SAYFALAR:
        if sayfa not in wb.sheet_names():
            print("ATLANDI — sayfa yok: " + sayfa, file=sys.stderr)
            continue
        sh = wb.sheet_by_name(sayfa)
        for r in range(sh.nrows):
            ad = sh.cell_value(r, 0)
            g = sayi(sh.cell_value(r, 1)) if sh.ncols > 1 else None
            # VERİ SATIRININ TANIMI: ilk hücre metin, ikinci hücre pozitif sayı.
            # Başlık ve açıklama satırlarının hiçbiri bu kapıdan geçemez.
            if not isinstance(ad, str) or not ad.strip() or g is None or g <= 0:
                continue
            ad = re.sub(r"\s+", " ", ad).strip()
            if ad in gorulen:  # İLK GÖREN KAZANIR: HP ile HP(US) aynı kodları taşır.
                continue
            h = sayi(sh.cell_value(r, 2)) if sh.ncols > 2 else None
            b = h if duzen == "hbt" else (sayi(sh.cell_value(r, 3)) if sh.ncols > 3 else None)
            gorulen[ad] = {"kod": ad, "aile": aile, "kgPerM": round(g, 3), "h": h, "b": b}
    return sorted(gorulen.values(), key=lambda k: (k["aile"], k["kgPerM"], k["kod"]))


def ts_sayi(v):
    if v is None:
        return "null"
    return str(int(v)) if float(v).is_integer() else repr(round(float(v), 3))


def yaz(liste):
    satirlar = "\n".join(
        "  {{ kod: {kod}, aile: {aile}, kgPerM: {kg}, h: {h}, b: {b} }},".format(
            kod=json.dumps(k["kod"], ensure_ascii=False),
            aile=json.dumps(k["aile"], ensure_ascii=False),
            kg=ts_sayi(k["kgPerM"]),
            h=ts_sayi(k["h"]),
            b=ts_sayi(k["b"]),
        )
        for k in liste
    )
    govde = """// ÜRETİLMİŞ DOSYA — ELLE DÜZENLENMEZ.
//
// Kaynak: workspace kökündeki `Profiller.xls` (ArcelorMittal kesit tablosu).
// Üretici: `python scripts/gen-profile-sections.py`
//
// Her satır bir profilin ANMA metre ağırlığıdır (kg/m). Tabloda OLMAYAN kesit
// için çözücü geometriye düşer ve kaynağını söyler; bkz. `hammadde/cozumle.ts`.

export interface ProfilKesiti {
  /** Standart gösterim — "UPN 100", "IPN 280", "L 100 x 100 x 8", "HE 300 A" */
  kod: string;
  /** Aile: UPN · IPN · L · IPE · HE · HD · HP · UB · UC · UAP · C */
  aile: string;
  /** Anma metre ağırlığı [kg/m] */
  kgPerM: number;
  /** Yükseklik [mm] — bilinmiyorsa null */
  h: number | null;
  /** Genişlik [mm] — köşebentte h ile aynı; bilinmiyorsa null */
  b: number | null;
}

export const PROFIL_KESITLERI: readonly ProfilKesiti[] = [
%s
];
""" % satirlar
    HEDEF.parent.mkdir(parents=True, exist_ok=True)
    HEDEF.write_text(govde, encoding="utf-8", newline="\n")


def main():
    if not KAYNAK.exists():
        raise SystemExit("Kaynak bulunamadı: %s" % KAYNAK)
    liste = oku()
    yaz(liste)
    aileler = {}
    for k in liste:
        aileler[k["aile"]] = aileler.get(k["aile"], 0) + 1
    print("%d kesit yazıldı → %s" % (len(liste), HEDEF.relative_to(KOK)))
    for a in sorted(aileler):
        print("  %-4s %d" % (a, aileler[a]))


if __name__ == "__main__":
    main()
