import React, { useState, useEffect, useRef, useCallback } from "react";
import { Maximize2, Monitor, Wifi, WifiOff, Radio, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStream } from "../context/StreamContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved    = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

/* ═══════════════════════════════════════════════════════════
   Stream card — video element dikelola sendiri via useRef
═══════════════════════════════════════════════════════════ */
function StreamCard({ username, task, avatar, status, stream }) {
  const videoRef    = useRef(null);
  const containerRef = useRef(null);

  /* Set srcObject setiap kali stream berubah */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [stream]);

  /* Fullscreen */
  const enterFullscreen = (e) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen)             el.requestFullscreen();
    else if (el.webkitRequestFullscreen)  el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen)     el.mozRequestFullScreen();
  };

  const dot = {
    connecting: "bg-amber-400",
    connected:  "bg-emerald-400 animate-pulse",
    failed:     "bg-rose-500",
  }[status] ?? "bg-slate-400";

  const lbl = {
    connecting: "Menghubungkan…",
    connected:  "LIVE",
    failed:     "Gagal",
  }[status] ?? status;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50 shadow-xl aspect-video group"
    >
      {/* Video — selalu ada di DOM supaya srcObject bisa di-set */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain bg-slate-950"
      />

      {/* Tombol fullscreen — muncul saat hover */}
      <button
        onClick={enterFullscreen}
        title="Fullscreen"
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all duration-150 z-10"
      >
        <Maximize2 size={13} />
      </button>

      {/* Overlay bawah */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 py-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {avatar
              ? <img src={avatar} className="w-7 h-7 rounded-full border-2 border-white/30 shrink-0 object-cover" />
              : (
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {username?.[0]?.toUpperCase() ?? "?"}
                </div>
              )
            }
            <div className="min-w-0">
              <p className="text-white text-xs font-bold leading-tight truncate">{username}</p>
              {task && <p className="text-white/55 text-[10px] leading-tight truncate">{task}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="text-white/70 text-[10px] font-semibold">{lbl}</span>
          </div>
        </div>
      </div>

      {/* Overlay loading */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 pointer-events-none">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-white/50 text-xs">Menghubungkan ke {username}…</p>
          </div>
        </div>
      )}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 pointer-events-none">
          <div className="text-center">
            <WifiOff size={28} className="text-rose-400 mx-auto mb-2" />
            <p className="text-white/60 text-xs">Koneksi gagal</p>
            <p className="text-white/35 text-[10px] mt-1">
              Jaringan berbeda — TURN server mengatasi ini otomatis jika sudah terpasang.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main page
═══════════════════════════════════════════════════════════ */
export default function LiveMonitor() {
  const { token }     = useAuth();
  const { iceServers } = useStream(); // pakai TURN dari StreamContext

  const wsRef  = useRef(null);
  const pcsRef = useRef({});   // {streamer_id: RTCPeerConnection}

  const [wsOk,      setWsOk]      = useState(false);
  const [streamers, setStreamers] = useState({});
  // {id: {username, task, avatar, status}}
  const [streams,   setStreams]   = useState({});
  // {id: MediaStream}  ← terpisah supaya update tidak buang PeerConnection

  /* ── Connect ke satu streamer (buat offer) ── */
  const connectToStreamer = useCallback((streamerId, ws) => {
    if (pcsRef.current[streamerId]) return; // sudah ada

    const pc = new RTCPeerConnection({ iceServers });
    pcsRef.current[streamerId] = pc;

    /* Terima video track dari streamer */
    pc.ontrack = (ev) => {
      console.log("[LiveMonitor] ontrack dari", streamerId, ev.streams[0]);
      setStreams(prev  => ({ ...prev, [streamerId]: ev.streams[0] }));
      setStreamers(prev =>
        prev[streamerId]
          ? { ...prev, [streamerId]: { ...prev[streamerId], status: "connected" } }
          : prev
      );
    };

    /* Kirim ICE candidate ke streamer */
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice", to: streamerId, candidate: ev.candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[LiveMonitor] connectionState", streamerId, pc.connectionState);
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setStreamers(prev =>
          prev[streamerId]
            ? { ...prev, [streamerId]: { ...prev[streamerId], status: "failed" } }
            : prev
        );
      }
    };

    /* Buat offer (recvonly — kita hanya terima video) */
    (async () => {
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[LiveMonitor] mengirim offer ke", streamerId);
        ws.send(JSON.stringify({ type: "offer", to: streamerId, sdp: pc.localDescription }));
      } catch (err) {
        console.error("[LiveMonitor] offer error:", err);
        setStreamers(prev =>
          prev[streamerId]
            ? { ...prev, [streamerId]: { ...prev[streamerId], status: "failed" } }
            : prev
        );
      }
    })();
  }, [iceServers]);

  /* ── WebSocket signaling ── */
  useEffect(() => {
    if (!token) return;

    console.log("[LiveMonitor] connecting to", `${WS_BASE}/ws/rtc`);
    const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[LiveMonitor] WS open, join_viewer");
      ws.send(JSON.stringify({ type: "join_viewer" }));
      setWsOk(true);
    };

    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      console.log("[LiveMonitor] <<", msg.type, msg);

      switch (msg.type) {

        case "streamers_list": {
          const init = {};
          msg.streamers.forEach(s => { init[s.id] = { ...s, status: "connecting" }; });
          setStreamers(init);
          msg.streamers.forEach(s => connectToStreamer(s.id, ws));
          break;
        }

        case "streamer_joined": {
          setStreamers(prev => ({
            ...prev,
            [msg.id]: { id: msg.id, username: msg.username, task: msg.task, avatar: msg.avatar, status: "connecting" },
          }));
          connectToStreamer(msg.id, ws);
          break;
        }

        case "streamer_left": {
          pcsRef.current[msg.id]?.close();
          delete pcsRef.current[msg.id];
          setStreamers(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
          setStreams(prev   => { const n = { ...prev }; delete n[msg.id]; return n; });
          break;
        }

        case "streamer_updated": {
          setStreamers(prev =>
            prev[msg.id] ? { ...prev, [msg.id]: { ...prev[msg.id], task: msg.task } } : prev
          );
          break;
        }

        case "answer": {
          const pc = pcsRef.current[msg.from];
          if (pc) {
            console.log("[LiveMonitor] setRemoteDescription answer dari", msg.from);
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(console.error);
          }
          break;
        }

        case "ice": {
          const pc = pcsRef.current[msg.from];
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          }
          break;
        }

        default: break;
      }
    };

    ws.onclose  = (e) => { console.log("[LiveMonitor] WS closed", e.code); setWsOk(false); };
    ws.onerror  = (e) => { console.error("[LiveMonitor] WS error", e); setWsOk(false); };

    return () => {
      ws.close();
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      setStreams({});
    };
  }, [token, connectToStreamer]);

  const entries   = Object.entries(streamers);
  const hasFailed = entries.some(([, s]) => s.status === "failed");
  const hasTurn   = iceServers.length > 2; // lebih dari STUN saja

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <Monitor size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Live Monitor</h1>
            <p className="text-xs text-slate-500">Pantau layar tim secara real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* TURN indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            hasTurn
              ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
              : "border-slate-700 bg-slate-800/50 text-slate-600"
          }`}>
            {hasTurn ? "🛡 TURN aktif" : "TURN belum ada"}
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            wsOk
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-slate-700 bg-slate-800 text-slate-500"
          }`}>
            {wsOk ? <><Wifi size={11} /> Terhubung</> : <><WifiOff size={11} /> Terputus</>}
          </div>
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400">
            <Users size={11} /> {entries.length} streaming
          </div>
        </div>
      </div>

      {/* Grid */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800 mb-4">
            <Radio size={26} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold text-lg mb-1">Belum ada yang streaming</p>
          <p className="text-slate-600 text-sm max-w-xs">
            Stream akan otomatis dimulai saat tim menekan{" "}
            <span className="text-violet-400 font-medium">▶ Mulai</span>{" "}
            pada task yang memiliki opsi <em>Live Stream</em>,
            atau bisa juga manual dari tombol di sidebar.
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${
          entries.length === 1 ? "grid-cols-1 max-w-3xl mx-auto" :
          entries.length <= 4  ? "grid-cols-2" :
                                  "grid-cols-3"
        }`}>
          {entries.map(([id, info]) => (
            <StreamCard
              key={id}
              username={info.username}
              task={info.task}
              avatar={info.avatar}
              status={info.status}
              stream={streams[id] ?? null}
            />
          ))}
        </div>
      )}

      {/* TURN server warning (tanpa TURN) */}
      {hasFailed && !hasTurn && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <p className="font-semibold mb-0.5">💡 Ada stream yang gagal terhubung</p>
          <p className="text-amber-500/70">
            Tim &amp; admin di jaringan berbeda.{" "}
            <strong>TURN server belum aktif</strong> — deploy ulang untuk menginstall coturn secara otomatis.
          </p>
        </div>
      )}
    </div>
  );
}
