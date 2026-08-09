#!/usr/bin/env python3
"""Teknik Resimler İÇERİK fikstürü üreticisi (Faz V2).

`drawings-fixture.py` klasörlerin YAPISINI taşır; bu betik dosyaların
İÇİNDEN okunan iki şeyi taşır:

  · PDF metin katmanının SPAN MODELİ — altı gerçek resmin anteti ve montaj
    parça tablosu, konumlarıyla birlikte
  · DXF BAŞLIĞI — üç ayrı AutoCAD sürümünden budanmış HEADER bölümü

    python scripts/drawings-content-fixture.py

NEDEN PDF YARISINI PYTHON YAPMIYOR: üretimde metni pdf.js (unpdf) çıkarıyor
ve span bölümlemesi PyMuPDF/pdfminer'ınkinden farklı. Fikstür üretimin
GÖRDÜĞÜNÜ taşımalı, yoksa testler yeşil kalırken üretim bozulur. Bu yüzden
betik proje kökünde bir node çocuğu çalıştırıp unpdf'ten span'ları alır.

KIRPMA: ham span'lar yedi dosyada 46 KB tutuyordu. Fikstür antet çerçevesinin
ÇEVRESİNE kırpılır — ama çerçevenin biraz DIŞI bilerek bırakılır: yanlış alarm
testi (`+0,5` gibi ölçü yazılarının müşteri alanına sızmaması) onsuz anlamsız
olurdu.

Kaynak klasörler workspace kökündedir (uygulama dizininin BİR ÜSTÜ) ve sürüm
denetimine girmez; betik yoksa anlaşılır biçimde yakınır.
"""

from __future__ import annotations

import json
import subprocess
import sys
import unicodedata
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
WORKSPACE = KOK.parent
OUT = KOK / "src" / "lib" / "drawings" / "__tests__" / "fixtures" / "content.ts"

MONORAY = "0057-00-0500 - MONORAY (1 TON)"
MTC = "0043-00-0000_MTC PASLANMAZ"

# (fikstür anahtarı, paket, paket kökünden göreli yol, neden bu dosya)
PDFLER = [
    (
        "MONORAY_PARCA",
        MONORAY,
        "DWG/0057-00-0510-01.pdf",
        "A4 yatay parça resmi; tek satırlık parça listesi, dolu antet",
    ),
    (
        "MONORAY_MONTAJ",
        MONORAY,
        "DWG/0057-00-0510.pdf",
        "A1 montaj; 12 satırlık çocuk tablo ve fazladan 'Toplam Ağırlık' sütunu",
    ),
    (
        "MONORAY_PORTRE",
        MONORAY,
        "DWG/0057-00-0700-03.pdf",
        "A4 DİKEY; ağırlık hücresi BOŞ ve antetin hemen solunda '+0,5' ölçü yazıları",
    ),
    (
        "MTC_MONTAJ_A0",
        MTC,
        "DWG/0043-00-0100.pdf",
        "A0 montaj; 24 satırlık çocuk tablo, en büyük sayfa ölçeği",
    ),
    (
        "MTC_PARCA",
        MTC,
        "DWG/0043-00-0100-01.pdf",
        "MTC parça resmi; ondalık VİRGÜL ile ağırlık",
    ),
    (
        "MTC_BOS_MUSTERI",
        MTC,
        "0043-00-0050 - BARA AKIM ALMA KOLU/DWG/0043-00-0050.pdf",
        "Müşteri ve malzeme hücreleri BOŞ; tek haneli gün (3.06.2026)",
    ),
]

# Üç ayrı AutoCAD sürümü — ayrıştırıcı sürümden bağımsız olmalı.
# AC1018 olarak MTC'nin ana kiriş sacı seçildi: nominal ölçüsü aynı fikstürdeki
# MTC_MONTAJ_A0 tablosunda yazıyor (`SAC 8x475x8270`), yani DXF kutusunun
# nominalle karşılaştırılabilirliği FİKSTÜRÜN İÇİNDE kanıtlanabiliyor.
DXFLER = [
    ("DXF_AC1018", MTC, "DXF/0043-00-0100 - ANA KIRIS - KESİLDİ/S355JR-8MM/S355JR - 8MM - 0043-00-0100-01 - (2 ADET).dxf"),
    ("DXF_AC1032", MONORAY, "DXF/S235JR-10MM/S235JR - 10MM - 0057-00-0510-04 - (2 ADET).dxf"),
    ("DXF_AC1015", MONORAY, "DXF/S235JR-3MM/S235JR - 3MM - 0057-00-0700-11 - (2 ADET).dxf"),
]

# Node çocuğu: unpdf ile span'ları çıkarır. Dönmüş öğeler ELENİR — dönmüş bir
# ölçü yazısı düz gibi görünüp antet hücrelerine karışıyor.
NODE_BETIK = r"""
import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";
// Yollar ORTAM DEĞİŞKENİYLE gelir: `node -e` ile argüman dizisi kabuktan
// kabuğa değişiyor ve Windows'ta tırnak içindeki JSON parçalanıyor.
const yollar = JSON.parse(process.env.ORION_PDF_YOLLARI);
const sonuc = [];
for (const yol of yollar) {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(yol)));
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const spans = [];
  for (const it of tc.items) {
    if (!("str" in it) || it.str === "") continue;
    const t = it.transform;
    if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue;
    spans.push({ text: it.str, x: t[4], y: t[5], w: it.width, h: it.height || Math.abs(t[3]) || 1 });
  }
  const meta = await pdf.getMetadata().catch(() => null);
  sonuc.push({ yol, pages: pdf.numPages, w: vp.width, h: vp.height, spans,
               author: meta?.info?.Author ?? "", producer: meta?.info?.Producer ?? "" });
}
process.stdout.write(JSON.stringify(sonuc));
"""


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def span_cek(yollar: list[Path]) -> list[dict]:
    """Node çocuğunu proje kökünde çalıştırır (unpdf orada çözülür)."""
    import os

    ortam = dict(os.environ, ORION_PDF_YOLLARI=json.dumps([str(y) for y in yollar]))
    p = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_BETIK],
        cwd=str(KOK),
        capture_output=True,
        env=ortam,
    )
    if p.returncode != 0:
        sys.exit("node başarısız:\n" + p.stderr.decode("utf-8", "replace"))
    return json.loads(p.stdout.decode("utf-8"))


def kirp(spans: list[dict]) -> list[dict]:
    """Antet + parça tablosu bandına kırpar.

    Çapa `No/Pos` başlığıdır: iki pakette de parça tablosunun sol kenarı
    antetin sol kenarıyla hizalıdır. Bandın SOLU 15 satır yüksekliği kadar
    genişletilir — yanlış alarm testinin ihtiyacı olan ölçü yazıları orada.
    """
    capa = None
    for s in spans:
        if "No/Pos" in s["text"] or "No/ Pos" in s["text"]:
            if capa is None or s["y"] < capa["y"]:
                capa = s
    if capa is None:
        # Parça tablosu olmayan bir sayfa gelirse antetin kendisi çapadır.
        for s in spans:
            if "Ölçek" in s["text"]:
                capa = s
                break
    if capa is None:
        return spans

    h = max(capa["h"], 1.0)
    x_antet = capa["x"] - 12 * h
    x_tablo = capa["x"] - 2 * h
    y_antet = capa["y"] + 4 * h

    # Tablo bandının ÜSTÜ SABİT DEĞİLDİR: başlıktan yukarı doğru satır satır
    # yürünür ve ilk büyük düşey boşlukta durulur. Sabit bir pay (60 satır)
    # A1'de tablonun çok üstünde kalıyor ve fikstüre yüzlerce çizim yazısı
    # sokuyordu.
    tablo = sorted(
        (s for s in spans if s["x"] >= x_tablo and s["y"] > capa["y"]),
        key=lambda s: s["y"],
    )
    y_tablo = capa["y"]
    for s in tablo:
        if s["y"] - y_tablo > 3 * h:
            break
        y_tablo = max(y_tablo, s["y"])

    out = []
    for s in spans:
        if s["x"] >= x_antet and s["y"] <= y_antet:
            out.append(s)
        elif s["x"] >= x_tablo and s["y"] <= y_tablo + 0.5 * h:
            out.append(s)
    return out


def dxf_buda(ham: bytes) -> bytes:
    """HEADER'ı ilgili değişkenlere, TABLES/ENTITIES'i küçük bir kuyruğa indirir.

    Baytlar OLDUĞU GİBİ taşınır (cp1254): kod sayfası testinin anlamı, gerçek
    bir ANSI_1254 baytının doğru çözüldüğünü göstermektir.
    """
    # cp1254 ile çözülür ve cp1254 ile yazılır: latin1 üzerinden gidilirse
    # 0xFD baytı `ý` sanılıp cp1254'e geri yazılamıyor ve gerçek `ı` kayboluyor.
    metin = ham.decode("cp1254", "replace")
    satir = metin.split("\r\n") if "\r\n" in metin else metin.split("\n")

    ilgi = {"$ACADVER", "$ACADMAINTVER", "$DWGCODEPAGE", "$INSUNITS", "$EXTMIN", "$EXTMAX"}
    cikti: list[str] = ["  0", "SECTION", "  2", "HEADER"]
    i = 0
    bolum = ""
    katmanlar: list[str] = []
    varliklar: list[str] = []
    # ASCII DIŞI bir tablo adı: kod sayfası çözümünün gerçek kanıtı.
    # 134 DXF'in 20'sinde var ("Ölçülendirme Yazı Stili" gibi yazı stili adları).
    turkce_ad = ""
    while i + 1 < len(satir):
        kod, deger = satir[i].strip(), satir[i + 1]
        if kod == "0" and deger.strip() == "SECTION":
            bolum = satir[i + 3].strip() if i + 3 < len(satir) else ""
        elif kod == "0" and deger.strip() == "ENDSEC":
            bolum = ""
        elif bolum == "HEADER" and kod == "9" and deger.strip() in ilgi:
            n = 3 if deger.strip() in ("$EXTMIN", "$EXTMAX") else 1
            cikti += [satir[i], satir[i + 1]]
            for k in range(1, n + 1):
                cikti += [satir[i + 2 * k], satir[i + 2 * k + 1]]
        elif bolum == "TABLES" and kod == "0" and deger.strip() == "LAYER":
            for j in range(i + 2, min(i + 24, len(satir) - 1), 2):
                if satir[j].strip() == "0":
                    break
                if satir[j].strip() == "2":
                    katmanlar.append(satir[j + 1])
                    break
        elif bolum == "TABLES" and kod == "2" and not turkce_ad:
            if any(ord(c) > 127 for c in deger):
                turkce_ad = deger
        elif bolum == "ENTITIES" and kod == "0" and len(varliklar) < 12:
            v = deger.strip()
            if v != "ENDSEC":
                varliklar.append(v)
        i += 2

    cikti += ["  0", "ENDSEC"]
    cikti += ["  0", "SECTION", "  2", "TABLES", "  0", "TABLE", "  2", "LAYER"]
    for ad in katmanlar[:6]:
        cikti += ["  0", "LAYER", "  5", "10", "  2", ad, " 70", "     0"]
    cikti += ["  0", "ENDTAB"]
    if turkce_ad:
        cikti += ["  0", "TABLE", "  2", "STYLE", "  0", "STYLE", "  2", turkce_ad, " 70", "     0", "  0", "ENDTAB"]
    cikti += ["  0", "ENDSEC"]
    cikti += ["  0", "SECTION", "  2", "ENTITIES"]
    for v in varliklar:
        cikti += ["  0", v, "  8", "0"]
    cikti += ["  0", "ENDSEC", "  0", "EOF"]
    return ("\r\n".join(cikti) + "\r\n").encode("cp1254", "replace")


def ts_dize(s: str) -> str:
    return json.dumps(nfc(s), ensure_ascii=False)


def yaz(pdf_veri: list[dict], dxf_veri: list[tuple[str, str, bytes]]) -> str:
    p: list[str] = []
    p.append("// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.")
    p.append("// Kaynak: python scripts/drawings-content-fixture.py")
    p.append("//")
    p.append("// Altı gerçek resmin METİN KATMANI ve üç gerçek DXF'in BAŞLIĞI.")
    p.append("// Dosyaların kendisi depoda değildir; burada yalnız okunan şey durur.")
    p.append("//")
    p.append("// Span'lar antet + parça tablosu bandına kırpılmıştır ama çerçevenin")
    p.append("// biraz DIŞI bilerek bırakılmıştır: yanlış alarm testi ('+0,5' gibi ölçü")
    p.append("// yazıları müşteri alanına sızmamalı) onsuz hiçbir şey kanıtlamazdı.")
    p.append("//")
    p.append("// TARİHSEL FİKSTÜRDÜR, ŞARTNAME DEĞİLDİR.")
    p.append("")
    p.append('import type { TextSpan } from "../../titleblock";')
    p.append("")
    p.append("export interface FixtureSheet {")
    p.append("  /** Paket kökünden göreli yol */")
    p.append("  file: string;")
    p.append("  /** Bu dosyanın fikstürde bulunma GEREKÇESİ */")
    p.append("  why: string;")
    p.append("  pageWidth: number;")
    p.append("  pageHeight: number;")
    p.append("  pages: number;")
    p.append("  /** PDF üstverisindeki /Author — metin katmanındaki yapışık addan FARKLI */")
    p.append("  author: string;")
    p.append("  producer: string;")
    p.append("  spans: TextSpan[];")
    p.append("}")
    p.append("")
    p.append("/** `x\\ty\\tw\\th\\tmetin` satırlarını span'a çevirir. */")
    p.append("function ayikla(blok: string): TextSpan[] {")
    p.append("  return blok")
    p.append('    .split("\\n")')
    p.append("    .filter((s) => s !== \"\")")
    p.append("    .map((satir) => {")
    p.append('      const [x, y, w, h, ...metin] = satir.split("\\t");')
    p.append("      return {")
    p.append('        text: metin.join("\\t"),')
    p.append("        x: Number(x), y: Number(y), w: Number(w), h: Number(h),")
    p.append("      };")
    p.append("    });")
    p.append("}")
    p.append("")

    for d in pdf_veri:
        satirlar = []
        for s in d["spans"]:
            metin = nfc(s["text"]).replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
            metin = metin.replace("\n", " ").replace("\t", " ")
            # Bir hane yeter: bütün eşikler satır yüksekliğinin (en az 4 punto)
            # katıdır, 0,05 puntoluk bir yuvarlama hiçbir kararı değiştirmez.
            satirlar.append(
                f'{s["x"]:.1f}\t{s["y"]:.1f}\t{s["w"]:.1f}\t{s["h"]:.1f}\t{metin}'
            )
        p.append(f'const {d["anahtar"]}_SPANS = `')
        p.append("\n".join(satirlar))
        p.append("`;")
        p.append("")
        p.append(f'export const {d["anahtar"]}: FixtureSheet = {{')
        p.append(f'  file: {ts_dize(d["rel"])},')
        p.append(f'  why: {ts_dize(d["why"])},')
        p.append(f'  pageWidth: {round(d["w"], 2)},')
        p.append(f'  pageHeight: {round(d["h"], 2)},')
        p.append(f'  pages: {d["pages"]},')
        p.append(f'  author: {ts_dize(d["author"])},')
        p.append(f'  producer: {ts_dize(d["producer"])},')
        p.append(f'  spans: ayikla({d["anahtar"]}_SPANS),')
        p.append("};")
        p.append("")

    p.append("export const FIXTURE_SHEETS: FixtureSheet[] = [")
    p.append("  " + ", ".join(d["anahtar"] for d in pdf_veri) + ",")
    p.append("];")
    p.append("")
    p.append("/**")
    p.append(" * DXF başlıkları — HEADER budanmış, TABLES/ENTITIES küçültülmüş.")
    p.append(" *")
    p.append(" * BAYT olarak saklanırlar (windows-1254), dizge olarak değil: kod sayfası")
    p.append(" * çözümünün gerçekten çalıştığını ancak gerçek baytlar gösterebilir.")
    p.append(" * `Ölçülendirme Yazı Stili` gibi adlar derlemede GERÇEKTEN var (134")
    p.append(" * dosyanın 20'sinde ASCII dışı bayt bulundu).")
    p.append(" */")
    p.append("export interface FixtureDxf {")
    p.append("  file: string;")
    p.append("  /** $ACADVER — üçü de çalışmalı */")
    p.append("  version: string;")
    p.append("  /** windows-1254 baytları, base64 */")
    p.append("  base64: string;")
    p.append("}")
    p.append("")
    p.append("export function dxfBytes(f: FixtureDxf): Uint8Array {")
    p.append('  return Uint8Array.from(Buffer.from(f.base64, "base64"));')
    p.append("}")
    p.append("")
    for anahtar, rel, veri in dxf_veri:
        import base64

        b64 = base64.b64encode(veri).decode("ascii")
        parcalar = [b64[i : i + 96] for i in range(0, len(b64), 96)]
        surum = ""
        metin = veri.decode("cp1254", "replace")
        if "AC10" in metin:
            j = metin.index("AC10")
            surum = metin[j : j + 6]
        p.append(f"export const {anahtar}: FixtureDxf = {{")
        p.append(f"  file: {ts_dize(rel)},")
        p.append(f"  version: {ts_dize(surum)},")
        p.append("  base64:")
        for k, par in enumerate(parcalar):
            p.append(f'    "{par}",' if k == len(parcalar) - 1 else f'    "{par}" +')
        p.append("};")
        p.append("")
    p.append("export const FIXTURE_DXF: FixtureDxf[] = [")
    p.append("  " + ", ".join(a for a, _, _ in dxf_veri) + ",")
    p.append("];")
    p.append("")
    return "\n".join(p)


def main() -> None:
    yollar = []
    for _, paket, rel, _ in PDFLER:
        y = WORKSPACE / paket / rel
        if not y.is_file():
            sys.exit(f"Kaynak PDF bulunamadı: {y}")
        yollar.append(y)

    print(f"{len(yollar)} PDF okunuyor (node + unpdf)...")
    ham = span_cek(yollar)

    pdf_veri = []
    for (anahtar, paket, rel, neden), d in zip(PDFLER, ham):
        kirpik = kirp(d["spans"])
        print(f"  {rel}: {len(d['spans'])} span -> {len(kirpik)} (kirpildi)")
        pdf_veri.append(
            {
                "anahtar": anahtar,
                "rel": rel,
                "why": neden,
                "w": d["w"],
                "h": d["h"],
                "pages": d["pages"],
                "author": d["author"],
                "producer": d["producer"],
                "spans": kirpik,
            }
        )

    dxf_veri = []
    for anahtar, paket, rel in DXFLER:
        y = WORKSPACE / paket / rel
        if not y.is_file():
            sys.exit(f"Kaynak DXF bulunamadı: {y}")
        budanmis = dxf_buda(y.read_bytes())
        print(f"  {rel}: {y.stat().st_size} bayt -> {len(budanmis)} (budandi)")
        dxf_veri.append((anahtar, rel, budanmis))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(yaz(pdf_veri, dxf_veri), encoding="utf-8")
    print(f"yazıldı: {OUT}  ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
