import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { App } from "@capacitor/app";
import { api } from "./api";

async function ensurePermission() {
  const check = await Geolocation.checkPermissions();
  if (check.location === "granted" || check.coarseLocation === "granted") return true;
  if (check.location === "denied" || check.coarseLocation === "denied") return false;
  const req = await Geolocation.requestPermissions();
  return req.location === "granted" || req.coarseLocation === "granted";
}

export async function sendLocationToServer() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const granted = await ensurePermission();
    if (!granted) return;
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    await api.post("/location/update", {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  } catch (e) {
    console.warn("[location] failed to send:", e?.message || e);
  }
}

// Kirim lokasi tiap kali app kembali ke foreground
export function startLocationTracking() {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handler = App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) sendLocationToServer();
  });
  return () => handler.then((h) => h.remove());
}
