# -*- coding: utf-8 -*-
"""Güven Çelik Halat ürün föyleri — DIEPA · OLIVEIRA · UNION · DRAKO.

Kaynak: https://guvencelikhalat.com.tr/{diepa,oliveira,union,drako}/ altındaki
ürün föyü PDF'leri (04/2019 baskısı). Hepsi aynı dizgi ailesindendir: 1. sayfa
"GENEL BAKIŞ" (konstrüksiyon, RCN, dolgu/yapım faktörü, kullanım alanı),
sonraki sayfalar "ÇELİK HALAT TEKNİK TABLOLARI".

`ropes_others.py`den ayrı durur çünkü bu ailenin tabloları üç ayrı düzende
basılır ve tek bir okuyucu üçünü de çözer:

  1. SINIF SÜTUNLARI  — bir ağırlık sütunu, mukavemet sınıfı başına bir kN
     sütunu (DIEPA X 53, B 55, C 45 · OLIVEIRA NR MAXIPACT …).
  2. ÜRÜN SÜTUNLARI   — sınıf tek, ürün başına kN + ağırlık sütun çifti; aynı
     tablo dört PDF'te tekrar eder (DIEPA MB4-MB7, MX4-MX6, ML4-ML5).
  3. BÖLÜMLÜ TABLO    — tek sütun kümesi, satırlar arasına konstrüksiyon
     başlığı serpiştirilmiştir (DRAKO 180 B, regülatör föyü).

ORTAK OKUMA YÖNTEMİ. Sütunlar sabit indisle DEĞİL başlık kelimelerinin x
konumuyla bulunur (`pdftable`): tablolar boş hücre basar ("Talebe göre imalatı
yapılmaktadır." bandı, yalnız inç olarak basılan ara ölçüler, sınıfı olmayan
satırlar) ve sırayla okumak o satırlarda sütunları kaydırır. Her tablo, içinde
"(mm)" geçen başlık satırından bulunur; bir sayfada birden çok tablo olabilir
(OLIVEIRA ZINCAL COMPACT).

ONDALIK AYIRACI. Bu ailenin bütün sayısal sütunlarında ondalık ayıracı
VİRGÜLDÜR; nokta BİNLİK ayıracıdır ("1.727" = 1727 kN, "2.438" = 2438 kN).
Tek istisna ÇAP sütunudur: orada nokta ondalıktır (12.7 · 15.88 · 22.23).
`pdftable.num` bu ayrımı bilemez — "2.438"i 2,438 okur — bu yüzden çap dışı
sütunlar `num_kat` ile okunur. Ayrım rol bazlıdır, sezgisel değildir.

BASILI OLMAYAN ALAN YAZILMAZ. Mukavemet sınıfı basılmayan üründe (UNION
POWERMAX PFV · DRAKO'nun "1570 N/mm² ve 1370/1770 N/mm²" gibi bileşik başlıklı
sütunları) `grade_mpa` YOKTUR; bileşik başlık `grade_label` alanında basıldığı
gibi taşınır. Uydurulmuş bir sınıf, seçim tablosunda gerçek sanılırdı.

TON → kN. OLIVEIRA'nın balıkçılık föylerinde kopma kuvveti yalnız ton olarak
basılıdır. Bu METRİK tondur: aynı yayıncının kN ve ton'u birlikte bastığı
tablolarında oran birebir 9,80665'tir (148,00 kN ↔ 15,09 t) ve föyün kendi
"(ton, 2000 Ibs)" sütunu kısa tonu ayrıca gösterir. Dönüşüm bu yüzden
yapılmıştır; kaynak `breaking_load_source` alanında yazılıdır.

Çalıştırma:
    pip install pymupdf
    cd scripts/catalog-extract
    python ropes_guven.py
    python ropes_validate.py
"""
from __future__ import annotations

import re
import sys

import ropes_common as rc
from pdftable import assign

BASE_URL = "https://guvencelikhalat.com.tr/wp-content/uploads/2026/01/"

# Başlık bloğunun "(mm)" satırının KAÇ PUNTO üstünden başladığı. Sınıf satırı
# ("1770 N/mm²") ve "Minimum Kopma Kuvveti" başlığı bu bandın içindedir.
HEAD_UP = 30
# Başlık satırının hemen altındaki gövde başlangıcı. DRAKO föylerinde sınıf
# etiketleri "(mm)" satırının 5 punto ALTINDADIR; bant iki yöne de açıktır.
HEAD_DOWN = 9

NUM_RE = re.compile(r"^\d{1,3}(?:\.\d{3})+(?:,\d+)?$")
NUM_TYPO_RE = re.compile(r"^(\d{1,3}(?:\.\d{3})+)\.(\d+)$")


def num_kat(tok):
    """Katalog sayısı — NOKTA BİNLİK, VİRGÜL ONDALIK.

    '1.727' → 1727 · '254,0' → 254.0 · '83,70' → 83.7 · '-' → None

    Ayrıca DIEPA ML5'te iki satırda görülen dizgi hatasını çözer: '9.264.0'
    binlik ayraçlı 9264'ün ardına nokta+basamak eklenmiş hâlidir (komşu
    satırlar 8.974 ve 9.337); son grup ondalık sayılır, atılmaz.
    """
    if tok is None:
        return None
    t = str(tok).strip().replace("–", "-").replace("−", "-")
    t = t.replace(" ", "").replace("\xa0", "")
    if t in ("", "-", "–", "—", "*"):
        return None
    m = NUM_TYPO_RE.fullmatch(t)
    if m:
        t = m.group(1).replace(".", "") + "." + m.group(2)
    elif NUM_RE.fullmatch(t):
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def pick(cells, role, parser):
    """Roldeki İLK SAYISAL kelime.

    `cell_text` gibi ilk kelimeyi almak yetmez: "Talebe göre imalatı
    yapılmaktadır." bandı satırın sağ yarısına yayılır ve kelimeleri en yakın
    çapaya düşer. Sayı olmayan kelimeyi atlamak, o satırların ağırlığını
    sessizce düşürmekten iyidir.
    """
    for _, tok in cells.get(role, []):
        v = parser(tok)
        if v is not None:
            return v
    return None


def tables_of(page, plan):
    """Sayfadaki tabloları (çapalar, gövde y0, gövde y1) olarak döndürür.

    Tablo, içinde "(mm)" geçen başlık satırından bulunur. Bir sayfada birden
    çok tablo olabilir (OLIVEIRA ZINCAL COMPACT: kendir özlü ve çelik özlü
    tabloları alt alta basılıdır).
    """
    rows = rc.rows_of(rc.words(page))
    heads = [y for y, row in rows if any(w[4] == "(mm)" for w in row)]
    if not heads:
        return []
    tokens = [t for t, _ in plan]
    out = []
    for i, hy in enumerate(heads):
        band = [w for y, row in rows if hy - HEAD_UP <= y <= hy + HEAD_DOWN
                for w in row if w[4] in tokens]
        band.sort(key=lambda w: w[0])
        got = [w[4] for w in band]
        if got != tokens:
            sys.exit(f"başlık düzeni beklenenden farklı:\n  beklenen {tokens}\n  bulunan  {got}")
        anchors = [(role, w[0]) for w, (_, role) in zip(band, plan)]
        y1 = heads[i + 1] - HEAD_UP if i + 1 < len(heads) else page.rect.height
        out.append((anchors, hy + HEAD_DOWN + 1, y1))
    return out


def body_rows(page, anchors, y0, y1):
    """Gövde satırları: (ham metin, rol → [(x, kelime)])."""
    ws = [w for w in rc.words(page) if y0 <= w[1] < y1]
    out = []
    for _, row in rc.rows_of(ws):
        text = " ".join(w[4] for w in row)
        out.append((text, assign(row, anchors)))
    return out


# =============================================================== TABLO TANIMI
# Her tanım BİR PDF tablosudur. `plan` başlık kelimelerini SOLDAN SAĞA rollere
# bağlar; okuyucu bu diziyi birebir doğrular, tutmazsa durur. İlgilenilmeyen
# sütunlar da ("kp", "Ibs", "ton") çapalanır — yoksa oradaki sayılar komşu
# sütuna kayardı.

A3 = [("(mm)", "mm"), ("(inç)", "inch"),
      ("(kN)", "kN0"), ("(kp)", "_"), ("(Ibs)", "_"),
      ("(kN)", "kN1"), ("(kp)", "_"), ("(Ibs)", "_"),
      ("(kN)", "kN2"), ("(kp)", "_"), ("(Ibs)", "_"),
      ("(kg/100", "w100")]

OLI2 = [("(mm)", "mm"), ("(inç)", "inch"),
        ("(kN)", "kN0"), ("(ton)", "_"), ("(Ibs)", "_"), ("(ton,", "_"),
        ("(kN)", "kN1"), ("(ton)", "_"), ("(Ibs)", "_"), ("(ton,", "_"),
        ("(kg/m)", "w1"), ("(Ib/ft)", "_")]

UNION_PLAN = [("(mm)", "mm"), ("(inç)", "inch"), ("(kN)", "kN0"),
              ("(ton)", "_"), ("(kg/m)", "w1"), ("(Ib/ft)", "_")]

# DIEPA MB/MX/ML — ürün başına (kN, Ibs, kg/100 m) üçlüsü.
def product_plan(n):
    plan = [("(mm)", "mm"), ("(inç)", "inch")]
    for i in range(n):
        plan += [("(kN)", f"kN{i}"), ("(Ibs)", "_"), ("(kg/100", f"w100_{i}")]
    return plan


# Ürün ortak alanları: kısaltmalar tanımları okunur tutar.
def prod(key, series, core, cols, weight, app, notes, **extra):
    """Bir ürün: dosya anahtarı, seri (= konstrüksiyon), öz kodu, sınıf→kN eşlemesi.

    Dosya adı seri dizgisinden TÜRETİLMEZ, burada AÇIKÇA verilir: seri adı
    konstrüksiyonu anlatır ("5xK12/5xK19/5xK26/5xK31 (LP 5)") ve ondan üretilen
    ad hem uzun hem kırılgan olurdu — seriye bir konstrüksiyon eklendiğinde
    dosya adı değişir, seed sırası kayar ve migration gereksiz yere farklanırdı.
    """
    return dict(key=key, series=series, core=core, cols=cols, weight=weight,
                application=app, notes=notes, **extra)


DIEPA_TABLES = [
    dict(pdf="DIEPA-X-53-X-50.pdf", url="DIEPA-X-53-X-50.pdf", pages=[1, 2, 3, 4],
         plan=A3, printed="s.2-5", brand="DIEPA",
         products=[
             prod("diepa_x_53", "8 demetli (X 53)", "IWRC-PC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "Halat özünün çevresi poliamid-12 ile kaplanmıştır (X 53). Dönme "
                  "direncinin gerekli olmadığı yerlerde kullanılır (ikili vinç sistemi, "
                  "düşük kaldırma yüksekliği); demir çelik, konteyner, yüzer platform ve "
                  "güverte vinçleri ile kule/mobil vinçler. Kepçe açma-kapama halatı "
                  "olarak da geçer. FIRDÖNDÜ İLE KULLANILMAZ. Düz/çapraz ve sağ/sol "
                  "sarım seçeneği vardır. Ortalama dolgu faktörü 0,675; kategori (RCN) "
                  "çap bandına göre: 04 → 4-14 mm · 09 → 15-44 mm · 13 → 45-100 mm. "
                  "X 53 ile X 50 aynı tabloyu paylaşır; fark yalnız özün plastik "
                  "ceketidir. KATALOG DİZGİ HATASI: 2 1/2 inç (63,5 mm) satırında kopma "
                  "kuvveti 1770 N/mm² için 3.126 kN basılmıştır ve bir alt çaptan (63 mm "
                  "→ 3.165 kN) küçüktür; aynı satırın kp değeri (327.060 kp ≈ 3.207 kN) "
                  "doğru sıralanır. BASILI DEĞER KORUNMUŞTUR, düzeltilmemiştir.",
                  rotation_resistant=False, outer_strands=8),
             prod("diepa_x_50", "8 demetli (X 50)", "IWRC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "X 53'ün plastik ceketsiz özlü kardeşi; tablo değerleri aynıdır. "
                  "Dönme direncinin gerekli olmadığı yerlerde kullanılır. FIRDÖNDÜ İLE "
                  "KULLANILMAZ. Ortalama dolgu faktörü 0,675.",
                  rotation_resistant=False, outer_strands=8),
         ]),
    dict(pdf="DIEPA-PZ-299-Z-299.pdf", url="DIEPA-PZ-299-Z-299.pdf", pages=[1, 2],
         plan=A3, printed="s.2-3", brand="DIEPA",
         products=[
             prod("diepa_pz_299", "6 demetli kompakt (PZ 299)", "IWRC-PC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "Halat özünün çevresi plastikle kaplanmıştır (PZ 299). Dış demetler "
                  "kompakt yapıdadır. Dönme direnci YOKTUR, fırdöndü ile kullanılmaz; "
                  "demir çelik ve konteyner vinçlerinde, kepçe açma-kapama halatı olarak "
                  "kullanılır. Yalnız çapraz sarım. Ortalama dolgu faktörü 0,6526; RCN "
                  "01 → 4-6 mm · 09 → 7-60 mm. KATALOG DİZGİ HATASI: yapım faktörü "
                  "listesinde 2160 N/mm² satırı '1960' basılmıştır; düzeltilmemiştir.",
                  rotation_resistant=False, compacted=True, outer_strands=6),
             prod("diepa_z_299", "6 demetli kompakt (Z 299)", "IWRC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "PZ 299'un plastik ceketsiz özlü kardeşi; tablo değerleri aynıdır. "
                  "Dış demetler kompakt yapıdadır, dönme direnci yoktur.",
                  rotation_resistant=False, compacted=True, outer_strands=6),
         ]),
    dict(pdf="DIEPA-MX-4.pdf", url="DIEPA-MX-4.pdf", pages=[1, 2, 3],
         plan=product_plan(3), printed="s.2-4", brand="DIEPA",
         products=[
             prod("diepa_mx_4", "8 demetli (MX4)", "IWRC", [(1960, "kN0")], "w100_0", "Madencilik",
                  "Tamburlu kuyularda denge ve taşıyıcı halat; yer üstü madenciliğinde "
                  "dragline hoist/drag ve elektrikli ekskavatör hoist halatı. Dönmeye "
                  "karşı dayanıklı DEĞİLDİR. Plastik dolgulu veya dolgusuz üretilebilir. "
                  "Ortalama dolgu faktörü 0,6226 · yapım faktörü 0,845. MX serisinin üç "
                  "ürünü (MX4/MX5/MX6) tek tabloda basılıdır.",
                  rotation_resistant=False, outer_strands=8),
             prod("diepa_mx_5", "8 demetli kompakt (MX5)", "IWRC", [(1960, "kN1")],
                  "w100_1", "Madencilik",
                  "MX serisinin kopma kuvveti ile uzun ömrü DENGELENMİŞ ürünü; kullanım "
                  "alanı MX4 ile aynıdır. Dış demetler kompakt yapıdadır, dönmeye karşı "
                  "dayanıklı değildir. Ortalama dolgu faktörü 0,6750 · yapım faktörü "
                  "0,85; RCN 04 → 12-14 mm · 09 → 15-44 mm · 13 → 45-100 mm.",
                  rotation_resistant=False, compacted=True, outer_strands=8),
             prod("diepa_mx_6", "8 demetli kompakt (MX6)", "IWRC", [(1960, "kN2")],
                  "w100_2", "Madencilik",
                  "MX serisinin KOPMA KUVVETİ İÇİN ENİYİLENMİŞ, zorlu koşullar için "
                  "geliştirilmiş ürünü; kullanım alanı MX4 ile aynıdır. Dış demetleri ve "
                  "özü kompakt yapıdadır, dönmeye karşı dayanıklı değildir. Ortalama "
                  "dolgu faktörü 0,6226 · yapım faktörü 0,845.",
                  rotation_resistant=False, compacted=True, outer_strands=8),
         ]),
    dict(pdf="DIEPA-MB-4.pdf", url="DIEPA-MB-4.pdf", pages=[1, 2, 3],
         plan=product_plan(4), printed="s.2-4", brand="DIEPA",
         products=[
             prod("diepa_mb_4", "15 demetli (MB4)", "IWRC", [(1960, "kN0")], "w100_0", "Madencilik",
                  "450 metreden derin kuyu madenciliğinde denge ve taşıyıcı halat. "
                  "Dönmeye karşı dayanıklıdır. Dış demetler kompakt DEĞİLDİR. Ortalama "
                  "dolgu faktörü 0,6511 · yapım faktörü 0,78. MB serisinin dört ürünü "
                  "(MB4-MB7) tek tabloda basılıdır.",
                  rotation_resistant=True, compacted=False, outer_strands=15),
             prod("diepa_mb_5", "15 demetli kompakt (MB5)", "IWRC", [(1960, "kN1")], "w100_1",
                  "Madencilik",
                  "Dönmeye karşı dayanıklı, dış demetleri KOMPAKT kuyu madenciliği "
                  "halatı. Ortalama dolgu faktörü 0,7145 · yapım faktörü 0,835.",
                  rotation_resistant=True, compacted=True, outer_strands=15),
             prod("diepa_mb_6", "15 demetli kompakt (MB6)", "IWRC", [(1960, "kN2")],
                  "w100_2", "Madencilik",
                  "Yüksek kopma kuvvetli, DIŞ DEMETLERİ VE ÖZÜ kompakt ürün; kullanım "
                  "alanı MB4 ile aynıdır. Dönmeye karşı dayanıklıdır. Ortalama dolgu "
                  "faktörü 0,7357 · yapım faktörü 0,845. ÇAP BANDI 15-70 mm'dir "
                  "(MB4/MB5 120 mm'ye kadar gider); tablonun üst satırlarında MB6 "
                  "sütunu 'Talebe göre imalatı yapılmaktadır.' der.",
                  rotation_resistant=True, compacted=True, outer_strands=15),
             prod("diepa_mb_7", "15 demetli kompakt (MB7)", "IWRC", [(1960, "kN3")],
                  "w100_3", "Madencilik",
                  "MB serisinin KOPMA KUVVETİ İÇİN ENİYİLENMİŞ ürünü; dış demetleri ve "
                  "özü kompakttır, dönmeye karşı dayanıklıdır. Ortalama dolgu faktörü "
                  "0,7550 · yapım faktörü 0,845. ÇAP BANDI 15-70 mm'dir.",
                  rotation_resistant=True, compacted=True, outer_strands=15),
         ]),
    dict(pdf="DIEPA-ML-4.pdf", url="DIEPA-ML-4.pdf", pages=[1, 2, 3],
         plan=product_plan(2), printed="s.2-4", brand="DIEPA",
         products=[
             prod("diepa_ml_4", "10 demetli (ML4)", "IWRC", [(1960, "kN0")], "w100_0", "Madencilik",
                  "Tamburlu kuyularda denge ve taşıyıcı halat; dragline hoist/drag ve "
                  "elektrikli ekskavatör hoist halatı. Dönmeye karşı DİRENÇLİ DEĞİLDİR. "
                  "Dış demetler kompakt değildir. Plastik dolgulu veya dolgusuz "
                  "üretilebilir. Uzun ömür için 10 demetli olarak eniyilenmiştir. "
                  "Ortalama dolgu faktörü 0,6601 · yapım faktörü 0,85.",
                  rotation_resistant=False, compacted=False, outer_strands=10),
             prod("diepa_ml_5", "10 demetli kompakt (ML5)", "IWRC", [(1960, "kN1")],
                  "w100_1", "Madencilik",
                  "ML serisinin dış demetleri KOMPAKT ürünü; kullanım alanı ML4 ile "
                  "aynıdır. Ortalama dolgu faktörü 0,6940 · yapım faktörü 0,84. KATALOG DİZGİ HATASI: 4 inç ve 102 mm satırlarında kopma "
                  "kuvveti '9.264.0' / '9.337.0' basılmıştır (binlik ayracının ardına "
                  "nokta+basamak); 9264 ve 9337 kN olarak okunmuştur.",
                  rotation_resistant=False, compacted=True, outer_strands=10),
         ]),
    dict(pdf="DIEPA-B-55-1.pdf", url="DIEPA-B-55-1.pdf", pages=[1, 2, 3, 4],
         plan=A3, printed="s.2-5", brand="DIEPA",
         products=[
             prod("diepa_b_55", "18 demetli (B 55)", "IWRC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "Dönme direnci ve yüksek kopma mukavemeti gereken tüm vinçlerde; "
                  "özellikle offshore, güverte ve deniz ortamı için uygundur. FIRDÖNDÜ "
                  "İLE KULLANILMALIDIR. Düz/çapraz ve sağ/sol sarım seçeneği vardır. "
                  "Ortalama dolgu faktörü 0,7145; RCN 23-2 → 4-49 mm · 27 → 50-99 mm · "
                  "31 → 100-120 mm.",
                  rotation_resistant=True, outer_strands=18),
         ]),
    dict(pdf="DIEPA-C-45-1.pdf", url="DIEPA-C-45-1.pdf", pages=[1, 2],
         plan=A3, printed="s.2-3", brand="DIEPA",
         products=[
             prod("diepa_c_45", "15 demetli (C 45)", "IWRC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Vinç",
                  "Kule vinç, mobil vinç ve paletli vinç gibi dönme dayanımı gereken tüm "
                  "kaldırma sistemlerinde; offshore ve güverte vinçlerinde de uygundur. "
                  "FIRDÖNDÜ İLE KULLANILMALIDIR. Ortalama dolgu faktörü 0,6441; RCN 23-2, "
                  "154 tel (6-7 mm) / 186 tel (8-40 mm), 105 dış tel.",
                  rotation_resistant=True, outer_strands=15),
         ]),
    dict(pdf="DIEPA-K-43-1.pdf", url="DIEPA-K-43-1.pdf", pages=[1],
         plan=A3, printed="s.2", brand="DIEPA",
         products=[
             prod("diepa_k_43", "15 demetli (K 43)", "IWRC",
                  [(1770, "kN0"), (1960, "kN1"), (2160, "kN2")], "w100", "Sondaj",
                  "Zemin makinelerinde kelly halatı olarak kullanılır. FIRDÖNDÜ İLE "
                  "KULLANILMALIDIR. Ortalama dolgu faktörü 0,685 · yapım faktörü 0,83 "
                  "(1960 N/mm²); RCN 23-2, çap bandı 18-46 mm. 2160 N/mm² sütunu "
                  "'Talebe göre imalatı yapılmaktadır.' der, değer basılmamıştır — o "
                  "sınıfta satır YOKTUR.",
                  rotation_resistant=True, outer_strands=15),
         ]),
    dict(pdf="DIEPA-S-67-WP.pdf", url="DIEPA-S-67-WP.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1770", "kN0"), ("(kg/100", "w100")],
         printed="s.1", brand="DIEPA",
         products=[
             prod("diepa_s_67_wp", "Plastik dolgulu galvaniz (S 67 WP)", "IWRC-PI",
                  [(1770, "kN0")], "w100", "Taş kesme",
                  "Galvaniz kaplı, plastik dolgulu ince halat. Üzerine endüstriyel "
                  "boncuk dizilerek ya da plastik enjeksiyonla kaplanarak sert taş, "
                  "mermer, kum taşı ve beton kesme uygulamalarında kullanılır. Vinç "
                  "kaldırma halatı DEĞİLDİR.",
                  ),
         ]),
]

OLIVEIRA_TABLES = [
    dict(pdf="OLIVEIRA-NR-MAXIPACT-PPI-urun.pdf", url="OLIVEIRA-NR-MAXIPACT-PPI-urun.pdf",
         pages=[1], plan=OLI2, printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         products=[
             prod("oliveira_nr_maxipact_ppi", "37xK7/37xK19/37xK26 (NR Maxipact PPI)", "IWRC-PPI",
                  [(1960, "kN0"), (2160, "kN1")], "w1", "Vinç",
                  "18 dış demetli, dönmeye dirençli, plastik enjeksiyonlu (PPI) halat. "
                  "Dönme direnci ve yüksek kopma mukavemeti gereken tüm vinçlerde, "
                  "özellikle offshore ve güverte vinçlerinde; deniz ortamına uygundur. "
                  "FIRDÖNDÜ İLE KULLANILMALIDIR. Kategori (RCN) çap bandına göre: 23-3 → "
                  "12,7-52 mm (37xK7) · 30 → 54-64 mm (37xK19) · 31 → 66-70 mm (37xK26). "
                  "PPI seçeneği yalnız 13 mm üstü çaplarda; PPI'lı halatta ağırlık %1 "
                  "artar. Kullanım sıcaklığı -50…100 °C (PPI'da -50…80 °C).",
                  rotation_resistant=True, compacted=True, outer_strands=18),
         ]),
    dict(pdf="OLIVEIRA-NR15-MAXILIFT-PPI-urun.pdf", url="OLIVEIRA-NR15-MAXILIFT-PPI-urun.pdf",
         pages=[1], plan=OLI2, printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         products=[
             prod("oliveira_nr15_maxilift_ppi", "31xK7/34xK7 (NR15 Maxilift PPI)", "IWRC-PPI",
                  [(1960, "kN0"), (2160, "kN1")], "w1", "Vinç",
                  "15 dış demetli, dönmeye dirençli, plastik enjeksiyonlu (PPI) halat. "
                  "Ağır yük kaldırma, korozif ortam ve yoğun kullanım için; mobil, kule "
                  "ve paletli vinçlerde sıklıkla, offshore ve güverte vinçlerinde "
                  "önerilir. FIRDÖNDÜ İLE KULLANILMALIDIR. RCN 23-2: 10-28,58 mm (31xK7, "
                  "dolgu faktörü 0,7010) · 30-50,80 mm (34xK7, 0,7050). PPI seçeneği "
                  "yalnız 13 mm üstü çaplarda; PPI'lı halatta ağırlık %1 artar.",
                  rotation_resistant=True, compacted=True, outer_strands=15),
         ]),
    dict(pdf="OLIVEIRA-TOWERLIFT-15-urun.pdf", url="OLIVEIRA-TOWERLIFT-15-urun.pdf",
         pages=[1], plan=OLI2, printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         products=[
             prod("oliveira_towerlift_15", "27x7/31x7 (Towerlift 15)", "IWRC",
                  [(1960, "kN0"), (2160, "kN1")], "w1", "Vinç",
                  "15 dış demetli dönmeye dirençli halat. Kule vinç, mobil vinç ve "
                  "paletli vinç gibi dönme dayanımı gereken tüm kaldırma sistemlerinde; "
                  "offshore ve güverte vinçlerinde de uygundur. FIRDÖNDÜ İLE "
                  "KULLANILMALIDIR. RCN 23-2: 8-21 mm (27x7, dolgu faktörü 0,6480) · "
                  "22-50,80 mm (31x7, 0,6600). Kullanım sıcaklığı -50…100 °C.",
                  rotation_resistant=True, outer_strands=15),
         ]),
    dict(pdf="OLIVEIRA-LP-5.pdf", url="OLIVEIRA-LP-5.pdf", pages=[1],
         # İlk (kN, ton) çifti HESAPLANAN, ikincisi MİNİMUM kopma kuvvetidir;
         # seçim minimum değere göre yapılır, hesaplanan sütunlar okunmaz.
         plan=[("(mm)", "mm"), ("(mm2)", "area"),
               ("(kN)", "_"), ("(ton)", "_"), ("(kN)", "_"), ("(ton)", "_"),
               ("(kN)", "kN0"), ("(ton)", "_"), ("(kN)", "kN1"), ("(ton)", "_"),
               ("(kg/m)", "w1")],
         printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         products=[
             prod("oliveira_lp_5", "5xK12/5xK19/5xK26/5xK31 (LP 5)", "IWRC",
                  [(1960, "kN0"), (2160, "kN1")], "w1", "Platform",
                  "5 demetli kompakt halat. Asılı erişim sistemleri ve platformlarda, "
                  "triforlarda, asma iskele vinçlerinde ve elektrikli kaldırma "
                  "vinçlerinde; ayrıca rüzgâr gülü ve tomruk çekme vinçlerinde. RCN "
                  "02 → 6 mm (5xK12-CWP) · 03 → 8,3-10,3 mm (5xK19-CF) · 05 → 11,5-14 mm "
                  "(5xK26-CF) · 06 → 16,3 mm (5xK31-CF). Katalog hem HESAPLANAN hem "
                  "MİNİMUM kopma kuvvetini basar; buraya MİNİMUM alınmıştır. Kullanım "
                  "sıcaklığı -50…100 °C.",
                  compacted=True, outer_strands=5),
         ]),
    dict(pdf="OLIVEIRA-SUPER-YELLOW-FIN-KENDIR-OZLU-urun.pdf",
         url="OLIVEIRA-SUPER-YELLOW-FIN-KENDIR-OZLU-urun.pdf", pages=[1],
         plan=[("(mm)", "mm"), ("(ton)", "t0"), ("(kg/m)", "w1")],
         printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         products=[
             prod("oliveira_super_yellow_fin", "6xK19 S · 6xK26 WS (Super Yellow Fin)", "FC",
                  [(1570, "t0")], "w1", "Balıkçılık",
                  "Kendir özlü, kompakt demetli gırgır halatı; trol balıkçılığında da "
                  "kullanılır. Konstrüksiyon çap bandına göre değişir: 14-26 mm 6xK19 S "
                  "(114 dış tel) · 28-36 mm 6xK26 WS (156 dış tel). Kopma kuvveti "
                  "katalogda yalnız METRİK TON olarak basılıdır; 9,80665 ile kN'a "
                  "çevrilmiştir. Vinç kaldırma halatı DEĞİLDİR.",
                  compacted=True, outer_strands=6, ton=True),
         ]),
    dict(pdf="OLIVEIRA-ZINCAL-COMPACT-urun.pdf", url="OLIVEIRA-ZINCAL-COMPACT-urun.pdf",
         pages=[1], plan=[("(mm)", "mm"), ("(ton)", "t0"), ("(kg/m)", "w1")],
         printed="s.2", brand="OLIVEIRA", weight_unit="kg/m",
         # Sayfada İKİ tablo vardır: üstteki kendir özlü (19-36 mm), alttaki
         # çelik özlü (20-44 mm). Sıra sayfadaki BAŞLIK sırasının TERSİDİR;
         # ayrım çap bandından doğrulanır (föyün 1. sayfası bandı basar).
         products=[
             prod("oliveira_zincal_compact_fc", "6xK26 WS (Zincal Compact, kendir özlü)", "FC",
                  [(1570, "t0")], "w1", "Balıkçılık",
                  "Galvaniz kaplı, kompakt demetli gırgır halatı. Çap bandı 19-36 mm, "
                  "156 dış tel. Kopma kuvveti katalogda yalnız METRİK TON olarak "
                  "basılıdır; 9,80665 ile kN'a çevrilmiştir. Vinç kaldırma halatı "
                  "DEĞİLDİR.",
                  compacted=True, outer_strands=6, ton=True, table=0),
             prod("oliveira_zincal_compact_iwrc", "6xK26 WS (Zincal Compact, çelik özlü)", "IWRC",
                  [(1570, "t0")], None, "Balıkçılık",
                  "Galvaniz kaplı, kompakt demetli gırgır halatı; çelik özlü. Çap bandı "
                  "20-44 mm, 156 dış tel. KATALOG HATASI: bu tablonun 'Ağırlık (kg/m)' "
                  "sütununa kopma kuvvetinin kg karşılığı basılmıştır (20 mm satırında "
                  "28,75 t karşısında '28.720'); metre ağırlığı bu üründe YOKTUR, "
                  "tahmin edilmemiştir. Kopma kuvveti metrik tondan 9,80665 ile kN'a "
                  "çevrilmiştir.",
                  compacted=True, outer_strands=6, ton=True, table=1),
         ]),
]

UNION_TABLES = [
    dict(pdf="UNION-POWERMAX-PFV-urun.pdf", url="UNION-POWERMAX-PFV-urun.pdf",
         pages=[1], plan=UNION_PLAN, printed="s.2", brand="UNION", weight_unit="kg/m",
         products=[
             prod("union_powermax_pfv", "8 demetli plastik kaplı (Powermax PFV)", "IWRC-PC",
                  [(None, "kN0")], "w1", "Madencilik",
                  "Yer üstü madenciliğinde dragline örtü kazı makinelerinde hoist ve "
                  "drag halatı. Dış yüzeyi plastik polimerle kaplanmıştır (PFV): iç "
                  "stresi dağıtır, parçacık girişini engeller, yağı içeride tutar. "
                  "Üretim bandı 60,3 mm (2 3/8\") - 127 mm (5\"). MUKAVEMET SINIFI "
                  "KATALOGDA BASILI DEĞİLDİR.",
                  outer_strands=8),
         ]),
    dict(pdf="UNION-6-STRAND-PFV-urun.pdf", url="UNION-6-STRAND-PFV-urun.pdf",
         pages=[1], plan=UNION_PLAN, printed="s.2", brand="UNION", weight_unit="kg/m",
         products=[
             prod("union_6_strand_pfv", "6 demetli plastik kaplı (6-Strand PFV)", "IWRC-PC",
                  [(None, "kN0")], "w1", "Madencilik",
                  "Yer üstü madenciliğinde dragline örtü kazı makinelerinde hoist ve "
                  "drag halatı. PFV polimer kap içsel sürtünmeleri dağıtır ve yağın "
                  "dışarı sızmasını önler. Üretim bandı 44,5 mm (1 3/4\") - 127 mm (5\"). "
                  "MUKAVEMET SINIFI KATALOGDA BASILI DEĞİLDİR.",
                  outer_strands=6),
         ]),
    dict(pdf="UNION-TUF-MAX-urun.pdf", url="UNION-TUF-MAX-urun.pdf",
         pages=[1], plan=UNION_PLAN, printed="s.2", brand="UNION", weight_unit="kg/m",
         products=[
             prod("union_tuf_max", "Çift kaplamalı özlü (Tuf-Max)", "IWRC-PC",
                  [(None, "kN0")], "w1", "Madencilik",
                  "Yer üstü madenciliğinde elektrikli ekskavatör makinelerinde hoist "
                  "halatı. Standart 6 demetli halatlara göre yorulma direnci yüksektir; "
                  "çift kaplamalı öz içsel kırıkları en aza indirir. Üretim bandı "
                  "50,8 mm (2\") - 73 mm (2 7/8\"). MUKAVEMET SINIFI KATALOGDA BASILI "
                  "DEĞİLDİR.",
                  ),
         ]),
    dict(pdf="UNION-FLEX-X-9-urun.pdf", url="UNION-FLEX-X-9-urun.pdf",
         pages=[0], plan=[("(mm)", "mm"), ("(inç)", "inch"), ("(kN)", "kN0"),
                          ("(lbs)", "_"), ("(kg/m)", "w1"), ("(lb/ft)", "_")],
         printed="s.1", brand="UNION", weight_unit="kg/m",
         products=[
             prod("union_flex_x_9", "9 demetli dövme (Flex X-9)", "IWRC",
                  [(1770, "kN0")], "w1", "Sondaj",
                  "Sondaj makinelerinin tambur halatı. Ekstra mukavemetli ve aşınmaya "
                  "dirençlidir; halat içindeki boşluk en azdır, yüzey alanı geniştir. "
                  "Dövme (swaged) yapıda üretilir.",
                  swaged=True, outer_strands=9),
         ]),
    dict(pdf="UNION-3xK7-urun.pdf", url="UNION-3xK7-urun.pdf",
         pages=[0], plan=[("(mm)", "mm"), ("(inç)", "inch"), ("(kN)", "kN0"),
                          ("(lbs)", "_"), ("(kg/m)", "w1"), ("(lb/ft)", "_")],
         printed="s.1", brand="UNION", weight_unit="kg/m",
         products=[
             prod("union_3xk7", "3xK7 dövme (3xK7)", "IWRC",
                  [(1770, "kN0")], "w1", "Sondaj",
                  "Sondaj makinelerinde numune alma işlemlerinde kullanılır. Dönmeye "
                  "karşı dirençlidir, yüzey alanı/ağırlık oranı ve sürtünme dayanımı "
                  "yüksektir. Dövme (swaged) yapıda üretilir.",
                  rotation_resistant=True, swaged=True, compacted=True, outer_strands=3),
         ]),
]

# --------------------------------------------------------------------- DRAKO
# DRAKO föylerinin tamamı ASANSÖR halatıdır (askı · regülatör · denge). Vinç
# kaldırma halatı değildirler; `typical_application` bunu her satırda söyler.
DRAKO_LIFT = ("Asansör sistemlerinde askı halatı olarak kullanılır. VİNÇ KALDIRMA "
              "HALATI DEĞİLDİR.")

DRAKO_TABLES = [
    dict(pdf="DRAKO-300-T-urun.pdf", url="DRAKO-300-T-urun.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("Kompozisyonu", "comp"), ("(1570", "kN0"),
               ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_300_t", "9 demetli (300 T)", "IWRC", [(1570, "kN0")], "w100", "Asansör",
                  "Yüksek ve çok yüksek hızlı asansör sistemlerinde askı halatı. "
                  "9 damarlı yapısı sayesinde daha ovaldir, yivlere daha çok noktadan "
                  "basar. Ön şekillendirilmiş ve öngermelidir; talebe göre siyah ya da "
                  "galvanizli üretilir. Damar konstrüksiyonu çapa göre değişir ve her "
                  "satırda basılıdır (9x19 S · 9x21 F · 9x25 F · 9x26 WS). KATALOG "
                  "DİZGİ HATASI: Ø16 satırında konstrüksiyon 'IWCR' basılmıştır, "
                  "'IWRC' okunmuştur. " + DRAKO_LIFT,
                  per_row_composition=True, outer_strands=9),
         ]),
    dict(pdf="DRAKO-250-T-urun.pdf", url="DRAKO-250-T-urun.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(1770", "kN1"),
               ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_250_t", "8x19 W (250 T)", "IWRC", [(1570, "kN0"), (1770, "kN1")], "w100",
                  "Asansör",
                  "Orta hızlı asansör sistemlerinde askı halatı. 6-8 mm aralığında TÜV "
                  "Süd onaylıdır (CA 067); 8 mm'ye kadar çok düşük D/d oranında "
                  "çalışabilir. Ön şekillendirilmiş ve öngermelidir; siyah ve sağ çapraz "
                  "sarımlıdır. " + DRAKO_LIFT,
                  outer_strands=8),
         ]),
    dict(pdf="DRAKO-210-TF.pdf", url="DRAKO-210-TF.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_210_tf", "8x19 W (210 TF)", "IWRC", [(1570, "kN0")], "w100", "Asansör",
                  "Orta hızlı asansör sistemlerinde askı halatı. Halat özü kendir ve "
                  "çelik tel karışımıdır. Ön şekillendirilmiş ve öngermelidir (orta "
                  "derece); siyah ve sağ çapraz sarımlıdır. " + DRAKO_LIFT,
                  outer_strands=8),
         ]),
    dict(pdf="DRAKO-210-TFS.pdf", url="DRAKO-210-TFS.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_210_tfs", "8x19 S (210 TFS)", "IWRC", [(None, "kN0")], "w100", "Asansör",
                  "Orta hızlı asansör sistemlerinde askı halatı. Halat özü kendir ve "
                  "çelik tel karışımıdır. " + DRAKO_LIFT,
                  grade_label="1570 N/mm² ve 1370/1770 N/mm²", outer_strands=8),
         ]),
    dict(pdf="DRAKO-8x19-S-FC.pdf", url="DRAKO-8x19-S-FC.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_8x19_s_fc", "8x19 S (8x19 S-FC)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "Düşük hızlı asansör sistemlerinde askı halatı. Elyaf özlüdür. "
                  "6 damarlı halata göre yüzey alanı yivlere daha fazla temas eder. "
                  + DRAKO_LIFT,
                  grade_label="1570 N/mm² ve 1370/1770 N/mm²", outer_strands=8),
         ]),
    dict(pdf="DRAKO-8x19-W-FC.pdf", url="DRAKO-8x19-W-FC.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_8x19_w_fc", "8x19 W (8x19 W-FC)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "Düşük hızlı asansör sistemlerinde askı halatı. Elyaf özlüdür. "
                  + DRAKO_LIFT,
                  grade_label="1570 N/mm² ve 1370/1770 N/mm²", outer_strands=8),
         ]),
    dict(pdf="DRAKO-8x25-F-FC.pdf", url="DRAKO-8x25-F-FC.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1570", "kN0"), ("(mm2)", "area"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_8x25_f_fc", "8x25 F (8x25 F-FC)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "Düşük hızlı asansör sistemlerinde askı halatı. Elyaf özlüdür. "
                  + DRAKO_LIFT,
                  grade_label="1570 N/mm² ve 1370/1770 N/mm²", outer_strands=8),
         ]),
    dict(pdf="DRAKO-6x19-S-6x19-W-8x19-S-urun.pdf",
         url="DRAKO-6x19-S-6x19-W-8x19-S-urun.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1370/1770", "kNa"), ("(1570", "kN0"),
               ("(1770", "kN1"), ("(1960", "kN2"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         # Tek sütun kümesi, satır aralarında konstrüksiyon başlıkları.
         section_re=r"^DRAKO\b",
         products=[
             prod("drako_reg_6x19_s_iwrc", "6x19 S (Regülatör)", "IWRC",
                  [(1570, "kN0"), (1770, "kN1"), (1960, "kN2")], "w100", "Asansör",
                  "Asansör sistemlerinde REGÜLATÖR halatı. Ön şekillendirilmiş ve "
                  "öngermelidir (orta derece); siyah veya galvanizli, sağ çapraz "
                  "sarımlıdır. VİNÇ KALDIRMA HALATI DEĞİLDİR. Katalogun '1370/1770 "
                  "N/mm²' sütunu bileşik bir tel dayanımı tanımıdır; o sütunun satırları "
                  "sınıfsız yazılır ve `grade_label` alanında basıldığı gibi taşınır.",
                  section="DRAKO 6x19 S - IWRC", compound=("1370/1770 N/mm²", "kNa"),
                  outer_strands=6),
             prod("drako_reg_8x19_s_fc", "8x19 S (Regülatör)", "FC",
                  [(1570, "kN0"), (1770, "kN1"), (1960, "kN2")], "w100", "Asansör",
                  "Asansör sistemlerinde REGÜLATÖR halatı, elyaf özlü. VİNÇ KALDIRMA "
                  "HALATI DEĞİLDİR.",
                  section="DRAKO 8x19 S - FC", compound=("1370/1770 N/mm²", "kNa"),
                  outer_strands=8),
             prod("drako_reg_6x19_s_fc", "6x19 S (Regülatör, elyaf öz)", "FC",
                  [(1570, "kN0"), (1770, "kN1"), (1960, "kN2")], "w100", "Asansör",
                  "Asansör sistemlerinde REGÜLATÖR halatı, elyaf özlü. VİNÇ KALDIRMA "
                  "HALATI DEĞİLDİR.",
                  section="DRAKO 6x19 S - FC", compound=("1370/1770 N/mm²", "kNa"),
                  outer_strands=6),
             prod("drako_reg_6x19_w_fc", "6x19 W (Regülatör, elyaf öz)", "FC",
                  [(1570, "kN0"), (1770, "kN1"), (1960, "kN2")], "w100", "Asansör",
                  "Asansör sistemlerinde REGÜLATÖR halatı, elyaf özlü. VİNÇ KALDIRMA "
                  "HALATI DEĞİLDİR.",
                  section="DRAKO 6x19 W - FC", compound=("1370/1770 N/mm²", "kNa"),
                  outer_strands=6),
         ]),
    dict(pdf="DRAKO-180-B.pdf", url="DRAKO-180-B.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1370/1770", "kN0"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO", section_re=r"^DRAKO\b",
         products=[
             prod("drako_180_b_6x25_f", "6x25 F (180 B)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "3 m/s hızı aşan asansör sistemlerinde DENGE halatı. Sentetik fiber "
                  "özlüdür, sessiz çalışır. Konstrüksiyon çapa göre değişir; bu ürün "
                  "13-22 mm bandındadır. VİNÇ KALDIRMA HALATI DEĞİLDİR.",
                  section="DRAKO 6x25 F - FC",
                  grade_label="1370/1770 veya 1570 N/mm²", outer_strands=6),
             prod("drako_180_b_6x36_ws", "6x36 WS (180 B)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "3 m/s hızı aşan asansör sistemlerinde DENGE halatı, 24-38 mm bandı. "
                  "Sentetik fiber özlüdür. VİNÇ KALDIRMA HALATI DEĞİLDİR.",
                  section="DRAKO 6x36 WS - FC",
                  grade_label="1370/1770 veya 1570 N/mm²", outer_strands=6),
         ]),
    dict(pdf="DRAKO-200-B.pdf", url="DRAKO-200-B.pdf", pages=[0],
         plan=[("(mm)", "mm"), ("(1370/1770", "kN0"), ("(kg/100", "w100")],
         printed="s.1", brand="DRAKO",
         products=[
             prod("drako_200_b", "8x25 F (200 B)", "FC", [(None, "kN0")], "w100", "Asansör",
                  "3 m/s hızı aşan asansör sistemlerinde DENGE halatı. Sentetik fiber "
                  "özlüdür, sessiz çalışır ve uzun servis ömrüne sahiptir. VİNÇ "
                  "KALDIRMA HALATI DEĞİLDİR.",
                  grade_label="1370/1770 veya 1570 N/mm²", outer_strands=8),
         ]),
]

TABLES = DIEPA_TABLES + OLIVEIRA_TABLES + UNION_TABLES + DRAKO_TABLES

EXTRA = ("diameter_inch", "steel_area_mm2", "grade_label", "composition",
         "rotation_resistant", "compacted", "swaged", "outer_strands",
         "breaking_load_source")

# Metrik ton → kN. Aynı yayıncının kN ve ton'u birlikte bastığı tablolarında
# oran birebir budur (OLIVEIRA NR MAXIPACT: 148,00 kN ↔ 15,09 t).
G = 9.80665


def rows_for(spec):
    """PDF'in gövde satırlarını KOVALARA ayırır → {kova anahtarı: [satır]}.

    Kova anahtarı iki biçimdedir:
      * `"#<tablo indisi>"` — olağan tablo; ürün `table` alanıyla seçer (bir
        sayfada birden çok tablo olabilir, OLIVEIRA ZINCAL COMPACT).
      * BÖLÜM BAŞLIĞININ METNİ — `section_re` verilen föylerde (DRAKO 180 B ve
        regülatör), satır aralarına serpiştirilmiş konstrüksiyon başlıkları.
    """
    doc = rc.open_src(spec["pdf"])
    section_re = re.compile(spec["section_re"]) if spec.get("section_re") else None
    buckets: dict[str, list] = {}
    for pno in spec["pages"]:
        page = doc[pno]
        tables = tables_of(page, spec["plan"])
        if not tables:
            sys.exit(f"{spec['pdf']} s.{pno + 1}: tablo bulunamadı")
        for ti, (anchors, y0, y1) in enumerate(tables):
            current = None
            for text, cells in body_rows(page, anchors, y0, y1):
                if section_re and section_re.match(text.strip()):
                    current = " ".join(text.split())
                    continue
                if section_re and current is None:
                    # İlk bölüm başlığından ÖNCE ölçülü bir satır varsa o satır
                    # hiçbir ürüne düşmez ve sessizce kaybolurdu. Başlık bandı
                    # kayarsa (`HEAD_DOWN`) tablonun tamamı böyle boşalır;
                    # sessiz kayıp yerine durulur.
                    if pick(cells, "mm", rc.num) is not None:
                        sys.exit(f"{spec['pdf']} s.{pno + 1}: bölüm başlığından "
                                 f"önce ölçülü satır var — {text.strip()[:60]}")
                    continue
                buckets.setdefault(current if section_re else f"#{ti}", []).append(cells)
    doc.close()
    return buckets


def build_items(spec, p, cells_list):
    items = []
    ton = p.get("ton", False)
    weight_unit = spec.get("weight_unit", "kg/100 m")
    for cells in cells_list:
        dia = pick(cells, "mm", rc.num)
        inch = rc.cell_join(cells, "inch")
        inch = rc.inch_label(inch) if inch else None
        if dia is None and inch:
            dia = rc.inch_to_mm(inch)
        if dia is None:
            continue
        weight = None
        if p["weight"]:
            w = pick(cells, p["weight"], num_kat)
            if w is not None:
                weight = round(w / 100, 4) if weight_unit == "kg/100 m" else w
        area = pick(cells, "area", num_kat)
        comp = rc.cell_join(cells, "comp") if p.get("per_row_composition") else None
        if comp:
            # Katalogun Ø16 satırındaki "IWCR" dizgi hatası; kod normalleştirilir.
            comp = " ".join(comp.split()).replace("IWCR", "IWRC")

        # Sınıf sütunları + (varsa) bileşik başlıklı sınıfsız sütun.
        columns = [(g, role, None) for g, role in p["cols"]]
        if p.get("compound"):
            label, role = p["compound"]
            columns.append((None, role, label))
        for grade, role, label in columns:
            raw = pick(cells, role, num_kat)
            if raw is None:
                continue
            load = round(raw * G, 1) if ton else raw
            it = {
                "diameter_mm": dia,
                "core_type": p["core"],
                "breaking_load_kN": load,
                "weight_kg_per_m": weight,
            }
            if grade is not None:
                it["grade_mpa"] = grade
            gl = label or p.get("grade_label")
            if gl:
                it["grade_label"] = gl
            if inch:
                it["diameter_inch"] = inch
            if area is not None:
                it["steel_area_mm2"] = area
            if comp:
                it["composition"] = comp
            if ton:
                it["breaking_load_source"] = "ton (metrik) × 9,80665"
            for k in ("rotation_resistant", "compacted", "swaged", "outer_strands"):
                if k in p:
                    it[k] = p[k]
            items.append(it)
    return dedupe(items, p["series"])


def dedupe(items, series):
    """Aynı çap+sınıf satırının TEKRARINI atar; DEĞERİ ÇELİŞEN tekrarda DURUR.

    Bu ailenin iki yerinde satır iki kez basılıdır ve ikisi de katalogun kendi
    dizgisidir, okuma hatası değil:

      · DIEPA B 55 — çok sayfalı tablonun SINIR satırı (Ø60 · Ø89 · Ø90) hem
        önceki yaprağın sonunda hem sonrakinin başında yer alır;
      · OLIVEIRA Super Yellow Fin — Ø30 satırı arka arkaya iki kez basılmıştır.

    Tekrar bırakılırsa katalogda aynı model iki ürün olarak görünür ve seçicide
    hangisinin tıklandığı belirsizleşir. Değerler AYNI olduğu sürece atmak
    güvenlidir; farklı olsalardı hangisinin doğru olduğuna burada karar
    verilemezdi, o yüzden betik durur.
    """
    seen: dict = {}
    out = []
    for it in items:
        key = (it["diameter_mm"], it.get("grade_mpa"), it.get("grade_label"),
               it["core_type"])
        prior = seen.get(key)
        if prior is None:
            seen[key] = it
            out.append(it)
        elif prior != it:
            sys.exit(f"{series}: Ø{key[0]} {key[1]} iki kez ve FARKLI "
                     f"basılmış: {prior} / {it}")
    return out


def build():
    total = 0
    for spec in TABLES:
        buckets = rows_for(spec)
        for p in spec["products"]:
            if p.get("section"):
                cells_list = buckets.get(p["section"])
                if cells_list is None:
                    sys.exit(f"{spec['pdf']}: '{p['section']}' bölümü bulunamadı "
                             f"(bulunanlar: {sorted(buckets)})")
            else:
                cells_list = buckets[f"#{p.get('table', 0)}"]
            items = build_items(spec, p, cells_list)
            if not items:
                sys.exit(f"{spec['pdf']} / {p['series']}: satır okunamadı")
            name = p["key"] + ".json"
            rc.write(name, {
                "brand": spec["brand"],
                "equipment_type": "rope",
                "series": p["series"],
                # Kullanım alanı ürünün TAMAMI için geçerlidir (föyün
                # "Uygulamalar" kutusu); seed onu her satıra dağıtır ve seçicinin
                # ilk süzgeç adımı olur. Bu ailede vinç kaldırma halatı olmayan
                # ürünler çoğunluktadır — asansör, madencilik, sondaj, balıkçılık.
                "typical_application": p["application"],
                "source_pdf": spec["pdf"],
                "datasheet_url": BASE_URL + spec["url"],
                "extraction_date": "2026-08-29",
                "page_range": spec["printed"],
                "notes": p["notes"],
            }, items, extra_fields=EXTRA)
            total += len(items)
    print(f"\nToplam {total} satır.")


if __name__ == "__main__":
    build()
