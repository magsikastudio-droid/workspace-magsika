/**
 * LiveMonitor — tampil layar tim via JPEG Frame Relay.
 *
 * Arsitektur: server forward JPEG binary dari streamer ke semua viewer.
 * Tidak pakai WebRTC — tidak butuh ICE/STUN/TURN.
 * CPU viewer & streamer jauh lebih ringan.
 *
 * Protocol WebSocket /ws/screen (viewer side):
 *   → JSON {type:"join_viewer"}
 *   ← JSON {type:"streamers_list", streamers:[{id,username,task,brb}]}
 *   ← JSON {type:"streamer_joined", id, username, task}
 *   ← JSON {type:"streamer_left", id}
 *   ← JSON {type:"streamer_brb", id, active}
 *   ← JSON {type:"streamer_updated", id, task}
 *   ← JSON {type:"frame", id, username, task, brb}  ← diikuti BINARY JPEG
 *   ← BYTES raw JPEG frame
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Maximize2, Monitor, Wifi, WifiOff, Radio, Users, Square } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved    = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

/* ═══════════════════════════════════════════════════════════
   StreamCard — tampilkan frame JPEG dari streamer
═══════════════════════════════════════════════════════════ */
function StreamCard({ id, username, task, avatar, brb, imgRef, canEnd, onEndStream }) {
  const containerRef = useRef(null);
  const [ending, setEnding] = useState(false);

  const enterFullscreen = (e) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if      (el.requestFullscreen)            el.requestFullscreen();
    else if (el.webkitRequestFullscreen)      el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen)         el.mozRequestFullScreen();
  };

  const handleEndStream = async (e) => {
    e.stopPropagation();
    if (ending) return;
    if (!window.confirm(`Hentikan live stream ${username} sekarang?`)) return;
    setEnding(true);
    try {
      await onEndStream(id);
      toast.success(`Stream ${username} dihentikan.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menghentikan stream.");
      setEnding(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50 shadow-xl aspect-video group"
    >
      {/* Frame image — src diupdate dari parent via imgRef */}
      <img
        ref={imgRef}
        alt={`Layar ${username}`}
        className="w-full h-full object-contain bg-slate-950"
        style={{ display: "block" }}
      />

      {/* Fullscreen */}
      <button
        onClick={enterFullscreen}
        title="Fullscreen"
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all duration-150 z-10"
      >
        <Maximize2 size={13} />
      </button>

      {/* End Stream — admin/PM saja */}
      {canEnd && (
        <button
          onClick={handleEndStream}
          disabled={ending}
          title={`Hentikan stream ${username}`}
          className="absolute top-2 right-11 flex items-center gap-1 h-7 px-2 rounded-lg bg-rose-600/80 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 hover:bg-rose-600 disabled:opacity-60 transition-all duration-150 z-10"
        >
          <Square size={11} /> {ending ? "..." : "End Stream"}
        </button>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 py-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {avatar
              ? <img src={avatar} className="w-7 h-7 rounded-full border-2 border-white/30 shrink-0 object-cover" alt="" />
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
          {/* LIVE badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-white/70 text-[10px] font-semibold">LIVE</span>
          </div>
        </div>
      </div>

      {/* BRB overlay */}
      {brb && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        >
          <p className="text-5xl mb-3">☕</p>
          <p className="text-white text-2xl font-black tracking-widest uppercase">Be Right Back!</p>
          <div className="flex gap-1.5 mt-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
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
  const { token, user } = useAuth();
  const canEnd = user?.role === "admin" || user?.role === "pm";

  const wsRef       = useRef(null);
  const imgRefsMap  = useRef({});   // {streamer_id: React ref}
  const prevUrlsRef = useRef({});   // {streamer_id: objectURL} — untuk di-revoke
  const pendingMeta = useRef(null); // JSON frame metadata menunggu binary frame

  const [wsOk,      setWsOk]      = useState(false);
  const [streamers, setStreamers] = useState({});
  // {id: {id, username, task, avatar, brb}}

  /* Pastikan imgRef tersedia untuk setiap streamer */
  const getImgRef = useCallback((id) => {
    if (!imgRefsMap.current[id]) {
      imgRefsMap.current[id] = React.createRef();
    }
    return imgRefsMap.current[id];
  }, []);

  /* Update <img> src dari binary JPEG frame */
  const applyFrame = useCallback((streamerId, arrayBuffer) => {
    const ref = imgRefsMap.current[streamerId];
    if (!ref?.current) return;

    /* Revoke URL lama untuk free memory */
    const oldUrl = prevUrlsRef.current[streamerId];
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    const blob   = new Blob([arrayBuffer], { type: "image/jpeg" });
    const newUrl = URL.createObjectURL(blob);
    prevUrlsRef.current[streamerId] = newUrl;
    ref.current.src = newUrl;
  }, []);

  /* ── WebSocket ke /ws/screen ── */
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/ws/screen?token=${token}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_viewer" }));
      setWsOk(true);
    };

    ws.onmessage = (e) => {
      /* ── Binary frame ── */
      if (e.data instanceof ArrayBuffer) {
        const meta = pendingMeta.current;
        pendingMeta.current = null;
        if (meta?.id) {
          /* Update brb dari meta terbaru */
          setStreamers(prev =>
            prev[meta.id]
              ? { ...prev, [meta.id]: { ...prev[meta.id], brb: meta.brb, task: meta.task } }
              : prev
          );
          applyFrame(meta.id, e.data);
        }
        return;
      }

      /* ── JSON control message ── */
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      switch (msg.type) {

        case "streamers_list": {
          const init = {};
          msg.streamers.forEach(s => { init[s.id] = { ...s }; });
          setStreamers(init);
          break;
        }

        case "streamer_joined": {
          setStreamers(prev => ({
            ...prev,
            [msg.id]: { id: msg.id, username: msg.username, task: msg.task ?? "", avatar: msg.avatar ?? "", brb: false },
          }));
          break;
        }

        case "streamer_left": {
          /* Revoke image URL yang tersimpan */
          const url = prevUrlsRef.current[msg.id];
          if (url) { URL.revokeObjectURL(url); delete prevUrlsRef.current[msg.id]; }
          delete imgRefsMap.current[msg.id];
          setStreamers(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
          break;
        }

        case "streamer_updated": {
          setStreamers(prev =>
            prev[msg.id] ? { ...prev, [msg.id]: { ...prev[msg.id], task: msg.task } } : prev
          );
          break;
        }

        case "streamer_brb": {
          setStreamers(prev =>
            prev[msg.id] ? { ...prev, [msg.id]: { ...prev[msg.id], brb: msg.active } } : prev
          );
          break;
        }

        case "frame": {
          /* Metadata frame — bytes JPEG akan datang sebagai pesan berikutnya */
          pendingMeta.current = msg;
          break;
        }

        default: break;
      }
    };

    ws.onclose  = (e) => { setWsOk(false); };
    ws.onerror  = ()  => { setWsOk(false); };

    return () => {
      ws.close();
      /* Revoke semua objectURL */
      Object.values(prevUrlsRef.current).forEach(u => URL.revokeObjectURL(u));
      prevUrlsRef.current = {};
      imgRefsMap.current  = {};
    };
  }, [token, applyFrame]);

  const entries = Object.entries(streamers);

  /* Server bakal broadcast "streamer_left" begitu koneksinya kepotong —
     state di sini cukup nunggu itu, tidak perlu di-set manual di sini. */
  const handleEndStream = useCallback((streamerId) => api.post(`/streams/${streamerId}/end`), []);

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <Monitor size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Live Monitor</h1>
            <p className="text-xs text-slate-500">Pantau layar tim — Frame Relay, ringan &amp; cepat</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode badge */}
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400">
            ⚡ Frame Relay
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
              id={id}
              username={info.username}
              task={info.task}
              avatar={info.avatar}
              brb={info.brb ?? false}
              imgRef={getImgRef(id)}
              canEnd={canEnd}
              onEndStream={handleEndStream}
            />
          ))}
        </div>
      )}
    </div>
  );
}
