# Magsika Workspace — Project Context

Admin dashboard internal untuk Magsika Studio: manajemen order, to-do tim, live queue klien, notifikasi, dan laporan bulanan.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + Python 3.7 (venv) |
| Database | MongoDB Atlas |
| Deploy | VPS `103.247.11.124` via GitHub Actions |
| Android APK | Capacitor 8.x (wrap React app) |
| Push Notif | Firebase Cloud Messaging (FCM) |

**Frontend URL (prod):** `https://workspace.magsikastudio.com`  
**Backend URL (prod):** `https://workspace.magsikastudio.com/api`  
**Dev server:** `npm run dev` → `http://localhost:5173`

---

## Struktur Folder

```
admin-dashboard/
├── frontend/               ← React + Vite
│   ├── src/
│   │   ├── pages/          ← halaman utama (Orders, Todo, Login, dll)
│   │   ├── components/     ← komponen reusable
│   │   ├── context/        ← React Context (Orders, Auth, Currency, dll)
│   │   └── lib/api.js      ← axios instance dengan auth header
│   ├── android/            ← Capacitor Android project
│   └── package.json
├── backend/
│   └── main.py             ← SEMUA endpoint FastAPI ada di sini (1 file)
├── .github/workflows/      ← GitHub Actions auto-deploy ke VPS
└── deploy.sh               ← script deploy di VPS
```

---

## Pola Penting — WAJIB DIINGAT

### 1. `format_order()` di backend adalah whitelist eksplisit
`backend/main.py` punya fungsi `format_order(record)` yang hanya mereturn field yang terdaftar.
**Jika tambah field baru ke Order, WAJIB tambahkan juga ke `format_order()`.**
Field yang tidak ada di sana akan selalu di-strip dari response API meski sudah tersimpan di MongoDB.

```python
# Contoh field yang harus ada di format_order():
"stream_allowed": record.get("stream_allowed", False),
"status_auto_updated": record.get("status_auto_updated", False),
"status_auto_source": record.get("status_auto_source", ""),
```

### 2. Order schema: `OrderCreate` dan `OrderUpdate`
Field baru harus ditambah ke **keduanya**, tidak cukup salah satu.

### 3. `useNow()` hook
`Date.now()` yang di-update setiap detik. Dipakai di To-Do untuk timer real-time.
```js
const now = useNow(); // dari context/NowContext
```

### 4. Schedule estimasi di To-Do
Dihitung di `ArtistSection` dengan `useMemo`. Cursor mulai dari `Math.max(WORK_START, nowMins)` — bukan dari 09:00 fixed.
Break 11:30–13:00 otomatis di-skip.

### 5. Deploy otomatis
Setiap `git push origin main` → GitHub Actions → deploy ke VPS.
Tidak perlu SSH manual untuk deploy.

---

## Commands

```bash
# Frontend dev
cd frontend && npm install && npm run dev

# Build Android APK
cd frontend
npm run build
npx cap sync android
cd android && .\gradlew assembleDebug

# Install APK ke HP (USB debug)
adb install -r app\build\outputs\apk\debug\app-debug.apk

# Deploy (otomatis via git push, tapi bisa manual)
git add . && git commit -m "pesan" && git push origin main
```

---

## VPS Info

| Item | Detail |
|------|--------|
| IP | 103.247.11.124 |
| OS | Debian, Python 3.7 |
| Service | `systemctl restart admin-dashboard` |
| Backend venv | `/root/admin-dashboard/backend/.venv/` |
| FCM key | `/root/admin-dashboard/backend/firebase-service-account.json` ← jangan commit |

```bash
# SSH ke VPS
ssh root@103.247.11.124

# Lihat log backend live
journalctl -u admin-dashboard -f
```

---

## Android / Capacitor

- App ID: `com.magsika.workspace`
- `capacitor.config.json`: `CapacitorHttp.enabled: true` (bypass CORS WebView)
- `VITE_BACKEND_URL=https://workspace.magsikastudio.com/api`
- `android/local.properties`: path ke Android SDK
- Firebase project: `magsika-workspace` (FCM)
- `google-services.json` ada di `frontend/android/app/` — **jangan commit**

### FCM Push Notif
- Pakai `firebase-admin < 6.0.0` (karena Python 3.7)
- Pakai `fb_messaging.send(msg)` loop per token (BUKAN `send_multicast`)
- Saat app killed: hanya push notif biasa, alarm overlay perlu tap notif dulu (belum ada fix native)

---

## Fitur Utama yang Sudah Ada

- **Orders** — CRUD order, filter, export PDF laporan bulanan
- **To-Do** — task per artist, drag-drop urutan, timer, estimasi jadwal real-time
- **Live Stream badge** — order bisa ditandai `stream_allowed`, muncul badge di To-Do
- **Failed task recovery** — admin/PM bisa tandai selesai task yang gagal karena lupa klik Done
- **Export PDF** — generate HTML A4 landscape, buka di tab baru, auto print dialog
- **Push notif FCM** — alarm task masuk (foreground: overlay merah, background: notif sistem)
- **Auto-status** — task yang melewati deadline otomatis jadi "Gagal" (via cron backend)
- **Chat Leads** — input leads per hari, tracking status (Discussing → Place Order)
- **Currency** — kurs USD/IDR bisa diset, dipakai di laporan dan display harga

---

## Akun

- Email: magsikastudio@gmail.com
- GitHub: github.com/magsikastudio-droid/workspace-magsika
