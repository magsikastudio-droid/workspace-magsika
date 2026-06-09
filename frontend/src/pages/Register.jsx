import React, { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { api } from "../lib/api";

export default function Register() {
  const [form, setForm] = useState({ username: "", full_name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Pendaftaran gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
              <UserPlus size={28} />
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-sm text-slate-500 mb-6">
            Akunmu sedang menunggu persetujuan admin. Kamu akan bisa login setelah disetujui.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-600 text-white shadow-sm">
            <UserPlus size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Daftar Akun</h1>
            <p className="text-sm text-slate-500">Menunggu persetujuan admin untuk masuk.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {[
            { key: "full_name", label: "Nama Lengkap", type: "text", placeholder: "Nama kamu" },
            { key: "username", label: "Username", type: "text", placeholder: "username_unik" },
            { key: "email", label: "Email", type: "email", placeholder: "kamu@email.com" },
            { key: "password", label: "Password", type: "password", placeholder: "Min. 6 karakter" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                required
                minLength={key === "password" ? 6 : 1}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>
          ))}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-3xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Mendaftarkan..." : "Daftar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-violet-600 hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
