import React, { useMemo, useState } from "react";
import { DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { PLATFORM_OPTIONS, PLATFORM_COLORS } from "../lib/constants";
import { monthKey, monthLabel } from "../lib/format";

export default function Earnings() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();
  const [filter, setFilter] = useState("Semua");

  const filtered = useMemo(
    () => filter === "Semua" ? orders : orders.filter((o) => o.platform === filter),
    [orders, filter]
  );

  const totalRevenue = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const totalLunas = filtered.filter((o) => o.payment_status === "Lunas").reduce((s, o) => s + (o.total || 0), 0);
  const totalPending = totalRevenue - totalLunas;
  const freelanceFee = Math.round(totalRevenue * 0.12);
  const netRevenue = totalRevenue - freelanceFee;

  const byPlatform = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const p = o.platform || "Direct";
      if (!map[p]) map[p] = { revenue: 0, count: 0, lunas: 0 };
      map[p].revenue += (o.total || 0);
      map[p].count++;
      if (o.payment_status === "Lunas") map[p].lunas += (o.total || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  const maxPlatformRevenue = Math.max(...byPlatform.map(([, d]) => d.revenue), 1);

  const byMonth = useMemo(() => {
    const map = {};
    filtered.forEach((o) => {
      const mk = monthKey(o.created_at);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, count: 0, lunas: 0 };
      map[mk].revenue += (o.total || 0);
      map[mk].count++;
      if (o.payment_status === "Lunas") map[mk].lunas += (o.total || 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const maxMonthRevenue = Math.max(...byMonth.map(([, d]) => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <DollarSign size={18} /> Earnings
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Laporan Pendapatan</h1>
          <p className="mt-2 text-sm text-slate-500">Ringkasan revenue per platform, per bulan, dan status pembayaran.</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 shadow-sm">
          <option value="Semua">Semua Platform</option>
          {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetCard label="Gross Revenue" value={formatMoney(totalRevenue)} sub={`${filtered.length} order`} color="from-sky-500 to-violet-500" />
        <MetCard label="Sudah Lunas" value={formatMoney(totalLunas)} sub="Pembayaran diterima" color="from-emerald-500 to-teal-500" />
        <MetCard label="Pending Payment" value={formatMoney(totalPending)} sub="Belum diterima" color="from-amber-500 to-orange-500" />
        <MetCard label="Net (setelah fee 12%)" value={formatMoney(netRevenue)} sub={`Fee: ${formatMoney(freelanceFee)}`} color="from-violet-500 to-pink-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Revenue per Platform</h2>
            <p className="text-sm text-slate-500">Perbandingan pendapatan antar platform.</p>
          </div>
          <div className="space-y-4">
            {byPlatform.map(([platform, data]) => {
              const pct = Math.round((data.revenue / maxPlatformRevenue) * 100);
              const color = PLATFORM_COLORS[platform] || "#94a3b8";
              return (
                <div key={platform}>
                  <div className="mb-1 flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                      <span className="font-medium text-slate-700">{platform}</span>
                    </div>
                    <span className="text-slate-500">{data.count} order · <span className="font-semibold text-slate-900">{formatMoney(data.revenue)}</span></span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100">
                    <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>Lunas: {formatMoney(data.lunas)}</span>
                    <span>Pending: {formatMoney(data.revenue - data.lunas)}</span>
                  </div>
                </div>
              );
            })}
            {byPlatform.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Tren Bulanan</h2>
            <p className="text-sm text-slate-500">{filter === "Semua" ? "Semua platform" : filter}.</p>
          </div>
          {byMonth.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada data.</p>
          ) : (
            <div className="flex items-end gap-2 h-48">
              {byMonth.map(([mk, data]) => {
                const pct = Math.round((data.revenue / maxMonthRevenue) * 100);
                const lunasPct = data.revenue > 0 ? Math.round((data.lunas / data.revenue) * 100) : 0;
                return (
                  <div key={mk} className="flex flex-1 flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-xl px-3 py-2 whitespace-nowrap z-10">
                      {monthLabel(mk)}: {formatMoney(data.revenue)}<br />Lunas: {lunasPct}%
                    </div>
                    <div className="w-full rounded-t-xl bg-gradient-to-t from-sky-500 to-violet-500" style={{ height: `${Math.max(pct, 3)}%`, minHeight: "4px" }} />
                    <span className="text-xs text-slate-400">{monthLabel(mk)?.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold">Rincian per Bulan</h2>
          <p className="text-sm text-slate-500">Tabel detail revenue, order, dan status bayar per bulan.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3 text-left">Bulan</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Gross Revenue</th>
                <th className="px-4 py-3 text-left">Sudah Lunas</th>
                <th className="px-4 py-3 text-left">Pending</th>
                <th className="px-4 py-3 text-left">% Lunas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...byMonth].reverse().map(([mk, data]) => (
                <tr key={mk} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{monthLabel(mk)}</td>
                  <td className="px-4 py-3">{data.count}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(data.revenue)}</td>
                  <td className="px-4 py-3 text-emerald-600">{formatMoney(data.lunas)}</td>
                  <td className="px-4 py-3 text-rose-600">{formatMoney(data.revenue - data.lunas)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${data.revenue > 0 ? Math.round((data.lunas / data.revenue) * 100) : 0}%` }} />
                      </div>
                      <span>{data.revenue > 0 ? Math.round((data.lunas / data.revenue) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {byMonth.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetCard({ label, value, sub, color }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`mb-3 inline-flex rounded-2xl bg-gradient-to-br ${color} p-2.5`}>
        <DollarSign size={18} className="text-white" />
      </div>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}
