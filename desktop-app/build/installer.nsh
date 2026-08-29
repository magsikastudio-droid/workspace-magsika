; Custom NSIS hooks — app ini sengaja didesain jalan terus di tray/background
; (window-all-closed tidak ngequit app), jadi uninstaller BAWAAN electron-builder
; tidak otomatis matiin proses yang lagi jalan sebelum hapus file-nya. Akibatnya:
; app tetap hidup di memory (dan masih bisa munculin alarm dkk) walau file-nya
; sudah dihapus, dan entry auto-start-nya juga masih nyangkut di registry.
;
; Macro ini di-include electron-builder otomatis lewat build.nsis.include di
; package.json — dijalanin pas install/update DAN pas uninstall.

!macro customInit
  ; Matiin instance lama dulu sebelum install/update baru, biar tidak "file in use"
  nsExec::Exec 'taskkill /F /IM "Magsika Reminder.exe" /T'
!macroend

!macro customUnInstall
  ; Matiin proses yang lagi jalan (termasuk yang lagi nampilin alarm dkk)
  nsExec::Exec 'taskkill /F /IM "Magsika Reminder.exe" /T'
  Sleep 1000

  ; Hapus entry auto-start (Run key) biar Windows tidak coba nyalain lagi
  ; app yang filenya sudah tidak ada pas laptop di-restart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Magsika Reminder"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"

  ; Hapus folder data app (session login, config) biar uninstall benar-benar bersih
  RMDir /r "$APPDATA\Magsika Reminder"
!macroend
