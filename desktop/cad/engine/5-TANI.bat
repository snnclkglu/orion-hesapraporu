@echo off
chcp 65001 >nul
title Pafta Araci - TANI (sorun tespiti)
cd /d "%~dp0"

if "%~1"=="" goto kullanim
set "HEDEF=%~1"
goto calistir

:kullanim
echo.
echo   KULLANIM: Sorunlu DWG dosyasini bu dosyanin uzerine
echo             SURUKLEYIP BIRAKIN.
echo.
echo   Hicbir sey basmaz. Cizimdeki cerceveleri, antet etiketlerini,
echo   oznitelikleri ve tablolari ayrintili doker.
echo   Cikti ayrica  PDF\tani_<dosyaadi>.txt  olarak kaydedilir.
echo.
pause
exit /b 1

:calistir
set "PY=python"
python -c "import sys" >nul 2>&1 || set "PY=py -3"
echo.
echo Hedef: %HEDEF%
echo.
%PY% pafta_ayikla.py "%HEDEF%" --dry-run --tani
echo.
echo ------------------------------------------------------------
echo  Ciktinin tamamini kopyalayip paylasin.
echo  Dosya olarak da: PDF klasorundeki tani_*.txt
echo ------------------------------------------------------------
echo.
pause
