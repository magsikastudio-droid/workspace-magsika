import React, { useEffect, useRef, useState } from "react";
import { AlarmClock, X, Volume2 } from "lucide-react";

const fmtOvertime = (secs) => {
  if (secs <= 0) return "baru saja";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}d`;
};

function buildText(tasks) {
  return tasks.map((t) => {
    const name = (t.assignee || "").split(" ")[0];
    const title = (t.title || "").replace(/\s*—\s*.+$/, "").trim();
    return `${name}, waktu habis! ${title}`;
  }).join(". ");
}

// Play via AudioContext + backend gTTS — works without gesture after first unlock
async function speakViaBackend(tasks) {
  const ctx = window._audioCtx;
  if (!ctx || ctx.state !== "running") return false;
  const token = localStorage.getItem("admin_dashboard_token");
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: buildText(tasks) }),
    });
    if (!res.ok) return false;
    const { audio } = await res.json();
    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    return true;
  } catch (_) {
    return false;
  }
}

// Fallback: Web Speech API (requires gesture, used when AudioContext not yet unlocked)
function speakViaFallback(tasks) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const utter = new SpeechSynthesisUtterance(buildText(tasks));
  utter.lang = "id-ID";
  utter.rate = 0.88;
  utter.pitch = 1.05;
  const run = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("id")) || voices.find((v) => v.lang.startsWith("en")) || null;
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  };
  if (window.speechSynthesis.getVoices().length > 0) run();
  else { window.speechSynthesis.onvoiceschanged = () => { run(); window.speechSynthesis.onvoiceschanged = null; }; }
}

export default function OverdueAlarmBanner({ tasks, onDismiss }) {
  const spokenRef = useRef(new Set());
  const pendingRef = useRef([]); // waiting for AudioContext unlock (first gesture)
  const [speaking, setSpeaking] = useState(false);

  const speak = async (tasksToSpeak) => {
    if (!tasksToSpeak || tasksToSpeak.length === 0) return;
    const ok = await speakViaBackend(tasksToSpeak);
    if (!ok) {
      // AudioContext not unlocked yet — store pending, try speechSynthesis as attempt
      pendingRef.current = tasksToSpeak;
      speakViaFallback(tasksToSpeak);
    } else {
      pendingRef.current = [];
    }
  };

  // Auto-speak when new tasks arrive
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    const newTasks = tasks.filter((t) => !spokenRef.current.has(t.id));
    if (newTasks.length > 0) {
      newTasks.forEach((t) => spokenRef.current.add(t.id));
      speak(newTasks);
    }
    return () => { navigator.vibrate?.(0); };
  }, [tasks]);

  // On any user gesture → if AudioContext just got unlocked, speak pending
  useEffect(() => {
    const handler = async () => {
      if (pendingRef.current.length === 0) return;
      // Small delay to let AudioContext unlock complete
      await new Promise((r) => setTimeout(r, 100));
      const ok = await speakViaBackend(pendingRef.current);
      if (ok) pendingRef.current = [];
    };
    document.addEventListener("click", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handler);
    };
  }, []);

  if (!tasks || tasks.length === 0) return null;

  const handleSpeak = async (e) => {
    e.stopPropagation();
    setSpeaking(true);
    await speak(tasks);
    setTimeout(() => setSpeaking(false), 3000);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <>
      <style>{`
        @keyframes overdueBannerIn {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes overdueFlash {
          0%, 100% { background-color: #dc2626; }
          50%       { background-color: #991b1b; }
        }
        @keyframes overdueClockSpin {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(-20deg); }
          75%  { transform: rotate(20deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes overdueVolumePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.15); }
        }
      `}</style>
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99990,
          animation: "overdueBannerIn 0.35s ease-out forwards",
          cursor: "pointer",
        }}
        onClick={handleSpeak}
        title="Klik untuk ucapkan"
      >
        <div
          style={{
            animation: "overdueFlash 1.2s ease-in-out infinite",
            padding: "14px 16px",
            display: "flex", alignItems: "flex-start", gap: "12px",
            boxShadow: "0 6px 32px rgba(220,38,38,0.6)",
          }}
        >
          <div style={{ flexShrink: 0, marginTop: 1, animation: "overdueClockSpin 0.8s ease-in-out infinite" }}>
            <AlarmClock size={22} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
              ⏰ WAKTU HABIS — Task Overdue!
            </p>
            <div style={{ marginTop: 5 }}>
              {tasks.map((t) => (
                <p key={t.id} style={{ color: "#fca5a5", fontSize: 12, margin: "3px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fbbf24", flexShrink: 0, display: "inline-block" }} />
                  <strong style={{ color: "white" }}>{t.title}</strong>
                  <span>—</span>
                  <span>{t.assignee}</span>
                  {t._overtime > 0 && (
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>+{fmtOvertime(t._overtime)}</span>
                  )}
                </p>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleSpeak}
              title="Ucapkan nama overdue"
              style={{
                background: speaking ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8, padding: "5px 8px", cursor: "pointer",
                color: "white", display: "flex", alignItems: "center",
                fontSize: 11, fontWeight: 700, gap: 4,
                animation: speaking ? "overdueVolumePulse 0.6s ease-in-out infinite" : "none",
              }}
            >
              <Volume2 size={14} />
              Ucap
            </button>
            <button
              onClick={handleDismiss}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8, padding: "5px 8px", cursor: "pointer",
                color: "white", display: "flex", alignItems: "center",
                fontSize: 11, fontWeight: 700, gap: 4,
              }}
            >
              <X size={14} />
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
