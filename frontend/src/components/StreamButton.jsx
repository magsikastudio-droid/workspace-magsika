import React, { useState, useRef, useEffect } from "react";
import { Radio, Square } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved    = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function StreamButton({ collapsed = false }) {
  const { user, token } = useAuth();

  const [streaming, setStreaming] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const wsRef     = useRef(null);
  const streamRef = useRef(null);  // MediaStream
  const pcsRef    = useRef({});    // {viewer_id: RTCPeerConnection}

  /* ── Hentikan semua ── */
  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStreaming(false);
  };

  /* ── Mulai: browser picker → connect WS → tunggu offer dari admin ── */
  const startStream = async () => {
    setLoading(true);
    try {
      /* 1. Browser tampilkan window picker — user pilih sendiri */
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     { ideal: 1280 },
          height:    { ideal: 720 },
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;

      /* Saat user klik "Stop sharing" di browser */
      stream.getVideoTracks()[0].onended = () => {
        toast.info("Stream dihentikan.");
        stopStream();
      };

      /* 2. Connect ke signaling server */
      const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[StreamButton] WS open, join_streamer");
        ws.send(JSON.stringify({
          type:     "join_streamer",
          username: user?.name || user?.username || "Tim",
          task:     "",
        }));
        setStreaming(true);
        setLoading(false);
        toast.success("🔴 Stream dimulai — admin bisa memantau layarmu.");
      };

      ws.onmessage = async (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        console.log("[StreamButton] <<", msg.type, msg);

        /* Admin (viewer) mengirim offer → buat RTCPeerConnection, answer balik */
        if (msg.type === "offer") {
          const viewerId = msg.from;
          console.log("[StreamButton] offer dari viewer", viewerId);

          const pc = new RTCPeerConnection({ iceServers: ICE });
          pcsRef.current[viewerId] = pc;

          /* Tambah semua track layar ke koneksi ini */
          streamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, streamRef.current);
          });

          /* Kirim ICE candidates ke viewer */
          pc.onicecandidate = (ev) => {
            if (ev.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ice", to: viewerId, candidate: ev.candidate }));
            }
          };

          pc.onconnectionstatechange = () => {
            console.log("[StreamButton] pc state", viewerId, pc.connectionState);
          };

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("[StreamButton] mengirim answer ke", viewerId);
            ws.send(JSON.stringify({ type: "answer", to: viewerId, sdp: pc.localDescription }));
          } catch (err) {
            console.error("[StreamButton] answer error:", err);
          }
        }

        /* ICE candidate dari viewer */
        else if (msg.type === "ice") {
          const pc = pcsRef.current[msg.from];
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          }
        }
      };

      ws.onclose = (ev) => {
        console.log("[StreamButton] WS closed — code:", ev.code, "reason:", ev.reason, "wasClean:", ev.wasClean);
        setStreaming(false);
        setLoading(false);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      ws.onerror = (err) => {
        console.error("[StreamButton] WS error — URL:", ws.url, "readyState:", ws.readyState, err);
        toast.error(`Gagal terhubung ke server stream. (buka DevTools Console untuk detail)`);
        stopStream();
        setLoading(false);
      };

    } catch (err) {
      setLoading(false);
      if (err.name === "NotAllowedError") return; // user cancel picker
      console.error("[StreamButton] startStream error:", err);
      toast.error("Gagal mulai stream: " + err.message);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopStream(), []);

  /* ═══════════════════════════════════════════════
     Floating indicator — tampil di tengah atas
     saat sedang streaming
  ═══════════════════════════════════════════════ */
  const indicator = streaming ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
      <div className="flex items-center gap-2 bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl">
        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
        <span className="w-2 h-2 rounded-full bg-white absolute" />
        SEDANG STREAMING
      </div>
    </div>
  ) : null;

  /* ═══════════════════════════════════════════════
     Button UI
  ═══════════════════════════════════════════════ */
  if (collapsed) {
    return (
      <>
        {indicator}
        <button
          onClick={streaming ? stopStream : startStream}
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
        onClick={streaming ? stopStream : startStream}
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
