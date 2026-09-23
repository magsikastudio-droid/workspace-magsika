import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Users, User as UserIcon, CornerDownRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDateLabel = (dateStr) => {
  const today = todayStr();
  if (dateStr === today) return "Hari ini";
  if (dateStr === shiftDate(today, -1)) return "Kemarin";
  if (dateStr === shiftDate(today, 1)) return "Besok";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export default function AdminTimeline() {
  const { user } = useAuth();
  const isSuperadmin = !!user?.is_superadmin;
  const [view, setView] = useState("mine"); // "mine" | "team"
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    const url = view === "team" ? "/admin-tasks/team" : "/admin-tasks";
    api.get(url, { params: { date } })
      .then((r) => setItems(r.data.tasks || []))
      .catch(() => toast.error("Gagal memuat checklist"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, view]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setSubmitting(true);
    try {
      const res = await api.post("/admin-tasks", { title, date });
      setItems((prev) => [...prev, res.data.task]);
      setNewTitle("");
    } catch {
      toast.error("Gagal menambah item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (item) => {
    setItems((prev) => prev.map((t) => (t.id === item.id ? { ...t, done: !t.done } : t)));
    try {
      await api.patch(`/admin-tasks/${item.id}`, { done: !item.done });
    } catch {
      toast.error("Gagal update, coba lagi");
      load();
    }
  };

  const handleDelete = async (item) => {
    setItems((prev) => prev.filter((t) => t.id !== item.id));
    try {
      await api.delete(`/admin-tasks/${item.id}`);
    } catch {
      toast.error("Gagal menghapus, coba lagi");
      load();
    }
  };

  const grouped = useMemo(() => {
    if (view !== "team") return null;
    const map = {};
    items.forEach((t) => {
      const key = t.owner_full_name || t.owner_username || "?";
      (map[key] = map[key] || []).push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items, view]);

  const doneCount = items.filter((t) => t.done).length;

  const renderItem = (item, readonly) => (
    <div
      key={item.id}
      className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition hover:border-slate-200"
    >
      <button
        onClick={() => !readonly && handleToggle(item)}
        disabled={readonly}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          item.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-indigo-400"
        } ${readonly ? "cursor-default" : "cursor-pointer"}`}
      >
        {item.done && <span className="text-[10px] font-bold text-white">✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] font-medium ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {item.title}
        </p>
        {item.carried_from && (
          <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-amber-600">
            <CornerDownRight size={11} /> Lanjutan dari {fmtDateLabel(item.carried_from).toLowerCase()}, belum selesai
          </p>
        )}
      </div>
      {!readonly && (
        <button
          onClick={() => handleDelete(item)}
          className="shrink-0 rounded-full p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          title="Hapus"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timeline Admin</h1>
          <p className="mt-0.5 text-sm text-slate-500">Checklist kerja harian kamu sendiri — tercatat otomatis buat riwayat.</p>
        </div>
        {isSuperadmin && (
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setView("mine")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === "mine" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <UserIcon size={14} /> Saya
            </button>
            <button
              onClick={() => setView("team")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === "team" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Users size={14} /> Tim
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <button onClick={() => setDate((d) => shiftDate(d, -1))} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">{fmtDateLabel(date)}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 outline-none"
          />
        </div>
        <button onClick={() => setDate((d) => shiftDate(d, 1))} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {view === "mine" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <p className="font-semibold text-slate-900">Checklist Kamu</p>
            <span className="text-xs text-slate-400">{doneCount}/{items.length} selesai</span>
          </div>
          <div className="space-y-2.5 p-5">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Memuat...</p>
            ) : (
              <>
                {items.map((item) => renderItem(item, false))}
                {items.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">Belum ada item — tambahkan di bawah.</p>
                )}
              </>
            )}
          </div>
          <form onSubmit={handleAdd} className="flex items-center gap-2 border-t border-slate-100 px-5 py-4">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tulis kerjaan yang mau dilakukan..."
              className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-300"
            />
            <button
              type="submit"
              disabled={submitting || !newTitle.trim()}
              className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={15} /> Tambah
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="col-span-full py-8 text-center text-sm text-slate-400">Memuat...</p>
          ) : grouped.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-slate-400">Belum ada admin yang isi checklist di tanggal ini.</p>
          ) : (
            grouped.map(([name, tasks]) => (
              <div key={name} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <p className="font-semibold text-slate-800">{name}</p>
                  <span className="text-xs text-slate-400">{tasks.filter((t) => t.done).length}/{tasks.length}</span>
                </div>
                <div className="space-y-2 p-4">
                  {tasks.map((item) => renderItem(item, true))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
