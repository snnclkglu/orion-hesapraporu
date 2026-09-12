"""AutoCAD PDF yazıcısının görüntüleyici açmayan kopyasını hazırlar."""
from pathlib import Path
import re
import struct
import zlib


HEADER = b"PIAFILEVERSION_2.0,PC3VER1,compress\r\npmzlibcodec"
VIEW = re.compile(rb'(name="View_New_File\s+value=)(TRUE|FALSE)(?=\s*\})')


def goruntuleyiciyi_kapat(data: bytes) -> bytes:
    """Diğer PC3 ayarlarını koruyarak yalnız View_New_File değerini kapatır."""
    if not data.startswith(HEADER) or len(data) < 60:
        raise ValueError("PDF yazıcısının PC3 biçimi desteklenmiyor.")
    checksum, plain_size, compressed_size = struct.unpack("<III", data[48:60])
    compressed = data[60:]
    if len(compressed) != compressed_size or zlib.adler32(compressed) != checksum:
        raise ValueError("PDF yazıcısının PC3 bütünlük kontrolü başarısız.")
    plain = zlib.decompress(compressed)
    if len(plain) != plain_size:
        raise ValueError("PDF yazıcısının PC3 uzunluğu geçersiz.")
    changed, count = VIEW.subn(rb"\g<1>FALSE", plain)
    if count != 1:
        raise ValueError("PDF yazıcısında otomatik görüntüleme ayarı bulunamadı.")
    if changed == plain:
        return data
    compressed = zlib.compress(changed)
    return HEADER + struct.pack("<III", zlib.adler32(compressed), len(changed), len(compressed)) + compressed


def sessiz_pdf_plotter(acad, device: str) -> str:
    """Asıl yazıcıya dokunmaz; ayıklama için ayrı PC3 kullanır."""
    directories = [Path(p.strip()) for p in str(acad.Preferences.Files.PrinterConfigPath).split(";") if p.strip()]
    candidate = Path(device)
    if candidate.is_absolute():
        source = candidate
    else:
        source = next((p / device for p in directories if (p / device).is_file()), None)
    if source is None or not source.is_file() or source.suffix.lower() != ".pc3":
        raise ValueError(f"PDF yazıcı ayarı bulunamadı: {device}")
    original = source.read_bytes()
    silent = goruntuleyiciyi_kapat(original)
    if silent == original:
        return device
    target = source.with_name("Orion_Sessiz_" + source.name)
    if not target.is_file() or target.read_bytes() != silent:
        temp = target.with_suffix(".pc3.tmp")
        temp.write_bytes(silent)
        temp.replace(target)
    return str(target) if candidate.is_absolute() else target.name
