import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { FileText, Printer, Search, X } from "lucide-react";
import { api } from "../lib/api";

function buildInvoiceNumber(orders, selectedIds) {
  if (!selectedIds.length) return "";
  const first = orders.find((o) => o.id === selectedIds[0]);
  if (!first) return "";
  const d = first.order_date ? new Date(first.order_date + "T00:00:00") : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const client = (first.client || "CLT").replace(/\s+/g, "").slice(0, 6).toUpperCase();
  return `${yy}${mm}${dd}-${client}-INV-${String(selectedIds.length).padStart(1, "0")}`;
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getFullYear()).slice(2)}`;
}

export default function Invoice() {
  const { orders } = useOrders();
  const { formatMoney, currency, exchangeRate } = useCurrency();
  const printRef = useRef(null);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("Semua Klien");
  const [monthFilter, setMonthFilter] = useState("Semua Bulan");
  const [bankInfo, setBankInfo] = useState({ nama: "", bank: "", rekening: "" });
  const [invoicePayMode, setInvoicePayMode] = useState("auto"); // "auto" | "lunas" | "dp"
  const [dpInput, setDpInput] = useState("");

  useEffect(() => {
    api.get("/settings/bank-info").then((res) => {
      const d = res.data;
      setBankInfo({ nama: d.nama || "", bank: d.bank || "", rekening: d.rekening || "" });
    }).catch(() => {});
  }, []);

  /* ─── filter list ─── */
  const allClients = useMemo(() => [...new Set(orders.map((o) => o.client).filter(Boolean))].sort(), [orders]);
  const allMonths = useMemo(() => {
    const months = [...new Set(orders.map((o) => (o.order_date || o.created_at || "")?.slice(0, 7)).filter(Boolean))].sort().reverse();
    return months;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (search) {
        const q = search.toLowerCase();
        if (![o.project, o.client, o.folder_code, o.order_id].some((v) => v?.toLowerCase().includes(q))) return false;
      }
      if (clientFilter !== "Semua Klien" && o.client !== clientFilter) return false;
      if (monthFilter !== "Semua Bulan") {
        const orderMonth = (o.order_date || o.created_at || "")?.slice(0, 7);
        if (orderMonth !== monthFilter) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.order_date || b.created_at || 0) - new Date(a.order_date || a.created_at || 0));
  }, [orders, search, clientFilter, monthFilter]);

  const selectedOrders = useMemo(() => orders.filter((o) => selected.includes(o.id)), [orders, selected]);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const selectAll = () => setSelected(filteredOrders.map((o) => o.id));
  const clearAll = () => setSelected([]);

  const invoiceNum = buildInvoiceNumber(orders, selected);
  const totalTagihan = selectedOrders.reduce((s, o) => s + (o.total || 0), 0);
  const sudahDibayarAuto = selectedOrders.filter((o) => o.payment_status === "Lunas").reduce((s, o) => s + (o.total || 0), 0);
  const dpInUsd = currency === "IDR" ? (Number(dpInput) || 0) / exchangeRate : (Number(dpInput) || 0);
  const sudahDibayar = invoicePayMode === "auto" ? sudahDibayarAuto
    : invoicePayMode === "lunas" ? totalTagihan
    : dpInUsd;
  const sisaTagihan = Math.max(0, totalTagihan - sudahDibayar);
  const invoiceDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });

  /* ─── print ─── */
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=1100,height=700");
    win.document.write(`
      <html><head><title>Invoice ${invoiceNum}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: white; color: #0f172a; padding: 40px 48px; }
        @page { size: A4 landscape; margin: 20mm 20mm 20mm 20mm; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generate Invoice</h1>
            <p className="text-sm text-slate-500">Pilih project untuk invoice — per project atau gabungan.</p>
          </div>
        </div>
        {selected.length > 0 && (
          <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 shadow-sm">
            <Printer size={15} /> Print / Save PDF
          </button>
        )}
      </div>

      {/* Order picker */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* search bar */}
        <div className="relative border-b border-slate-100">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari project, klien, kode folder..."
            className="w-full py-3 pl-10 pr-4 text-sm text-slate-700 outline-none"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>

        {/* order list */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
          {filteredOrders.map((order) => {
            const checked = selected.includes(order.id);
            return (
              <label key={order.id} className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition ${checked ? "bg-indigo-50/60" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{order.project}</p>
                  <p className="text-xs text-slate-400">{order.client} · <span className="font-mono">{order.folder_code || order.order_id || "—"}</span> · {fmtDate(order.order_date || order.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">{formatMoney(order.total)}</p>
                  <span className={`text-xs font-semibold ${order.payment_status === "Lunas" ? "text-emerald-600" : "text-rose-500"}`}>
                    {order.payment_status || "Belum Lunas"}
                  </span>
                </div>
              </label>
            );
          })}
          {filteredOrders.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">Tidak ada order.</p>}
        </div>

        {/* filter toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3">
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none">
            <option>Semua Klien</option>
            {allClients.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none">
            <option>Semua Bulan</option>
            {allMonths.map((m) => <option key={m}>{m}</option>)}
          </select>
          <button onClick={selectAll} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Pilih semua ({filteredOrders.length})
          </button>
          {selected.length > 0 && (
            <button onClick={clearAll} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50">
              Clear ({selected.length})
            </button>
          )}
          {selected.length > 0 && (
            <button onClick={handlePrint} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700">
              <Printer size={13} /> Print / Save PDF
            </button>
          )}
        </div>
      </div>

      {/* Payment settings */}
      {selected.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pengaturan Pembayaran Invoice</p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
              {[
                { key: "auto", label: "Otomatis" },
                { key: "lunas", label: "Lunas" },
                { key: "dp", label: "DP Sebagian" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setInvoicePayMode(m.key)}
                  className={`px-4 py-2 transition ${invoicePayMode === m.key ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {invoicePayMode === "dp" && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Jumlah DP</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {currency === "IDR" ? "Rp" : "$"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={dpInput}
                    onChange={(e) => setDpInput(e.target.value)}
                    placeholder="0"
                    className="w-44 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-violet-400 focus:bg-white"
                  />
                </div>
                {dpInUsd > 0 && (
                  <span className="text-xs text-slate-400">
                    {currency === "IDR" ? `≈ $${dpInUsd.toFixed(2)}` : `= Rp${Math.round(dpInUsd * exchangeRate).toLocaleString("id-ID")}`}
                  </span>
                )}
              </div>
            )}
            {invoicePayMode === "lunas" && (
              <p className="text-xs text-emerald-600 font-semibold">✓ Invoice ditandai Lunas Penuh</p>
            )}
            {invoicePayMode === "auto" && (
              <p className="text-xs text-slate-400">Status diambil dari data payment_status tiap order</p>
            )}
          </div>
        </div>
      )}

      {/* Invoice preview */}
      {selected.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div ref={printRef} className="p-8" style={{ fontFamily: "'Segoe UI', sans-serif", color: "#0f172a" }}>
            {/* Top: company + invoice number */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
              <div>
                <p style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>
                  Magsika <span style={{ color: "#7c3aed" }}>Studio</span>
                </p>
                <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>3D Production Studio · magsikastudio.com</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>INVOICE</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#7c3aed", marginTop: "2px" }}>{invoiceNum}</p>
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>{invoiceDate}</p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "#e2e8f0", marginBottom: "24px" }} />

            {/* Client info + count */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div>
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: "#94a3b8", marginBottom: "6px" }}>Ditagihkan Kepada</p>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{selectedOrders[0]?.client || "—"}</p>
                <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{selectedOrders[0]?.platform || ""}</p>
              </div>
              <div>
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: "#94a3b8", marginBottom: "6px" }}>Jumlah Item</p>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{selectedOrders.length} project</p>
              </div>
            </div>

            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  {["Tanggal", "Project", "Folder", "Value", "Status"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Value" ? "right" : "left", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#7c3aed", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontSize: "13px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(o.order_date || o.created_at)}</td>
                    <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{o.project}</td>
                    <td style={{ padding: "10px 12px", fontSize: "11px", fontFamily: "monospace", color: "#94a3b8" }}>{o.folder_code || o.order_id || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: 700, color: "#0f172a", textAlign: "right" }}>
                      {currency === "USD" ? `$${o.total}` : `Rp${((o.total || 0) * exchangeRate).toLocaleString("id-ID")}`}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: o.payment_status === "Lunas" ? "#dcfce7" : o.payment_status === "DP" ? "#fef9c3" : "#fee2e2", color: o.payment_status === "Lunas" ? "#166534" : o.payment_status === "DP" ? "#a16207" : "#b91c1c" }}>
                        {o.payment_status || "Belum Lunas"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
              <div style={{ minWidth: "260px" }}>
                {(invoicePayMode === "lunas"
                  ? [
                      { label: "Total Tagihan", value: formatMoney(totalTagihan), bold: false },
                      { label: "Lunas", value: formatMoney(totalTagihan), bold: false, green: true },
                      { label: "Sisa Tagihan", value: formatMoney(0), bold: true },
                    ]
                  : invoicePayMode === "dp" && sudahDibayar > 0
                  ? [
                      { label: "Total Tagihan", value: formatMoney(totalTagihan), bold: false },
                      { label: "DP Diterima", value: formatMoney(sudahDibayar), bold: false, green: true },
                      { label: "Sisa Tagihan", value: formatMoney(sisaTagihan), bold: true },
                    ]
                  : [
                      { label: "Total Tagihan", value: formatMoney(totalTagihan), bold: false },
                      { label: "Sudah Dibayar", value: formatMoney(sudahDibayar), bold: false },
                      { label: "Sisa Tagihan", value: formatMoney(sisaTagihan), bold: true },
                    ]
                ).map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: row.bold ? "2px solid #e2e8f0" : "none", marginTop: row.bold ? "4px" : 0 }}>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>{row.label}</span>
                    <span style={{ fontSize: row.bold ? "16px" : "13px", fontWeight: row.bold ? 800 : 600, color: row.green ? "#16a34a" : row.bold && sisaTagihan > 0 ? "#dc2626" : row.bold ? "#16a34a" : "#0f172a" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment info */}
            <div style={{ display: "flex", gap: "16px", background: "#f8fafc", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "10px", background: "#e0e7ff", flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#6366f1" strokeWidth="2"/><path d="M2 10h20" stroke="#6366f1" strokeWidth="2"/></svg>
              </div>
              <div>
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: "#94a3b8", marginBottom: "8px" }}>Pembayaran Ditransfer Ke</p>
                <div style={{ display: "flex", gap: "40px" }}>
                  <div><p style={{ fontSize: "11px", color: "#94a3b8" }}>BANK</p><p style={{ fontSize: "14px", fontWeight: 700 }}>{bankInfo.bank}</p></div>
                  <div><p style={{ fontSize: "11px", color: "#94a3b8" }}>NO. REKENING</p><p style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}>{bankInfo.rekening}</p></div>
                  <div><p style={{ fontSize: "11px", color: "#94a3b8" }}>ATAS NAMA</p><p style={{ fontSize: "14px", fontWeight: 700 }}>{bankInfo.nama}</p></div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
              Terima kasih atas kepercayaan Anda. — Magsika Studio Team
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
          Pilih order dari daftar atas untuk preview invoice.
        </div>
      )}
    </div>
  );
}
