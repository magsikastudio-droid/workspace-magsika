import React, { useEffect, useRef } from "react";
import { useAlarm } from "../context/AlarmContext";

// Teks & tampilan beda per jenis alarm — sinkron sama alarm.html di desktop
// app, biar konsisten mau lewat browser atau desktop app.
const KIND_CONFIG = {
  review: {
    label: "Perlu Review",
    headline: "Task Menunggu Review!",
    speak: (name, title) => (name ? `${name} minta approval! ${title}` : `Ada task minta approval! ${title}`),
    buttonText: "TUTUP",
    goTo: null,
  },
  not_started: {
    label: "Belum Mulai Kerja",
    headline: "Ayo Mulai Task Ini!",
    speak: (name, title) => `Ayo mulai kerjain: ${title}`,
    buttonText: "KE TO DO →",
    goTo: "/todo",
  },
  not_streaming: {
    label: "Belum Live Stream",
    headline: "Timer Jalan, Belum Live Stream!",
    speak: (name, title) => `Timer jalan tapi belum live stream: ${title}`,
    buttonText: "KE TO DO →",
    goTo: "/todo",
  },
};

function speakApproval(taskTitle, assignee, kind = "review") {
  // Try backend TTS via global AudioContext first
  const ctx = window._audioCtx;
  const name = (assignee || "").split(" ")[0];
  const title = (taskTitle || "").replace(/\s*—\s*.+$/, "").trim();
  const text = (KIND_CONFIG[kind] || KIND_CONFIG.review).speak(name, title);
  if (ctx && ctx.state === "running") {
    const token = localStorage.getItem("admin_dashboard_token");
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then(({ audio }) => {
        const binary = atob(audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return ctx.decodeAudioData(bytes.buffer);
      })
      .then((buf) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(ctx.currentTime + 1.5); // after the alarm beeps
      })
      .catch(() => {});
    return;
  }
  // Fallback: speechSynthesis (only works if called from gesture context, best-effort)
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "id-ID";
  utter.rate = 0.88;
  const run = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("id")) || voices.find((v) => v.lang.startsWith("en")) || null;
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  };
  if (window.speechSynthesis.getVoices().length > 0) run();
  else { window.speechSynthesis.onvoiceschanged = () => { run(); window.speechSynthesis.onvoiceschanged = null; }; }
}

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

    // Voice announcement
    speakApproval(alarm.taskTitle, alarm.assignee, alarm.kind);

    return () => {
      clearInterval(intervalRef.current);
      audioCtxRef.current?.close();
      navigator.vibrate?.(0);
      wakeLockRef.current?.release();
    };
  }, [alarm]);

  if (!alarm) return null;

  const cfg = KIND_CONFIG[alarm.kind] || KIND_CONFIG.review;
  const handleAction = () => {
    dismissAlarm();
    if (cfg.goTo) window.location.href = cfg.goTo;
  };

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
        {cfg.label}
      </p>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          marginBottom: 8,
          lineHeight: 1.3,
        }}
      >
        {cfg.headline}
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
        onClick={handleAction}
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
        {cfg.buttonText}
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
