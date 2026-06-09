import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil,
  Trash2, X, Clock,
} from "lucide-react";
import { toast } from "sonner";

const COLOR_OPTIONS = [
  { value: "violet", label: "Ungu", bg: "bg-violet-500", light: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "sky", label: "Biru", bg: "bg-sky-500", light: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "emerald", label: "Hijau", bg: "bg-emerald-500", light: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "rose", label: "Merah", bg: "bg-rose-500", light: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "amber", label: "Kuning", bg: "bg-amber-500", light: "bg-amber-100 text-amber-700 border-amber-200" },
];

function getColor(value) {
  return COLOR_OPTIONS.find((c) => c.value === value) || COLOR_OPTIONS[0];
}

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function EventModal({ initial, selectedDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    date: initial?.date || selectedDate || "",
    end_date: initial?.end_date || "",
    time: initial?.time || "",
    color: initial?.color || "violet",
  });
  const [loading, setLoading] = useState(false);
  const isEdit = !!initial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, end_date: form.end_date || null, time: form.time || null };
      let result;
      if (isEdit) {
        result = await api.patch(`/schedule/${initial.id}`, payload);
        onSaved(result.data.event, "edit");
        toast.success("Event diperbarui");
      } else {
        result = await api.post("/schedule", payload);
        onSaved(result.data.event, "add");
        toast.success("Event ditambahkan");
      }
      onClose();
    } catch {
      toast.error("Gagal menyimpan event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Event" : "Tambah Event"}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              placeholder="Nama event"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Keterangan tambahan..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Mulai *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                min={form.date}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Waktu</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Warna</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c.value }))}
                  className={`h-7 w-7 rounded-full ${c.bg} transition ring-2 ring-offset-2 ${form.color === c.value ? "ring-slate-400" : "ring-transparent"}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {loading ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    api.get("/schedule")
      .then((res) => setEvents(res.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [viewYear, viewMonth]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const dateStr = (d) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const upcomingEvents = useMemo(() => {
    return events
      .filter((ev) => ev.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [events, todayStr]);

  const handleSaved = (item, action) => {
    if (action === "add") setEvents((prev) => [...prev, item]);
    else setEvents((prev) => prev.map((e) => e.id === item.id ? item : e));
  };

  const handleDelete = async (ev) => {
    if (!window.confirm(`Hapus event "${ev.title}"?`)) return;
    try {
      await api.delete(`/schedule/${ev.id}`);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      toast.success("Event dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const openAdd = (d) => {
    if (!isAdmin) return;
    setEditItem(null);
    setSelectedDate(dateStr(d));
    setShowModal(true);
  };

  const openEdit = (ev) => {
    setEditItem(ev);
    setSelectedDate(ev.date);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditItem(null); setSelectedDate(null); };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays size={28} className="text-violet-500" />
            Schedule
          </h1>
          <p className="mt-1 text-sm text-slate-500">Jadwal & kegiatan tim.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditItem(null); setSelectedDate(todayStr); setShowModal(true); }}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
          >
            <Plus size={16} /> Tambah Event
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 transition">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-slate-800">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 transition">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-bold uppercase text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} />;
              const ds = dateStr(d);
              const dayEvents = eventsByDate[ds] || [];
              const isToday = ds === todayStr;
              return (
                <div
                  key={ds}
                  onClick={() => openAdd(d)}
                  className={`min-h-[52px] rounded-xl p-1 flex flex-col cursor-pointer transition hover:bg-slate-50 ${isToday ? "bg-violet-50 ring-1 ring-violet-300" : ""}`}
                >
                  <span className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-violet-600 text-white" : "text-slate-700"}`}>
                    {d}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const col = getColor(ev.color);
                      return (
                        <span
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); isAdmin ? openEdit(ev) : null; }}
                          className={`rounded px-1 text-[9px] font-semibold truncate ${col.light} border`}
                          title={ev.title}
                        >
                          {ev.title}
                        </span>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 pl-1">+{dayEvents.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <p className="mt-3 text-center text-xs text-slate-400">Klik tanggal untuk menambah event</p>
          )}
        </div>

        {/* Upcoming events */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-violet-500" />
            Mendatang
          </h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Tidak ada event mendatang.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((ev) => {
                const col = getColor(ev.color);
                const [yr, mo, dy] = ev.date.split("-");
                return (
                  <div key={ev.id} className={`rounded-2xl border p-3 ${col.light}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{ev.title}</p>
                        <p className="text-xs opacity-75 mt-0.5">
                          {dy} {MONTHS[parseInt(mo) - 1].slice(0, 3)} {yr}
                          {ev.time && ` · ${ev.time}`}
                          {ev.end_date && ev.end_date !== ev.date && ` – ${ev.end_date.split("-")[2]} ${MONTHS[parseInt(ev.end_date.split("-")[1]) - 1].slice(0, 3)}`}
                        </p>
                        {ev.description && (
                          <p className="text-xs opacity-70 mt-1 line-clamp-2">{ev.description}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(ev)}
                            className="rounded-lg p-1 opacity-60 hover:opacity-100 transition"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(ev)}
                            className="rounded-lg p-1 opacity-60 hover:opacity-100 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <EventModal
          initial={editItem}
          selectedDate={selectedDate}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
