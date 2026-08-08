# -*- coding: utf-8 -*-
"""Katalog SAYFASI dilimleyici — "o ürünün kataloğundaki gerçek sayfa".

NE YAPAR
  Üretici katalog PDF'lerinden, her ÜRÜN SERİSİNİN tablosunun bulunduğu
  sayfa(lar)ı kesip iki biçimde yazar:
    · `<slug>.pdf`      — sayfanın BİREBİR kendisi (vektör/tarama korunur;
                          yeni sekmede açılır, indirilir, teklife eklenir)
    · `<slug>-p<n>.webp` — aynı sayfanın ekran çözünürlüğünde görüntüsü
                          (pop-up içinde gösterilir; her tarayıcıda çalışır)
  Ayrıca uygulamanın okuduğu `src/lib/catalog-sheets/manifest.json` dosyasını
  üretir: hangi MARKA + MODEL hangi sayfaya düşer.

NEDEN SAYFA HARİTASI ELLE VERİLİYOR
  Sayfa numaraları TAHMİN EDİLMEZ. ÖZGÜN kataloğunun metin katmanı yoktur
  (taranmış); SIBRE ve JAURE'de ise aynı tablo hem endüstriyel hem denizcilik
  bölümünde tekrar eder. Bu yüzden harita, katalog verisini çıkaran betiklerin
  (`catalog-extract/couplings_*.py`) `meta.source_page` alanlarıyla ve JAURE'de
  sayfa metnindeki tork sütunuyla BİREBİR doğrulanarak elle yazılmıştır.
  `--verify` bu doğrulamayı yeniden koşturur (metin katmanı olan PDF'lerde).

  İNDİS TABANI: PyMuPDF `doc[i]` ile aynı, yani 0 TABANLIDIR. Katalog
  verisindeki "PDF idx 16" ifadesi de aynı indistir; basılı sayfa numarası
  ayrıca `printed` alanında tutulur.

KULLANIM
  python scripts/catalog-sheets.py           # üret
  python scripts/catalog-sheets.py --verify  # yalnız sayfa haritasını doğrula

ŞİMDİLİK YALNIZ KAPLİNLER. Yeni bir tür eklemek için SHEETS'e girdi yazmak
yeterlidir; uygulama tarafında hiçbir değişiklik gerekmez.
"""

from __future__ import annotations

import json
import os
import re
import sys

import fitz  # PyMuPDF
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)                 # orion-hesapraporu
WORKSPACE = os.path.dirname(REPO)            # HESAP RAPORU KOD
CATALOG_DATA = os.path.join(WORKSPACE, "catalog_data")
OUT_DIR = os.path.join(REPO, "catalog-sheets")
MANIFEST = os.path.join(REPO, "src", "lib", "catalog-sheets", "manifest.json")

# Görüntü kalitesi: A4 sayfa 150 dpi'da ~1240×1754 px olur — ölçü tablolarındaki
# en küçük rakam ekranda rahat okunur, dosya da 100–400 KB bandında kalır.
RENDER_DPI = 150
WEBP_QUALITY = 82

# --------------------------------------------------------------- kaynak PDF'ler

PDFS = {
    "ozgun": "ozgun katalog 2019 1-b.pdf",
    "sibre": "02_SIBRE_Coupling-catalogue.pdf",
    "jaure_mt": "JAURE MT Series_Gear Coupling.pdf",
    "jaure_tcbr": "Jaure Tambur kaplini.pdf",
}

# ------------------------------------------------------------------ sayfa haritası
#
# (kind, brand, series, catalog_data dosyası, kaynak, 0-tabanlı sayfalar,
#  basılı sayfa etiketi, başlık)
#
# `verify_tokens`: metin katmanı olan PDF'lerde sayfada MUTLAKA bulunması
# gereken kelimeler — yanlış sayfaya kayma sessizce geçmesin diye.

SHEETS = [
    # ---------------------------------------------------------------- ÖZGÜN
    # Taranmış katalog; sayfa haritası couplings_ozgun.py başlığındaki
    # idx tablosundan birebir alınmıştır (metin katmanı YOK → doğrulanamaz).
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
    ("coupling", "SIBRE", "ALC-A", "sibre_alc_a.json", "sibre", [5], "s.10-11", "SIBRE ALC-A — Elastik kaplin"),
    ("coupling", "SIBRE", "ALC-AS", "sibre_alc_as.json", "sibre", [6], "s.12-13", "SIBRE ALC-AS — Fren kasnaklı elastik kaplin"),
    ("coupling", "SIBRE", "ALC-AT", "sibre_alc_at.json", "sibre", [6], "s.12-13", "SIBRE ALC-AT — Fren diskli elastik kaplin"),
    ("coupling", "SIBRE", "AFC-A", "sibre_afc_a.json", "sibre", [7], "s.14-15", "SIBRE AFC-A — Elastik kaplin"),
    ("coupling", "SIBRE", "AFC-AS", "sibre_afc_as.json", "sibre", [7], "s.14-15", "SIBRE AFC-AS — Fren kasnaklı elastik kaplin"),
    ("coupling", "SIBRE", "APC-A", "sibre_apc_a.json", "sibre", [8], "s.16-17", "SIBRE APC-A — Pimli kaplin"),
    ("coupling", "SIBRE", "APC-AS", "sibre_apc_as.json", "sibre", [9], "s.18-19", "SIBRE APC-AS — Fren kasnaklı pimli kaplin"),
    ("coupling", "SIBRE", "APC-AT", "sibre_apc_at.json", "sibre", [10], "s.20-21", "SIBRE APC-AT — Fren diskli pimli kaplin"),
    ("coupling", "SIBRE", "APC-BT", "sibre_apc_bt.json", "sibre", [10], "s.20-21", "SIBRE APC-BT — Fren diskli pimli kaplin"),
    ("coupling", "SIBRE", "ZKES", "sibre_zkes.json", "sibre", [12], "s.24-25", "SIBRE ZKES — Dişli kaplin"),
    ("coupling", "SIBRE", "ABC-V", "sibre_abc_v.json", "sibre", [23], "s.46-47", "SIBRE ABC-V — Tambur (halat) kaplini"),
    # ---------------------------------------------------------------- JAURE
    # ENDÜSTRİYEL bölüm sayfaları seçilmiştir. MT ve MTG tabloları katalogun
    # DENİZCİLİK (marine) bölümünde idx 35/36'da AYNI torklarla tekrar eder;
    # vinç uygulaması endüstriyel bölüme aittir.
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
]

# Katalog verisi klasörleri (kind → catalog_data alt klasörü)
KIND_DIR = {"coupling": "couplings"}


def slugify(text: str) -> str:
    out = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return out or "sheet"


def load_models(kind: str, filename: str) -> tuple[list[str], dict]:
    path = os.path.join(CATALOG_DATA, KIND_DIR[kind], filename)
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    return [str(it["model"]) for it in doc["items"]], doc["meta"]


# Boy numarası kanıtının yeterli sayılacağı en düşük oran.
SIZE_COVERAGE_MIN = 0.6


def verify(sheet, doc) -> tuple[str, str | None]:
    """Sayfa haritasını PDF'in KENDİ metniyle sınar → (kanıt, hata).

    İki bağımsız kanıt aranır; biri yeterlidir:
      · SERİ BAŞLIĞI — seri kodu sayfa metninde geçiyor mu (ör. "APC-A").
      · BOY KAPSAMI  — katalog verisindeki model kodlarının sonundaki boy
        numaralarının kaçı sayfada ayrı bir kelime olarak var.

    İkisi birden gerekmez: bazı sayfalar boyu ancak birleşik tip kodunda
    basar (SIBRE "APC250A"), bazılarında ise seri adı yalnız görselde geçer.
    Metin katmanı hiç yoksa (taranmış ÖZGÜN kataloğu) doğrulama yapılamaz ve
    bu AÇIKÇA raporlanır — sessizce "geçti" sayılmaz.
    """
    kind, _brand, series, filename, _src, pages, _printed, _title = sheet
    words = {w[4] for i in pages for w in doc[i].get_text("words")}
    if not words:
        return ("metin katmanı yok — doğrulanamadı", None)

    text = "".join(doc[i].get_text() for i in pages).upper()
    text = re.sub(r"\s+", "", text)
    header = re.sub(r"\s+", "", series.upper()) in text

    models, _ = load_models(kind, filename)
    sizes = [m.group(1) for m in (re.search(r"(\d+)$", x) for x in models) if m]
    hit = sum(1 for s in sizes if s in words)
    ratio = hit / len(sizes) if sizes else 0.0

    if header and ratio >= SIZE_COVERAGE_MIN:
        return ("seri başlığı + boy %d/%d" % (hit, len(sizes)), None)
    if header:
        return ("seri başlığı (boy %d/%d)" % (hit, len(sizes)), None)
    if ratio >= SIZE_COVERAGE_MIN:
        return ("boy %d/%d" % (hit, len(sizes)), None)
    return (
        "",
        "%s: sayfada ne seri başlığı ne de yeterli boy numarası var "
        "(boy %d/%d)" % (series, hit, len(sizes)),
    )


def render_webp(page, path: str) -> None:
    pix = page.get_pixmap(dpi=RENDER_DPI)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def build(verify_only: bool = False) -> None:
    docs: dict[str, fitz.Document] = {}
    for key, name in PDFS.items():
        path = os.path.join(WORKSPACE, name)
        if not os.path.exists(path):
            raise SystemExit("Kaynak PDF bulunamadi: %s" % path)
        docs[key] = fitz.open(path)

    problems: list[str] = []
    entries: list[dict] = []
    # AYNI sayfa birden çok seriye hizmet edebilir (SIBRE ALC-AS/ALC-AT tek
    # çift sayfada, JAURE MTG/MTG-HD tek tabloda). Dosya BİR KEZ üretilir;
    # manifestte her seri kendi kaydını tutup aynı dosyayı gösterir.
    produced: dict[tuple[str, tuple[int, ...]], tuple[str, list[str]]] = {}

    for sheet in SHEETS:
        kind, brand, series, filename, src, pages, printed, title = sheet
        doc = docs[src]
        evidence, problem = verify(sheet, doc)
        if problem:
            problems.append(problem)
            continue
        page_key = (src, tuple(pages))
        shared = produced.get(page_key)
        print("  %-6s %-8s %-8s → idx %-8s %s%s"
              % (brand, series, printed, ",".join(str(i) for i in pages), evidence,
                 " (aynı sayfa)" if shared else ""))
        models, meta = load_models(kind, filename)
        rel_dir = kind
        if shared:
            slug, images = shared
        else:
            slug = "%s-%s" % (slugify(brand), slugify(series))
            images = ["%s/%s-p%d.webp" % (rel_dir, slug, i + 1) for i in range(len(pages))]
            produced[page_key] = (slug, images)
        entry = {
            "id": "%s/%s" % (rel_dir, slugify("%s-%s" % (brand, series))),
            "kind": kind,
            "brand": brand,
            "series": series,
            "title": title,
            "source": PDFS[src],
            "printedPages": printed,
            "pdf": "%s/%s.pdf" % (rel_dir, slug),
            "images": images,
            "models": models,
        }
        # `meta.notes` MANIFESTE GİRMEZ: çıkarım notları diakritiksiz yazılmış
        # geliştirici metnidir ve manifest istemci paketine giren bir dosyadır.
        # Mühendisin ihtiyaç duyduğu köken bilgisi `source` + `printedPages`tir.
        _ = meta
        entries.append(entry)

        if verify_only or shared:
            continue

        out_dir = os.path.join(OUT_DIR, rel_dir)
        os.makedirs(out_dir, exist_ok=True)
        # 1) sayfanın birebir PDF dilimi
        slice_doc = fitz.open()
        for i in pages:
            slice_doc.insert_pdf(doc, from_page=i, to_page=i)
        slice_doc.set_metadata({
            "title": title,
            "subject": "%s — %s (%s)" % (PDFS[src], printed, series),
            "producer": "ORION Hesap Raporu / catalog-sheets.py",
        })
        slice_doc.save(os.path.join(out_dir, "%s.pdf" % slug), garbage=4, deflate=True)
        slice_doc.close()
        # 2) ekran görüntüsü
        for n, i in enumerate(pages, start=1):
            render_webp(doc[i], os.path.join(out_dir, "%s-p%d.webp" % (slug, n)))

    if problems:
        for p in problems:
            print("  DOGRULAMA HATASI: %s" % p)
        raise SystemExit("Sayfa haritasi dogrulanamadi — uretim durduruldu.")

    if verify_only:
        print("Sayfa haritasi dogrulandi: %d sayfa kaydi." % len(entries))
        return

    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump({"sheets": entries}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    total = 0
    for root, _dirs, files in os.walk(OUT_DIR):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    print("%d katalog sayfasi yazildi (%s) — toplam %.1f MB"
          % (len(entries), OUT_DIR, total / 1024 / 1024))
    print("manifest: %s" % MANIFEST)


if __name__ == "__main__":
    build(verify_only="--verify" in sys.argv)
