import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Megaphone, Pin, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function AnnouncementCard({ ann, isAdmin, onEdit, onDelete }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition ${ann.pinned ? "border-violet-200 bg-violet-50/30" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {ann.pinned && (
            <span title="Disematkan">
              <Pin size={14} className="text-violet-500 mt-0.5 shrink-0" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 mb-1">{ann.title}</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onEdit(ann)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(ann)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>Oleh: <strong>{ann.author}</strong></span>
        <span>·</span>
        <span>{timeAgo(ann.updated_at || ann.created_at)}</span>
        {ann.updated_at && <span className="italic">(diedit)</span>}
      </div>
    </div>
  );
}

function AnnouncementModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    content: initial?.content || "",
    pinned: initial?.pinned || false,
  });
  const [loading, setLoading] = useState(false);
  const isEdit = !!initial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (isEdit) {
        result = await api.patch(`/announcements/${initial.id}`, form);
        onSaved(result.data.announcement, "edit");
        toast.success("Pengumuman diperbarui");
      } else {
        result = await api.post("/announcements", form);
        onSaved(result.data.announcement, "add");
        toast.success("Pengumuman ditambahkan");
      }
      onClose();
    } catch {
      toast.error("Gagal menyimpan pengumuman");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Pengumuman" : "Pengumuman Baru"}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul</label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              placeholder="Judul pengumuman"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Isi</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              required
              rows={5}
              placeholder="Isi pengumuman..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              <Pin size={13} className="text-violet-500" /> Sematkan di atas
            </span>
          </label>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {loading ? "Menyimpan..." : isEdit ? "Simpan" : "Posting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PengumumanPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    api.get("/announcements")
      .then((res) => setAnnouncements(res.data.announcements || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
    api.patch("/mark-read/announcements").catch(() => {});
  }, []);

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const handleSaved = (item, action) => {
    if (action === "add") {
      setAnnouncements((prev) => [item, ...prev]);
    } else {
      setAnnouncements((prev) => prev.map((a) => a.id === item.id ? item : a));
    }
  };

  const handleDelete = async (ann) => {
    if (!window.confirm(`Hapus pengumuman "${ann.title}"?`)) return;
    try {
      await api.delete(`/announcements/${ann.id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
      toast.success("Pengumuman dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const openEdit = (ann) => {
    setEditItem(ann);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Megaphone size={28} className="text-violet-500" />
            Pengumuman
          </h1>
          <p className="mt-1 text-sm text-slate-500">Info penting dari tim manajemen.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
          >
            <Plus size={16} /> Buat Pengumuman
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Megaphone size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">Belum ada pengumuman.</p>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              Buat Pengumuman Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              ann={ann}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AnnouncementModal
          initial={editItem}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
