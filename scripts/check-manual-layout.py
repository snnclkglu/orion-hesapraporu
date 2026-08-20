# -*- coding: utf-8 -*-
"""EL KİTABI PDF'İNİN YERLEŞİM DENETÇİSİ.

İki sütunlu yerleşimde ölçü YAKLAŞIKTIR (`lib/manual/pdf-layout.ts`) ve eksik
ölçmenin bedeli görünmez: @react-pdf taşan içeriği SESSİZCE kırpar. Bir bakım
talimatının yarısının kaybolduğu ancak müşteri belgeyi okurken anlaşılır.

Bu betik üretilen PDF'i GERİ OKUR ve üç şeyi ölçer:

  1. TAŞMA   — gövde metni içerik alanının altına inmiş mi (altbilgi hariç)
  2. KAYIP   — beklenen başlıkların hepsi belgede var mı
  3. DOLULUK — sayfa başına düşen karakter (yerleşimin işe yarayıp yaramadığı)

`check-pdf-layout.py` ile aynı ruhta: bileşen ağacına bakmak yerleşimi
göstermez, kâğıdın kendisi gösterir.

    python scripts/check-manual-layout.py tmp/el-kitabi.pdf [beklenen-basliklar.json]
"""

import json
import re
import sys

try:
    import fitz
except ImportError:  # Codex'in taşınabilir çalışma zamanı pdfplumber taşır.
    fitz = None
    import pdfplumber

MM = 72 / 25.4
A4_YUKSEKLIK = 841.89
# `BrandPage`: paddingBottom = marginBottom(13mm) + 14 (altbilgi payı)
ICERIK_ALT = A4_YUKSEKLIK - (13 * MM + 14)
# ALTBİLGİ BÖLGESİ TAŞMA DENETİMİNE GİRMEZ ve sınırı 42 pt yukarıdadır:
# `BrandPage`in altbilgisi `bottom: mm(7)`de başlar ama FİRMA KÜNYESİNİ de
# içerir (`COMPANY_FOOTER_HEIGHT` 28 + folio satırı 14). Yalnız folio satırını
# dışlamak kapak sayfasında yanlış alarm veriyordu — künye tasarım gereği
# içerik alanının altındadır.
#
# BEDELİ BİLİNÇLİDİR: 780–791 pt arasına taşan gövde bu denetimden kaçar.
# On bir puntoluk bu kör nokta, her kapağı hatalı bildiren bir denetçiden
# iyidir — susturulan bir denetçi hiç bakılmayan denetçidir.
ALTBILGI_UST = A4_YUKSEKLIK - 7 * MM - 42


def kelimeler(metin):
    """PDF okuyucunun sütun arasına soktuğu folio/komşu metni yoksayacak sözler."""
    return re.findall(r"\w+", metin.casefold(), flags=re.UNICODE)


def alt_dizi_mi(aranan, metin):
    """Aranan sözler aynı sayfada ve sırada mı; araya sütun metni girebilir."""
    sira = iter(kelimeler(metin))
    return all(any(aday == soz for aday in sira) for soz in kelimeler(aranan))


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    yol = sys.argv[1]
    hata = 0
    tasan = []
    sayfa_metinleri = []
    if fitz is not None:
        d = fitz.open(yol)
        for i in range(d.page_count):
            sayfa_metinleri.append(d[i].get_text())
            for x0, y0, x1, y1, *_ in d[i].get_text("blocks"):
                if y0 >= ALTBILGI_UST:
                    continue  # altbilgi
                if y1 > ICERIK_ALT + 2:
                    tasan.append((i + 1, round(y1, 1)))
                    break
    else:
        # Aynı üstten-aşağı koordinat sistemiyle sözcük kutularını okur.
        # Bu yedek yalnız bağımlılık farkını kapatır; eşik ve hata kuralı aynı.
        with pdfplumber.open(yol) as d:
            for i, sayfa in enumerate(d.pages):
                sayfa_metinleri.append(sayfa.extract_text() or "")
                for kelime in sayfa.extract_words():
                    y0 = float(kelime["top"])
                    y1 = float(kelime["bottom"])
                    if y0 >= ALTBILGI_UST:
                        continue
                    if y1 > ICERIK_ALT + 2:
                        tasan.append((i + 1, round(y1, 1)))
                        break

    if tasan:
        hata = 1
        print(f"TAŞMA: {len(tasan)} sayfada gövde içerik alanının altına indi")
        for s, y in tasan[:10]:
            print(f"  s{s}: en alt {y} > {ICERIK_ALT:.1f}")
    else:
        print(f"Taşma yok (içerik alanı dibi {ICERIK_ALT:.1f} pt).")

    tam = " ".join("".join(sayfa_metinleri).split())
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding="utf-8") as f:
            beklenen = json.load(f)
        if fitz is not None:
            eksik = [b for b in beklenen if " ".join(b.split()) not in tam]
        else:
            # pdfplumber iki sütunu satır satır birleştirir; sağ sütundaki
            # sarılmış bir başlığın arasına sol sütun metni girebilir. Aynı
            # sayfadaki başlık sözlerinin sırasını sınamak bu farkı kapatır.
            eksik = [
                b for b in beklenen
                if not any(alt_dizi_mi(b, metin) for metin in sayfa_metinleri)
            ]
        if eksik:
            hata = 1
            print(f"KAYIP: {len(eksik)} başlık belgede yok")
            for b in eksik[:10]:
                print(f"  · {b}")
        else:
            print(f"Kayıp yok ({len(beklenen)} başlığın hepsi belgede).")

    doluluk = [len(metin.strip()) for metin in sayfa_metinleri]
    print(
        f"Sayfa: {len(sayfa_metinleri)} · karakter/sayfa ortalama {sum(doluluk) // max(1, len(doluluk))}"
        f" · en az {min(doluluk)} · en çok {max(doluluk)}"
    )
    return hata


if __name__ == "__main__":
    sys.exit(main())
