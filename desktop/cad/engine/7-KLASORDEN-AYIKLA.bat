@echo off
chcp 65001 >nul
title Pafta Araci - Klasorden Toplu Ayikla
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" pafta_klasor.py
  goto sonuc
)
python -c "import tkinter" >nul 2>&1
if not errorlevel 1 (
  python pafta_klasor.py
  goto sonuc
)
py -3 -c "import tkinter" >nul 2>&1
if not errorlevel 1 (
  py -3 pafta_klasor.py
  goto sonuc
)
echo Python ve Tkinter bulunamadi. Python kurulumunda Tcl/Tk secenegini etkinlestirin.
echo Ardindan 1-KUR.bat dosyasini calistirin.
pause
exit /b 1
:sonuc
if errorlevel 1 pause
