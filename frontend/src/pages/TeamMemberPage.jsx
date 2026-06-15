import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft, Bot, CheckCircle2, ChevronLeft, ChevronRight,
  Loader2, Pencil, Search, Sparkles, Trash2,
} from "lucide-react";
import { normalizeStatus } from "../lib/constants";
import { monthLabel } from "../lib/format";
import { toast } from "sonner";

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const fmtTime = (s) => {
  if (!s || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}d`;
};

const avatarColors = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];
const getColor = (name) => {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length];
};

const renderBold = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-slate-900">{part}</strong>
      : part
  );
};

const renderInsight = (text) =>
  text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      return (
        <div key={i} className="flex items-center gap-2 pt-4 pb-1 first:pt-0">
          <div className="h-3 w-1 rounded-full bg-violet-500 shrink-0" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
            {trimmed.slice(2, -2)}
          </p>
        </div>
      );
    }
    if (trimmed === "") return <div key={i} className="h-1" />;
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      return (
        <div key={i} className="flex items-start gap-2 pl-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
          <p className="text-sm text-slate-600 leading-relaxed">{renderBold(trimmed.slice(2))}</p>
        </div>
      );
    }
    return <p key={i} className="text-sm text-slate-700 leading-relaxed">{renderBold(line)}</p>;
  });

export default function TeamMemberPage() {
  const { artistName: encodedName } = useParams();
  const artistName = decodeURIComponent(encodedName || "");
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { user } = useAuth();
  const isAdminOrPM = user?.role === "admin" || user?.role === "pm";
  const isAdmin = user?.role === "admin";

  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const monthStr = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;

  const [summary, setSummary] = useState({ artists: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [searchQ, setSearchQ] = useState("");

  // AI report state
  const [aiPeriod, setAiPeriod] = useState("daily");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/tasks/summary", { params: { month: monthStr } })
      .then((r) => setSummary(r.data || { artists: [], orders: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monthStr]);

  useEffect(() => {
    const fetchHistory = async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selYear, selMonth - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const results = await Promise.all(
        months.map((m) =>
          api.get("/tasks/summary", { params: { month: m } })
            .then((r) => ({ month: m, data: r.data }))
            .catch(() => ({ month: m, data: null }))
        )
      );
      setHistoryData(results.map(({ month, data }) => {
        const artist = data?.artists?.find((a) => a.name === artistName);
        const myOrdCount = (data?.orders || []).filter((os) => (os.assignees || []).includes(artistName)).length;
        return {
          month,
          label: monthLabel(month)?.slice(0, 3) || month,
          tasks: artist?.tasks || 0,
          done: artist?.done || 0,
          time: artist?.time || 0,
          orders: myOrdCount,
        };
      }));
    };
    fetchHistory();
  }, [selYear, selMonth, artistName]);

  // Load saved AI report whenever period or month changes
  useEffect(() => {
    if (!isAdminOrPM) return;
    setReport(null);
    setIsEditing(false);
    setReportLoading(true);
    api.get("/ai/reports/member", { params: { name: artistName, period: aiPeriod, month: monthStr } })
      .then((r) => setReport(r.data.report))
      .catch(() => {})
      .finally(() => setReportLoading(false));
  }, [artistName, aiPeriod, monthStr, isAdminOrPM]);

  const prevMonth = () => {
    if (selMonth === 0) { setSelYear((y) => y - 1); setSelMonth(11); }
    else setSelMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 11) { setSelYear((y) => y + 1); setSelMonth(0); }
    else setSelMonth((m) => m + 1);
  };

  const stats = useMemo(() =>
    summary.artists.find((a) => a.name === artistName) || { tasks: 0, done: 0, failed: 0, in_progress: 0, time: 0 },
    [summary.artists, artistName]
  );

  const orderById = useMemo(() => {
    const m = {};
    orders.forEach((o) => { m[o.id] = o; });
    return m;
  }, [orders]);

  const artistOrders = useMemo(() =>
    summary.orders
      .filter((os) => (os.assignees || []).includes(artistName))
      .map((os) => ({ ...os, order: orderById[os.order_id] || null }))
      .filter((os) => os.order)
      .sort((a, b) => b.time - a.time),
    [summary.orders, artistName, orderById]
  );

  const filteredOrders = useMemo(() => {
    if (!searchQ.trim()) return artistOrders;
    const q = searchQ.toLowerCase();
    return artistOrders.filter((os) =>
      os.order?.project?.toLowerCase().includes(q) ||
      os.order?.client?.toLowerCase().includes(q)
    );
  }, [artistOrders, searchQ]);

  const doneRate = stats.tasks > 0 ? Math.round((stats.done / stats.tasks) * 100) : 0;
  const avgTimePerOrder = artistOrders.length > 0 ? Math.round(stats.time / artistOrders.length) : 0;
  const color = getColor(artistName);
  const maxDone = Math.max(...historyData.map((h) => h.done), 1);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await api.post("/ai/reports/member/generate", null, {
        params: { name: artistName, period: aiPeriod, month: monthStr },
      });
      setReport(res.data.report);
      toast.success("Laporan AI berhasil dibuat.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat laporan AI.");
    } finally {
      setGenerating(false);
    }
  }, [artistName, aiPeriod, monthStr]);

  const startEdit = () => {
    setEditContent(report?.content || "");
    setIsEditing(true);
  };

  const saveEdit = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`/ai/reports/${report.id}`, { content: editContent });
      setReport(res.data.report);
      setIsEditing(false);
      toast.success("Laporan berhasil diperbarui.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }, [report, editContent]);

  const deleteReport = useCallback(async () => {
    if (!window.confirm("Hapus laporan ini?")) return;
    try {
      await api.delete(`/ai/reports/${report.id}`);
      setReport(null);
      setIsEditing(false);
      toast.success("Laporan dihapus.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menghapus.");
    }
  }, [report]);

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate("/performance")}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
      >
        <ArrowLeft size={14} /> Kembali ke Performance
      </button>

      {/* Header */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shrink-0 shadow-sm"
              style={{ background: color }}
            >
              {artistName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{artistName}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Profil performa — {MONTH_NAMES[selMonth]} {selYear}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2">
            <button onClick={prevMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 min-w-[150px] justify-center">
              <select
                value={selYear}
                onChange={(e) => setSelYear(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
              >
                {[selYear - 1, selYear, selYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={selMonth}
                onChange={(e) => setSelMonth(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <button onClick={nextMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2-column: left=stats+data, right=AI */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ── Left column ── */}
        <div className="lg:col-span-3 space-y-5">
          {/* Stat cards */}
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
              Memuat data...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-emerald-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Task Done</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.done}</p>
                <p className="mt-1 text-xs text-slate-400">dari {stats.tasks} total</p>
              </div>
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-violet-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Done Rate</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{doneRate}%</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${doneRate}%`, background: color }} />
                </div>
              </div>
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-sky-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Waktu Kerja</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{fmtTime(stats.time) === "—" ? "0" : fmtTime(stats.time)}</p>
                <p className="mt-1 text-xs text-slate-400">akumulasi timer</p>
              </div>
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-amber-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Project</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{artistOrders.length}</p>
                <p className="mt-1 text-xs text-slate-400">
                  avg {fmtTime(avgTimePerOrder) === "—" ? "—" : fmtTime(avgTimePerOrder)}/project
                </p>
              </div>
            </div>
          )}

          {/* 6-month chart */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="font-bold text-slate-900">Aktivitas 6 Bulan Terakhir</p>
              <p className="text-xs text-slate-400">Task diselesaikan per bulan</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-end gap-2 h-32">
                {historyData.map((h) => {
                  const pct = Math.round((h.done / maxDone) * 100);
                  const isCurrent = h.month === monthStr;
                  return (
                    <div key={h.month} className="flex flex-1 flex-col items-center gap-1 group">
                      {h.done > 0 && (
                        <span className="text-[9px] text-slate-400 font-semibold hidden group-hover:block">{h.done} task</span>
                      )}
                      <div
                        className="w-full rounded-t-xl transition-all"
                        style={{
                          height: `${Math.max(pct, 4)}%`,
                          minHeight: "6px",
                          background: isCurrent
                            ? `linear-gradient(to top, ${color}cc, ${color})`
                            : "linear-gradient(to top, #cbd5e1, #e2e8f0)",
                        }}
                      />
                      <span className={`text-[10px] font-semibold ${isCurrent ? "text-violet-700" : "text-slate-400"}`}>
                        {h.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Project list */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <p className="font-bold text-slate-900">Project Dikerjakan</p>
                <p className="text-xs text-slate-400">{MONTH_NAMES[selMonth]} {selYear} · {artistOrders.length} project</p>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Cari project..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-violet-400 w-44"
                />
              </div>
            </div>
            {artistOrders.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">Belum ada project di {MONTH_NAMES[selMonth]} {selYear}.</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Tidak ditemukan.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredOrders.map((os) => {
                  const o = os.order;
                  const myDone = os.done_by_assignee?.[artistName] ?? os.done;
                  const myTasks = os.tasks_by_assignee?.[artistName] ?? os.tasks;
                  const rate = myTasks > 0 ? Math.round((myDone / myTasks) * 100) : 0;
                  return (
                    <div key={os.order_id} className="flex items-start gap-4 px-6 py-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ background: color }}
                      >
                        {o.project?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{o.project}</p>
                            <p className="text-xs text-indigo-500 font-mono">{o.folder_code || o.client}</p>
                          </div>
                          {os.time > 0 && (
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-slate-700 font-mono">{fmtTime(os.time)}</p>
                              <p className="text-xs text-slate-400">waktu kerja</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {myTasks > 0 && <span className="text-xs rounded-lg bg-slate-100 px-2 py-0.5 text-slate-500">{myTasks} task</span>}
                          {myDone > 0 && <span className="text-xs rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">✓ {myDone} done</span>}
                          {normalizeStatus(o.status) === "Done" && (
                            <span className="text-xs rounded-lg bg-emerald-100 px-2 py-0.5 text-emerald-800 font-semibold">Project Selesai</span>
                          )}
                        </div>
                        {myTasks > 0 && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${rate}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: AI Report (sticky) ── */}
        {isAdminOrPM && (
          <div className="lg:col-span-2 lg:sticky lg:top-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Gradient header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Laporan Analisis AI</p>
                    <p className="text-[11px] text-violet-200">{artistName} — Claude AI</p>
                  </div>
                </div>
                {/* Period selector */}
                <div className="flex items-center gap-1 w-fit rounded-xl border border-white/20 bg-white/10 p-1">
                  {[
                    { value: "daily", label: "Harian" },
                    { value: "weekly", label: "Mingguan" },
                    { value: "monthly", label: "Bulanan" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setAiPeriod(value); setIsEditing(false); }}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        aiPeriod === value ? "bg-white text-violet-700 shadow-sm" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report body */}
              <div className="px-5 py-4">
                {reportLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin text-violet-400" />
                    Memuat laporan...
                  </div>
                ) : report ? (
                  <>
                    {/* Meta + admin actions */}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400">
                          {report.is_auto ? "Auto-generated (sistem)" : `Dibuat oleh ${report.generated_by}`}
                        </p>
                        <p className="text-[10px] text-slate-400">{report.date_key}</p>
                      </div>
                      {isAdmin && !isEditing && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={startEdit}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            onClick={deleteReport}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition"
                          >
                            <Trash2 size={11} /> Hapus
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={16}
                          className="w-full rounded-xl border border-violet-200 bg-violet-50/30 p-3 text-sm text-slate-700 outline-none focus:border-violet-400 resize-none leading-relaxed"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                          >
                            Batal
                          </button>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition"
                          >
                            {saving && <Loader2 size={12} className="animate-spin" />}
                            Simpan
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1">
                        {renderInsight(report.content)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10">
                    <Sparkles size={28} className="mx-auto mb-3 text-violet-200" />
                    {isAdmin ? (
                      <>
                        <p className="text-sm font-medium text-slate-500 mb-1">Belum ada laporan</p>
                        <p className="text-xs text-slate-400 mb-4">
                          {aiPeriod === "daily"
                            ? "Laporan harian dibuat otomatis jam 17.00 WIB, atau buat sekarang."
                            : "Klik tombol di bawah untuk membuat laporan."}
                        </p>
                        <button
                          onClick={generateReport}
                          disabled={generating}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition"
                        >
                          {generating
                            ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                            : <><Sparkles size={14} /> Generate Laporan</>
                          }
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-500">Belum ada laporan</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {aiPeriod === "daily"
                            ? "Laporan harian akan tersedia otomatis setiap jam 17.00 WIB."
                            : "Laporan akan dibuat oleh admin."}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
