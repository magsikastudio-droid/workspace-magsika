import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "../lib/api";
import { subscribe } from "../lib/ws";
import { initNotifications, showTaskAlarm } from "../lib/notifications";
import { useAuth } from "../context/AuthContext";
import { useAlarm } from "../context/AlarmContext";
import { toast } from "sonner";

async function setupFCM(onAlert) {
  console.log("[FCM] isNativePlatform:", Capacitor.isNativePlatform());
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await PushNotifications.requestPermissions();
    console.log("[FCM] permission result:", JSON.stringify(perm));
    if (perm.receive !== "granted") {
      console.warn("[FCM] permission not granted:", perm.receive);
      return;
    }

    console.log("[FCM] calling register()...");
    await PushNotifications.register();
    console.log("[FCM] register() called");

    PushNotifications.addListener("registration", async ({ value: token }) => {
      console.log("[FCM] got token:", token ? token.substring(0, 30) : "null");
      try {
        await api.post("/fcm/token", { token });
        console.log("[FCM] token sent to backend");
      } catch (e) {
        console.error("[FCM] token send error:", e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[FCM] registrationError:", JSON.stringify(err));
    });

    PushNotifications.addListener("pushNotificationReceived", (notif) => {
      const d = notif.data || {};
      if (d.type === "task_alert") {
        onAlert(d.task_title || "Task menunggu review", d.assignee || "");
      } else if (d.type === "announcement") {
        toast.info(notif.title || "Pengumuman Baru", { description: notif.body });
      } else if (d.type === "schedule_event") {
        toast.info(notif.title || "Event Baru", { description: notif.body });
      } else if (d.type === "performance_report") {
        toast.success(notif.title || "Laporan Performa", { description: notif.body });
      }
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const d = action.notification.data || {};
      if (d.type === "task_alert") {
        const title = d.task_title || "Task menunggu review";
        const assignee = d.assignee || "";
        // Trigger local fullScreenIntent notification so screen wakes on lock screen tap
        showTaskAlarm(title, assignee);
        onAlert(title, assignee);
      }
    });
  } catch (e) {
    console.error("[FCM] setup error:", e.message || e);
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
