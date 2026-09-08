import React from "react";
import { Radio, Square, Mic } from "lucide-react";
import { useStream } from "../context/StreamContext";

/* Tombol stream di sidebar — UI wrapper tipis dari StreamContext */
export default function StreamButton({ collapsed = false }) {
  const { streaming, loading, startStream, stopStream, micActive, talking, startTalking, stopTalking, audioBlocked, unlockAudio, connState, audioStats, localLevel, remoteLevel } = useStream();

  /* ── Floating indicator di tengah atas saat streaming ──
     Open Mic: begitu admin sambungin dari Live Monitor, tombol "Tahan
     Bicara" muncul di sini — tekan-tahan buat ngomong ke admin, lepas
     buat diam lagi. Tidak ada delay: koneksi audio sudah kebentuk dari
     awal, tombol ini cuma toggle mute/unmute track lokal. */
  const indicator = streaming ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2">
      <div className="pointer-events-none flex items-center gap-2 bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl">
        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
        <span className="w-2 h-2 rounded-full bg-white absolute" />
        SEDANG STREAMING
      </div>
      {connState && !micActive && (
        <div className={`rounded-full px-3 py-1.5 text-[10px] font-mono font-semibold shadow-xl ${
          connState === "failed" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
        }`}>
          Open Mic: {connState}
        </div>
      )}
      {micActive && audioStats && (
        <div className="rounded-full bg-black/70 px-3 py-1.5 text-[9px] font-mono text-white leading-tight flex items-center gap-2">
          <span>📤{audioStats.bytesSent}B 📥{audioStats.bytesReceived}B</span>
          {/* Meteran suara masuk dari admin — kalau bergerak pas admin
              ngomong, suaranya PASTI nyampe, tinggal soal speaker kamu. */}
          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${remoteLevel}%` }} />
          </div>
        </div>
      )}
      {talking && localLevel > 0 && (
        <div className="rounded-full bg-emerald-900/80 px-3 py-1 text-[9px] font-mono text-emerald-200">
          🎙️ mic kamu: {localLevel > 5 ? "ada suara terdeteksi" : "hening"}
        </div>
      )}
      {micActive && audioBlocked && (
        <button
          onClick={unlockAudio}
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold shadow-xl text-white animate-pulse hover:bg-amber-600"
        >
          🔊 Aktifkan Suara
        </button>
      )}
      {micActive && (
        <button
          onMouseDown={startTalking}
          onMouseUp={stopTalking}
          onMouseLeave={stopTalking}
          onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold shadow-xl select-none transition ${
            talking ? "bg-emerald-500 text-white scale-105" : "bg-white text-emerald-600 hover:bg-emerald-50"
          }`}
        >
          <Mic size={13} /> {talking ? "Bicara..." : "Tahan Bicara ke Admin"}
        </button>
      )}
    </div>
  ) : null;

  if (collapsed) {
    return (
      <>
        {indicator}
        <button
          onClick={streaming ? stopStream : () => startStream()}
          disabled={loading}
          title={streaming ? "Hentikan stream" : "Mulai stream layar"}
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
            streaming
              ? "bg-rose-500 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-50 hover:text-rose-500"
          }`}
        >
          {loading
            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : streaming ? <Square size={14} /> : <Radio size={14} />
          }
        </button>
      </>
    );
  }

  return (
    <>
      {indicator}
      <button
        onClick={streaming ? stopStream : () => startStream()}
        disabled={loading}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
          streaming
            ? "bg-rose-500 text-white hover:bg-rose-600"
            : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400"
        }`}
      >
        {loading ? (
          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : streaming ? (
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
        ) : (
          <Radio size={14} className="shrink-0" />
        )}
        <span className="truncate">
          {loading ? "Memilih jendela…" : streaming ? "Hentikan Stream" : "Mulai Stream"}
        </span>
        {streaming && (
          <span className="ml-auto text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5 shrink-0">LIVE</span>
        )}
      </button>
    </>
  );
}
