#!/usr/bin/env python3
"""Teknik Resimler fikstür üreticisi.

İki GERÇEK teslim klasörünü okuyup Vitest fikstürüne çevirir. Klasörlerin
kendisi (300 MB) depoya girmez; giren şey yalnızca YAPIDIR — yollar, boyutlar,
kısa imzalar ve Excel satırları.

    python scripts/drawings-fixture.py

Neden iki klasör: tek klasörle yazılan her tanıma kuralı ikincisinde kırıldı.
`0057-00-0500 - MONORAY (1 TON)` düz yapılı, tek Excel'li, tireli adlı;
`0043-00-0000_MTC PASLANMAZ` üç seviye iç içe, yedi Excel'li, alt çizgili adlı.
Fikstür ikisini birden taşır ki hoşgörü ölçülebilsin.

Kaynak klasörler workspace kökündedir (uygulama dizininin BİR ÜSTÜ) ve
sürüm denetimine girmez; betik yoksa anlaşılır biçimde yakınır.
"""

from __future__ import annotations

import hashlib
import os
import sys
import unicodedata
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl gerekli:  pip install openpyxl")

WORKSPACE = Path(__file__).resolve().parent.parent.parent
OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "lib" / "drawings" / "__tests__" / "fixtures"

PAKETLER = [
    ("MONORAY", "0057-00-0500 - MONORAY (1 TON)"),
    ("MTC", "0043-00-0000_MTC PASLANMAZ"),
]


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def kisa_imza(p: Path) -> str:
    """SHA-256'nın ilk 16 hanesi. Fikstürde tam imza 40 KB yer yerdi; kopya
    dosya kararı için 16 hane fazlasıyla yeter (BÜKÜM PDF'leri bayt bayt aynı)."""
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for blok in iter(lambda: fh.read(1 << 20), b""):
            h.update(blok)
    return h.hexdigest()[:16]


def dosyalari_topla(kok: Path) -> list[tuple[str, int, str]]:
    kayitlar: list[tuple[str, int, str]] = []
    for dizin, _alt, adlar in os.walk(kok):
        for ad in adlar:
            tam = Path(dizin) / ad
            rel = nfc(str(tam.relative_to(kok)).replace(os.sep, "/"))
            kayitlar.append((rel, tam.stat().st_size, kisa_imza(tam)))
    kayitlar.sort(key=lambda k: k[0])
    return kayitlar


def excelleri_oku(kok: Path) -> list[dict]:
    """Her Excel'in HER sayfasını ham metin olarak alır.

    Hiçbir sütun yorumlanmaz, hiçbir satır atlanmaz: fikstürün işi kaynağı
    olduğu gibi taşımaktır, okuyucunun işi onu anlamaktır. Boş hücre "" olur
    (None ile "" ayrımı okuyucu için anlamsız, fikstürü ise okunmaz yapardı).
    """
    sonuc: list[dict] = []
    yollar = sorted(kok.rglob("*.xlsx"), key=lambda p: str(p).lower())
    for yol in yollar:
        wb = openpyxl.load_workbook(yol, data_only=True, read_only=True)
        for ws in wb.worksheets:
            satirlar = [
                ["" if h is None else str(h).strip() for h in satir]
                for satir in ws.iter_rows(values_only=True)
            ]
            # Sondaki tamamen boş satırlar openpyxl'in read_only kipinde
            # sıkça geliyor; fikstürü şişirmesinler.
            while satirlar and not any(h for h in satirlar[-1]):
                satirlar.pop()
            if not satirlar:
                continue
            sonuc.append(
                {
                    "file": nfc(str(yol.relative_to(kok)).replace(os.sep, "/")),
                    "sheet": nfc(ws.title),
                    "rows": satirlar,
                }
            )
        wb.close()
    return sonuc


def ts_metin(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def yaz_paketler(veri: dict[str, dict]) -> str:
    p = []
    p.append("// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.")
    p.append("// Kaynak: python scripts/drawings-fixture.py")
    p.append("//")
    p.append("// İki gerçek teslim klasörünün YAPISI. Dosyaların kendisi depoda")
    p.append("// değildir; burada yalnız yol, boyut ve kısa imza durur.")
    p.append("//")
    p.append("// TARİHSEL FİKSTÜRDÜR, ŞARTNAME DEĞİLDİR: buradaki bir ad kuralı")
    p.append("// 'olması gereken' değil 'bir gün gerçekten gelen'dir. Yeni bir paket")
    p.append("// başka türlü adlandırılmışsa doğru tepki fikstürü değiştirmek değil,")
    p.append("// tanıyıcı listesine bir tanıyıcı daha eklemektir.")
    p.append("")
    p.append("export interface FixtureFile {")
    p.append("  /** Kök klasör adı atılmış, NFC normalize, '/' ayraçlı yol */")
    p.append("  path: string;")
    p.append("  size: number;")
    p.append("  /** SHA-256'nın ilk 16 hanesi */")
    p.append("  hash: string;")
    p.append("}")
    p.append("")
    p.append("export interface FixturePackage {")
    p.append("  folder: string;")
    p.append("  files: FixtureFile[];")
    p.append("}")
    p.append("")
    p.append("function ayikla(blok: string): FixtureFile[] {")
    p.append("  return blok")
    p.append("    .trim()")
    p.append('    .split("\\n")')
    p.append("    .map((satir) => {")
    p.append('      const [path, size, hash] = satir.split("\\t");')
    p.append("      return { path, size: Number(size), hash };")
    p.append("    });")
    p.append("}")
    p.append("")

    for anahtar, bilgi in veri.items():
        satirlar = "\n".join(
            f"{ts_metin(yol)}\t{boyut}\t{imza}" for yol, boyut, imza in bilgi["files"]
        )
        p.append(f"const {anahtar}_FILES = `")
        p.append(satirlar)
        p.append("`;")
        p.append("")
        p.append(f"export const {anahtar}: FixturePackage = {{")
        p.append(f'  folder: "{ts_metin(bilgi["folder"])}",')
        p.append(f"  files: ayikla({anahtar}_FILES),")
        p.append("};")
        p.append("")

    p.append("export const FIXTURE_PACKAGES: FixturePackage[] = [")
    p.append("  " + ", ".join(veri.keys()) + ",")
    p.append("];")
    p.append("")
    return "\n".join(p)


def yaz_bom(veri: dict[str, dict]) -> str:
    import json

    p = []
    p.append("// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.")
    p.append("// Kaynak: python scripts/drawings-fixture.py")
    p.append("//")
    p.append("// İki paketteki BÜTÜN Excel'lerin BÜTÜN sayfaları, HAM hâlde.")
    p.append("// Başlık satırı ayrılmamıştır — başlığı bulmak okuyucunun işidir ve")
    p.append("// fikstür tam olarak o yeteneği sınamak için ham durur.")
    p.append("//")
    p.append("// Gözlenen çeşitlilik (tek şemaya sıkıştırmama gerekçesi):")
    p.append("//   · dosya sayısı 1 ↔ 7")
    p.append("//   · sayfa sayısı 1 ↔ 3, adları 'BOM' · 'Sayfa1' · 'Sayfa2'")
    p.append("//   · sütun sayısı 7 · 9 · 11 · 13 · 14")
    p.append("//   · yalnız _DEPO_ ↔ _DEPO_ + _URUN AGACI_")
    p.append("")
    p.append("export interface FixtureSheet {")
    p.append("  /** Paket kökünden göreli Excel yolu */")
    p.append("  file: string;")
    p.append("  sheet: string;")
    p.append("  /** Ham satırlar; boş hücre '' olur */")
    p.append("  rows: string[][];")
    p.append("}")
    p.append("")

    # Satır başına bir JSON dizisi: hücre hücre girintilemek dosyayı 2,5 katına
    # çıkarıyordu ve fikstürde okunan şey zaten SATIRDIR, hücre değil.
    for anahtar, bilgi in veri.items():
        p.append(f"export const {anahtar}_SHEETS: FixtureSheet[] = [")
        for sayfa in bilgi["sheets"]:
            p.append("  {")
            p.append(f'    file: {json.dumps(sayfa["file"], ensure_ascii=False)},')
            p.append(f'    sheet: {json.dumps(sayfa["sheet"], ensure_ascii=False)},')
            p.append("    rows: [")
            for satir in sayfa["rows"]:
                p.append("      " + json.dumps(satir, ensure_ascii=False) + ",")
            p.append("    ],")
            p.append("  },")
        p.append("];")
        p.append("")

    return "\n".join(p)


def main() -> None:
    veri: dict[str, dict] = {}
    for anahtar, klasor in PAKETLER:
        kok = WORKSPACE / klasor
        if not kok.is_dir():
            sys.exit(f"Kaynak klasör bulunamadı: {kok}")
        print(f"okunuyor: {klasor}")
        dosyalar = dosyalari_topla(kok)
        sayfalar = excelleri_oku(kok)
        print(f"  {len(dosyalar)} dosya, {len(sayfalar)} Excel sayfası")
        veri[anahtar] = {"folder": klasor, "files": dosyalar, "sheets": sayfalar}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "packages.ts").write_text(yaz_paketler(veri), encoding="utf-8")
    (OUT_DIR / "bom-sheets.ts").write_text(yaz_bom(veri), encoding="utf-8")
    for ad in ("packages.ts", "bom-sheets.ts"):
        kb = (OUT_DIR / ad).stat().st_size / 1024
        print(f"yazıldı: {OUT_DIR / ad}  ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
