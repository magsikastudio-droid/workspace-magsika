import React, { useMemo, useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTasks } from "../context/TasksContext";
import { TrendingUp, CheckCircle2, Clock3, Layers, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { normalizeStatus } from "../lib/constants";
import { useNavigate } from "react-router-dom";

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();

// Warna market -- konsisten sama satu-satunya sumber MARKET_OPTIONS di constants.js
const MARKET_COLORS = { Magsika: "#7c3aed", Eirene: "#0ea5e9", Lolicharm: "#e11d48" };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const taskElapsed = (t) => {
  let base = t.time_elapsed || 0;
  if (t.timer_started) base += Math.floor((Date.now() - new Date(t.timer_started).getTime()) / 1000);
  return Math.max(0, base);
};

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { formatMoney, exchangeRate } = useCurrency();
  const { tasks } = useTasks();
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed, Juni=5

  const availableYears = useMemo(() => {
    const years = new Set([now.getFullYear()]);
    orders.forEach((o) => {
      const d = o.order_date || o.created_at?.slice(0, 10);
      if (d) years.add(parseInt(d.slice(0, 4)));
    });
    return [...years].sort().reverse();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = o.order_date || o.created_at?.slice(0, 10) || "";
      if (!d) return selectedMonth === null;
      const [y, m] = d.split("-").map(Number);
      if (y !== selectedYear) return false;
      if (selectedMonth !== null && m !== selectedMonth + 1) return false;
      return true;
    });
  }, [orders, selectedYear, selectedMonth]);

  const prevMonth = () => {
    if (selectedMonth === null || selectedMonth === 0) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (selectedMonth === null || selectedMonth === 11) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter((o) => normalizeStatus(o.status) === "Done").length;
  const activeOrders = filteredOrders.filter((o) => {
    const s = normalizeStatus(o.status);
    return s !== "Done" && s !== "Cancel";
  }).length;
  const cancelOrders = filteredOrders.filter((o) => normalizeStatus(o.status) === "Cancel").length;
  const revenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const unpaid = filteredOrders.filter((o) => o.payment_status !== "Lunas").reduce((sum, o) => sum + (o.total || 0), 0);

  const deadlineAlerts = orders.filter((o) => {
    if (!o.deadline || normalizeStatus(o.status) === "Done" || normalizeStatus(o.status) === "Cancel") return false;
    const diff = Math.ceil((new Date(o.deadline) - new Date()) / 86400000);
    return diff >= 0 && diff <= 3;
  });

  const overdueOrders = orders.filter((o) => {
    if (!o.deadline || normalizeStatus(o.status) === "Done" || normalizeStatus(o.status) === "Cancel") return false;
    return new Date(o.deadline) < new Date();
  });

  const clientTotals = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      if (!o.client) return;
      map[o.client] = (map[o.client] || 0) + (o.total || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([client, total]) => ({ client, total, count: filteredOrders.filter((o) => o.client === client).length }));
  }, [filteredOrders]);

  const marketSummary = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => { const m = o.market || "Lainnya"; map[m] = (map[m] || 0) + 1; });
    const total = Object.values(map).reduce((s, c) => s + c, 0);
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({ platform, count, share: total ? Math.round((count / total) * 100) : 0, color: MARKET_COLORS[platform] || "#94a3b8" }));
  }, [filteredOrders]);

  const recentOrders = useMemo(() =>
    [...filteredOrders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5),
    [filteredOrders]
  );

  // Tren 6 bulan terakhir -- pakai SEMUA order (bukan filteredOrders), lepas dari
  // bulan yang lagi dipilih user di month-selector, biar tren-nya gak berubah-ubah.
  const monthlyTrend = useMemo(() => {
    const chronological = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthOrders = orders.filter((o) => {
        const ds = o.order_date || o.created_at?.slice(0, 10) || "";
        if (!ds) return false;
        const [y, mo] = ds.split("-").map(Number);
        return y === d.getFullYear() && mo - 1 === d.getMonth();
      });
      chronological.push({
        label: MONTH_NAMES[d.getMonth()],
        revenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
        count: monthOrders.length,
      });
    }
    const withDelta = chronological.map((m, i) => {
      if (i === 0) return { ...m, delta: null };
      const prev = chronological[i - 1];
      return { ...m, delta: prev.revenue > 0 ? Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100) : null };
    });
    return [...withDelta].reverse(); // terbaru di atas
  }, [orders]);

  const sixMonthGrowth = useMemo(() => {
    const chrono = [...monthlyTrend].reverse();
    const first = chrono[0];
    const last = chrono[chrono.length - 1];
    if (!first || !last) return { revenue: null, order: null };
    return {
      revenue: first.revenue > 0 ? Math.round(((last.revenue - first.revenue) / first.revenue) * 100) : null,
      order: first.count > 0 ? Math.round(((last.count - first.count) / first.count) * 100) : null,
    };
  }, [monthlyTrend]);

  // Kesehatan bisnis -- turnaround & tingkat revisi dari bulan yang lagi
  // dipilih; repeat client dihitung dari SEMUA order (konsep historis, bukan
  // per-bulan).
  const avgTurnaroundDays = useMemo(() => {
    const done = filteredOrders.filter((o) => o.completed_at && o.order_date && normalizeStatus(o.status) === "Done");
    if (done.length === 0) return null;
    const totalDays = done.reduce((s, o) => s + Math.max(0, (new Date(o.completed_at) - new Date(o.order_date)) / 86400000), 0);
    return totalDays / done.length;
  }, [filteredOrders]);

  const revisionRate = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    const revised = filteredOrders.filter((o) => (o.revision_count || 0) > 0).length;
    return Math.round((revised / filteredOrders.length) * 100);
  }, [filteredOrders]);

  const repeatClientRate = useMemo(() => {
    const map = {};
    orders.forEach((o) => { if (o.client) map[o.client] = (map[o.client] || 0) + 1; });
    const counts = Object.values(map);
    if (counts.length === 0) return null;
    return Math.round((counts.filter((c) => c > 1).length / counts.length) * 100);
  }, [orders]);

  const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

  // Beban kerja tim -- task hari ini per talent internal (assignee_type "tim")
  const teamWorkload = useMemo(() => {
    const today = todayStr();
    const map = {};
    tasks.forEach((t) => {
      if (t.assignee_type !== "tim" || t.date !== today || !t.assignee) return;
      if (!map[t.assignee]) map[t.assignee] = { name: t.assignee, active: 0, overdue: 0 };
      const finished = t.status === "done" || t.status === "failed";
      if (!finished) map[t.assignee].active += 1;
      if (!finished && t.duration_seconds) {
        const elapsed = taskElapsed(t);
        if (elapsed > 0 && elapsed >= t.duration_seconds) map[t.assignee].overdue += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.active - a.active).slice(0, 4);
  }, [tasks]);

  // Margin per market -- total dalam USD, fee_freelance disimpan dalam Rupiah
  // (lihat OrderDrawer.jsx) jadi harus dikonversi pakai exchangeRate yang sama.
  const marketMargins = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const m = o.market || "Lainnya";
      if (!map[m]) map[m] = { market: m, revenue: 0, feeUsd: 0 };
      map[m].revenue += o.total || 0;
      map[m].feeUsd += (o.fee_freelance || 0) / (exchangeRate || 1);
    });
    return Object.values(map)
      .map((m) => ({ ...m, marginPct: m.revenue > 0 ? Math.max(0, Math.round(((m.revenue - m.feeUsd) / m.revenue) * 100)) : null }))
      .filter((m) => m.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, exchangeRate]);

  const topMarketer = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      if (!o.marketer) return;
      if (!map[o.marketer]) map[o.marketer] = { marketer: o.marketer, count: 0, revenue: 0 };
      map[o.marketer].count += 1;
      map[o.marketer].revenue += o.total || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)[0] || null;
  }, [filteredOrders]);

  const STATUS_BADGE = {
    "Done":     "bg-emerald-50 text-emerald-700",
    "Cancel":   "bg-slate-100 text-slate-500",
    "Pending":  "bg-amber-50 text-amber-700",
  };
  const getBadge = (status) => STATUS_BADGE[normalizeStatus(status)] || "bg-violet-50 text-violet-700";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Ringkasan produksi Magsika Studio.</p>
        </div>
        {/* Month selector */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <button onClick={prevMonth} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"><ChevronLeft size={16} /></button>
          <div className="flex items-center gap-2 min-w-[160px] justify-center">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedMonth ?? "all"} onChange={(e) => setSelectedMonth(e.target.value === "all" ? null : Number(e.target.value))} className="rounded-lg bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              <option value="all">Semua Bulan</option>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <button onClick={nextMonth} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Alerts */}
      {overdueOrders.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <div>
            <span className="font-semibold">{overdueOrders.length} order melewati deadline: </span>
            {overdueOrders.map((o) => o.project).join(", ")}
          </div>
        </div>
      )}
      {deadlineAlerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">{deadlineAlerts.length} deadline ≤ 3 hari: </span>
            {deadlineAlerts.map((o) => o.project).join(", ")}
          </div>
        </div>
      )}

      {/* Revenue -- paling atas karena ini data pendapatan, yang paling langsung relevan */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Revenue</p>
          <p className="mt-2 font-mono text-3xl font-bold text-indigo-600">{formatMoney(revenue)}</p>
          <p className="mt-1 text-sm text-slate-400">Akumulasi semua order bulan ini</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Payment</p>
          <p className="mt-2 font-mono text-3xl font-bold text-rose-600">{formatMoney(unpaid)}</p>
          <p className="mt-1 text-sm text-slate-400">Belum lunas dari klien</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Orders"
          value={totalOrders}
          sub={`Last 365 days`}
          accent="border-l-violet-500"
          icon={Layers}
          iconBg="bg-violet-50 text-violet-600"
          trend={`${activeOrders} aktif`}
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="New / Active Orders"
          value={activeOrders}
          sub="Sedang diproduksi"
          accent="border-l-sky-500"
          icon={TrendingUp}
          iconBg="bg-sky-50 text-sky-600"
          trend={`${Math.round((activeOrders / Math.max(totalOrders, 1)) * 100)}% dari total`}
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Completed Orders"
          value={completedOrders}
          sub={`${Math.round((completedOrders / Math.max(totalOrders, 1)) * 100)}% completion rate`}
          accent="border-l-emerald-500"
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          trend="selesai"
          positive
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Cancelled Orders"
          value={cancelOrders}
          sub="Order dibatalkan"
          accent="border-l-slate-300"
          icon={Clock3}
          iconBg="bg-slate-50 text-slate-400"
          trend={`${Math.round((cancelOrders / Math.max(totalOrders, 1)) * 100)}% cancel rate`}
          onClick={() => navigate("/orders")}
        />
      </div>

      {/* Order Terbaru + Perbandingan Bulanan (kolom kiri) / Per Market (kolom kanan) */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Recent orders table */}
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-900">Order Terbaru</p>
                <p className="text-xs text-slate-400">5 order terakhir masuk</p>
              </div>
              <button onClick={() => navigate("/orders")} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
                Lihat semua <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-violet-600">
                    {order.client?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{order.project}</p>
                    <p className="truncate text-xs text-slate-400">{order.client} · {order.platform || "Direct"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-slate-900">{formatMoney(order.total)}</p>
                    <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadge(order.status)}`}>
                      {normalizeStatus(order.status)}
                    </span>
                  </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-400">Belum ada order.</div>
              )}
            </div>
          </div>

          {/* Perbandingan bulanan -- terbaru di atas, plus pertumbuhan 6 bulan */}
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-900">Perbandingan Bulanan</p>
                <p className="text-xs text-slate-400">Terbaru di atas — revenue &amp; order</p>
              </div>
              <div className="flex gap-1.5">
                {sixMonthGrowth.revenue !== null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold font-mono ${sixMonthGrowth.revenue >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    Revenue 6bln {sixMonthGrowth.revenue >= 0 ? "▲" : "▼"} {Math.abs(sixMonthGrowth.revenue)}%
                  </span>
                )}
                {sixMonthGrowth.order !== null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold font-mono ${sixMonthGrowth.order >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    Order 6bln {sixMonthGrowth.order >= 0 ? "▲" : "▼"} {Math.abs(sixMonthGrowth.order)}%
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_110px_70px_90px] text-sm">
              <div className="contents text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="px-5 pb-2 pt-3">Bulan</span><span className="pb-2 pt-3">Revenue</span><span className="pb-2 pt-3">Order</span><span className="pb-2 pt-3">vs Lalu</span>
              </div>
              {monthlyTrend.map((m, idx) => (
                <div key={`${m.label}-${idx}`} className={`contents ${idx === 0 ? "font-bold text-indigo-600" : "text-slate-700"}`}>
                  <span className={`flex items-center px-5 py-2.5 border-t border-slate-50 ${idx === 0 ? "bg-indigo-50" : ""}`}>{m.label}</span>
                  <span className={`flex items-center py-2.5 border-t border-slate-50 font-mono font-semibold ${idx === 0 ? "bg-indigo-50" : ""}`}>{formatMoney(m.revenue)}</span>
                  <span className={`flex items-center py-2.5 border-t border-slate-50 font-mono font-semibold ${idx === 0 ? "bg-indigo-50" : ""}`}>{m.count}</span>
                  <span className={`flex items-center py-2.5 border-t border-slate-50 ${idx === 0 ? "bg-indigo-50" : ""}`}>
                    {m.delta === null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-400">—</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold font-mono ${m.delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {m.delta >= 0 ? "▲" : "▼"} {Math.abs(m.delta)}%
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market distribution */}
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold text-slate-900">Per Market</p>
            <p className="text-xs text-slate-400">Distribusi {totalOrders} order antar unit bisnis</p>
          </div>
          <div className="p-5">
            <PieChart data={marketSummary} />
            <div className="mt-4 space-y-2.5">
              {marketSummary.map((item) => (
                <div key={item.platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-slate-600">{item.platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${item.share}%`, background: item.color }} />
                    </div>
                    <span className="w-8 text-right font-mono text-xs font-semibold text-slate-700">{item.share}%</span>
                  </div>
                </div>
              ))}
              {marketSummary.length === 0 && <p className="text-xs text-slate-400">Belum ada data.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Analisis Lanjutan */}
      <p className="px-1 text-xs font-bold uppercase tracking-widest text-slate-400">Analisis Lanjutan</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold text-slate-900">Kesehatan Bisnis</p>
            <p className="text-xs text-slate-400">Kualitas produksi &amp; klien bulan ini</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
            <div className="p-4">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Turnaround</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{avgTurnaroundDays !== null ? `${avgTurnaroundDays.toFixed(1)} hari` : "—"}</p>
              <p className="text-[10px] text-slate-400">order → selesai</p>
            </div>
            <div className="p-4">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Tingkat Revisi</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{revisionRate !== null ? `${revisionRate}%` : "—"}</p>
              <p className="text-[10px] text-slate-400">order kena revisi</p>
            </div>
            <div className="p-4">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Repeat Client</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{repeatClientRate !== null ? `${repeatClientRate}%` : "—"}</p>
              <p className="text-[10px] text-slate-400">klien order ulang</p>
            </div>
            <div className="p-4">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Rata-rata Nilai Order</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatMoney(avgOrderValue)}</p>
              <p className="text-[10px] text-slate-400">per order bulan ini</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold text-slate-900">Beban Kerja Tim</p>
            <p className="text-xs text-slate-400">Task aktif hari ini per talent</p>
          </div>
          <div className="divide-y divide-slate-50">
            {teamWorkload.map((t) => (
              <div key={t.name} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm font-semibold text-slate-800">{t.name}</span>
                <span className="font-mono text-xs text-slate-400">{t.active} aktif</span>
                {t.overdue > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">{t.overdue} overdue</span>
                )}
              </div>
            ))}
            {teamWorkload.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada task hari ini.</div>}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold text-slate-900">Margin per Market</p>
            <p className="text-xs text-slate-400">Setelah dikurangi fee freelance</p>
          </div>
          <div className="px-5 py-3 space-y-2.5">
            {marketMargins.map((m) => (
              <div key={m.market} className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 truncate text-xs font-semibold text-slate-600">{m.market}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.marginPct ?? 0}%` }} />
                </div>
                <span className="w-9 text-right font-mono text-xs font-bold text-slate-700">{m.marginPct !== null ? `${m.marginPct}%` : "—"}</span>
              </div>
            ))}
            {marketMargins.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada data.</p>}
          </div>
          {topMarketer && (
            <div className="mx-5 mb-4 mt-1 flex items-center gap-2.5 rounded-2xl bg-indigo-50 px-3.5 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {topMarketer.marketer.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-500">Marketer Terbaik</p>
                <p className="truncate text-xs font-semibold text-slate-800">{topMarketer.marketer} — <span className="font-mono">{topMarketer.count} order · {formatMoney(topMarketer.revenue)}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top clients */}
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="font-semibold text-slate-900">Top Klien</p>
          <p className="text-xs text-slate-400">Berdasarkan total nilai order</p>
        </div>
        <div className="divide-y divide-slate-50">
          {clientTotals.map((item, idx) => {
            const maxTotal = clientTotals[0]?.total || 1;
            const pct = Math.round((item.total / maxTotal) * 100);
            return (
              <div key={item.client} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-5 text-center text-xs font-bold text-slate-400">#{idx + 1}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {item.client.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.client}</p>
                    <p className="shrink-0 font-mono text-sm font-bold text-slate-900">{formatMoney(item.total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">{item.count} order</span>
                  </div>
                </div>
              </div>
            );
          })}
          {clientTotals.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada data klien.</div>}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, accent, icon: Icon, iconBg, trend, positive, negative, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-3xl border-l-4 border border-slate-200 bg-white p-5 shadow-sm transition ${accent} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <div className={`rounded-2xl p-2.5 ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
      {trend && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-600" : negative ? "text-rose-500" : "text-slate-500"}`}>
          {positive && "▲ "}{negative && "▼ "}{trend}
        </div>
      )}
    </div>
  );
}

function PieChart({ data }) {
  if (!data || data.length === 0) return <div className="flex h-28 items-center justify-center text-xs text-slate-400">Belum ada data</div>;
  const size = 120; const cx = 60; const cy = 60; const r = 48; const inner = 28;
  let cumulative = 0;
  const total = data.reduce((s, d) => s + d.count, 0);
  const slices = data.map((d) => { const start = cumulative; const slice = (d.count / total) * 360; cumulative += slice; return { ...d, startAngle: start, endAngle: cumulative }; });
  const polar = (angle, radius) => { const rad = ((angle - 90) * Math.PI) / 180; return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }; };
  const arc = (start, end, outerR, innerR) => {
    if (end - start >= 360) end = 359.99;
    const p1 = polar(start, outerR); const p2 = polar(end, outerR); const p3 = polar(end, innerR); const p4 = polar(start, innerR);
    const large = end - start > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  };
  return (
    <div className="flex justify-center">
      <svg width={size} height={size}>
        {slices.map((s) => <path key={s.platform} d={arc(s.startAngle, s.endAngle, r, inner)} fill={s.color} />)}
        <text x={cx} y={cy - 5} textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="16" fontWeight="800" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#94a3b8">order</text>
      </svg>
    </div>
  );
}
