import React, { useMemo } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { Activity, BarChart3, Star, Users, TrendingUp } from "lucide-react";
import { getArtistColor, WORK_TYPE_OPTIONS } from "../lib/constants";
import { monthKey, monthLabel } from "../lib/format";

export default function Performance() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const completed = orders.filter((o) => o.status === "Done");
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = orders.length ? Math.round(revenue / orders.length) : 0;
  const completionRate = orders.length ? Math.round((completed.length / orders.length) * 100) : 0;

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
      .map(([name, data]) => ({ name, ...data, rate: data.orders ? Math.round((data.done / data.orders) * 100) : 0 }));
  }, [orders]);

  const workTypeStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const wt = o.work_type || "Modeling";
      if (!map[wt]) map[wt] = { count: 0, revenue: 0, done: 0 };
      map[wt].count++;
      map[wt].revenue += (o.total || 0);
      if (o.status === "Done") map[wt].done++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [orders]);

  const monthlyStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const mk = monthKey(o.created_at);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, count: 0, done: 0 };
      map[mk].revenue += (o.total || 0);
      map[mk].count++;
      if (o.status === "Done") map[mk].done++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [orders]);

  const maxRevenue = Math.max(...monthlyStats.map(([, d]) => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Performance</h1>
        <p className="mt-2 text-sm text-slate-500">Analisa performa tim, jenis pekerjaan, dan tren keuangan.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <MetCard icon={Activity} label="Order Selesai" value={completed.length} sub="Total done" />
        <MetCard icon={BarChart3} label="Total Revenue" value={formatMoney(revenue)} sub="Semua order" />
        <MetCard icon={Star} label="Rata-rata Order" value={formatMoney(avgOrder)} sub="Per order" />
        <MetCard icon={TrendingUp} label="Completion Rate" value={`${completionRate}%`} sub="Done / total" />
      </div>

      {monthlyStats.length > 0 && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Tren Revenue Bulanan</h2>
            <p className="text-sm text-slate-500">6 bulan terakhir berdasarkan order masuk.</p>
          </div>
          <div className="flex items-end gap-3 h-40">
            {monthlyStats.map(([mk, data]) => {
              const pct = Math.round((data.revenue / maxRevenue) * 100);
              return (
                <div key={mk} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs text-slate-500 font-semibold">{formatMoney(data.revenue)}</span>
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-sky-500 to-violet-500 transition-all" style={{ height: `${Math.max(pct, 4)}%`, minHeight: "4px" }} />
                  <span className="text-xs text-slate-400">{monthLabel(mk)?.slice(0, 3)}</span>
                  <span className="text-xs text-slate-500">{data.count} order</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Per Artist</h2>
            <p className="text-sm text-slate-500">Performa berdasarkan artist yang mengerjakan.</p>
          </div>
          {artistStats.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada data artist.</p>
          ) : (
            <div className="space-y-4">
              {artistStats.map((a) => (
                <div key={a.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: getArtistColor(a.name) }}>
                      {a.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.orders} order · {a.done} selesai</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{a.rate}%</p>
                    <p className="text-xs text-slate-500">{formatMoney(a.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Per Jenis Pekerjaan</h2>
            <p className="text-sm text-slate-500">Volume dan revenue per work type.</p>
          </div>
          {workTypeStats.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada data.</p>
          ) : (
            <div className="space-y-3">
              {workTypeStats.map(([wt, data]) => {
                const totalCount = orders.length || 1;
                const pct = Math.round((data.count / totalCount) * 100);
                return (
                  <div key={wt}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{wt}</span>
                      <span className="text-slate-500">{data.count} order · {formatMoney(data.revenue)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-slate-500 mb-3">
        <Icon size={18} />
        <p className="text-sm uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}
