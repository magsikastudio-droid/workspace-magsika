import React from "react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Atur preferensi dasar dan koneksi API Anda.</p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Pengaturan Awal</h2>
        <p className="mt-2 text-sm text-slate-500">Pada versi awal ini, pengaturan bersifat mock. Nanti dapat ditambahkan koneksi MongoDB Atlas dan autentikasi lanjutan.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold">Backend URL</p>
            <p className="mt-2 text-sm text-slate-500">Atur `VITE_BACKEND_URL` dalam file `.env` frontend untuk API.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold">Mock akun</p>
            <p className="mt-2 text-sm text-slate-500">Gunakan username <span className="font-semibold">admin</span> dan password <span className="font-semibold">password</span>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
