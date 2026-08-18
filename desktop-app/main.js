const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen, Notification, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execFile } = require("child_process");
const crypto = require("crypto");
const https = require("https");
const WebSocket = require("ws");
const { autoUpdater } = require("electron-updater");

function notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch (_) {}
}

/* ── auto-update — persis kayak app Android, tim tidak perlu install ulang ──
 * electron-builder nge-publish installer + latest.yml ke VPS kalian sendiri
 * (provider "generic", lihat package.json). App ini cek berkala, download
 * di background, lalu install otomatis begitu aman (tidak lagi recording). */
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let updateReadyToInstall = false;

autoUpdater.on("update-available", (info) => {
  notify("⬇️ Update tersedia", `Magsika Reminder v${info.version} lagi didownload di background...`);
});
autoUpdater.on("update-downloaded", () => {
  updateReadyToInstall = true;
  if (activeRecording) {
    notify("🔄 Update siap", "Nunggu recording kamu selesai dulu, baru install otomatis.");
  } else {
    notify("🔄 Update siap", "App restart sendiri sebentar lagi buat pakai versi terbaru.");
    setTimeout(() => { if (!activeRecording) autoUpdater.quitAndInstall(false, true); }, 10000);
  }
});
autoUpdater.on("error", (err) => console.error("[autoUpdater] error:", err));

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((e) => console.error("[autoUpdater] check gagal:", e));
}

// Biar toast Windows nampilin "Magsika Reminder" sebagai pengirim, bukan
// "electron.app.Electron" bawaan default.
if (process.platform === "win32") {
  app.setAppUserModelId("com.magsikastudio.reminder");
}

// Laptop baru sering masih pakai driver display generic (belum di-update OEM),
// yang bikin GPU process Chromium crash pas render pertama. Paksa software
// rendering biar app tetap jalan walau driver GPU-nya belum ideal.
app.disableHardwareAcceleration();

// Crash logging — kalau masih ada apa-apa yang bikin app mati mendadak,
// paling tidak kelihatan di terminal, bukan diam-diam hilang.
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
app.on("render-process-gone", (event, wc, details) => console.error("[render-process-gone]", details));
app.on("child-process-gone", (event, details) => console.error("[child-process-gone]", details));

// Ganti via env var kalau perlu arahkan ke server lain (mis. testing lokal):
//   MAGSIKA_BACKEND_URL=http://localhost:8001 npm start
const BACKEND_URL = process.env.MAGSIKA_BACKEND_URL || "https://workspace.magsikastudio.com/api";
const WEB_URL = process.env.MAGSIKA_WEB_URL || "https://workspace.magsikastudio.com";
const WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/ws";

const CONFIG_PATH = path.join(app.getPath("userData"), "session.json");
const REMOTE_ACCESS_MARKER = path.join(app.getPath("userData"), "remote-access-configured.json");
const RUSTDESK_HOST = "workspace.magsikastudio.com";
const RUSTDESK_KEY = "W4jqtZ9xAHzpwD1O0J9WPS+mOxfkvz7dXDMthPe5Ioo=";
const RUSTDESK_INSTALLER_URL = `${WEB_URL}/downloads/desktop-app/rustdesk-installer.exe`;
const RUSTDESK_EXE = 'C:\\Program Files\\RustDesk\\rustdesk.exe';

let tray = null;
let loginWin = null;
let alarmWin = null;
let pickerWin = null;
let recorderWin = null;
let ws = null;
let wsReconnectTimer = null;
let session = null; // { token, user }
let pendingWork = null;   // { taskId, taskTitle, orderId } — nunggu dipilih layarnya di picker
let recorderInfo = null;  // sekali-pakai, dibaca recorder.html pas load
let activeRecording = null; // { taskTitle } kalau lagi ngerekam, buat tray menu

/* ── single instance — cegah dobel app kalau di-klik 2x ─────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (loginWin) loginWin.focus();
    else if (alarmWin) alarmWin.focus();
  });
}

/* ── session persist (token + user) ke userData, biar auto-login tiap laptop nyala ── */
function loadSession() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}
function saveSession(s) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(s));
}
function clearSession() {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {}
}

/* ── tray icon ─────────────────────────────────────────────────────── */
function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "icon.png"));
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
  tray.setToolTip("Magsika Reminder");
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const label = session?.user?.full_name ? `Login: ${session.user.full_name}` : "Belum login";
  const items = [
    { label, enabled: false },
    { type: "separator" },
  ];
  if (activeRecording) {
    items.push(
      { label: `🔴 Merekam: ${activeRecording.taskTitle}`, enabled: false },
      { label: "Berhenti Merekam", click: stopRecording },
      { type: "separator" }
    );
  }
  items.push(
    { label: "Buka Dashboard", click: () => shell.openExternal(WEB_URL) },
    isRemoteAccessConfigured()
      ? { label: "🖥️ Remote Access: Aktif ✓", enabled: false }
      : { label: "🖥️ Setup Remote Access", click: setupRemoteAccess, enabled: !!session },
    { label: `Cek Update (v${app.getVersion()})`, click: checkForUpdates },
    { label: "Login Ulang", click: doLogout, enabled: !!session },
    { type: "separator" },
    { label: "Keluar", click: () => { app.isQuitting = true; app.quit(); } }
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(activeRecording ? `Magsika Reminder — 🔴 Merekam: ${activeRecording.taskTitle}` : "Magsika Reminder");
}

/* ── "Setup Remote Access" — install+config RustDesk lewat tray, sekali
   klik, tanpa perlu terima file terpisah. Elevasi UAC cuma diminta untuk
   proses instalasinya doang, bukan seluruh app Magsika Reminder. ────── */
function isRemoteAccessConfigured() {
  return fs.existsSync(REMOTE_ACCESS_MARKER);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(destPath, () => {}); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

function runElevated(scriptPath) {
  return new Promise((resolve, reject) => {
    const psCmd = `try { Start-Process -FilePath 'cmd.exe' -ArgumentList '/c "${scriptPath}"' -Verb RunAs -Wait -ErrorAction Stop } catch { exit 1 }`;
    const ps = spawn("powershell.exe", ["-NoProfile", "-Command", psCmd]);
    ps.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Setup dibatalkan atau gagal (kode ${code})`))));
    ps.on("error", reject);
  });
}

// Best-effort: RustDesk itu app GUI tanpa console interaktif, tapi kalau
// stdout-nya di-pipe langsung dari Node (bukan lewat cmd.exe) biasanya masih
// kebaca. Kalau gagal/kosong, kita fallback minta orangnya lapor manual.
function tryGetRustDeskId() {
  return new Promise((resolve) => {
    execFile(RUSTDESK_EXE, ["--get-id"], { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(""); return; }
      const id = (stdout || "").trim();
      resolve(/^\d{6,12}$/.test(id) ? id : "");
    });
  });
}

async function reportRemoteAccess(rustdeskId, password) {
  try {
    const res = await fetch(`${BACKEND_URL}/me/remote-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ rustdesk_id: rustdeskId, rustdesk_password: password }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (e) {
    console.error("[reportRemoteAccess] gagal lapor ke backend:", e);
    return false;
  }
}

async function setupRemoteAccess() {
  if (!session) { notify("⚠️ Belum login", "Login dulu sebelum setup remote access."); return; }
  notify("🖥️ Setup Remote Access dimulai", "Mengunduh RustDesk... sebentar lagi akan minta izin Administrator.");

  const tmpDir = app.getPath("temp");
  const installerPath = path.join(tmpDir, "magsika-rustdesk-installer.exe");
  const scriptPath = path.join(tmpDir, "magsika-remote-setup.bat");
  const password = crypto.randomBytes(16).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

  try {
    await downloadFile(RUSTDESK_INSTALLER_URL, installerPath);

    const script = [
      "@echo off",
      `"${installerPath}" --silent-install`,
      "timeout /t 8 /nobreak",
      "taskkill /F /IM rustdesk.exe /T >nul 2>&1",
      "timeout /t 2 /nobreak >nul",
      `"${RUSTDESK_EXE}" --option custom-rendezvous-server ${RUSTDESK_HOST}`,
      "timeout /t 1 /nobreak >nul",
      `"${RUSTDESK_EXE}" --option relay-server ${RUSTDESK_HOST}`,
      "timeout /t 1 /nobreak >nul",
      `"${RUSTDESK_EXE}" --option key ${RUSTDESK_KEY}`,
      "timeout /t 1 /nobreak >nul",
      `"${RUSTDESK_EXE}" --option approve-mode password`,
      "timeout /t 1 /nobreak >nul",
      `"${RUSTDESK_EXE}" --password ${password}`,
    ].join("\r\n");
    fs.writeFileSync(scriptPath, script, "utf-8");

    await runElevated(scriptPath); // <- prompt UAC muncul di sini

    await new Promise((r) => setTimeout(r, 3000)); // kasih waktu service settle
    const rdId = await tryGetRustDeskId();

    fs.writeFileSync(REMOTE_ACCESS_MARKER, JSON.stringify({ configuredAt: new Date().toISOString(), rustdeskId: rdId }));
    updateTrayMenu();

    if (rdId) {
      const reported = await reportRemoteAccess(rdId, password);
      notify(
        reported ? "✅ Remote Access aktif" : "⚠️ Setup OK, lapor ke server gagal",
        reported ? `ID: ${rdId} — otomatis terdaftar, admin sudah bisa remote kapan saja.`
                 : `ID: ${rdId}, kasih tau admin manual (koneksi ke server gagal saat lapor otomatis).`
      );
    } else {
      notify("✅ Setup selesai — 1 langkah lagi", "Buka RustDesk dari Start Menu, lihat ID-nya, kasih tau admin manual (auto-detect ID gagal).");
      shell.openPath(RUSTDESK_EXE).catch(() => {});
    }
  } catch (e) {
    console.error("[setupRemoteAccess] error:", e);
    notify("⚠️ Gagal setup remote access", String(e.message || e));
  }
}

function doLogout() {
  clearSession();
  session = null;
  if (ws) { try { ws.close(); } catch {} ws = null; }
  app.setLoginItemSettings({ openAtLogin: false });
  updateTrayMenu();
  showLoginWindow();
}

/* ── login window ──────────────────────────────────────────────────── */
function showLoginWindow() {
  if (loginWin) { loginWin.focus(); return; }
  loginWin = new BrowserWindow({
    width: 380,
    height: 480,
    resizable: false,
    title: "Login — Magsika Reminder",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loginWin.loadFile(path.join(__dirname, "login.html"));
  loginWin.on("closed", () => { loginWin = null; });
}

/* ── websocket realtime — nangkep not_started_alert / task_alert ────── */
function connectWS() {
  if (!session) return;
  clearTimeout(wsReconnectTimer);
  try {
    ws = new WebSocket(`${WS_URL}?token=${session.token}`);
    ws.on("message", (data) => {
      try { handleWSMessage(JSON.parse(data.toString())); } catch {}
    });
    ws.on("close", () => { wsReconnectTimer = setTimeout(connectWS, 3000); });
    ws.on("error", () => { try { ws.close(); } catch {} });
  } catch {
    wsReconnectTimer = setTimeout(connectWS, 3000);
  }
}

const ALARM_TYPES = new Set(["not_started_alert", "not_streaming_alert", "task_alert"]);

function handleWSMessage(msg) {
  if (!session?.user) return;
  const myName = session.user.full_name || session.user.username;
  if (ALARM_TYPES.has(msg.type) && msg.assignee === myName) {
    showAlarm(msg);
  } else if (msg.type === "remote_connect" && msg.requested_by === session.user.username) {
    // Tombol "Remote" di web diklik OLEH KITA SENDIRI — broadcast global,
    // makanya filter by requested_by biar desktop app admin lain tidak ikut nyala.
    launchRustDeskConnect(msg.rustdesk_id, msg.rustdesk_password, msg.target_name);
  }
}

/* ── tombol "Remote" di web → jalanin RustDesk lokal, connect otomatis ── */
const RUSTDESK_EXE_CANDIDATES = [
  "C:\\Program Files\\RustDesk\\rustdesk.exe",
  "C:\\Program Files (x86)\\RustDesk\\rustdesk.exe",
];

function launchRustDeskConnect(id, password, targetName) {
  const rdExe = RUSTDESK_EXE_CANDIDATES.find((p) => fs.existsSync(p));
  if (!rdExe) {
    notify("⚠️ RustDesk tidak ketemu", "Install RustDesk dulu di laptop ini (lihat rustdesk-setup).");
    return;
  }
  try {
    spawn(rdExe, ["--connect", id, "--password", password], { detached: true, stdio: "ignore" }).unref();
    notify("🖥️ Membuka RustDesk", `Connect ke PC ${targetName || id}...`);
  } catch (e) {
    console.error("[remote_connect] gagal spawn rustdesk:", e);
    notify("⚠️ Gagal buka RustDesk", String(e));
  }
}

/* ── alarm full-screen — tidak bisa di-alt-tab/skip diam-diam ───────── */
function showAlarm(msg) {
  if (alarmWin) { alarmWin.focus(); return; }
  const { width, height } = screen.getPrimaryDisplay().bounds;
  alarmWin = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  alarmWin.setAlwaysOnTop(true, "screen-saver");
  const kind = msg.type === "task_alert" ? "review"
    : msg.type === "not_streaming_alert" ? "not_streaming"
    : "not_started";
  alarmWin.loadFile(path.join(__dirname, "alarm.html"), {
    query: {
      title: msg.task_title || "task hari ini",
      taskId: msg.task_id || "",
      orderId: msg.order_id || "",
      kind,
    },
  });
  alarmWin.on("closed", () => { alarmWin = null; });
}

/* ── IPC dari renderer (login.html / alarm.html via preload.js) ─────── */
ipcMain.on("login-success", (event, { token, user }) => {
  session = { token, user };
  saveSession(session);
  app.setLoginItemSettings({ openAtLogin: true });
  updateTrayMenu();
  connectWS();
  if (loginWin) loginWin.close();
  notify("✅ Magsika Reminder aktif", `Login sebagai ${user.full_name}. App ini jalan terus di tray.`);
});

ipcMain.on("open-dashboard", () => shell.openExternal(WEB_URL));
ipcMain.handle("get-backend-url", () => BACKEND_URL);

// TTS server-side (gTTS lang=id) — dijamin suara Indonesia beneran, tidak
// gantung ke voice OS yang belum tentu terinstall di laptop baru.
ipcMain.handle("get-tts-audio", async (event, text) => {
  if (!session) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.audio || null; // base64 mp3
  } catch (e) {
    console.error("[tts] gagal ambil audio:", e);
    return null;
  }
});

/* ── "Mulai Sekarang" di alarm → start timer di server, lalu buka picker layar ── */
async function startTaskTimer(taskId) {
  const res = await fetch(`${BACKEND_URL}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ status: "in progress", timer_started: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`PATCH /tasks/${taskId} → ${res.status}`);
}

ipcMain.on("start-work", async (event, { taskId, taskTitle, orderId, skipTimerPatch }) => {
  if (!session) return;
  if (!skipTimerPatch) {
    // Kasus "belum mulai" — timer belum jalan, start dulu.
    try {
      await startTaskTimer(taskId);
      notify("▶️ Timer dimulai", taskTitle);
    } catch (e) {
      console.error("[start-work] gagal start timer:", e);
      notify("⚠️ Gagal start timer", "Coba buka dashboard manual untuk klik \"Mulai\".");
      return; // tanpa timer jalan, tidak usah lanjut ke recording
    }
  }
  // Kasus "belum live stream" — timer sudah jalan duluan di server, langsung
  // lanjut ke picker layar tanpa PATCH ulang.
  pendingWork = { taskId, taskTitle, orderId };
  showPickerWindow();
});

/* ── picker layar ─────────────────────────────────────────────────── */
function showPickerWindow() {
  if (pickerWin) { pickerWin.focus(); return; }
  pickerWin = new BrowserWindow({
    width: 560, height: 460, resizable: false, title: "Pilih Layar — Magsika Reminder",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  pickerWin.loadFile(path.join(__dirname, "picker.html"));
  pickerWin.on("closed", () => { pickerWin = null; });
}

// Sengaja cuma "screen" (seluruh layar), bukan "window" per-aplikasi. Capture
// per-window di Electron gampang: (a) hasilnya hitam kalau app-nya pakai GPU
// rendering (Blender/Substance/ZBrush dll — kasus yang sering dilaporkan), dan
// (b) window yang di-run-as-administrator sama sekali tidak muncul di daftar
// (Windows UIPI, app biasa tidak bisa "lihat" window elevated). Capture layar
// penuh jauh lebih reliable dan menghindari dua masalah itu sekaligus.
ipcMain.handle("get-screen-sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 300, height: 200 } });
  return sources.map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
});

ipcMain.on("source-picked", (event, sourceId) => {
  if (pickerWin) pickerWin.close();
  if (!pendingWork) return;
  startRecorder(sourceId, pendingWork);
  pendingWork = null;
});

ipcMain.on("picker-cancelled", () => {
  // Timer sudah kepencet jalan di server (itu prioritas utamanya) — cuma
  // recording-nya yang di-skip kalau mereka batal pilih layar.
  pendingWork = null;
});

/* ── recorder (hidden window) — JPEG frame relay ke /ws/screen ──────── */
let recorderTaskTitle = ""; // buat ditampilkan di tray pas "recording-started" lapor balik

function startRecorder(sourceId, work) {
  if (recorderWin) { try { recorderWin.close(); } catch (_) {} recorderWin = null; }
  recorderTaskTitle = work.taskTitle;
  recorderInfo = {
    sourceId,
    wsUrl: WS_URL.replace(/\/ws$/, "/ws/screen"),
    token: session.token,
    username: session.user.full_name || session.user.username,
    taskTitle: work.taskTitle,
    orderId: work.orderId,
  };
  recorderWin = new BrowserWindow({
    show: false, width: 100, height: 100,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  recorderWin.loadFile(path.join(__dirname, "recorder.html"));
  recorderWin.on("closed", () => {
    recorderWin = null;
    clearActiveRecording();
  });
}

function stopRecording() {
  if (recorderWin) recorderWin.webContents.send("stop-recording");
  clearActiveRecording();
}

// Dipanggil begitu recording benar-benar berhenti (ditutup manual atau window
// mati sendiri) — sekalian jadi titik aman buat pasang update yang tadi
// tertunda karena masih ada recording jalan.
function clearActiveRecording() {
  activeRecording = null;
  updateTrayMenu();
  if (updateReadyToInstall) autoUpdater.quitAndInstall(false, true);
}

ipcMain.handle("get-recorder-info", () => {
  const info = recorderInfo;
  recorderInfo = null; // sekali pakai
  return info;
});

ipcMain.on("recording-started", () => {
  activeRecording = { taskTitle: recorderTaskTitle };
  updateTrayMenu();
  notify("🔴 Recording aktif", "Layar kamu lagi direkam sambil ngerjain task ini.");
});

ipcMain.on("recording-error", (event, msg) => {
  console.error("[recorder] error:", msg);
  notify("⚠️ Gagal mulai recording", String(msg));
});

ipcMain.on("stream-ended-remotely", () => {
  notify("⏹️ Stream dihentikan", "Admin menghentikan live stream kamu dari Live Monitor.");
  // recorderWin nutup sendiri (recorder.html udah panggil window.close()),
  // handler "closed" di startRecorder() yang bersihin activeRecording + tray.
});

/* ── lifecycle ────────────────────────────────────────────────────── */
// Sengaja tidak panggil app.quit() di sini — begitu semua window ketutup,
// proses tetap hidup di tray (itu intinya biar app "selalu jalan").
app.on("window-all-closed", () => {});

app.whenReady().then(() => {
  createTray();
  session = loadSession();
  if (session) {
    connectWS();
    notify("🔔 Magsika Reminder aktif", `Login sebagai ${session.user.full_name}. Cek tray kalau perlu.`);
  } else {
    showLoginWindow();
  }
  checkForUpdates();
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000); // cek update tiap 4 jam
});
