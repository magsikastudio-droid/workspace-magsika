import React, { useMemo, useState } from "react";
import { MessageSquare, CalendarDays, Zap, ArrowUpRight, Activity, TrendingUp } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { fmtDate, monthKey, monthLabel } from "../lib/format";

export default function DailyChat() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const availableMonths = useMemo(
    () => [...new Set(orders.map((o) => monthKey(o.created_at)).filter(Boolean))].sort().reverse(),
    [orders]
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthlyOrders = useMemo(
    () => orders.filter((o) => monthKey(o.created_at) === selectedMonth),
    [orders, selectedMonth]
  );

  const summary = useMemo(() => {
    const inbox = monthlyOrders.length;
    const discussing = monthlyOrders.filter((o) => o.status === "Pending").length;
    const inProgress = monthlyOrders.filter((o) => o.status !== "Pending" && o.status !== "Done" && o.status !== "Cancel").length;
    const placed = monthlyOrders.filter((o) => o.status === "Done").length;
    const revenue = monthlyOrders.reduce((s, o) => s + (o.total || 0), 0);
    const conversionRate = inbox ? Math.round((placed / inbox) * 100) : 0;
    return { inbox, discussing, inProgress, placed, revenue, conversionRate };
  }, [monthlyOrders]);

  const prevMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [selectedMonth]);

  const prevMonthOrders = useMemo(
    () => orders.filter((o) => monthKey(o.created_at) === prevMonth),
    [orders, prevMonth]
  );

  const prevSummary = useMemo(() => {
    const inbox = prevMonthOrders.length;
    const placed = prevMonthOrders.filter((o) => o.status === "Done").length;
    const revenue = prevMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    return { inbox, placed, revenue, conversionRate: inbox ? Math.round((placed / inbox) * 100) : 0 };
  }, [prevMonthOrders]);

  const stages = [
    { label: "Total Order Masuk", value: summary.inbox, icon: CalendarDays, description: "Order diterima bulan ini" },
    { label: "Pending / Diskusi", value: summary.discussing, icon: Zap, description: "Belum mulai produksi" },
    { label: "In Progress", value: summary.inProgress, icon: ArrowUpRight, description: "Sedang diproduksi" },
    { label: "Done / Closed", value: summary.placed, icon: Activity, description: "Order selesai bulan ini" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <MessageSquare size={18} /> Daily Chat
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline & Tracking Order</h1>
          <p className="mt-2 text-sm text-slate-500">Monitor status diskusi, progress produksi, dan closing setiap bulan.</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
        >
          {availableMonths.length > 0
            ? availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)
            : <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stages.map((stage) => (
          <div key={stage.label} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <stage.icon size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stage.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{stage.value}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">{stage.description}</p>
          </div>
        ))}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Conversion</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.conversionRate}%</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">Done / total order</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold text-slate-900">Pipeline {monthLabel(selectedMonth)}</h2>
            <p className="text-sm text-slate-500">Daftar order yang masuk bulan ini.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Tgl Masuk</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Klien</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Bayar</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlyOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">{fmtDate(order.created_at)}</td>
                    <td className="px-4 py-4">{order.platform || "Direct"}</td>
                    <td className="px-4 py-4">{order.client}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{order.project}</td>
                    <td className="px-4 py-4">{order.total ? `$${order.total}` : "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.payment_status === "Lunas" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {order.payment_status || "Belum Lunas"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{order.status}</td>
                  </tr>
                ))}
                {monthlyOrders.length === 0 && (
                  <tr><td colSpan="7" className="py-8 text-center text-sm text-slate-500">Tidak ada order bulan {monthLabel(selectedMonth)}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold text-slate-900">Perbandingan Bulan Lalu</h2>
            <p className="text-sm text-slate-500">{monthLabel(prevMonth)}</p>
          </div>
          <div className="space-y-4">
            <CompareRow label="Order Masuk" curr={summary.inbox} prev={prevSummary.inbox} />
            <CompareRow label="Done" curr={summary.placed} prev={prevSummary.placed} />
            <CompareRow label="Conversion" curr={summary.conversionRate} prev={prevSummary.conversionRate} suffix="%" />
          </div>
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Revenue Bulan Ini</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(summary.revenue)}</p>
            {prevSummary.revenue > 0 && (
              <p className="mt-1 text-sm text-slate-500">
                vs {formatMoney(prevSummary.revenue)} bulan lalu
                <span className={`ml-2 font-semibold ${summary.revenue >= prevSummary.revenue ? "text-emerald-600" : "text-rose-600"}`}>
                  {summary.revenue >= prevSummary.revenue ? "▲" : "▼"}
                  {Math.abs(Math.round(((summary.revenue - prevSummary.revenue) / Math.max(prevSummary.revenue, 1)) * 100))}%
                </span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompareRow({ label, curr, prev, suffix = "" }) {
  const delta = curr - prev;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900">{curr}{suffix}</span>
        {prev > 0 && (
          <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta >= 0 ? "▲" : "▼"}{Math.abs(delta)}{suffix}
          </span>
        )}
      </div>
    </div>
  );
}
