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

echo [1/7] Jalankan uninstaller bawaan kalau masih ada...
if exist "C:\Program Files\Magsika Reminder\Uninstall Magsika Reminder.exe" (
    "C:\Program Files\Magsika Reminder\Uninstall Magsika Reminder.exe" /S _?=C:\Program Files\Magsika Reminder
    timeout /t 2 /nobreak >nul
)
if exist "%LOCALAPPDATA%\Programs\Magsika Reminder\Uninstall Magsika Reminder.exe" (
    "%LOCALAPPDATA%\Programs\Magsika Reminder\Uninstall Magsika Reminder.exe" /S _?=%LOCALAPPDATA%\Programs\Magsika Reminder
    timeout /t 2 /nobreak >nul
)

echo [2/7] Matikan proses yang masih nyangkut...
taskkill /F /IM "Magsika Reminder.exe" /T >nul 2>&1
timeout /t 1 /nobreak >nul

:: Entry auto-start yang beneran dipakai app (lewat app.setLoginItemSettings)
:: namanya "com.magsikastudio.reminder" (appId di package.json), BUKAN
:: "Magsika Reminder" -- makanya versi lama script ini gak pernah kehapus
:: entry-nya walau udah dijalanin, dan reminder tetap nyala lagi tiap restart.
echo [3/7] Hapus entry auto-start di registry (semua nama yang pernah dipakai)...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "com.magsikastudio.reminder" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Magsika Reminder" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "magsika-reminder" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "com.magsikastudio.reminder" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "Magsika Reminder" /f >nul 2>&1

echo [4/7] Hapus entry "Apps and Features" (uninstall registry) kalau ada...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.magsikastudio.reminder" /f >nul 2>&1
reg delete "HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\com.magsikastudio.reminder" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.magsikastudio.reminder" /f >nul 2>&1

:: Ini yang paling penting kelewat di versi lama: uninstaller bawaan gak
:: kepasang/kejalanin di banyak instalasi, jadi folder program-nya (isinya
:: exe + resources, ratusan MB) tetap ada di Program Files walau proses
:: udah dimatiin dan AppData udah dihapus -- makanya "reminder tetap ada".
echo [5/7] Hapus folder program terinstall...
rd /s /q "C:\Program Files\Magsika Reminder" >nul 2>&1
rd /s /q "C:\Program Files (x86)\Magsika Reminder" >nul 2>&1
rd /s /q "%LOCALAPPDATA%\Programs\Magsika Reminder" >nul 2>&1

echo [6/7] Hapus shortcut...
del /f /q "%USERPROFILE%\Desktop\Magsika Reminder.lnk" >nul 2>&1
del /f /q "%PUBLIC%\Desktop\Magsika Reminder.lnk" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Magsika Reminder.lnk" >nul 2>&1
del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Magsika Reminder.lnk" >nul 2>&1

echo [7/7] Hapus folder data & cache lama...
rd /s /q "%APPDATA%\Magsika Reminder" >nul 2>&1
rd /s /q "%LOCALAPPDATA%\magsika-reminder-updater" >nul 2>&1

echo.
echo ============================================
echo   Selesai! Sisa Magsika Reminder sudah bersih.
echo   Sekarang install ulang versi terbaru ya.
echo ============================================
pause
