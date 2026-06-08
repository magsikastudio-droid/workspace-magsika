import React, { useMemo, useRef, useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { FileText, Printer, CreditCard } from "lucide-react";

const BANK_INFO = {
  nama: "Ivo Febrian Pratama",
  bank: "BCA",
  rekening: "8030651287",
};

function invoiceNumber(order, idx) {
  const d = order.created_at ? new Date(order.created_at) : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const client = (order.client || "CLT").replace(/\s+/g, "").slice(0, 4).toUpperCase();
  return `INV-${yy}${mm}${dd}-${client}-${String(idx + 1).padStart(2, "0")}`;
}

export default function Invoice() {
  const { orders } = useOrders();
  const { formatMoney, currency } = useCurrency();
  const [selectedId, setSelectedId] = useState(null);
  const printRef = useRef(null);

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const unpaidOrders = orders.filter((o) => o.payment_status !== "Lunas");

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId),
    [orders, selectedId]
  );

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #0f172a; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .title { font-size: 28px; font-weight: 700; }
        .subtitle { color: #64748b; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f8fafc; text-align: left; padding: 10px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
        td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row { font-weight: 700; font-size: 16px; }
        .bank-box { background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 32px; }
        .bank-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .bank-box p { font-size: 13px; color: #475569; margin: 4px 0; }
        .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Invoice</h1>
          <p className="mt-2 text-sm text-slate-500">Buat dan cetak invoice berdasarkan order yang masuk.</p>
        </div>
        {selectedOrder && (
          <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Printer size={18} /> Cetak / Export PDF
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-3">
            <CreditCard size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Total Invoice</p>
          </div>
          <p className="text-4xl font-bold text-slate-900">{formatMoney(totalRevenue)}</p>
          <p className="mt-2 text-sm text-slate-500">Dari {orders.length} order</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-3">
            <FileText size={18} />
            <p className="text-sm uppercase tracking-[0.18em]">Belum Lunas</p>
          </div>
          <p className="text-4xl font-bold text-rose-600">{unpaidOrders.length}</p>
          <p className="mt-2 text-sm text-slate-500">Order perlu ditagih</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="font-semibold text-slate-900">Pilih Order untuk Invoice</p>
            <p className="text-sm text-slate-500">Klik order untuk preview invoice.</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {orders.map((order, idx) => (
              <button
                key={order.id}
                onClick={() => setSelectedId(order.id)}
                className={`w-full flex items-center justify-between px-6 py-4 text-left transition hover:bg-slate-50 ${selectedId === order.id ? "bg-slate-100" : ""}`}
              >
                <div>
                  <p className="font-semibold text-slate-900">{invoiceNumber(order, idx)}</p>
                  <p className="text-sm text-slate-500">{order.client} · {order.project}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatMoney(order.total)}</p>
                  <span className={`text-xs font-semibold ${order.payment_status === "Lunas" ? "text-emerald-600" : "text-rose-600"}`}>
                    {order.payment_status || "Belum Lunas"}
                  </span>
                </div>
              </button>
            ))}
            {orders.length === 0 && <p className="px-6 py-8 text-sm text-slate-500">Belum ada order.</p>}
          </div>
        </div>

        {selectedOrder ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Preview Invoice</p>
              <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                <Printer size={14} /> Print
              </button>
            </div>
            <div ref={printRef} className="p-8">
              <div className="header" style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
                <div>
                  <p className="text-2xl font-bold text-slate-900">Magsika Studio</p>
                  <p className="text-sm text-slate-500 mt-1">admin@magsikastudio.com</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900">INVOICE</p>
                  <p className="text-sm text-slate-500 mt-1">{invoiceNumber(selectedOrder, orders.indexOf(selectedOrder))}</p>
                  <p className="text-sm text-slate-500">{selectedOrder.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Kepada</p>
                  <p className="font-semibold text-slate-900">{selectedOrder.client}</p>
                  <p className="text-sm text-slate-500">{selectedOrder.platform}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Status</p>
                  <p className={`font-semibold ${selectedOrder.payment_status === "Lunas" ? "text-emerald-600" : "text-rose-600"}`}>
                    {selectedOrder.payment_status || "Belum Lunas"}
                  </p>
                  <p className="text-sm text-slate-500">Deadline: {selectedOrder.deadline || "-"}</p>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", color: "#64748b" }}>Deskripsi</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", color: "#64748b" }}>Jenis</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", color: "#64748b" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ fontWeight: 600 }}>{selectedOrder.project}</p>
                      {selectedOrder.folder_code && <p style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" }}>{selectedOrder.folder_code}</p>}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{selectedOrder.work_type}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>${selectedOrder.total}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2" style={{ padding: "16px", textAlign: "right", fontWeight: 700 }}>Total</td>
                    <td style={{ padding: "16px", textAlign: "right", fontWeight: 800, fontSize: "18px" }}>{formatMoney(selectedOrder.total)}</td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "20px", marginTop: "24px" }}>
                <p style={{ fontWeight: 600, marginBottom: "8px", fontSize: "14px" }}>Informasi Pembayaran</p>
                <p style={{ fontSize: "13px", color: "#475569", margin: "4px 0" }}>Bank: <strong>{BANK_INFO.bank}</strong></p>
                <p style={{ fontSize: "13px", color: "#475569", margin: "4px 0" }}>No. Rekening: <strong>{BANK_INFO.rekening}</strong></p>
                <p style={{ fontSize: "13px", color: "#475569", margin: "4px 0" }}>Atas Nama: <strong>{BANK_INFO.nama}</strong></p>
              </div>

              <p style={{ marginTop: "32px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                Terima kasih telah menggunakan jasa Magsika Studio · workspace.magsikastudio.com
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center">
            <div>
              <FileText size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">Pilih order dari daftar kiri untuk preview invoice.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
