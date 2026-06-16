import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  Activity, Bot, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Users, FolderOpen, Loader2, Pencil, Timer,
  Search, Sparkles, Trash2, X,
} from "lucide-react";
import { normalizeStatus } from "../lib/constants";
import { monthKey, monthLabel } from "../lib/format";
import { toast } from "sonner";

/* ─── helpers ─────────────────────────────────────────────────────── */
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

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
    return (
      <p key={i} className="text-sm text-slate-700 leading-relaxed">
        {renderBold(line)}
      </p>
    );
  });

const fmtDateKey = (key, period) => {
  if (!key) return "";
  if (period === "daily") {
    const [y, m, d] = key.split("-");
    return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }
  if (period === "monthly") {
    const [y, m] = key.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }
  return key;
};

const cleanReportContent = (text) =>
  text
    .replace(/^#\s*.+\n?/gm, "")
    .replace(/^\*\*(LAPORAN|ANGGOTA TIM|PERIODE)[^*]*\*\*\n?/gim, "")
    .replace(/^---+\n?/gm, "")
    .replace(/^\n{2,}/gm, "\n")
    .trim();

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

/* ─── root ─────────────────────────────────────────────────────────── */
export default function Performance() {
  const { user } = useAuth();
  const role = user?.role || "talent";
  const isAdminOrPM = role === "admin" || role === "pm";

  if (isAdminOrPM) return <AdminPerformance />;
  return <TalentPerformance user={user} />;
}

/* ══════════════════════════════════════════════════════════════════
   TALENT VIEW
══════════════════════════════════════════════════════════════════ */
function TalentPerformance({ user }) {
  const { orders } = useOrders();
  const myName = user?.full_name || user?.name || "";

  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const monthStr = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;

  const [summary, setSummary] = useState({ artists: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [myNotifCount, setMyNotifCount] = useState(0);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [aiPeriod, setAiPeriod] = useState("daily");
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [myHistory, setMyHistory] = useState([]);
  const [showMyHistory, setShowMyHistory] = useState(false);
  const [expandedMyHistId, setExpandedMyHistId] = useState(null);

  useEffect(() => {
    api.get("/users/me").then((r) => setProfile(r.data?.user || null)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/my-notifications/unread-count").then((r) => setMyNotifCount(r.data?.count ?? 0)).catch(() => {});
  }, []);

  const dismissNotif = async () => {
    setNotifDismissed(true);
    setMyNotifCount(0);
    try { await api.patch("/my-notifications/read-all"); } catch {}
  };

  useEffect(() => {
    setAiReport(null);
    setAiLoading(true);
    api.get("/ai/reports/member", { params: { name: myName, period: aiPeriod, month: monthStr } })
      .then((r) => setAiReport(r.data?.report || null))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [myName, aiPeriod, monthStr]);

  useEffect(() => {
    if (!myName) return;
    api.get("/ai/reports/history", { params: { type: "member", target: myName, period: aiPeriod } })
      .then((r) => setMyHistory(r.data?.reports || []))
      .catch(() => {});
  }, [myName, aiPeriod]);

  useEffect(() => {
    setLoading(true);
    api.get("/tasks/summary", { params: { month: monthStr } })
      .then((r) => setSummary(r.data || { artists: [], orders: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monthStr]);

  const prevMonth = () => {
    if (selMonth === 0) { setSelYear((y) => y - 1); setSelMonth(11); }
    else setSelMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 11) { setSelYear((y) => y + 1); setSelMonth(0); }
    else setSelMonth((m) => m + 1);
  };

  const myStats = useMemo(() =>
    summary.artists.find((a) => a.name === myName) || { tasks: 0, done: 0, failed: 0, in_progress: 0, time: 0 },
    [summary.artists, myName]
  );

  const orderById = useMemo(() => {
    const m = {};
    orders.forEach((o) => { m[o.id] = o; });
    return m;
  }, [orders]);

  const myOrders = useMemo(() =>
    summary.orders
      .filter((os) => (os.assignees || []).includes(myName))
      .map((os) => ({ ...os, order: orderById[os.order_id] || null }))
      .filter((os) => os.order)
      .sort((a, b) => b.time - a.time),
    [summary.orders, myName, orderById]
  );

  const doneRate = myStats.tasks > 0 ? Math.round((myStats.done / myStats.tasks) * 100) : 0;
  const color = getColor(myName);

  const [historyData, setHistoryData] = useState([]);
  useEffect(() => {
    const fetchAll = async () => {
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const lastDay = new Date(selYear, selMonth + 1, 0);
      const today = new Date();
      const refDate = lastDay > today ? today : lastDay;
      const dow = refDate.getDay();
      const anchor = new Date(refDate);
      if (dow !== 0) anchor.setDate(anchor.getDate() + (7 - dow));
      const weeks = [];
      for (let i = 5; i >= 0; i--) {
        const sun = new Date(anchor); sun.setDate(sun.getDate() - i * 7);
        const mon = new Date(sun); mon.setDate(mon.getDate() - 6);
        weeks.push({ fromDate: fmt(mon), toDate: fmt(sun), label: `${mon.getDate()}/${mon.getMonth() + 1}` });
      }
      const results = await Promise.all(
        weeks.map(({ fromDate, toDate }) =>
          api.get("/tasks/summary", { params: { from_date: fromDate, to_date: toDate } })
            .then((r) => ({ data: r.data }))
            .catch(() => ({ data: null }))
        )
      );
      setHistoryData(results.map(({ data }, idx) => {
        const artist = data?.artists?.find((a) => a.name === myName);
        return {
          label: weeks[idx].label,
          tasks: artist?.tasks || 0,
          done: artist?.done || 0,
          time: artist?.time || 0,
        };
      }));
    };
    fetchAll();
  }, [selYear, selMonth, myName]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxTasks = Math.max(...historyData.map((h) => h.done), 1);
  const displayName = profile?.full_name || myName || "Saya";
  const position = profile?.position || "";

  const AiPanel = () => (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Laporan AI Performa</p>
              <p className="text-[11px] text-white/70">hanya bisa dilihat</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 p-1">
            {[{ value: "daily", label: "Harian" }, { value: "weekly", label: "Mingguan" }, { value: "monthly", label: "Bulanan" }].map(({ value, label }) => (
              <button key={value} onClick={() => { setAiPeriod(value); setExpandedMyHistId(null); }}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${aiPeriod === value ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:bg-white/10"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {aiReport && (
          <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/90">
            {fmtDateKey(aiReport.date_key, aiReport.period)}
          </p>
        )}
      </div>
      <div className="bg-white px-5 py-4 max-h-[70vh] overflow-y-auto">
        {aiLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Memuat laporan...
          </div>
        ) : aiReport ? (
          <div className="space-y-1 text-sm">
            {renderInsight(cleanReportContent(aiReport.content))}
            <p className="pt-3 text-[10px] text-slate-400">
              Dibuat: {new Date(aiReport.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Bot size={28} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">Belum ada laporan untuk periode ini.</p>
            <p className="text-xs text-slate-400">Laporan dibuat otomatis jam 17.00 WIB, atau oleh admin.</p>
          </div>
        )}
      </div>
      {/* Riwayat laporan pribadi */}
      {myHistory.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowMyHistory((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2"><Activity size={13} /> Riwayat ({myHistory.length})</span>
            <ChevronRight size={13} className={`transition-transform ${showMyHistory ? "rotate-90" : ""}`} />
          </button>
          {showMyHistory && (
            <div className="px-5 pb-4 space-y-2">
              {myHistory.map((r) => (
                <div key={r.id} className={`rounded-xl border text-xs transition ${r.id === aiReport?.id ? "border-violet-200 bg-violet-50/40" : "border-slate-100 bg-slate-50"}`}>
                  <button className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" onClick={() => setExpandedMyHistId(expandedMyHistId === r.id ? null : r.id)}>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800">{fmtDateKey(r.date_key, r.period)}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${r.is_auto ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>{r.is_auto ? "Auto" : "Admin"}</span>
                        {r.id === aiReport?.id && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Terbaru</span>}
                      </div>
                      <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                    <ChevronRight size={12} className={`shrink-0 text-slate-400 transition-transform ${expandedMyHistId === r.id ? "rotate-90" : ""}`} />
                  </button>
                  {expandedMyHistId === r.id && (
                    <div className="border-t border-slate-100 px-3 py-3 space-y-0.5">
                      {renderInsight(cleanReportContent(r.content))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Notification banner */}
      {myNotifCount > 0 && !notifDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
              {myNotifCount > 9 ? "9+" : myNotifCount}
            </span>
            <p className="text-sm font-semibold text-indigo-800">
              Kamu memiliki {myNotifCount} laporan performa baru dari admin.
            </p>
          </div>
          <button onClick={dismissNotif} className="shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
            Tandai Dibaca
          </button>
        </div>
      )}

      {/* Header — profil kartu */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shrink-0 shadow-sm" style={{ background: color }}>
              {displayName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
              {position && <p className="text-sm text-violet-600 font-medium">{position}</p>}
              <p className="text-xs text-slate-400 mt-0.5">Performa bulan — {MONTH_NAMES[selMonth]} {selYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2">
            <button onClick={prevMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-2 min-w-[150px] justify-center">
              <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
                {[selYear - 1, selYear, selYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <button onClick={nextMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* 2-column: left = data, right = AI panel sticky */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* LEFT */}
        <div className="lg:col-span-3 space-y-5">
          {/* Stats */}
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">Memuat data...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-emerald-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Task Done</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{myStats.done}</p>
                <p className="mt-1 text-xs text-slate-400">dari {myStats.tasks} total</p>
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
                <p className="mt-2 text-3xl font-bold text-slate-900">{fmtTime(myStats.time) === "—" ? "0" : fmtTime(myStats.time)}</p>
                <p className="mt-1 text-xs text-slate-400">akumulasi timer</p>
              </div>
              <div className="rounded-2xl border-l-4 border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-amber-500">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Project</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{myOrders.length}</p>
                <p className="mt-1 text-xs text-slate-400">dikerjakan bulan ini</p>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="font-bold text-slate-900">Aktivitas 6 Minggu Terakhir</p>
              <p className="text-xs text-slate-400">Task diselesaikan per minggu</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-end gap-2" style={{ height: "112px" }}>
                {historyData.map((h, idx) => {
                  const barH = Math.max(Math.round((h.done / maxTasks) * 88), 6);
                  const isCurrent = idx === historyData.length - 1;
                  return (
                    <div key={h.label} className="flex flex-1 flex-col items-center gap-1 group">
                      <div className="flex-1" />
                      {h.done > 0 && <span className="text-[9px] text-slate-400 font-semibold hidden group-hover:block">{h.done} task</span>}
                      <div className="w-full rounded-t-xl transition-all" style={{ height: `${barH}px`, background: isCurrent ? `linear-gradient(to top, ${color}cc, ${color})` : "linear-gradient(to top, #cbd5e1, #e2e8f0)" }} />
                      <span className={`text-[10px] font-semibold ${isCurrent ? "text-violet-700" : "text-slate-400"}`}>{h.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Project list */}
          {myOrders.length > 0 && (
            <TalentProjectList myOrders={myOrders} myName={myName} color={color} selMonth={selMonth} selYear={selYear} />
          )}
          {myOrders.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-400">Belum ada project di {MONTH_NAMES[selMonth]} {selYear}.</p>
            </div>
          )}
        </div>

        {/* RIGHT — AI Panel sticky */}
        <div className="lg:col-span-2 lg:sticky lg:top-4">
          <AiPanel />
        </div>
      </div>
    </div>
  );
}

/* ─── TalentProjectList (dengan search) ─────────────────────────── */
function TalentProjectList({ myOrders, myName, color, selMonth, selYear }) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? myOrders.filter((os) => os.order?.project?.toLowerCase().includes(q.toLowerCase()) || os.order?.client?.toLowerCase().includes(q.toLowerCase()))
    : myOrders;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="font-bold text-slate-900">Project yang Dikerjakan</p>
          <p className="text-xs text-slate-400">{MONTH_NAMES[selMonth]} {selYear}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari project..." className="rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-violet-400 w-44" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Tidak ditemukan.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {filtered.map((os) => {
            const o = os.order;
            const myDone = os.done_by_assignee?.[myName] ?? os.done;
            const myTasks = os.tasks_by_assignee?.[myName] ?? os.tasks;
            const rate = myTasks > 0 ? Math.round((myDone / myTasks) * 100) : 0;
            return (
              <div key={os.order_id} className="flex items-start gap-4 px-6 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: color }}>
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
                    {os.tasks > 0 && <span className="text-xs rounded-lg bg-slate-100 px-2 py-0.5 text-slate-500">{os.tasks} task</span>}
                    {os.done > 0 && <span className="text-xs rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">✓ {os.done} done</span>}
                    {normalizeStatus(o.status) === "Done" && <span className="text-xs rounded-lg bg-emerald-100 px-2 py-0.5 text-emerald-800 font-semibold">Project Selesai</span>}
                  </div>
                  {os.tasks > 0 && (
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
  );
}

/* ══════════════════════════════════════════════════════════════════
   ARTIST DETAIL PANEL (admin klik nama talent)
══════════════════════════════════════════════════════════════════ */
function ArtistDetailPanel({ artistName, summary, orderById, monthStr, selMonth, selYear, onClose }) {
  const color = getColor(artistName);
  const stats = summary.artists.find((a) => a.name === artistName) || { tasks: 0, done: 0, failed: 0, in_progress: 0, time: 0 };
  const artistOrders = useMemo(() =>
    summary.orders
      .filter((os) => (os.assignees || []).includes(artistName))
      .map((os) => ({ ...os, order: orderById[os.order_id] || null }))
      .filter((os) => os.order)
      .sort((a, b) => b.time - a.time),
    [summary.orders, artistName, orderById]
  );
  const doneRate = stats.tasks > 0 ? Math.round((stats.done / stats.tasks) * 100) : 0;
  const avgTimePerOrder = artistOrders.length > 0 ? Math.round(stats.time / artistOrders.length) : 0;

  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ background: color }}>
            {artistName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">{artistName}</p>
            <p className="text-xs text-slate-400">{MONTH_NAMES[selMonth]} {selYear}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.done}</p>
            <p className="text-xs text-slate-400 mt-0.5">Task Done</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
            <p className="text-2xl font-bold" style={{ color }}>{doneRate}%</p>
            <p className="text-xs text-slate-400 mt-0.5">Done Rate</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{fmtTime(stats.time) === "—" ? "0" : fmtTime(stats.time)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total Waktu</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
            <p className="text-2xl font-bold text-sky-700">{fmtTime(avgTimePerOrder) === "—" ? "0" : fmtTime(avgTimePerOrder)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Avg/Project</p>
          </div>
        </div>

        {/* Progress bar done rate */}
        <div className="px-4 pb-3 shrink-0">
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${doneRate}%`, background: color }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{stats.tasks} task total · {stats.in_progress} sedang jalan · {stats.failed} gagal</p>
        </div>

        {/* Order list — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 border-t border-slate-100">
          <div className="px-4 pt-3 pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Project Dikerjakan ({artistOrders.length})</p>
            <ArtistOrderSearch artistOrders={artistOrders} artistName={artistName} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtistOrderSearch({ artistOrders, artistName }) {
  const [q, setQ] = useState("");
  const color = getColor(artistName);
  const filtered = q.trim()
    ? artistOrders.filter((os) =>
        os.order?.project?.toLowerCase().includes(q.toLowerCase()) ||
        os.order?.client?.toLowerCase().includes(q.toLowerCase())
      )
    : artistOrders;
  return (
    <div>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari project..."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-violet-400"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-4 text-xs text-slate-400 text-center">Tidak ditemukan.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((os) => {
            const o = os.order;
            const myDone = os.done_by_assignee?.[artistName] ?? os.done;
            const myTasks = os.tasks_by_assignee?.[artistName] ?? os.tasks;
            const rate = myTasks > 0 ? Math.round((myDone / myTasks) * 100) : 0;
            return (
              <div key={os.order_id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: color }}>
                  {o.project?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">{o.project}</p>
                    {os.time > 0 && <p className="text-[10px] font-mono font-bold text-slate-600 shrink-0">{fmtTime(os.time)}</p>}
                  </div>
                  <p className="text-[10px] text-indigo-500 font-mono">{o.folder_code || o.client}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-400">{myTasks} task</span>
                    {myDone > 0 && <span className="text-[10px] text-emerald-600 font-semibold">· ✓ {myDone}</span>}
                  </div>
                  {myTasks > 0 && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
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
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN / PM VIEW
══════════════════════════════════════════════════════════════════ */
function AdminPerformance() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const [selYear, setSelYear]   = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const monthStr = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;

  const [summary, setSummary] = useState({ artists: [], orders: [], total_tasks: 0, total_time: 0 });
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [aiPeriod, setAiPeriod] = useState("daily");
  const [aiReport, setAiReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistId, setExpandedHistId] = useState(null);
  const isAdmin = user?.role === "admin";

  const goToArtist = useCallback((name) => {
    navigate(`/performance/team/${encodeURIComponent(name)}`);
  }, [navigate]);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await api.post("/ai/reports/overall/generate", null, {
        params: { period: aiPeriod, month: monthStr },
      });
      setAiReport(res.data.report);
      toast.success("Laporan AI tim berhasil dibuat.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat laporan AI.");
    } finally {
      setGenerating(false);
    }
  }, [aiPeriod, monthStr]);

  const saveEdit = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`/ai/reports/${aiReport.id}`, { content: editContent });
      setAiReport(res.data.report);
      setIsEditing(false);
      toast.success("Laporan berhasil diperbarui.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }, [aiReport, editContent]);

  const deleteReport = useCallback(async () => {
    if (!window.confirm("Hapus laporan ini?")) return;
    try {
      await api.delete(`/ai/reports/${aiReport.id}`);
      setAiReport(null);
      setIsEditing(false);
      toast.success("Laporan dihapus.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menghapus.");
    }
  }, [aiReport]);

  useEffect(() => {
    setAiReport(null);
    setIsEditing(false);
    setReportLoading(true);
    api.get("/ai/reports/overall", { params: { period: aiPeriod, month: monthStr } })
      .then((r) => setAiReport(r.data.report))
      .catch(() => {})
      .finally(() => setReportLoading(false));
  }, [aiPeriod, monthStr]);

  useEffect(() => {
    setHistoryLoading(true);
    api.get("/ai/reports/history", { params: { type: "overall", period: aiPeriod } })
      .then((r) => setReportHistory(r.data.reports || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [aiPeriod]);

  useEffect(() => {
    setLoadingTasks(true);
    api.get("/tasks/summary", { params: { month: monthStr } })
      .then((r) => setSummary(r.data || { artists: [], orders: [], total_tasks: 0, total_time: 0 }))
      .catch(() => {})
      .finally(() => setLoadingTasks(false));
  }, [monthStr]);

  const monthOrders = useMemo(() =>
    orders.filter((o) => {
      const d = o.order_date || o.created_at?.slice(0, 10) || "";
      return d.startsWith(monthStr);
    }), [orders, monthStr]);

  const doneOrders = monthOrders.filter((o) => normalizeStatus(o.status) === "Done").length;
  const activeOrds = monthOrders.filter((o) => {
    const s = normalizeStatus(o.status);
    return s !== "Done" && s !== "Cancel";
  }).length;

  const orderById = useMemo(() => {
    const m = {};
    orders.forEach((o) => { m[o.id] = o; });
    return m;
  }, [orders]);

  const pipeline = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const active = orders.filter((o) => {
      const s = normalizeStatus(o.status);
      return s !== "Done" && s !== "Cancel";
    });
    const overdue = active.filter((o) => o.deadline && new Date(o.deadline) < now);
    const stuck = active.filter((o) => {
      if (normalizeStatus(o.status) !== "Pending") return false;
      const start = new Date(o.order_date || o.created_at || Date.now());
      return (now - start) / 86400000 > 3;
    });
    const backlogMap = {};
    active.forEach((o) => {
      (o.artists || []).forEach((a) => {
        if (a) backlogMap[a] = (backlogMap[a] || 0) + 1;
      });
    });
    const backlog = Object.entries(backlogMap).sort((a, b) => b[1] - a[1]);
    return { active: active.length, overdue: overdue.length, stuck: stuck.length, overdueList: overdue, stuckList: stuck, backlog };
  }, [orders]);

  const artistOrderStats = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      (o.artists || []).forEach((a) => {
        if (!a) return;
        if (!map[a]) map[a] = { totalTurnaround: 0, turnaroundCount: 0, onTime: 0, onTimeTotal: 0, totalRevisions: 0, orderCount: 0 };
        map[a].orderCount++;
        map[a].totalRevisions += (o.revision_count || 0);
        if (normalizeStatus(o.status) === "Done" && o.deadline && o.order_date) {
          const days = Math.ceil((new Date(o.deadline) - new Date(o.order_date)) / 86400000);
          if (days > 0) { map[a].totalTurnaround += days; map[a].turnaroundCount++; }
        }
        if (normalizeStatus(o.status) === "Done" && o.deadline) {
          map[a].onTimeTotal++;
          const completedAt = o.completed_at ? new Date(o.completed_at) : null;
          if (completedAt && completedAt <= new Date(o.deadline)) map[a].onTime++;
        }
      });
    });
    return map;
  }, [monthOrders]);

  const orderTaskStats = useMemo(() =>
    summary.orders
      .map((os) => ({ ...os, order: orderById[os.order_id] || null }))
      .filter((os) => os.order)
      .sort((a, b) => b.time - a.time),
    [summary.orders, orderById]
  );

  const filteredOrderTaskStats = useMemo(() => {
    if (!orderSearch.trim()) return orderTaskStats;
    const q = orderSearch.toLowerCase();
    return orderTaskStats.filter((os) =>
      os.order?.project?.toLowerCase().includes(q) ||
      os.order?.client?.toLowerCase().includes(q) ||
      os.order?.folder_code?.toLowerCase().includes(q)
    );
  }, [orderTaskStats, orderSearch]);

  /* Avg waktu per project (semua order yang ada time-nya di bulan ini) */
  const avgTimePerProject = useMemo(() => {
    const ordersWithTime = orderTaskStats.filter((os) => os.time > 0);
    if (ordersWithTime.length === 0) return 0;
    return Math.round(ordersWithTime.reduce((s, os) => s + os.time, 0) / ordersWithTime.length);
  }, [orderTaskStats]);

  const revenueChart = useMemo(() => {
    const revenueMap = {};
    const countMap = {};
    orders.forEach((o) => {
      const mk = monthKey(o.order_date || o.created_at);
      if (!mk) return;
      revenueMap[mk] = (revenueMap[mk] || 0) + (o.total || 0);
      countMap[mk] = (countMap[mk] || 0) + 1;
    });
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selYear, selMonth - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key: k, label: monthLabel(k)?.slice(0, 3) || "", revenue: revenueMap[k] || 0, count: countMap[k] || 0 });
    }
    return months;
  }, [orders, selYear, selMonth]);

  const hasRevenue = revenueChart.some((m) => m.revenue > 0);

  const maxRevenue = Math.max(...revenueChart.map((m) => m.revenue), 1);
  const revenue = monthOrders.reduce((s, o) => s + (o.total || 0), 0);

  const prevMonth = () => {
    if (selMonth === 0) { setSelYear((y) => y - 1); setSelMonth(11); }
    else setSelMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 11) { setSelYear((y) => y + 1); setSelMonth(0); }
    else setSelMonth((m) => m + 1);
  };

  const artistsSorted = [...summary.artists].sort((a, b) => b.tasks - a.tasks);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Tim</h1>
          <p className="mt-0.5 text-sm text-slate-500">Tracking progress tim bulanan — {MONTH_NAMES[selMonth]} {selYear}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <button onClick={prevMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-[160px] justify-center">
            <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
              className="rounded-lg bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              {[selYear - 2, selYear - 1, selYear, selYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
              className="rounded-lg bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <button onClick={nextMonth} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Metrics — revenue diganti avg waktu/project */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetCard icon={FolderOpen}  label="Orders Masuk"   value={monthOrders.length} sub={`${doneOrders} selesai · ${activeOrds} aktif`}  accent="border-l-violet-500" iconBg="bg-violet-50 text-violet-600" />
        <MetCard icon={Activity}    label="Tasks Selesai"  value={summary.artists.reduce((s,a)=>s+a.done,0)} sub={`dari ${summary.total_tasks} task total`} accent="border-l-emerald-500" iconBg="bg-emerald-50 text-emerald-600" />
        <MetCard icon={Clock}       label="Total Waktu"    value={fmtTime(summary.total_time)} sub="akumulasi timer semua artist" accent="border-l-sky-500" iconBg="bg-sky-50 text-sky-600" />
        <MetCard icon={Timer}       label="Avg Waktu/Project" value={avgTimePerProject > 0 ? fmtTime(avgTimePerProject) : "—"} sub={`dari ${orderTaskStats.filter(o=>o.time>0).length} project`} accent="border-l-amber-500" iconBg="bg-amber-50 text-amber-600" />
      </div>

      {/* Main grid */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Per Artist — klik untuk detail */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="font-bold text-slate-900">Performa Artist</p>
              <p className="text-xs text-slate-400">{MONTH_NAMES[selMonth]} {selYear} · {artistsSorted.length} artist aktif</p>
            </div>
            <Users size={16} className="text-slate-300" />
          </div>
          {loadingTasks ? (
            <div className="py-10 text-center text-sm text-slate-400">Memuat data task...</div>
          ) : artistsSorted.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Belum ada task di bulan ini.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {artistsSorted.map((artist) => {
                const rate = artist.tasks > 0 ? Math.round((artist.done / artist.tasks) * 100) : 0;
                const color = getColor(artist.name);
                const oas = artistOrderStats[artist.name] || {};
                const avgTurnaround = oas.turnaroundCount > 0 ? Math.round(oas.totalTurnaround / oas.turnaroundCount) : null;
                const onTimeRate = oas.onTimeTotal > 0 ? Math.round((oas.onTime / oas.onTimeTotal) * 100) : null;
                const avgRevision = oas.orderCount > 0 ? (oas.totalRevisions / oas.orderCount).toFixed(1) : null;
                return (
                  <div
                    key={artist.name}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => goToArtist(artist.name)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: color }}>
                        {artist.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 hover:text-violet-700 transition">{artist.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{artist.assignee_type}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-slate-900">{rate}%</p>
                            <p className="text-xs text-slate-400">task done</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{artist.tasks} task</span>
                          {artist.done > 0 && <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">✓ {artist.done} done</span>}
                          {artist.failed > 0 && <span className="inline-flex items-center rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">✗ {artist.failed} gagal</span>}
                          {artist.in_progress > 0 && <span className="inline-flex items-center rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">◌ {artist.in_progress} jalan</span>}
                          {artist.time > 0 && <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2 py-1 text-xs font-mono font-semibold text-indigo-700">⏱ {fmtTime(artist.time)}</span>}
                        </div>
                        {(avgTurnaround !== null || onTimeRate !== null || avgRevision !== null) && (
                          <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2">
                            {avgTurnaround !== null && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-slate-800">{avgTurnaround}h</p>
                                <p className="text-[10px] text-slate-400">turnaround</p>
                              </div>
                            )}
                            {onTimeRate !== null && (
                              <div className="text-center">
                                <p className={`text-sm font-bold ${onTimeRate >= 80 ? "text-emerald-600" : onTimeRate >= 50 ? "text-amber-600" : "text-rose-600"}`}>{onTimeRate}%</p>
                                <p className="text-[10px] text-slate-400">on-time</p>
                              </div>
                            )}
                            {avgRevision !== null && (
                              <div className="text-center">
                                <p className={`text-sm font-bold ${Number(avgRevision) === 0 ? "text-emerald-600" : Number(avgRevision) <= 1 ? "text-amber-600" : "text-rose-600"}`}>{avgRevision}x</p>
                                <p className="text-[10px] text-slate-400">revisi/order</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Report panel — right column */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Laporan AI Tim</p>
                  <p className="text-[11px] text-white/70">Keseluruhan tim — oleh Claude AI</p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={generateReport} disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition">
                  {generating ? <><Loader2 size={12} className="animate-spin" /> Generating...</> : <><Sparkles size={12} /> Generate</>}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 p-1 w-fit">
              {[{ value: "daily", label: "Harian" }, { value: "weekly", label: "Mingguan" }, { value: "monthly", label: "Bulanan" }].map(({ value, label }) => (
                <button key={value} onClick={() => { setAiPeriod(value); setIsEditing(false); setExpandedHistId(null); }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${aiPeriod === value ? "bg-white text-violet-700 shadow-sm" : "text-white/70 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white px-5 py-4 flex-1 overflow-y-auto" style={{ maxHeight: "640px" }}>
            {reportLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin text-violet-400" /> Memuat laporan...
              </div>
            ) : aiReport ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{fmtDateKey(aiReport.date_key, aiReport.period)}</p>
                    <p className="text-[10px] text-slate-400">
                      {aiReport.is_auto ? "Auto-generated" : `Oleh ${aiReport.generated_by}`}
                      {" · "}{new Date(aiReport.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  {isAdmin && !isEditing && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setEditContent(aiReport.content); setIsEditing(true); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                        <Pencil size={10} /> Edit
                      </button>
                      <button onClick={deleteReport}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition">
                        <Trash2 size={10} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={12}
                      className="w-full rounded-xl border border-violet-200 bg-violet-50/30 p-3 text-sm text-slate-700 outline-none focus:border-violet-400 resize-none leading-relaxed" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setIsEditing(false)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Batal</button>
                      <button onClick={saveEdit} disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition">
                        {saving && <Loader2 size={11} className="animate-spin" />} Simpan
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-0.5">{renderInsight(cleanReportContent(aiReport.content))}</div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Sparkles size={28} className="text-slate-200" />
                <p className="text-sm font-semibold text-slate-400">Belum ada laporan</p>
                <p className="text-xs text-slate-400">
                  {aiPeriod === "daily" ? "Laporan harian dibuat otomatis jam 17.00 WIB." : "Klik Generate untuk membuat."}
                </p>
              </div>
            )}
          </div>

          {reportHistory.length > 0 && (
            <div className="border-t border-slate-100 shrink-0">
              <button onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                <span className="flex items-center gap-2"><Activity size={13} /> Riwayat ({reportHistory.length})</span>
                <ChevronRight size={13} className={`transition-transform ${showHistory ? "rotate-90" : ""}`} />
              </button>
              {showHistory && (
                <div className="px-5 pb-4 space-y-2 max-h-64 overflow-y-auto">
                  {historyLoading ? (
                    <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Memuat...</div>
                  ) : (
                    reportHistory.map((r) => (
                      <div key={r.id} className={`rounded-xl border text-xs transition ${r.id === aiReport?.id ? "border-violet-200 bg-violet-50/40" : "border-slate-100 bg-slate-50"}`}>
                        <button className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                          onClick={() => setExpandedHistId(expandedHistId === r.id ? null : r.id)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800">{fmtDateKey(r.date_key, r.period)}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${r.is_auto ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>
                                {r.is_auto ? "Auto" : r.generated_by}
                              </span>
                              {r.id === aiReport?.id && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Terbaru</span>}
                            </div>
                            <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</p>
                            {expandedHistId !== r.id && r.content && (
                              <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-2">{r.content.replace(/\*\*/g, "").slice(0, 120)}...</p>
                            )}
                          </div>
                          <ChevronRight size={12} className={`shrink-0 text-slate-400 transition-transform ${expandedHistId === r.id ? "rotate-90" : ""}`} />
                        </button>
                        {expandedHistId === r.id && (
                          <div className="border-t border-slate-100 px-3 py-3 space-y-0.5">
                            {renderInsight(cleanReportContent(r.content))}
                            {isAdmin && (
                              <button onClick={() => { if (window.confirm("Hapus laporan ini?")) api.delete(`/ai/reports/${r.id}`).then(() => { setReportHistory((h) => h.filter((x) => x.id !== r.id)); if (aiReport?.id === r.id) setAiReport(null); toast.success("Laporan dihapus."); }).catch(() => toast.error("Gagal.")); }}
                                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition">
                                <Trash2 size={10} /> Hapus
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aktivitas per Order dengan search */}
      {orderTaskStats.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <p className="font-bold text-slate-900">Aktivitas per Order</p>
              <p className="text-xs text-slate-400">Waktu kerja dan progress task {MONTH_NAMES[selMonth]} {selYear}</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Cari project..."
                className="rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2 text-sm outline-none focus:border-violet-400 w-52"
              />
              {orderSearch && (
                <button onClick={() => setOrderSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          {filteredOrderTaskStats.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Tidak ditemukan.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredOrderTaskStats.map((os) => {
                const o = os.order;
                const rate = os.tasks > 0 ? Math.round((os.done / os.tasks) * 100) : 0;
                return (
                  <div key={os.order_id} className="flex items-start gap-4 px-6 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-700">
                      {o.project?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{o.project}</p>
                          <p className="text-xs text-indigo-600 font-mono">{o.folder_code || o.client}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">{fmtTime(os.time)}</p>
                          <p className="text-xs text-slate-400">waktu kerja</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">{os.tasks} task</span>
                        {os.done > 0 && <span className="text-xs text-emerald-600 font-semibold">✓ {os.done} done</span>}
                        {os.failed > 0 && <span className="text-xs text-rose-500 font-semibold">✗ {os.failed} gagal</span>}
                        <span className="text-xs text-slate-400">·</span>
                        {os.assignees.map((a) => (
                          <button
                            key={a}
                            onClick={() => goToArtist(a)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white hover:ring-2 hover:ring-offset-1 transition"
                            style={{ background: getColor(a) }}
                            title={a}
                          >
                            {a.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <PipelineHealth pipeline={pipeline} />

      {/* Tren Revenue — dipindah ke bawah pipeline */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="font-bold text-slate-900">{hasRevenue ? "Tren Revenue" : "Order Masuk"}</p>
          <p className="text-xs text-slate-400">6 bulan terakhir{!hasRevenue && " · belum ada data revenue"}</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-end gap-2" style={{ height: "128px" }}>
            {revenueChart.map((m) => {
              const val = hasRevenue ? m.revenue : m.count;
              const maxVal = hasRevenue ? maxRevenue : Math.max(...revenueChart.map((x) => x.count), 1);
              const barH = Math.max(Math.round((val / maxVal) * 100), 6);
              const isCurrent = m.key === monthStr;
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1 group">
                  <div className="flex-1" />
                  {val > 0 && (
                    <span className="text-[9px] text-slate-400 font-semibold hidden group-hover:block">
                      {hasRevenue ? formatMoney(m.revenue) : `${m.count} order`}
                    </span>
                  )}
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${barH}px`, background: isCurrent ? "linear-gradient(to top, #7c3aed, #6366f1)" : "linear-gradient(to top, #cbd5e1, #e2e8f0)" }} />
                  <span className={`text-[10px] font-semibold ${isCurrent ? "text-violet-700" : "text-slate-400"}`}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400">Total revenue</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatMoney(revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Order masuk</p>
            <p className="font-bold text-slate-800 mt-0.5">{monthOrders.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Selesai</p>
            <p className="font-bold text-emerald-700 mt-0.5">{doneOrders}</p>
          </div>
        </div>
      </div>

      <AllTimeSection orders={orders} formatMoney={formatMoney} onSelectArtist={goToArtist} />
    </div>
  );
}

/* ─── PipelineHealth ─────────────────────────────────────────────── */
function PipelineHealth({ pipeline }) {
  const [showOverdue, setShowOverdue] = useState(false);
  const [showStuck, setShowStuck]     = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <p className="font-bold text-slate-900">Pipeline & Health</p>
        <p className="text-xs text-slate-400">Snapshot kondisi order saat ini</p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-sky-700">{pipeline.active}</p>
            <p className="mt-0.5 text-xs text-sky-500 font-semibold">Order Aktif</p>
          </div>
          <button onClick={() => setShowOverdue((v) => !v)} className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-center hover:bg-rose-100 transition">
            <p className="text-2xl font-bold text-rose-600">{pipeline.overdue}</p>
            <p className="mt-0.5 text-xs text-rose-400 font-semibold">Overdue ⚠</p>
          </button>
          <button onClick={() => setShowStuck((v) => !v)} className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-center hover:bg-amber-100 transition">
            <p className="text-2xl font-bold text-amber-600">{pipeline.stuck}</p>
            <p className="mt-0.5 text-xs text-amber-500 font-semibold">Stuck &gt;3h</p>
          </button>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-700">{pipeline.backlog.length}</p>
            <p className="mt-0.5 text-xs text-slate-400 font-semibold">Artist Backlog</p>
          </div>
        </div>
        {showOverdue && pipeline.overdueList.length > 0 && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-rose-500">Order Overdue</p>
            <div className="space-y-1.5">
              {pipeline.overdueList.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{o.project}</p>
                    <p className="text-xs text-slate-400">{(o.artists || []).join(", ") || "—"}</p>
                  </div>
                  <span className="text-xs font-mono text-rose-600 font-semibold">{o.deadline}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {showStuck && pipeline.stuckList.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-500">Order Pending &gt; 3 Hari</p>
            <div className="space-y-1.5">
              {pipeline.stuckList.map((o) => {
                const age = Math.floor((new Date() - new Date(o.order_date || o.created_at || Date.now())) / 86400000);
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{o.project}</p>
                      <p className="text-xs text-slate-400">{o.client}</p>
                    </div>
                    <span className="text-xs font-semibold text-amber-600">{age}h tanpa progress</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {pipeline.backlog.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Backlog per Artist</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {pipeline.backlog.map(([artist, count]) => {
                const color = getColor(artist);
                const maxCount = pipeline.backlog[0]?.[1] || 1;
                return (
                  <div key={artist} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>
                      {artist.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{artist}</p>
                        <span className="text-xs font-bold text-slate-700">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((count / maxCount) * 100)}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AllTimeSection ─────────────────────────────────────────────── */
function AllTimeSection({ orders, formatMoney, onSelectArtist }) {
  const [open, setOpen] = useState(false);
  const artistStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      (o.artists || []).forEach((a) => {
        if (!a) return;
        if (!map[a]) map[a] = { orders: 0, done: 0, revenue: 0 };
        map[a].orders++;
        if (o.status === "Done") map[a].done++;
        map[a].revenue += (o.total || 0) / Math.max((o.artists || []).length, 1);
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1].orders - a[1].orders)
      .map(([name, d]) => ({ name, ...d, rate: d.orders ? Math.round((d.done / d.orders) * 100) : 0 }));
  }, [orders]);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <div>
          <p className="font-bold text-slate-900">Statistik All-Time per Artist</p>
          <p className="text-xs text-slate-400">Berdasarkan seluruh riwayat order</p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {artistStats.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">Belum ada data artist.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {artistStats.map((a) => (
                <button
                  key={a.name}
                  onClick={() => onSelectArtist(a.name)}
                  className="flex w-full items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: getColor(a.name) }}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{a.name}</p>
                      <p className="text-sm font-bold text-slate-700">{a.rate}%</p>
                    </div>
                    <p className="text-xs text-slate-400">{a.orders} order · {a.done} selesai · {formatMoney(a.revenue)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── MetCard ─────────────────────────────────────────────────────── */
function MetCard({ icon: Icon, label, value, sub, accent, iconBg }) {
  return (
    <div className={`rounded-2xl border-l-4 border border-slate-200 bg-white px-5 py-4 shadow-sm ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
