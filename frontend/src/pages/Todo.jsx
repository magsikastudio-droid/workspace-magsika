import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, CheckCircle2, ClipboardList, GripVertical, Kanban, Loader2, Pause, Pencil, Play,
  Plus, Search, Send, X, Zap, Clock, CheckCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { useOrders } from "../context/OrdersContext";
import { api } from "../lib/api";
import { toast } from "sonner";

/* ─── helpers ─────────────────────────────────────────────────── */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const fmtDateLabel = (dateStr) => {
  const today = todayStr();
  if (dateStr === today) return "Hari ini";
  if (dateStr === shiftDate(today, -1)) return "Kemarin";
  if (dateStr === shiftDate(today, 1)) return "Besok";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
const fmtElapsed = (seconds) => {
  if (!seconds || seconds <= 0) return "0d";
  if (seconds < 60) return `${seconds}d`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}d`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}j ${rm}m`;
};
const fmtClock = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const avatarColors = ["bg-indigo-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-purple-500","bg-cyan-500"];
const avatarColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length];
};

const STATUS_META = {
  pending:          { label: "Pending",     bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400"   },
  "in progress":    { label: "In Progress", bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-500"     },
  in_revision:      { label: "In Revision", bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500"  },
  menunggu_review:  { label: "Review",      bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500"  },
  done:             { label: "Done",        bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  failed:           { label: "Gagal",       bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"    },
};

const KANBAN_COLS = [
  { key: "pending",         label: "Pending",     color: "border-t-amber-400"   },
  { key: "in progress",     label: "In Progress", color: "border-t-sky-400"     },
  { key: "in_revision",     label: "In Revision", color: "border-t-violet-400"  },
  { key: "menunggu_review", label: "Review",      color: "border-t-orange-400"  },
  { key: "done",            label: "Done",        color: "border-t-emerald-400" },
  { key: "failed",          label: "Gagal",       color: "border-t-rose-400"    },
];

const isAfter1630WIB = () => {
  const now = new Date();
  const wibH = (now.getUTCHours() + 7) % 24;
  const wibM = now.getUTCMinutes();
  return wibH > 16 || (wibH === 16 && wibM >= 30);
};

const FEELINGS_TODO = [
  { value: "Semangat", emoji: "😊", active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "Biasa",    emoji: "😐", active: "border-amber-400 bg-amber-50 text-amber-700"    },
  { value: "Lelah",    emoji: "😔", active: "border-rose-400 bg-rose-50 text-rose-700"       },
];

/* ─── global 1-second tick ─────────────────────────────────────── */
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const getElapsed = (task, now) => {
  let base = task.time_elapsed || 0;
  if (task.timer_started) {
    const started = new Date(task.timer_started).getTime();
    if (task.date && task.date < todayStr()) {
      const endOfDay = new Date(task.date + "T23:59:59").getTime();
      base += Math.floor((Math.min(endOfDay, now) - started) / 1000);
    } else {
      base += Math.floor((now - started) / 1000);
    }
  }
  return Math.max(0, base);
};

/* ─── main page ─────────────────────────────────────────────────── */
export default function Todo() {
  const { user } = useAuth();
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const now = useNow();

  const role = user?.role || "talent";
  const isAdminOrPM = role === "admin" || role === "pm";

  const [date, setDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmDone, setConfirmDone] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [taskInput, setTaskInput] = useState({
    title: "", assignee: "", assignee_type: "tim", status: "pending", date: todayStr(), notes: "",
  });

  const [dragState, setDragState] = useState({});
  const dragIdRef = useRef(null);
  const dragOverRef = useRef(null);

  // Daily-report lock (talent only)
  const [reportSubmitted, setReportSubmitted] = useState(null); // null=loading
  const [lockForm, setLockForm] = useState({ work_done: "", feelings: "Semangat", obstacles: "", notes: "" });
  const [lockSubmitting, setLockSubmitting] = useState(false);

  useEffect(() => { if (user) fetchTasks(date); }, [date, fetchTasks, user]);

  // Check daily-report submission status for talent role
  useEffect(() => {
    if (!user || role !== "talent") return;
    if (!isAfter1630WIB() || date !== todayStr()) { setReportSubmitted(true); return; }
    api.get("/daily-reports/today-status")
      .then((r) => setReportSubmitted(r.data.submitted))
      .catch(() => setReportSubmitted(true));
  }, [user, role, date]);

  const visibleTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date]);

  const grouped = useMemo(() => {
    return visibleTasks.reduce((acc, task) => {
      const bucket = task.assignee_type === "freelance" ? acc.freelance : acc.tim;
      if (!bucket[task.assignee]) bucket[task.assignee] = [];
      bucket[task.assignee].push(task);
      return acc;
    }, { tim: {}, freelance: {} });
  }, [visibleTasks]);

  useEffect(() => {
    const next = {};
    const all = { ...grouped.tim, ...grouped.freelance };
    for (const [assignee, aTasks] of Object.entries(all)) {
      const sorted = [...aTasks].sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));
      next[assignee] = sorted.map((t) => t.id);
    }
    setDragState(next);
  }, [visibleTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const taskMap = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const liveDetailTask = useMemo(() => {
    if (!detailTaskId) return null;
    return tasks.find((t) => t.id === detailTaskId) || null;
  }, [detailTaskId, tasks]);

  const knownAssignees = useMemo(() => {
    const names = new Set(tasks.map((t) => t.assignee).filter(Boolean));
    return [...names].sort();
  }, [tasks]);

  const stats = useMemo(() => ({
    total: visibleTasks.length,
    pending: visibleTasks.filter((t) => t.status === "pending").length,
    inProgress: visibleTasks.filter((t) => t.status === "in progress").length,
    inRevision: visibleTasks.filter((t) => t.status === "in_revision").length,
    review: visibleTasks.filter((t) => t.status === "menunggu_review").length,
    done: visibleTasks.filter((t) => t.status === "done").length,
    failed: visibleTasks.filter((t) => t.status === "failed").length,
  }), [visibleTasks]);

  /* ── auto generate ─────── */
  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/tasks/auto-generate", { date });
      const { created = 0, skipped = 0, error } = res.data || {};
      if (error) toast.error(`Generate error: ${error}`);
      else if (created === 0 && skipped > 0) toast.info(`${skipped} task sudah ada.`);
      else toast.success(`${created} task dibuat, ${skipped} sudah ada.`);
      await fetchTasks(date);
    } catch { toast.error("Gagal generate task — pastikan ada order aktif."); }
    finally { setGenerating(false); }
  };

  /* ── add task ──────────── */
  const handleCreateTask = async (e) => {
    e.preventDefault();
    await createTask({ ...taskInput, date });
    setShowAdd(false);
    setTaskInput({ title: "", assignee: "", assignee_type: "tim", status: "pending", date, notes: "" });
    fetchTasks(date);
  };

  /* ── status change — clear timer saat done/failed/menunggu_review ── */
  const handleStatus = useCallback(async (task, newStatus) => {
    const payload = { status: newStatus };
    if (["done", "failed", "menunggu_review"].includes(newStatus)) {
      if (task.timer_started) {
        payload.time_elapsed = getElapsed(task, Date.now());
      }
      payload.timer_started = null;
    }
    await updateTask(task.id, payload);
  }, [updateTask]);

  /* ── tombol Mulai: start timer + auto in-progress jika masih pending ── */
  const handleTimer = useCallback(async (task) => {
    if (task.timer_started) {
      const elapsed = getElapsed(task, Date.now());
      const payload = { time_elapsed: elapsed, timer_started: null };
      if (task.status === "in progress") payload.status = "pending";
      await updateTask(task.id, payload);
    } else {
      const payload = { timer_started: new Date().toISOString() };
      if (task.status === "pending") payload.status = "in progress";
      await updateTask(task.id, payload);
    }
  }, [updateTask]);

  /* ── tombol Done: admin/PM → konfirmasi Telegram, talent → menunggu review ── */
  const handleMarkDone = useCallback((task) => {
    if (isAdminOrPM) {
      setConfirmDone(task);
    } else {
      handleStatus(task, "menunggu_review");
      toast.success("File dikirim untuk review admin.");
    }
  }, [isAdminOrPM, handleStatus]);

  /* ── admin approve/reject dari card ── */
  const handleApprove = useCallback(async (task) => {
    await handleStatus(task, "done");
    toast.success("Task disetujui ✓");
  }, [handleStatus]);

  const handleReject = useCallback(async (task) => {
    await handleStatus(task, "in_revision");
    toast.info("Task dikembalikan ke In Revision.");
  }, [handleStatus]);

  const handleConfirmDone = useCallback(async () => {
    if (!confirmDone) return;
    const liveTask = tasks.find((t) => t.id === confirmDone.id) || confirmDone;
    await handleStatus(liveTask, "done");
    setConfirmDone(null);
  }, [confirmDone, tasks, handleStatus]);

  /* ── delete ─────────────── */
  const handleDelete = useCallback(async (taskId) => { await deleteTask(taskId); }, [deleteTask]);

  /* ── edit save ──────────── */
  const handleEditSave = async (e) => {
    e.preventDefault();
    const payload = {
      title: editTask.title, notes: editTask.notes,
      assignee: editTask.assignee, assignee_type: editTask.assignee_type, status: editTask.status,
    };
    if (["done", "failed", "menunggu_review"].includes(editTask.status) && editTask.timer_started) {
      payload.time_elapsed = getElapsed(editTask, Date.now());
      payload.timer_started = null;
    }
    await updateTask(editTask.id, payload);
    setEditTask(null);
    fetchTasks(date);
  };

  /* ── drag reorder + cross-assignee ── */
  const onDragStart = (e, taskId) => {
    dragIdRef.current = taskId;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, assignee, overTaskId) => {
    e.preventDefault();
    dragOverRef.current = { assignee, overTaskId };
  };

  const onDrop = useCallback(async (e, targetAssignee, targetAssigneeType) => {
    e.preventDefault();
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId) return;
    const fromTask = taskMap[fromId];
    if (!fromTask) return;
    if (fromTask.assignee !== targetAssignee) {
      dragOverRef.current = null;
      await updateTask(fromId, { assignee: targetAssignee, assignee_type: targetAssigneeType });
      await fetchTasks(date);
      return;
    }
    const { overTaskId } = dragOverRef.current || {};
    dragOverRef.current = null;
    if (!overTaskId || overTaskId === fromId) return;
    setDragState((prev) => {
      const ids = [...(prev[targetAssignee] || [])];
      const fromIdx = ids.indexOf(fromId);
      const toIdx = ids.indexOf(overTaskId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, fromId);
      ids.forEach((id, idx) => { if (taskMap[id]?.order_num !== idx) updateTask(id, { order_num: idx }); });
      return { ...prev, [targetAssignee]: ids };
    });
  }, [taskMap, updateTask, fetchTasks, date]);

  const handleLockSubmit = async (e) => {
    e.preventDefault();
    setLockSubmitting(true);
    try {
      await api.post("/daily-reports", lockForm);
      setReportSubmitted(true);
      toast.success("Daily report berhasil disubmit! To Do terbuka kembali.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal submit daily report.");
    } finally {
      setLockSubmitting(false);
    }
  };

  /* ── lock screen (talent, past 16:30, report not yet submitted) ── */
  const isLocked = role === "talent" && date === todayStr() && isAfter1630WIB() && reportSubmitted === false;

  /* ── render ─────────────── */
  if (isLocked) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <BookOpen size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-amber-900">To Do Terkunci</h1>
              <p className="text-xs text-amber-700">Sudah pukul 16:30 — isi daily report dulu untuk membuka To Do</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-violet-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-white" />
              <p className="font-bold text-white">Daily Report Hari Ini</p>
            </div>
            <p className="mt-1 text-violet-200 text-xs">Isi laporan di bawah ini untuk membuka To Do kembali</p>
          </div>

          <form onSubmit={handleLockSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Apa yang dikerjakan hari ini? *</label>
              <textarea
                value={lockForm.work_done}
                onChange={(e) => setLockForm((p) => ({ ...p, work_done: e.target.value }))}
                rows={3}
                placeholder="Ceritakan pekerjaan yang sudah diselesaikan..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Perasaan hari ini</label>
              <div className="flex gap-2">
                {FEELINGS_TODO.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setLockForm((p) => ({ ...p, feelings: f.value }))}
                    className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition ${
                      lockForm.feelings === f.value ? f.active : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {f.emoji} {f.value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kendala hari ini</label>
              <textarea
                value={lockForm.obstacles}
                onChange={(e) => setLockForm((p) => ({ ...p, obstacles: e.target.value }))}
                rows={2}
                placeholder="Adakah hambatan atau tantangan?"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Note tambahan</label>
              <textarea
                value={lockForm.notes}
                onChange={(e) => setLockForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Informasi tambahan..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-none transition"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={lockSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition"
              >
                {lockSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Submit & Buka To Do
              </button>
              <button
                type="button"
                onClick={() => navigate("/daily-report")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Buka Halaman Daily Report
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">To Do</h1>
            <p className="mt-0.5 text-sm text-slate-500">{fmtDateLabel(date)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-600">‹</button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-none bg-transparent text-sm font-semibold text-slate-800 outline-none" />
              <button onClick={() => setDate(shiftDate(date, 1))} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-600">›</button>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setViewMode("list")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <ClipboardList size={14} className="inline mr-1" />List
              </button>
              <button onClick={() => setViewMode("kanban")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === "kanban" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Kanban size={14} className="inline mr-1" />Kanban
              </button>
            </div>
            {isAdminOrPM && (
              <button onClick={handleAutoGenerate} disabled={generating} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
                <Zap size={14} /> {generating ? "Generating..." : "Auto Generate"}
              </button>
            )}
            {isAdminOrPM && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                <Plus size={14} /> Task
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "Total",       value: stats.total,      color: "text-slate-700",   bg: "bg-slate-100"  },
            { label: "Pending",     value: stats.pending,    color: "text-amber-700",   bg: "bg-amber-50"   },
            { label: "In Progress", value: stats.inProgress, color: "text-sky-700",     bg: "bg-sky-50"     },
            { label: "Review",      value: stats.review,     color: "text-orange-700",  bg: "bg-orange-50"  },
            { label: "Done",        value: stats.done,       color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Gagal",       value: stats.failed,     color: "text-rose-700",    bg: "bg-rose-50"    },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">Memuat task...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500">Tidak ada task untuk {fmtDateLabel(date)}</p>
          <p className="mt-1 text-sm text-slate-400">Klik "Auto Generate" untuk buat task dari order aktif</p>
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanView
          tasks={visibleTasks} now={now} isAdminOrPM={isAdminOrPM}
          onTimer={handleTimer} onMarkDone={handleMarkDone}
          onApprove={handleApprove} onReject={handleReject}
          onStatus={handleStatus} onEdit={setEditTask}
          onDetail={(t) => setDetailTaskId(t.id)} onDelete={handleDelete}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TaskGroup
            title="Tim Internal" icon="👥" groups={grouped.tim} assigneeType="tim"
            dragState={dragState} taskMap={taskMap} now={now} isAdminOrPM={isAdminOrPM}
            onTimer={handleTimer} onMarkDone={handleMarkDone}
            onApprove={handleApprove} onReject={handleReject}
            onStatus={handleStatus} onDelete={handleDelete}
            onEdit={setEditTask} onDetail={(t) => setDetailTaskId(t.id)}
            onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
          />
          <TaskGroup
            title="Freelance" icon="🎨" groups={grouped.freelance} assigneeType="freelance"
            dragState={dragState} taskMap={taskMap} now={now} isAdminOrPM={isAdminOrPM}
            onTimer={handleTimer} onMarkDone={handleMarkDone}
            onApprove={handleApprove} onReject={handleReject}
            onStatus={handleStatus} onDelete={handleDelete}
            onEdit={setEditTask} onDetail={(t) => setDetailTaskId(t.id)}
            onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
          />
        </div>
      )}

      {showAdd && (
        <TaskModal
          title="Tambah Task" data={taskInput} onChange={setTaskInput}
          onSubmit={handleCreateTask} onClose={() => setShowAdd(false)}
          orders={orders} knownAssignees={knownAssignees} isAdd
        />
      )}
      {editTask && (
        <TaskModal
          title="Edit Task" data={editTask} onChange={setEditTask}
          onSubmit={handleEditSave} onClose={() => setEditTask(null)}
          knownAssignees={knownAssignees}
        />
      )}
      {confirmDone && (
        <TelegramConfirmModal
          task={confirmDone}
          onConfirm={handleConfirmDone}
          onCancel={() => setConfirmDone(null)}
        />
      )}
      {liveDetailTask && (
        <TaskDetailModal
          task={liveDetailTask}
          orders={orders}
          now={now}
          isAdminOrPM={isAdminOrPM}
          onClose={() => setDetailTaskId(null)}
          onEdit={(t) => { setDetailTaskId(null); setEditTask({ ...t }); }}
        />
      )}
    </div>
  );
}

/* ─── KanbanView ────────────────────────────────────────────────── */
function KanbanView({ tasks, now, isAdminOrPM, onTimer, onMarkDone, onApprove, onReject, onStatus, onEdit, onDetail, onDelete }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map(({ key, label, color }) => {
        const colTasks = tasks.filter((t) => t.status === key);
        const sm = STATUS_META[key];
        return (
          <div key={key} className={`flex-shrink-0 w-72 rounded-2xl border-t-4 border border-slate-200 bg-white p-4 ${color}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${sm.bg} ${sm.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{label}
              </span>
              <span className="text-xs font-semibold text-slate-400">{colTasks.length}</span>
            </div>
            <div className="space-y-2 min-h-[80px]">
              {colTasks.length === 0
                ? <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">Kosong</div>
                : colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} now={now} isAdminOrPM={isAdminOrPM}
                    onTimer={onTimer} onMarkDone={onMarkDone} onApprove={onApprove} onReject={onReject}
                    onDelete={onDelete} onEdit={onEdit} onDetail={onDetail}
                    onDragStart={() => {}} onDragOver={() => {}} compact />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TaskGroup ─────────────────────────────────────────────────── */
function TaskGroup({ title, icon, groups, assigneeType, dragState, taskMap, now, isAdminOrPM, onTimer, onMarkDone, onApprove, onReject, onStatus, onDelete, onEdit, onDetail, onDragStart, onDragOver, onDrop }) {
  const entries = Object.entries(groups);
  const totalTasks = entries.reduce((s, [, t]) => s + t.length, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-400">{entries.length} org · {totalTasks} task</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Tidak ada task.</div>
      ) : (
        <div className="space-y-4">
          {entries.map(([assignee, aTasks]) => {
            const orderedIds = dragState[assignee] || aTasks.map((t) => t.id);
            const ordered = orderedIds.map((id) => taskMap[id]).filter(Boolean);
            return (
              <ArtistSection
                key={assignee} assignee={assignee} tasks={ordered} now={now} isAdminOrPM={isAdminOrPM}
                onTimer={onTimer} onMarkDone={onMarkDone} onApprove={onApprove} onReject={onReject}
                onDelete={onDelete} onEdit={onEdit} onDetail={onDetail}
                onDragStart={onDragStart}
                onDragOver={(e, overId) => onDragOver(e, assignee, overId)}
                onDrop={(e) => onDrop(e, assignee, assigneeType)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── ArtistSection ─────────────────────────────────────────────── */
function ArtistSection({ assignee, tasks, now, isAdminOrPM, onTimer, onMarkDone, onApprove, onReject, onDelete, onEdit, onDetail, onDragStart, onDragOver, onDrop }) {
  const bgColor = avatarColor(assignee);
  const totalElapsed = tasks.reduce((s, t) => s + getElapsed(t, now), 0);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aFinished = ["done", "failed", "menunggu_review"].includes(a.status);
      const bFinished = ["done", "failed", "menunggu_review"].includes(b.status);
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return 0;
    });
  }, [tasks]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${bgColor}`}>
          {assignee?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{assignee}</p>
          <p className="text-xs text-slate-400">
            {tasks.length} task
            {totalElapsed > 0 && <span className="ml-2 text-indigo-500 font-mono">∑ {fmtElapsed(totalElapsed)}</span>}
          </p>
        </div>
      </div>
      <div className="ml-10 space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id} task={task} now={now} isAdminOrPM={isAdminOrPM}
            onTimer={onTimer} onMarkDone={onMarkDone} onApprove={onApprove} onReject={onReject}
            onDelete={onDelete} onEdit={onEdit} onDetail={onDetail}
            onDragStart={onDragStart} onDragOver={onDragOver}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── TaskCard ──────────────────────────────────────────────────── */
function TaskCard({ task, now, isAdminOrPM, onTimer, onMarkDone, onApprove, onReject, onDelete, onEdit, onDetail, onDragStart, onDragOver, compact = false }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = getElapsed(task, now);
  const isDone = task.status === "done";
  const isFailed = task.status === "failed";
  const isReview = task.status === "menunggu_review";
  const isRevision = task.status === "in_revision";
  const isFinished = isDone || isFailed || isReview;
  const isRunning = !!task.timer_started && (!task.date || task.date >= todayStr());
  const isActive = task.status === "pending" || task.status === "in progress" || isRevision;

  const stopProp = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div
      draggable={!compact && isAdminOrPM}
      onDragStart={!compact && isAdminOrPM ? (e) => { e.stopPropagation(); onDragStart(e, task.id); } : undefined}
      onDragOver={compact ? undefined : (e) => onDragOver(e, task.id)}
      onClick={() => onDetail(task)}
      className={`rounded-2xl border transition cursor-pointer ${
        isRunning
          ? "border-sky-300 bg-sky-50"
          : isDone
          ? "border-emerald-300 bg-emerald-50 opacity-70"
          : isFailed
          ? "border-rose-200 bg-rose-50/50 opacity-70"
          : isReview
          ? "border-orange-300 bg-orange-50/40"
          : isRevision
          ? "border-violet-300 bg-violet-50/40"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${!compact ? "active:cursor-grabbing" : ""}`}
    >
      {isDone      && <div className="h-1 rounded-t-2xl bg-emerald-400" />}
      {isFailed    && <div className="h-1 rounded-t-2xl bg-rose-400" />}
      {isReview    && <div className="h-1 rounded-t-2xl bg-orange-400" />}
      {isRevision  && <div className="h-1 rounded-t-2xl bg-violet-400" />}

      {/* Top row: title + edit/delete */}
      <div className="flex items-start gap-2 px-4 pt-3">
        {!compact && <GripVertical size={14} className="mt-1 shrink-0 text-slate-300" />}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${sm.dot}`} />
                {isDone && <span className="text-emerald-500 text-xs font-bold shrink-0">✓</span>}
                {isReview && <span className="text-orange-500 text-xs font-bold shrink-0">⏳</span>}
                <p className={`text-sm font-semibold break-words min-w-0 ${
                  isDone || isFailed ? "line-through text-slate-400" : "text-slate-900"
                }`}>
                  {task.title}
                </p>
              </div>
              {task.notes && (
                <p className="mt-1 text-xs text-slate-500 font-mono whitespace-pre-wrap break-words break-all leading-relaxed">
                  {task.notes}
                </p>
              )}
            </div>
            {isAdminOrPM && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={stopProp(() => onEdit({ ...task }))} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                  <Pencil size={13} />
                </button>
                <button onClick={stopProp(() => onDelete(task.id))} title="Hapus" className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: aksi kiri + status kanan */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">

        {/* Kiri: tombol aksi */}
        <div className="flex items-center gap-1.5">
          {/* Tombol Mulai / timer — hanya untuk task aktif */}
          {isActive && (
            <button
              onClick={stopProp(() => onTimer(task))}
              title={isRunning ? "Pause" : task.status === "pending" ? "Mulai" : "Lanjutkan timer"}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                isRunning
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-600"
              }`}
            >
              {isRunning ? <Pause size={12} /> : <Play size={12} />}
              {isRunning
                ? <><span className="font-mono tracking-tight">{fmtClock(elapsed)}</span><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /></>
                : elapsed > 0
                ? <span className="font-mono tracking-tight">{fmtElapsed(elapsed)}</span>
                : <span>Mulai</span>
              }
            </button>
          )}

          {/* Tombol Done — hanya untuk task aktif */}
          {isActive && (
            <button
              onClick={stopProp(() => onMarkDone(task))}
              title={isAdminOrPM ? "Tandai selesai" : "Kirim untuk review"}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
            >
              <CheckCircle2 size={12} />
              <span>{isAdminOrPM ? "Done" : "Done"}</span>
            </button>
          )}

          {/* Admin/PM: approve & reject untuk task menunggu review */}
          {isReview && isAdminOrPM && (
            <>
              <button
                onClick={stopProp(() => onApprove(task))}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition"
              >
                <CheckCheck size={12} /> Approve
              </button>
              <button
                onClick={stopProp(() => onReject(task))}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <X size={12} /> Tolak
              </button>
            </>
          )}

          {/* Waktu kerja jika sudah selesai */}
          {(isDone || isFailed) && elapsed > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-mono font-semibold text-slate-600">
              <Clock size={12} /> {fmtElapsed(elapsed)}
            </span>
          )}
        </div>

        {/* Kanan: status badge saja */}
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${sm.bg} ${sm.text}`}>
          {sm.label}
        </span>
      </div>
    </div>
  );
}

/* ─── TaskDetailModal ───────────────────────────────────────────── */
function TaskDetailModal({ task, orders, now, isAdminOrPM, onClose, onEdit }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = getElapsed(task, now);
  const linkedOrder = orders.find((o) => o.id === task.order_id);
  const isRunning = !!task.timer_started && (!task.date || task.date >= todayStr());

  const [orderTotal, setOrderTotal] = useState(null);
  useEffect(() => {
    if (!task.order_id) { setOrderTotal(null); return; }
    api.get("/tasks/order-total", { params: { order_id: task.order_id } })
      .then((r) => setOrderTotal(r.data?.total_seconds ?? null))
      .catch(() => setOrderTotal(null));
  }, [task.order_id]);

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sm.bg} ${sm.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} /> {sm.label}
            </span>
            <h2 className={`mt-2 text-base font-bold leading-snug break-words ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>
              {task.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{task.assignee} · {task.date}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 shrink-0 mt-1">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {task.notes && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Catatan</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words break-all leading-relaxed font-mono">{task.notes}</p>
            </div>
          )}
          {linkedOrder && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">Order Terkait</p>
              <p className="text-sm font-semibold text-indigo-900">{linkedOrder.project}</p>
              <p className="text-xs text-indigo-500 font-mono">{linkedOrder.folder_code || linkedOrder.client}</p>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Waktu Kerja Hari Ini</p>
                <p className={`text-sm font-mono font-semibold ${isRunning ? "text-sky-600" : "text-slate-700"}`}>
                  {elapsed > 0 ? fmtElapsed(elapsed) : "Belum dimulai"}
                  {isRunning && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
                </p>
              </div>
            </div>
            {/* Total lintas hari + lintas assignee, per order */}
            {orderTotal !== null && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Total Waktu Pengerjaan</p>
                <p className="text-base font-mono font-bold text-indigo-700">
                  {orderTotal > 0 ? fmtElapsed(orderTotal) : "Belum ada waktu tercatat"}
                </p>
                <p className="text-xs text-indigo-300 font-mono mt-0.5">{linkedOrder?.folder_code || task.order_id?.slice(-6)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Tutup
          </button>
          {isAdminOrPM && (
            <button onClick={() => onEdit(task)} className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              Edit Task
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ─── TelegramConfirmModal ──────────────────────────────────────── */
function TelegramConfirmModal({ task, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
              <Send size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-base">Konfirmasi Selesai</p>
              <p className="text-xs text-sky-100">Cek sebelum tandai done</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            Sudah kirim file ke <span className="font-bold text-sky-600">Telegram group</span> untuk:
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-semibold text-slate-900 text-sm">{task.title}</p>
            {task.notes && <p className="mt-0.5 text-xs text-slate-400 font-mono break-words">{task.notes}</p>}
          </div>
          <p className="mt-3 text-xs text-slate-400">Task hanya bisa ditandai selesai setelah file dikirim ke Telegram.</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <a href="https://t.me/c/3611845591/2" target="_blank" rel="noopener noreferrer" className="flex-1 rounded-2xl border border-sky-300 bg-sky-50 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition text-center">
            Buka Telegram
          </a>
          <button onClick={onConfirm} className="flex-1 rounded-2xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition">
            ✓ Sudah kirim
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TaskModal ─────────────────────────────────────────────────── */
function TaskModal({ title, data, onChange, onSubmit, onClose, orders = [], knownAssignees = [], isAdd = false }) {
  const [orderSearch, setOrderSearch] = useState("");
  const [showOrderList, setShowOrderList] = useState(false);

  const filteredOrders = useMemo(() => {
    if (!orderSearch) return orders.slice(0, 8);
    const q = orderSearch.toLowerCase();
    return orders.filter((o) =>
      o.project?.toLowerCase().includes(q) ||
      o.folder_code?.toLowerCase().includes(q) ||
      o.client?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [orders, orderSearch]);

  const selectedOrder = orders.find((o) => o.id === data.order_id);
  const pickOrder = (order) => {
    onChange((p) => ({ ...p, order_id: order.id, notes: order.folder_code || p.notes }));
    setOrderSearch(""); setShowOrderList(false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {data.date && <p className="text-xs text-slate-400 mt-0.5">· {data.date}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form className="space-y-4 p-6" onSubmit={onSubmit}>
          {isAdd && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Link ke Order (opsional)</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={orderSearch}
                  onChange={(e) => { setOrderSearch(e.target.value); setShowOrderList(true); }}
                  onFocus={() => setShowOrderList(true)}
                  placeholder="Cari project atau kode folder..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-indigo-300"
                />
                {showOrderList && (
                  <div className="absolute z-10 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    {filteredOrders.map((o) => (
                      <button key={o.id} type="button" onClick={() => pickOrder(o)} className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition border-b border-slate-50 last:border-0">
                        <p className="text-sm font-semibold text-slate-900">{o.project}</p>
                        <p className="text-xs text-indigo-500 font-mono">{o.client} · {o.folder_code}</p>
                      </button>
                    ))}
                    {filteredOrders.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">Tidak ditemukan.</p>}
                    <button type="button" onClick={() => setShowOrderList(false)} className="w-full py-2 text-xs text-slate-400 hover:bg-slate-50">Tutup</button>
                  </div>
                )}
              </div>
              {selectedOrder && (
                <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-indigo-800">{selectedOrder.project}</p>
                    <p className="text-xs text-indigo-500 font-mono">{selectedOrder.folder_code}</p>
                  </div>
                  <button type="button" onClick={() => onChange((p) => ({ ...p, order_id: null }))} className="text-indigo-300 hover:text-indigo-600">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Title
            <input
              value={data.title}
              onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
              required placeholder="Mis: Modeling chest rig"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Assignee
              <input
                list="assignee-suggestions"
                value={data.assignee}
                onChange={(e) => onChange((p) => ({ ...p, assignee: e.target.value }))}
                required placeholder="Nama"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
              />
              <datalist id="assignee-suggestions">
                {knownAssignees.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Tipe
              <select
                value={data.assignee_type}
                onChange={(e) => onChange((p) => ({ ...p, assignee_type: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
              >
                <option value="tim">Tim Internal</option>
                <option value="freelance">Freelance</option>
              </select>
            </label>
          </div>

          {!isAdd && (
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Status
              <select
                value={data.status}
                onChange={(e) => onChange((p) => ({ ...p, status: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
              >
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="menunggu_review">Menunggu Review</option>
                <option value="done">Done</option>
                <option value="failed">Gagal</option>
              </select>
            </label>
          )}

          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Catatan
            <textarea
              value={data.notes || ""}
              onChange={(e) => onChange((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="Kode folder, instruksi, atau catatan lain..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal font-mono resize-y"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
