const { contextBridge, ipcRenderer } = require("electron");

// Jembatan aman: login.html & alarm.html jalan dengan nodeIntegration mati,
// jadi cuma bisa manggil fungsi terbatas ini, bukan Node API penuh.
contextBridge.exposeInMainWorld("desktopApp", {
  loginSuccess: (data) => ipcRenderer.send("login-success", data),
  openDashboard: () => ipcRenderer.send("open-dashboard"),
  getBackendUrl: () => ipcRenderer.invoke("get-backend-url"),
  getTtsAudio: (text) => ipcRenderer.invoke("get-tts-audio", text),

  // Alarm "belum mulai" → langsung start timer + buka picker layar
  startWork: (data) => ipcRenderer.send("start-work", data),

  // Dipakai picker.html
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  pickSource: (sourceId) => ipcRenderer.send("source-picked", sourceId),
  cancelPicker: () => ipcRenderer.send("picker-cancelled"),

  // Dipakai recorder.html (hidden window) buat baca task/koneksi info & lapor status
  getRecorderInfo: () => ipcRenderer.invoke("get-recorder-info"),
  reportRecordingStarted: () => ipcRenderer.send("recording-started"),
  reportRecordingError: (msg) => ipcRenderer.send("recording-error", msg),
  onStopRecording: (cb) => ipcRenderer.on("stop-recording", cb),
});
