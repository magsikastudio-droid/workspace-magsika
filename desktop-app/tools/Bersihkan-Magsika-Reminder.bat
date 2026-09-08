@echo off
title Bersihkan Sisa Magsika Reminder
echo ============================================
echo   Membersihkan sisa Magsika Reminder lama...
echo ============================================
echo.

:: cek admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Harus dijalankan sebagai Administrator.
    echo     Klik kanan file ini -^> "Run as administrator"
    pause
    exit /b 1
)

echo [1/3] Matikan proses yang masih nyangkut...
taskkill /F /IM "Magsika Reminder.exe" /T >nul 2>&1

echo [2/3] Hapus entry auto-start di registry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Magsika Reminder" /f >nul 2>&1

echo [3/3] Hapus folder data lama...
rd /s /q "%APPDATA%\Magsika Reminder" >nul 2>&1

echo.
echo ============================================
echo   Selesai! Sisa Magsika Reminder sudah bersih.
echo   Sekarang install ulang versi terbaru ya.
echo ============================================
pause
