@echo off
chcp 65001 >nul
title Pafta Araci - Plotter / Kagit Listesi
cd /d "%~dp0"
echo.
echo AutoCAD'e baglaniliyor... (acik degilse acilacak, biraz surebilir)
echo.
set "PY=python"
python -c "import sys" >nul 2>&1 || set "PY=py -3"
%PY% pafta_ayikla.py --liste-cihazlar
echo.
echo ------------------------------------------------------------
echo  Yukaridaki KAGIT listesinde su satiri arayin:
echo     420.00 x  297.00 mm [full bleed]  ISO_full_bleed_A3_...
echo.
echo  Varsa: cerceve kagida tam oturur, hicbir sey yapmaniza gerek yok.
echo  Yoksa: PDF kenarlarindan birkac mm kirpilabilir (arac uyarir).
echo ------------------------------------------------------------
echo.
pause
