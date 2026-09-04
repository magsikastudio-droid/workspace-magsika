; Custom NSIS hooks — app ini sengaja didesain jalan terus di tray/background
; (window-all-closed tidak ngequit app), jadi uninstaller BAWAAN electron-builder
; tidak otomatis matiin proses yang lagi jalan sebelum hapus file-nya.
;
; PENTING soal urutan: dari template asli electron-builder
; (node_modules/app-builder-lib/templates/nsis/uninstaller.nsh), macro
; `customUnInstall` di-insert PALING AKHIR di Section un.install — SETELAH
; `RMDir /r $INSTDIR` (hapus semua file app) dan setelah hapus AppData.
; Artinya kalau taskkill cuma ditaruh di customUnInstall, proses yang masih
; hidup itu file-nya sudah kehapus/rusak duluan pas masih jalan (bikin window
; yang lagi kebuka nampilin isi mentah/corrupt kayak kode CSS/JS ke-render
; sebagai teks biasa), baru DIBUNUH belakangan — telat, dan efek rusaknya
; (window korup) sudah kejadian duluan.
;
; Makanya taskkill utamanya ditaruh di `customUnInit`, yang jalan di
; Function un.onInit — SEBELUM Section un.install (jadi sebelum RMDir sama
; sekali) sehingga tidak ada proses yang masih baca/nulis file pas dihapus.
; `customUnInstall` tetap pasang taskkill juga sebagai jaring pengaman kedua,
; plus beres-beres registry & AppData.
;
; Macro ini di-include electron-builder otomatis lewat build.nsis.include di
; package.json — dijalanin pas install/update DAN pas uninstall.

!macro customInit
  ; Matiin instance lama dulu sebelum install/update baru, biar tidak "file in use"
  nsExec::Exec 'taskkill /F /IM "Magsika Reminder.exe" /T'
!macroend

!macro customUnInit
  ; Matiin proses SEBELUM file mulai dihapus (lihat catatan urutan di atas) —
  ; ini kuncinya biar window app tidak sempat baca file yang lagi dihapus
  ; separuh jalan dan jadi korup/nge-freeze.
  nsExec::Exec 'taskkill /F /IM "Magsika Reminder.exe" /T'
  Sleep 800
!macroend

!macro customUnInstall
  ; Jaring pengaman kedua, jaga-jaga ada instance yang somehow sempat kebuka lagi
  nsExec::Exec 'taskkill /F /IM "Magsika Reminder.exe" /T'
  Sleep 500

  ; Hapus entry auto-start (Run key) biar Windows tidak coba nyalain lagi
  ; app yang filenya sudah tidak ada pas laptop di-restart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Magsika Reminder"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"

  ; Hapus folder data app (session login, config) biar uninstall benar-benar bersih
  RMDir /r "$APPDATA\Magsika Reminder"
!macroend
