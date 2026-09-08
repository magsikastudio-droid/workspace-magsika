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
  const [micActive, setMicActive] = useState(false); // koneksi audio ke lawan bicara sudah terbentuk
  const [talking, setTalking] = useState(false); // lagi push-to-talk aktif

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localTrackRef = useRef(null);
  const remoteAudioElRef = useRef(null);
  const myCidRef = useRef(null);
  const peerCidRef = useRef(null);

  const iceServersRef = useRef(iceServers || STUN);
  useEffect(() => { iceServersRef.current = iceServers && iceServers.length ? iceServers : STUN; }, [iceServers]);

  /* ── audio element buat playback suara lawan bicara ── */
  const attachRemoteAudio = useCallback((el) => { remoteAudioElRef.current = el; }, []);

  const _ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN && peerCidRef.current) {
        wsRef.current.send(JSON.stringify({ type: "ice", to: peerCidRef.current, candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => {
      if (remoteAudioElRef.current) {
        remoteAudioElRef.current.srcObject = e.streams[0];
        remoteAudioElRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setMicActive(false);
      }
    };
    pcRef.current = pc;
    return pc;
  }, []);

  const _getLocalMic = useCallback(async () => {
    if (localTrackRef.current) return localTrackRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      track.enabled = false; // mute dari awal — push-to-talk yang nyalain
      localTrackRef.current = track;
      return track;
    } catch (e) {
      console.error("[OpenMic] mic permission ditolak:", e);
      return null;
    }
  }, []);

  /* ── viewer: mulai ngobrol sama satu streamer (bikin offer) ── */
  const connectToStreamer = useCallback(async (targetCid) => {
    if (role !== "viewer") return;
    const track = await _getLocalMic();
    if (!track) return;
    peerCidRef.current = targetCid;
    const pc = _ensurePeerConnection();
    pc.addTrack(track);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: "offer", to: targetCid, sdp: offer }));
  }, [role, _getLocalMic, _ensurePeerConnection]);

  /* ── push-to-talk ── */
  const startTalking = useCallback(() => {
    if (localTrackRef.current) { localTrackRef.current.enabled = true; setTalking(true); }
  }, []);
  const stopTalking = useCallback(() => {
    if (localTrackRef.current) { localTrackRef.current.enabled = false; setTalking(false); }
  }, []);

  const disconnect = useCallback(() => {
    stopTalking();
    pcRef.current?.close();
    pcRef.current = null;
    localTrackRef.current?.stop();
    localTrackRef.current = null;
    peerCidRef.current = null;
    setMicActive(false);
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
        const track = await _getLocalMic();
        peerCidRef.current = msg.from;
        const pc = _ensurePeerConnection();
        if (track) pc.addTrack(track);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", to: msg.from, sdp: answer }));
        setMicActive(true);
      } else if (msg.type === "answer") {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          setMicActive(true);
        }
      } else if (msg.type === "ice") {
        if (pcRef.current && msg.candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        }
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
    wsConnected, streamers, micActive, talking,
    connectToStreamer, startTalking, stopTalking, disconnect,
    attachRemoteAudio,
  };
}
