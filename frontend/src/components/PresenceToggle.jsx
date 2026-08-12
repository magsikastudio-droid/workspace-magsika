import React, { useState } from "react";
import { Coffee, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

/* Toggle Online <-> Istirahat. Pas "Istirahat": reminder "belum mulai kerja"
   dan alarm overdue dibisukan buat orang ini — dipakai kalau lagi
   break/meeting/sholat/dll biar tidak di-nag padahal memang lagi tidak kerja.
   Klik lagi buat balik "Online" — notifikasi jalan normal lagi. */
export default function PresenceToggle() {
  const { user, patchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const onBreak = user?.work_status === "break";

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post("/presence/toggle");
      const next = res.data?.work_status || "online";
      patchUser({ work_status: next });
      toast[next === "break" ? "info" : "success"](
        next === "break" ? "☕ Istirahat — notifikasi dibisukan" : "⚡ Online — notifikasi aktif lagi"
      );
    } catch {
      toast.error("Gagal ubah status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
        onBreak
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25"
          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400"
      }`}
    >
      {loading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : onBreak ? (
        <Coffee size={14} className="shrink-0" />
      ) : (
        <Zap size={14} className="shrink-0" />
      )}
      <span className="truncate">{onBreak ? "Istirahat" : "Online"}</span>
      <span className={`ml-auto text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 ${
        onBreak ? "bg-amber-500/20" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      }`}>
        {onBreak ? "Notif OFF" : "Notif ON"}
      </span>
    </button>
  );
}
