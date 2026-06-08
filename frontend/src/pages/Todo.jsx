import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, ClipboardList, GripVertical, Pause, Pencil, Play,
  Plus, Search, Timer, X, Zap,
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
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
};
const fmtElapsed = (seconds) => {
  if (seconds < 60) return `${seconds}d`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}d`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}j ${rm}m`;
};
const avatarColors = ["bg-indigo-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-purple-500","bg-cyan-500"];
const avatarColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length];
};

const STATUS_META = {
  pending:       { label: "Pending",     bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400"   },
  "in progress": { label: "In Progress", bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-500"     },
  done:          { label: "Done",        bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  failed:        { label: "Gagal",       bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"    },
};

/* ─── global 1-second tick ─────────────────────────────────────── */
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* compute live elapsed seconds */
const getElapsed = (task, now) => {
  let base = task.time_elapsed || 0;
  if (task.timer_started) {
    base += Math.floor((now - new Date(task.timer_started).getTime()) / 1000);
  }
  return base;
};

/* ─── main page ─────────────────────────────────────────────────── */
export default function Todo() {
  const { user } = useAuth();
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const { orders } = useOrders();
  const now = useNow();

  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [taskInput, setTaskInput] = useState({
    title: "", assignee: "", assignee_type: "tim", status: "pending", date: todayStr(), notes: "",
  });

  // per-assignee ordered task lists for drag state
  const [dragState, setDragState] = useState({});   // assignee -> task id array
  const dragIdRef = useRef(null);
  const dragOverRef = useRef(null);

  useEffect(() => { if (user) fetchTasks(date); }, [date, fetchTasks, user]);

  // rebuild dragState when tasks or date changes
  const visibleTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date]);

  const grouped = useMemo(() => {
    return visibleTasks.reduce((acc, task) => {
      const bucket = task.assignee_type === "freelance" ? acc.freelance : acc.tim;
      if (!bucket[task.assignee]) bucket[task.assignee] = [];
      bucket[task.assignee].push(task);
      return acc;
    }, { tim: {}, freelance: {} });
  }, [visibleTasks]);

  // initialise per-assignee order from order_num
  useEffect(() => {
    const next = {};
    const all = { ...grouped.tim, ...grouped.freelance };
    for (const [assignee, aTasks] of Object.entries(all)) {
      const sorted = [...aTasks].sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));
      next[assignee] = sorted.map((t) => t.id);
    }
    setDragState(next);
  }, [visibleTasks]);  // eslint-disable-line react-hooks/exhaustive-deps

  const taskMap = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const stats = useMemo(() => ({
    total: visibleTasks.length,
    done: visibleTasks.filter((t) => t.status === "done").length,
    pending: visibleTasks.filter((t) => t.status === "pending").length,
    inProgress: visibleTasks.filter((t) => t.status === "in progress").length,
    failed: visibleTasks.filter((t) => t.status === "failed").length,
  }), [visibleTasks]);

  /* ── auto generate ─────── */
  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/tasks/auto-generate");
      const { created = 0, skipped = 0, error } = res.data || {};
      if (error) toast.error(`Generate error: ${error}`);
      else if (created === 0 && skipped > 0)
        toast.info(`${skipped} task sudah ada, tidak ada yang baru dibuat.`);
      else
        toast.success(`${created} task dibuat, ${skipped} sudah ada.`);
      await fetchTasks(date);
    } catch {
      toast.error("Gagal generate task — pastikan ada order aktif.");
    } finally {
      setGenerating(false);
    }
  };

  /* ── add task ──────────── */
  const handleCreateTask = async (e) => {
    e.preventDefault();
    await createTask({ ...taskInput, date });
    setShowAdd(false);
    setTaskInput({ title: "", assignee: "", assignee_type: "tim", status: "pending", date, notes: "" });
    fetchTasks(date);
  };

  /* ── status change ─────── */
  const handleStatus = useCallback(async (taskId, newStatus) => {
    await updateTask(taskId, { status: newStatus });
  }, [updateTask]);

  /* ── timer toggle ──────── */
  const handleTimer = useCallback(async (task) => {
    if (task.timer_started) {
      // pause: save elapsed + clear started
      const elapsed = getElapsed(task, Date.now());
      await updateTask(task.id, { time_elapsed: elapsed, timer_started: null });
    } else {
      // start
      await updateTask(task.id, { timer_started: new Date().toISOString() });
    }
    fetchTasks(date);
  }, [updateTask, fetchTasks, date]);

  /* ── delete ─────────────── */
  const handleDelete = useCallback(async (taskId) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  /* ── edit save ──────────── */
  const handleEditSave = async (e) => {
    e.preventDefault();
    await updateTask(editTask.id, {
      title: editTask.title,
      notes: editTask.notes,
      assignee: editTask.assignee,
      assignee_type: editTask.assignee_type,
      status: editTask.status,
    });
    setEditTask(null);
    fetchTasks(date);
  };

  /* ── drag reorder ───────── */
  const onDragStart = (e, taskId) => {
    dragIdRef.current = taskId;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, assignee, overTaskId) => {
    e.preventDefault();
    dragOverRef.current = { assignee, overTaskId };
  };
  const onDrop = async (e, assignee) => {
    e.preventDefault();
    const fromId = dragIdRef.current;
    const { assignee: toAssignee, overTaskId } = dragOverRef.current || {};
    if (!fromId || toAssignee !== assignee) return;
    setDragState((prev) => {
      const ids = [...(prev[assignee] || [])];
      const fromIdx = ids.indexOf(fromId);
      const toIdx = ids.indexOf(overTaskId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, fromId);
      // async persist
      ids.forEach((id, idx) => {
        if (taskMap[id]?.order_num !== idx) updateTask(id, { order_num: idx });
      });
      return { ...prev, [assignee]: ids };
    });
    dragIdRef.current = null;
    dragOverRef.current = null;
  };

  /* ── render ─────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              <ClipboardList size={16} /> To Do
            </div>
            <h1 className="text-3xl font-bold text-slate-900">To Do</h1>
            <p className="mt-1 text-sm text-slate-500">Task harian tim — auto-generate dari order aktif</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5">
              <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-1.5 hover:bg-slate-200 text-slate-600">‹</button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-none bg-transparent text-sm font-semibold text-slate-800 outline-none" />
              <button onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-1.5 hover:bg-slate-200 text-slate-600">›</button>
            </div>
            <button
              onClick={handleAutoGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <Zap size={15} /> {generating ? "Generating..." : "Auto Generate"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Plus size={15} /> Task
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            { label: "TOTAL",       value: stats.total,      color: "text-indigo-600"  },
            { label: "PENDING",     value: stats.pending,    color: "text-amber-600"   },
            { label: "IN PROGRESS", value: stats.inProgress, color: "text-sky-600"     },
            { label: "DONE",        value: stats.done,       color: "text-emerald-600" },
            { label: "GAGAL",       value: stats.failed,     color: "text-rose-600"    },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{s.label}</p>
              <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Task columns */}
      {loading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">Memuat task...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-16 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500">Tidak ada task untuk {fmtDateLabel(date)}</p>
          <p className="mt-1 text-sm text-slate-400">Klik "Auto Generate" untuk buat task dari order aktif</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TaskGroup
            title="Tim Internal" icon="👥"
            groups={grouped.tim}
            dragState={dragState}
            taskMap={taskMap}
            now={now}
            onStatus={handleStatus}
            onDelete={handleDelete}
            onTimer={handleTimer}
            onEdit={setEditTask}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
          <TaskGroup
            title="Freelance" icon="🎨"
            groups={grouped.freelance}
            dragState={dragState}
            taskMap={taskMap}
            now={now}
            onStatus={handleStatus}
            onDelete={handleDelete}
            onTimer={handleTimer}
            onEdit={setEditTask}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        </div>
      )}

      {/* Add task modal */}
      {showAdd && (
        <TaskModal
          title="Tambah Task"
          data={taskInput}
          onChange={setTaskInput}
          onSubmit={handleCreateTask}
          onClose={() => setShowAdd(false)}
          orders={orders}
          isAdd
        />
      )}

      {/* Edit task modal */}
      {editTask && (
        <TaskModal
          title="Edit Task"
          data={editTask}
          onChange={setEditTask}
          onSubmit={handleEditSave}
          onClose={() => setEditTask(null)}
        />
      )}
    </div>
  );
}

/* ─── TaskGroup ─────────────────────────────────────────────────── */
function TaskGroup({ title, icon, groups, dragState, taskMap, now, onStatus, onDelete, onTimer, onEdit, onDragStart, onDragOver, onDrop }) {
  const entries = Object.entries(groups);
  const totalTasks = entries.reduce((s, [, t]) => s + t.length, 0);
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-400">{entries.length} org · {totalTasks} task</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Tidak ada task.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(([assignee, aTasks]) => {
            const orderedIds = dragState[assignee] || aTasks.map((t) => t.id);
            const ordered = orderedIds.map((id) => taskMap[id]).filter(Boolean);
            return (
              <ArtistSection
                key={assignee}
                assignee={assignee}
                tasks={ordered}
                now={now}
                onStatus={onStatus}
                onDelete={onDelete}
                onTimer={onTimer}
                onEdit={onEdit}
                onDragStart={onDragStart}
                onDragOver={(e, overId) => onDragOver(e, assignee, overId)}
                onDrop={(e) => onDrop(e, assignee)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── ArtistSection ─────────────────────────────────────────────── */
function ArtistSection({ assignee, tasks, now, onStatus, onDelete, onTimer, onEdit, onDragStart, onDragOver, onDrop }) {
  const initial = assignee?.charAt(0)?.toUpperCase() || "?";
  const bgColor = avatarColor(assignee);
  const totalElapsed = tasks.reduce((s, t) => s + getElapsed(t, now), 0);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${bgColor}`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{assignee}</p>
          <p className="text-xs text-slate-400">
            {tasks.length} task
            {totalElapsed > 0 && <span className="ml-2 text-indigo-500 font-mono">∑ {fmtElapsed(totalElapsed)}</span>}
          </p>
        </div>
      </div>
      <div
        className="ml-10 space-y-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            now={now}
            onStatus={onStatus}
            onDelete={onDelete}
            onTimer={onTimer}
            onEdit={onEdit}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── TaskCard ──────────────────────────────────────────────────── */
function TaskCard({ task, now, onStatus, onDelete, onTimer, onEdit, onDragStart, onDragOver }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = getElapsed(task, now);
  const isRunning = !!task.timer_started;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragOver={(e) => onDragOver(e, task.id)}
      className="group rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-slate-200 transition cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        {/* drag handle */}
        <GripVertical size={14} className="mt-1 shrink-0 text-slate-300 group-hover:text-slate-400" />

        <div className="flex-1 min-w-0">
          {/* title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${sm.dot}`} />
                <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
              </div>
              {task.notes && (
                <p className="mt-0.5 truncate text-xs text-slate-400 font-mono">{task.notes}</p>
              )}
            </div>
            {/* action buttons — show on hover */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 transition group-hover:opacity-100">
              <button
                onClick={() => onTimer(task)}
                title={isRunning ? "Pause timer" : "Start timer"}
                className={`rounded-full p-1.5 transition ${isRunning ? "text-amber-500 hover:bg-amber-50" : "text-sky-500 hover:bg-sky-50"}`}
              >
                {isRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              {task.status !== "done" && (
                <button onClick={() => onStatus(task.id, "done")} title="Selesai" className="rounded-full p-1.5 text-emerald-500 hover:bg-emerald-50 transition">
                  <CheckCircle2 size={13} />
                </button>
              )}
              <button onClick={() => onEdit({ ...task })} title="Edit" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 transition">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(task.id)} title="Hapus" className="rounded-full p-1.5 text-rose-400 hover:bg-rose-50 transition">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* status + timer row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${sm.bg} ${sm.text}`}>{sm.label}</span>
            {/* timer display */}
            {elapsed > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono font-semibold ${isRunning ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-500"}`}>
                <Timer size={10} />
                {fmtElapsed(elapsed)}
                {isRunning && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
              </span>
            )}
            {elapsed === 0 && !isRunning && task.status === "pending" && (
              <button onClick={() => onTimer(task)} className="text-xs text-slate-400 hover:text-sky-600 transition">
                ▷ Mulai timer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TaskModal (add + edit) ────────────────────────────────────── */
function TaskModal({ title, data, onChange, onSubmit, onClose, orders = [], isAdd = false }) {
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
    onChange((p) => ({
      ...p,
      order_id: order.id,
      notes: order.folder_code || p.notes,
    }));
    setOrderSearch("");
    setShowOrderList(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {data.date && <p className="text-xs text-slate-400 mt-0.5">· {data.date}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-4 p-6" onSubmit={onSubmit}>
          {/* Order link (only for add) */}
          {isAdd && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Link ke Order (opsional)</p>
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
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => pickOrder(o)}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition border-b border-slate-50 last:border-0"
                      >
                        <p className="text-sm font-semibold text-slate-900">{o.project}</p>
                        <p className="text-xs text-indigo-500 font-mono">{o.client} · {o.folder_code}</p>
                      </button>
                    ))}
                    {filteredOrders.length === 0 && (
                      <p className="px-4 py-3 text-xs text-slate-400">Tidak ditemukan.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowOrderList(false)}
                      className="w-full py-2 text-xs text-slate-400 hover:bg-slate-50"
                    >
                      Tutup
                    </button>
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

          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            Title
            <input
              value={data.title}
              onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
              required
              placeholder="Mis: Modeling chest rig"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              Assignee
              <input
                value={data.assignee}
                onChange={(e) => onChange((p) => ({ ...p, assignee: e.target.value }))}
                required
                placeholder="Nama"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
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
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              Status
              <select
                value={data.status}
                onChange={(e) => onChange((p) => ({ ...p, status: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
              >
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="done">Done</option>
                <option value="failed">Gagal</option>
              </select>
            </label>
          )}
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            Catatan
            <textarea
              value={data.notes || ""}
              onChange={(e) => onChange((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal font-mono"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Batal
            </button>
            <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
