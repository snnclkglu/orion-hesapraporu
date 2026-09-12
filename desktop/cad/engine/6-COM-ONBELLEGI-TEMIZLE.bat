@echo off
chcp 65001 >nul
title Pafta Araci - COM onbellegini temizle
cd /d "%~dp0"

echo.
echo Bu islem pywin32'nin AutoCAD tip kutuphanesi onbellegini (gen_py)
echo siler. Arac bir sonraki calismada onu yeniden uretir.
echo.
echo Ne zaman gerekir:
echo   "AttributeError: Item.ModelSpace" veya "Open.ModelSpace" gibi
echo   hatalar aliyorsaniz.
echo.
echo AutoCAD ACIKSA once kapatin.
echo.
pause

set "PY=python"
python -c "import sys" >nul 2>&1 || set "PY=py -3"

echo.
echo Onbellek klasoru bulunuyor...
%PY% -c "from win32com.client import gencache; print(gencache.GetGeneratePath())"

echo.
echo Siliniyor...
%PY% -c "import shutil;from win32com.client import gencache;shutil.rmtree(gencache.GetGeneratePath(), ignore_errors=True);print('  silindi')"

echo.
echo Tip kutuphanesi yeniden uretiliyor (AutoCAD acilabilir, normaldir)...
%PY% -c "import win32com.client as w; a=w.gencache.EnsureDispatch('AutoCAD.Application'); print('  TAMAM:', a.Name, a.Version)"
if errorlevel 1 (
  echo.
  echo   Uretilemedi. AutoCAD kurulu ve calisabilir durumda mi kontrol edin.
) else (
  echo.
  echo   Hazir. Simdi 3-ONIZLEME.bat veya 4-PDF-BAS.bat calistirabilirsiniz.
)
echo.
pause
