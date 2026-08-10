import React from "react";
import { Radio, Square } from "lucide-react";
import { useStream } from "../context/StreamContext";

/* Tombol stream di sidebar — UI wrapper tipis dari StreamContext */
export default function StreamButton({ collapsed = false }) {
  const { streaming, loading, startStream, stopStream } = useStream();

  /* ── Floating indicator di tengah atas saat streaming ── */
  const indicator = streaming ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
      <div className="flex items-center gap-2 bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl">
        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
        <span className="w-2 h-2 rounded-full bg-white absolute" />
        SEDANG STREAMING
      </div>
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
