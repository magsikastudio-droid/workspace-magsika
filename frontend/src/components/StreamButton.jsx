import React, { useState, useRef, useEffect } from "react";
import { Radio, Square, AlertCircle } from "lucide-react";
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
  const streamRef = useRef(null);   // MediaStream (screen)
  const pcsRef    = useRef({});     // {viewer_id: RTCPeerConnection}

  /* ── Stop everything ── */
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

  /* ── Start: pick window → connect WS → wait for viewers ── */
  const startStream = async () => {
    setLoading(true);
    try {
      /* 1. Browser window picker — user picks what to share */
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     { ideal: 1280 },
          height:    { ideal: 720 },
          frameRate: { ideal: 15, max: 30 }, // 15fps → ringan di CPU
        },
        audio: false,
      });
      streamRef.current = stream;

      /* User closed via browser stop-share button */
      stream.getVideoTracks()[0].onended = () => stopStream();

      /* 2. Connect signaling WebSocket */
      const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
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

        /* Viewer wants to watch → answer their offer */
        if (msg.type === "offer") {
          const viewerId = msg.from;

          const pc = new RTCPeerConnection({ iceServers: ICE });
          pcsRef.current[viewerId] = pc;

          /* Add screen tracks to this connection */
          streamRef.current?.getTracks().forEach(t => {
            pc.addTrack(t, streamRef.current);
          });

          pc.onicecandidate = (ev) => {
            if (ev.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ice", to: viewerId, candidate: ev.candidate }));
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          ws.send(JSON.stringify({ type: "answer", to: viewerId, sdp: pc.localDescription }));
        }

        else if (msg.type === "ice") {
          const pc = pcsRef.current[msg.from];
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          }
        }
      };

      ws.onclose = () => {
        setStreaming(false);
        setLoading(false);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      ws.onerror = () => {
        toast.error("Gagal terhubung ke server stream.");
        stopStream();
        setLoading(false);
      };

    } catch (err) {
      setLoading(false);
      if (err.name === "NotAllowedError") return; // user cancelled picker
      toast.error("Gagal mulai stream: " + err.message);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  /* Cleanup on unmount */
  useEffect(() => () => stopStream(), []);

  /* ── UI ── */
  if (collapsed) {
    /* Icon-only mode (sidebar collapsed) */
    return (
      <button
        onClick={streaming ? stopStream : startStream}
        disabled={loading}
        title={streaming ? "Hentikan stream" : "Mulai stream layar"}
        className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
          streaming
            ? "bg-rose-500 text-white animate-pulse"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-50 hover:text-rose-500"
        }`}
      >
        {loading ? (
          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : streaming ? (
          <Square size={14} />
        ) : (
          <Radio size={14} />
        )}
      </button>
    );
  }

  return (
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
        <span className="w-3.5 h-3.5 rounded-full bg-white animate-pulse shrink-0" />
      ) : (
        <Radio size={14} className="shrink-0" />
      )}
      <span className="truncate">
        {loading ? "Memilih jendela…" : streaming ? "Hentikan Stream" : "Mulai Stream"}
      </span>
      {streaming && (
        <span className="ml-auto text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5 shrink-0">LIVE</span>
      )}
    </button>
  );
}
