import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOrders } from "../context/OrdersContext";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil,
  Trash2, X, Clock, Flag,
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
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

/* Indonesia national holidays – approximate dates */
const ID_HOLIDAYS = {
  "2025-01-01": "Tahun Baru Masehi",
  "2025-01-29": "Tahun Baru Imlek",
  "2025-03-29": "Hari Raya Nyepi",
  "2025-03-31": "Isra Mi'raj",
  "2025-04-18": "Jumat Agung",
  "2025-03-30": "Idul Fitri 1446 H",
  "2025-03-31": "Idul Fitri 2",
  "2025-05-01": "Hari Buruh",
  "2025-05-12": "Hari Raya Waisak",
  "2025-05-29": "Kenaikan Yesus",
  "2025-06-01": "Hari Lahir Pancasila",
  "2025-06-07": "Idul Adha 1446 H",
  "2025-06-27": "Tahun Baru Islam",
  "2025-08-17": "HUT RI ke-80",
  "2025-09-05": "Maulid Nabi SAW",
  "2025-12-25": "Hari Natal",
  "2025-12-26": "Cuti Bersama Natal",
  "2026-01-01": "Tahun Baru Masehi",
  "2026-01-17": "Isra Mi'raj",
  "2026-01-28": "Tahun Baru Imlek",
  "2026-03-10": "Hari Raya Nyepi",
  "2026-03-20": "Idul Fitri 1447 H",
  "2026-03-21": "Idul Fitri 2",
  "2026-04-03": "Jumat Agung",
  "2026-05-01": "Hari Buruh",
  "2026-05-21": "Kenaikan Yesus Kristus",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-01": "Hari Raya Waisak",
  "2026-05-27": "Idul Adha 1447 H",
  "2026-06-16": "Tahun Baru Islam 1448 H",
  "2026-08-17": "HUT RI ke-81",
  "2026-09-25": "Maulid Nabi SAW",
  "2026-12-25": "Hari Natal",
  "2027-01-01": "Tahun Baru Masehi",
};

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
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required
              placeholder="Nama event"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deskripsi</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
              placeholder="Keterangan tambahan..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Mulai *</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Selesai</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} min={form.date}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Waktu</label>
            <input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Warna</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setForm((p) => ({ ...p, color: c.value }))}
                  className={`h-7 w-7 rounded-full ${c.bg} transition ring-2 ring-offset-2 ${form.color === c.value ? "ring-slate-400" : "ring-transparent"}`}
                  title={c.label} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">Batal</button>
            <button type="submit" disabled={loading}
              className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition">
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
  const { orders } = useOrders();
  const navigate = useNavigate();
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

  /* ── Order deadlines by date ── */
  const deadlinesByDate = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (!o.deadline) return;
      const st = (o.status || "").toLowerCase();
      if (st === "done" || st === "cancel") return;
      if (!map[o.deadline]) map[o.deadline] = [];
      map[o.deadline].push(o);
    });
    return map;
  }, [orders]);

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

  const upcomingDeadlines = useMemo(() => {
    return orders
      .filter((o) => {
        if (!o.deadline || o.deadline < todayStr) return false;
        const st = (o.status || "").toLowerCase();
        return st !== "done" && st !== "cancel";
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 8);
  }, [orders, todayStr]);

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
    } catch { toast.error("Gagal menghapus"); }
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
          <p className="mt-1 text-sm text-slate-500">Jadwal, kegiatan tim, & deadline order.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditItem(null); setSelectedDate(todayStr); setShowModal(true); }}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
            <Plus size={16} /> Tambah Event
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 transition"><ChevronLeft size={18} /></button>
            <h2 className="font-semibold text-slate-800">{MONTHS[viewMonth]} {viewYear}</h2>
            <button onClick={nextMonth} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 transition"><ChevronRight size={18} /></button>
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
              const dayDeadlines = deadlinesByDate[ds] || [];
              const holiday = ID_HOLIDAYS[ds];
              const isToday = ds === todayStr;
              const isOverdue = ds < todayStr && dayDeadlines.length > 0;
              return (
                <div
                  key={ds}
                  onClick={() => openAdd(d)}
                  className={`min-h-[56px] rounded-xl p-1 flex flex-col cursor-pointer transition hover:bg-slate-50 ${
                    isToday ? "bg-violet-50 ring-1 ring-violet-300" : holiday ? "bg-rose-50" : ""
                  }`}
                >
                  <span className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? "bg-violet-600 text-white" : holiday ? "text-rose-600" : "text-slate-700"
                  }`}>
                    {d}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {holiday && (
                      <span className="rounded px-1 text-[8px] font-semibold truncate bg-rose-100 text-rose-600 border border-rose-200" title={holiday}>
                        {holiday.length > 10 ? holiday.slice(0, 10) + "…" : holiday}
                      </span>
                    )}
                    {dayDeadlines.slice(0, 1).map((o) => (
                      <span
                        key={o.id}
                        onClick={(e) => { e.stopPropagation(); navigate("/orders"); }}
                        className={`rounded px-1 text-[8px] font-semibold truncate cursor-pointer border ${
                          isOverdue ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}
                        title={`Deadline: ${o.project}`}
                      >
                        ⏰ {o.project}
                      </span>
                    ))}
                    {dayDeadlines.length > 1 && (
                      <span className="text-[8px] text-amber-500 pl-1">+{dayDeadlines.length - 1} deadline</span>
                    )}
                    {dayEvents.slice(0, dayDeadlines.length > 0 ? 1 : 2).map((ev) => {
                      const col = getColor(ev.color);
                      return (
                        <span
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); if (isAdmin) openEdit(ev); }}
                          className={`rounded px-1 text-[8px] font-semibold truncate ${col.light} border`}
                          title={ev.title}
                        >
                          {ev.title}
                        </span>
                      );
                    })}
                    {(dayEvents.length + dayDeadlines.length) > 3 && (
                      <span className="text-[8px] text-slate-400 pl-1">+{dayEvents.length + dayDeadlines.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-200" /> Deadline order</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-200" /> Hari libur</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-200" /> Event tim</span>
            {isAdmin && <span className="ml-auto">Klik tanggal untuk menambah event</span>}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Upcoming deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Flag size={15} className="text-amber-500" />
                Deadline Mendatang
              </h3>
              <div className="space-y-2">
                {upcomingDeadlines.map((o) => {
                  const diff = Math.ceil((new Date(o.deadline) - new Date()) / 86400000);
                  return (
                    <div key={o.id} onClick={() => navigate("/orders")}
                      className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-2.5 cursor-pointer hover:border-amber-200 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{o.project}</p>
                        <p className="text-[10px] text-slate-500">{o.deadline}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${diff <= 3 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                        {diff}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming events */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-violet-500" />
              Event Mendatang
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
                          {ev.description && <p className="text-xs opacity-70 mt-1 line-clamp-2">{ev.description}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEdit(ev)} className="rounded-lg p-1 opacity-60 hover:opacity-100 transition"><Pencil size={12} /></button>
                            <button onClick={() => handleDelete(ev)} className="rounded-lg p-1 opacity-60 hover:opacity-100 transition"><Trash2 size={12} /></button>
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
      </div>

      {showModal && (
        <EventModal initial={editItem} selectedDate={selectedDate} onClose={closeModal} onSaved={handleSaved} />
      )}
    </div>
  );
}
