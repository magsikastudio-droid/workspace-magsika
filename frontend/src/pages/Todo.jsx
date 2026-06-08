import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock3, ClipboardList, Plus, Play, X, Calendar } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";

const STATUS_META = {
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700", icon: Circle },
  "in progress": { label: "In Progress", bg: "bg-sky-100", text: "text-sky-700", icon: Play },
  done: { label: "Done", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  failed: { label: "Gagal", bg: "bg-rose-100", text: "text-rose-700", icon: X },
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

export default function Todo() {
  const { user } = useAuth();
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [taskInput, setTaskInput] = useState({ title: "", assignee: "Andre", assignee_type: "tim", status: "pending", date: todayStr(), notes: "" });

  useEffect(() => {
    if (user) {
      fetchTasks(date);
    }
  }, [date, fetchTasks, user]);

  const visibleTasks = useMemo(() => tasks.filter((task) => task.date === date), [tasks, date]);

  const grouped = useMemo(
    () =>
      visibleTasks.reduce(
        (acc, task) => {
          const bucket = task.assignee_type === "freelance" ? acc.freelance : acc.tim;
          if (!bucket[task.assignee]) bucket[task.assignee] = [];
          bucket[task.assignee].push(task);
          return acc;
        },
        { tim: {}, freelance: {} }
      ),
    [visibleTasks]
  );

  const stats = useMemo(
    () => ({
      total: visibleTasks.length,
      done: visibleTasks.filter((task) => task.status === "done").length,
      pending: visibleTasks.filter((task) => task.status === "pending").length,
      inProgress: visibleTasks.filter((task) => task.status === "in progress").length,
      failed: visibleTasks.filter((task) => task.status === "failed").length,
    }),
    [visibleTasks]
  );

  const handleCreateTask = async (event) => {
    event.preventDefault();
    await createTask(taskInput);
    setShowAdd(false);
    setTaskInput({ title: "", assignee: "Andre", assignee_type: "tim", status: "pending", date, notes: "" });
    fetchTasks(date);
  };

  const handleUpdateTask = async (taskId, status) => {
    await updateTask(taskId, { status });
    fetchTasks(date);
  };

  const handleRemoveTask = async (taskId) => {
    await deleteTask(taskId);
    fetchTasks(date);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                <ClipboardList size={18} /> To Do
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Task hari ini</h1>
              <p className="mt-2 text-sm text-slate-500">Kelola task internal dan freelance dengan mudah.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{date}</div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total" value={stats.total} color="#6d4cff" />
            <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
            <StatCard label="In Progress" value={stats.inProgress} color="#0ea5e9" />
            <StatCard label="Done" value={stats.done} color="#10b981" />
            <StatCard label="Gagal" value={stats.failed} color="#ef4444" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={() => setDate(shiftDate(date, -1))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Calendar size={16} /> Sebelumnya
            </button>
            <button onClick={() => setDate(todayStr())} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Hari ini
            </button>
            <button onClick={() => setDate(shiftDate(date, 1))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Berikutnya <Calendar size={16} />
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} /> Tambah Task
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <div className="rounded-full bg-slate-100 p-3 text-slate-700">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Filter tugas</p>
              <p className="text-xs text-slate-500">Tanggal dipilih: {date}</p>
            </div>
          </div>
          <div className="space-y-3">
            {visibleTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{task.title}</p>
                <p className="text-sm text-slate-500">{task.assignee} · {STATUS_META[task.status]?.label}</p>
              </div>
            ))}
            {visibleTasks.length === 0 && <p className="text-sm text-slate-500">Tidak ada task untuk tanggal ini.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Daftar Task</h2>
            <p className="text-sm text-slate-500">Lihat task berdasarkan tim internal dan freelance.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-full px-3 py-2 hover:bg-slate-100">Prev</button>
            <button onClick={() => setDate(shiftDate(date, 1))} className="rounded-full px-3 py-2 hover:bg-slate-100">Next</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuat task...</div>
        ) : visibleTasks.length === 0 ? (
          <div className="text-center py-14 text-slate-500">Tidak ada task untuk tanggal ini.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <TaskGroup title="Tim Internal" groups={grouped.tim} updateStatus={handleUpdateTask} removeTask={handleRemoveTask} />
            <TaskGroup title="Freelance" groups={grouped.freelance} updateStatus={handleUpdateTask} removeTask={handleRemoveTask} />
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Tambah Task Baru</h2>
                <p className="text-sm text-slate-500">Buat task kerja untuk tim dan freelance.</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700">Batal</button>
            </div>
            <form className="grid gap-4" onSubmit={handleCreateTask}>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Judul Task</span>
                  <input value={taskInput.title} onChange={(e) => setTaskInput((prev) => ({ ...prev, title: e.target.value }))} required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Penanggung Jawab</span>
                  <input value={taskInput.assignee} onChange={(e) => setTaskInput((prev) => ({ ...prev, assignee: e.target.value }))} required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Tipe</span>
                  <select value={taskInput.assignee_type} onChange={(e) => setTaskInput((prev) => ({ ...prev, assignee_type: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
                    <option value="tim">Tim Internal</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select value={taskInput.status} onChange={(e) => setTaskInput((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
                    <option value="pending">Pending</option>
                    <option value="in progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Tanggal</span>
                  <input value={taskInput.date} onChange={(e) => setTaskInput((prev) => ({ ...prev, date: e.target.value }))} type="date" required className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Catatan</span>
                <textarea value={taskInput.notes} onChange={(e) => setTaskInput((prev) => ({ ...prev, notes: e.target.value }))} rows={4} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
              </label>
              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Simpan Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-4 text-3xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function TaskGroup({ title, groups, updateStatus, removeTask }) {
  const entries = Object.entries(groups);
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <ClipboardList size={16} />
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Tidak ada task.</div>
      ) : (
        <div className="space-y-4">
          {entries.map(([assignee, tasks]) => (
            <div key={assignee} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{assignee}</p>
                  <p className="text-xs text-slate-500">{tasks.length} task</p>
                </div>
              </div>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="text-sm text-slate-500">{task.notes}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === "done" ? <CheckCircle2 size={18} className="text-emerald-500" /> : task.status === "in progress" ? <Play size={18} className="text-sky-500" /> : <Circle size={18} className="text-amber-500" />}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{STATUS_META[task.status].label}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{task.date}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {task.status !== "pending" && <button onClick={() => updateStatus(task.id, "pending")} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Pending</button>}
                      {task.status !== "in progress" && <button onClick={() => updateStatus(task.id, "in progress")} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">In Progress</button>}
                      {task.status !== "done" && <button onClick={() => updateStatus(task.id, "done")} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Done</button>}
                      {task.status !== "failed" && <button onClick={() => updateStatus(task.id, "failed")} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Failed</button>}
                      <button onClick={() => removeTask(task.id)} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
