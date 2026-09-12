$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    python -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Bağımlılık kurulumu tamamlanamadı.' }
    python -m PyInstaller --noconfirm --clean --onefile --windowed --name OrionCadYardimcisi --paths engine --hidden-import pafta_ayikla --hidden-import pafta_core --hidden-import pafta_plotter --hidden-import pafta_tani --hidden-import pafta_report --hidden-import win32com.client --hidden-import win32timezone --hidden-import win32crypt --collect-submodules pypdf worker.py
    if ($LASTEXITCODE -ne 0) { throw 'Yardımcı paketi üretilemedi.' }
    Get-FileHash -LiteralPath 'dist\OrionCadYardimcisi.exe' -Algorithm SHA256
} finally { Pop-Location }
