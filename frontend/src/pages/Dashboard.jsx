import React, { useMemo, useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { TrendingUp, CheckCircle2, Clock3, Layers, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PLATFORM_COLORS, normalizeStatus } from "../lib/constants";
import { useNavigate } from "react-router-dom";

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { formatMoney } = useCurrency();
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null); // null = semua bulan di tahun ini

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

  const platformSummary = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => { const p = o.platform || "Direct"; map[p] = (map[p] || 0) + 1; });
    const total = Object.values(map).reduce((s, c) => s + c, 0);
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({ platform, count, share: total ? Math.round((count / total) * 100) : 0, color: PLATFORM_COLORS[platform] || "#94a3b8" }));
  }, [filteredOrders]);

  const recentOrders = useMemo(() =>
    [...filteredOrders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5),
    [filteredOrders]
  );

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
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
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
          accent="border-l-rose-400"
          icon={Clock3}
          iconBg="bg-rose-50 text-rose-600"
          trend={`${Math.round((cancelOrders / Math.max(totalOrders, 1)) * 100)}% cancel rate`}
          negative
          onClick={() => navigate("/orders")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-violet-200">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold">{formatMoney(revenue)}</p>
          <p className="mt-1 text-sm text-violet-200">Akumulasi semua order</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Payment</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">{formatMoney(unpaid)}</p>
          <p className="mt-1 text-sm text-slate-400">Belum lunas dari klien</p>
        </div>
      </div>

      {/* Table + Platform */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* Recent orders table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-600">
                  {order.client?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{order.project}</p>
                  <p className="truncate text-xs text-slate-400">{order.client} · {order.platform || "Direct"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatMoney(order.total)}</p>
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

        {/* Platform distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold text-slate-900">Per Platform</p>
            <p className="text-xs text-slate-400">Distribusi {totalOrders} order</p>
          </div>
          <div className="p-5">
            <PieChart data={platformSummary} />
            <div className="mt-4 space-y-2.5">
              {platformSummary.map((item) => (
                <div key={item.platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-slate-600">{item.platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${item.share}%`, background: item.color }} />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-slate-700">{item.share}%</span>
                  </div>
                </div>
              ))}
              {platformSummary.length === 0 && <p className="text-xs text-slate-400">Belum ada data.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Top clients */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                    <p className="shrink-0 text-sm font-bold text-slate-900">{formatMoney(item.total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{item.count} order</span>
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
    <div onClick={onClick} className={`rounded-2xl border-l-4 border border-slate-200 bg-white p-5 shadow-sm ${accent} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
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
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#94a3b8">order</text>
      </svg>
    </div>
  );
}
