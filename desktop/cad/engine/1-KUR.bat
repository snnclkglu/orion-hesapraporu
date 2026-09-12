@echo off
chcp 65001 >nul
title Pafta Araci - Kurulum
cd /d "%~dp0"
echo.
echo ==========================================
echo   PAFTA AYIKLAMA ARACI - KURULUM
echo ==========================================
echo.

echo [1/4] Python aranıyor...
set "PY="
python -c "import sys" >nul 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY (
  py -3 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)
if not defined PY goto nopython

%PY% -c "import sys;print('     Bulundu:', sys.version.split()[0], '-', sys.executable)"
%PY% -c "import struct,sys; sys.exit(0 if struct.calcsize('P')*8==64 else 1)"
if errorlevel 1 (
  echo.
  echo     UYARI: 32-bit Python kurulu gorunuyor.
  echo     AutoCAD 64-bit oldugu icin 64-bit Python ONERILIR.
  echo     Genelde 32-bit de calisir; sorun cikarsa 64-bit Python kurun.
  echo.
  pause
)

echo.
echo [2/4] pip guncelleniyor...
%PY% -m pip install --upgrade pip

echo.
echo [3/4] Gerekli paketler kuruluyor (pywin32, openpyxl, ezdxf, pypdf)...
%PY% -m pip install --upgrade pywin32 openpyxl ezdxf pypdf
if errorlevel 1 goto piperror

echo.
echo [4/4] pywin32 COM kaydi yapiliyor...
%PY% -m pywin32_postinstall -install
if errorlevel 1 (
  echo.
  echo     Not: Bu adim yonetici yetkisi ister. Basarisiz olduysa sorun degil,
  echo     genelde yine de calisir. Calismazsa bu dosyayi sag tik ile
  echo     "Yonetici olarak calistir" yapin.
)

echo.
echo [KONTROL] Paketler dogrulaniyor...
%PY% -c "import win32com.client, openpyxl; print('     pywin32  : TAMAM'); print('     openpyxl : TAMAM')"
%PY% -c "import ezdxf; print('     ezdxf    : TAMAM')" 2>nul
%PY% -c "import pypdf; print('     pypdf    : TAMAM')" 2>nul

echo.
echo ==========================================
echo   KURULUM TAMAMLANDI
echo.
echo   Sirada: 2-CIHAZLARI-LISTELE.bat
echo ==========================================
echo.
pause
exit /b 0

:nopython
echo.
echo     PYTHON BULUNAMADI.
echo.
echo     1) https://www.python.org/downloads/windows/ adresine gidin
echo     2) "Windows installer (64-bit)" indirin
echo     3) Kurulum ekraninin EN ALTINDAKI
echo            [x] Add python.exe to PATH
echo        kutusunu MUTLAKA isaretleyin
echo     4) Kurulum bitince bu dosyayi tekrar calistirin
echo.
echo     Not: "python" yazinca Microsoft Store aciliyorsa:
echo     Ayarlar - Uygulamalar - Uygulama takma adlari
echo     bolumunden python.exe ve python3.exe seceneklerini KAPATIN.
echo.
pause
exit /b 1

:piperror
echo.
echo     Paket kurulumu basarisiz oldu.
echo     Internet baglantisi veya vekil sunucu (proxy) sorunu olabilir.
echo     Sirket agindaysaniz IT'den pypi.org erisimi isteyin.
echo.
pause
exit /b 1
