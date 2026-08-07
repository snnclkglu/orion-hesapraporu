# -*- coding: utf-8 -*-
"""JAURE MT dişli kaplin dosyasını ALT SERİLERE ayırır (madde 14).

SORUN
`jaure_mt_gear.json` 86 satırın tamamını tek bir `meta.series = "MT"`
altında topluyordu.  seed-catalog.ts seri facet'ini `meta.series`ten
okuduğu için arayüzde MTS/MTG/MTF/… ayrı seçilemiyordu.

ÇÖZÜM
Alt seri MODEL KODUNDAN türetilir — dosyada zaten `sub_type` alanı vardır
ve model kodunun harf öneki ile birebir aynıdır.  Bu VERİ UYDURMAK DEĞİL,
var olan veriyi doğru gruplamaktır: hiçbir sayı değişmez, satırlar yalnız
kendi serilerinin dosyasına taşınır.

JAURE kataloğunun PDF'i workspace'te YOKTUR; bu yüzden sayılar
DOĞRULANAMAMIŞTIR ve her dosyanın meta.notes'unda bu açıkça yazılıdır.
"""

from __future__ import annotations

import json
import os

from couplings_common import OUT_DIR, remove_stale, write_catalog

SRC_FILE = "jaure_mt_gear.json"

# Alt seri → (dosya adı, açıklama).  Sıra, model kodundaki harf önekinin
# UZUNDAN KISAYA denenmesi için önemlidir (MTG-HD, MTG'den önce gelmeli).
SUB_SERIES = [
    ("MTG-HD", "jaure_mtg_hd.json",
     "MTG-HD: agir hizmet (heavy duty) tam-flex disli kaplin."),
    ("MTFE", "jaure_mtfe.json",
     "MTFE: ara parcali (spacer) flansli tam-flex disli kaplin."),
    ("MTES", "jaure_mtes.json",
     "MTES: ara mesafeli yarim-flex disli kaplin."),
    ("MTG", "jaure_mtg.json",
     "MTG: buyuk capli tam-flex disli kaplin."),
    ("MTS", "jaure_mts.json",
     "MTS: yarim-flex (bir tarafi rijit) disli kaplin."),
    ("MTF", "jaure_mtf.json",
     "MTF: flansli tam-flex disli kaplin."),
    ("MT", "jaure_mt.json",
     "MT: standart tam-flex kavisli dis (crowned tooth) disli kaplin."),
]


def sub_series_of(model):
    code = model.split()[0] if " " in model else model
    for prefix, _, _ in SUB_SERIES:
        if code.upper() == prefix:
            return prefix
    raise ValueError("alt seri cozulemedi: %r" % model)


def _load_source():
    """Kaynağı okur: ya özgün tek dosya, ya da daha önce bölünmüş dosyalar.

    Betik böylece TEKRAR ÇALIŞTIRILABİLİR (idempotent) — bölme bir kez
    yapıldıktan sonra da aynı sonucu üretir.
    """
    src = os.path.join(OUT_DIR, SRC_FILE)
    if os.path.exists(src):
        with open(src, encoding="utf-8") as fh:
            return json.load(fh)
    items, meta = [], None
    for _, filename, _ in SUB_SERIES:
        path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        meta = meta or dict(d["meta"])
        items.extend(d["items"])
    if not items:
        return None
    meta["series"] = "MT"
    return {"meta": meta, "items": items}


def build():
    print("JAURE kaplin katalogu:")
    doc = _load_source()
    if doc is None:
        print("  kaynak bulunamadi (%s ve bolunmus dosyalar yok)" % SRC_FILE)
        return
    base_meta = doc["meta"]

    buckets = {p: [] for p, _, _ in SUB_SERIES}
    zeroed = []
    for it in doc["items"]:
        sub = sub_series_of(it["model"])
        declared = it.get("sub_type")
        if declared and declared.upper() != sub:
            raise ValueError("sub_type/model uyusmazligi: %r" % it["model"])
        rec = dict(it)
        rec.pop("sub_type", None)
        # 0 kg bir olcum degil, EKSIK VERIDIR. Uydurmak yerine alani
        # tamamen kaldiriyoruz; hangi satirlarda oldugu meta.notes'a yazilir.
        for key in ("weight_kg", "weight_min_kg", "weight_max_kg"):
            if rec.get(key) == 0:
                rec.pop(key)
                zeroed.append("%s.%s" % (rec["model"], key))
        # Ortak sema: weight_max_kg zaten var; series alanini satira da yaz.
        rec["series"] = sub
        buckets[sub].append(rec)
    if zeroed:
        print("  agirligi 0 oldugu icin kaldirilan alanlar: %s"
              % ", ".join(zeroed))

    for prefix, filename, desc in SUB_SERIES:
        items = buckets[prefix]
        if not items:
            continue
        meta = dict(base_meta)
        meta["series"] = prefix
        meta["coupling_type"] = "gear"
        meta["extraction_date"] = "2026-08-06"
        meta["notes"] = (
            desc
            + " Bu dosya, tum alt serileri tek 'MT' basligi altinda toplayan "
              "jaure_mt_gear.json dosyasindan AYRILMISTIR (madde 14): alt "
              "seri MODEL KODUNUN harf onekinden turetilmistir, hicbir sayi "
              "degistirilmemistir. TN = anma momenti, TP = tepe momenti; "
              "agirlik en kucuk delik icin (weight_min_kg) ve en buyuk delik "
              "icin (weight_max_kg) ayri basilidir; max_bore_mm DIN 6885/1 "
              "kamali baglanti icindir. "
              "DOGRULANMADI: JAURE katalog PDF'i workspace'te YOKTUR, bu "
              "yuzden satirlar basili sayfayla karsilastirilamamistir. "
              "EN BUYUK BOYUN (MT[S/G]-...) agirligi kaynak dosyada 0 kg "
              "yaziyordu; 0 kg bir olcum degil eksik veri oldugundan alan "
              "TAMAMEN KALDIRILDI, sayi uydurulmadi."
        )
        write_catalog(filename, meta, items,
                      extra_fields=("size", "weight_max_kg", "weight_min_kg"))

    remove_stale([SRC_FILE])

    # TCBR fıçı kaplini: dosya olduğu gibi kalır, yalnız satır bazlı seri
    # alanı ve doğrulanmamış alan uyarısı eklenir.
    tcbr = os.path.join(OUT_DIR, "jaure_tcbr_barrel.json")
    if os.path.exists(tcbr):
        with open(tcbr, encoding="utf-8") as fh:
            d = json.load(fh)
        for it in d["items"]:
            it["series"] = "TCBR"
        if "series" not in d["fields"]:
            d["fields"].insert(2, "series")
        base = d["meta"].get("notes", "").split(" DOGRULANMADI:")[0]
        d["meta"]["notes"] = (
            base
            + " DOGRULANMADI: TCBR katalog PDF'i workspace'te YOKTUR. "
              "SUPHELI SATIRLAR: TCBR 25 icin max_speed_rpm 68 ve "
              "max_shaft_diameter_mm 68 ayni sayidir, hub_diameter_mm (38) "
              "ise mil capindan kucuktur — bu ucu sutun karismasi olabilir. "
              "PDF elde edilene kadar bu alanlara guvenilmemelidir."
        )
        with open(tcbr, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print("  %-28s %3d satir (seri alani eklendi)"
              % ("jaure_tcbr_barrel.json", len(d["items"])))


if __name__ == "__main__":
    build()
