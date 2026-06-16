import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { api } from "./api";

export async function sendLocationToServer() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") return;
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    await api.post("/location/update", {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  } catch (e) {
    console.warn("[location] failed to send:", e?.message || e);
  }
}
