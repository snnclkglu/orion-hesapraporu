@echo off
chcp 65001 >nul
title Pafta Araci - Onizleme (PDF BASMAZ)
cd /d "%~dp0"

if "%~1"=="" goto kullanim
set "HEDEF=%~1"
goto calistir

:kullanim
echo.
echo   KULLANIM: Bir DWG dosyasini veya bir KLASORU
echo             bu dosyanin uzerine SURUKLEYIP BIRAKIN.
echo.
echo   Bu adim hicbir PDF basmaz. Sadece cizimde kac pafta var,
echo   resim numaralari ve olcekleri ne, malzeme listesinde kac
echo   satir var - onu gosterir.
echo.
pause
exit /b 1

:calistir
set "PY=python"
python -c "import sys" >nul 2>&1 || set "PY=py -3"
echo.
echo Hedef: %HEDEF%
echo.
%PY% pafta_ayikla.py "%HEDEF%" --dry-run
echo.
echo ------------------------------------------------------------
echo  Liste dogru gorunuyorsa 4-PDF-BAS.bat ile gercek cikti alin.
echo ------------------------------------------------------------
echo.
pause
