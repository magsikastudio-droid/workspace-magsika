import React from "react";
import { MetricCard } from "./MetricCard";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { TrendingUp, CheckCircle2, Clock3 } from "lucide-react";

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { formatMoney } = useCurrency();

  const totalOrders = orders.length;
  const completedOrders = orders.filter((order) => order.status === "done").length;
  const pendingOrders = orders.filter((order) => order.status !== "done").length;
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Ringkasan performa dan order terbaru.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          title="Total Order"
          value={totalOrders}
          subtitle={`${completedOrders} selesai · ${pendingOrders} aktif`}
          accent="from-sky-500 to-indigo-600"
        />
        <MetricCard
          icon={CheckCircle2}
          title="Selesai"
          value={completedOrders}
          subtitle="Order selesai bulan ini"
          accent="from-emerald-500 to-teal-600"
        />
        <MetricCard
          icon={Clock3}
          title="Pending"
          value={pendingOrders}
          subtitle="Order menunggu proses"
          accent="from-amber-500 to-orange-600"
        />
        <MetricCard
          icon={TrendingUp}
          title="Revenue"
          value={formatMoney(revenue)}
          subtitle="Pendapatan proyeksi"
          accent="from-violet-500 to-fuchsia-600"
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold">Order aktif</h2>
            <p className="text-sm text-slate-500">Lihat daftar order mock dengan status saat ini.</p>
          </div>
          <span className="text-sm text-slate-500">{loading ? "Memuat..." : `${orders.length} order`}</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Klien</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {orders.slice(0, 6).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-4 font-medium">{order.project}</td>
                  <td className="px-3 py-4">{order.client}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-4">{formatMoney(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="py-10 text-center text-slate-500">Belum ada order mock.</div>}
        </div>
      </section>
    </div>
  );
}
