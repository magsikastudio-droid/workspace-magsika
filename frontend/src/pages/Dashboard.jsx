import React, { useMemo } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { TrendingUp, CheckCircle2, Clock3, Layers, Users, Globe2, AlertTriangle } from "lucide-react";
import { MetricCard } from "../components/MetricCard";

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { formatMoney } = useCurrency();

  const totalOrders = orders.length;
  const completedOrders = orders.filter((order) => order.status === "done").length;
  const pendingOrders = orders.filter((order) => order.status !== "done").length;
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const freelanceFee = Math.round(revenue * 0.12);
  const unpaid = orders.filter((order) => order.payment_status !== "Lunas").reduce((sum, order) => sum + order.total, 0);
  const deadlineAlerts = orders.filter((order) => {
    if (!order.deadline) return false;
    const diff = Math.ceil((new Date(order.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 3;
  });

  const clientTotals = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      if (!order.client) return;
      map[order.client] = (map[order.client] || 0) + order.total;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([client, total]) => ({ client, total }));
  }, [orders]);

  const platformSummary = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      const platform = order.platform || "Direct";
      map[platform] = (map[platform] || 0) + 1;
    });
    const total = Object.values(map).reduce((sum, count) => sum + count, 0);
    return Object.entries(map).map(([platform, count]) => ({ platform, count, share: total ? Math.round((count / total) * 100) : 0 }));
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Ringkasan order dan pengingat deadline untuk tim Magsika Studio.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">Jun 2026 — skrg</div>
      </div>

      {deadlineAlerts.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-3 font-semibold text-amber-900">
            <AlertTriangle size={18} /> {deadlineAlerts.length} project mendekati deadline (≤ 3 hari): {deadlineAlerts.map((item) => item.project).join(", ")}.
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Layers} title="Total Project" value={totalOrders} subtitle={`${completedOrders} selesai · ${pendingOrders} aktif`} accent="from-indigo-500 to-violet-600" />
        <MetricCard icon={TrendingUp} title="Total Equity" value={formatMoney(revenue)} subtitle="Jun 2026" accent="from-sky-500 to-cyan-600" />
        <MetricCard icon={CheckCircle2} title="Done / Selesai" value={completedOrders} subtitle={`${Math.round((completedOrders / Math.max(totalOrders, 1)) * 100)}% completion`} accent="from-emerald-500 to-teal-600" />
        <MetricCard icon={Users} title="Fee Freelance" value={formatMoney(freelanceFee)} subtitle={`Est. ${Math.round((freelanceFee / Math.max(revenue, 1)) * 100)}% dari revenue`} accent="from-amber-500 to-orange-600" />
        <MetricCard icon={Clock3} title="Pending Payment" value={formatMoney(unpaid)} subtitle="Outstanding" accent="from-rose-500 to-pink-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Total per Klien</h2>
              <p className="text-sm text-slate-500">Pendapatan teratas per klien.</p>
            </div>
            <span className="text-sm text-slate-500">{clientTotals.length} klien</span>
          </div>
          <div className="mt-6 space-y-4">
            {clientTotals.map((item) => (
              <div key={item.client} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{item.client}</p>
                  <p className="text-xs text-slate-500">{orders.filter((order) => order.client === item.client).length} order</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatMoney(item.total)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Per Platform</h2>
              <p className="text-sm text-slate-500">Distribusi order berdasarkan platform.</p>
            </div>
            <span className="text-sm text-slate-500">{platformSummary.length} platform</span>
          </div>
          <div className="mt-6 grid gap-4">
            <div className="relative h-44 w-full rounded-full bg-slate-100">
              <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-slate-600">
                {platformSummary.reduce((sum, item) => sum + item.count, 0)} platforms
              </div>
            </div>
            <div className="space-y-3">
              {platformSummary.map((item) => (
                <div key={item.platform} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.platform}</p>
                    <p className="text-xs text-slate-500">{item.count} order</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{item.share}%</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
