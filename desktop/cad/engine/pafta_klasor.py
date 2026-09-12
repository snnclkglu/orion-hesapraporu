"""Klasör seçerek toplu pafta ayıklama penceresi (Python/Tkinter)."""
from __future__ import annotations

import os
from pathlib import Path
import queue
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from pafta_toplu import TopluIs, tara

ADLAR = {"bekliyor": "Bekliyor", "isleniyor": "İşleniyor", "tamamlandi": "Tamamlandı", "hatali": "Hata"}


class Pencere:
    def __init__(self, root):
        self.root = root
        root.title("Pafta Aracı — Klasörden toplu ayıkla")
        root.geometry("1060x720")
        root.minsize(820, 560)
        self.kaynak = tk.StringVar()
        self.hedef = tk.StringVar()
        self.alt = tk.BooleanVar(value=False)
        self.onizleme = tk.BooleanVar(value=False)
        self.ozet = tk.StringVar(value="Bir klasör seçerek başlayın.")
        self.dosyalar = []
        self.batch = None
        self.busy = False
        self.baslangic = None
        self.son_yenileme = 0.0
        self.events = queue.Queue()
        self.stop = threading.Event()
        self.controls = []
        self.sabit_controls = []
        panel = ttk.Frame(root, padding=16)
        panel.pack(fill="both", expand=True)
        ttk.Label(panel, text="Klasörden toplu ayıkla", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(panel, text="DWG’leri seçin; paftalar her çizim için ayrı klasörlerde hazırlansın.").pack(anchor="w", pady=(4, 12))
        for label, var, command in (("DWG klasörü", self.kaynak, self.kaynak_sec), ("Çıktı klasörü", self.hedef, self.hedef_sec)):
            row = ttk.Frame(panel)
            row.pack(fill="x", pady=3)
            ttk.Label(row, text=label, width=16).pack(side="left")
            ttk.Entry(row, textvariable=var, state="readonly").pack(side="left", fill="x", expand=True, padx=8)
            button = self.button(row, "Klasör seç…", command)
            button.pack(side="left")
            if var is self.hedef:
                self.sabit_controls.append(button)
        row = ttk.Frame(panel)
        row.pack(fill="x", pady=8)
        check = ttk.Checkbutton(row, text="Alt klasörleri de dahil et", variable=self.alt, command=self.tara)
        check.pack(side="left")
        self.controls.append(check)
        check = ttk.Checkbutton(row, text="Önizleme: PDF basmadan kontrol et", variable=self.onizleme)
        check.pack(side="left", padx=20)
        self.controls.append(check)
        self.sabit_controls.append(check)
        self.button(row, "Listeyi yenile", self.tara).pack(side="right")
        table = ttk.Frame(panel)
        table.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(table, columns=("dosya", "durum", "pafta", "pdf"), show="headings", selectmode="extended")
        for col, title, width in (("dosya", "DWG / alt klasör", 610), ("durum", "Durum", 120), ("pafta", "Pafta", 65), ("pdf", "PDF", 65)):
            self.tree.heading(col, text=title)
            self.tree.column(col, width=width, minwidth=60, stretch=col == "dosya")
        scroll = ttk.Scrollbar(table, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")
        self.tree.bind("<<TreeviewSelect>>", self.detay)
        row = ttk.Frame(panel)
        row.pack(fill="x", pady=8)
        self.button(row, "Seçilenleri listeden çıkar", self.cikar).pack(side="left")
        self.button(row, "Kayıtlı işlemi aç…", self.kayit_ac).pack(side="left", padx=8)
        ttk.Button(row, text="Seçilenin çıktısını aç", command=self.cikti_ac).pack(side="right")
        ttk.Label(panel, textvariable=self.ozet).pack(anchor="w", pady=4)
        self.progress = ttk.Progressbar(panel, mode="determinate")
        self.progress.pack(fill="x")
        self.log = tk.Text(panel, height=7, wrap="word", state="disabled", font=("Consolas", 9))
        self.log.pack(fill="x", pady=8)
        row = ttk.Frame(panel)
        row.pack(fill="x")
        self.button(row, "Tümünü ayıkla / Devam et", self.baslat).pack(side="left")
        self.button(row, "Hatalıları yeniden dene", lambda: self.baslat(True)).pack(side="left", padx=8)
        self.dur_button = ttk.Button(row, text="Bu çizim bitince durdur", command=self.durdur, state="disabled")
        self.dur_button.pack(side="left")
        ttk.Button(row, text="Sonuç klasörünü aç", command=self.sonuclar).pack(side="right")
        root.protocol("WM_DELETE_WINDOW", self.kapat)
        root.after(100, self.olaylari_al)

    def button(self, parent, text, command):
        b = ttk.Button(parent, text=text, command=command)
        self.controls.append(b)
        return b

    def mesgul(self, value):
        self.busy = value
        for widget in self.controls:
            widget.configure(state="disabled" if value else "normal")
        if self.batch:
            for widget in self.sabit_controls:
                widget.configure(state="disabled")
        self.dur_button.configure(state="normal" if value and self.batch else "disabled")

    def kaynak_sec(self):
        path = filedialog.askdirectory(title="DWG dosyalarının bulunduğu klasör")
        if path:
            self.kaynak.set(path)
            self.hedef.set(str(Path(path) / "Toplu_Cikti"))
            self.tara()

    def hedef_sec(self):
        path = filedialog.askdirectory(title="Çıktıların kaydedileceği üst klasör")
        if path:
            self.hedef.set(path)

    def tara(self):
        if not self.kaynak.get() or self.busy:
            return
        self.batch = None
        self.dosyalar = []
        self.tree.delete(*self.tree.get_children())
        self.progress["value"] = 0
        self.ozet.set("DWG dosyaları aranıyor…")
        source, recursive = self.kaynak.get(), self.alt.get()
        self.mesgul(True)
        def work():
            try:
                self.events.put(("tarandi", tara(source, recursive)))
            except Exception as exc:
                self.events.put(("hata", str(exc)))
            finally:
                self.events.put(("bitti", None))
        threading.Thread(target=work, daemon=True).start()

    def cikar(self):
        if self.batch:
            messagebox.showinfo("Liste sabitlendi", "Başlatılmış işlemin listesi sabittir. Yeni liste için klasörü yeniden tarayın.")
            return
        for iid in self.tree.selection():
            self.tree.delete(iid)
        self.ozet.set(f"{len(self.tree.get_children())} DWG seçili. Başlatmaya hazır.")

    def kayit_ac(self):
        path = filedialog.askopenfilename(title="Önceki toplu işlemi aç", filetypes=[("Toplu işlem kaydı", "toplu_is.json")])
        if not path:
            return
        try:
            self.batch = TopluIs.ac(path)
            self.kaynak.set(self.batch.veri["kaynak"])
            self.hedef.set(str(self.batch.dosya.parent.parent))
            self.onizleme.set(self.batch.veri["onizleme"])
            self.tree.delete(*self.tree.get_children())
            for j in self.batch.veri["isler"]:
                self.satir(j)
            self.ozetle()
            self.mesgul(False)
            self.yaz("Kayıt açıldı. Yarım kalan işler yeniden deneme sırasında hata olarak işaretlenir.")
        except Exception as exc:
            self.batch = None
            messagebox.showerror("Kayıt açılamadı", str(exc))

    def baslat(self, hatalar=False):
        if self.busy:
            return
        try:
            if not self.batch:
                if hatalar:
                    raise ValueError("Önce bir işlem başlatın veya kayıtlı işlemi açın.")
                if not self.hedef.get():
                    raise ValueError("Çıktı klasörü seçin.")
                files = [self.dosyalar[int(i)] for i in self.tree.get_children()]
                self.batch = TopluIs.olustur(self.kaynak.get(), files, self.hedef.get(), self.onizleme.get())
                self.tree.delete(*self.tree.get_children())
                for j in self.batch.veri["isler"]:
                    self.satir(j)
            self.onizleme.set(self.batch.veri["onizleme"])
            self.stop.clear()
            self.baslangic = time.monotonic()
            self.mesgul(True)
            self.yaz("İşlem başladı. AutoCAD'de işlem bitene kadar çizimleri düzenlemeyin.")
            def work():
                try:
                    self.batch.calistir(lambda kind, data: self.events.put((kind, data)), self.stop, hatalar)
                except Exception as exc:
                    self.events.put(("hata", str(exc)))
                finally:
                    self.events.put(("bitti", None))
            threading.Thread(target=work, daemon=False).start()
        except Exception as exc:
            self.mesgul(False)
            messagebox.showerror("Başlatılamadı", str(exc))

    def satir(self, j):
        values = (j["goreli_yol"], ADLAR[j["durum"]], j["pafta"], j["pdf"])
        if self.tree.exists(j["id"]):
            self.tree.item(j["id"], values=values)
        else:
            self.tree.insert("", "end", iid=j["id"], values=values)

    def ozetle(self):
        if not self.batch:
            return
        jobs = self.batch.veri["isler"]
        ok = sum(j["durum"] == "tamamlandi" for j in jobs)
        err = sum(j["durum"] == "hatali" for j in jobs)
        pdf = sum(j["pdf"] for j in jobs)
        pafta = sum(j["pafta"] for j in jobs)
        mode = "Önizleme · " if self.batch.veri["onizleme"] else ""
        zaman = ""
        if self.busy and self.baslangic is not None:
            dakika, saniye = divmod(int(time.monotonic() - self.baslangic), 60)
            zaman = f" · Çalışıyor ({dakika:02d}:{saniye:02d})"
        self.ozet.set(f"{mode}{len(jobs)} DWG · {ok} tamamlandı · {err} hata · {pafta} pafta · {pdf} PDF" + zaman)
        self.progress.configure(maximum=max(1, len(jobs)), value=ok + err)

    def yaz(self, text):
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        if int(self.log.index("end-1c").split(".")[0]) > 600:
            self.log.delete("1.0", "101.0")
        self.log.see("end")
        self.log.configure(state="disabled")

    def olaylari_al(self):
        for _ in range(150):
            try:
                kind, data = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == "tarandi":
                self.dosyalar = data
                source = Path(self.kaynak.get()).resolve()
                for i, p in enumerate(data):
                    self.tree.insert("", "end", iid=str(i), values=(str(p.relative_to(source)), "Bekliyor", "—", "—"))
                self.ozet.set(f"{len(data)} DWG bulundu." if data else "Bu klasörde DWG bulunamadı.")
            elif kind == "durum":
                self.satir(data)
                self.ozetle()
                if data["hata"]:
                    self.yaz(f"HATA — {data['goreli_yol']}: {data['hata']}")
            elif kind == "gunluk":
                self.yaz(data)
            elif kind == "hata":
                self.yaz(data)
                messagebox.showerror("İşlem tamamlanamadı", data)
            elif kind == "bitti":
                self.mesgul(False)
                if self.batch:
                    for j in self.batch.veri["isler"]:
                        self.satir(j)
                    self.ozetle()
                    self.yaz("Durduruldu; bekleyenlere daha sonra devam edebilirsiniz." if self.stop.is_set() else "İşlem turu bitti. Sonuçları ve varsa hataları kontrol edin.")
        if self.busy and self.batch and time.monotonic() - self.son_yenileme >= 1:
            self.son_yenileme = time.monotonic()
            self.ozetle()
        self.root.after(100, self.olaylari_al)

    def secilen(self):
        ids = self.tree.selection()
        return next((j for j in self.batch.veri["isler"] if ids and j["id"] == ids[0]), None) if self.batch else None

    def detay(self, event=None):
        j = self.secilen()
        if j and j["hata"]:
            self.yaz(f"{j['goreli_yol']}: {j['hata']}")

    def cikti_ac(self):
        j = self.secilen()
        if j and j["cikti"] and Path(j["cikti"]).is_dir():
            os.startfile(j["cikti"])

    def sonuclar(self):
        if self.batch:
            os.startfile(str(self.batch.dosya.parent))

    def durdur(self):
        self.stop.set()
        self.dur_button.configure(state="disabled")
        self.yaz("Durdurma istendi. Devam eden DWG tamamlanacak; sonraki çizime geçilmeyecek.")

    def kapat(self):
        if self.busy:
            self.durdur()
            messagebox.showinfo("İşlem sürüyor", "Devam eden işlem tamamlanınca pencereyi kapatabilirsiniz.")
            return
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    Pencere(root)
    root.mainloop()
