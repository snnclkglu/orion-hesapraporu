"""Elle çalıştırılan gerçek AutoCAD kabul testi; kaynak DWG'leri kaydetmez."""
from pathlib import Path
import hashlib
import json
import win32com.client
from pypdf import PdfReader

from pafta_toplu import TopluIs


def main():
    source = Path(__file__).resolve().parent.parent
    files = [source / "0026-01-0100 - KÖPRÜ YÜRÜTME.dwg",
             source / "0026-01-0300 - BAŞKİRİŞ.dwg"]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    acad = win32com.client.GetActiveObject("AutoCAD.Application")
    active = acad.ActiveDocument
    batch = TopluIs.olustur(source, files, source / "pafta_araci" / "dogrulama_ciktilari")
    try:
        batch.calistir(olay=lambda kind, data: print(kind, data, flush=True))
        for p in files:
            assert hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p)], "Kaynak DWG değişti"
        checks = []
        for job in batch.veri["isler"]:
            assert job["durum"] == "tamamlandi", job["hata"]
            pdfs = list(Path(job["cikti"]).rglob("*.pdf"))
            singles = [p for p in pdfs if not p.name.endswith("_BIRLESIK.pdf")]
            combined = [p for p in pdfs if p.name.endswith("_BIRLESIK.pdf")]
            assert len(singles) == job["pdf"], "PDF sayısı uyuşmuyor"
            assert len(combined) == 1, "Birleşik PDF eksik"
            assert all(len(PdfReader(p).pages) == 1 for p in singles)
            assert len(PdfReader(combined[0]).pages) == len(singles)
            checks.append({"dwg": job["goreli_yol"], "pdf": len(singles), "birlesik_sayfa": len(singles)})
        (batch.dosya.parent / "dogrulama.json").write_text(json.dumps(
            {"kaynaklar_degismedi": True, "kontroller": checks}, ensure_ascii=False, indent=2), encoding="utf-8")
        print("DOĞRULANDI:", batch.dosya.parent, flush=True)
    finally:
        active.Activate()


if __name__ == "__main__":
    main()
