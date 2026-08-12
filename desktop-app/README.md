# Magsika Reminder (Desktop App)

App tray kecil buat laptop tim. Sekali login, langsung:

- **Auto-nyala** tiap laptop di-boot (tidak perlu buka apa-apa manual)
- **Jalan di background** tanpa browser dibuka sama sekali — tetap konek ke server lewat WebSocket
- Kalau ada reminder **"Belum Mulai Kerja"** (idle 5 menit padahal ada task pending) atau **task menunggu review** → layar **full-screen merah** + bunyi alarm + suara TTS, tidak bisa diabaikan diam-diam. Harus klik tombol "Oke, Saya Mulai Sekarang" (yang otomatis buka dashboard) baru hilang.

Ini terpisah dari [frontend](../frontend) (web) dan `frontend/android` (app HP) — sengaja dipisah supaya perubahan di salah satu tidak ikut mempengaruhi yang lain. Semua tiga sama-sama ngobrol ke [backend](../backend) yang sama.

## Cara pakai (development / testing)

```bash
cd desktop-app
npm install
npm start
```

Login pakai akun workspace (email + password) yang sudah ada. Coba minta admin bikin task pending buat kamu, tunggu 5 menit tanpa klik "Mulai" di web — alarm full-screen harusnya muncul otomatis di laptop ini walau tanpa browser kebuka.

Testing ke backend lokal (bukan VPS produksi):
```bash
MAGSIKA_BACKEND_URL=http://localhost:8001 MAGSIKA_WEB_URL=http://localhost:5173 npm start
```

## Build installer buat dibagikan ke tim

```bash
npm run build
```

Hasilnya installer `.exe` (NSIS) ada di folder `dist/`. Kirim file itu ke laptop tim, mereka tinggal install & login sekali — setelahnya jalan otomatis terus tiap laptop nyala.

**Update ke depan:** kalau ada perubahan di file-file `desktop-app/`, harus di-`npm run build` ulang dan installer baru dibagikan ulang manual ke tiap laptop (app ini belum punya auto-update). Kalau makin sering di-update, pertimbangkan tambah `electron-updater` + host file update-nya di VPS.

## Kenapa terpisah dari frontend web?

Web app (React) butuh proses `build` (Vite) dan jalan di browser — tidak bisa auto-start atau bikin window full-screen yang "menutupi layar" begitu saja dari sana. Electron app ini punya akses OS-level (system tray, auto-launch saat boot, window always-on-top) yang browser tidak bisa berikan. Trade-off-nya: ini instalasi manual per laptop dan perlu di-update manual — beda dengan web yang otomatis ke-update begitu ada yang buka browser.
