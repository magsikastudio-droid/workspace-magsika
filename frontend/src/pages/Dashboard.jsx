import React, { useMemo } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { TrendingUp, CheckCircle2, Clock3, Layers, Users, AlertTriangle } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { PLATFORM_COLORS, normalizeStatus } from "../lib/constants";

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { formatMoney } = useCurrency();

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => normalizeStatus(o.status) === "Done").length;
  const activeOrders = orders.filter((o) => normalizeStatus(o.status) !== "Done" && normalizeStatus(o.status) !== "Cancel").length;
  const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const freelanceFee = Math.round(revenue * 0.12);
  const unpaid = orders
    .filter((o) => o.payment_status !== "Lunas")
    .reduce((sum, o) => sum + (o.total || 0), 0);

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
    orders.forEach((o) => {
      if (!o.client) return;
      map[o.client] = (map[o.client] || 0) + (o.total || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([client, total]) => ({ client, total, count: orders.filter((o) => o.client === client).length }));
  }, [orders]);

  const platformSummary = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const p = o.platform || "Direct";
      map[p] = (map[p] || 0) + 1;
    });
    const total = Object.values(map).reduce((s, c) => s + c, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({
        platform, count,
        share: total ? Math.round((count / total) * 100) : 0,
        color: PLATFORM_COLORS[platform] || "#94a3b8",
      }));
  }, [orders]);

  const statusSummary = useMemo(() => {
    const map = {};
    orders.filter((o) => normalizeStatus(o.status) !== "Done" && normalizeStatus(o.status) !== "Cancel").forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Ringkasan order dan pengingat deadline untuk tim Magsika Studio.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
          {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        </div>
      </div>

      {overdueOrders.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="flex items-center gap-3 font-semibold">
            <AlertTriangle size={18} />
            {overdueOrders.length} order melewati deadline: {overdueOrders.map((o) => o.project).join(", ")}
          </div>
        </div>
      )}

      {deadlineAlerts.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-3 font-semibold">
            <AlertTriangle size={18} />
            {deadlineAlerts.length} project deadline ≤ 3 hari: {deadlineAlerts.map((o) => o.project).join(", ")}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Layers} title="Total Project" value={totalOrders} subtitle={`${completedOrders} selesai · ${activeOrders} aktif`} accent="from-indigo-500 to-violet-600" />
        <MetricCard icon={TrendingUp} title="Total Equity" value={formatMoney(revenue)} subtitle="Akumulasi semua order" accent="from-sky-500 to-cyan-600" />
        <MetricCard icon={CheckCircle2} title="Done / Selesai" value={completedOrders} subtitle={`${Math.round((completedOrders / Math.max(totalOrders, 1)) * 100)}% completion`} accent="from-emerald-500 to-teal-600" />
        <MetricCard icon={Users} title="Fee Freelance" value={formatMoney(freelanceFee)} subtitle="Est. 12% dari revenue" accent="from-amber-500 to-orange-600" />
        <MetricCard icon={Clock3} title="Pending Payment" value={formatMoney(unpaid)} subtitle="Belum lunas" accent="from-rose-500 to-pink-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Top Klien</h2>
              <p className="text-sm text-slate-500">Pendapatan per klien.</p>
            </div>
            <span className="text-sm text-slate-500">{clientTotals.length} klien</span>
          </div>
          <div className="mt-5 space-y-3">
            {clientTotals.map((item) => {
              const maxTotal = clientTotals[0]?.total || 1;
              const pct = Math.round((item.total / maxTotal) * 100);
              return (
                <div key={item.client}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">{item.client}</span>
                    <span className="text-slate-500">{item.count} order · <span className="font-semibold text-slate-900">{formatMoney(item.total)}</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {clientTotals.length === 0 && <p className="text-sm text-slate-500">Belum ada order.</p>}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Per Platform</h2>
              <p className="text-sm text-slate-500">Distribusi order.</p>
            </div>
            <span className="text-sm text-slate-500">{orders.length} total</span>
          </div>
          <div className="mt-5">
            <PieChart data={platformSummary} />
            <div className="mt-4 space-y-2">
              {platformSummary.map((item) => (
                <div key={item.platform} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm font-medium text-slate-700">{item.platform}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.count} ({item.share}%)</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold">Status Produksi Aktif</h2>
          <p className="text-sm text-slate-500">Distribusi order berdasarkan tahap produksi saat ini.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statusSummary.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">{status}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">{count}</span>
            </div>
          ))}
          {statusSummary.length === 0 && <p className="text-sm text-slate-500 col-span-3">Tidak ada order aktif.</p>}
        </div>
      </section>
    </div>
  );
}

function PieChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="flex h-36 items-center justify-center text-sm text-slate-400">Belum ada data</div>;
  }
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 50;
  const inner = 28;
  let cumulative = 0;
  const total = data.reduce((s, d) => s + d.count, 0);

  const slices = data.map((d) => {
    const start = cumulative;
    const slice = (d.count / total) * 360;
    cumulative += slice;
    return { ...d, startAngle: start, endAngle: cumulative };
  });

  const polarToCartesian = (angle, radius) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (start, end, outerR, innerR) => {
    if (end - start >= 360) end = 359.99;
    const p1 = polarToCartesian(start, outerR);
    const p2 = polarToCartesian(end, outerR);
    const p3 = polarToCartesian(end, innerR);
    const p4 = polarToCartesian(start, innerR);
    const large = end - start > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  };

  return (
    <div className="flex justify-center">
      <svg width={size} height={size}>
        {slices.map((slice) => (
          <path
            key={slice.platform}
            d={describeArc(slice.startAngle, slice.endAngle, r, inner)}
            fill={slice.color}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#64748b">{total}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#94a3b8">order</text>
      </svg>
    </div>
  );
}
