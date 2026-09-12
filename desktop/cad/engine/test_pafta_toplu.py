"""AutoCAD olmadan kuyruk, çıktı izolasyonu ve yeniden deneme testleri."""
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from pafta_toplu import CalismaKilidi, TopluIs, cizim_calistir, tara


class TopluTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        lock_temp = patch("pafta_toplu.tempfile.gettempdir", return_value=str(self.root))
        lock_temp.start()
        self.addCleanup(lock_temp.stop)
        self.src = self.root / "Çizimler"
        self.src.mkdir()
        self.out = self.root / "çıktı"

    def dwg(self, name):
        p = self.src / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"test fixture, not a real drawing")
        return p

    @staticmethod
    def ok(source, output, preview, log):
        return {"ozet": {"pafta": 3, "pdf_basarili": 0 if preview else 3, "hata": 0}}

    def batch(self, paths, preview=False):
        return TopluIs.olustur(self.src, paths, self.out, preview)

    def test_scan_filters_and_recursion(self):
        a = self.dwg("baş kiriş.DWG")
        b = self.dwg("alt/baş kiriş.dwg")
        self.dwg("~kilit.dwg")
        self.dwg("bilgi.txt")
        (self.src / "klasor.dwg").mkdir()
        self.assertEqual(tara(self.src), [a])
        self.assertEqual(set(tara(self.src, True)), {a, b})

    def test_empty_folder_and_empty_selection(self):
        self.assertEqual(tara(self.src), [])
        with self.assertRaises(ValueError):
            self.batch([])

    def test_duplicate_source_and_same_name_isolation(self):
        a, b = self.dwg("a/x.dwg"), self.dwg("b/x.dwg")
        batch = self.batch([a, a, b])
        calls = []
        def run(source, output, preview, log):
            calls.append(output)
            return self.ok(source, output, preview, log)
        batch.calistir(isci=run)
        self.assertEqual(len(calls), 2)
        self.assertNotEqual(calls[0], calls[1])
        self.assertTrue(all(j["durum"] == "tamamlandi" for j in batch.veri["isler"]))
        self.assertTrue((batch.dosya.parent / "toplu_rapor.csv").is_file())

    def test_failure_continues_and_retry_only_failed(self):
        batch = self.batch([self.dwg("a.dwg"), self.dwg("b.dwg")])
        def fail_one(source, output, preview, log):
            if source.name == "a.dwg":
                raise RuntimeError("Bozuk çizim")
            return self.ok(source, output, preview, log)
        batch.calistir(isci=fail_one)
        self.assertEqual([j["durum"] for j in batch.veri["isler"]], ["hatali", "tamamlandi"])
        old = batch.veri["isler"][0]["cikti"]
        reopened = TopluIs.ac(batch.dosya)
        reopened.calistir(sadece_hatalar=True, isci=self.ok)
        self.assertEqual([j["deneme"] for j in reopened.veri["isler"]], [2, 1])
        self.assertNotEqual(old, reopened.veri["isler"][0]["cikti"])
        self.assertTrue(Path(old).is_dir())

    def test_stop_finishes_current_and_resume_skips_success(self):
        batch = self.batch([self.dwg("a.dwg"), self.dwg("b.dwg")])
        stop = threading.Event()
        def run(*args):
            stop.set()
            return self.ok(*args)
        batch.calistir(dur=stop, isci=run)
        self.assertEqual([j["durum"] for j in batch.veri["isler"]], ["tamamlandi", "bekliyor"])
        TopluIs.ac(batch.dosya).calistir(isci=self.ok)
        self.assertEqual([j["deneme"] for j in TopluIs.ac(batch.dosya).veri["isler"]], [1, 1])

    def test_interrupted_job_can_be_retried(self):
        batch = self.batch([self.dwg("x.dwg")])
        batch.veri["isler"][0].update(durum="isleniyor", deneme=1)
        batch.kaydet()
        batch.calistir(sadece_hatalar=True, isci=self.ok)
        self.assertEqual(batch.veri["isler"][0]["durum"], "tamamlandi")
        self.assertEqual(batch.veri["isler"][0]["deneme"], 2)

    def test_preview_accepts_no_pdf_but_empty_drawing_fails(self):
        batch = self.batch([self.dwg("x.dwg")], True)
        batch.calistir(isci=self.ok)
        self.assertEqual(batch.veri["isler"][0]["durum"], "tamamlandi")
        batch = self.batch([self.src / "x.dwg"], True)
        batch.calistir(isci=lambda *a: {"ozet": {"pafta": 0}})
        self.assertEqual(batch.veri["isler"][0]["durum"], "hatali")

    def test_partial_pdf_failure_preserves_counts(self):
        batch = self.batch([self.dwg("x.dwg")])
        batch.calistir(isci=lambda *a: {"ozet": {"pafta": 3, "pdf_basarili": 2, "hata": 1}})
        self.assertEqual(batch.veri["isler"][0]["durum"], "hatali")
        self.assertEqual(batch.veri["isler"][0]["pdf"], 2)

    def test_no_pdf_is_failure(self):
        batch = self.batch([self.dwg("x.dwg")])
        batch.calistir(isci=lambda *a: {"ozet": {"pafta": 3, "pdf_basarili": 0}})
        self.assertEqual(batch.veri["isler"][0]["durum"], "hatali")

    def test_lock_prevents_second_runner(self):
        batch = self.batch([self.dwg("x.dwg")])
        with CalismaKilidi():
            with self.assertRaises(RuntimeError):
                batch.calistir(isci=self.ok)
        self.assertEqual(TopluIs.ac(batch.dosya).veri["isler"][0]["deneme"], 0)

    def test_stale_window_reloads_completed_state(self):
        batch = self.batch([self.dwg("x.dwg")])
        stale = TopluIs.ac(batch.dosya)
        batch.calistir(isci=self.ok)
        calls = []
        stale.calistir(isci=lambda *a: calls.append(a))
        self.assertEqual(calls, [])
        self.assertEqual(stale.veri["isler"][0]["durum"], "tamamlandi")

    def test_missing_source_fails_and_next_continues(self):
        a = self.dwg("a.dwg")
        batch = self.batch([a, self.dwg("b.dwg")])
        a.unlink()
        def run(source, *args):
            if not source.is_file():
                return cizim_calistir(source, *args)
            return self.ok(source, *args)
        batch.calistir(isci=run)
        self.assertEqual([j["durum"] for j in batch.veri["isler"]], ["hatali", "tamamlandi"])

    def test_bad_manifest_id_rejected(self):
        batch = self.batch([self.dwg("x.dwg")])
        batch.veri["isler"][0]["id"] = "../../escape"
        batch.kaydet()
        with self.assertRaises(ValueError):
            TopluIs.ac(batch.dosya)

    def test_unresolved_open_document_is_not_closed(self):
        import pafta_ayikla
        opened = Mock()
        with patch.object(pafta_ayikla, "already_open", return_value=opened), patch.object(pafta_ayikla, "_as_document", return_value=None):
            with self.assertRaises(RuntimeError):
                pafta_ayikla.open_document(Mock(), "acik.dwg")
        opened.Close.assert_not_called()

    def test_real_subprocess_protocol_without_autocad(self):
        source = self.dwg("boşluk ve Türkçe.dwg")
        output = self.root / "sonuç"
        output.mkdir()
        original = subprocess.Popen
        def fake_engine(cmd, **kwargs):
            self.assertIn(str(source), cmd)
            self.assertIn("--dry-run", cmd)
            code = "import json,sys; print('İlerleme'); json.dump({'ozet': {'pafta': 2, 'hata': 0}},open(sys.argv[1],'w'))"
            return original([cmd[0], "-u", "-c", code, str(output / "_sonuc.json")], **kwargs)
        lines = []
        with patch("pafta_toplu.subprocess.Popen", side_effect=fake_engine):
            result = cizim_calistir(source, output, True, lines.append)
        self.assertEqual(result["ozet"]["pafta"], 2)
        self.assertEqual(lines, ["İlerleme"])
        self.assertIn("İlerleme", (output / "islem.log").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
