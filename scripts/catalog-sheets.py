# -*- coding: utf-8 -*-
"""Katalog SAYFASI kesici — "o ürünün kataloğundaki gerçek sayfası".

NE YAPAR
  Üretici katalog PDF'lerinden, seçilen ürünün TABLOSUNUN bulunduğu sayfayı
  kesip ekran çözünürlüğünde bir görüntü (.webp) olarak yazar ve uygulamanın
  okuduğu `src/lib/catalog-sheets/manifest.json` defterini üretir: hangi MARKA
  + MODEL hangi sayfaya düşer.

  Yalnız GÖRÜNTÜ yazılır, PDF dilimi yazılmaz. Sayfa dilimi PDF'i kaynak
  dosyanın taranmış görüntüsünü olduğu gibi taşıdığı için dosya başına 200–800
  KB tutuyordu; 250'yi aşkın sayfada bu depoyu gereksiz şişirirdi. Görüntü her
  tarayıcıda açılır, indirilir ve yazdırılır — kaybedilen tek şey vektör
  kataloglardaki metin seçimidir (kataloğun çoğu zaten taranmıştır).

SAYFA NASIL BULUNUR — İKİ YOL
  1. ELLE (`MANUAL`): sayfa haritası katalog verisini çıkaran betiklerin
     `meta.source_page` alanlarından gelir. Kaplinlerde böyledir; ÖZGÜN
     kataloğunun metin katmanı olmadığı için başka yolu da yoktur.
  2. OTOMATİK (`DISCOVER`): her ÜRÜN için, o ürünün ayırt edici değerlerinin
     (model kodu + sayısal alanları) en çoğunu taşıyan sayfa seçilir. Tek bir
     kodun kataloğun her yerinde geçmesi sayfayı kazandırmaz; ürünün SATIRININ
     bulunduğu tablo sayfası kazanır. Eşiği geçemeyen ürün için sayfa YAZILMAZ
     — yanlış sayfa göstermektense hiç göstermemek doğrudur.

  İNDİS TABANI: PyMuPDF `doc[i]` ile aynı, yani 0 TABANLIDIR.

KULLANIM
  python scripts/catalog-sheets.py            # üret
  python scripts/catalog-sheets.py --verify   # yalnız haritayı sına, dosya yazma
  python scripts/catalog-sheets.py --only motor,bearing   # tek tür üret
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict

import fitz  # PyMuPDF
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)                 # orion-hesapraporu
WORKSPACE = os.path.dirname(REPO)            # HESAP RAPORU KOD
CATALOG_DATA = os.path.join(WORKSPACE, "catalog_data")
OUT_DIR = os.path.join(REPO, "catalog-sheets")
MANIFEST = os.path.join(REPO, "src", "lib", "catalog-sheets", "manifest.json")

# Görüntü: A4 sayfa 1500 px genişlikte ~180 dpi olur — ölçü tablolarındaki en
# küçük rakam ekranda okunur, dosya 120–250 KB bandında kalır.
IMG_WIDTH = 1500
WEBP_QUALITY = 76

# --------------------------------------------------------------- kaynak PDF'ler

PDFS = {
    "ozgun": "ozgun katalog 2019 1-b.pdf",
    "sibre_coupling": "02_SIBRE_Coupling-catalogue.pdf",
    "sibre_brake": "01_SIBRE_Brake-catalogue.pdf",
    "jaure_mt": "JAURE MT Series_Gear Coupling.pdf",
    "jaure_tcbr": "Jaure Tambur kaplini.pdf",
    "skf_bearing": "SKF genel-rulman-katalogu.pdf",
    "skf_housing": "13186_1_EN_SKF_bearing_housings_and_roller_bearing_units_pdf_preview_medium.pdf",
    "galvi": "Galvi Kasnak Fren.pdf",
    "conductix": "KAT0170-0002-EN Rubber and Cellular Buffers, Programs 0170_0180.pdf",
    "conductix_curves": "KAT0170-0003-EN Load Diagrams Rubber Buffers.pdf",
    "sibre_sp": "SIBRE Produktkatalog2022_Puffer_SP.pdf",
    "yilmaz_dr": "YILMAZ DR KATALOG.pdf",
    "yilmaz_m": "YILMAZ M KATALOG.pdf",
    "yilmaz_h": "YILMAZ H KATALOG.pdf",
    "abb": "abb-ozel-elektrik-motor-katalog.pdf",
    "gamak": "GAMAK MOTOR.pdf",
    "siemens": "SIEMENS MOTOR KATALOG.pdf",
    "flender": "FLENDER-gear-units-MD20-1-complete-English-2018 (2).pdf",
    "vasel_festoon": "vasel-i-profil-grubu-kablo-tasima-sistemleri-rf-cat-4b52-brosur-tr.pdf",
    "conductix_festoon": "KAT0320-0003-EN Festoon Systems for I-Beams Program 0314_0320_0325_0330.pdf",
}

KIND_DIR = {
    "coupling": "couplings",
    "bearing": "bearings",
    "bearing_housing": "bearing_housings",
    "brake": "brakes",
    "buffer": "buffers",
    "gearbox": "reducers",
    "motor": "motors",
    "festoon": "festoons",
}

# ------------------------------------------------------------ ELLE sayfa haritası
# (kind, brand, series, catalog_data dosyası, kaynak, 0-tabanlı sayfalar,
#  basılı sayfa etiketi, başlık[, o sayfaya düşen SERİLER])
#
# Dokuzuncu alan İSTEĞE BAĞLIDIR: dosyada birden çok seri varsa (feston
# kataloğu böyledir) sayfaya yalnız o serilerin ürünleri bağlanır. Verilmezse
# dosyadaki BÜTÜN ürünler sayfaya düşer — kaplin ve tampon dosyalarında her
# dosya zaten tek seridir.

MANUAL = [
    # ---------------------------------------------------------------- ÖZGÜN
    # Taranmış katalog; harita couplings_ozgun.py başlığındaki idx tablosundan
    # birebir alınmıştır (metin katmanı YOK → otomatik doğrulanamaz).
    ("coupling", "OZGUN", "A", "ozgun_a.json", "ozgun", [16], "s.15", "ÖZGÜN Tip A — Tam-flex dişli kaplin"),
    ("coupling", "OZGUN", "B1", "ozgun_b1.json", "ozgun", [17], "s.16", "ÖZGÜN Tip B1 — Fren kasnaklı kaplin"),
    ("coupling", "OZGUN", "B2", "ozgun_b2.json", "ozgun", [18], "s.17", "ÖZGÜN Tip B2 — Fren kasnaklı kaplin"),
    ("coupling", "OZGUN", "B3", "ozgun_b3.json", "ozgun", [19], "s.18", "ÖZGÜN Tip B3 — Fren kasnaklı kaplin"),
    ("coupling", "OZGUN", "C", "ozgun_c.json", "ozgun", [20], "s.19", "ÖZGÜN Tip C — Elastik kaplin"),
    ("coupling", "OZGUN", "Da", "ozgun_da.json", "ozgun", [21], "s.20", "ÖZGÜN Tip Da — Dişli kaplin"),
    ("coupling", "OZGUN", "Db", "ozgun_db.json", "ozgun", [22], "s.21", "ÖZGÜN Tip Db — Dişli kaplin"),
    ("coupling", "OZGUN", "Dc", "ozgun_dc.json", "ozgun", [23], "s.22", "ÖZGÜN Tip Dc — Dişli kaplin"),
    ("coupling", "OZGUN", "Dk", "ozgun_dk.json", "ozgun", [24], "s.23", "ÖZGÜN Tip Dk — Dişli kaplin"),
    ("coupling", "OZGUN", "Dt", "ozgun_dt.json", "ozgun", [25], "s.24", "ÖZGÜN Tip Dt — Dişli kaplin"),
    ("coupling", "OZGUN", "Dtk", "ozgun_dtk.json", "ozgun", [27], "s.26", "ÖZGÜN Tip Dtk — Dişli kaplin"),
    ("coupling", "OZGUN", "Dv", "ozgun_dv.json", "ozgun", [28], "s.27", "ÖZGÜN Tip Dv — Dişli kaplin"),
    ("coupling", "OZGUN", "E", "ozgun_e.json", "ozgun", [29], "s.28", "ÖZGÜN Tip E — Zincirli kaplin"),
    ("coupling", "OZGUN", "F", "ozgun_f.json", "ozgun", [30], "s.29", "ÖZGÜN Tip F — Dişli kaplin"),
    ("coupling", "OZGUN", "G", "ozgun_g.json", "ozgun", [31], "s.30", "ÖZGÜN Tip G — Dişli kaplin"),
    ("coupling", "OZGUN", "H", "ozgun_h.json", "ozgun", [32], "s.31", "ÖZGÜN Tip H — Dişli kaplin"),
    ("coupling", "OZGUN", "I", "ozgun_i.json", "ozgun", [33], "s.32", "ÖZGÜN Tip I — Dişli kaplin"),
    ("coupling", "OZGUN", "J", "ozgun_j.json", "ozgun", [34], "s.33", "ÖZGÜN Tip J — Tambur (kasnaklı) kaplin"),
    ("coupling", "OZGUN", "K", "ozgun_k.json", "ozgun", [35], "s.34", "ÖZGÜN Tip K — Dişli kaplin"),
    ("coupling", "OZGUN", "N", "ozgun_n.json", "ozgun", [36], "s.35", "ÖZGÜN Tip N — Dişli kaplin"),
    ("coupling", "OZGUN", "R", "ozgun_r.json", "ozgun", [38], "s.37", "ÖZGÜN Tip R — Dişli kaplin"),
    ("coupling", "OZGUN", "S6", "ozgun_s6.json", "ozgun", [39], "s.38", "ÖZGÜN Tip S6 — Diskli (lamelli) kaplin"),
    ("coupling", "OZGUN", "S8", "ozgun_s8.json", "ozgun", [40], "s.39", "ÖZGÜN Tip S8 — Diskli (lamelli) kaplin"),
    ("coupling", "OZGUN", "T6", "ozgun_t6.json", "ozgun", [41], "s.40", "ÖZGÜN Tip T6 — Diskli (lamelli) kaplin"),
    ("coupling", "OZGUN", "T8", "ozgun_t8.json", "ozgun", [42], "s.41", "ÖZGÜN Tip T8 — Diskli (lamelli) kaplin"),
    ("coupling", "OZGUN", "Y", "ozgun_y.json", "ozgun", [43], "s.42", "ÖZGÜN Tip Y — Elastik kaplin"),
    ("coupling", "OZGUN", "Za", "ozgun_za.json", "ozgun", [44], "s.43", "ÖZGÜN Tip Za — Elastik kaplin"),
    ("coupling", "OZGUN", "Zr", "ozgun_zr.json", "ozgun", [45, 46], "s.44-45", "ÖZGÜN Tip Zr — Pimli (elastik) kaplin"),
    # ---------------------------------------------------------------- SIBRE
    # Katalog çift sayfa (spread) basılmıştır: bir PDF sayfası iki basılı sayfa.
    ("coupling", "SIBRE", "ALC-A", "sibre_alc_a.json", "sibre_coupling", [5], "s.10-11", "SIBRE ALC-A — Elastik kaplin"),
    ("coupling", "SIBRE", "ALC-AS", "sibre_alc_as.json", "sibre_coupling", [6], "s.12-13", "SIBRE ALC-AS — Fren kasnaklı elastik kaplin"),
    ("coupling", "SIBRE", "ALC-AT", "sibre_alc_at.json", "sibre_coupling", [6], "s.12-13", "SIBRE ALC-AT — Fren diskli elastik kaplin"),
    ("coupling", "SIBRE", "AFC-A", "sibre_afc_a.json", "sibre_coupling", [7], "s.14-15", "SIBRE AFC-A — Elastik kaplin"),
    ("coupling", "SIBRE", "AFC-AS", "sibre_afc_as.json", "sibre_coupling", [7], "s.14-15", "SIBRE AFC-AS — Fren kasnaklı elastik kaplin"),
    ("coupling", "SIBRE", "APC-A", "sibre_apc_a.json", "sibre_coupling", [8], "s.16-17", "SIBRE APC-A — Pimli kaplin"),
    ("coupling", "SIBRE", "APC-AS", "sibre_apc_as.json", "sibre_coupling", [9], "s.18-19", "SIBRE APC-AS — Fren kasnaklı pimli kaplin"),
    ("coupling", "SIBRE", "APC-AT", "sibre_apc_at.json", "sibre_coupling", [10], "s.20-21", "SIBRE APC-AT — Fren diskli pimli kaplin"),
    ("coupling", "SIBRE", "APC-BT", "sibre_apc_bt.json", "sibre_coupling", [10], "s.20-21", "SIBRE APC-BT — Fren diskli pimli kaplin"),
    ("coupling", "SIBRE", "ZKES", "sibre_zkes.json", "sibre_coupling", [12], "s.24-25", "SIBRE ZKES — Dişli kaplin"),
    ("coupling", "SIBRE", "ABC-V", "sibre_abc_v.json", "sibre_coupling", [23], "s.46-47", "SIBRE ABC-V — Tambur (halat) kaplini"),
    # ---------------------------------------------------------------- JAURE
    # ENDÜSTRİYEL bölüm sayfaları. MT ve MTG tabloları katalogun DENİZCİLİK
    # bölümünde idx 35/36'da AYNI torklarla tekrar eder; vinç uygulaması
    # endüstriyel bölüme aittir.
    ("coupling", "JAURE", "MT", "jaure_mt.json", "jaure_mt", [16], "s.17", "JAURE MT — Kavisli dişli tam-flex kaplin"),
    ("coupling", "JAURE", "MTS", "jaure_mts.json", "jaure_mt", [18], "s.19", "JAURE MTS — Tek gövdeli (yarım-flex) dişli kaplin"),
    ("coupling", "JAURE", "MTG", "jaure_mtg.json", "jaure_mt", [19], "s.20", "JAURE MTG / MTG-HD — Büyük çaplı dişli kaplin"),
    ("coupling", "JAURE", "MTG-HD", "jaure_mtg_hd.json", "jaure_mt", [19], "s.20", "JAURE MTG / MTG-HD — Büyük çaplı dişli kaplin"),
    ("coupling", "JAURE", "MTF", "jaure_mtf.json", "jaure_mt", [27], "s.28", "JAURE MTF — Ara fren kasnaklı dişli kaplin"),
    ("coupling", "JAURE", "MTFE", "jaure_mtfe.json", "jaure_mt", [28], "s.29", "JAURE MTFE — Yan fren kasnaklı dişli kaplin"),
    ("coupling", "JAURE", "MTES", "jaure_mtes.json", "jaure_mt", [30], "s.31", "JAURE MTES — Ayrılabilir (kavramalı) dişli kaplin"),
    # TCBR PDF'i iki sayfadır ve sıralaması TERSTİR: idx 1 basılı s.18 (seçim
    # tablosu), idx 0 basılı s.19 (ölçü tamamlayıcı). Basılı sıra korunur.
    ("coupling", "JAURE", "TCBR", "jaure_tcbr_barrel.json", "jaure_tcbr", [1, 0], "s.18-19", "JAURE TCBR — Fıçı tipi tambur kaplini"),
    # ---------------------------------------------------------------- TAMPON
    # SIBRE SP kataloğu ürün kodunu satır olarak BASMAZ: seçim, s.18'deki
    # "Impact Force / Damping Capacity" matrisinden yapılır ve ölçüler
    # s.19-22'deki FF/BF tablolarındadır. Otomatik arama bu yüzden ürün
    # bulamıyor; sayfalar elle verilir.
    ("buffer", "SIBRE", "SP", "sibre_sp_hydraulic.json", "sibre_sp", [17, 18, 20], "s.18-21",
     "SIBRE SP — Hidrolik tampon: seçim matrisi ve ölçüler"),
    # ---------------------------------------------------------------- FESTON
    # Vasel Cat.4b/52 broşürü ürün kodlarını ve arabaların resmini basar;
    # taşıyıcı YÜKÜ tablosu broşürde YOKTUR (tam katalog workspace'te değil).
    # Bu yüzden yalnız broşürde gerçekten çizilmiş seriler haritaya girer;
    # 2050/2060/2070 ve VS25/VS26 broşürde sadece "Katg. No" ile REFERANS
    # verilir — o sayfayı göstermek yanlış tabloya baktırırdı.
    ("festoon", "Vasel", "VS2005", "vasel.json", "vasel_festoon", [1], "s.2",
     "Vasel VS2005 — 2005 Serisi kablo taşıma sistemi parça kodları",
     ["VS2005"]),
    ("festoon", "Vasel", "VS2010-VS2020", "vasel.json", "vasel_festoon", [2], "s.3",
     "Vasel VS2010 / VS2015 / VS2020 — parça kodları ve kablo kelepçeleri",
     ["VS2010", "VS2015", "VS2020"]),
    # Conductix-Wampfler KAT0320-0003b-EN GERÇEK bir ürün kataloğudur (ölçü
    # tabloları + kiriş uyumluluğu + yürüyüş takımı kodları). Workspace'teki
    # FB0300-0005-E ile karıştırılmamalıdır: o 2 sayfalık bir SORU FORMUDUR ve
    # deftere girmez.
    #
    # Süzgeç SÖZLÜKTÜR çünkü aynı program yassı ve yuvarlak kabloyu AYRI
    # sayfada basar; seri kodu ikisinde de aynıdır. Program 0314'te ayrım
    # kablo bağlantısına iner: küresel mafsallı arabalar kablo KELEPÇESİYLE
    # (s.6-8), kancalı araba kablo BİLEZİĞİYLE (s.9) kullanılır ve aksesuar
    # tabloları ayrı sayfalardadır.
    ("festoon", "Conductix-Wampfler", "0314 Yassi", "conductix_wampfler.json",
     "conductix_festoon", [3, 4], "s.4-5",
     "Conductix Program 0314 — yassı kablo plastik arabaları ve sonlandırıcı",
     {"series": ["0314"], "cable_form": ["Yassı"]}),
    ("festoon", "Conductix-Wampfler", "0314 Yuvarlak Mafsalli", "conductix_wampfler.json",
     "conductix_festoon", [5, 6, 7], "s.6-8",
     "Conductix Program 0314 — küresel mafsallı arabalar, sonlandırıcı ve kablo kelepçesi",
     {"series": ["0314"], "cable_attachment": ["Küresel mafsal"]}),
    ("festoon", "Conductix-Wampfler", "0314 Yuvarlak Kancali", "conductix_wampfler.json",
     "conductix_festoon", [8], "s.9",
     "Conductix Program 0314 — kancalı araba ve kablo bileziği",
     {"series": ["0314"], "cable_attachment": ["Kanca"]}),
    ("festoon", "Conductix-Wampfler", "0320 Yassi", "conductix_wampfler.json",
     "conductix_festoon", [10], "s.11",
     "Conductix Program 0320 — yassı kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0320"], "cable_form": ["Yassı"]}),
    ("festoon", "Conductix-Wampfler", "0320 Yuvarlak", "conductix_wampfler.json",
     "conductix_festoon", [11], "s.12",
     "Conductix Program 0320 — yuvarlak kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0320"], "cable_form": ["Yuvarlak"]}),
    ("festoon", "Conductix-Wampfler", "0325 Yassi", "conductix_wampfler.json",
     "conductix_festoon", [12], "s.13",
     "Conductix Program 0325 — yassı kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0325"], "cable_form": ["Yassı"]}),
    ("festoon", "Conductix-Wampfler", "0325 Yuvarlak", "conductix_wampfler.json",
     "conductix_festoon", [13], "s.14",
     "Conductix Program 0325 — yuvarlak kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0325"], "cable_form": ["Yuvarlak"]}),
    ("festoon", "Conductix-Wampfler", "0330 Yassi", "conductix_wampfler.json",
     "conductix_festoon", [14], "s.15",
     "Conductix Program 0330 — yassı kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0330"], "cable_form": ["Yassı"]}),
    ("festoon", "Conductix-Wampfler", "0330 Yuvarlak", "conductix_wampfler.json",
     "conductix_festoon", [15], "s.16",
     "Conductix Program 0330 — yuvarlak kablo çelik arabaları, ölçüler ve kiriş uyumluluğu",
     {"series": ["0330"], "cable_form": ["Yuvarlak"]}),
]

# --------------------------------------------------- OTOMATİK sayfa keşfi
# (kind, catalog_data dosyası, kaynak, model alanı|None, ayırt edici sayısal
#  alanlar, başlık öneki)

DISCOVER = [
    ("bearing", "bearings/skf.json", "skf_bearing", "designation",
     ["bore_mm", "outer_diameter_mm", "width_mm", "dynamic_load_kN", "static_load_kN"],
     "SKF Rulman"),
    ("bearing_housing", "bearing_housings/skf_snl_se.json", "skf_housing", "model",
     ["bearing_bore_mm", "bearing_outer_dia_mm", "housing_width_mm"],
     "SKF Rulman Yatağı"),
    ("brake", "brakes/galvi_nhyd_nvhyd.json", "galvi", "model",
     ["drum_diameter_mm", "brake_torque_Nm", "weight_kg"],
     "GALVI NEWCOMEN Fren"),
    # SIBRE fren kataloğu üç ürün ailesini ayrı tablolarda basar; her aile
    # kendi JSON'undan aranır. Model kodu ("TE 160 Ed 23/5") tabloda parça
    # parça durduğu için eşleşme ağırlıklı olarak SAYILARDAN gelir.
    ("brake", "brakes/sibre_te_drum.json", "sibre_brake", None,
     ["drum_diameter_mm", "min_torque_Nm", "max_torque_Nm", "brake_torque_Nm", "weight_kg"],
     "SIBRE TE — Kasnaklı (tambur) fren"),
    ("brake", "brakes/sibre_usb_disc.json", "sibre_brake", None,
     ["disc_diameter_mm", "min_torque_Nm", "max_torque_Nm", "brake_torque_Nm", "weight_kg"],
     "SIBRE USB5 — Diskli fren"),
    ("brake", "brakes/sibre_shi_caliper.json", "sibre_brake", None,
     ["min_disc_diameter_mm", "clamping_force_1mm_kN", "clamping_force_3mm_kN",
      "release_pressure_bar", "torque_offset_mm"],
     "SIBRE SHI — Kaliperli disk fren"),
    ("buffer", "buffers/conductix_rubber.json", "conductix", "model",
     ["diameter_mm", "height_mm", "energy_capacity_j", "max_force_kn"],
     "Conductix-Wampfler Kauçuk Tampon"),
    ("buffer", "buffers/conductix_cellular.json", "conductix", "model",
     ["diameter_mm", "height_mm", "energy_capacity_j", "max_force_kn"],
     "Conductix-Wampfler Hücresel Tampon"),
    ("gearbox", "reducers/yilmaz_dr.json", "yilmaz_dr", "model",
     ["ratio", "output_torque_Nm", "output_speed_rpm"],
     "YILMAZ D Serisi Redüktör"),
    ("gearbox", "reducers/yilmaz_m.json", "yilmaz_m", "model",
     ["ratio", "output_torque_Nm", "output_speed_rpm"],
     "YILMAZ M Serisi Redüktör"),
    ("gearbox", "reducers/yilmaz_h.json", "yilmaz_h", "model",
     ["ratio", "output_torque_Nm", "output_speed_rpm"],
     "YILMAZ H Serisi Redüktör"),
    ("motor", "motors/abb.json", "abb", None,
     ["power_kw", "speed_rpm", "torque_nm", "efficiency_pct", "current_a", "weight_kg"],
     "ABB Motor"),
    ("motor", "motors/gamak.json", "gamak", None,
     ["power_kw", "speed_rpm", "torque_nm", "efficiency_pct", "current_a", "weight_kg"],
     "GAMAK Motor"),
    ("motor", "motors/innomatics.json", "siemens", None,
     ["power_kw", "speed_rpm", "torque_nm", "efficiency_pct", "current_a", "weight_kg"],
     "SIEMENS / INNOMATICS Motor"),
]


# ------------------------------------------------ BAŞLIK TARAMALI sayfa keşfi
# Üçüncü yol. Bazı kataloglar ölçü sayfalarını ürün ürün değil TİP + BOY
# ARALIĞI olarak basar: "Type H3 — Gear unit dimensions, three-stage, gear unit
# sizes 13 to 18". Böyle bir katalogda sayısal keşif çalışmaz (sayfada ürünün
# torku değil ölçüleri vardır), elle harita ise yüzlerce satır olurdu. Bunun
# yerine sayfa BAŞLIĞI okunur ve aralığa düşen bütün boylar o sayfaya bağlanır.
#
# (kind, catalog_data dosyası, kaynak, başlık deseni → (tip, boy_alt, boy_üst),
#  bölüm önekleri, başlık öneki)
#
# FLENDER MD 20.1 aynı ölçü bölümünü iki montaj konumu için ayrı basar:
# böl. 4/6 YATAY, böl. 5/7 DİKEY. Vinç tahriklerinde standart montaj yataydır
# ve defter model başına TEK sayfa seti tuttuğu için yalnız yatay bölümler
# alınır — iki seti birleştirmek mühendisi yanlış ölçü resmine baktırırdı.
HEADER_SCAN = [
    ("gearbox", "reducers/flender_md20_1.json", "flender",
     r"Type\s+([HB][1-4])\s+Gear unit dimensions,\s*[a-z-]+stage,"
     r"\s*gear unit sizes\s+(\d+)\s+to\s+(\d+)",
     ("4/", "6/"),
     "FLENDER MD 20.1"),
]

NUM_RE = re.compile(r"\d+(?:[.,]\d+)?")
THOUSANDS_RE = re.compile(r"^\d{1,3}(\.\d{3})+(,\d+)?$")
PRINTED_PAGE_RE = re.compile(r"^(\d+/\d+)")


def norm(text) -> str:
    return re.sub(r"\s+", "", str(text)).upper()


def slugify(text: str) -> str:
    out = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return out or "sheet"


def fmt_num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else ("%.3f" % v).rstrip("0")


def page_numbers(text: str) -> set[str]:
    """Sayfadaki sayıları normalleştirilmiş kümede toplar (1.234,5 → 1234.5)."""
    out: set[str] = set()
    for m in NUM_RE.finditer(text):
        s = m.group(0)
        s = s.replace(".", "").replace(",", ".") if THOUSANDS_RE.match(s) else s.replace(",", ".")
        try:
            out.add(fmt_num(float(s)))
        except ValueError:
            continue
    return out


class Source:
    """Açılmış kaynak PDF: sayfa metinleri + sayı kümeleri (bir kez kurulur)."""

    _cache: dict[str, "Source"] = {}

    def __init__(self, key: str):
        self.key = key
        self.name = PDFS[key]
        path = os.path.join(WORKSPACE, self.name)
        if not os.path.exists(path):
            raise SystemExit("Kaynak PDF bulunamadi: %s" % path)
        self.doc = fitz.open(path)
        self.text: list[str] = []
        self.nums: list[set[str]] = []
        for page in self.doc:
            raw = page.get_text()
            self.text.append(norm(raw))
            self.nums.append(page_numbers(raw))

    @classmethod
    def get(cls, key: str) -> "Source":
        if key not in cls._cache:
            cls._cache[key] = cls(key)
        return cls._cache[key]


def expand_variants(item: dict) -> list[dict]:
    """Tip/boy matrisi biçimindeki satırı tek tek ürünlere açar.

    Bazı kataloglar (FLENDER MD 20.1) bir seriyi tek satırda yayımlar ve
    boyları `variants` dizisinde taşır: [gövde, nominal tork Nm, i_min, i_max].
    `scripts/seed-catalog.ts` bu satırları veritabanına açarken modeli
    `<seri>-<gövde>` diye kurar; defterdeki anahtarların DB ile örtüşmesi için
    burada AYNI kural uygulanır.
    """
    variants = item.get("variants")
    if not isinstance(variants, list):
        return [item]
    details = item.get("details_by_size") or {}
    base = {k: v for k, v in item.items() if k not in ("variants", "details_by_size")}
    out = []
    for variant in variants:
        if not isinstance(variant, list) or len(variant) != 4:
            raise SystemExit("variants satiri [size, torque_nm, ratio_min, ratio_max] olmali")
        size = str(variant[0]).zfill(2)
        row = dict(base)
        row["model"] = "%s-%s" % (base.get("series"), size)
        row["frame_size"] = size
        row["output_torque_Nm"] = variant[1]
        row["ratio_range"] = "1:%s…%s" % (variant[2], variant[3])
        detail = details.get(size)
        if isinstance(detail, dict):
            row.update(detail)
        out.append(row)
    return out


def load_items(kind: str, filename: str) -> tuple[list[dict], dict]:
    path = os.path.join(CATALOG_DATA, KIND_DIR[kind], os.path.basename(filename))
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    items = [row for item in doc["items"] for row in expand_variants(item)]
    return items, doc["meta"]


def db_model(kind: str, item: dict) -> str:
    """`cat_equipment.model` ile BİREBİR aynı dizgiyi üretir.

    Seed betiği (scripts/seed-catalog.ts) modeli türe göre farklı kurar;
    defterdeki anahtarların veritabanıyla örtüşmesi buna bağlıdır.
    """
    if kind == "bearing":
        return str(item.get("designation", "")).strip()
    if kind == "motor":
        code = str(item.get("model", "")).strip() if isinstance(item.get("model"), str) else ""
        if code:
            return code
        return ("%s kW %sK %s" % (
            item.get("power_kw"), item.get("poles"), item.get("frame_size", ""))).strip()
    # Festonda ürün kimliği KABLO ARABASININ sipariş kodudur; seed de modeli
    # `model` alanından kurar (parça kodu basılmayan Vasel ailelerinde bu alan
    # seri kodunun kendisidir).
    if kind == "festoon":
        return str(item.get("model") or item.get("series", "")).strip()
    return str(item.get("model", "")).strip()


def manual_items(sheet) -> list[dict]:
    """ELLE harita satırının kapsadığı ürünler (süzgeç verilmişse süzülür).

    Dokuzuncu alan iki biçimde verilebilir:
      * SERİ listesi — `["VS2005"]` (kısa yol, en sık kullanılan)
      * ALAN → değerler sözlüğü — `{"series": ["0314"], "cable_form": ["Yassı"]}`
        Feston kataloğu bunu gerektirir: aynı program yassı ve yuvarlak kabloyu
        AYRI sayfalarda basar, seri kodu ikisinde de aynıdır.
    """
    kind, _brand, _series, filename, _src, _pages, _printed, _title = sheet[:8]
    items, _meta = load_items(kind, filename)
    flt = sheet[8] if len(sheet) > 8 else None
    if not flt:
        return items
    if not isinstance(flt, dict):
        flt = {"series": flt}
    return [
        it for it in items
        if all(str(it.get(field, "")).strip() in set(values)
               for field, values in flt.items())
    ]


def discover_pages(entry) -> tuple[dict[int, list[str]], int, str]:
    """Ürünleri sayfalara dağıtır → {sayfa: [model, …]}, eşleşmeyen, kanıt."""
    kind, jf, src_key, code_field, num_fields, _title = entry
    items, _meta = load_items(kind, jf)
    src = Source.get(src_key)

    by_page: dict[int, list[str]] = defaultdict(list)
    unmatched = 0
    for it in items:
        values = [fmt_num(it[f]) for f in num_fields if isinstance(it.get(f), (int, float))]
        code = norm(it.get(code_field, "")) if code_field else ""
        if not values and not code:
            unmatched += 1
            continue
        # Kod varsa 3 puanlık ağırlık taşır: model kodu, sayılardan çok daha
        # ayırt edicidir. Eşik, ürünün sayısal alanlarının %60'ıdır.
        need = max(2, int(len(values) * 0.6)) + (3 if code else 0)
        best, best_score = None, 0
        for i, nums in enumerate(src.nums):
            if code and code not in src.text[i]:
                continue
            score = sum(1 for v in values if v in nums) + (3 if code else 0)
            if score > best_score:
                best, best_score = i, score
        if best is None or best_score < need:
            unmatched += 1
            continue
        model = db_model(kind, it)
        if model and model not in by_page[best]:
            by_page[best].append(model)

    total = sum(len(v) for v in by_page.values())
    evidence = "%d model / %d sayfa" % (total, len(by_page))
    return dict(by_page), unmatched, evidence


def header_scan_groups(entry) -> tuple[list[dict], int, str]:
    """Başlığı okunabilen ölçü sayfalarını (tip, boy aralığı) kümelerine böler.

    Ardışık sayfalar aynı başlığı taşıyorsa (ölçü tablosu iki sayfaya taşar)
    TEK kayıtta birleşir; mühendis pencerede ölçü resmini ve çıkış mili /
    ağırlık tablosunu birlikte görür.
    """
    kind, jf, src_key, pattern, chapters, _title = entry
    items, _meta = load_items(kind, jf)

    # seri → {boy(int): DB modeli}
    by_series: dict[str, dict[int, str]] = defaultdict(dict)
    for it in items:
        series = str(it.get("series", "")).strip()
        size = it.get("frame_size")
        model = db_model(kind, it)
        if not (series and size and model):
            continue
        by_series[series][int(size)] = model

    src = Source.get(src_key)
    pat = re.compile(pattern, re.I)
    groups: list[dict] = []
    for i in range(len(src.text)):
        flat = " ".join(src.doc[i].get_text().split())
        if chapters and not flat.startswith(tuple(chapters)):
            continue
        m = pat.search(flat)
        if not m:
            continue
        series, lo, hi = m.group(1), int(m.group(2)), int(m.group(3))
        printed = PRINTED_PAGE_RE.match(flat)
        last = groups[-1] if groups else None
        if last and last["key"] == (series, lo, hi) and i == last["pages"][-1] + 1:
            last["pages"].append(i)
            if printed:
                last["printed"].append(printed.group(1))
            continue
        groups.append({
            "key": (series, lo, hi),
            "series": series, "lo": lo, "hi": hi,
            "pages": [i],
            "printed": [printed.group(1)] if printed else [],
            "models": [by_series[series][s] for s in range(lo, hi + 1) if s in by_series[series]],
        })

    groups = [g for g in groups if g["models"]]
    placed = {m for g in groups for m in g["models"]}
    unmatched = sum(1 for models in by_series.values() for m in models.values() if m not in placed)
    pages = sum(len(g["pages"]) for g in groups)
    evidence = "%d model / %d sayfa (%d küme)" % (len(placed), pages, len(groups))
    return groups, unmatched, evidence


# ------------------------------------------------------------------ ELLE doğrulama

SIZE_COVERAGE_MIN = 0.6


def verify_manual(sheet, src: Source) -> tuple[str, str | None]:
    """Elle verilen sayfayı PDF'in KENDİ metniyle sınar → (kanıt, hata)."""
    kind, _brand, series, filename, _src, pages, _printed, _title = sheet[:8]
    words = {w[4] for i in pages for w in src.doc[i].get_text("words")}
    if not words:
        return ("metin katmanı yok — doğrulanamadı", None)

    text = norm("".join(src.doc[i].get_text() for i in pages))
    header = norm(series) in text

    items = manual_items(sheet)
    # Kanıt iki yoldan gelir: ürünün BOY numarası sayfada tek başına bir sözcük
    # olarak geçiyorsa (ölçü tabloları böyle basar) ya da MODEL KODUNUN kendisi
    # sayfa metninde geçiyorsa. İkincisi olmadan alfasayısal kodlu kataloglar
    # (Vasel VS2010A-4WF, VS2015A) doğrulanamıyordu: o kodların sonunda rakam
    # yok, dolayısıyla boy numarası hiç üretilmiyor ve kanıt boş kalıyordu.
    models = [db_model(kind, it) for it in items]
    models = [m for m in models if m]

    def evidenced(model: str) -> bool:
        size = re.search(r"(\d+)$", model)
        if size and size.group(1) in words:
            return True
        return norm(model) in text

    hit = sum(1 for m in models if evidenced(m))
    total = len(models)
    ratio = hit / total if total else 0.0

    if header and ratio >= SIZE_COVERAGE_MIN:
        return ("seri başlığı + ürün %d/%d" % (hit, total), None)
    if header:
        return ("seri başlığı (ürün %d/%d)" % (hit, total), None)
    if ratio >= SIZE_COVERAGE_MIN:
        return ("ürün %d/%d" % (hit, total), None)
    return ("", "%s: sayfada ne seri başlığı ne de yeterli ürün kanıtı var (ürün %d/%d)"
            % (series, hit, total))


# ------------------------------------------------------------------ üretim

def render(src: Source, idx: int, path: str) -> None:
    page = src.doc[idx]
    zoom = IMG_WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def build(verify_only: bool = False, only: set[str] | None = None) -> None:
    entries: list[dict] = []
    problems: list[str] = []
    # Aynı sayfa birden çok seriye hizmet edebilir; dosya BİR KEZ üretilir.
    produced: dict[tuple[str, int], str] = {}

    def image_for(src_key: str, kind: str, idx: int, slug_hint: str) -> str:
        key = (src_key, idx)
        if key in produced:
            return produced[key]
        rel = "%s/%s.webp" % (kind, slug_hint)
        produced[key] = rel
        if not verify_only:
            out = os.path.join(OUT_DIR, kind)
            os.makedirs(out, exist_ok=True)
            render(Source.get(src_key), idx, os.path.join(out, "%s.webp" % slug_hint))
        return rel

    # ---------------------------------------------------------- elle harita
    for sheet in MANUAL:
        kind, brand, series, _filename, src_key, pages, printed, title = sheet[:8]
        if only and kind not in only:
            continue
        src = Source.get(src_key)
        evidence, problem = verify_manual(sheet, src)
        if problem:
            problems.append(problem)
            continue
        items = manual_items(sheet)
        models = []
        for it in items:
            m = db_model(kind, it)
            if m and m not in models:
                models.append(m)
        images = [
            image_for(src_key, kind, idx,
                      "%s-%s-p%d" % (slugify(brand), slugify(series), n + 1))
            for n, idx in enumerate(pages)
        ]
        entries.append({
            "id": "%s/%s-%s" % (kind, slugify(brand), slugify(series)),
            "kind": kind, "brand": brand, "series": series, "title": title,
            "source": PDFS[src_key], "printedPages": printed,
            "images": images, "models": models,
        })
        print("  %-16s %-6s %-8s %-9s idx %-9s %s"
              % (kind, brand, series, printed, ",".join(map(str, pages)), evidence))

    # ------------------------------------------------------- otomatik keşif
    for entry in DISCOVER:
        kind, jf, src_key, _code, _nums, title_prefix = entry
        if only and kind not in only:
            continue
        _items, meta = load_items(kind, jf)
        brand = str(meta.get("brand", "")).strip()
        by_page, unmatched, evidence = discover_pages(entry)
        if not by_page:
            problems.append("%s: hiçbir ürün sayfaya bağlanamadı" % jf)
            continue
        for idx in sorted(by_page):
            slug = "%s-%s-p%d" % (slugify(brand), slugify(os.path.splitext(os.path.basename(jf))[0]), idx + 1)
            rel = image_for(src_key, kind, idx, slug)
            entries.append({
                "id": "%s/%s" % (kind, slug),
                "kind": kind, "brand": brand,
                "series": str(meta.get("series", ""))[:40],
                "title": "%s — katalog s.%d" % (title_prefix, idx + 1),
                "source": PDFS[src_key], "printedPages": "PDF s.%d" % (idx + 1),
                "images": [rel], "models": by_page[idx],
            })
        print("  %-16s %-22s %-28s eşleşmeyen=%d" % (kind, brand[:22], evidence, unmatched))

    # -------------------------------------------------- başlık taramalı keşif
    for entry in HEADER_SCAN:
        kind, jf, src_key, _pattern, _chapters, title_prefix = entry
        if only and kind not in only:
            continue
        _items, meta = load_items(kind, jf)
        brand = str(meta.get("brand", "")).strip()
        groups, unmatched, evidence = header_scan_groups(entry)
        if not groups:
            problems.append("%s: başlık taramasında hiçbir ölçü sayfası bulunamadı" % jf)
            continue
        for g in groups:
            slug = "%s-%s-%d-%d" % (slugify(brand), slugify(g["series"]), g["lo"], g["hi"])
            images = [
                image_for(src_key, kind, idx, "%s-p%d" % (slug, n + 1))
                for n, idx in enumerate(g["pages"])
            ]
            printed = "s.%s" % "-".join(g["printed"]) if g["printed"] else \
                "PDF s.%s" % ",".join(str(i + 1) for i in g["pages"])
            entries.append({
                "id": "%s/%s" % (kind, slug),
                "kind": kind, "brand": brand, "series": g["series"],
                "title": "%s — Tip %s, boy %d–%d ölçü sayfası"
                         % (title_prefix, g["series"], g["lo"], g["hi"]),
                "source": PDFS[src_key], "printedPages": printed,
                "images": images, "models": g["models"],
            })
        print("  %-16s %-22s %-28s eşleşmeyen=%d" % (kind, brand[:22], evidence, unmatched))

    if problems:
        for p in problems:
            print("  SORUN: %s" % p)
        raise SystemExit("Sayfa haritasi dogrulanamadi — uretim durduruldu.")

    if verify_only:
        print("Harita doğrulandı: %d sayfa kaydı, %d benzersiz görüntü."
              % (len(entries), len(produced)))
        return

    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump({"sheets": entries}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    total = 0
    for root, _dirs, files in os.walk(OUT_DIR):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    models = sum(len(e["models"]) for e in entries)
    print("%d sayfa kaydı · %d görüntü · %d model — toplam %.1f MB"
          % (len(entries), len(produced), models, total / 1024 / 1024))
    print("manifest: %s (%.0f KB)" % (MANIFEST, os.path.getsize(MANIFEST) / 1024))


if __name__ == "__main__":
    args = sys.argv[1:]
    kinds = None
    if "--only" in args:
        kinds = set(args[args.index("--only") + 1].split(","))
    build(verify_only="--verify" in args, only=kinds)
