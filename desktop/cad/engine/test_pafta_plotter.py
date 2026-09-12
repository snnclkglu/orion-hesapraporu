from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import unittest
import zlib

from pafta_plotter import HEADER, goruntuleyiciyi_kapat, sessiz_pdf_plotter


def pack(plain):
    compressed = zlib.compress(plain)
    return HEADER + struct.pack("<III", zlib.adler32(compressed), len(plain), len(compressed)) + compressed


class PlotterTest(unittest.TestCase):
    def test_only_viewer_setting_changes(self):
        plain = b'custom{\n 0{\n name="View_New_File\n value=TRUE\n }\n 1{\n name="Other\n value=TRUE\n }\n}\n'
        result = goruntuleyiciyi_kapat(pack(plain))
        self.assertEqual(zlib.decompress(result[60:]), plain.replace(b'value=TRUE', b'value=FALSE', 1))
        self.assertEqual(goruntuleyiciyi_kapat(result), result)

    def test_invalid_and_unknown_configuration_rejected(self):
        for data in (b"bad", pack(b"other settings"), pack(b"test")[:-1]):
            with self.assertRaises(ValueError):
                goruntuleyiciyi_kapat(data)

    def test_original_preserved_and_copy_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "DWG To PDF.pc3"
            original = pack(b'custom{\n name="View_New_File\n value=TRUE\n}\n')
            source.write_bytes(original)
            acad = SimpleNamespace(Preferences=SimpleNamespace(Files=SimpleNamespace(PrinterConfigPath=tmp)))
            name = sessiz_pdf_plotter(acad, source.name)
            target = Path(tmp) / name
            timestamp = target.stat().st_mtime_ns
            self.assertEqual(source.read_bytes(), original)
            self.assertIn(b"value=FALSE", zlib.decompress(target.read_bytes()[60:]))
            self.assertEqual(sessiz_pdf_plotter(acad, source.name), name)
            self.assertEqual(target.stat().st_mtime_ns, timestamp)


if __name__ == "__main__":
    unittest.main()
