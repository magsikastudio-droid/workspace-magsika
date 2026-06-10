import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

const CHANNEL_ID = "task-alert";

export async function initNotifications() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Task Alert",
      description: "Notifikasi task menunggu review",
      importance: 5,
      visibility: 1,
      vibration: true,
      bypassDnd: true,
      lights: true,
      lightColor: "#FF0000",
      sound: "default",
    });

    // Cek dulu statusnya sebelum minta permission
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    if (current.display === "denied") return false;

    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch (e) {
    console.error("[notif] init error:", e);
    return false;
  }
}

export async function showTaskAlarm(taskTitle, assignee) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2147483647),
          title: "⚠️ Task Menunggu Review!",
          body: assignee ? `${assignee}: ${taskTitle}` : taskTitle,
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 300) },
          ongoing: true,
          autoCancel: false,
          fullScreenIntent: true,
          iconColor: "#F59E0B",
        },
      ],
    });
  } catch (e) {
    console.error("[notif] schedule error:", e);
  }
}
