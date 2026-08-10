/**
 * StreamContext — screen sharing via JPEG Frame Relay (bukan WebRTC).
 *
 * Arsitektur baru (lebih ringan):
 *   Talent  → canvas.toBlob(JPEG) @ 2fps → WS /ws/screen (binary)
 *   Server  → forward bytes ke semua viewer
 *   Viewer  → <img src=objectURL> diupdate tiap frame
 *
 * Keuntungan vs WebRTC mesh lama:
 *   • Talent encode 1x saja (dulu N kali, N = jumlah viewer)
 *   • Tidak perlu ICE/STUN/TURN negotiation
 *   • CPU jauh lebih rendah di sisi talent
 *
 * API yang disediakan ke komponen:
 *   startStream(taskTitle)          → minta screen share, mulai stream
 *   connectStreamWithMedia(stream)  → pakai stream yang sudah ada
 *   resumeStream()                  → re-capture setelah refresh
 *   stopStream()
 *   sendBRB(active)                 → overlay BRB di viewer
 *   updateTask(task)                → update judul task di viewer
 *   streaming, loading, currentTask
 *   iceServers                      → masih ada untuk fallback / LiveMonitor lama
 *   pendingResume                   → {task} jika ada stream sebelum refresh
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const StreamContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved    = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

const STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/* Resolusi canvas untuk encode frame — 1280×720 cukup untuk monitoring kerja */
const FRAME_W   = 1280;
const FRAME_H   = 720;
const FRAME_FPS = 2;       // 2 frame per detik — cukup untuk monitoring
const FRAME_Q   = 0.60;    // JPEG quality 60% — balance kualitas vs bandwidth

const LS_KEY = "magsika_active_stream";

function saveStreamState(task, orderId) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ task, orderId, ts: Date.now() })); } catch {}
}
function clearStreamState() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
function loadStreamState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 8 * 60 * 60 * 1000) { clearStreamState(); return null; }
    return data;
  } catch { return null; }
}

export function StreamProvider({ children }) {
  const { user, token } = useAuth();

  const [streaming,     setStreaming]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [currentTask,   setCurrentTask]   = useState("");
  const [iceServers,    setIceServers]    = useState(STUN);
  const [pendingResume, setPendingResume] = useState(null);

  const wsRef           = useRef(null);
  const streamRef       = useRef(null);
  const canvasRef       = useRef(null);   // offscreen canvas untuk encode
  const videoElRef      = useRef(null);   // offscreen video element
  const frameTimerRef   = useRef(null);   // setInterval untuk capture
  const resumeStreamRef = useRef(null);   // ref ke fungsi resumeStream (dipakai auto-resume)

  /* ── Cek localStorage saat mount ── */
  useEffect(() => {
    const saved = loadStreamState();
    if (saved) setPendingResume(saved);
  }, []);

  /* ── Auto-resume: klik di mana saja saat ada pendingResume ──
   * getDisplayMedia() butuh user gesture — click anywhere sudah cukup.
   * Listener didaftarkan hanya saat ada pendingResume & belum streaming.
   */
  const autoResumeHandlerRef = useRef(null);

  useEffect(() => {
    if (!pendingResume || streaming || loading) {
      // Bersihkan listener lama jika kondisi sudah tidak relevan
      if (autoResumeHandlerRef.current) {
        document.removeEventListener("click", autoResumeHandlerRef.current, true);
        autoResumeHandlerRef.current = null;
      }
      return;
    }

    const handler = () => {
      autoResumeHandlerRef.current = null;
      // resumeStream akan dipanggil, pendingResume akan di-clear di sana
      resumeStreamRef.current?.();
    };
    autoResumeHandlerRef.current = handler;
    // capture:true supaya bisa intercept sebelum elemen lain (termasuk tombol)
    document.addEventListener("click", handler, { once: true, capture: true });

    return () => {
      document.removeEventListener("click", handler, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResume, streaming, loading]);

  /* ── Ambil TURN credentials (masih dipakai LiveMonitor untuk fallback) ── */
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

  /* ── Stop frame capture timer ── */
  const _stopFrameTimer = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  /* ── Stop semua ── */
  const stopStream = useCallback((skipClearLS = false) => {
    _stopFrameTimer();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
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
  }, [_stopFrameTimer]);

  /* ── Kirim BRB signal ── */
  const sendBRB = useCallback((active) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "brb", active }));
    }
  }, []);

  /* ── Update task title di viewer ── */
  const updateTask = useCallback((task) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "update_task", task }));
    }
  }, []);

  /* ── Setup offscreen canvas + video, mulai kirim frame ── */
  const _startFrameCapture = useCallback((mediaStream, ws) => {
    /* Setup video element untuk baca frame */
    const videoEl = document.createElement("video");
    videoEl.srcObject = mediaStream;
    videoEl.muted     = true;
    videoEl.playsInline = true;
    videoElRef.current = videoEl;

    /* Canvas offscreen untuk encode */
    const canvas = document.createElement("canvas");
    canvas.width  = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d");
    canvasRef.current = canvas;

    videoEl.play().catch(() => {});

    /* Mulai kirim frame ke server */
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!videoEl.readyState || videoEl.videoWidth === 0) return;
      try {
        ctx.drawImage(videoEl, 0, 0, FRAME_W, FRAME_H);
        canvas.toBlob(blob => {
          if (blob && ws.readyState === WebSocket.OPEN) {
            ws.send(blob);
          }
        }, "image/jpeg", FRAME_Q);
      } catch (e) {
        /* Stream mungkin sudah berhenti */
      }
    }, Math.floor(1000 / FRAME_FPS));

    frameTimerRef.current = interval;
  }, []);

  /* ── Internal: koneksi ke /ws/screen (frame relay) ── */
  const currentOrderIdRef = useRef("");

  const _connectFrameRelay = useCallback((mediaStream, taskTitle, orderId = "") => {
    if (!token) { toast.error("Belum login — tidak bisa stream."); return; }

    const ws = new WebSocket(`${WS_BASE}/ws/screen?token=${token}`);
    wsRef.current = ws;

    ws.binaryType = "arraybuffer"; // tidak dipakai di streamer side, tapi set untuk konsistensi

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type:     "join_streamer",
        username: user?.name || user?.full_name || user?.username || "Tim",
        task:     taskTitle,
        order_id: orderId || "",
      }));
      currentOrderIdRef.current = orderId || "";
      _startFrameCapture(mediaStream, ws);
      setStreaming(true);
      setCurrentTask(taskTitle);
      setLoading(false);
      setPendingResume(null);
      saveStreamState(taskTitle, orderId);
      toast.success("🔴 Stream dimulai (Frame Relay, ringan).");
    };

    ws.onmessage = (e) => {
      /* Streamer tidak perlu menerima pesan apapun dari server, tapi log jika ada */
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);
          console.log("[Stream] msg dari server:", msg);
        } catch {}
      }
    };

    ws.onclose = (ev) => {
      console.log("[Stream] WS closed", ev.code);
      if (streaming || currentTask) saveStreamState(currentTask || taskTitle, currentOrderIdRef.current);
      _stopFrameTimer();
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
  }, [token, user, _startFrameCapture, _stopFrameTimer, stopStream, streaming, currentTask]);

  /* ── startStream: tampilkan picker lalu connect ── */
  const startStream = useCallback(async (taskTitle = "", orderId = "") => {
    if (streaming || loading) return;
    setLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      mediaStream.getVideoTracks()[0].onended = () => {
        toast.info("Stream dihentikan.");
        stopStream();
      };
      _connectFrameRelay(mediaStream, taskTitle, orderId);
    } catch (err) {
      setLoading(false);
      if (err.name === "NotAllowedError") return;
      console.error("[Stream] startStream error:", err);
      toast.error("Gagal mulai stream: " + err.message);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [streaming, loading, stopStream, _connectFrameRelay]);

  /* ── connectStreamWithMedia: gunakan stream yang sudah di-capture ── */
  const connectStreamWithMedia = useCallback((mediaStream, taskTitle = "", orderId = "") => {
    if (streaming || loading) return;
    if (!mediaStream) return;
    streamRef.current = mediaStream;
    setLoading(true);
    mediaStream.getVideoTracks()[0].onended = () => {
      toast.info("Stream dihentikan.");
      stopStream();
    };
    _connectFrameRelay(mediaStream, taskTitle, orderId);
  }, [streaming, loading, stopStream, _connectFrameRelay]);

  /* ── resumeStream: re-capture setelah refresh ── */
  const resumeStream = useCallback(async (taskTitle = "", orderId = "") => {
    const task = taskTitle || pendingResume?.task || "";
    const oid  = orderId || pendingResume?.orderId || "";
    clearStreamState();
    setPendingResume(null);
    setLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      mediaStream.getVideoTracks()[0].onended = () => {
        toast.info("Stream dihentikan.");
        stopStream();
      };
      _connectFrameRelay(mediaStream, task, oid);
    } catch (err) {
      setLoading(false);
      clearStreamState();
      if (err.name !== "NotAllowedError") toast.error("Gagal resume stream: " + err.message);
    }
  }, [pendingResume, stopStream, _connectFrameRelay]);

  /* Simpan referensi ke resumeStream supaya bisa dipakai di auto-resume click handler */
  useEffect(() => { resumeStreamRef.current = resumeStream; }, [resumeStream]);

  /* ── Blokir refresh / close tab saat stream aktif ──────────────────────────
   * beforeunload → browser tampilkan "Tinggalkan halaman ini?" dialog bawaan.
   * Keyboard: F5 dan Ctrl+R / Cmd+R dicegah selama streaming.
   * Ini mencegah stream mati karena refresh tidak sengaja.
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!streaming) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Chrome membutuhkan returnValue diset (meski teks tidak ditampilkan)
      e.returnValue = "Stream sedang aktif. Yakin mau meninggalkan halaman?";
      return e.returnValue;
    };

    const handleKeyDown = (e) => {
      // F5
      if (e.key === "F5") { e.preventDefault(); return; }
      // Ctrl+R atau Cmd+R
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [streaming]);

  /* ── dismissResume: user memilih tidak mau lanjut ── */
  const dismissResume = useCallback(() => {
    clearStreamState();
    setPendingResume(null);
  }, []);

  /* ── Cleanup saat unmount ── */
  useEffect(() => () => {
    _stopFrameTimer();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [_stopFrameTimer]);

  return (
    <StreamContext.Provider value={{
      streaming, loading, currentTask, iceServers,
      pendingResume,
      startStream, connectStreamWithMedia, resumeStream, stopStream,
      sendBRB, updateTask, dismissResume,
    }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  return useContext(StreamContext);
}
