import React, { useEffect, useRef } from "react";
import { useAlarm } from "../context/AlarmContext";

function playAlarmSound(ctx) {
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now + i * 0.4);
    osc.frequency.setValueAtTime(1320, now + i * 0.4 + 0.2);
    gain.gain.setValueAtTime(0.4, now + i * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.35);
    osc.start(now + i * 0.4);
    osc.stop(now + i * 0.4 + 0.35);
  }
}

export default function AlarmOverlay() {
  const { alarm, dismissAlarm } = useAlarm();
  const audioCtxRef = useRef(null);
  const wakeLockRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!alarm) return;

    // Getar panjang
    if (navigator.vibrate) {
      navigator.vibrate([800, 300, 800, 300, 800, 300, 800]);
    }

    // Nyalakan layar
    (async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {}
    })();

    // Alarm sound berulang
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    playAlarmSound(ctx);
    intervalRef.current = setInterval(() => {
      playAlarmSound(ctx);
      if (navigator.vibrate) navigator.vibrate([600, 200, 600]);
    }, 2000);

    return () => {
      clearInterval(intervalRef.current);
      audioCtxRef.current?.close();
      navigator.vibrate?.(0);
      wakeLockRef.current?.release();
    };
  }, [alarm]);

  if (!alarm) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        textAlign: "center",
        padding: "32px 24px",
        userSelect: "none",
      }}
    >
      {/* Pulse ring */}
      <div style={{ position: "relative", marginBottom: "24px" }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            animation: "pulse 1s infinite",
          }}
        >
          🔔
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#f87171",
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        Perlu Review
      </p>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          marginBottom: 8,
          lineHeight: 1.3,
        }}
      >
        Task Menunggu Review!
      </h1>

      {alarm.assignee && (
        <p style={{ fontSize: 18, color: "#fbbf24", marginBottom: 4, fontWeight: 600 }}>
          {alarm.assignee}
        </p>
      )}
      <p style={{ fontSize: 15, color: "#d1d5db", marginBottom: 48, maxWidth: 300 }}>
        {alarm.taskTitle}
      </p>

      <button
        onClick={dismissAlarm}
        style={{
          padding: "18px 56px",
          fontSize: 18,
          fontWeight: 700,
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: 50,
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(239,68,68,0.5)",
          letterSpacing: 1,
        }}
      >
        TUTUP
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 20px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}
