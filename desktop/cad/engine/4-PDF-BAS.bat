@echo off
chcp 65001 >nul
title Pafta Araci - PDF Basim
cd /d "%~dp0"

if "%~1"=="" goto kullanim
set "HEDEF=%~1"
goto calistir

:kullanim
echo.
echo   KULLANIM: Bir DWG dosyasini veya bir KLASORU
echo             bu dosyanin uzerine SURUKLEYIP BIRAKIN.
echo.
echo   Cikti, DWG'nin yanindaki PDF klasorune yazilir:
echo     PDF\0063-00-0405.pdf ...
echo     PDF\malzeme_listesi.xlsx
echo     PDF\pafta_raporu.csv
echo.
pause
exit /b 1

:calistir
set "PY=python"
python -c "import sys" >nul 2>&1 || set "PY=py -3"
echo.
echo Hedef: %HEDEF%
echo.
echo AutoCAD calisirken cizime DOKUNMAYIN. Islem bitene kadar bekleyin.
echo.
%PY% pafta_ayikla.py "%HEDEF%"
echo.
echo ------------------------------------------------------------
echo  Bitti. Cikti klasorunu acmak icin bir tusa basin.
echo ------------------------------------------------------------
pause >nul
if exist "%~dpn1_PDF" start "" "%~dpn1_PDF"
if exist "%HEDEF%" if not exist "%~dpn1_PDF" start "" "%HEDEF%"
