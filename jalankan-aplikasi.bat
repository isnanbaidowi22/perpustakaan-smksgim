@echo off
title Aplikasi Perpustakaan
cd /d "%~dp0"
set "PATH=D:\nvm\nodejs;%PATH%"

echo Menyalakan aplikasi perpustakaan...
echo Jangan tutup jendela ini selama aplikasi dipakai.
echo.

rem Buka peramban setelah server sempat menyala.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"

call npm.cmd run dev
pause
