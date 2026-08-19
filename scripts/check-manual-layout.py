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
import sys

import fitz

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


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    yol = sys.argv[1]
    d = fitz.open(yol)

    hata = 0
    tasan = []
    for i in range(d.page_count):
        for x0, y0, x1, y1, *_ in d[i].get_text("blocks"):
            if y0 >= ALTBILGI_UST:
                continue  # altbilgi
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

    tam = " ".join("".join(d[i].get_text() for i in range(d.page_count)).split())
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding="utf-8") as f:
            beklenen = json.load(f)
        eksik = [b for b in beklenen if " ".join(b.split()) not in tam]
        if eksik:
            hata = 1
            print(f"KAYIP: {len(eksik)} başlık belgede yok")
            for b in eksik[:10]:
                print(f"  · {b}")
        else:
            print(f"Kayıp yok ({len(beklenen)} başlığın hepsi belgede).")

    doluluk = [len(d[i].get_text().strip()) for i in range(d.page_count)]
    print(
        f"Sayfa: {d.page_count} · karakter/sayfa ortalama {sum(doluluk) // max(1, len(doluluk))}"
        f" · en az {min(doluluk)} · en çok {max(doluluk)}"
    )
    return hata


if __name__ == "__main__":
    sys.exit(main())
