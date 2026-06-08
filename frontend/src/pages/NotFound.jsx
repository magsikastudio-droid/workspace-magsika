import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div className="max-w-xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-lg">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="mt-4 text-sm text-slate-500">Sepertinya URL yang Anda tuju tidak tersedia.</p>
        <Link className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800" to="/dashboard">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
