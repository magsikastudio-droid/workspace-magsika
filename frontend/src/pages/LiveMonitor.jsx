import React, { useState, useEffect, useRef, useCallback } from "react";
import { Monitor, Wifi, WifiOff, Radio, RefreshCw, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/* ── WebSocket base URL (same pattern as ws.js) ── */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved    = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/* ── Individual stream card ── */
function StreamCard({ id, username, task, avatar, videoEl, status }) {
  const statusColor = {
    connecting: "bg-amber-400",
    connected:  "bg-emerald-400",
    failed:     "bg-rose-500",
  }[status] || "bg-slate-400";

  const statusLabel = {
    connecting: "Menghubungkan…",
    connected:  "Live",
    failed:     "Koneksi gagal",
  }[status] || status;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50 shadow-xl flex flex-col aspect-video">
      {/* Video feed */}
      <div
        className="flex-1 w-full"
        ref={(el) => { if (el && videoEl && !el.contains(videoEl)) el.appendChild(videoEl); }}
      />

      {/* Dark overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 py-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {avatar ? (
              <img src={avatar} className="w-7 h-7 rounded-full border-2 border-white/30 shrink-0 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-xs font-bold leading-tight truncate">{username}</p>
              {task && <p className="text-white/60 text-[10px] leading-tight truncate">{task}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${status === "connected" ? "animate-pulse" : ""}`} />
            <span className="text-white/70 text-[10px]">{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Loading / failed overlay */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-white/60 text-xs">Menghubungkan…</p>
          </div>
        </div>
      )}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-center">
            <WifiOff size={28} className="text-rose-400 mx-auto mb-2" />
            <p className="text-white/60 text-xs">Koneksi gagal</p>
            <p className="text-white/40 text-[10px] mt-1">Mungkin beda jaringan — perlu TURN server</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function LiveMonitor() {
  const { token } = useAuth();

  const wsRef     = useRef(null);
  const pcsRef    = useRef({});           // {streamer_id: RTCPeerConnection}
  const videoEls  = useRef({});           // {streamer_id: HTMLVideoElement}

  const [wsOk,      setWsOk]      = useState(false);
  const [streamers, setStreamers] = useState({});
  // {id: {username, task, avatar, status: "connecting"|"connected"|"failed"}}

  /* ── Connect to a streamer (create offer) ── */
  const connectToStreamer = useCallback((streamerId, ws) => {
    if (pcsRef.current[streamerId]) return; // already in progress

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcsRef.current[streamerId] = pc;

    /* Build video element for this streamer */
    const video = document.createElement("video");
    video.autoplay    = true;
    video.playsInline = true;
    video.muted       = true;
    video.className   = "w-full h-full object-contain bg-slate-900";
    videoEls.current[streamerId] = video;

    pc.ontrack = (ev) => {
      video.srcObject = ev.streams[0];
      setStreamers(prev =>
        prev[streamerId]
          ? { ...prev, [streamerId]: { ...prev[streamerId], status: "connected" } }
          : prev
      );
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice", to: streamerId, candidate: ev.candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        setStreamers(prev =>
          prev[streamerId]
            ? { ...prev, [streamerId]: { ...prev[streamerId], status: "failed" } }
            : prev
        );
      }
    };

    (async () => {
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", to: streamerId, sdp: pc.localDescription }));
      } catch (err) {
        console.error("LiveMonitor offer error:", err);
        setStreamers(prev =>
          prev[streamerId]
            ? { ...prev, [streamerId]: { ...prev[streamerId], status: "failed" } }
            : prev
        );
      }
    })();
  }, []);

  /* ── Main WebSocket connection ── */
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_viewer" }));
      setWsOk(true);
    };

    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "streamers_list") {
        const init = {};
        msg.streamers.forEach(s => { init[s.id] = { ...s, status: "connecting" }; });
        setStreamers(init);
        msg.streamers.forEach(s => connectToStreamer(s.id, ws));
      }

      else if (msg.type === "streamer_joined") {
        setStreamers(prev => ({
          ...prev,
          [msg.id]: { id: msg.id, username: msg.username, task: msg.task, avatar: msg.avatar, status: "connecting" },
        }));
        connectToStreamer(msg.id, ws);
      }

      else if (msg.type === "streamer_left") {
        pcsRef.current[msg.id]?.close();
        delete pcsRef.current[msg.id];
        const v = videoEls.current[msg.id];
        if (v) { v.srcObject = null; delete videoEls.current[msg.id]; }
        setStreamers(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
      }

      else if (msg.type === "streamer_updated") {
        setStreamers(prev =>
          prev[msg.id] ? { ...prev, [msg.id]: { ...prev[msg.id], task: msg.task } } : prev
        );
      }

      else if (msg.type === "answer") {
        const pc = pcsRef.current[msg.from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(() => {});
      }

      else if (msg.type === "ice") {
        const pc = pcsRef.current[msg.from];
        if (pc && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        }
      }
    };

    ws.onclose  = () => setWsOk(false);
    ws.onerror  = () => setWsOk(false);

    return () => {
      ws.close();
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      Object.values(videoEls.current).forEach(v => { v.srcObject = null; });
      videoEls.current = {};
    };
  }, [token, connectToStreamer]);

  /* ── Render ── */
  const entries = Object.entries(streamers);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <Monitor size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Live Monitor</h1>
            <p className="text-xs text-slate-500">Pantau layar tim secara real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WS status */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            wsOk
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-slate-600 bg-slate-800 text-slate-500"
          }`}>
            {wsOk
              ? <><Wifi size={12} /> Terhubung</>
              : <><WifiOff size={12} /> Terputus</>
            }
          </div>

          {/* Stream count */}
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400">
            <Users size={12} />
            {entries.length} streaming
          </div>
        </div>
      </div>

      {/* Grid */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800 mb-4">
            <Radio size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold text-lg mb-1">Belum ada yang streaming</p>
          <p className="text-slate-600 text-sm max-w-xs">
            Tim bisa mulai stream dari tombol <span className="text-violet-400 font-medium">🔴 Mulai Stream</span> di sidebar
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${
          entries.length === 1 ? "grid-cols-1 max-w-3xl mx-auto" :
          entries.length === 2 ? "grid-cols-2" :
          entries.length <= 4  ? "grid-cols-2" :
          "grid-cols-3"
        }`}>
          {entries.map(([id, streamer]) => (
            <StreamCard
              key={id}
              id={id}
              username={streamer.username}
              task={streamer.task}
              avatar={streamer.avatar}
              videoEl={videoEls.current[id]}
              status={streamer.status}
            />
          ))}
        </div>
      )}

      {/* TURN server note */}
      {entries.some(([, s]) => s.status === "failed") && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <p className="font-semibold mb-0.5">💡 Koneksi gagal di beberapa stream</p>
          <p className="text-amber-500/80">
            Ini terjadi saat tim dan admin di jaringan berbeda. Pasang TURN server (coturn) di VPS untuk koneksi yang stabil.
          </p>
        </div>
      )}
    </div>
  );
}
