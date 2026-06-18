import React, { useEffect, useRef } from "react";
import { AlarmClock, X } from "lucide-react";

function playOverdueAlarm(ctx) {
  const now = ctx.currentTime;
  const pattern = [880, 988, 1047, 880, 988, 1047, 1175];
  pattern.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + i * 0.1);
    gain.gain.setValueAtTime(0.28, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.09);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.09);
  });
}

const fmtOvertime = (secs) => {
  if (secs <= 0) return "baru saja";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}d`;
};

export default function OverdueAlarmBanner({ tasks, onDismiss }) {
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300, 150, 300]);

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      playOverdueAlarm(ctx);
      intervalRef.current = setInterval(() => playOverdueAlarm(ctx), 4000);
    } catch {}

    return () => {
      clearInterval(intervalRef.current);
      audioCtxRef.current?.close();
      navigator.vibrate?.(0);
    };
  }, [tasks]);

  if (!tasks || tasks.length === 0) return null;

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
      `}</style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99990,
          animation: "overdueBannerIn 0.35s ease-out forwards",
        }}
      >
        <div
          style={{
            animation: "overdueFlash 1.2s ease-in-out infinite",
            padding: "14px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
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
          <button
            onClick={onDismiss}
            style={{
              flexShrink: 0,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 8,
              padding: "5px 8px",
              cursor: "pointer",
              color: "white",
              display: "flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 700,
              gap: 4,
            }}
          >
            <X size={14} />
            Tutup
          </button>
        </div>
      </div>
    </>
  );
}
