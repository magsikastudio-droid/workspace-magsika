import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

const CHANNEL_ID = "magsika-alerts";

export async function initNotifications() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    // Delete old channel that was created with broken sound settings
    try { await LocalNotifications.deleteChannel({ id: "task-alert" }); } catch {}

    // Recreate without 'sound' property — Android uses the device's default notification sound
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Magsika Alerts",
      description: "Notifikasi dari Magsika Workspace",
      importance: 5,
      visibility: 1,
      vibration: true,
      bypassDnd: true,
      lights: true,
      lightColor: "#7C3AED",
    });

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

export async function showLocalNotification(title, body) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 2147483647),
        title,
        body: body || "",
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 100) },
        autoCancel: true,
      }],
    });
  } catch (e) {
    console.error("[notif] showLocalNotification error:", e);
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
          schedule: { at: new Date(Date.now() + 100) },
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
