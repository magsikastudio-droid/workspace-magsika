import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

/* ─── shared style helpers ─────────────────────────────────────────── */
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const focusBorder = (e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)");
const blurBorder  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)");

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithToken } = useAuth();

  /* ── Step 1: credentials ── */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* ── Step 2: OTP ── */
  const [step,      setStep]      = useState("credentials"); // "credentials" | "otp"
  const [emailHint, setEmailHint] = useState("");
  const [otp,       setOtp]       = useState(["", "", "", "", "", ""]);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendCd, setResendCd] = useState(0); // countdown detik

  /* ── Submit credentials ── */
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ username, password });
      if (result.step === "otp") {
        setEmailHint(result.email_hint);
        setStep("otp");
        startResendCooldown();
      } else {
        // Default admin (bypass OTP)
        const role = result.user?.role;
        navigate(role === "talent" ? "/todo" : "/dashboard", { replace: true });
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Akun kamu sedang menunggu persetujuan admin.");
      } else {
        setError("Username atau password salah.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP input handlers ── */
  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) otpRefs[i + 1].current?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs[i - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs[5].current?.focus();
    }
  };

  /* ── Submit OTP ── */
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setError("Masukkan 6 digit kode OTP."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-login", { username, otp: code });
      loginWithToken(res.data.access_token, res.data.user);
      const role = res.data.user?.role;
      navigate(role === "talent" ? "/todo" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Kode OTP salah atau sudah kedaluwarsa.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend OTP ── */
  const startResendCooldown = () => {
    setResendCd(60);
    const t = setInterval(() => {
      setResendCd(prev => { if (prev <= 1) { clearInterval(t); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCd > 0) return;
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
      startResendCooldown();
    } catch {
      setError("Gagal kirim ulang OTP. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared card wrapper ── */
  const card = (content) => (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "#0f0f0f" }}>
      <div className="pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }} />
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img src="/magsika-apps-01.png" alt="Magsika Workspace"
            className="h-20 w-20 rounded-2xl object-cover"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)" }} />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">Magsika Workspace</h1>
            <p className="mt-1 text-sm text-slate-400">Masuk untuk melanjutkan</p>
          </div>
        </div>
        <div className="w-full max-w-sm rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
          {content}
        </div>
      </div>
    </div>
  );

  /* ── Step 1: credentials form ── */
  if (step === "credentials") return card(
    <form className="space-y-4" onSubmit={handleCredentials}>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Username</label>
        <input autoComplete="username"
          className="w-full rounded-xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600"
          style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
          value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
        <input type="password" autoComplete="current-password"
          className="w-full rounded-xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600"
          style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
          value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-rose-300"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading}
        className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: loading ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: loading ? "none" : "0 4px 24px rgba(124,58,237,0.35)" }}>
        {loading ? "Memproses..." : "Masuk"}
      </button>
      <p className="mt-5 text-center text-xs text-slate-500">
        Belum punya akun?{" "}
        <Link to="/register" className="font-semibold text-violet-400 hover:text-violet-300 transition">Daftar sekarang</Link>
      </p>
    </form>
  );

  /* ── Step 2: OTP form ── */
  return card(
    <form onSubmit={handleOtpSubmit}>
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
          <span className="text-2xl">📧</span>
        </div>
        <h2 className="text-base font-bold text-white">Cek Email Kamu</h2>
        <p className="mt-1 text-xs text-slate-400">
          Kode OTP 6 digit telah dikirim ke<br />
          <span className="font-semibold text-violet-400">{emailHint}</span>
        </p>
      </div>

      {/* OTP boxes */}
      <div className="mb-5 flex justify-center gap-2" onPaste={handleOtpPaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={otpRefs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(i, e)}
            autoFocus={i === 0}
            className="h-12 w-11 rounded-xl border text-center text-lg font-bold text-white outline-none transition"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: digit ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.1)",
              caretColor: "#a5b4fc",
            }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm text-rose-300"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading || otp.join("").length < 6}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 4px 24px rgba(124,58,237,0.35)" }}>
        {loading ? "Memverifikasi..." : "Verifikasi"}
      </button>

      {/* Resend + back */}
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => { setStep("credentials"); setError(null); setOtp(["","","","","",""]); }}
          className="text-xs text-slate-500 hover:text-slate-300 transition">
          ← Ganti akun
        </button>
        <button type="button" onClick={handleResend} disabled={resendCd > 0 || loading}
          className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {resendCd > 0 ? `Kirim ulang (${resendCd}d)` : "Kirim ulang OTP"}
        </button>
      </div>
    </form>
  );
}
