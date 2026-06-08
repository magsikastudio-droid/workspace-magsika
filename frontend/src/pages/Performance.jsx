import React, { useMemo } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { Activity, BarChart3, Star } from "lucide-react";

export default function Performance() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const completed = orders.filter((order) => order.status === "done");
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const avgOrder = orders.length ? Math.round(revenue / orders.length) : 0;

  const timeline = useMemo(
    () => [
      { label: "Selesai", value: completed.length },
      { label: "Pending", value: orders.filter((order) => order.status !== "done").length },
      { label: "Total", value: orders.length },
    ],
    [orders, completed.length]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Performance</h1>
          <p className="mt-2 text-sm text-slate-500">Analisa performa tim dan keuangan order.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Activity size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Kecepatan tim</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-slate-900">{completed.length}</p>
          <p className="mt-2 text-sm text-slate-500">Order selesai sebagai indikator kecepatan tim.</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <BarChart3 size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Pendapatan</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-slate-900">{formatMoney(revenue)}</p>
          <p className="mt-2 text-sm text-slate-500">Total pendapatan dari seluruh order.</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Star size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Rata-rata order</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-slate-900">{formatMoney(avgOrder)}</p>
          <p className="mt-2 text-sm text-slate-500">Rata-rata nilai order saat ini.</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Ringkasan performa</h2>
            <p className="text-sm text-slate-500">Lihat metrik order dan output tim.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {timeline.map((item) => (
            <div key={item.label} className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
