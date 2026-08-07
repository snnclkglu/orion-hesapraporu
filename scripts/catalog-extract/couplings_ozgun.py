# -*- coding: utf-8 -*-
"""ÖZGÜN Makina kaplin kataloğu (ozgun katalog 2019 1-b.pdf) → JSON.

KAYNAK VE YÖNTEM
PDF'in METİN KATMANI YOKTUR (70 sayfanın tamamında 0 karakter) — taranmış
görüntüdür ve OCR uygulanmamıştır.  Bu yüzden tablolar sayfa sayfa yüksek
çözünürlükte (120 dpi) PNG'ye render edilip GÖRSEL olarak okunmuş, aşağıya
ELLE yazılmıştır.  Her dizi tek bir basılı satırın birebir karşılığıdır;
hiçbir değer enterpolasyonla üretilmemiştir.

PDF sayfa indisi (0 tabanlı) ↔ basılı sayfa numarası: indis = basılı + 2.

  TİP A    idx 16 (s.15)    TİP Dt   idx 25 (s.24)    TİP K   idx 35 (s.34)
  TİP B1   idx 17 (s.16)    TİP Dtk  idx 27 (s.26)    TİP N   idx 36 (s.35)
  TİP B2   idx 18 (s.17)    TİP Dv   idx 28 (s.27)    TİP R   idx 38 (s.37)
  TİP B3   idx 19 (s.18)    TİP E    idx 29 (s.28)    TİP S6  idx 39 (s.38)
  TİP C    idx 20 (s.19)    TİP F    idx 30 (s.29)    TİP S8  idx 40 (s.39)
  TİP Da   idx 21 (s.20)    TİP G    idx 31 (s.30)    TİP T6  idx 41 (s.40)
  TİP Db   idx 22 (s.21)    TİP H    idx 32 (s.31)    TİP T8  idx 42 (s.41)
  TİP Dc   idx 23 (s.22)    TİP I    idx 33 (s.32)    TİP Y   idx 43 (s.42)
  TİP Dk   idx 24 (s.23)    TİP J    idx 34 (s.33)    TİP Za  idx 44 (s.43)
                                                      TİP Zr  idx 45/46

TAMBUR KAPLİNİ = YALNIZ TİP J
Bu, kataloğun kendi ifadesidir: s.51 başlığı "TAMBUR KAPLİN KULLANIM ve
BAKIMI — OPERATION and MAINTENANCE INSTRUCTIONS FOR OZGUN TYPE J DRUM
COUPLINGS".  TİP J tablosunda ayrıca "Radial Load [N]" satırı vardır; diğer
hiçbir ÖZGÜN tipinde radyal yük basılı değildir.  Bu yüzden coupling_type
"drum" YALNIZ J'ye verilir.

B1/B2/B3 FREN KAPLİNİDİR
Basılı başlıklar "TİP B1 (Brake 1)", "TİP B2 (Brake 2)", "TİP B3 (Brake 3)"
ve dipnotlar "FREN DİSKLERİ / FREN KASNAKLARI GGG50 malzemeden imal edilerek
dinamik balansı alınmaktadır" der.  Eski ozgun_b_motor.json dosyasının
"B3 serisi motor-redüktör kaplini" tanımı YANLIŞTIR; bu dosya
ozgun_b1/b2/b3.json olarak coupling_type="brake" ile yeniden yazılmıştır.
B serisinin ağırlığı fren kasnağı/diski çapına (R) bağlı olduğundan tek bir
ağırlık yoktur: weight_min_kg / weight_max_kg + brake_dia_options_mm yazılır.
"""

from __future__ import annotations

from couplings_common import item, remove_stale, write_catalog

BRAND = "OZGUN"
SRC = "ozgun katalog 2019 1-b.pdf"
DATE = "2026-08-06"

# ---------------------------------------------------------------- yardımcı


def _rows(prefix, sizes, dmax, tpeak, tnom, dmin=None, rpm=None, kg=None,
          od=None, radial=None, ctype="gear", series=None, sep=" "):
    series = series or prefix
    n = len(sizes)
    for name, seq in (("dmax", dmax), ("tpeak", tpeak), ("tnom", tnom),
                      ("dmin", dmin), ("rpm", rpm), ("kg", kg), ("od", od),
                      ("radial", radial)):
        if seq is not None and len(seq) != n:
            raise ValueError("%s: %s uzunlugu %d, beklenen %d"
                             % (prefix, name, len(seq), n))
    out = []
    for i, size in enumerate(sizes):
        out.append(item(
            model="%s%s" % (prefix, size) if sep == "" else
                  "%s%s%s" % (prefix, sep, size),
            coupling_type=ctype,
            series=series,
            nominal_torque_Nm=tnom[i],
            max_torque_Nm=tpeak[i],
            max_bore_mm=dmax[i],
            min_bore_mm=None if dmin is None else dmin[i],
            max_radial_load_N=None if radial is None else radial[i],
            weight_kg=None if kg is None else kg[i],
            outer_diameter_mm=None if od is None else od[i],
            max_speed_rpm=None if rpm is None else rpm[i],
        ))
    return out


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
            "PDF metin katmani YOK (taranmis). Sayfa 120 dpi PNG'ye render "
            "edilip tablo gorsel olarak okundu ve elle yazildi."
        ),
        "notes": note,
    }


# ================================================================ TİP J
# TAMBUR KAPLİNİ (basılı s.33).  Radyal yük SÜTUNU AYRIDIR — eski dosyada
# tork sütununa radyal yük yazılmıştı (J6 için 59400: bu Tnominal DEĞİL,
# radyal yüktür; Tnominal 22600 Nm'dir).  Aynı şekilde eski dosyadaki
# "130 kN radyal" değeri aslında J6'nın ød max = 130 mm ölçüsüdür.
J_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
J_DMAX = [50, 65, 90, 100, 110, 130, 150, 170, 200, 220, 250, 280, 300, 320]
J_DMIN = [19, 25, 35, 45, 55, 55, 65, 70, 100, 120, 150, 180, 180, 200]
J_TPEAK = [7200, 9600, 17200, 28800, 36800, 45200, 74000, 124000, 162000,
           260000, 320000, 620000, 770000, 1000000]
J_TNOM = [3600, 4800, 8600, 14400, 18400, 22600, 37000, 62000, 81000,
          130000, 160000, 310000, 385000, 500000]
J_RADIAL = [12400, 16400, 29200, 38400, 47000, 59400, 88000, 112000, 152000,
            188000, 221000, 314000, 343000, 399000]
J_KG = [12, 15, 25, 36, 43, 55, 73, 110, 175, 205, 240, 380, 450, 575]
J_OD = [230, 250, 290, 340, 360, 380, 400, 450, 510, 550, 580, 650, 680, 710]

# ================================================================ TİP A
A_SIZES = list(range(1, 14))
A_DMAX = [44, 60, 75, 95, 105, 130, 150, 165, 190, 210, 230, 260, 280]
A_DMIN = [13, 16, 20, 25, 30, 35, 45, 55, 60, 70, 100, 115, 140]
A_TPEAK = [2050, 4300, 8400, 14400, 23400, 34400, 55000, 76000, 102400,
           134600, 176000, 269000, 360000]
A_TNOM = [1025, 2150, 4200, 7200, 11700, 17200, 27500, 38000, 51200,
          67300, 88000, 134500, 180000]
A_RPM = [3000, 2500, 2000, 1700, 1500, 1300, 1150, 1050, 950, 850, 800,
         700, 650]
A_KG = [5, 7, 13, 21, 30, 39, 64, 82, 110, 140, 167, 260, 320]
A_OD = [102, 122, 152, 180, 203, 229, 267, 293, 330, 358, 382, 440, 475]

# ============================================================= TİP B1/B2/B3
# Üçü de aynı göbek (kaplin) tablosunu paylaşır; fark fren elemanındadır.
B_SIZES = list(range(1, 9))
B_DMAX = [45, 60, 75, 95, 110, 130, 155, 175]
B_DMIN = [0, 0, 0, 0, 0, 55, 65, 80]
B_TPEAK = [2700, 5700, 11000, 21000, 33000, 45000, 65000, 93000]
B_TNOM = [1350, 2850, 5500, 10500, 16500, 22500, 32500, 46500]
B_RPM = [6500, 6000, 5200, 4820, 4200, 4000, 3800, 3600]
B_OD = [111, 141, 171, 210, 234, 274, 312, 337]

B1_KG = [[9.5, 11.5], [13.5, 15.5, 18.5, 20.5], [27, 30, 34, 39],
         [42, 46, 51, 57], [58, 63, 69, 75], [90, 96, 110],
         [120, 126, 140], [155, 169]]
B1_R = [[250, 315], [315, 355, 395, 445], [395, 445, 495, 550],
        [445, 495, 550, 625], [495, 550, 625, 705], [625, 705, 795],
        [625, 705, 795], [705, 795]]

B2_KG = [[7.5, 9.5], [13.5, 17.5, 24.5], [24, 31, 36, 49], [42, 48, 61],
         [55, 60, 73, 79, 88], [94, 100, 109], [139, 149, 193],
         [168, 178, 222, 251]]
B2_R = [[160, 200], [200, 250, 315], [250, 315, 350, 400], [315, 350, 400],
        [315, 350, 400, 450, 500], [400, 450, 500], [500, 530, 630],
        [500, 530, 630, 710]]

B3_KG = [[9.5, 11.5], [13.5, 15.5, 21.5, 28.5], [28, 35, 46, 60],
         [47, 58, 72], [69, 70, 84, 107, 129], [105, 128, 150],
         [180, 191, 248], [209, 220, 277, 308]]
B3_R = [[160, 200], [160, 200, 250, 315], [250, 315, 350, 400],
        [315, 350, 400], [315, 350, 400, 450, 500], [400, 450, 500],
        [500, 530, 630], [500, 530, 630, 710]]


def _brake_rows(prefix, kgs, rs):
    out = []
    for i, size in enumerate(B_SIZES):
        it = item(
            model="%s-%d" % (prefix, size),
            coupling_type="brake",
            series=prefix,
            nominal_torque_Nm=B_TNOM[i],
            max_torque_Nm=B_TPEAK[i],
            max_bore_mm=B_DMAX[i],
            min_bore_mm=B_DMIN[i],
            weight_min_kg=min(kgs[i]),
            weight_max_kg=max(kgs[i]),
            outer_diameter_mm=B_OD[i],
            max_speed_rpm=B_RPM[i],
        )
        # Fren kasnağı/diski çapı seçenekleri (basılı "R" satırı).
        it["brake_dia_options_mm"] = rs[i]
        out.append(it)
    return out


# ================================================================ TİP C
C_SIZES = list(range(1, 11))
C_DMAX = [14, 19, 24, 28, 32, 38, 42, 48, 65, 80]
C_TNOM = [10, 16, 20, 45, 60, 80, 100, 140, 380, 700]
C_TMAX = [20, 32, 40, 90, 120, 160, 200, 280, 760, 1400]
C_RPM = [14000, 11800, 10600, 8500, 7500, 6700, 6000, 5600, 4000, 3150]
C_OD = [40, 48, 52, 66, 76, 83, 92, 95, 132, 175]

# ============================================================ D ailesi
# Da / Dv 20 boy, Db / Dc / Dk 14 boy, Dt / Dtk 12 boy.
DA_SIZES = list(range(1, 21))
DA_DMAX = [45, 60, 75, 95, 110, 130, 155, 175, 195, 215, 240, 275, 280,
           320, 360, 400, 450, 500, 530, 560]
DA_DMIN = [0, 0, 0, 0, 0, 55, 65, 80, 90, 100, 120, 150, 180, 200, 220,
           260, 280, 300, 330, 350]
DA_TPEAK = [2700, 5700, 11000, 21000, 33000, 45000, 65000, 93000, 127000,
            171000, 234000, 351000, 490000, 590000, 750000, 920000,
            1200000, 1300000, 1600000, 1800000]
DA_TNOM = [1350, 2850, 5500, 10500, 16500, 22500, 32500, 46500, 63500,
           85500, 117000, 175500, 245000, 295000, 375000, 460000, 600000,
           650000, 800000, 900000]
DA_RPM = [6500, 6000, 5200, 4820, 4200, 4000, 3800, 3600, 3450, 3300,
          3050, 2750, 1700, 1600, 1400, 1500, 1300, 1100, 1000, 900]
DA_KG = [4.5, 8.5, 15, 27, 39, 60, 90, 119, 170, 225, 280, 430, 600, 770,
         1000, 1250, 1600, 2000, 2400, 2900]
DA_OD = [111, 141, 171, 210, 234, 274, 312, 337, 380, 405, 444, 506, 591,
         640, 684, 742, 804, 908, 965, 1029]

D14 = slice(0, 14)
D12 = slice(0, 12)

DB_KG = [4.6, 9, 15.5, 28, 40, 61, 93, 123, 175, 235, 300, 445, 650, 836]
DC_DMIN = [0, 0, 0, 0, 0, 5, 65, 80, 90, 100, 120, 150, 180, 200]
DC_KG = [5.3, 11.2, 19.5, 34, 51, 71, 108, 138, 195, 260, 325, 510, 700, 935]
DT_KG = [5, 9, 16, 28, 42, 63, 94, 125, 177, 234, 290, 450]

# ================================================================ TİP E
# Zincir kaplin.  Katalog TORK BASMAZ; yalnız 1000 d/dak'daki azami gücü
# (HP) verir.  Tork alanı bu yüzden BOŞ bırakılır — türetilmez.
E_SIZES = list(range(1, 7))
E_DMAX = [27, 38, 48, 60, 80, 100]
E_DMIN = [12, 12, 15, 20, 25, 28]
E_RPM = [4000, 4000, 4000, 3000, 2000, 1800]
E_HP = [12, 25, 41, 72, 181, 329]
E_OD = [78, 100, 122, 144, 188, 236]

# ============================================================ F/G/H/K/R ailesi
FGH_SIZES = list(range(1, 15))
FGH_DMAX = [40, 55, 70, 85, 100, 120, 140, 160, 180, 200, 220, 250, 280, 320]
FGH_DMIN = [0, 0, 25, 35, 45, 55, 65, 80, 90, 100, 120, 150, 180, 200]
FGH_TPEAK = [1800, 3300, 5800, 10900, 16600, 25300, 41000, 56200, 78200,
             117000, 223000, 284000, 490000, 550000]
FGH_TNOM = [900, 1650, 2900, 5450, 8300, 12650, 20500, 28100, 39100, 58500,
            111500, 142000, 245000, 275000]
FGH_OD = [117, 152, 178, 213, 240, 280, 318, 347, 390, 425.5, 457, 527,
          591, 640]
F_RPM = [7400, 6500, 5800, 5200, 4800, 4500, 4100, 3850, 3650, 3450, 3300,
         3100, 2850, 2700]
F_KG = [4.2, 8.4, 14, 25, 36, 58, 83, 110, 160, 215, 265, 380, 600, 770]
G_KG = [4.4, 8.7, 14.3, 25.5, 37, 59, 89, 115, 170, 230, 280, 400, 655, 835]
H_KG = [5, 11, 18, 30, 44, 67, 97, 123, 180, 242, 300, 445, 700, 930]
# TİP K'da K3 anma momenti 2800 Nm basılıdır (F/G/H'de 2900) — sayfadaki
# hâliyle yazılır.
K_TNOM = [900, 1650, 2800, 5450, 8300, 12650, 20500, 28100, 39100, 58500,
          111500, 142000, 245000, 275000]
R_RPM = [3900, 3500, 3250, 2900, 2500, 2100, 1950, 1750, 1600, 1400, 1350,
         1300, 1200, 1150]
R_KG = [9, 18, 27, 45, 61, 100, 135, 175, 240, 312, 385, 555, 825, 1090]

# ================================================================ TİP I
I_SIZES = list(range(1, 16))
I_DMAX = [32, 42, 57, 70, 85, 100, 120, 140, 160, 180, 200, 220, 250, 280, 320]
I_DMIN = [0, 0, 22, 25, 38, 38, 55, 65, 80, 90, 100, 120, 150, 180, 200]
I_TPEAK = [1200, 2300, 4000, 6550, 11350, 17100, 25350, 41000, 56500, 78500,
           117000, 223000, 284000, 489000, 581000]
# I 2 için anma momenti sayfada "11500" basılıdır; bu, aynı sütundaki tepe
# momentinden (2300 Nm) büyüktür — baskı hatasıdır.  Doğrusu tahmin
# EDİLMEZ, alan BOŞ bırakılır (aşağıda None) ve satıra not düşülür.
I_TNOM = [600, None, 2000, 3275, 5675, 8550, 12675, 20500, 28250, 39250,
          58500, 111500, 142000, 244500, 285000]
I_RPM = [7650, 7100, 6100, 5500, 5000, 4700, 4500, 4100, 3850, 3650, 3450,
         3300, 3100, 2850, 2700]
I_KG = [2, 3.5, 6, 9.2, 15.5, 30, 38, 65, 95, 127, 183, 225, 320, 540, 690]
I_OD = [84, 95, 120, 140, 168, 190, 210, 243, 278, 305, 340, 364, 404, 472,
        518]

# ================================================================ TİP N
N_SIZES = list(range(1, 15))
N_DMAX = [325, 370, 400, 430, 475, 510, 530, 580, 610, 680, 780, 860, 950,
          1020]
N_TPEAK = [556000, 770000, 990000, 1330000, 1690000, 1999000, 2400000,
           3120000, 3640000, 5040000, 7100000, 9000000, 11960000, 14500000]
N_TNOM = [278000, 385000, 495000, 665000, 845000, 995000, 1200000, 1560000,
          1820000, 2520000, 3550000, 4500000, 5980000, 7250000]
N_RPM = [1150, 1020, 930, 815, 725, 680, 645, 550, 535, 480, 420, 365, 330,
         310]
N_KG = [700, 930, 1250, 1624, 2102, 2519, 3024, 3786, 4572, 6090, 8735,
        11269, 14880, 18395]
N_OD = [580, 630, 700, 760, 825, 885, 935, 1010, 1085, 1185, 1340, 1440,
        1575, 1705]

# ============================================================ S6/T6, S8/T8
S6_SIZES = list(range(1, 18))
S6_DMAX = [41, 50, 65, 75, 87, 95, 107, 117, 131, 145, 156, 165, 178, 192,
           206, 220, 233]
S6_TPEAK = [500, 1160, 2400, 4200, 6800, 9400, 14200, 20800, 29000, 42000,
            52000, 64000, 87000, 116000, 150000, 187000, 237000]
S6_TNOM = [250, 580, 1200, 2100, 3400, 4700, 7100, 10400, 14500, 21000,
           26000, 32000, 43500, 58000, 75000, 93500, 118500]
S6_OD = [92, 112, 134, 160, 187, 204, 230, 257, 280, 304, 327, 347, 382,
         412, 442, 477, 507]
S6_KG = [1.4, 2.3, 3.8, 6.4, 9.9, 13.5, 19, 29, 37, 49, 60.5, 73, 96, 124,
         151, 191, 233]
T6_KG = [2.1, 2.9, 5.5, 8.6, 15, 21, 30, 40, 57, 74, 89, 109, 146, 190,
         224, 288, 366]

S8_SIZES = list(range(1, 18))
S8_DMAX = [131, 145, 156, 165, 178, 192, 206, 220, 233, 235, 250, 265, 275,
           290, 300, 315, 330]
S8_TPEAK = [42000, 62000, 76000, 94000, 128000, 174000, 222000, 278000,
            352000, 444000, 520000, 636000, 770000, 910000, 1060000,
            1220000, 1410000]
S8_TNOM = [21000, 31000, 38000, 47000, 64000, 87000, 111000, 139000, 176000,
           222000, 260000, 318000, 385000, 455000, 530000, 610000, 705000]
S8_OD = [280, 304, 327, 347, 382, 412, 442, 477, 507, 542, 572, 607, 637,
         677, 702, 732, 762]
S8_KG = [39, 51, 63, 75, 101, 130, 158, 200, 245, 272, 320, 381, 446, 541,
         610, 685, 792]
T8_KG = [59, 77, 92, 112, 150, 195, 230, 295, 374, 454, 535, 617, 728, 875,
         1021, 1130, 1310]

# ================================================================ TİP Y
Y_SIZES = list(range(1, 13))
Y_DMAX = [20, 22, 32, 42, 55, 65, 85, 100, 110, 110, 120, 180]
Y_TPEAK = [20, 40, 100, 200, 440, 900, 1800, 3200, 6000, 10000, 17000, 25000]
Y_TNOM = [10, 20, 50, 100, 220, 450, 900, 1600, 3000, 5000, 8500, 12500]
Y_RPM = [4000, 4000, 4000, 3000, 3000, 2500, 2500, 2000, 2000, 1600, 1250,
         900]
Y_OD = [86, 104, 136, 178, 210, 263, 310, 370, 402, 450, 550, 700]

# ================================================================ TİP Za
ZA_SIZES = list(range(1, 10))
ZA_DMAX_STEEL = [25, 35, 40, 48, 55, 62, 74, 80, 95]
ZA_DMAX_ALU = [24, 28, 38, 45, None, None, None, None, None]
ZA_TPEAK = [34, 120, 320, 405, 900, 1050, 1370, 1880, 3840]
ZA_TNOM = [17, 60, 160, 325, 450, 525, 685, 940, 1920]
ZA_OD = [40, 55, 65, 80, 95, 105, 120, 135, 160]

# ================================================================ TİP Zr
# İki basılı tablo (Zr1-14 ve Zr15-26) tek seride birleştirilir.
# Zr15-26'da ød max/min birden çok göbek seçeneği için basılıdır; en büyük
# ve en küçük değer alınır.
ZR_SIZES = list(range(1, 27))
ZR_DMAX = ([38, 48, 55, 60, 70, 80, 90, 100, 110, 120, 130, 140, 160, 180]
           + [210, 235, 250, 280, 310, 340, 370, 400, 460, 510, 580, 640])
ZR_DMIN = ([0] * 8 + [48, 55, 65, 75, 85, 95]
           + [100, 100, 110, 125, 140, 150, 160, 180, 200, 260, 320, 380])
ZR_TPEAK = ([380, 640, 960, 1440, 1800, 2500, 4200, 5200, 8200, 10400,
             15000, 24000, 36000, 48000]
            + [76000, 102000, 166000, 210000, 290000, 380000, 520000,
               660000, 1020000, 1460000, 1900000, 2400000])
ZR_TNOM = ([190, 320, 480, 720, 900, 1250, 2100, 2600, 4100, 5200, 7500,
            12000, 18000, 24000]
           + [38000, 51000, 83000, 105000, 145000, 190000, 260000, 330000,
              510000, 730000, 950000, 1200000])
# İki devir sınırı basılıdır: GG24 döküm ve AISI 1040 dövme gövde için.
# Muhafazakâr olan (GG24) max_speed_rpm'e yazılır, diğeri ayrı alanda durur.
ZR_RPM_GG24 = ([6900, 5900, 5150, 4500, 4100, 3650, 3250, 2900, 2500, 2150,
                1900, 1850, 1750, 1500]
               + [1450, 1250, 1100, 1000, 900, 800, 675, 600, 520, 480,
                  400, 380])
ZR_RPM_1040 = ([9900, 8900, 7700, 6800, 6200, 5500, 4800, 4300, 3750, 3350,
                2900, 2600, 2250, 2000]
               + [1950, 1750, 1500, 1300, 1200, 1050, 950, 850, 750, 650,
                  550, 500])
ZR_OD = ([106, 126, 145, 163, 180, 200, 230, 255, 288, 324, 365, 405, 455,
          505]
         + [565, 635, 715, 805, 905, 1010, 1130, 1280, 1450, 1650, 1850,
            2100])


def build():
    print("OZGUN kaplin katalogu:")

    # Eski iki dosya: ikisi de "gold referans + engineering interpolation"
    # kokenliydi ve sutunlari karismisti (bkz. ozgun_j.json meta.notes).
    remove_stale(["ozgun_b_motor.json", "ozgun_j_drum.json"])

    # ---------------------------------------------------------- TİP J
    write_catalog(
        "ozgun_j.json",
        _meta("J", "drum", "s.33 (PDF idx 34)",
              "TAMBUR KAPLINI. Katalogun kendi kullanim kilavuzu (s.51) bu "
              "seriyi 'OZGUN TYPE J DRUM COUPLINGS' olarak adlandirir ve "
              "radyal yuk satiri YALNIZ bu tabloda basilidir. ONCEKI "
              "ozgun_j_drum.json DUZELTILDI: o dosyada radyal yuk sutunu "
              "tork sutununa yazilmisti (J6 icin 59400 Nm yaziyordu; 59400 "
              "aslinda radyal yuktur, Tnominal 22600 Nm'dir) ve 130 mm olan "
              "od max olcusu 130 kN radyal yuk olarak okunmustu."),
        _rows("J", J_SIZES, J_DMAX, J_TPEAK, J_TNOM, dmin=J_DMIN,
              kg=J_KG, od=J_OD, radial=J_RADIAL, ctype="drum", sep=""),
    )

    # ---------------------------------------------------------- TİP A
    write_catalog(
        "ozgun_a.json",
        _meta("A", "gear", "s.15 (PDF idx 16)",
              "Tam-flex disli kaplin. AISI 4140, disli kisimlar "
              "induksiyonla sertlestirilmis."),
        _rows("A", A_SIZES, A_DMAX, A_TPEAK, A_TNOM, dmin=A_DMIN, rpm=A_RPM,
              kg=A_KG, od=A_OD, ctype="gear", sep=""),
    )

    # ------------------------------------------------------- TİP B1/B2/B3
    for name, kgs, rs, page, note in (
        ("B1", B1_KG, B1_R, "s.16 (PDF idx 17)",
         "FREN KAPLINI (Brake 1) — fren DISKLI. Gobek olculeri D serisi "
         "disli kaplinle aynidir; agirlik fren diski capina (R) baglidir."),
        ("B2", B2_KG, B2_R, "s.17 (PDF idx 18)",
         "FREN KAPLINI (Brake 2) — fren KASNAKLI. Gobek olculeri D serisi "
         "disli kaplinle aynidir; agirlik fren kasnagi capina (R) baglidir."),
        ("B3", B3_KG, B3_R, "s.18 (PDF idx 19)",
         "FREN KAPLINI (Brake 3) — fren DISKLI, ara parcali. Gobek "
         "olculeri D serisi disli kaplinle aynidir; agirlik fren diski "
         "capina (R) baglidir."),
    ):
        write_catalog(
            "ozgun_%s.json" % name.lower(),
            _meta(name, "brake", page, note),
            _brake_rows(name, kgs, rs),
            extra_fields=("brake_dia_options_mm",),
        )

    # ---------------------------------------------------------- TİP C
    write_catalog(
        "ozgun_c.json",
        _meta("C", "flexible", "s.19 (PDF idx 20)",
              "Elastik kaplin; gobek AISI 1040, zarf dokme poliamid. "
              "Katalog agirlik basmaz — weight_kg yazilmadi."),
        _rows("C", C_SIZES, C_DMAX, C_TMAX, C_TNOM, rpm=C_RPM, od=C_OD,
              ctype="flexible", sep=""),
    )

    # ------------------------------------------------------- D ailesi
    write_catalog(
        "ozgun_da.json",
        _meta("Da", "gear", "s.20 (PDF idx 21)",
              "Tam-flex disli kaplin, standart gobek. Katalogun basili "
              "devir satirinda Da15=1400 ve Da16=1500 d/dak yazar (siralama "
              "bozuk); sayfadaki hâliyle alinmistir."),
        _rows("Da", DA_SIZES, DA_DMAX, DA_TPEAK, DA_TNOM, dmin=DA_DMIN,
              rpm=DA_RPM, kg=DA_KG, od=DA_OD, ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_db.json",
        _meta("Db", "gear", "s.21 (PDF idx 22)",
              "Yarim-flex disli kaplin (bir tarafi rijit flans). Katalog "
              "devir sinirini basmaz — max_speed_rpm yazilmadi."),
        _rows("Db", DA_SIZES[D14], DA_DMAX[D14], DA_TPEAK[D14],
              DA_TNOM[D14], dmin=DA_DMIN[D14], kg=DB_KG, od=DA_OD[D14],
              ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_dc.json",
        _meta("Dc", "gear", "s.22 (PDF idx 23)",
              "Ara parcali disli kaplin. Dc6 icin od min sayfada '5' mm "
              "basilidir (Da/Db ayni boyda 55 mm der) — basili degeriyle "
              "birakildi, DOGRULANMADI."),
        _rows("Dc", DA_SIZES[D14], DA_DMAX[D14], DA_TPEAK[D14],
              DA_TNOM[D14], dmin=DC_DMIN, rpm=DA_RPM[D14], kg=DC_KG,
              od=DA_OD[D14], ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_dk.json",
        _meta("Dk", "gear", "s.23 (PDF idx 24)",
              "Ara mesafeli (spacer) disli kaplin. Katalog agirlik ve "
              "devir sinirini basmaz."),
        _rows("Dk", DA_SIZES[D14], DA_DMAX[D14], DA_TPEAK[D14],
              DA_TNOM[D14], dmin=DA_DMIN[D14], od=DA_OD[D14],
              ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_dt.json",
        _meta("Dt", "gear", "s.24 (PDF idx 25)",
              "Eksenel hareketli (stroke) disli kaplin; standart ve ters "
              "gobek secenekleri vardir."),
        _rows("Dt", DA_SIZES[D12], DA_DMAX[D12], DA_TPEAK[D12],
              DA_TNOM[D12], dmin=DA_DMIN[D12], rpm=DA_RPM[D12], kg=DT_KG,
              od=DA_OD[D12], ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_dtk.json",
        _meta("Dtk", "gear", "s.26 (PDF idx 27)",
              "Ara mesafeli + eksenel hareketli disli kaplin. Katalog "
              "agirlik basmaz."),
        _rows("Dtk", DA_SIZES[D12], DA_DMAX[D12], DA_TPEAK[D12],
              DA_TNOM[D12], dmin=DA_DMIN[D12], rpm=DA_RPM[D12],
              od=DA_OD[D12], ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_dv.json",
        _meta("Dv", "gear", "s.27 (PDF idx 28)",
              "Dik kaplin (vertical coupling). Moment/delik/agirlik "
              "tablosu Da ile aynidir; fark dusey montaj tasarimindadir. "
              "Da'daki gibi Dv15=1400, Dv16=1500 d/dak basilidir."),
        _rows("Dv", DA_SIZES, DA_DMAX, DA_TPEAK, DA_TNOM, dmin=DA_DMIN,
              rpm=DA_RPM, kg=DA_KG, od=DA_OD, ctype="gear", sep=""),
    )

    # ---------------------------------------------------------- TİP E
    e_items = []
    for i, size in enumerate(E_SIZES):
        it = item(
            model="E%d" % size,
            coupling_type="chain",
            series="E",
            max_bore_mm=E_DMAX[i],
            min_bore_mm=E_DMIN[i],
            outer_diameter_mm=E_OD[i],
            max_speed_rpm=E_RPM[i],
        )
        it["max_power_hp_at_1000rpm"] = E_HP[i]
        e_items.append(it)
    write_catalog(
        "ozgun_e.json",
        _meta("E", "chain", "s.28 (PDF idx 29)",
              "Zincir kaplin. Katalog MOMENT BASMAZ; yalniz 1000 d/dak'daki "
              "azami gucu (HP) verir. nominal_torque_Nm bu yuzden BOS "
              "birakilmistir — turetilmedi."),
        e_items,
        extra_fields=("max_power_hp_at_1000rpm",),
    )

    # ------------------------------------------------------ F/G/H/K/R
    write_catalog(
        "ozgun_f.json",
        _meta("F", "gear", "s.29 (PDF idx 30)",
              "Tam-flex disli kaplin, kisa gobek."),
        _rows("F", FGH_SIZES, FGH_DMAX, FGH_TPEAK, FGH_TNOM, dmin=FGH_DMIN,
              rpm=F_RPM, kg=F_KG, od=FGH_OD, ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_g.json",
        _meta("G", "gear", "s.30 (PDF idx 31)",
              "Yarim-flex disli kaplin. Katalog devir sinirini basmaz."),
        _rows("G", FGH_SIZES, FGH_DMAX, FGH_TPEAK, FGH_TNOM, dmin=FGH_DMIN,
              kg=G_KG, od=FGH_OD, ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_h.json",
        _meta("H", "gear", "s.31 (PDF idx 32)",
              "Ara parcali disli kaplin."),
        _rows("H", FGH_SIZES, FGH_DMAX, FGH_TPEAK, FGH_TNOM, dmin=FGH_DMIN,
              rpm=F_RPM, kg=H_KG, od=FGH_OD, ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_k.json",
        _meta("K", "gear", "s.34 (PDF idx 35)",
              "Ara mesafeli disli kaplin. K3 anma momenti sayfada 2800 Nm "
              "basilidir (ayni boydaki F/G/H'de 2900 Nm) — basili degeriyle "
              "birakildi. Katalog agirlik ve devir sinirini basmaz."),
        _rows("K", FGH_SIZES, FGH_DMAX, FGH_TPEAK, K_TNOM, dmin=FGH_DMIN,
              od=FGH_OD, ctype="gear", sep=""),
    )
    write_catalog(
        "ozgun_r.json",
        _meta("R", "gear", "s.37 (PDF idx 38)",
              "Kesme pimli disli kaplin: 'Tork degerine gore pim capi ve "
              "sayisi belirlenir, sistem asiri yuklendiginde pimler kesilir'."),
        _rows("R", FGH_SIZES, FGH_DMAX, FGH_TPEAK, FGH_TNOM, dmin=FGH_DMIN,
              rpm=R_RPM, kg=R_KG, od=FGH_OD, ctype="gear", sep=""),
    )

    # ---------------------------------------------------------- TİP I
    i_items = _rows("I", I_SIZES, I_DMAX, I_TPEAK,
                    [t if t is not None else 0 for t in I_TNOM],
                    dmin=I_DMIN, rpm=I_RPM, kg=I_KG, od=I_OD,
                    ctype="gear", sep=" ")
    for idx, t in enumerate(I_TNOM):
        if t is None:
            i_items[idx].pop("nominal_torque_Nm", None)
            i_items[idx]["catalog_print_issue"] = (
                "Sayfada anma momenti 11500 Nm basili; ayni sutundaki tepe "
                "momenti 2300 Nm'dir. Baski hatasi; dogru deger tahmin "
                "edilmedi, alan bos birakildi."
            )
    write_catalog(
        "ozgun_i.json",
        _meta("I", "gear", "s.32 (PDF idx 33)",
              "Disli kaplin; I1-I6 ve I7-I15 iki farkli govde tasarimidir. "
              "I 2 satirinda anma momenti baski hatalidir (bkz. "
              "catalog_print_issue)."),
        i_items,
        extra_fields=("catalog_print_issue",),
    )

    # ---------------------------------------------------------- TİP N
    write_catalog(
        "ozgun_n.json",
        _meta("N", "gear", "s.35 (PDF idx 36)",
              "Buyuk capli tam-flex disli kaplin (od 325-1020 mm). Katalog "
              "od min basmaz."),
        _rows("N", N_SIZES, N_DMAX, N_TPEAK, N_TNOM, rpm=N_RPM, kg=N_KG,
              od=N_OD, ctype="gear", sep=""),
    )

    # ------------------------------------------------------ S6/S8/T6/T8
    write_catalog(
        "ozgun_s6.json",
        _meta("S6", "disc", "s.38 (PDF idx 39)",
              "Lamelli disk kaplin, 6 civatali. Flanslar AISI 1040, ara "
              "parcalar 55Si7. Katalog devir sinirini basmaz."),
        _rows("S6", S6_SIZES, S6_DMAX, S6_TPEAK, S6_TNOM, kg=S6_KG,
              od=S6_OD, ctype="disc", sep="-"),
    )
    write_catalog(
        "ozgun_s8.json",
        _meta("S8", "disc", "s.39 (PDF idx 40)",
              "Lamelli disk kaplin, 8 civatali. Katalog od min ve devir "
              "sinirini basmaz."),
        _rows("S8", S8_SIZES, S8_DMAX, S8_TPEAK, S8_TNOM, kg=S8_KG,
              od=S8_OD, ctype="disc", sep="-"),
    )
    write_catalog(
        "ozgun_t6.json",
        _meta("T6", "disc", "s.40 (PDF idx 41)",
              "Ara mesafeli lamelli disk kaplin, 6 civatali. Moment ve "
              "delik tablosu S6 ile ayni, agirlik farklidir."),
        _rows("T6", S6_SIZES, S6_DMAX, S6_TPEAK, S6_TNOM, kg=T6_KG,
              od=S6_OD, ctype="disc", sep="-"),
    )
    write_catalog(
        "ozgun_t8.json",
        _meta("T8", "disc", "s.41 (PDF idx 42)",
              "Ara mesafeli lamelli disk kaplin, 8 civatali. Sayfa basligi "
              "'TIP T8 1-18' oldugu hâlde tabloda 17 boy basilidir; 18. boy "
              "sayfada YOKTUR ve uydurulmamistir."),
        _rows("T8", S8_SIZES, S8_DMAX, S8_TPEAK, S8_TNOM, kg=T8_KG,
              od=S8_OD, ctype="disc", sep="-"),
    )

    # ---------------------------------------------------------- TİP Y
    write_catalog(
        "ozgun_y.json",
        _meta("Y", "flexible", "s.42 (PDF idx 43)",
              "Lastik bandajli (tyre) elastik kaplin; flans AISI 1040, "
              "lastik 5 kat kaucuk. Katalog agirlik basmaz. Y9 ve Y10 icin "
              "od max ayni (110 mm) basilidir."),
        _rows("Y", Y_SIZES, Y_DMAX, Y_TPEAK, Y_TNOM, rpm=Y_RPM, od=Y_OD,
              ctype="flexible", sep=""),
    )

    # ---------------------------------------------------------- TİP Za
    za_items = []
    for i, size in enumerate(ZA_SIZES):
        it = item(
            model="Za%d" % size,
            coupling_type="flexible",
            series="Za",
            nominal_torque_Nm=ZA_TNOM[i],
            max_torque_Nm=ZA_TPEAK[i],
            max_bore_mm=ZA_DMAX_STEEL[i],
            outer_diameter_mm=ZA_OD[i],
        )
        if ZA_DMAX_ALU[i] is not None:
            it["max_bore_aluminium_mm"] = ZA_DMAX_ALU[i]
        za_items.append(it)
    write_catalog(
        "ozgun_za.json",
        _meta("Za", "flexible", "s.43 (PDF idx 44)",
              "Poliuretan lastikli (95-98 Shore) elastik kaplin. max_bore_mm "
              "CELIK gobek icindir; Za1-Za4 aluminyum gobekle de uretilir ve "
              "o hâldeki delik siniri max_bore_aluminium_mm alanindadir. "
              "Katalog agirlik ve devir sinirini basmaz."),
        za_items,
        extra_fields=("max_bore_aluminium_mm",),
    )

    # ---------------------------------------------------------- TİP Zr
    zr_items = []
    for i, size in enumerate(ZR_SIZES):
        it = item(
            model="Zr%d" % size,
            coupling_type="pin",
            series="Zr",
            nominal_torque_Nm=ZR_TNOM[i],
            max_torque_Nm=ZR_TPEAK[i],
            max_bore_mm=ZR_DMAX[i],
            min_bore_mm=ZR_DMIN[i],
            outer_diameter_mm=ZR_OD[i],
            max_speed_rpm=ZR_RPM_GG24[i],
        )
        it["max_speed_rpm_aisi1040"] = ZR_RPM_1040[i]
        zr_items.append(it)
    write_catalog(
        "ozgun_zr.json",
        _meta("Zr", "pin", "s.44-45 (PDF idx 45-46)",
              "Pimli (burclu) elastik kaplin. Iki basili tablo (Zr1-14 ve "
              "Zr15-26) tek seride birlestirildi. Katalog IKI devir siniri "
              "basar: GG24 dokum govde ve AISI 1040 dovme govde. "
              "max_speed_rpm MUHAFAZAKAR olani (GG24) tasir; digeri "
              "max_speed_rpm_aisi1040 alanindadir. Zr15-26'da od max/min "
              "birden cok gobek secenegi icin basilidir; en buyuk/en kucuk "
              "deger alinmistir. Katalog agirlik basmaz."),
        zr_items,
        extra_fields=("max_speed_rpm_aisi1040",),
    )


if __name__ == "__main__":
    build()
