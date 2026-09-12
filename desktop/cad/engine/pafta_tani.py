# -*- coding: utf-8 -*-
"""
pafta_tani.py — Tani verisinin YAPISAL uretimi ve toplu ozetlenmesi.

Neden yapisal?
--------------
Bu aracin isi buyuk olcude sezgisel: "bu kutu pafta cercevesi mi", "bu metin
antet degeri mi", "bu tablo malzeme listesi mi". Her yeni cizim yeni bir
sablon surprizi cikariyor. Duz metin dokumu tek bir cizimi incelemek icin
iyidir ama 500 cizim birikince okunamaz.

Bu yuzden her calisma icin:
  1. tani_<dosya>.txt   -> insan icin ham dokum (sorunlu ornegi acmak icin)
  2. tani_<dosya>.json  -> makine icin yapisal kayit  (BURASI ONEMLI)

JSON icindeki "bulgular" listesi, kodun ZORLANDIGI yerleri isaretler.
Zaman icinde bunlar birikince `tani_ozet.py` hepsini tarayip
"su sutun basligi 34 cizimde eslesmedi", "su sablonda antet bulunamiyor"
gibi bir ozet uretir. Kodu gelistirmek icin bakilacak sey odur.
"""

from __future__ import annotations

import collections
import datetime as _dt
import json
import os
import re
from typing import Any, Iterable, Sequence

ARAC_SURUM = "1.4.0"

# ---------------------------------------------------------------------------
# Bulgu turleri — yeni tur eklerken burayi guncelle
# ---------------------------------------------------------------------------
BULGU_TURLERI = {
    "antet_bulunamadi":        "Cizimde hic pafta cercevesi tespit edilemedi",
    "resim_no_okunamadi":      "Antette Resim No degeri bulunamadi",
    "standart_disi_olcek":     "Cerceve standart bir olcege oturmuyor",
    "olcek_sapmasi":           "Antetteki olcek ile cerceve olcegi uyusmuyor",
    "kopya_set":               "Ayni pafta seti cizimde birden fazla kez var",
    "ayni_no_farkli_icerik":   "Ayni resim no, farkli icerik (revizyon suphesi)",
    "elle_cizilmis_tablo":     "Malzeme listesi AutoCAD tablosu degil",
    "tablo_basliksiz":         "Tabloda baslik satiri yok",
    "sutun_eslesmedi":         "Malzeme listesi sutun basligi taninmadi",
    "malzeme_yok":             "Paftada hic malzeme satiri bulunamadi",
    "full_bleed_yok":          "Plotterda full bleed kagit yok",
    "plot_hatasi":             "PDF basilamadi",
    "kagit_belirsiz":          "Kagit olcusu tek basina belirlenemedi",
}

_SUTUN_RE = re.compile(r"SUTUN-ESLESMEDI:\s*(.+)$")


def _b(tur: str, anahtar: str = "", deger: str = "", pafta: str = "") -> dict:
    return {"tur": tur, "anahtar": anahtar[:200], "deger": deger[:200],
            "pafta": pafta[:60]}


def bulgular_cikar(sheets: Sequence[Any], info: dict | None,
                   atlanan: Sequence[Any] = ()) -> list[dict]:
    """Cozumleme sonucundan makine-okunur bulgular uretir."""
    out: list[dict] = []
    if not sheets:
        out.append(_b("antet_bulunamadi"))

    if atlanan:
        out.append(_b("kopya_set", str(len(atlanan)),
                      f"{len(sheets)} tutuldu, {len(atlanan)} atlandi"))

    for sh in sheets:
        no = sh.drawing_no or "(bos)"
        if not sh.drawing_no.strip():
            out.append(_b("resim_no_okunamadi", "", "", f"#{sh.index}"))
        if not getattr(sh, "scale_is_standard", True):
            out.append(_b("standart_disi_olcek", sh.scale_label,
                          f"cerceve {sh.frame.w:.2f}x{sh.frame.h:.2f}", no))
        sap = float(getattr(sh, "scale_deviation", 0.0) or 0.0)
        if sap > 1.0:
            out.append(_b("olcek_sapmasi", f"%{sap:g}",
                          f"antet {sh.scale_text} / cerceve {sh.scale_label}", no))
        if not sh.bom:
            out.append(_b("malzeme_yok", "", "", no))
        for w in sh.warnings:
            m = _SUTUN_RE.search(w)
            if m:
                out.append(_b("sutun_eslesmedi", m.group(1).strip(), "", no))
            elif "elle cizilmis" in w.lower():
                out.append(_b("elle_cizilmis_tablo", "", "", no))
            elif "baslik satiri yok" in w.lower() or "bulunamadi; sutunlar" in w.lower():
                out.append(_b("tablo_basliksiz", "", "", no))
            elif "ICERIKLERI FARKLI" in w:
                out.append(_b("ayni_no_farkli_icerik", "", "", no))
            elif "full bleed" in w.lower():
                out.append(_b("full_bleed_yok", sh.paper, "", no))
            elif "tek basina kesin degil" in w.lower():
                out.append(_b("kagit_belirsiz", sh.paper, "", no))
    return out


def tani_json(dosya: str, sheets: Sequence[Any], info: dict | None,
              texts: Sequence[Any], boxes: Sequence[Any],
              tables: Sequence[Any], attrs: Sequence[Any] = (),
              atlanan: Sequence[Any] = (), ek: dict | None = None) -> dict:
    """Bir cizimin yapisal tani kaydini uretir."""
    info = info or {}

    kaynaklar: dict[str, dict] = {}
    for b in boxes:
        if b.w <= 0 or b.h <= 0:
            continue
        r = max(b.w, b.h) / min(b.w, b.h)
        if not (1.30 <= r <= 1.55):
            continue
        k = kaynaklar.setdefault(b.ident, {"ident": b.ident, "adet": 0, "boyutlar": {}})
        k["adet"] += 1
        key = (round(b.w, 2), round(b.h, 2), round(getattr(b, "bscale", 1.0), 6))
        k["boyutlar"][key] = k["boyutlar"].get(key, 0) + 1
    kaynak_listesi = []
    for k in sorted(kaynaklar.values(), key=lambda z: -z["adet"]):
        kaynak_listesi.append({
            "ident": k["ident"], "adet": k["adet"],
            "boyutlar": [{"w": w, "h": h, "blok_olcek": s, "adet": n}
                         for (w, h, s), n in sorted(k["boyutlar"].items(),
                                                    key=lambda kv: -kv[0][0])],
        })

    katman_sayaci = collections.Counter(t.layer for t in texts)

    return {
        "arac_surum": ARAC_SURUM,
        "zaman": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "dosya": os.path.basename(dosya),
        "sayilar": {
            "metin": len(texts), "kutu": len(boxes),
            "tablo": len(tables), "oznitelik": len(attrs),
            "pafta": len(sheets), "atlanan_pafta": len(atlanan),
            "malzeme_satiri": sum(len(s.bom) for s in sheets),
        },
        "etiket": {
            "strateji": info.get("strategy", ""),
            "aday": info.get("label_count", 0),
            "capa": info.get("anchor_count", 0),
        },
        "metin_katmanlari": [{"katman": k, "adet": n}
                             for k, n in katman_sayaci.most_common(12)],
        "cerceve_kaynaklari": kaynak_listesi[:10],
        "paftalar": [{
            "sira": s.index,
            "resim_no": s.drawing_no,
            "parca": s.part_name,
            "kagit": s.paper,
            "olcek": s.scale_label,
            "olcek_antet": s.scale_text,
            "olcek_sapma": getattr(s, "scale_deviation", 0.0),
            "olcek_std": getattr(s, "scale_is_standard", True),
            "cerceve": [round(s.frame.w, 2), round(s.frame.h, 2)],
            "cerceve_kaynak": s.frame.ident,
            "icerik_hash": getattr(s, "content_hash", ""),
            "malzeme": len(s.bom),
            "uyari": s.warnings,
        } for s in sheets],
        "bulgular": bulgular_cikar(sheets, info, atlanan),
        **(ek or {}),
    }


def yaz(path: str, veri: dict) -> str:
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    return path


# ---------------------------------------------------------------------------
# Toplu ozet — AI'a verilecek olan sey budur
# ---------------------------------------------------------------------------
def yukle_klasor(klasor: str) -> list[dict]:
    out = []
    for root, _d, names in os.walk(klasor):
        for n in names:
            if n.startswith("tani_") and n.endswith(".json"):
                try:
                    with open(os.path.join(root, n), encoding="utf-8") as f:
                        out.append(json.load(f))
                except Exception:
                    continue
    return out


def ozet_markdown(kayitlar: Sequence[dict], ornek_sayisi: int = 3) -> str:
    """Birikmis tani kayitlarindan AI incelemesi icin yogun bir ozet uretir."""
    if not kayitlar:
        return "Tani kaydi yok."

    L: list[str] = []
    L.append(f"# Pafta araci — tani ozeti")
    L.append("")
    L.append(f"- Cizim sayisi: **{len(kayitlar)}**")
    surumler = collections.Counter(k.get("arac_surum", "?") for k in kayitlar)
    L.append(f"- Arac surumleri: {', '.join(f'{s} ({n})' for s, n in surumler.most_common())}")
    tp = sum(k["sayilar"].get("pafta", 0) for k in kayitlar)
    tm = sum(k["sayilar"].get("malzeme_satiri", 0) for k in kayitlar)
    L.append(f"- Toplam pafta: **{tp}**, malzeme satiri: **{tm}**")
    L.append("")

    # --- Bulgular ---
    sayac: collections.Counter = collections.Counter()
    ornekler: dict[str, list[str]] = collections.defaultdict(list)
    anahtarlar: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for k in kayitlar:
        dosya = k.get("dosya", "?")
        for b in k.get("bulgular", []):
            tur = b.get("tur", "?")
            sayac[tur] += 1
            if b.get("anahtar"):
                anahtarlar[tur][b["anahtar"]] += 1
            if len(ornekler[tur]) < ornek_sayisi:
                ornekler[tur].append(
                    f"{dosya} / {b.get('pafta') or '-'} / {b.get('anahtar','')} {b.get('deger','')}".strip())

    L.append("## Bulgular (cok gecenden aza)")
    L.append("")
    L.append("| Bulgu | Adet | Aciklama |")
    L.append("|---|---:|---|")
    for tur, n in sayac.most_common():
        L.append(f"| `{tur}` | {n} | {BULGU_TURLERI.get(tur, '')} |")
    L.append("")

    for tur, n in sayac.most_common():
        L.append(f"### `{tur}` — {n} kez")
        if anahtarlar[tur]:
            L.append("")
            L.append("En sik degerler:")
            L.append("")
            for a, c in anahtarlar[tur].most_common(15):
                L.append(f"- `{a}` — {c} kez")
        if ornekler[tur]:
            L.append("")
            L.append("Ornekler:")
            L.append("")
            for o in ornekler[tur]:
                L.append(f"- {o}")
        L.append("")

    # --- Sablon cesitliligi ---
    L.append("## Antet / cerceve sablonlari")
    L.append("")
    kaynak = collections.Counter()
    strateji = collections.Counter()
    katman = collections.Counter()
    for k in kayitlar:
        strateji[k.get("etiket", {}).get("strateji", "?")] += 1
        for c in k.get("cerceve_kaynaklari", []):
            kaynak[c["ident"]] += c["adet"]
        for m in k.get("metin_katmanlari", []):
            katman[m["katman"]] += m["adet"]
    L.append("Cerceve kaynagi (blok/polyline):")
    L.append("")
    for a, c in kaynak.most_common(12):
        L.append(f"- `{a}` — {c} cerceve")
    L.append("")
    L.append("Secilen etiket stratejisi:")
    L.append("")
    for a, c in strateji.most_common():
        L.append(f"- {a} — {c} cizim")
    L.append("")
    L.append("En yogun metin katmanlari:")
    L.append("")
    for a, c in katman.most_common(10):
        L.append(f"- `{a}` — {c} metin")
    L.append("")

    # --- Olcek dagilimi ---
    L.append("## Olcek dagilimi")
    L.append("")
    olcek = collections.Counter()
    std_disi = collections.Counter()
    for k in kayitlar:
        for p in k.get("paftalar", []):
            olcek[p.get("olcek", "?")] += 1
            if not p.get("olcek_std", True):
                std_disi[p.get("olcek", "?")] += 1
    L.append("| Olcek | Pafta | Standart disi |")
    L.append("|---|---:|---:|")
    for a, c in olcek.most_common(25):
        L.append(f"| {a} | {c} | {std_disi.get(a, 0)} |")
    L.append("")

    L.append("## Bu ozetle ne yapilir")
    L.append("")
    L.append("- `sutun_eslesmedi` altindaki basliklar `pafta_core.BOM_HEADER_MAP`'e eklenmeli.")
    L.append("- `antet_bulunamadi` cikan cizimlerin ham `tani_*.txt` dosyasi acilip")
    L.append("  yeni bir cerceve/etiket kurali gerekip gerekmedigine bakilmali.")
    L.append("- `standart_disi_olcek` yogunlasan bir deger varsa (orn. hep 1/1.2)")
    L.append("  o buronun gercek bir olcegi olabilir; `NICE_SCALES`'e eklenmeli.")
    L.append("- `kopya_set` sik cikiyorsa revizyon secimi kuralinin dogrulugu gozden gecirilmeli.")
    return "\n".join(L)
