"""Kalıcı, sıralı yerel DWG kuyruğu. AutoCAD yalnızca işçi süreçte açılır."""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import uuid
from datetime import datetime


def tara(klasor, alt_klasor=False):
    root = Path(klasor).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Bir klasör seçin.")
    bulunan = []
    def hata(exc):
        raise exc
    for parent, dirs, files in os.walk(root, onerror=hata, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not Path(parent, d).is_symlink())
        for name in files:
            p = Path(parent, name)
            if p.suffix.lower() == ".dwg" and not name.startswith("~") and p.is_file():
                bulunan.append(p)
        if not alt_klasor:
            break
    return sorted(bulunan, key=lambda p: str(p.relative_to(root)).casefold())


def json_yaz(path, data):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


class CalismaKilidi:
    """Aynı kullanıcı oturumunda iki yerel toplu pencerenin çakışmasını önler."""
    def __enter__(self):
        self.file = open(Path(tempfile.gettempdir()) / "orion_pafta_toplu.lock", "a+b")
        try:
            if os.fstat(self.file.fileno()).st_size == 0:
                self.file.write(b"0")
                self.file.flush()
            self.file.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            self.file.close()
            raise RuntimeError("Başka bir toplu ayıklama çalışıyor. Bitmesini bekleyin.") from exc
        return self

    def __exit__(self, *args):
        self.file.close()


class TopluIs:
    def __init__(self, dosya, veri):
        self.dosya = Path(dosya)
        self.veri = veri

    @classmethod
    def olustur(cls, kaynak, dosyalar, hedef, onizleme=False):
        root = Path(kaynak).resolve(strict=True)
        unique = {}
        for path in dosyalar:
            p = Path(path).resolve(strict=True)
            p.relative_to(root)
            if not p.is_file() or p.suffix.lower() != ".dwg":
                raise ValueError(f"Geçerli bir DWG değil: {p}")
            unique[os.path.normcase(str(p))] = p
        if not unique:
            raise ValueError("İşlenecek DWG seçilmedi.")
        iid = uuid.uuid4().hex
        out = Path(hedef).resolve() / (datetime.now().strftime("Toplu_%Y%m%d_%H%M%S_") + iid[:8])
        out.mkdir(parents=True, exist_ok=False)
        jobs = []
        for p in unique.values():
            jobs.append({"id": uuid.uuid4().hex, "kaynak": str(p),
                         "goreli_yol": str(p.relative_to(root)), "durum": "bekliyor",
                         "deneme": 0, "pafta": 0, "pdf": 0, "hata": "", "cikti": ""})
        batch = cls(out / "toplu_is.json", {"surum": 1, "id": iid,
                    "kaynak": str(root), "onizleme": bool(onizleme), "isler": jobs})
        batch.kaydet()
        return batch

    @classmethod
    def ac(cls, dosya):
        path = Path(dosya).resolve(strict=True)
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("surum") != 1 or not isinstance(data.get("isler"), list):
            raise ValueError("Geçerli bir toplu işlem kaydı değil.")
        seen = set()
        for job in data["isler"]:
            iid = job.get("id", "")
            if len(iid) != 32 or any(c not in "0123456789abcdef" for c in iid) or iid in seen:
                raise ValueError("Geçersiz çizim kimliği.")
            seen.add(iid)
            if job.get("durum") not in ("bekliyor", "isleniyor", "tamamlandi", "hatali"):
                raise ValueError("Geçersiz işlem durumu.")
            if not Path(job["kaynak"]).is_absolute() or Path(job["kaynak"]).suffix.lower() != ".dwg":
                raise ValueError("Geçersiz kaynak yolu.")
        return cls(path, data)

    def kaydet(self):
        json_yaz(self.dosya, self.veri)

    def rapor(self):
        with (self.dosya.parent / "toplu_rapor.csv").open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["DWG", "Durum", "Deneme", "Pafta", "PDF", "Hata", "Çıktı"])
            for j in self.veri["isler"]:
                row = [j["goreli_yol"], j["durum"], j["deneme"], j["pafta"], j["pdf"], j["hata"], j["cikti"]]
                writer.writerow(["'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v for v in row])

    def calistir(self, olay=lambda *args: None, dur=None, sadece_hatalar=False, isci=None):
        dur = dur or threading.Event()
        isci = isci or cizim_calistir
        with CalismaKilidi():
            # Başka bir pencere kaydı bu sırada ilerletmiş olabilir.
            self.veri = self.ac(self.dosya).veri
            for job in self.veri["isler"]:
                if job["durum"] == "isleniyor":
                    job.update(durum="hatali", hata="Önceki işlem yarım kaldı; yeniden denenebilir.")
                    olay("durum", dict(job))
            self.kaydet()
            for job in self.veri["isler"]:
                if dur.is_set():
                    break
                uygun = job["durum"] == ("hatali" if sadece_hatalar else "bekliyor")
                if not uygun:
                    continue
                job.update(durum="isleniyor", hata="", pafta=0, pdf=0, cikti="")
                job["deneme"] += 1
                attempt = self.dosya.parent / job["id"] / f"deneme_{job['deneme']:03d}"
                self.kaydet()
                olay("durum", dict(job))
                try:
                    attempt.mkdir(parents=True, exist_ok=False)
                    job["cikti"] = str(attempt)
                    result = isci(Path(job["kaynak"]), attempt, self.veri["onizleme"],
                                  lambda line: olay("gunluk", line))
                    summary = result.get("ozet", {})
                    job["pafta"] = int(summary.get("pafta", 0))
                    job["pdf"] = int(summary.get("pdf_basarili", 0))
                    if summary.get("hata", 0):
                        raise RuntimeError(f"{summary['hata']} ayıklama/baskı hatası. İşlem günlüğünü inceleyin.")
                    if not job["pafta"]:
                        raise RuntimeError("Ayıklanabilecek pafta bulunamadı. Tanı raporunu inceleyin.")
                    if not self.veri["onizleme"] and not job["pdf"]:
                        raise RuntimeError("PDF üretilemedi. İşlem günlüğünü inceleyin.")
                    job["durum"] = "tamamlandi"
                except Exception as exc:
                    job.update(durum="hatali", hata=str(exc))
                self.kaydet()
                olay("durum", dict(job))
            self.rapor()


def cizim_calistir(kaynak, hedef, onizleme, log):
    if not kaynak.is_file():
        raise FileNotFoundError(f"DWG bulunamadı: {kaynak}")
    result_path = hedef / "_sonuc.json"
    cmd = [sys.executable, "-u", str(Path(__file__).with_name("pafta_ayikla.py")),
           str(kaynak), "--out", str(hedef), "--sonuc", str(result_path)]
    if onizleme:
        cmd.append("--dry-run")
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    with (hedef / "islem.log").open("w", encoding="utf-8") as logfile:
        with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              text=True, encoding="utf-8", errors="replace", env=env,
                              creationflags=flags) as proc:
            for line in proc.stdout:
                logfile.write(line)
                logfile.flush()
                log(line.rstrip())
            code = proc.wait()
    if not result_path.is_file():
        raise RuntimeError(f"Sonuç üretilemedi (çıkış {code}). islem.log dosyasını inceleyin.")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    if code and not result.get("ozet", {}).get("hata"):
        raise RuntimeError(f"İşlem hata ile kapandı (çıkış {code}). islem.log dosyasını inceleyin.")
    return result
