# -*- coding: utf-8 -*-
"""JAURE TCBR fıçı tipi tambur kaplini — SÜTUN KAYMASI DÜZELTMESİ.

SORUN
`jaure_tcbr_barrel.json` katalog PDF'i olmadan elle yazılmıştı (dosyanın kendi
notunda "DOGRULANMADI" yazıyordu). PDF artık workspace'te
("Jaure Tambur kaplini.pdf") ve satırlar basılı tabloyla karşılaştırıldı:

  · `weight_kg`     → ağırlık DEĞİL, basılı **ØB** sütunuydu (TCBR 25 için
                      160 kg yazıyordu; gerçek ağırlık 13 kg). Gerçek ağırlık
                      sütunu DİĞER sayfadadır (basılı s.19, "WEIGHT (2)").
  · `hub_diameter_mm` → aslında **Ød MIN** (en küçük delik çapı) sütunu; 21
                      satırın 8'i yanlış okunmuştu. Şema adı `min_bore_mm`dir
                      ve seed bunu `min_shaft_dia_mm` olarak yazar; eski adla
                      seçicideki "Min. Mil Ø" sütunu boş kalıyordu.
  · `max_speed_rpm` → bu tabloda DEVİR SÜTUNU YOKTUR. Değerler Ød MAX
                      sütunundan kopyalanmıştı. Alan tamamen kaldırıldı —
                      olmayan bir büyüklük uydurulmaz.
  · `max_shaft_diameter_mm` → TCBR 10200 için 430 yazıyordu, basılı değer
                      **560**'tır (430 bir alt boy TCBR 6200'ün değeri).
                      Bu alan `*Coupling.bore` KONTROLÜNÜ besler: yanlış değer
                      560 mm'e kadar geçen bir kaplini 430 mm'de reddediyordu.

DOĞRULANAN VE DOKUNULMAYAN
`nominal_torque_Nm` (= T_kmax) ve `max_radial_load_N` (= Fr) sütunlarının 21
satırının TAMAMI basılı tabloyla birebir aynıdır; bu betik onları yalnızca
SINAR (satır sırası kaymışsa hata verir), değiştirmez.

Kaynak: Jaure Tambur kaplini.pdf — basılı s.18 (seçim tablosu) ve s.19 (ölçü
tamamlayıcı + ağırlık). Kesilmiş hâli:
`catalog-sheets/coupling/jaure-tcbr.pdf`.
"""

from __future__ import annotations

import json
import os

from couplings_common import OUT_DIR

FILENAME = "jaure_tcbr_barrel.json"

# Basılı tablodan okunan satırlar — sıra katalogdaki sırayla aynıdır.
# (boy, T_kmax [Nm], Fr [N], Ød MAX [mm], Ød MIN [mm], ağırlık [kg])
CATALOG_ROWS = [
    (25, 7500, 19600, 68, 38, 13),
    (50, 9500, 22250, 80, 48, 21),
    (75, 12000, 24000, 90, 58, 25),
    (100, 16300, 29700, 100, 58, 30),
    (130, 23500, 41800, 115, 78, 36),
    (160, 29100, 46000, 130, 78, 46),
    (200, 33900, 50850, 136, 98, 59),
    (300, 42600, 58250, 156, 98, 77),
    (400, 57200, 82500, 185, 98, 105),
    (500, 102600, 133400, 215, 98, 161),
    (600, 138150, 143650, 235, 118, 178),
    (1000, 185300, 158050, 250, 138, 215),
    (1500, 250700, 190750, 295, 158, 336),
    (2100, 381500, 288850, 305, 168, 363),
    (2600, 442800, 334800, 315, 168, 396),
    (3400, 532500, 372750, 340, 198, 449),
    (4200, 665650, 426000, 385, 228, 638),
    (6200, 816200, 498200, 430, 258, 787),
    (8200, 900000, 525000, 455, 255, 1370),
    (9200, 1050000, 550000, 500, 255, 1669),
    (10200, 1300000, 600000, 560, 270, 1791),
]

NOTES = (
    "FICI TIPI TAMBUR KAPLINI (barrel coupling). Halat tamburunu reduktor "
    "cikis miline baglar; radyal yuk tasiyan kaplin ailesindendir. "
    "DOGRULANDI (2026-08-08): katalog PDF'i workspace'e alindi "
    "('Jaure Tambur kaplini.pdf'), 21 satirin tamami basili s.18 seçim "
    "tablosuyla karsilastirildi. T_kmax ve Fr sutunlari birebir dogru cikti. "
    "DUZELTILEN SUTUN KAYMASI: (1) weight_kg aslinda basili OB sutunuydu, "
    "gercek agirlik s.19'daki WEIGHT sutunundan alindi (TCBR 25: 160 -> 13 kg); "
    "(2) hub_diameter_mm aslinda Od MIN sutunuydu, 21 satirin 8'i yanlis "
    "okunmustu, min_bore_mm olarak duzeltildi; (3) max_speed_rpm bu tabloda "
    "HIC YOKTUR, Od MAX'tan kopyalanmisti, kaldirildi; (4) TCBR 10200 icin "
    "max_shaft_diameter_mm 430 yazilmisti, basili deger 560'tir. "
    "Katalog TEK moment sutunu basar (T_kmax); nominal_torque_Nm ile "
    "max_torque_Nm ayni degeri tasir. Dipnot (1): verilen delik caplari "
    "DIN 6885/1 kamali baglanti icindir. Dipnot (2): agirlik EN KUCUK delik "
    "capindaki yaklasik degerdir."
)


def build():
    path = os.path.join(OUT_DIR, FILENAME)
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)

    items = doc["items"]
    if len(items) != len(CATALOG_ROWS):
        raise SystemExit(
            "satir sayisi uyusmuyor: dosyada %d, katalogda %d"
            % (len(items), len(CATALOG_ROWS))
        )

    changed = []
    for item, row in zip(items, CATALOG_ROWS):
        size, torque, radial, dmax, dmin, weight = row

        # --- degistirilmeyen sutunlar: yalnizca SINANIR -------------------
        if item["model"] != "TCBR %d" % size:
            raise SystemExit("satir sirasi kaymis: %r != TCBR %d" % (item["model"], size))
        for field, expected in (("nominal_torque_Nm", torque),
                                ("max_radial_load_N", radial)):
            if item.get(field) != expected:
                raise SystemExit(
                    "%s.%s dosyada %r, katalogda %r — beklenmeyen fark, elle bakin"
                    % (item["model"], field, item.get(field), expected)
                )

        # --- duzeltilen sutunlar ------------------------------------------
        if item.get("max_shaft_diameter_mm") != dmax:
            changed.append("%s max_shaft_diameter_mm %s -> %s"
                           % (item["model"], item.get("max_shaft_diameter_mm"), dmax))
            item["max_shaft_diameter_mm"] = dmax
        if item.get("min_bore_mm") != dmin:
            changed.append("%s min_bore_mm %s -> %s (eski hub_diameter_mm=%s)"
                           % (item["model"], item.get("min_bore_mm"), dmin,
                              item.get("hub_diameter_mm")))
        item["min_bore_mm"] = dmin
        item.pop("hub_diameter_mm", None)
        if item.get("weight_kg") != weight:
            changed.append("%s weight_kg %s -> %s"
                           % (item["model"], item.get("weight_kg"), weight))
        item["weight_kg"] = weight
        if "max_speed_rpm" in item:
            changed.append("%s max_speed_rpm %s -> (kaldirildi)"
                           % (item["model"], item["max_speed_rpm"]))
            item.pop("max_speed_rpm")

    # Alan sirasi: ortak semadaki sira korunur.
    order = ["model", "coupling_type", "series", "nominal_torque_Nm",
             "max_torque_Nm", "max_shaft_diameter_mm", "min_bore_mm",
             "max_radial_load_N", "weight_kg"]
    doc["items"] = [
        {k: it[k] for k in order if k in it}
        for it in items
    ]
    doc["fields"] = [f for f in order if any(f in it for it in doc["items"])]
    doc["meta"]["source_page"] = "s.18-19 (PDF idx 1 ve 0)"
    doc["meta"]["extraction_date"] = "2026-08-08"
    doc["meta"]["extraction_method"] = (
        "Basili tablo goruntusunden okundu (PDF metin katmani YOK). Sayfalar "
        "260 dpi render edilip sutun sutun karsilastirildi; degistirilmeyen "
        "sutunlar betikte yeniden siniyor."
    )
    doc["meta"]["notes"] = NOTES

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("JAURE TCBR duzeltmesi — %d degisiklik:" % len(changed))
    for line in changed:
        print("  %s" % line)
    print("  yazildi: %s" % path)


if __name__ == "__main__":
    build()
