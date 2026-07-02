import React, { useEffect, useState, useMemo } from "react";
import { Plus, Edit3, Trash2, X, Search, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { MARKET_OPTIONS } from "../lib/constants";
import { useAuth } from "../context/AuthContext";

const LAYOUT_STATUS = ["Asseting", "Layouting", "Video", "Ready Publish", "Done"];
const STATUS_COLORS = {
  "Asseting":      { bg: "#f1f5f9", text: "#475569" },
  "Layouting":     { bg: "#e0f2fe", text: "#0369a1" },
  "Video":         { bg: "#ede9fe", text: "#6d28d9" },
  "Ready Publish": { bg: "#fef3c7", text: "#b45309" },
  "Done":          { bg: "#dcfce7", text: "#166534" },
};

const emptyTask = () => ({
  project: "", folder_code: "", market: "Magsika",
  talent: "", deadline: "", status: "Asseting", notes: "",
});

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function OrderLayout() {
  const { user } = useAuth();
  const role = user?.role || "talent";
  const isAdminOrPM = role === "admin" || role === "pm";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/layout-tasks");
      setTasks(res.data?.layout_tasks || []);
    } catch { toast.error("Gagal memuat layout tasks"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const visible = useMemo(() => tasks.filter((t) => {
    if (statusFilter !== "Semua" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![t.project, t.folder_code, t.talent, t.market].some((v) => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => {
    const aDone = a.status === "Done";
    const bDone = b.status === "Done";
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return 0;
  }), [tasks, search, statusFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((t) => t.status !== "Done").length,
    done: tasks.filter((t) => t.status === "Done").length,
    overdue: tasks.filter((t) => t.status !== "Done" && t.deadline && t.deadline < todayStr()).length,
  }), [tasks]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editTask?.id) {
        const res = await api.put(`/layout-tasks/${editTask.id}`, form);
        setTasks((prev) => prev.map((t) => t.id === editTask.id ? res.data : t));
        toast.success("Layout task diperbarui");
      } else {
        const res = await api.post("/layout-tasks", form);
        setTasks((prev) => [...prev, res.data]);
        toast.success("Layout task dibuat");
      }
      setShowModal(false);
      setEditTask(null);
    } catch { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/layout-tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setConfirmDelete(null);
      toast.success("Dihapus");
    } catch { toast.error("Gagal menghapus"); }
  };

  const handleInlineStatus = async (id, newStatus) => {
    try {
      const res = await api.put(`/layout-tasks/${id}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
    } catch { toast.error("Gagal update status"); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Layout</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manajemen task layouting & desain grafis.</p>
        </div>
        {isAdminOrPM && (
          <button
            onClick={() => { setEditTask(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Plus size={15} /> Tambah Task
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "border-l-violet-500" },
          { label: "Aktif", value: stats.active, color: "border-l-sky-500" },
          { label: "Done", value: stats.done, color: "border-l-emerald-500" },
          { label: "Overdue", value: stats.overdue, color: "border-l-rose-500" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border-l-4 border border-slate-200 bg-white px-5 py-4 shadow-sm ${c.color}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari project, folder, talent..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-violet-300"
            />
          </div>
          <select
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="Semua">All Status</option>
            {LAYOUT_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="text-xs font-semibold text-slate-400">{loading ? "..." : `${visible.length} task`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Kode Folder</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Talent</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Status</th>
                {isAdminOrPM && <th className="px-4 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">Memuat...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">Tidak ada task yang cocok.</td></tr>
              ) : visible.map((task) => {
                const sc = STATUS_COLORS[task.status] || { bg: "#f1f5f9", text: "#64748b" };
                const isOverdue = task.status !== "Done" && task.deadline && task.deadline < todayStr();
                const deadlineDiff = task.deadline ? Math.ceil((new Date(task.deadline) - new Date()) / 86400000) : null;
                return (
                  <tr key={task.id} className={`hover:bg-slate-50 transition ${task.status === "Done" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-semibold text-slate-900">{task.project}</p>
                      {task.notes && <p className="text-xs text-slate-400 truncate max-w-[180px]">{task.notes}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">{task.folder_code || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{task.market || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{task.talent || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <span className="text-rose-500" title="Overdue">⚠</span>}
                        {!isOverdue && deadlineDiff !== null && deadlineDiff <= 3 && deadlineDiff >= 0 && <span className="text-amber-500">🔥</span>}
                        <span className={`text-sm ${isOverdue ? "text-rose-600 font-semibold" : deadlineDiff !== null && deadlineDiff <= 3 ? "text-amber-600 font-semibold" : "text-slate-600"}`}>
                          {task.deadline || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        onChange={(e) => handleInlineStatus(task.id, e.target.value)}
                        className="rounded-lg border-0 px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
                        style={{ background: sc.bg, color: sc.text }}
                        disabled={!isAdminOrPM}
                      >
                        {LAYOUT_STATUS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    {isAdminOrPM && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setEditTask(task); setShowModal(true); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                          >
                            <Edit3 size={12} className="inline mr-1" />Edit
                          </button>
                          <button
                            onClick={() => setConfirmDelete(task)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <LayoutTaskModal
          initial={editTask || emptyTask()}
          onClose={() => { setShowModal(false); setEditTask(null); }}
          onSave={handleSave}
          saving={saving}
          isEdit={!!editTask?.id}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Hapus Task?</h2>
            <p className="mt-2 text-sm text-slate-500">Task <span className="font-semibold text-slate-800">{confirmDelete.project}</span> akan dihapus permanen.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutTaskModal({ initial, onClose, onSave, saving, isEdit }) {
  const [form, setForm] = useState({ ...initial });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const inp = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-300 focus:bg-white transition";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isEdit ? "Edit Layout Task" : "Tambah Layout Task"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Task grafis / desainer layouting</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form className="space-y-4 p-6" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Nama Project
            <input value={form.project} onChange={set("project")} required placeholder="Mis: KOMU03-LUCY-BREAD" className={`mt-1 block font-normal normal-case tracking-normal ${inp}`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Kode Folder
              <input value={form.folder_code} onChange={set("folder_code")} placeholder="Mis: 260624-LTK03-LUCY-BREAD" className={`mt-1 block font-mono font-normal normal-case tracking-normal ${inp}`} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Market
              <select value={form.market} onChange={set("market")} className={`mt-1 block font-normal normal-case ${inp}`}>
                {MARKET_OPTIONS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Talent / Designer
              <input value={form.talent} onChange={set("talent")} placeholder="Nama desainer" className={`mt-1 block font-normal normal-case tracking-normal ${inp}`} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Deadline
              <input type="date" value={form.deadline} onChange={set("deadline")} className={`mt-1 block font-normal normal-case ${inp}`} />
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Status
            <select value={form.status} onChange={set("status")} className={`mt-1 block font-normal normal-case ${inp}`}>
              {LAYOUT_STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Catatan
            <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Catatan tambahan..." className={`mt-1 block font-normal normal-case tracking-normal resize-y ${inp}`} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
