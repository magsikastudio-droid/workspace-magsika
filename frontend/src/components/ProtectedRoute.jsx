import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, TOKEN_KEY } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-3xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800 mx-auto"></div>
          <p className="text-sm text-slate-600">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  // No token at all → redirect to login
  if (!localStorage.getItem(TOKEN_KEY)) {
    return <Navigate to="/login" replace />;
  }

  // Token exists but server temporarily unreachable — don't log out, show retry
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-3xl bg-white p-8 shadow-lg text-center max-w-sm">
          <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-amber-50">
            <svg className="h-7 w-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="mb-2 font-bold text-slate-800">Server tidak dapat dijangkau</h2>
          <p className="text-sm text-slate-500 mb-5">Koneksi ke server sementara gagal. Sesi kamu tetap tersimpan.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-bold text-white hover:bg-violet-700 transition"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
