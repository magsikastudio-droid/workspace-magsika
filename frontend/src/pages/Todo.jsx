import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock3, ClipboardList, Plus, Play, X, Zap, Edit3, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const STATUS_META = {
  pending:      { label: "Pending",     bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-400"  },
  "in progress":{ label: "In Progress", bg: "bg-sky-100",    text: "text-sky-700",    dot: "bg-sky-500"    },
  done:         { label: "Done",        bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500"},
  failed:       { label: "Gagal",       bg: "bg-rose-100",   text: "text-rose-700",   dot: "bg-rose-500"   },
};

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
  const d = new Date(dateStr + "T00:00:00");
  const today = todayStr();
  if (dateStr === today) return "Hari ini";
  if (dateStr === shiftDate(today, -1)) return "Kemarin";
  if (dateStr === shiftDate(today, 1)) return "Besok";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
};

export default function Todo() {
  const { user } = useAuth();
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [taskInput, setTaskInput] = useState({ title: "", assignee: "", assignee_type: "tim", status: "pending", date: todayStr(), notes: "" });

  useEffect(() => {
    if (user) fetchTasks(date);
  }, [date, fetchTasks, user]);

  const visibleTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date]);

  const grouped = useMemo(() => {
    return visibleTasks.reduce((acc, task) => {
      const bucket = task.assignee_type === "freelance" ? acc.freelance : acc.tim;
      if (!bucket[task.assignee]) bucket[task.assignee] = [];
      bucket[task.assignee].push(task);
      return acc;
    }, { tim: {}, freelance: {} });
  }, [visibleTasks]);

  const stats = useMemo(() => ({
    total: visibleTasks.length,
    done: visibleTasks.filter((t) => t.status === "done").length,
    pending: visibleTasks.filter((t) => t.status === "pending").length,
    inProgress: visibleTasks.filter((t) => t.status === "in progress").length,
    failed: visibleTasks.filter((t) => t.status === "failed").length,
  }), [visibleTasks]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/tasks/auto-generate");
      await fetchTasks(date);
      toast.success("Task berhasil di-generate dari order aktif!");
    } catch {
      toast.error("Gagal generate task");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    await createTask({ ...taskInput, date });
    setShowAdd(false);
    setTaskInput({ title: "", assignee: "", assignee_type: "tim", status: "pending", date, notes: "" });
    fetchTasks(date);
  };

  const handleStatus = async (taskId, status) => {
    await updateTask(taskId, { status });
  };

  const handleDelete = async (taskId) => {
    await deleteTask(taskId);
  };

  return (
    <div className="space-y-6">
      {/* Header + stats */}
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
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Zap size={15} /> {generating ? "Generating..." : "Auto Generate"}
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Plus size={15} /> Task
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            { label: "TOTAL",    value: stats.total,      color: "text-indigo-600"  },
            { label: "PENDING",  value: stats.pending,    color: "text-amber-600"   },
            { label: "IN PROGRESS", value: stats.inProgress, color: "text-sky-600" },
            { label: "DONE",     value: stats.done,       color: "text-emerald-600" },
            { label: "GAGAL",    value: stats.failed,     color: "text-rose-600"    },
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
          <TaskGroup title="Tim Internal" icon="👥" groups={grouped.tim} onStatus={handleStatus} onDelete={handleDelete} />
          <TaskGroup title="Freelance" icon="🎨" groups={grouped.freelance} onStatus={handleStatus} onDelete={handleDelete} />
        </div>
      )}

      {/* Add task modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Tambah Task</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateTask}>
              <label className="block space-y-1.5 text-xs font-medium text-slate-600">
                Judul Task
                <input value={taskInput.title} onChange={(e) => setTaskInput((p) => ({ ...p, title: e.target.value }))} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs font-medium text-slate-600">
                  Assignee
                  <input value={taskInput.assignee} onChange={(e) => setTaskInput((p) => ({ ...p, assignee: e.target.value }))} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300" />
                </label>
                <label className="block space-y-1.5 text-xs font-medium text-slate-600">
                  Tipe
                  <select value={taskInput.assignee_type} onChange={(e) => setTaskInput((p) => ({ ...p, assignee_type: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300">
                    <option value="tim">Tim Internal</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1.5 text-xs font-medium text-slate-600">
                Catatan
                <textarea value={taskInput.notes} onChange={(e) => setTaskInput((p) => ({ ...p, notes: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300" />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskGroup({ title, icon, groups, onStatus, onDelete }) {
  const entries = Object.entries(groups);
  const totalTasks = entries.reduce((s, [, tasks]) => s + tasks.length, 0);
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
        <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Tidak ada task.</div>
      ) : (
        <div className="space-y-4">
          {entries.map(([assignee, tasks]) => (
            <ArtistSection key={assignee} assignee={assignee} tasks={tasks} onStatus={onStatus} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtistSection({ assignee, tasks, onStatus, onDelete }) {
  const initial = assignee?.charAt(0)?.toUpperCase() || "?";
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  let hash = 0;
  for (let i = 0; i < assignee.length; i++) hash = assignee.charCodeAt(i) + ((hash << 5) - hash);
  const bgColor = colors[Math.abs(hash) % colors.length];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${bgColor}`}>{initial}</div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{assignee}</p>
          <p className="text-xs text-slate-400">{tasks.length} task</p>
        </div>
      </div>
      <div className="ml-10 space-y-2">
        {tasks.map((task) => <TaskCard key={task.id} task={task} onStatus={onStatus} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

function TaskCard({ task, onStatus, onDelete }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  return (
    <div className="group rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-slate-200 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${sm.dot}`} />
            <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
          </div>
          {task.notes && (
            <p className="mt-0.5 truncate text-xs text-slate-400 font-mono">{task.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {task.status !== "in progress" && (
            <button onClick={() => onStatus(task.id, "in progress")} title="Mulai" className="rounded-full p-1.5 text-sky-500 hover:bg-sky-50">
              <Play size={13} />
            </button>
          )}
          {task.status !== "done" && (
            <button onClick={() => onStatus(task.id, "done")} title="Selesai" className="rounded-full p-1.5 text-emerald-500 hover:bg-emerald-50">
              <CheckCircle2 size={13} />
            </button>
          )}
          <button onClick={() => onDelete(task.id)} className="rounded-full p-1.5 text-rose-400 hover:bg-rose-50">
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${sm.bg} ${sm.text}`}>{sm.label}</span>
        {task.status === "pending" && (
          <button onClick={() => onStatus(task.id, "in progress")} className="text-xs text-slate-400 hover:text-sky-600">Mulai →</button>
        )}
        {task.status === "in progress" && (
          <button onClick={() => onStatus(task.id, "done")} className="text-xs text-slate-400 hover:text-emerald-600">Selesai →</button>
        )}
      </div>
    </div>
  );
}
