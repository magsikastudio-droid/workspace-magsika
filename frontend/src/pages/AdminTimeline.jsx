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

/* Kategori kerjaan admin — bukan cuma buat rapi-rapi tampilan, tapi juga
   biar keliatan pola: bulan ini paling banyak waktu abis ke mana (client,
   tim, freelance, atau pengembangan market). Warna sengaja beda-beda &
   cukup kontras biar tiap kartu kategori langsung kebaca dari jauh, bukan
   deretan kartu putih polos yang bikin ngantuk. */
const CATEGORIES = [
  { key: "market",    label: "Pengembangan Market", emoji: "🚀", bg: "bg-violet-50",  text: "text-violet-700",  chipActive: "bg-violet-600 text-white", solid: "bg-violet-600",  ring: "bg-violet-100" },
  { key: "client",    label: "Client",              emoji: "🤝", bg: "bg-sky-50",     text: "text-sky-700",     chipActive: "bg-sky-600 text-white",    solid: "bg-sky-500",     ring: "bg-sky-100" },
  { key: "tim",       label: "Tim",                 emoji: "👥", bg: "bg-emerald-50", text: "text-emerald-700", chipActive: "bg-emerald-600 text-white", solid: "bg-emerald-600", ring: "bg-emerald-100" },
  { key: "freelance", label: "Freelance",           emoji: "🧑‍💻", bg: "bg-amber-50",   text: "text-amber-700",   chipActive: "bg-amber-600 text-white",  solid: "bg-amber-500",   ring: "bg-amber-100" },
  { key: "lainnya",   label: "Lainnya",             emoji: "📌", bg: "bg-slate-50",   text: "text-slate-600",   chipActive: "bg-slate-700 text-white",  solid: "bg-slate-600",   ring: "bg-slate-100" },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const catOf = (key) => CATEGORY_MAP[key] || CATEGORY_MAP.lainnya;

export default function AdminTimeline() {
  const { user } = useAuth();
  const isSuperadmin = !!user?.is_superadmin;
  const [view, setView] = useState("mine"); // "mine" | "team"
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("market");
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
      const res = await api.post("/admin-tasks", { title, category: newCategory, date });
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

  const byCategory = useMemo(() => {
    const map = {};
    items.forEach((t) => { (map[t.category || "lainnya"] = map[t.category || "lainnya"] || []).push(t); });
    return CATEGORIES.map((c) => ({ ...c, items: map[c.key] || [] })).filter((c) => c.items.length > 0);
  }, [items]);

  const byAdmin = useMemo(() => {
    if (view !== "team") return null;
    const map = {};
    items.forEach((t) => {
      const key = t.owner_full_name || t.owner_username || "?";
      (map[key] = map[key] || []).push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items, view]);

  const doneCount = items.filter((t) => t.done).length;

  const ItemRow = ({ item, readonly }) => (
    <div className="group flex items-center gap-4 rounded-2xl bg-white/70 px-5 py-4 transition hover:bg-white">
      <button
        onClick={() => !readonly && handleToggle(item)}
        disabled={readonly}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          item.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-indigo-400"
        } ${readonly ? "cursor-default" : "cursor-pointer"}`}
      >
        {item.done && <span className="text-sm font-bold text-white">✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-display text-lg font-extrabold leading-snug ${item.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {item.title}
        </p>
        {item.carried_from && (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
            <CornerDownRight size={13} /> Lanjutan dari {fmtDateLabel(item.carried_from).toLowerCase()}
          </p>
        )}
      </div>
      {readonly && (
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${catOf(item.category).bg} ${catOf(item.category).text}`}>
          {catOf(item.category).emoji} {catOf(item.category).label}
        </span>
      )}
      {!readonly && (
        <button
          onClick={() => handleDelete(item)}
          className="shrink-0 rounded-full p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          title="Hapus"
        >
          <X size={18} />
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
        <>
          {/* Form tambah -- kartu sendiri di atas, pilih kategori dulu (pill besar
              berwarna) baru ketik judulnya, biar kategorisasi kerasa cepat & gak
              kayak ngisi form birokrasi. */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Tambah kerjaan baru</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setNewCategory(c.key)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
                    newCategory === c.key ? c.chipActive : `${c.bg} ${c.text} hover:opacity-80`
                  }`}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleAdd} className="flex items-center gap-2.5">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Tulis kerjaan yang mau dilakukan..."
                className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-[15px] outline-none focus:border-indigo-300"
              />
              <button
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus size={16} /> Tambah
              </button>
            </form>
          </div>

          {/* Grid kategori -- tiap kategori yang ada isinya jadi kartu sendiri
              berwarna, side-by-side (bukan satu list panjang ke bawah), biar
              cepat kebaca fokusnya hari ini paling banyak ke mana. */}
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">Memuat...</p>
          ) : byCategory.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-4xl">🗒️</p>
              <p className="mt-3 text-sm font-medium text-slate-400">Belum ada kerjaan buat tanggal ini — tambahkan di atas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-5">
              {byCategory.map((cat) => (
                <div key={cat.key} className={`overflow-hidden rounded-[28px] ${cat.bg} shadow-sm`}>
                  {/* Header warna solid (bukan cuma tint tipis) biar tiap kategori
                      langsung punya identitas kuat & kartu gak keliatan pucat/datar. */}
                  <div className={`flex items-center justify-between px-5 py-5 ${cat.solid}`}>
                    <p className="font-display flex items-center gap-2.5 text-xl font-extrabold text-white">
                      <span className="text-2xl">{cat.emoji}</span> {cat.label}
                    </p>
                    <span className="rounded-full bg-white/25 px-3.5 py-1.5 text-sm font-bold text-white">
                      {cat.items.filter((t) => t.done).length}/{cat.items.length}
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3">
                    {cat.items.map((item) => <ItemRow key={item.id} item={item} readonly={false} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <span>{doneCount}/{items.length} kerjaan selesai hari ini</span>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">Memuat...</p>
          ) : byAdmin.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">Belum ada admin yang isi checklist di tanggal ini.</p>
          ) : (
            byAdmin.map(([name, tasks]) => (
              <div key={name} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="font-display text-lg font-extrabold text-slate-800">{name}</p>
                  <span className="text-xs font-bold text-slate-400">{tasks.filter((t) => t.done).length}/{tasks.length}</span>
                </div>
                <div className="space-y-1.5 p-3">
                  {tasks.map((item) => <ItemRow key={item.id} item={item} readonly={true} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
