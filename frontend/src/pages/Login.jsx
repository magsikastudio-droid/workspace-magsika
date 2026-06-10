import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ username, password });
      const role = result.user?.role;
      navigate(role === "talent" ? "/todo" : "/dashboard", { replace: true });
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

  return (
    <div
      className="relative flex overflow-hidden"
      style={{ minHeight: "100dvh", background: "#0f0f0f" }}
    >
      {/* Background glow accents */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }} />

      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <img
            src="/magsika-apps-01.png"
            alt="Magsika Workspace"
            className="h-20 w-20 rounded-2xl object-cover"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)" }}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">Magsika Workspace</h1>
            <p className="mt-1 text-sm text-slate-400">Masuk untuk melanjutkan</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Username</label>
              <input
                autoComplete="username"
                className="w-full rounded-xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm text-rose-300"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: loading ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: loading ? "none" : "0 4px 24px rgba(124,58,237,0.35)",
              }}
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Belum punya akun?{" "}
            <Link to="/register" className="font-semibold text-violet-400 hover:text-violet-300 transition">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
