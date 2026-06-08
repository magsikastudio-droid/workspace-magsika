import React, { useMemo, useState } from "react";
import { Plus, Search, ArrowRight, Calendar, ClipboardList, Upload, Download, Edit3, Trash2 } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";

const statusStyles = {
  done: "bg-emerald-100 text-emerald-700",
  "in progress": "bg-sky-100 text-sky-700",
  pending: "bg-amber-100 text-amber-700",
};

const paymentStyles = {
  Lunas: "bg-emerald-100 text-emerald-700",
  "Belum Lunas": "bg-rose-100 text-rose-700",
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const statusOptions = ["pending", "in progress", "done"];
const paymentOptions = ["Belum Lunas", "Lunas"];
const platformOptions = ["Direct", "Fiverr", "Upwork"];

export default function OrdersPage() {
  const { orders, loading, createOrder, updateOrder } = useOrders();
  const { formatMoney } = useCurrency();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("Semua Platform");
  const [statusFilter, setStatusFilter] = useState("Semua Status");
  const [paymentFilter, setPaymentFilter] = useState("Semua Bayar");
  const [showCreate, setShowCreate] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [newOrder, setNewOrder] = useState({
    project: "",
    client: "",
    total: "",
    deadline: todayStr(),
    status: "pending",
    artists: "",
    platform: "Direct",
    market: "Magsika",
    order_id: "",
    work_type: "Modeling",
    payment_status: "Belum Lunas",
    folder_code: "",
  });

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          if (search && ![order.project, order.client, order.status, order.platform, order.order_id].some((value) => value?.toLowerCase().includes(search.toLowerCase()))) {
            return false;
          }
          if (platformFilter !== "Semua Platform" && order.platform !== platformFilter) return false;
          if (statusFilter !== "Semua Status" && order.status !== statusFilter) return false;
          if (paymentFilter !== "Semua Bayar" && order.payment_status !== paymentFilter) return false;
          return true;
        })
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [orders, search, platformFilter, statusFilter, paymentFilter]
  );

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    await createOrder({
      project: newOrder.project,
      client: newOrder.client,
      total: Number(newOrder.total),
      deadline: newOrder.deadline,
      status: newOrder.status,
      artists: newOrder.artists.split(",").map((artist) => artist.trim()).filter(Boolean),
      platform: newOrder.platform,
      market: newOrder.market,
      order_id: newOrder.order_id,
      work_type: newOrder.work_type,
      payment_status: newOrder.payment_status,
      folder_code: newOrder.folder_code,
    });
    setShowCreate(false);
    setNewOrder({
      project: "",
      client: "",
      total: "",
      deadline: todayStr(),
      status: "pending",
      artists: "",
      platform: "Direct",
      market: "Magsika",
      order_id: "",
      work_type: "Modeling",
      payment_status: "Belum Lunas",
      folder_code: "",
    });
  };

  const handleSaveOrder = async (updated) => {
    await updateOrder(activeOrder.id, {
      project: updated.project,
      client: updated.client,
      total: Number(updated.total),
      deadline: updated.deadline,
      status: updated.status,
      artists: updated.artists.split(",").map((artist) => artist.trim()).filter(Boolean),
      platform: updated.platform,
      market: updated.market,
      order_id: updated.order_id,
      work_type: updated.work_type,
      payment_status: updated.payment_status,
      folder_code: updated.folder_code,
    });
    setActiveOrder(null);
  };

  const uniquePlatforms = ["Semua Platform", ...new Set(orders.map((order) => order.platform || "Direct"))];
  const uniqueStatuses = ["Semua Status", ...new Set(orders.map((order) => order.status || "pending"))];
  const uniquePayments = ["Semua Bayar", ...new Set(orders.map((order) => order.payment_status || "Belum Lunas"))];

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
              {uniquePlatforms.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400">
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400">
              {uniquePayments.map((payment) => (
                <option key={payment} value={payment}>{payment}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Daftar Order</p>
            <p className="text-sm text-slate-500">Tabel order dengan detail folder, tipe, dan status pembayaran.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">{loading ? "Memuat..." : `${visibleOrders.length} order tampil`}</span>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bayar</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">{order.created_at || "-"}</td>
                  <td className="px-4 py-4">{order.platform || "Direct"}</td>
                  <td className="px-4 py-4">{order.market || "Magsika"}</td>
                  <td className="px-4 py-4">{order.order_id || "-"}</td>
                  <td className="px-4 py-4">{order.client}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{order.project}</td>
                  <td className="px-4 py-4">{order.work_type || "Modeling"}</td>
                  <td className="px-4 py-4">{order.artists?.[0] || "Unassigned"}</td>
                  <td className="px-4 py-4">{order.deadline || "-"}</td>
                  <td className="px-4 py-4">{formatMoney(order.total)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status] || "bg-slate-100 text-slate-700"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentStyles[order.payment_status] || "bg-slate-100 text-slate-700"}`}>
                      {order.payment_status || "Belum Lunas"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={() => setActiveOrder(order)} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                      <Edit3 size={14} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan="13" className="py-8 text-center text-sm text-slate-500">
                    Tidak ada order yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Tambah Order Baru</h2>
                <p className="text-sm text-slate-500">Masukkan detail project, platform, dan status pembayaran.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700">Batal</button>
            </div>
            <form className="grid gap-4" onSubmit={handleCreateSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Project / Karakter</span>
                  <input value={newOrder.project} onChange={(e) => setNewOrder((prev) => ({ ...prev, project: e.target.value }))} required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Nama klien / Studio</span>
                  <input value={newOrder.client} onChange={(e) => setNewOrder((prev) => ({ ...prev, client: e.target.value }))} required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Order ID</span>
                  <input value={newOrder.order_id} onChange={(e) => setNewOrder((prev) => ({ ...prev, order_id: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Platform / Akun</span>
                  <select value={newOrder.platform} onChange={(e) => setNewOrder((prev) => ({ ...prev, platform: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400">
                    {platformOptions.map((platform) => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Market</span>
                  <input value={newOrder.market} onChange={(e) => setNewOrder((prev) => ({ ...prev, market: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Deadline</span>
                  <input value={newOrder.deadline} onChange={(e) => setNewOrder((prev) => ({ ...prev, deadline: e.target.value }))} type="date" required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Jenis pekerjaan</span>
                  <input value={newOrder.work_type} onChange={(e) => setNewOrder((prev) => ({ ...prev, work_type: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Status pembayaran</span>
                  <select value={newOrder.payment_status} onChange={(e) => setNewOrder((prev) => ({ ...prev, payment_status: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400">
                    {paymentOptions.map((payment) => (
                      <option key={payment} value={payment}>{payment}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Folder code</span>
                  <input value={newOrder.folder_code} onChange={(e) => setNewOrder((prev) => ({ ...prev, folder_code: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Artists / Tim</span>
                  <input value={newOrder.artists} onChange={(e) => setNewOrder((prev) => ({ ...prev, artists: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Nilai order (USD)</span>
                  <input value={newOrder.total} onChange={(e) => setNewOrder((prev) => ({ ...prev, total: e.target.value }))} type="number" min="0" className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Project notes</span>
                  <textarea value={newOrder.folder_code} onChange={(e) => setNewOrder((prev) => ({ ...prev, folder_code: e.target.value }))} rows={3} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Simpan Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeOrder && <OrderDetailModal order={activeOrder} onClose={() => setActiveOrder(null)} onSave={handleSaveOrder} />}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onSave }) {
  const [formState, setFormState] = useState({
    project: order.project,
    client: order.client,
    total: order.total,
    deadline: order.deadline || todayStr(),
    status: order.status,
    artists: (order.artists || []).join(", "),
    platform: order.platform || "Direct",
    market: order.market || "Magsika",
    order_id: order.order_id || "",
    work_type: order.work_type || "Modeling",
    payment_status: order.payment_status || "Belum Lunas",
    folder_code: order.folder_code || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[2rem] bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Detail Order</h2>
            <p className="text-sm text-slate-500">Perbarui informasi order untuk tim produksi.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700">Tutup</button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Project</span>
              <input value={formState.project} onChange={(e) => setFormState((prev) => ({ ...prev, project: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Klien</span>
              <input value={formState.client} onChange={(e) => setFormState((prev) => ({ ...prev, client: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Total</span>
              <input value={formState.total} onChange={(e) => setFormState((prev) => ({ ...prev, total: e.target.value }))} type="number" min="0" className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Deadline</span>
              <input value={formState.deadline} onChange={(e) => setFormState((prev) => ({ ...prev, deadline: e.target.value }))} type="date" className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Status</span>
              <select value={formState.status} onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400">
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Order ID</span>
              <input value={formState.order_id} onChange={(e) => setFormState((prev) => ({ ...prev, order_id: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Platform</span>
              <select value={formState.platform} onChange={(e) => setFormState((prev) => ({ ...prev, platform: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400">
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Market</span>
              <input value={formState.market} onChange={(e) => setFormState((prev) => ({ ...prev, market: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Jenis pekerjaan</span>
              <input value={formState.work_type} onChange={(e) => setFormState((prev) => ({ ...prev, work_type: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Payment status</span>
              <select value={formState.payment_status} onChange={(e) => setFormState((prev) => ({ ...prev, payment_status: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400">
                {paymentOptions.map((payment) => (
                  <option key={payment} value={payment}>{payment}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Folder code</span>
            <input value={formState.folder_code} onChange={(e) => setFormState((prev) => ({ ...prev, folder_code: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Artists / Tim</span>
            <input value={formState.artists} onChange={(e) => setFormState((prev) => ({ ...prev, artists: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </label>
          <div className="flex flex-wrap justify-end gap-3 pt-4">
            <button onClick={() => onSave(formState)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              <ArrowRight size={16} /> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
