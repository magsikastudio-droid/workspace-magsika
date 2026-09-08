import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, AlertTriangle, Sparkles, Megaphone, ArrowUpRight } from "lucide-react";

const fmtTime = (s) => {
  if (!s || s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
};

export default function TalentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/me/dashboard")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-sm text-slate-400">Memuat dashboard...</div>;
  }
  if (!data) {
    return <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-sm text-slate-400">Gagal memuat data.</div>;
  }

  const { week, today, week_summary, approval, announcements } = data;
  const maxTime = Math.max(...week.map((d) => d.time_seconds), 1);
  const totalApproval = approval.direct + approval.revised;
  const directPct = totalApproval ? Math.round((approval.direct / totalApproval) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Halo, {(user?.full_name || "").split(" ")[0]} 👋</h1>
        <p className="mt-0.5 text-sm text-slate-500">Ringkasan performa kamu minggu ini.</p>
      </div>

      {/* Today summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Hari Ini: Pending" value={today.pending + today.in_progress} icon={Clock3} iconBg="bg-sky-50 text-sky-600" onClick={() => navigate("/todo")} />
        <MetricCard label="Hari Ini: Review" value={today.review} icon={Sparkles} iconBg="bg-orange-50 text-orange-600" onClick={() => navigate("/todo")} />
        <MetricCard label="Hari Ini: Selesai" value={today.done} icon={CheckCircle2} iconBg="bg-emerald-50 text-emerald-600" onClick={() => navigate("/todo")} />
        <MetricCard label="Gagal Minggu Ini" value={week_summary.late} icon={AlertTriangle} iconBg="bg-rose-50 text-rose-600" onClick={() => navigate("/todo")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Jam kerja mingguan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">Jam Kerja 7 Hari Terakhir</p>
          <p className="text-xs text-slate-400 mb-5">Total waktu tercatat per hari</p>
          <div className="flex items-end justify-between gap-2 h-36">
            {week.map((d) => {
              const heightPct = Math.max((d.time_seconds / maxTime) * 100, d.time_seconds > 0 ? 6 : 2);
              const isToday = d.date === week[week.length - 1].date;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      title={fmtTime(d.time_seconds)}
                      className={`w-full max-w-[28px] rounded-t-lg transition-all ${isToday ? "bg-violet-500" : "bg-violet-200"}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500">{d.label}</p>
                  <p className="text-[9px] text-slate-400">{fmtTime(d.time_seconds)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval history */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">Riwayat Approval</p>
          <p className="text-xs text-slate-400 mb-4">Task selesai bulan ini</p>
          {totalApproval === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Belum ada task selesai bulan ini.</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" stroke="#10b981" strokeWidth="4"
                      strokeDasharray={`${directPct} ${100 - directPct}`} strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">{directPct}%</div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Langsung approve: <b>{approval.direct}</b></div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-200" /> Kena revisi: <b>{approval.revised}</b></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Announcements */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-violet-500" />
            <p className="font-semibold text-slate-900">Pengumuman Terbaru</p>
          </div>
          <button onClick={() => navigate("/pengumuman")} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
            Lihat semua <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {announcements.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada pengumuman.</p>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{a.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, iconBg, onClick }) {
  return (
    <div onClick={onClick} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
