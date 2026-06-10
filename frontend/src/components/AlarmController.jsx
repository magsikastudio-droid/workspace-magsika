import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "../lib/api";
import { subscribe } from "../lib/ws";
import { initNotifications } from "../lib/notifications";
import { useAuth } from "../context/AuthContext";
import { useAlarm } from "../context/AlarmContext";

async function setupFCM(onAlert) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await PushNotifications.register();

    // Kirim token ke backend agar bisa dikirim FCM
    PushNotifications.addListener("registration", async ({ value: token }) => {
      try {
        await api.post("/fcm/token", { token });
      } catch {}
    });

    // Notif diterima saat app FOREGROUND → tampilkan alarm overlay
    PushNotifications.addListener("pushNotificationReceived", (notif) => {
      const d = notif.data || {};
      if (d.type === "task_alert") {
        onAlert(d.task_title || "Task menunggu review", d.assignee || "");
      }
    });

    // User tap notif dari BACKGROUND/SLEEP → tampilkan alarm overlay
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const d = action.notification.data || {};
      if (d.type === "task_alert") {
        onAlert(d.task_title || "Task menunggu review", d.assignee || "");
      }
    });
  } catch (e) {
    console.error("[FCM] setup error:", e);
  }
}

export default function AlarmController() {
  const { user } = useAuth();
  const { triggerAlarm } = useAlarm();
  const lastCount = useRef(-1);
  const fcmReady = useRef(false);

  useEffect(() => {
    if (!user) {
      lastCount.current = -1;
      return;
    }

    initNotifications();

    const fire = (title, assignee) => triggerAlarm(title, assignee);

    if (!fcmReady.current) {
      fcmReady.current = true;
      setupFCM(fire);
    }

    // WS realtime (saat app terbuka & server sudah deploy WS)
    const unsubWS = subscribe("task_alert", (msg) => {
      fire(msg.task_title, msg.assignee);
    });

    // Polling fallback tiap 5 detik
    const poll = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        const count = res.data.count ?? 0;
        if (lastCount.current >= 0 && count > lastCount.current) {
          fire("Ada task menunggu review", "Cek notifikasi baru");
        }
        lastCount.current = count;
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      unsubWS();
      clearInterval(interval);
    };
  }, [user, triggerAlarm]);

  return null;
}
