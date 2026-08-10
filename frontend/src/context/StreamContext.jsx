/**
 * StreamContext — global WebRTC screen-sharing state.
 *
 * Provides:
 *   startStream(taskTitle)                   → shows browser picker, then connects
 *   connectStreamWithMedia(stream, taskTitle) → connect with already-captured stream
 *   resumeStream()                            → re-capture screen & reconnect after refresh
 *   stopStream()
 *   sendBRB(active)                          → broadcast BRB overlay to viewers
 *   streaming     (bool)
 *   loading       (bool)
 *   currentTask   (string)
 *   iceServers    (array)
 *   pendingResume (object|null) — {task} if stream was active before refresh
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const StreamContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

const STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const DISPLAY_CONSTRAINTS = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 } },
  audio: false,
};

const LS_KEY = "magsika_active_stream";

function saveStreamState(task) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ task, ts: Date.now() })); } catch {}
}
function clearStreamState() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
function loadStreamState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expired setelah 8 jam
    if (Date.now() - data.ts > 8 * 60 * 60 * 1000) { clearStreamState(); return null; }
    return data;
  } catch { return null; }
}

export function StreamProvider({ children }) {
  const { user, token } = useAuth();

  const [streaming,      setStreaming]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [currentTask,    setCurrentTask]    = useState("");
  const [iceServers,     setIceServers]     = useState(STUN);
  const [pendingResume,  setPendingResume]  = useState(null); // {task} jika ada state tersimpan

  const wsRef     = useRef(null);
  const streamRef = useRef(null);
  const pcsRef    = useRef({});

  /* ── Cek localStorage saat mount — ada sisa stream sebelum refresh? ── */
  useEffect(() => {
    const saved = loadStreamState();
    if (saved) setPendingResume(saved);
  }, []);

  /* ── Ambil TURN credentials dari backend ── */
  useEffect(() => {
    if (!token) return;
    api.get("/turn-credentials")
      .then(res => {
        if (res.data?.urls) {
          setIceServers([...STUN, {
            urls:       res.data.urls,
            username:   res.data.username,
            credential: res.data.credential,
          }]);
        }
      })
      .catch(() => {});
  }, [token]);

  /* ── Stop dan bersihkan semua ── */
  const stopStream = useCallback((skipClearLS = false) => {
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
    setCurrentTask("");
    if (!skipClearLS) {
      clearStreamState();
      setPendingResume(null);
    }
  }, []);

  /* ── Kirim BRB signal ke viewers ── */
  const sendBRB = useCallback((active) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "brb", active }));
    }
  }, []);

  /* ── Internal: WebSocket + WebRTC signaling ── */
  const _connectSignaling = useCallback((mediaStream, taskTitle) => {
    if (!token) { toast.error("Belum login — tidak bisa stream."); return; }

    const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type:     "join_streamer",
        username: user?.name || user?.username || "Tim",
        task:     taskTitle,
      }));
      setStreaming(true);
      setCurrentTask(taskTitle);
      setLoading(false);
      setPendingResume(null);
      saveStreamState(taskTitle);
      toast.success("🔴 Stream dimulai — admin bisa memantau layarmu.");
    };

    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "offer") {
        const viewerId = msg.from;
        const pc = new RTCPeerConnection({ iceServers });
        pcsRef.current[viewerId] = pc;

        mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));

        pc.onicecandidate = (ev) => {
          if (ev.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice", to: viewerId, candidate: ev.candidate }));
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", to: viewerId, sdp: pc.localDescription }));
        } catch (err) {
          console.error("[Stream] answer error:", err);
        }
      } else if (msg.type === "ice") {
        const pc = pcsRef.current[msg.from];
        if (pc && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        }
      }
    };

    ws.onclose = (ev) => {
      console.log("[Stream] WS closed", ev.code);
      // Simpan state ke LS sebelum stream mati — ini bisa karena refresh
      if (streaming || currentTask) saveStreamState(currentTask);
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
  }, [token, user, iceServers, stopStream, streaming, currentTask]);

  /* ── startStream: tampilkan picker lalu connect ── */
  const startStream = useCallback(async (taskTitle = "") => {
    if (streaming || loading) return;
    setLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CONSTRAINTS);
      streamRef.current = mediaStream;
      mediaStream.getVideoTracks()[0].onended = () => {
        toast.info("Stream dihentikan.");
        stopStream();
      };
      _connectSignaling(mediaStream, taskTitle);
    } catch (err) {
      setLoading(false);
      if (err.name === "NotAllowedError") return;
      console.error("[Stream] startStream error:", err);
      toast.error("Gagal mulai stream: " + err.message);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [streaming, loading, stopStream, _connectSignaling]);

  /* ── connectStreamWithMedia: gunakan stream yang sudah di-capture ── */
  const connectStreamWithMedia = useCallback((mediaStream, taskTitle = "") => {
    if (streaming || loading) return;
    if (!mediaStream) return;
    streamRef.current = mediaStream;
    setLoading(true);
    mediaStream.getVideoTracks()[0].onended = () => {
      toast.info("Stream dihentikan.");
      stopStream();
    };
    _connectSignaling(mediaStream, taskTitle);
  }, [streaming, loading, stopStream, _connectSignaling]);

  /* ── resumeStream: re-capture setelah refresh (dipanggil saat user klik banner) ── */
  const resumeStream = useCallback(async (taskTitle = "") => {
    const task = taskTitle || pendingResume?.task || "";
    clearStreamState();
    setPendingResume(null);
    setLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CONSTRAINTS);
      streamRef.current = mediaStream;
      mediaStream.getVideoTracks()[0].onended = () => {
        toast.info("Stream dihentikan.");
        stopStream();
      };
      _connectSignaling(mediaStream, task);
    } catch (err) {
      setLoading(false);
      clearStreamState();
      if (err.name !== "NotAllowedError") toast.error("Gagal resume stream: " + err.message);
    }
  }, [pendingResume, stopStream, _connectSignaling]);

  /* ── Cleanup saat unmount ── */
  useEffect(() => () => {
    // Saat unmount karena refresh: simpan state dulu
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(pcsRef.current).forEach(pc => pc.close());
  }, []);

  return (
    <StreamContext.Provider value={{
      streaming, loading, currentTask, iceServers,
      pendingResume,
      startStream, connectStreamWithMedia, resumeStream, stopStream, sendBRB,
    }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  return useContext(StreamContext);
}
