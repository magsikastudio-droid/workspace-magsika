import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { api } from "../lib/api";

export default function Register() {
  const [form, setForm]   = useState({ username: "", full_name: "", email: "", password: "" });
  const [step, setStep]   = useState("form");   // "form" | "otp" | "done"
  const [otp,  setOtp]    = useState(["", "", "", "", "", ""]);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendCd, setResendCd] = useState(0);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  /* ── Step 1: kirim OTP ke email ── */
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError("Password minimal 6 karakter."); return; }
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/send-register-otp", { email: form.email, username: form.username });
      setStep("otp");
      startResendCooldown();
    } catch (err) {
      setError(err.response?.data?.detail || "Gagal mengirim OTP. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: verifikasi OTP + buat akun ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setError("Masukkan 6 digit kode OTP."); return; }
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/register", { ...form, otp: code });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.detail || "Pendaftaran gagal. Coba lagi.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs[0].current?.focus();
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
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
  };
  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split("")); otpRefs[5].current?.focus(); }
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
    setLoading(true);
    try {
      await api.post("/auth/send-register-otp", { email: form.email, username: form.username });
      startResendCooldown();
    } catch (err) {
      setError(err.response?.data?.detail || "Gagal kirim ulang OTP.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Sukses ── */
  if (step === "done") return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
            <UserPlus size={28} />
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2">Pendaftaran Berhasil!</h2>
        <p className="text-sm text-slate-500 mb-6">
          Email kamu sudah terverifikasi ✅<br />
          Akunmu sedang menunggu persetujuan admin.
        </p>
        <Link to="/login"
          className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
          Kembali ke Login
        </Link>
      </div>
    </div>
  );

  /* ── OTP step ── */
  if (step === "otp") return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
            <span className="text-3xl">📧</span>
          </div>
          <h2 className="text-xl font-semibold">Verifikasi Email</h2>
          <p className="mt-1 text-sm text-slate-500">
            Kode OTP telah dikirim ke<br />
            <span className="font-semibold text-violet-600">{form.email}</span>
          </p>
        </div>

        <form onSubmit={handleRegister}>
          {/* OTP boxes */}
          <div className="mb-5 flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input key={i} ref={otpRefs[i]}
                type="text" inputMode="numeric" maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
                className="h-12 w-11 rounded-xl border-2 text-center text-lg font-bold text-slate-900 outline-none transition"
                style={{ borderColor: digit ? "#7c3aed" : "#e2e8f0" }}
              />
            ))}
          </div>

          {error && <p className="mb-4 text-sm text-rose-600 text-center">{error}</p>}

          <button type="submit" disabled={loading || otp.join("").length < 6}
            className="w-full rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Memverifikasi..." : "Daftar & Verifikasi"}
          </button>

          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={() => { setStep("form"); setError(null); setOtp(["","","","","",""]); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition">
              ← Ubah data
            </button>
            <button type="button" onClick={handleResend} disabled={resendCd > 0 || loading}
              className="text-xs text-violet-600 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
              {resendCd > 0 ? `Kirim ulang (${resendCd}d)` : "Kirim ulang OTP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  /* ── Form pendaftaran ── */
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-600 text-white shadow-sm">
            <UserPlus size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Daftar Akun</h1>
            <p className="text-sm text-slate-500">Email kamu akan diverifikasi via OTP.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSendOTP}>
          {[
            { key: "full_name", label: "Nama Lengkap",   type: "text",     placeholder: "Nama kamu" },
            { key: "username",  label: "Username",        type: "text",     placeholder: "username_unik" },
            { key: "email",     label: "Email Asli",      type: "email",    placeholder: "kamu@email.com" },
            { key: "password",  label: "Password",        type: "password", placeholder: "Min. 6 karakter" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                required minLength={key === "password" ? 6 : 1}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200" />
            </div>
          ))}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            {loading ? "Mengirim OTP..." : "Kirim Kode Verifikasi →"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-violet-600 hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
