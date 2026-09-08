/**
 * useOpenMic — audio 2-arah real-time (push-to-talk) lewat WebRTC, pakai
 * signaling /ws/rtc yang sebelumnya sudah dibangun tapi tidak pernah dipakai
 * (Live Monitor sekarang jalan pakai Frame Relay JPEG, bukan WebRTC, karena
 * video WebRTC dulu sering black-screen). Audio jauh lebih ringan/reliable
 * daripada video, jadi aman dipakai ulang cuma buat suara.
 *
 * Model: sekali koneksi terbentuk, kedua sisi nambahin audio track tapi
 * `track.enabled = false` (mute) dari awal. Push-to-talk cuma toggle
 * `enabled` — tidak ada renegosiasi SDP sama sekali, jadi bener-bener
 * instan begitu tombol ditekan (tidak delay).
 *
 * role "viewer"   (admin, Live Monitor) — connect, lihat daftar streamer,
 *                 initiate offer ke satu streamer target.
 * role "streamer" (talent, lagi kerja)  — connect, tunggu offer masuk,
 *                 auto-jawab begitu ada yang mau ngobrol.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const resolved = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolved.replace(/^http/, "ws");

const STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useOpenMic({ role, token, username, task = "", iceServers, enabled = true }) {
  const [wsConnected, setWsConnected] = useState(false);
  const [streamers, setStreamers] = useState([]); // viewer only: [{cid, username, task}]
  const [micActive, setMicActive] = useState(false); // koneksi audio ke lawan bicara BENERAN "connected" (bukan cuma sinyal ketuker)
  const [talking, setTalking] = useState(false); // lagi push-to-talk aktif
  const [audioBlocked, setAudioBlocked] = useState(false); // autoplay browser diblokir, butuh klik manual
  const [connState, setConnState] = useState(""); // status asli WebRTC (checking/connected/failed/dst) - buat ditampilin di UI, gak perlu buka console
  const [gotRemoteTrack, setGotRemoteTrack] = useState(false); // ontrack beneran kepanggil atau belum

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localTrackRef = useRef(null);
  const remoteAudioElRef = useRef(null);
  const myCidRef = useRef(null);
  const peerCidRef = useRef(null);
  const pendingIceRef = useRef([]); // ICE candidate yang nyampe sebelum remote description ke-set

  const iceServersRef = useRef(iceServers || STUN);
  useEffect(() => { iceServersRef.current = iceServers && iceServers.length ? iceServers : STUN; }, [iceServers]);

  /* ── audio element buat playback suara lawan bicara ── */
  const attachRemoteAudio = useCallback((el) => { remoteAudioElRef.current = el; }, []);

  /* ── Dipanggil dari tombol "Aktifkan Suara" kalau autoplay diblokir —
     play() dari dalam click handler asli SELALU diizinkan browser. ── */
  const unlockAudio = useCallback(() => {
    remoteAudioElRef.current?.play()
      .then(() => setAudioBlocked(false))
      .catch((err) => console.warn("[OpenMic] unlockAudio masih gagal:", err));
  }, []);

  const _ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN && peerCidRef.current) {
        wsRef.current.send(JSON.stringify({ type: "ice", to: peerCidRef.current, candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => {
      setGotRemoteTrack(true);
      if (remoteAudioElRef.current) {
        remoteAudioElRef.current.srcObject = e.streams[0];
        remoteAudioElRef.current.play()
          .then(() => setAudioBlocked(false))
          .catch((err) => {
            // Browser (Chrome dkk) sering diam-diam blokir autoplay audio yang
            // dipicu dari event WebRTC (bukan klik langsung) — koneksinya
            // sukses tapi suaranya gak pernah bunyi. Kasih tombol manual.
            console.warn("[OpenMic] autoplay diblokir:", err.name, err.message);
            setAudioBlocked(true);
          });
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log("[OpenMic] iceConnectionState:", pc.iceConnectionState);
      setConnState(pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        toast.error("Open Mic gagal konek (ICE failed — kemungkinan jaringan/firewall memblokir) — coba lagi.");
        setMicActive(false);
      }
    };
    pc.onicecandidateerror = (e) => {
      console.warn("[OpenMic] ICE candidate error:", e.errorCode, e.errorText, e.url);
    };
    pc.onconnectionstatechange = () => {
      console.log("[OpenMic] connectionState:", pc.connectionState);
      // micActive BENERAN nyala di sini — bukan pas offer/answer selesai
      // ditukar (itu cuma sinyal, belum tentu media path-nya jadi). Ini
      // yang bikin bug 'ikon hijau tapi bisu' - status ke-set optimis
      // duluan sebelum ICE beneran connect.
      if (pc.connectionState === "connected") {
        setMicActive(true);
      } else if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setMicActive(false);
      }
    };
    pcRef.current = pc;
    return pc;
  }, []);

  /* ── ICE candidate bisa nyampe duluan sebelum remote description ke-set
     (race condition klasik WebRTC) — ditampung dulu, di-apply belakangan. */
  const _addIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (!pc.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn("[OpenMic] addIceCandidate gagal:", e); }
  }, []);

  const _flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn("[OpenMic] addIceCandidate (flush) gagal:", e); }
    }
  }, []);

  const _getLocalMic = useCallback(async () => {
    if (localTrackRef.current) return localTrackRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Browser ini tidak dukung akses microphone.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      track.enabled = false; // mute dari awal — push-to-talk yang nyalain
      localTrackRef.current = track;
      return track;
    } catch (e) {
      console.error("[OpenMic] mic gagal diakses:", e);
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        toast.error("Izin microphone ditolak — klik ikon 🔒/kamera di address bar, izinkan Microphone, lalu coba lagi.");
      } else if (e.name === "NotFoundError") {
        toast.error("Tidak ketemu microphone di perangkat ini.");
      } else {
        toast.error("Gagal akses microphone: " + (e.message || e.name));
      }
      return null;
    }
  }, []);

  /* ── tutup koneksi lama kalau ada sebelum bikin yang baru — mencegah
     'sender already exists' kalau ada offer dobel / klik dobel / reconnect
     ke target lain sementara koneksi lama masih nyangkut. ── */
  const _resetPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceRef.current = [];
    setConnState("");
    setGotRemoteTrack(false);
  }, []);

  /* ── viewer: mulai ngobrol sama satu streamer (bikin offer) ── */
  const connectToStreamer = useCallback(async (targetCid) => {
    if (role !== "viewer") return false;
    const track = await _getLocalMic();
    if (!track) return false;
    try {
      _resetPeerConnection();
      peerCidRef.current = targetCid;
      const pc = _ensurePeerConnection();
      pc.addTrack(track);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: "offer", to: targetCid, sdp: offer }));
      return true;
    } catch (e) {
      console.error("[OpenMic] gagal bikin koneksi:", e);
      toast.error("Gagal menyambungkan Open Mic: " + (e.message || e.name));
      return false;
    }
  }, [role, _getLocalMic, _ensurePeerConnection, _resetPeerConnection]);

  /* ── push-to-talk ── */
  const startTalking = useCallback(() => {
    if (localTrackRef.current) { localTrackRef.current.enabled = true; setTalking(true); }
  }, []);
  const stopTalking = useCallback(() => {
    if (localTrackRef.current) { localTrackRef.current.enabled = false; setTalking(false); }
  }, []);

  const disconnect = useCallback((notifyPeer = true) => {
    // Kasih tau lawan bicara LANGSUNG lewat signaling (bukan nunggu ICE
    // timeout yang bisa lama/gak konsisten) - biar sisi sana juga langsung
    // beres-beres, gak nyangkut connection lama pas nyoba sambung ulang.
    if (notifyPeer && peerCidRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "hangup", to: peerCidRef.current }));
    }
    stopTalking();
    pcRef.current?.close();
    pcRef.current = null;
    localTrackRef.current?.stop();
    localTrackRef.current = null;
    peerCidRef.current = null;
    pendingIceRef.current = [];
    setMicActive(false);
    setAudioBlocked(false);
    setConnState("");
    setGotRemoteTrack(false);
  }, [stopTalking]);

  /* ── koneksi signaling /ws/rtc ── */
  useEffect(() => {
    if (!token || !enabled) return;
    const ws = new WebSocket(`${WS_BASE}/ws/rtc?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      if (role === "streamer") {
        ws.send(JSON.stringify({ type: "join_streamer", username, task }));
      } else {
        ws.send(JSON.stringify({ type: "join_viewer" }));
      }
    };

    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "streamers_list") {
        setStreamers(msg.streamers || []);
      } else if (msg.type === "streamer_joined") {
        setStreamers((prev) => [...prev.filter((s) => s.id !== msg.id), { id: msg.id, username: msg.username, task: msg.task }]);
      } else if (msg.type === "streamer_left") {
        setStreamers((prev) => prev.filter((s) => s.id !== msg.id));
        if (peerCidRef.current === msg.id) disconnect();
      } else if (msg.type === "offer") {
        // streamer sisi terima — auto-jawab, mic diminta on-demand
        try {
          _resetPeerConnection(); // jaga-jaga ada offer dobel/reconnect
          const track = await _getLocalMic();
          peerCidRef.current = msg.from;
          const pc = _ensurePeerConnection();
          if (track) pc.addTrack(track);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await _flushPendingIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", to: msg.from, sdp: answer }));
          setConnState("negotiating"); // sinyal ketuker, nunggu ICE beneran connect (lihat onconnectionstatechange)
        } catch (err) {
          console.error("[OpenMic] gagal jawab offer:", err);
          toast.error("Gagal terima koneksi Open Mic: " + (err.message || err.name));
        }
      } else if (msg.type === "answer") {
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await _flushPendingIce();
            setConnState("negotiating"); // sinyal ketuker, nunggu ICE beneran connect
          } catch (err) {
            console.error("[OpenMic] gagal proses answer:", err);
            toast.error("Gagal menyambungkan Open Mic: " + (err.message || err.name));
          }
        }
      } else if (msg.type === "ice") {
        if (msg.candidate) await _addIceCandidate(msg.candidate);
      } else if (msg.type === "hangup") {
        // Lawan bicara matiin mic-nya — beres-beres langsung di sini juga,
        // jangan nunggu ICE timeout (bisa lama/gak konsisten & bikin
        // koneksi berikutnya nyangkut ke state lama).
        if (peerCidRef.current === msg.from) disconnect(false);
      }
    };

    ws.onclose = () => { setWsConnected(false); };
    ws.onerror = () => { setWsConnected(false); };

    return () => {
      ws.onclose = null;
      ws.close();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, username, enabled]);

  return {
    wsConnected, streamers, micActive, talking, audioBlocked, connState, gotRemoteTrack,
    connectToStreamer, startTalking, stopTalking, disconnect,
    attachRemoteAudio, unlockAudio,
  };
}
