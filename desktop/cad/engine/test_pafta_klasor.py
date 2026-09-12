"""Gerçek Tk penceresinde (gizli) dosya listesi ve kuyruk bağlantısı testi."""
from pathlib import Path
import tempfile
import time
import tkinter as tk
import unittest
from unittest.mock import patch

from pafta_klasor import Pencere


class PencereTest(unittest.TestCase):
    def test_scan_remove_run_and_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "dwg"
            source.mkdir()
            for name in ("a.dwg", "b.dwg", "c.dwg"):
                (source / name).write_bytes(b"fake")
            root = tk.Tk()
            root.withdraw()
            lock_temp = patch("pafta_toplu.tempfile.gettempdir", return_value=tmp)
            lock_temp.start()
            app = Pencere(root)
            def wait():
                deadline = time.monotonic() + 8
                while app.busy and time.monotonic() < deadline:
                    root.update()
                    time.sleep(.01)
                self.assertFalse(app.busy)
            try:
                app.kaynak.set(str(source))
                app.hedef.set(str(Path(tmp) / "out"))
                app.tara()
                wait()
                self.assertEqual(len(app.tree.get_children()), 3)
                app.tree.selection_set("2")
                app.cikar()
                self.assertEqual(len(app.tree.get_children()), 2)
                def runner(source, output, preview, log):
                    log("İşleniyor")
                    if source.name == "a.dwg":
                        raise RuntimeError("örnek hata")
                    return {"ozet": {"pafta": 2, "pdf_basarili": 2}}
                with patch("pafta_toplu.cizim_calistir", side_effect=runner), patch("pafta_klasor.messagebox.showerror") as error:
                    app.baslat()
                    wait()
                    error.assert_not_called()
                self.assertIn("1 hata", app.ozet.get())
                self.assertEqual(len(app.tree.get_children()), 2)
                with patch("pafta_toplu.cizim_calistir", return_value={"ozet": {"pafta": 2, "pdf_basarili": 2}}):
                    app.baslat(True)
                    wait()
                self.assertIn("2 tamamlandı", app.ozet.get())
                self.assertIn("4 PDF", app.ozet.get())
                self.assertEqual([j["deneme"] for j in app.batch.veri["isler"]], [2, 1])
            finally:
                lock_temp.stop()
                for event in root.tk.call("after", "info"):
                    root.after_cancel(event)
                root.destroy()


if __name__ == "__main__":
    unittest.main()
