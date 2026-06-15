import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft, Bot, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, FolderOpen, Loader2, Search, Sparkles,
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

export default function TeamMemberPage() {
  const { artistName: encodedName } = useParams();
  const artistName = decodeURIComponent(encodedName || "");
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { user } = useAuth();
  const isAdminOrPM = user?.role === "admin" || user?.role === "pm";

  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const monthStr = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;

  const [summary, setSummary] = useState({ artists: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [searchQ, setSearchQ] = useState("");

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

  const loadInsight = useCallback(async () => {
    setAiLoading(true);
    setAiInsight(null);
    setAiError(null);
    try {
      const res = await api.get("/ai/insight/member", { params: { name: artistName, month: monthStr } });
      setAiInsight(res.data.insight);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Gagal memuat insight AI";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }, [artistName, monthStr]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
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

          {/* Month picker */}
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

      {/* Stat cards */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
          Memuat data...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* 6-month history chart */}
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

      {/* AI Insight */}
      {isAdminOrPM && (
        <div className="rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-50 px-6 py-4">
            <div>
              <p className="font-bold text-slate-900 flex items-center gap-2">
                <Bot size={16} className="text-violet-500" /> AI Insight
              </p>
              <p className="text-xs text-slate-400">Analisis performa {artistName} oleh Claude AI — {MONTH_NAMES[selMonth]} {selYear}</p>
            </div>
            <button
              onClick={loadInsight}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {aiLoading
                ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                : <><Sparkles size={14} /> {aiInsight ? "Refresh Insight" : "Generate Insight"}</>
              }
            </button>
          </div>

          {aiLoading && (
            <div className="flex items-center gap-3 px-6 py-8 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin text-violet-400" />
              Claude AI sedang menganalisis data performa...
            </div>
          )}

          {aiInsight && !aiLoading && (
            <div className="px-6 py-5">
              <div className="rounded-2xl bg-violet-50 border border-violet-100 px-5 py-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
              </div>
            </div>
          )}

          {!aiInsight && !aiLoading && !aiError && (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              <Sparkles size={24} className="mx-auto mb-2 text-violet-200" />
              Klik "Generate Insight" untuk mendapatkan analisis AI tentang performa {artistName} bulan ini.
            </div>
          )}

          {aiError && !aiLoading && (
            <div className="px-6 py-5 text-center text-sm text-rose-500">{aiError}</div>
          )}
        </div>
      )}
    </div>
  );
}
