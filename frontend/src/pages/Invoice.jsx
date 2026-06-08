import React from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { FileText, CreditCard, Users } from "lucide-react";

export default function Invoice() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const nextInvoice = orders.find((order) => order.status !== "done");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Invoice</h1>
          <p className="mt-2 text-sm text-slate-500">Buat dan tinjau invoice berdasarkan order yang masuk.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          <FileText size={18} /> Export PDF
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <CreditCard size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Total invoice</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-slate-900">{formatMoney(totalRevenue)}</p>
          <p className="mt-2 text-sm text-slate-500">Pendapatan dari order aktif dan selesai.</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Users size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Order outstanding</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-slate-900">{orders.filter((order) => order.status !== "done").length}</p>
          <p className="mt-2 text-sm text-slate-500">Order belum selesai ditagihkan.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-slate-900">Daftar Invoice</p>
          <p className="text-sm text-slate-500">Order dapat dijadikan invoice dengan mudah.</p>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900">INV-{order.id.slice(-3).toUpperCase()}</td>
                  <td className="px-4 py-4">{order.client}</td>
                  <td className="px-4 py-4">{formatMoney(order.total)}</td>
                  <td className="px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="py-8 text-center text-slate-500">Belum ada invoice yang ditampilkan.</div>}
        </div>
      </div>

      {nextInvoice && (
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-slate-700 shadow-sm">
          <h2 className="text-xl font-semibold">Next invoice ready</h2>
          <p className="mt-2 text-sm">Buat invoice untuk <span className="font-semibold">{nextInvoice.client}</span> pada project <span className="font-semibold">{nextInvoice.project}</span>.</p>
        </div>
      )}
    </div>
  );
}
