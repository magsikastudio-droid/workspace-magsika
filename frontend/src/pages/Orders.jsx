import React, { useMemo, useState } from "react";
import { Plus, Search, Edit3, Trash2, Upload, Download, Columns, FolderOpen, User, Flame, Info, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
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
  order_date: todayStr(),
  status: "Pending", artists: "", platform: "Fiverr Magsika",
  market: "Magsika", order_id: "", work_type: "Modeling",
  payment_status: "Belum Lunas", folder_code: "", marketer: "Ivo", notes: "",
  fee_freelance: 0,
  artist_contributions: [{ name: "", type: "Tim", percent: 100 }],
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
          initial={newOrder}
          onClose={() => { setShowCreate(false); setNewOrder(emptyOrder()); }}
          onSave={handleCreateSubmit}
        />
      )}

      {activeOrder && (
        <OrderFormModal
          title="Edit Order"
          initial={{
            ...activeOrder,
            artists: (activeOrder.artists || []).join(", "),
            artist_contributions: activeOrder.artist_contributions?.length
              ? activeOrder.artist_contributions
              : [{ name: (activeOrder.artists || [])[0] || "", type: "Tim", percent: 100 }],
          }}
          onClose={() => setActiveOrder(null)}
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

function OrderFormModal({ title, initial, onClose, onSave }) {
  const { exchangeRate } = useCurrency();
  const [form, setForm] = useState({
    ...initial,
    artist_contributions: initial.artist_contributions?.length
      ? initial.artist_contributions
      : [{ name: "", type: "Tim", percent: 100 }],
  });
  const [manualFolder, setManualFolder] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const autoFolderCode = generateFolderCode(
    form.platform, form.market,
    form.artist_contributions?.[0]?.name || form.artists?.split(",")[0]?.trim(),
    form.work_type, form.order_date || new Date()
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 backdrop-blur-sm px-4 py-6">
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
                    <option>Solo</option>
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
                <p className="text-xs font-medium text-slate-600">Nilai order (USD)</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                  <input type="number" min="0" value={form.total} onChange={set("total")} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-4 text-sm outline-none focus:border-indigo-300 focus:bg-white" />
                </div>
                <p className="text-xs text-slate-400">= Rp{totalIdr.toLocaleString("id-ID")}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">
                  Fee Freelance (Rp)
                  {!hasFreelance && <span className="ml-1 text-slate-400">— tidak perlu untuk Tim</span>}
                </p>
                <input
                  type="number" min="0"
                  value={form.fee_freelance || ""}
                  onChange={set("fee_freelance")}
                  disabled={!hasFreelance}
                  placeholder="0"
                  className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none ${hasFreelance ? "focus:border-indigo-300 focus:bg-white" : "opacity-50 cursor-not-allowed"}`}
                />
                {hasFreelance && <p className="text-xs text-slate-400">= ${(feeIdr / exchangeRate).toFixed(2)}</p>}
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

          {/* TELEGRAM (UI only) */}
          <div className="px-7 py-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.461c-.143.643-.527.8-.864.498l-2.37-1.756-1.144 1.1c-.126.127-.232.233-.476.233l.17-2.403 4.367-3.941c.19-.168-.041-.261-.294-.093L7.168 15.447l-2.335-.729c-.507-.158-.52-.507.106-.75l9.136-3.519c.424-.154.797.103.487 1.799z"/></svg>
              Kirim Notif Telegram
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Order Baru", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🎉" },
                { label: "Reminder", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "⏰" },
                { label: "Warning H-1", color: "bg-rose-50 text-rose-700 border-rose-200", icon: "⚠️" },
                { label: "Sisa hari", color: "bg-slate-50 text-slate-700 border-slate-200", icon: "🔔" },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => toast.info("Telegram bot belum dikonfigurasi di Settings.")}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition hover:opacity-80 ${btn.color}`}
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
  );
}
