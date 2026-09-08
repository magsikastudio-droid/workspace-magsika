import React, { useRef, useState } from "react";
import { api } from "../lib/api";

/* Halaman diagnosa Open Mic — 2 tes independen:
   1) Loopback lokal murni (2 RTCPeerConnection di 1 tab, tanpa signaling
      server/jaringan sama sekali) — buat mastiin dasar pipeline
      getUserMedia -> addTrack -> offer/answer -> ontrack -> <audio>.play()
      beneran jalan di browser ini, LEPAS dari soal jaringan/TURN/server.
   2) Cek TURN credentials + reachability dari browser ini langsung. */
export default function DebugOpenMic() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const audioRef = useRef(null);

  const addLog = (msg, ok = null) => {
    const prefix = ok === true ? "✅" : ok === false ? "❌" : "•";
    setLog((l) => [...l, `${prefix} ${msg}`]);
  };

  const runLoopbackTest = async () => {
    setLog([]);
    setRunning(true);
    let micTrack = null;
    let pc1, pc2;
    try {
      addLog("Minta izin microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micTrack = stream.getAudioTracks()[0];
      addLog(`Mic didapat: "${micTrack.label || "(no label)"}", enabled=${micTrack.enabled}, muted=${micTrack.muted}`, true);

      pc1 = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc2 = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

      pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch((err) => addLog("pc2 addIceCandidate gagal: " + err, false)); };
      pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch((err) => addLog("pc1 addIceCandidate gagal: " + err, false)); };

      let gotTrack = false;
      pc2.ontrack = (e) => {
        gotTrack = true;
        addLog("pc2 nerima track dari pc1 (ontrack fired)", true);
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          audioRef.current.play()
            .then(() => addLog("audio.play() SUKSES — kalau ini muncul tapi tetap gak denger apa-apa, coba ngomong ke mic sekarang (ada delay ~1 detik, ini loopback suara kamu sendiri)", true))
            .catch((err) => addLog(`audio.play() GAGAL: ${err.name} — ${err.message} (INI KEMUNGKINAN BESAR AKAR MASALAHNYA — autoplay diblokir browser)`, false));
        }
      };

      pc1.oniceconnectionstatechange = () => addLog(`pc1 iceConnectionState: ${pc1.iceConnectionState}`);
      pc2.oniceconnectionstatechange = () => addLog(`pc2 iceConnectionState: ${pc2.iceConnectionState}`);

      pc1.addTrack(micTrack, stream);
      addLog("Track ditambahkan ke pc1, bikin offer...");

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);
      addLog("Offer/answer selesai ditukar, nunggu ICE connect...");

      await new Promise((resolve) => {
        const check = () => {
          if (pc1.iceConnectionState === "connected" || pc1.iceConnectionState === "completed") resolve();
          else if (pc1.iceConnectionState === "failed") resolve();
          else setTimeout(check, 200);
        };
        check();
        setTimeout(resolve, 8000); // timeout jaga-jaga
      });

      if (pc1.iceConnectionState === "failed") {
        addLog("ICE GAGAL KONEK bahkan buat loopback lokal (harusnya paling gampang) — kemungkinan besar ada masalah di level OS/browser (VPN aktif? extension blokir WebRTC?)", false);
      } else if (!gotTrack) {
        addLog("ICE connect tapi ontrack TIDAK PERNAH kepanggil setelah 8 detik — ada yang aneh di negotiation", false);
      }

      addLog("--- Tes track.enabled toggle (simulasi push-to-talk) ---");
      micTrack.enabled = false;
      addLog("track.enabled = false (mute)");
      await new Promise((r) => setTimeout(r, 500));
      micTrack.enabled = true;
      addLog("track.enabled = true (unmute) — coba ngomong sekarang, harusnya kedengeran lewat speaker (loopback)", true);
    } catch (err) {
      addLog(`ERROR: ${err.name} — ${err.message}`, false);
    } finally {
      setRunning(false);
      setTimeout(() => {
        pc1?.close(); pc2?.close();
        micTrack?.stop();
      }, 15000);
    }
  };

  const testTurn = async () => {
    setLog([]);
    setRunning(true);
    try {
      addLog("Ambil TURN credentials dari server...");
      const res = await api.get("/turn-credentials");
      addLog(`Dapat: ${JSON.stringify(res.data.urls)}`, true);

      for (const url of res.data.urls) {
        addLog(`Tes koneksi ke ${url}...`);
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: url, username: res.data.username, credential: res.data.credential }],
          iceTransportPolicy: "relay", // paksa pakai TURN doang, biar ketauan valid/gaknya
        });
        pc.createDataChannel("test");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const relayFound = await new Promise((resolve) => {
          let found = false;
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              addLog(`  kandidat: ${e.candidate.candidate}`);
              if (e.candidate.type === "relay" || e.candidate.candidate.includes("relay")) found = true;
            } else {
              resolve(found);
            }
          };
          setTimeout(() => resolve(found), 5000);
        });
        addLog(relayFound ? `${url} BERHASIL dapat relay candidate` : `${url} GAGAL dapat relay candidate dalam 5 detik`, relayFound);
        pc.close();
      }
    } catch (err) {
      addLog(`ERROR: ${err.name} — ${err.message}`, false);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Debug Open Mic</h1>
        <p className="mt-0.5 text-sm text-slate-500">Alat diagnosa — jalankan tes lalu screenshot/salin hasilnya.</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={runLoopbackTest}
          disabled={running}
          className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          1. Tes Loopback Lokal (mic ke diri sendiri)
        </button>
        <button
          onClick={testTurn}
          disabled={running}
          className="rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          2. Tes TURN Server
        </button>
      </div>

      <audio ref={audioRef} autoPlay />

      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 min-h-[200px] max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
        {log.length === 0 ? "(belum ada log — klik salah satu tombol di atas)" : log.join("\n")}
      </div>
    </div>
  );
}
