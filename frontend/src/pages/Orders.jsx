import React, { useRef, useMemo, useState, useEffect } from "react";
import { Plus, Search, Edit3, Trash2, Upload, Download, Columns, FolderOpen, User, Flame, Info, UserPlus, X, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import {
  STATUS_OPTIONS, STATUS_COLORS,
  PLATFORM_OPTIONS, PAYMENT_OPTIONS, PAYMENT_COLORS,
  WORK_TYPE_OPTIONS, MARKET_OPTIONS, MARKETER_OPTIONS,
  generateFolderCode, normalizeStatus,
} from "../lib/constants";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { values.push(cur); cur = ""; }
      else cur += ch;
    }
    values.push(cur);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || "").replace(/"/g, "").trim(); });
    return row;
  }).filter((r) => r.project || r.nama_project || r.project_name);
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyOrder = () => ({
  project: "", client: "", total: "", deadline: todayStr(),
  order_date: todayStr(),
  status: "Pending", artists: "", platform: "Fiverr Magsika",
  market: "Magsika", order_id: "", work_type: "Modeling",
  payment_status: "Belum Lunas", folder_code: "", marketer: "Ivo", notes: "",
  fee_freelance: 0,
  artist_contributions: [{ name: "", type: "Tim", percent: 100 }],
});

export default function OrdersPage() {
  const { orders, loading, createOrder, updateOrder, deleteOrder } = useOrders();
  const ordersOnDay = (date) => orders.filter((o) => (o.order_date || o.created_at?.slice(0, 10)) === date).length;
  const { formatMoney } = useCurrency();
  const _today = new Date();
  const _currentMonth = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, "0")}`;

  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [paymentFilter, setPaymentFilter] = useState("Semua");
  const [monthFilter, setMonthFilter] = useState(_currentMonth);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newOrder, setNewOrder] = useState(emptyOrder());
  const [compactMode, setCompactMode] = useState(true);
  const fileInputRef = useRef(null);

  const availableMonths = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => {
      const d = o.order_date || o.created_at?.slice(0, 10);
      if (d) set.add(d.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [orders]);

  const visibleOrders = useMemo(() =>
    orders
      .filter((o) => {
        const d = o.order_date || o.created_at?.slice(0, 10) || "";
        if (monthFilter !== "Semua") {
          const inMonth = d.startsWith(monthFilter);
          const st = normalizeStatus(o.status);
          const isActive = st !== "Done" && st !== "Cancel";
          const isOverdue = isActive && o.deadline && o.deadline < todayStr();
          if (!inMonth && !isOverdue) return false;
        }
        if (search && ![o.project, o.client, o.status, o.platform, o.folder_code].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) return false;
        if (platformFilter !== "Semua" && o.platform !== platformFilter) return false;
        if (statusFilter !== "Semua" && o.status !== statusFilter) return false;
        if (paymentFilter !== "Semua" && o.payment_status !== paymentFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const aDone = normalizeStatus(a.status) === "Done" || normalizeStatus(a.status) === "Cancel";
        const bDone = normalizeStatus(b.status) === "Done" || normalizeStatus(b.status) === "Cancel";
        // Done/Cancel ke bawah
        if (aDone !== bDone) return aDone ? 1 : -1;
        // Aktif: urutkan deadline terkecil (paling urgent) di atas; null/kosong paling bawah
        if (!aDone && !bDone) {
          const aT = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bT = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return aT - bT;
        }
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }),
    [orders, search, platformFilter, statusFilter, paymentFilter, monthFilter]
  );

  const handleExportCSV = () => {
    const headers = ["project","client","total","status","deadline","order_date","platform","order_id","work_type","payment_status","folder_code","marketer","notes","fee_freelance","artists"];
    const rows = visibleOrders.map((o) => [
      o.project, o.client, o.total, o.status, o.deadline || "", o.order_date || "",
      o.platform, o.order_id || "", o.work_type || "", o.payment_status,
      o.folder_code || "", o.marketer || "",
      (o.notes || "").replace(/\n/g, " "), o.fee_freelance || 0,
      (o.artists || []).join(";"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${monthFilter === "Semua" ? "all" : monthFilter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSVText(ev.target.result);
      if (!rows.length) { toast.error("CSV kosong atau format tidak dikenali"); return; }
      setImportRows(rows);
      setShowImport(true);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    let ok = 0, fail = 0;
    for (const row of importRows) {
      try {
        const project = row.project || row.nama_project || row.project_name || "";
        const client  = row.client  || row.klien  || row.nama_klien || "";
        const total   = parseFloat(row.total || row.nilai || row.value || 0) || 0;
        const artists = (row.artists || row.artist || "").split(";").map((a) => a.trim()).filter(Boolean);
        await createOrder({
          project, client, total,
          status:         row.status || "Pending",
          deadline:       row.deadline || row.batas_waktu || "",
          order_date:     row.order_date || row.tanggal || todayStr(),
          platform:       row.platform || "Direct",
          order_id:       row.order_id || row.id_order || "",
          work_type:      row.work_type || row.jenis_pekerjaan || "Modeling",
          payment_status: row.payment_status || row.pembayaran || "Belum Lunas",
          folder_code:    row.folder_code || row.kode_folder || "",
          marketer:       row.marketer || "Ivo",
          notes:          row.notes || row.catatan || "",
          fee_freelance:  parseFloat(row.fee_freelance || row.fee || 0) || 0,
          artists,
          artist_contributions: artists.map((a) => ({ name: a, type: "Tim", percent: Math.round(100 / artists.length) })),
          market: row.market || "Magsika",
        });
        ok++;
      } catch { fail++; }
    }
    setShowImport(false);
    setImportRows([]);
    toast.success(`Import selesai: ${ok} berhasil${fail ? `, ${fail} gagal` : ""}`);
  };

  const handleCreateSubmit = async (form) => {
    const contributions = (form.artist_contributions || []).filter((c) => c.name.trim());
    const artistNames = contributions.map((c) => c.name.trim());
    const folderCode = form.folder_code || generateFolderCode(
      form.platform, form.market,
      artistNames[0] || form.artists?.split(",")[0]?.trim(), form.work_type, new Date()
    );
    await createOrder({
      ...form,
      total: Number(form.total),
      artists: artistNames.length ? artistNames : form.artists.split(",").map((a) => a.trim()).filter(Boolean),
      folder_code: folderCode,
      artist_contributions: contributions,
      fee_freelance: Number(form.fee_freelance) || 0,
    });
    setShowCreate(false);
    setNewOrder(emptyOrder());
  };

  const handleSaveOrder = async (updated) => {
    const contributions = (updated.artist_contributions || []).filter((c) => c.name.trim());
    const artistNames = contributions.map((c) => c.name.trim());
    await updateOrder(activeOrder.id, {
      ...updated,
      total: Number(updated.total),
      artists: artistNames.length ? artistNames : (updated.artists || "").split(",").map((a) => a.trim()).filter(Boolean),
      artist_contributions: contributions,
      fee_freelance: Number(updated.fee_freelance) || 0,
    });
    setActiveOrder(null);
  };

  const handleDelete = async (id) => {
    await deleteOrder(id);
    setConfirmDelete(null);
  };

  const handleInlineUpdate = async (orderId, field, value) => {
    try { await updateOrder(orderId, { [field]: value }); } catch { toast.error("Gagal update"); }
  };

  const deadlineClass = (deadline) => {
    if (!deadline) return "";
    const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (diff < 0) return "text-rose-600 font-semibold";
    if (diff <= 3) return "text-amber-600 font-semibold";
    return "";
  };

  const totalOrders = visibleOrders.length;
  const activeCount = visibleOrders.filter((o) => normalizeStatus(o.status) !== "Done" && normalizeStatus(o.status) !== "Cancel").length;
  const doneCount = visibleOrders.filter((o) => normalizeStatus(o.status) === "Done").length;
  const cancelCount = visibleOrders.filter((o) => normalizeStatus(o.status) === "Cancel").length;

  const weeklyGroups = useMemo(() => {
    const getMondayStr = (dateStr) => {
      if (!dateStr) return "0000-00-00";
      const d = new Date(dateStr + "T00:00:00");
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    };
    const getSundayStr = (mondayStr) => {
      if (mondayStr === "0000-00-00") return "0000-00-00";
      const d = new Date(mondayStr + "T00:00:00");
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    };
    const groups = {};
    visibleOrders.forEach((o) => {
      const date = o.order_date || o.created_at?.slice(0, 10);
      const mon = getMondayStr(date);
      if (!groups[mon]) groups[mon] = { monday: mon, sunday: getSundayStr(mon), orders: [] };
      groups[mon].orders.push(o);
    });
    return Object.values(groups).sort((a, b) => b.monday.localeCompare(a.monday));
  }, [visibleOrders]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders List</h1>
          <p className="mt-0.5 text-sm text-slate-500">Kelola semua order produksi 3D studio.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={handleExportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">
            <Plus size={15} /> Tambah Order
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Orders",    value: totalOrders,  sub: "Total semua order",     accent: "border-l-violet-500" },
          { label: "Active Orders",   value: activeCount,  sub: "Sedang diproduksi",     accent: "border-l-sky-500"    },
          { label: "Completed",       value: doneCount,    sub: "Order selesai",          accent: "border-l-emerald-500"},
          { label: "Cancelled",       value: cancelCount,  sub: "Order dibatalkan",       accent: "border-l-rose-400"  },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border-l-4 border border-slate-200 bg-white px-5 py-4 shadow-sm ${c.accent}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari project, klien, order ID..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white" />
          </div>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300">
            <option value="Semua">All Platform</option>
            {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300">
            <option value="Semua">All Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300">
            <option value="Semua">All Payment</option>
            {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300">
            <option value="Semua">Semua Bulan</option>
            {availableMonths.map((m) => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{MONTH_NAMES[parseInt(mo) - 1]} {y}</option>;
            })}
          </select>
          <button
            onClick={() => setCompactMode((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Columns size={13} /> {compactMode ? "Full" : "Compact"}
          </button>
          <span className="text-xs font-semibold text-slate-400">{loading ? "..." : `${visibleOrders.length} order`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Kode Folder</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Talent</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-slate-400">Tidak ada order yang cocok.</td></tr>
              )}
              {weeklyGroups.map(({ monday, sunday, orders: weekOrders }) => {
                const fmtD = (s) => s === "0000-00-00" ? "—" : new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                const activeW = weekOrders.filter((o) => normalizeStatus(o.status) !== "Done" && normalizeStatus(o.status) !== "Cancel").length;
                const totalVal = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
                return (
                  <React.Fragment key={monday}>
                    {/* Week header row */}
                    <tr className="bg-violet-50 border-t-2 border-violet-100">
                      <td colSpan={9} className="px-4 py-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-bold text-violet-700">
                            {monday === "0000-00-00" ? "Tanpa Tanggal" : `${fmtD(monday)} – ${fmtD(sunday)}`}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">
                            {weekOrders.length} order
                          </span>
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                            {activeW} aktif
                          </span>
                          {totalVal > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">${totalVal.toFixed(0)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Order rows for this week */}
                    {weekOrders.map((order) => {
                      const sc = STATUS_COLORS[normalizeStatus(order.status)] || { bg: "#f1f5f9", text: "#64748b" };
                      const isDone = normalizeStatus(order.status) === "Done" || normalizeStatus(order.status) === "Cancel";
                      const deadlineDiff = order.deadline ? Math.ceil((new Date(order.deadline) - new Date()) / 86400000) : null;
                      return (
                        <tr key={order.id} className={`hover:bg-slate-50 transition border-b border-slate-50 ${isDone ? "opacity-60" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="max-w-[160px] truncate font-semibold text-slate-900">{order.project}</p>
                              <p className="text-xs text-slate-400">{order.work_type || "Modeling"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-800">{order.client}</p>
                            {!compactMode && <p className="text-xs text-slate-400">{order.platform || "Direct"}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-indigo-600">{order.folder_code || "—"}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 whitespace-nowrap">{formatMoney(order.total)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const contribs = order.artist_contributions?.length
                                  ? order.artist_contributions
                                  : (order.artists || []).map((a) => ({ name: a, type: "Tim" }));
                                return contribs.slice(0, 3).map((c, i) => (
                                  <span key={i} className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${c.type === "Freelance" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                    {c.name}
                                    <span className="text-[9px] opacity-60">{c.type === "Freelance" ? "·FL" : "·TM"}</span>
                                  </span>
                                ));
                              })()}
                              {(() => {
                                const n = order.artist_contributions?.length || order.artists?.length || 0;
                                return n > 3 ? <span className="text-[10px] text-slate-400">+{n - 3}</span> : null;
                              })()}
                              {(!order.artists?.length && !order.artist_contributions?.length) && <span className="text-xs text-slate-300">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {!isDone && deadlineDiff !== null && deadlineDiff < 0 && <span title="Overdue" className="text-rose-500">⚠</span>}
                              {!isDone && deadlineDiff !== null && deadlineDiff >= 0 && deadlineDiff <= 3 && <span title={`${deadlineDiff} hari lagi`} className="text-amber-500">🔥</span>}
                              <span className={`text-sm ${deadlineDiff !== null && deadlineDiff < 0 ? "text-rose-600 font-semibold" : deadlineDiff !== null && deadlineDiff <= 3 ? "text-amber-600 font-semibold" : "text-slate-600"}`}>
                                {order.deadline || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={normalizeStatus(order.status)}
                              onChange={(e) => handleInlineUpdate(order.id, "status", e.target.value)}
                              className="rounded-lg border-0 px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <PaymentSelect orderId={order.id} value={order.payment_status} onUpdate={handleInlineUpdate} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setActiveOrder({ ...order, artists: (order.artists || []).join(", ") })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                                Details
                              </button>
                              <button onClick={() => setConfirmDelete(order)} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <OrderFormModal
          title="Tambah Order Baru"
          initial={newOrder}
          ordersOnDay={ordersOnDay}
          onClose={() => { setShowCreate(false); setNewOrder(emptyOrder()); }}
          onSave={handleCreateSubmit}
        />
      )}

      {activeOrder && (
        <OrderDrawer
          order={activeOrder}
          ordersOnDay={ordersOnDay}
          onClose={() => setActiveOrder(null)}
          onSave={handleSaveOrder}
          onDelete={(id) => { setConfirmDelete(activeOrder); setActiveOrder(null); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Hapus Order?</h2>
            <p className="mt-2 text-sm text-slate-500">Order <span className="font-semibold text-slate-800">{confirmDelete.project}</span> akan dihapus permanen dan tidak bisa dikembalikan.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportCSVModal
          rows={importRows}
          onClose={() => { setShowImport(false); setImportRows([]); }}
          onImport={handleImport}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}

function fmtSec(s) {
  if (!s || s <= 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}
const AVATAR_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
const artistColor = (name) => AVATAR_COLORS[Math.abs((name||"").split("").reduce((h,c)=>c.charCodeAt(0)+((h<<5)-h),0)) % AVATAR_COLORS.length];

function OrderDrawer({ order, ordersOnDay, onClose, onSave, onDelete }) {
  const { exchangeRate, formatMoney } = useCurrency();
  const { updateOrder } = useOrders();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...order,
    artist_contributions: order.artist_contributions?.length
      ? order.artist_contributions
      : [{ name: (order.artists || [])[0] || "", type: "Tim", percent: 100 }],
  });
  const [manualFolder, setManualFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicContribs, setDynamicContribs] = useState(null);
  const [totalCurrency, setTotalCurrency] = useState("USD");

  useEffect(() => {
    if (!order.id) return;
    api.get("/tasks/contributions", { params: { order_id: order.id } })
      .then((r) => {
        const contribs = r.data.contributions || [];
        if (contribs.length === 0) return;
        setDynamicContribs(r.data);

        // Build task-based contributions (primary = tasks count)
        const totalTasks = contribs.reduce((s, c) => s + (c.tasks || 0), 0);
        const newContributions = contribs.map((c) => ({
          name: c.name,
          type: c.type || "Tim",
          percent: totalTasks > 0 ? Math.round((c.tasks || 0) / totalTasks * 100) : 0,
        }));

        // Sync edit form to show real contributors + real percentages
        setForm((p) => ({ ...p, artist_contributions: newContributions }));

        // If there are new artists not in DB yet, update order in DB
        const currentArtists = order.artists || [];
        const allNames = contribs.map((c) => c.name).filter(Boolean);
        const hasNew = allNames.some((n) => !currentArtists.includes(n));
        if (hasNew) {
          updateOrder(order.id, {
            artists: [...new Set([...currentArtists, ...allNames])],
            artist_contributions: newContributions,
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const setContrib = (idx, field, value) => setForm((p) => {
    const next = [...(p.artist_contributions || [])];
    next[idx] = { ...next[idx], [field]: value };
    return { ...p, artist_contributions: next };
  });

  const drawerDisplayTotal = totalCurrency === "IDR"
    ? (form.total ? Math.round(Number(form.total) * exchangeRate) : "")
    : (form.total ?? "");
  const handleDrawerTotalChange = (e) => {
    const v = e.target.value;
    setForm((p) => ({ ...p, total: totalCurrency === "IDR" ? (v ? Number(v) / exchangeRate : "") : v }));
  };

  const rebalance = (list) => {
    const n = list.length;
    if (n === 0) return list;
    const base = Math.floor(100 / n);
    return list.map((c, i) => ({ ...c, percent: i === n - 1 ? 100 - base * (n - 1) : base }));
  };

  const addContrib = () => setForm((p) => ({
    ...p,
    artist_contributions: rebalance([...(p.artist_contributions || []), { name: "", type: "Tim", percent: 0 }]),
  }));
  const removeContrib = (idx) => setForm((p) => ({
    ...p,
    artist_contributions: rebalance((p.artist_contributions || []).filter((_, i) => i !== idx)),
  }));

  // Merge order artist list with dynamic task data for view mode
  const mergedContribs = useMemo(() => {
    const baseList = order.artist_contributions?.length
      ? order.artist_contributions
      : (order.artists || []).map((a) => ({ name: a, type: "Tim", percent: 100 }));

    if (!dynamicContribs?.contributions?.length) {
      const n = baseList.length;
      if (n <= 1) return baseList;
      const total = baseList.reduce((s, c) => s + (Number(c.percent) || 0), 0);
      return total > 100 ? rebalance(baseList) : baseList;
    }

    const dynMap = {};
    dynamicContribs.contributions.forEach((c) => { dynMap[c.name] = c; });

    const merged = baseList.map((ac) => ({
      ...ac,
      tasks: dynMap[ac.name]?.tasks ?? 0,
      done: dynMap[ac.name]?.done ?? 0,
      time: dynMap[ac.name]?.time ?? 0,
    }));
    dynamicContribs.contributions.forEach((dc) => {
      if (!merged.find((m) => m.name === dc.name)) merged.push({ ...dc, type: dc.type || "Tim" });
    });

    const totalTime = merged.reduce((s, c) => s + (c.time || 0), 0);
    const totalTasks = merged.reduce((s, c) => s + (c.tasks || 0), 0);
    const n = merged.length;

    if (totalTasks > 0) return merged.map((c) => ({ ...c, percent: Math.round((c.tasks || 0) / totalTasks * 100) }));
    if (totalTime > 0) return merged.map((c) => ({ ...c, percent: Math.round((c.time || 0) / totalTime * 100) }));
    return rebalance(merged);
  }, [dynamicContribs, order.artist_contributions, order.artists]);

  const orderDate = form.order_date || new Date().toISOString().slice(0, 10);
  const orderNumToday = (ordersOnDay ? ordersOnDay(orderDate) : 0) + 1;
  const autoFolderCode = generateFolderCode(form.platform, form.client, form.project, orderDate, orderNumToday);
  const totalIdr = (Number(form.total) || 0) * exchangeRate;
  const feeIdr = Number(form.fee_freelance) || 0;
  const netUsd = (Number(form.total) || 0) - feeIdr / exchangeRate;
  const hasFreelance = form.artist_contributions?.some((c) => c.type === "Freelance");
  const totalPct = (form.artist_contributions || []).reduce((s, c) => s + (Number(c.percent) || 0), 0);
  const sc = STATUS_COLORS[normalizeStatus(order.status)] || { bg: "#f1f5f9", text: "#64748b" };
  const pc = PAYMENT_COLORS[order.payment_status] || { bg: "#f1f5f9", text: "#64748b" };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, folder_code: manualFolder ? form.folder_code : autoFolderCode });
      setEditing(false);
    } catch {
      toast.error("Gagal menyimpan order");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white transition";
  const Row = ({ label, value, className = "" }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="shrink-0 text-xs text-slate-400 w-32">{label}</span>
      <span className={`text-sm font-medium text-slate-800 text-right flex-1 ${className}`}>{value || "—"}</span>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[200] bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 inset-y-0 z-[300] flex w-full max-w-[500px] flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: sc.bg, color: sc.text }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.text }} />
                {normalizeStatus(order.status)}
              </span>
              <span className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: pc.bg, color: pc.text }}>
                {order.payment_status || "Belum Lunas"}
              </span>
              {order.payment_status === "DP" && order.dp_paid > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Sisa: {formatMoney(Math.max(0, (order.total || 0) - order.dp_paid / exchangeRate))}
                </span>
              )}
            </div>
            <h2 className="mt-2 truncate text-lg font-bold text-slate-900">{order.project}</h2>
            <p className="text-sm text-slate-400">{order.client} · {order.platform}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5">
                <Edit3 size={13} /> Edit
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!editing ? (
            /* VIEW MODE */
            <div className="space-y-0 divide-y divide-slate-100">
              {/* Order Info */}
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Info Order</p>
                <Row label="Order ID" value={order.order_id} />
                <Row label="Tanggal Order" value={order.order_date} />
                <Row label="Deadline" value={<span className={order.deadline && Math.ceil((new Date(order.deadline) - new Date()) / 86400000) < 0 ? "text-rose-600" : order.deadline && Math.ceil((new Date(order.deadline) - new Date()) / 86400000) <= 3 ? "text-amber-600" : ""}>{order.deadline}</span>} />
                <Row label="Platform" value={order.platform} />
                <Row label="Marketer" value={order.marketer} />
                <Row label="Jenis Pekerjaan" value={order.work_type} />
              </div>

              {/* Folder Code */}
              <div className="px-6 py-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Kode Folder</p>
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                  <p className="font-mono text-sm font-semibold text-indigo-800">{order.folder_code || autoFolderCode}</p>
                </div>
              </div>

              {/* Tim Artist */}
              <div className="px-6 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tim Artist</p>
                  {dynamicContribs && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Aktual dari task</span>
                  )}
                </div>
                <div className="space-y-2">
                  {mergedContribs.map((c, i) => (
                    <div key={i} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: artistColor(c.name) }}>{c.name?.charAt(0)?.toUpperCase() || "?"}</div>
                          <span className="text-sm font-medium text-slate-800">{c.name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.type === "Freelance" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{c.type}</span>
                          <span className="text-sm font-bold text-slate-700">{c.percent}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.percent}%`, background: artistColor(c.name) }} />
                      </div>
                      {c.time > 0 && (
                        <p className="mt-0.5 text-[10px] text-slate-400">{fmtSec(c.time)} · {c.done}/{c.tasks} task done</p>
                      )}
                    </div>
                  ))}
                </div>
                {!dynamicContribs && (
                  <p className="mt-2 text-[10px] text-slate-400 italic">Persentase diperbarui otomatis saat task dikerjakan.</p>
                )}
              </div>

              {/* Keuangan */}
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Keuangan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400">Nilai Order</p>
                    <p className="mt-1 text-base font-bold text-slate-900">${order.total}</p>
                    <p className="text-xs text-slate-400">{formatMoney(order.total)}</p>
                  </div>
                  {order.fee_freelance > 0 && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <p className="text-xs text-amber-600">Fee Freelance</p>
                      <p className="mt-1 text-base font-bold text-amber-700">Rp{Number(order.fee_freelance).toLocaleString("id-ID")}</p>
                      <p className="text-xs text-amber-500">{Number(order.total) > 0 ? Math.round((order.fee_freelance / exchangeRate / Number(order.total)) * 100) : 0}% dari order</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 col-span-2">
                    <p className="text-xs text-emerald-600">Net</p>
                    <p className="mt-1 text-base font-bold text-emerald-700">${((Number(order.total) || 0) - (Number(order.fee_freelance) || 0) / exchangeRate).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              {order.notes && (
                <div className="px-6 py-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Catatan</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>
          ) : (
            /* EDIT MODE */
            <form id="drawer-edit-form" onSubmit={handleSave} className="space-y-0 divide-y divide-slate-100">
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Info Dasar</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-500">Tanggal Order<input type="date" value={form.order_date || ""} onChange={set("order_date")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Deadline<input type="date" value={form.deadline || ""} onChange={set("deadline")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Platform<select value={form.platform} onChange={set("platform")} className={inp}>{PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Marketer<select value={form.marketer || ""} onChange={set("marketer")} className={inp}><option value="">-</option>{MARKETER_OPTIONS.map((m) => <option key={m}>{m}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Order ID<input value={form.order_id || ""} onChange={set("order_id")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Klien<input value={form.client} onChange={set("client")} required className={inp} /></label>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Detail Project</p>
                <label className="mb-3 block space-y-1 text-xs font-medium text-slate-500">Nama Project<input value={form.project} onChange={set("project")} required className={inp} /></label>
                <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-700">Kode Folder</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer"><input type="checkbox" checked={manualFolder} onChange={(e) => setManualFolder(e.target.checked)} className="rounded" /> Edit manual</label>
                  </div>
                  {manualFolder ? <input value={form.folder_code || ""} onChange={set("folder_code")} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 font-mono text-sm text-indigo-800 outline-none" /> : <p className="font-mono text-sm font-semibold text-indigo-800">{autoFolderCode}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-500">Jenis Pekerjaan<select value={form.work_type} onChange={set("work_type")} className={inp}>{WORK_TYPE_OPTIONS.map((w) => <option key={w}>{w}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Status<select value={form.status} onChange={set("status")} className={inp}>{STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Tim Artist</p>
                <div className="space-y-2">
                  {(form.artist_contributions || []).map((contrib, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{idx + 1}</span>
                      <input value={contrib.name} onChange={(e) => setContrib(idx, "name", e.target.value)} placeholder="Nama artist" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300" />
                      <select value={contrib.type} onChange={(e) => setContrib(idx, "type", e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none">
                        <option>Tim</option><option>Freelance</option>
                      </select>
                      <input type="number" min="0" max="100" value={contrib.percent} onChange={(e) => setContrib(idx, "percent", Number(e.target.value))} className="w-14 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm outline-none" />
                      <span className="text-xs text-slate-400">%</span>
                      {(form.artist_contributions || []).length > 1 && <button type="button" onClick={() => removeContrib(idx)} className="rounded-full p-1 text-slate-300 hover:text-rose-500"><X size={13} /></button>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-1.5 w-full rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${totalPct === 100 ? "bg-emerald-500" : totalPct > 100 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${Math.min(totalPct, 100)}%` }} /></div>
                    <p className="mt-0.5 text-xs text-slate-400">Total: <span className={totalPct === 100 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{totalPct}%</span></p>
                  </div>
                  <button type="button" onClick={addContrib} className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600">+ Tambah</button>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Keuangan</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">Nilai Order</p>
                      <div className="flex overflow-hidden rounded-lg border border-slate-200 text-[10px] font-bold">
                        <button type="button" onClick={() => setTotalCurrency("USD")} className={`px-2 py-0.5 transition ${totalCurrency === "USD" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>USD</button>
                        <button type="button" onClick={() => setTotalCurrency("IDR")} className={`px-2 py-0.5 transition ${totalCurrency === "IDR" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>IDR</button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{totalCurrency === "IDR" ? "Rp" : "$"}</span>
                      <input type="number" min="0" value={drawerDisplayTotal} onChange={handleDrawerTotalChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm outline-none focus:border-indigo-300" />
                    </div>
                    <p className="text-xs text-slate-400">
                      {totalCurrency === "IDR" ? `≈ $${(Number(form.total) || 0).toFixed(2)}` : `= Rp${Math.round((Number(form.total) || 0) * exchangeRate).toLocaleString("id-ID")}`}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Fee Freelance (Rp)</p>
                    <input type="number" min="0" value={form.fee_freelance || ""} onChange={set("fee_freelance")} disabled={!hasFreelance} placeholder="0" className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ${hasFreelance ? "focus:border-indigo-300" : "opacity-40 cursor-not-allowed"}`} />
                    {hasFreelance && feeIdr > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{Number(form.total) > 0 ? Math.round((feeIdr / exchangeRate / Number(form.total)) * 100) : 0}% dari order</span>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Net</p>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">${netUsd.toFixed(2)}</div>
                  </div>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Payment<select value={form.payment_status} onChange={set("payment_status")} className={inp}>{PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
                </div>
                <label className="mt-3 block space-y-1 text-xs font-medium text-slate-500">Catatan<textarea value={form.notes || ""} onChange={set("notes")} rows={3} className={inp} /></label>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          {editing ? (
            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit" form="drawer-edit-form" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          ) : (
            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => onDelete(order.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                <Trash2 size={14} /> Hapus
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                <Edit3 size={14} /> Edit Order
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function OrderFormModal({ title, initial, ordersOnDay, onClose, onSave }) {
  const { exchangeRate } = useCurrency();
  const [form, setForm] = useState({
    ...initial,
    artist_contributions: initial.artist_contributions?.length
      ? initial.artist_contributions
      : [{ name: "", type: "Tim", percent: 100 }],
  });
  const [manualFolder, setManualFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTg, setSendingTg] = useState(false);
  const [totalCurrency, setTotalCurrency] = useState("USD");

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const modalDisplayTotal = totalCurrency === "IDR"
    ? (form.total ? Math.round(Number(form.total) * exchangeRate) : "")
    : (form.total ?? "");
  const handleModalTotalChange = (e) => {
    const v = e.target.value;
    setForm((p) => ({ ...p, total: totalCurrency === "IDR" ? (v ? Number(v) / exchangeRate : "") : v }));
  };

  const orderDate = form.order_date || new Date().toISOString().slice(0, 10);
  const orderNumToday = (ordersOnDay ? ordersOnDay(orderDate) : 0) + 1;
  const autoFolderCode = generateFolderCode(
    form.platform, form.client, form.project,
    orderDate, orderNumToday
  );

  const completionFields = [form.project, form.client, form.platform, form.deadline, form.work_type, form.status, form.artist_contributions?.[0]?.name];
  const filledCount = completionFields.filter(Boolean).length;
  const completion = Math.round((filledCount / completionFields.length) * 100);

  const totalIdr = (Number(form.total) || 0) * exchangeRate;
  const feeIdr = Number(form.fee_freelance) || 0;
  const netUsd = (Number(form.total) || 0) - feeIdr / exchangeRate;
  const netIdr = totalIdr - feeIdr;
  const hasFreelance = form.artist_contributions?.some((c) => c.type === "Freelance");

  const totalPct = (form.artist_contributions || []).reduce((s, c) => s + (Number(c.percent) || 0), 0);

  const setContrib = (idx, field, value) => {
    setForm((p) => {
      const next = [...(p.artist_contributions || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, artist_contributions: next };
    });
  };

  const addContrib = () => setForm((p) => ({
    ...p,
    artist_contributions: [...(p.artist_contributions || []), { name: "", type: "Tim", percent: 0 }],
  }));

  const removeContrib = (idx) => setForm((p) => ({
    ...p,
    artist_contributions: (p.artist_contributions || []).filter((_, i) => i !== idx),
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, folder_code: manualFolder ? form.folder_code : autoFolderCode });
    } catch {
      toast.error("Gagal menyimpan order");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300 focus:bg-white transition";
  const SectionHeader = ({ icon: Icon, label, color }) => (
    <div className={`mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] ${color}`}>
      <Icon size={14} /> {label}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-7 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-xs font-semibold text-indigo-600">{completion}%</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Kelengkapan</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-0 divide-y divide-slate-100">
          {/* INFO DASAR */}
          <div className="px-7 py-5">
            <SectionHeader icon={Info} label="Info Dasar" color="text-blue-600" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Tanggal order
                <input type="date" value={form.order_date || ""} onChange={set("order_date")} className={inp} />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Deadline
                <input type="date" value={form.deadline || ""} onChange={set("deadline")} required className={inp} />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Platform / Akun
                <select value={form.platform} onChange={set("platform")} className={inp}>
                  {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Marketer / PIC
                <select value={form.marketer || ""} onChange={set("marketer")} className={inp}>
                  <option value="">-</option>
                  {MARKETER_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Order ID (manual)
                <input value={form.order_id || ""} onChange={set("order_id")} placeholder="#FO..." className={inp} />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Nama klien / Studio
                <input value={form.client} onChange={set("client")} required className={inp} />
              </label>
            </div>
          </div>

          {/* DETAIL PROJECT */}
          <div className="px-7 py-5">
            <SectionHeader icon={FolderOpen} label="Detail Project" color="text-violet-600" />
            <label className="mb-4 block space-y-1.5 text-xs font-medium text-slate-600">
              Nama project / Karakter
              <input value={form.project} onChange={set("project")} required className={inp} />
            </label>
            <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><FolderOpen size={12} /> Kode folder (otomatis)</span>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={manualFolder} onChange={(e) => setManualFolder(e.target.checked)} className="rounded" />
                  Edit manual
                </label>
              </div>
              {manualFolder
                ? <input value={form.folder_code || ""} onChange={set("folder_code")} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 font-mono text-sm text-indigo-800 outline-none focus:border-indigo-400" />
                : <p className="font-mono text-sm font-semibold text-indigo-800">{autoFolderCode}</p>
              }
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Jenis pekerjaan
                <select value={form.work_type} onChange={set("work_type")} className={inp}>
                  {WORK_TYPE_OPTIONS.map((w) => <option key={w}>{w}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Status pekerjaan
                <select value={form.status} onChange={set("status")} className={inp}>
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* TIM ARTIST */}
          <div className="px-7 py-5">
            <SectionHeader icon={User} label="Tim Artist" color="text-emerald-600" />
            <div className="space-y-3">
              {(form.artist_contributions || []).map((contrib, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="inline-flex h-7 min-w-[56px] items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-semibold text-indigo-700">
                    Artist {idx + 1}
                  </span>
                  <input
                    value={contrib.name}
                    onChange={(e) => setContrib(idx, "name", e.target.value)}
                    placeholder="Nama artist"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
                  />
                  <select
                    value={contrib.type}
                    onChange={(e) => setContrib(idx, "type", e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  >
                    <option>Tim</option>
                    <option>Freelance</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100"
                      value={contrib.percent}
                      onChange={(e) => setContrib(idx, "percent", Number(e.target.value))}
                      className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm outline-none focus:border-indigo-300"
                    />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                  {(form.artist_contributions || []).length > 1 && (
                    <button type="button" onClick={() => removeContrib(idx)} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div className={`h-1.5 rounded-full transition-all ${totalPct === 100 ? "bg-emerald-500" : totalPct > 100 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">Total kontribusi: <span className={totalPct === 100 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{totalPct}%</span></p>
              </div>
              <button type="button" onClick={addContrib} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600">
                <UserPlus size={13} /> Tambah artist
              </button>
            </div>
          </div>

          {/* KEUANGAN */}
          <div className="px-7 py-5">
            <SectionHeader icon={Flame} label="Keuangan" color="text-orange-600" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-600">Nilai order</p>
                  <div className="flex overflow-hidden rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button type="button" onClick={() => setTotalCurrency("USD")} className={`px-2 py-0.5 transition ${totalCurrency === "USD" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>USD</button>
                    <button type="button" onClick={() => setTotalCurrency("IDR")} className={`px-2 py-0.5 transition ${totalCurrency === "IDR" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>IDR</button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{totalCurrency === "IDR" ? "Rp" : "$"}</span>
                  <input type="number" min="0" value={modalDisplayTotal} onChange={handleModalTotalChange} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-4 text-sm outline-none focus:border-indigo-300 focus:bg-white" />
                </div>
                <p className="text-xs text-slate-400">
                  {totalCurrency === "IDR" ? `≈ $${(Number(form.total) || 0).toFixed(2)}` : `= Rp${Math.round((Number(form.total) || 0) * exchangeRate).toLocaleString("id-ID")}`}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">Fee Freelance (Rp)</p>
                <input
                  type="number" min="0"
                  value={form.fee_freelance || ""}
                  onChange={set("fee_freelance")}
                  disabled={!hasFreelance}
                  placeholder="0"
                  className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none ${hasFreelance ? "focus:border-indigo-300 focus:bg-white" : "opacity-40 cursor-not-allowed"}`}
                />
                {hasFreelance && feeIdr > 0 ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">≈ ${(feeIdr / exchangeRate).toFixed(2)}</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {Number(form.total) > 0 ? Math.round((feeIdr / exchangeRate / Number(form.total)) * 100) : 0}% dari order
                    </span>
                  </div>
                ) : !hasFreelance ? (
                  <p className="text-xs text-slate-300">Tambah artist Freelance di Tim Artist</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">Net (otomatis)</p>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
                  ${netUsd.toFixed(2)}
                </div>
                <p className="text-xs text-slate-400">= Rp{netIdr.toLocaleString("id-ID")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-1">
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                Sudah Dibayar?
                <select value={form.payment_status} onChange={set("payment_status")} className={inp}>
                  {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 block space-y-1.5 text-xs font-medium text-slate-600">
              Catatan
              <textarea value={form.notes || ""} onChange={set("notes")} rows={3} placeholder="Catatan..." className={inp} />
            </label>
          </div>

          {/* TELEGRAM */}
          <div className="px-7 py-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.461c-.143.643-.527.8-.864.498l-2.37-1.756-1.144 1.1c-.126.127-.232.233-.476.233l.17-2.403 4.367-3.941c.19-.168-.041-.261-.294-.093L7.168 15.447l-2.335-.729c-.507-.158-.52-.507.106-.75l9.136-3.519c.424-.154.797.103.487 1.799z"/></svg>
              Kirim Notif Telegram
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "Order Baru", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🎉",
                  msg: () => `🎉 <b>Order Baru!</b>\n\n📁 <b>${form.project || "-"}</b>\n👤 Klien: ${form.client || "-"}\n🏪 Platform: ${form.platform || "-"}\n💼 Jenis: ${form.work_type || "-"}\n💰 Total: $${form.total || 0}\n📅 Deadline: ${form.deadline || "-"}\n🖊 Artist: ${form.artist_contributions?.map((a) => a.name).filter(Boolean).join(", ") || "-"}`,
                },
                {
                  label: "Reminder", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "⏰",
                  msg: () => `⏰ <b>Reminder Order</b>\n\n📁 <b>${form.project || "-"}</b>\n👤 Klien: ${form.client || "-"}\n📅 Deadline: ${form.deadline || "-"}\n🔖 Status: ${form.status || "-"}\n🖊 Artist: ${form.artist_contributions?.map((a) => a.name).filter(Boolean).join(", ") || "-"}`,
                },
                {
                  label: "Warning H-1", color: "bg-rose-50 text-rose-700 border-rose-200", icon: "⚠️",
                  msg: () => `⚠️ <b>BESOK DEADLINE!</b>\n\n📁 <b>${form.project || "-"}</b>\n👤 Klien: ${form.client || "-"}\n📅 Deadline: ${form.deadline || "-"}\n🖊 Artist: ${form.artist_contributions?.map((a) => a.name).filter(Boolean).join(", ") || "-"}\n\nSegera selesaikan!`,
                },
                {
                  label: "Sisa hari", color: "bg-slate-50 text-slate-700 border-slate-200", icon: "🔔",
                  msg: () => {
                    const dl = form.deadline ? Math.ceil((new Date(form.deadline) - new Date()) / 86400000) : null;
                    return `🔔 <b>Update Order</b>\n\n📁 <b>${form.project || "-"}</b>\n🔖 Status: ${form.status || "-"}\n📅 Deadline: ${form.deadline || "-"}${dl !== null ? `\n⏳ Sisa: ${dl} hari` : ""}`;
                  },
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  disabled={sendingTg}
                  onClick={async () => {
                    setSendingTg(true);
                    try {
                      await api.post("/telegram/send", { message: btn.msg() });
                      toast.success(`Notif "${btn.label}" terkirim ke Telegram`);
                    } catch (err) {
                      toast.error(err.response?.data?.detail || "Gagal kirim ke Telegram");
                    } finally {
                      setSendingTg(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50 ${btn.color}`}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-7 py-5">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

function PaymentSelect({ orderId, value, onUpdate }) {
  const pc = PAYMENT_COLORS[value] || { bg: "#f1f5f9", text: "#64748b" };
  return (
    <select
      value={value || "Belum Lunas"}
      onChange={(e) => onUpdate(orderId, "payment_status", e.target.value)}
      className="rounded-lg border-0 px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
      style={{ background: pc.bg, color: pc.text }}
    >
      {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
    </select>
  );
}

function ImportCSVModal({ rows, onClose, onImport, formatMoney }) {
  const [importing, setImporting] = useState(false);
  const handleImport = async () => {
    setImporting(true);
    await onImport();
    setImporting(false);
  };
  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div className="flex w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between border-b border-slate-100 px-7 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Import CSV</h2>
            <p className="mt-0.5 text-sm text-slate-500">{rows.length} order ditemukan — periksa sebelum import</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Template download */}
        <div className="border-b border-slate-100 bg-slate-50 px-7 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs text-slate-500">Kolom yang dikenali: <span className="font-mono text-xs text-slate-700">project, client, total, status, deadline, order_date, platform, order_id, work_type, payment_status, folder_code, marketer, notes, fee_freelance, artists</span></p>
        </div>

        <div className="flex-1 overflow-auto px-7 py-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-4 text-left">#</th>
                <th className="pb-2 pr-4 text-left">Project</th>
                <th className="pb-2 pr-4 text-left">Client</th>
                <th className="pb-2 pr-4 text-left">Total</th>
                <th className="pb-2 pr-4 text-left">Status</th>
                <th className="pb-2 pr-4 text-left">Deadline</th>
                <th className="pb-2 text-left">Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 text-xs text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium text-slate-900">{r.project || r.nama_project || "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.client || r.klien || "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">${r.total || r.nilai || "0"}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.status || "Pending"}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.deadline || r.batas_waktu || "—"}</td>
                  <td className="py-2 text-slate-600">{r.platform || "Direct"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-7 py-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-500" />
            {rows.length} order siap diimport
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button onClick={handleImport} disabled={importing} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {importing ? "Mengimport..." : `Import ${rows.length} Order`}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
