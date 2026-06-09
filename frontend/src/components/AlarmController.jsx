import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { subscribe } from "../lib/ws";
import { initNotifications, showTaskAlarm } from "../lib/notifications";
import { useAuth } from "../context/AuthContext";
import { useAlarm } from "../context/AlarmContext";

export default function AlarmController() {
  const { user } = useAuth();
  const { triggerAlarm } = useAlarm();
  const lastCount = useRef(-1);

  useEffect(() => {
    if (!user) {
      lastCount.current = -1;
      return;
    }

    initNotifications();

    const fire = (title, assignee) => {
      triggerAlarm(title, assignee);
      showTaskAlarm(title, assignee);
    };

    // Instan via WebSocket
    const unsubWS = subscribe("task_alert", (msg) => {
      fire(msg.task_title, msg.assignee);
    });

    // Polling fallback tiap 20 detik
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
    const interval = setInterval(poll, 20000);

    return () => {
      unsubWS();
      clearInterval(interval);
    };
  }, [user, triggerAlarm]);

  return null;
}
