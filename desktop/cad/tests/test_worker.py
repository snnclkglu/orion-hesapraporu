import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker


class WorkerSafetyTests(unittest.TestCase):
    def test_windows_names(self):
        for name in ('../a.pdf', 'a/b.pdf', 'NUL.dwg', 'a:stream', 'a.pdf.', ' a.dwg', 'a\0.pdf'):
            self.assertFalse(worker.safe_name(name), name)
        self.assertTrue(worker.safe_name('KÖPRÜ YÜRÜTME.pdf'))

    def test_origin_rejects_credentials_and_external_http(self):
        for url in ('http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'file:///c:/a', 'https://example.com?x=y'):
            with self.assertRaises(ValueError):
                worker.validate_origin(url)
        self.assertEqual(worker.validate_origin('https://example.com/'), 'https://example.com')
        self.assertEqual(worker.validate_origin('http://localhost:3000'), 'http://localhost:3000')

    def test_storage_origin_is_bound_and_bearer_not_shared(self):
        api = worker.Api({'origin': 'https://example.com', 'storageOrigin': 'https://data.supabase.co', 'token': 'secret'})
        self.assertTrue(api.storage_url('https://data.supabase.co/a').endswith('/a'))
        for url in ('https://other.example/a', 'http://data.supabase.co/a', 'https://user@data.supabase.co/a'):
            with self.assertRaises(ValueError):
                api.storage_url(url)

    def make_output(self, root, pdf=True, errors=0, repeated=False):
        folder = root / 'output'; folder.mkdir()
        if pdf:
            (folder / 'A.pdf').write_bytes(b'%PDF-1.7\nfixture')
        sheets = [{'pdf': 'A.pdf'}] * (2 if repeated else 1)
        value = {'arac_surum': 'test', 'ozet': {'pafta': len(sheets), 'pdf_basarili': len(sheets), 'hata': errors}, 'paftalar': sheets, 'cikti_klasoru': str(folder)}
        report = root / 'raw.json'; report.write_text(json.dumps(value), encoding='utf-8')
        return folder, report

    def test_outputs_require_all_distinct_real_pdfs(self):
        for options in ({'pdf': False}, {'errors': 1}, {'repeated': True}):
            with tempfile.TemporaryDirectory() as tmp:
                folder, report = self.make_output(Path(tmp), **options)
                with self.assertRaises(ValueError):
                    worker.output_files(folder, report)

    def test_result_strips_local_path_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, report = self.make_output(Path(tmp))
            first = worker.output_files(folder, report)
            second = worker.output_files(folder, report)
            self.assertEqual([p.name for p, _ in first], [p.name for p, _ in second])
            self.assertNotIn('cikti_klasoru', json.loads((folder/'result.json').read_text(encoding='utf-8')))

    def test_hash_covers_content_and_atomic_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)/'state.json'
            worker.save_json(target, {'name': 'KÖPRÜ'})
            a = worker.digest(target)
            worker.save_json(target, {'name': 'BAŞKİRİŞ'})
            self.assertNotEqual(a, worker.digest(target))
            self.assertFalse(target.with_suffix('.json.tmp').exists())

    def test_export_workbook_preserves_values_and_never_executes_formulas(self):
        from openpyxl import load_workbook
        with tempfile.TemporaryDirectory() as tmp:
            target = worker.write_export_workbook(Path(tmp), {"malzeme": [{"resim_no": "0026-01-0110", "tanim": "=1+1", "adet": "4", "birim_agirlik": "1,25", "toplam_agirlik": "5", "pafta": "0026-01-0100"}]})
            book = load_workbook(target)
            self.assertEqual(book.sheetnames, ["BOM"])
            sheet = book.active
            self.assertEqual(sheet['A1'].value, 'Part Number')
            self.assertEqual(sheet['B2'].value, '=1+1')
            self.assertEqual(sheet['B2'].data_type, 's')
            self.assertEqual(sheet['D2'].value, '4')
            self.assertEqual(sheet['E2'].value, '1,25')
            book.close()

    def test_no_global_autocad_termination(self):
        source = Path(worker.__file__).read_text(encoding='utf-8')
        self.assertNotIn('["taskkill"', source)
        self.assertNotIn('.Quit(', source)
        self.assertIn('process.terminate()', source)
        self.assertIn('int(acad.Documents.Count) != 0', source)


if __name__ == '__main__':
    unittest.main()
