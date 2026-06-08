import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, CalendarDays, Zap, ArrowUpRight, Activity } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { fmtDate, monthKey, monthLabel } from "../lib/format";

export default function DailyChat() {
  const { orders } = useOrders();
  const availableMonths = useMemo(
    () => [...new Set(orders.map((order) => monthKey(order.created_at)).filter(Boolean))].sort().reverse(),
    [orders]
  );
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || monthKey(new Date()));

  useEffect(() => {
    if (!selectedMonth && availableMonths.length) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const monthlyOrders = useMemo(
    () => orders.filter((order) => monthKey(order.created_at) === selectedMonth),
    [orders, selectedMonth]
  );

  const summary = useMemo(() => {
    const inbox = monthlyOrders.length;
    const discussing = monthlyOrders.filter((order) => order.status === "pending").length;
    const followUp = monthlyOrders.filter((order) => order.status === "in progress").length;
    const placed = monthlyOrders.filter((order) => order.status === "done").length;
    const conversionRate = inbox ? Math.round((placed / inbox) * 100) : 0;
    return { inbox, discussing, followUp, placed, conversionRate };
  }, [monthlyOrders]);

  const stages = [
    { label: "Inbox", value: summary.inbox, icon: CalendarDays, description: "Minggu ini" },
    { label: "Discussing", value: summary.discussing, icon: Zap, description: "Aktif" },
    { label: "Follow Up / Nego", value: summary.followUp, icon: ArrowUpRight, description: "Perlu tindak lanjut" },
    { label: "Place Order", value: summary.placed, icon: Activity, description: "Closing minggu ini" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <MessageSquare size={18} /> Daily Chat
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Tracking inbox & pipeline client</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola status diskusi, follow up, dan order baru setiap minggu.</p>
        </div>
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
          <CalendarDays size={16} /> {monthLabel(selectedMonth)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.label} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <stage.icon size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stage.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stage.value}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">{stage.description}</p>
          </div>
        ))}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Conversion Rate</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{summary.conversionRate}%</p>
          <p className="mt-2 text-sm text-slate-500">Closing / total</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Pipeline client</h2>
              <p className="text-sm text-slate-500">Ringkasan order berdasarkan status utamanya.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <button onClick={() => setSelectedMonth(monthKey(new Date()))} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 hover:bg-slate-100">
                Minggu ini
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Tgl</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Estimasi</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Agreed</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlyOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">{fmtDate(order.created_at)}</td>
                    <td className="px-4 py-4">{order.market || "Direct"}</td>
                    <td className="px-4 py-4">{order.client}</td>
                    <td className="px-4 py-4">{order.work_type || "Modeling"}</td>
                    <td className="px-4 py-4">{order.total ? `$${order.total}` : "-"}</td>
                    <td className="px-4 py-4">{order.payment_status === "Lunas" ? "Yes" : "No"}</td>
                    <td className="px-4 py-4">{order.status}</td>
                  </tr>
                ))}
                {monthlyOrders.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-sm text-slate-500">
                      Tidak ada data untuk minggu ini. Tambah client untuk memulai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Ringkasan minggu sebelumnya</h2>
              <p className="text-sm text-slate-500">Statistik periode sebelumnya untuk perbandingan.</p>
            </div>
          </div>
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">MG {4 - index} · {monthLabel(selectedMonth)}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{Math.round(20 + index * 5)}%</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                  <div>Inbox: {Math.max(0, 5 - index)}</div>
                  <div>Closing: {Math.max(0, 2 - index)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
