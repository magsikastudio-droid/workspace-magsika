import React, { useMemo, useState } from "react";
import { Plus, Search, Edit3, Trash2, Upload, Download, Columns } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import {
  STATUS_OPTIONS, STATUS_COLORS,
  PLATFORM_OPTIONS, PAYMENT_OPTIONS, PAYMENT_COLORS,
  WORK_TYPE_OPTIONS, MARKET_OPTIONS, MARKETER_OPTIONS,
  generateFolderCode, normalizeStatus,
} from "../lib/constants";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyOrder = () => ({
  project: "", client: "", total: "", deadline: todayStr(),
  status: "Pending", artists: "", platform: "Fiverr Magsika",
  market: "Magsika", order_id: "", work_type: "Modeling",
  payment_status: "Belum Lunas", folder_code: "", marketer: "Ivo", notes: "",
});

export default function OrdersPage() {
  const { orders, loading, createOrder, updateOrder, deleteOrder } = useOrders();
  const { formatMoney } = useCurrency();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [paymentFilter, setPaymentFilter] = useState("Semua");
  const [showCreate, setShowCreate] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newOrder, setNewOrder] = useState(emptyOrder());
  const [compactMode, setCompactMode] = useState(true);

  const visibleOrders = useMemo(() =>
    orders
      .filter((o) => {
        if (search && ![o.project, o.client, o.status, o.platform, o.order_id].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) return false;
        if (platformFilter !== "Semua" && o.platform !== platformFilter) return false;
        if (statusFilter !== "Semua" && o.status !== statusFilter) return false;
        if (paymentFilter !== "Semua" && o.payment_status !== paymentFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [orders, search, platformFilter, statusFilter, paymentFilter]
  );

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const folderCode = newOrder.folder_code || generateFolderCode(
      newOrder.platform, newOrder.market,
      newOrder.artists.split(",")[0]?.trim(), newOrder.work_type, new Date()
    );
    await createOrder({
      ...newOrder,
      total: Number(newOrder.total),
      artists: newOrder.artists.split(",").map((a) => a.trim()).filter(Boolean),
      folder_code: folderCode,
    });
    setShowCreate(false);
    setNewOrder(emptyOrder());
  };

  const handleSaveOrder = async (updated) => {
    await updateOrder(activeOrder.id, {
      ...updated,
      total: Number(updated.total),
      artists: updated.artists.split(",").map((a) => a.trim()).filter(Boolean),
    });
    setActiveOrder(null);
  };

  const handleDelete = async (id) => {
    await deleteOrder(id);
    setConfirmDelete(null);
  };

  const deadlineClass = (deadline) => {
    if (!deadline) return "";
    const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (diff < 0) return "text-rose-600 font-semibold";
    if (diff <= 3) return "text-amber-600 font-semibold";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Semua Order 3D</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola semua order aktif dengan filter dan detail lengkap.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload size={16} /> Import CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} /> Tambah Order
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari project, klien, order ID..." className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400">
              <option value="Semua">Semua Platform</option>
              {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400">
              <option value="Semua">Semua Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400">
              <option value="Semua">Semua Bayar</option>
              {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Daftar Order</p>
            <p className="text-sm text-slate-500">{compactMode ? "Mode ringkas: klik Kolom untuk lihat semua detail." : "Mode lengkap: semua kolom ditampilkan."}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCompactMode((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                compactMode
                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  : "border-slate-900 bg-slate-900 text-white"
              }`}
            >
              <Columns size={13} /> {compactMode ? "Kolom Lengkap" : "Ringkas"}
            </button>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
              {loading ? "Memuat..." : `${visibleOrders.length} order`}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Platform</th>
                {!compactMode && <th className="px-4 py-3">Market</th>}
                {!compactMode && <th className="px-4 py-3">Order ID</th>}
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Project</th>
                {!compactMode && <th className="px-4 py-3">Jenis</th>}
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bayar</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleOrders.map((order) => {
                const sc = STATUS_COLORS[normalizeStatus(order.status)] || { bg: "#f1f5f9", text: "#64748b" };
                const pc = PAYMENT_COLORS[order.payment_status] || { bg: "#f1f5f9", text: "#64748b" };
                const colSpan = compactMode ? 10 : 13;
                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{order.created_at?.slice(0, 10) || "-"}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm">{order.platform || "Direct"}</span>
                    </td>
                    {!compactMode && <td className="px-4 py-4">{order.market || "-"}</td>}
                    {!compactMode && <td className="px-4 py-4 font-mono text-xs">{order.order_id || "-"}</td>}
                    <td className="px-4 py-4 max-w-[140px] truncate">{order.client}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900 max-w-[180px]">
                      <p className="truncate">{order.project}</p>
                      {compactMode && order.work_type && (
                        <p className="text-xs font-normal text-slate-400">{order.work_type}</p>
                      )}
                    </td>
                    {!compactMode && <td className="px-4 py-4">{order.work_type || "-"}</td>}
                    <td className="px-4 py-4">{order.artists?.[0] || "-"}</td>
                    <td className={`px-4 py-4 whitespace-nowrap ${deadlineClass(order.deadline)}`}>{order.deadline || "-"}</td>
                    <td className="px-4 py-4 font-semibold whitespace-nowrap">{formatMoney(order.total)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: sc.bg, color: sc.text }}>
                        {normalizeStatus(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: pc.bg, color: pc.text }}>
                        {order.payment_status || "Belum Lunas"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveOrder({ ...order, artists: (order.artists || []).join(", ") })} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                          <Edit3 size={13} /> Edit
                        </button>
                        <button onClick={() => setConfirmDelete(order)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleOrders.length === 0 && (
                <tr><td colSpan={compactMode ? 10 : 13} className="py-10 text-center text-sm text-slate-500">Tidak ada order yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <OrderFormModal
          title="Tambah Order Baru"
          subtitle="Masukkan detail project, platform, dan status pembayaran."
          initial={newOrder}
          onClose={() => { setShowCreate(false); setNewOrder(emptyOrder()); }}
          onSubmit={handleCreateSubmit}
          isCreate
        />
      )}

      {activeOrder && (
        <OrderFormModal
          title="Edit Order"
          subtitle="Perbarui informasi order untuk tim produksi."
          initial={activeOrder}
          onClose={() => setActiveOrder(null)}
          onSubmit={async (e) => { e.preventDefault(); await handleSaveOrder(activeOrder); }}
          onChange={(field, value) => setActiveOrder((prev) => ({ ...prev, [field]: value }))}
          isEdit
          onSave={handleSaveOrder}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Hapus Order?</h2>
            <p className="mt-2 text-sm text-slate-500">Order <span className="font-semibold">{confirmDelete.project}</span> akan dihapus permanen.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderFormModal({ title, subtitle, initial, onClose, onSubmit, isCreate, isEdit, onSave }) {
  const [form, setForm] = useState({ ...initial });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCreate) {
      await onSubmit(e);
    } else {
      await onSave(form);
    }
  };

  const inputCls = "w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400";
  const labelCls = "space-y-2 text-sm text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-[2rem] bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700">Tutup</button>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className={labelCls}><span>Project / Karakter</span>
              <input value={form.project} onChange={set("project")} required className={inputCls} /></label>
            <label className={labelCls}><span>Nama Klien / Studio</span>
              <input value={form.client} onChange={set("client")} required className={inputCls} /></label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className={labelCls}><span>Order ID</span>
              <input value={form.order_id} onChange={set("order_id")} className={inputCls} /></label>
            <label className={labelCls}><span>Platform</span>
              <select value={form.platform} onChange={set("platform")} className={inputCls}>
                {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
              </select></label>
            <label className={labelCls}><span>Market</span>
              <select value={form.market} onChange={set("market")} className={inputCls}>
                {MARKET_OPTIONS.map((m) => <option key={m}>{m}</option>)}
              </select></label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className={labelCls}><span>Jenis Pekerjaan</span>
              <select value={form.work_type} onChange={set("work_type")} className={inputCls}>
                {WORK_TYPE_OPTIONS.map((w) => <option key={w}>{w}</option>)}
              </select></label>
            <label className={labelCls}><span>Status Produksi</span>
              <select value={form.status} onChange={set("status")} className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select></label>
            <label className={labelCls}><span>Status Pembayaran</span>
              <select value={form.payment_status} onChange={set("payment_status")} className={inputCls}>
                {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
              </select></label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className={labelCls}><span>Deadline</span>
              <input value={form.deadline} onChange={set("deadline")} type="date" required className={inputCls} /></label>
            <label className={labelCls}><span>Nilai Order (USD)</span>
              <input value={form.total} onChange={set("total")} type="number" min="0" className={inputCls} /></label>
            <label className={labelCls}><span>Marketer</span>
              <select value={form.marketer || ""} onChange={set("marketer")} className={inputCls}>
                <option value="">-</option>
                {MARKETER_OPTIONS.map((m) => <option key={m}>{m}</option>)}
              </select></label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className={labelCls}><span>Artists / Tim (pisahkan koma)</span>
              <input value={form.artists} onChange={set("artists")} placeholder="Andre, Budi" className={inputCls} /></label>
            <label className={labelCls}><span>Folder Code</span>
              <input value={form.folder_code} onChange={set("folder_code")} placeholder="Auto-generate jika kosong" className={inputCls} /></label>
          </div>
          <label className={labelCls}><span>Notes</span>
            <textarea value={form.notes || ""} onChange={set("notes")} rows={3} className={inputCls} /></label>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
