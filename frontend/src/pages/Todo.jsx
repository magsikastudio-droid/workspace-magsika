import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, ClipboardList, GripVertical, Kanban, Loader2, Pause, Pencil, Play,
  Plus, Search, Send, X, Zap, Clock, CheckCheck, AlarmClock, Target, Bell, Monitor,
  Copy, Check, ClipboardPaste, Trash2, Link2, Unlink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { useOrders } from "../context/OrdersContext";
import { useStream } from "../context/StreamContext";
import { api } from "../lib/api";
import { subscribe } from "../lib/ws";
import { STATUS_OPTIONS, STATUS_COLORS, normalizeStatus } from "../lib/constants";
import { toast } from "sonner";
import OrderDrawer from "../components/OrderDrawer";

/* ─── helpers ─────────────────────────────────────────────────── */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TELEGRAM_TOPIC_LINK = "https://t.me/c/3611845591/2";

/* Task lama (sebelum auto-generate berhenti nempelin nama tim ke title)
   masih nyimpen "Nama Project — Nama Tim" di title-nya — assignee udah ada
   field sendiri & udah kelompokin per-orang di UI, jadi ini cuma nge-strip
   akhiran itu pas ditampilin biar card-nya bersih (data di DB gak diubah). */
const displayTitle = (task) => {
  const title = task.title || "";
  const assignee = (task.assignee || "").trim();
  if (!assignee) return title;
  const esc = assignee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = new RegExp(`\\s*[—-]\\s*${esc}\\s*$`, "i");
  const stripped = title.replace(suffix, "").trim();
  return stripped || title;
};

/* Kode update harian buat penamaan file yang dikirim tim ke Telegram:
   [TTBBHH] - [NAMA PROJECT] — format Tahun-Bulan-Hari 2 digit + nama task,
   tim tinggal tambahin nomor gambar sendiri di belakang (01, 02, dst). */
const dailyUpdateCode = (projectName) => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd} - ${(projectName || "").toUpperCase()}`;
};
/* ── Copy teks "Urutan Prioritas" ke WhatsApp ─────────────────────
   Admin biasanya nulis manual urutan prioritas tiap orang ke WA tiap
   pagi, padahal datanya (judul, urutan drag, target_progress) udah
   ada di To Do. Ini generate teks siap-copy dari data itu — admin
   tinggal paste ke WA, boleh diedit dulu sebelum kirim (bukan auto-
   send, tetap ada tahap kurasi manual). ── */
const sortForPriorityList = (list) => {
  return [...list].sort((a, b) => {
    const aFinished = ["done", "failed", "menunggu_review"].includes(a.status);
    const bFinished = ["done", "failed", "menunggu_review"].includes(b.status);
    if (aFinished !== bFinished) return aFinished ? 1 : -1;
    return 0;
  });
};
const priorityLineFor = (task) => {
  // Sengaja gak fallback ke task.notes — itu isinya kode folder order,
  // bukan deskripsi progres. Selalu tampilin "Judul - " (walau kosong
  // di belakangnya) biar admin tinggal isi manual detailnya pas kurasi.
  return `${displayTitle(task)} - ${task.target_progress || ""}`;
};
const buildPriorityTextFor = (assignee, tasks) => {
  const ordered = sortForPriorityList(tasks);
  if (ordered.length === 0) return "";
  const lines = ordered.map((t, i) => `${i + 1}. ${priorityLineFor(t)}`);
  return `Urutan Prioritas\n\n${assignee}\n${lines.join("\n")}`;
};
/* "Copy Semua" beda dari copy per-orang — ini buat rekap ke atasan/
   marketer per SUMBER ORDER (Magsika, Eirene, dst), bukan per talent,
   dan nyakup SEMUA task hari itu (Tim + Freelance), gak cuma yang lagi
   kelihatan di satu lane.
   Sumbernya diambil dari order.platform (bukan order.market — market
   ternyata di data real selalu "Magsika" gak pernah diisi beda,
   sedangkan platform yang benar-benar kepakai buat bedain klien, lihat
   kode folder "EIRENE04" dll yang berasal dari PLATFORM_CODES). Prefix
   "Fiverr "/"Etsy " dibuang biar labelnya bersih ("Fiverr Eirene" jadi
   cuma "Eirene"). Task tanpa order_id dianggap "Magsika" (default). */
const platformLabel = (platform) => (platform || "Magsika").replace(/^(Fiverr|Etsy)\s+/i, "");
const buildMarketPriorityText = (tasks, orders, unhandledOrders) => {
  const orderMap = {};
  (orders || []).forEach((o) => { orderMap[o.id] = o; });
  const groups = {};
  for (const t of tasks) {
    const order = t.order_id ? orderMap[t.order_id] : null;
    const market = platformLabel(order?.platform);
    if (!groups[market]) groups[market] = [];
    groups[market].push(t);
  }
  // Order aktif yang belum punya task hari ini ("Belum Terhandle") tetap
  // perlu kelihatan di teks WA ini, biar PM gak kelewat kasih task-nya.
  const unhandledGroups = {};
  for (const o of unhandledOrders || []) {
    const market = platformLabel(o?.platform);
    if (!unhandledGroups[market]) unhandledGroups[market] = [];
    unhandledGroups[market].push(o);
  }
  const markets = new Set([...Object.keys(groups), ...Object.keys(unhandledGroups)]);
  const blocks = Array.from(markets)
    .map((market) => {
      const ordered = sortForPriorityList(groups[market] || []);
      const lines = ordered.map((t, i) => `${i + 1}. ${priorityLineFor(t)}`);
      const unhandled = unhandledGroups[market] || [];
      unhandled.forEach((o, i) => {
        lines.push(`${ordered.length + i + 1}. ${o.project || "Unnamed"} - (belum ada task)`);
      });
      if (lines.length === 0) return "";
      return `*${market}*\nUrutan Prioritas\n${lines.join("\n")}`;
    })
    .filter(Boolean);
  return blocks.join("\n\n");
};
const copyToClipboard = async (text, successMsg) => {
  if (!text.trim()) { toast.info("Belum ada task buat disalin."); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    toast.error("Gagal menyalin — coba lagi.");
  }
};

/* ── Import teks "Urutan Prioritas" dari WA ───────────────────────
   Alur aslinya: admin per-market setor daftar prioritas mereka (judul
   + target + urutan) ke WA, PM yang mindahin manual satu-satu ke To
   Do. Ini parse teks mentah itu jadi draft task — PM tinggal cek/edit
   assignee-nya (baris header di teks itu kadang nama orang, kadang
   nama market/klien, jadi gak bisa dipercaya 100% sebagai assignee)
   terus konfirmasi buat bikin semua sekaligus. ── */
const parsePriorityText = (raw) => {
  if (!raw || !raw.trim()) return [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { current = null; continue; }
    if (/^urutan\s*prioritas$/i.test(trimmed)) continue;
    const item = trimmed.match(/^(?:\d+[.)]|[-•·*])\s*(.+)$/);
    if (item) {
      if (!current) { current = { header: "", items: [] }; blocks.push(current); }
      current.items.push(item[1]);
    } else {
      current = { header: trimmed, items: [] };
      blocks.push(current);
    }
  }
  const rows = [];
  let seq = 0;
  for (const block of blocks) {
    for (const raw of block.items) {
      const dashIdx = raw.indexOf(" - ");
      const title = (dashIdx >= 0 ? raw.slice(0, dashIdx) : raw).trim();
      const target = dashIdx >= 0 ? raw.slice(dashIdx + 3).trim() : "";
      if (!title) continue;
      // assignee SENGAJA dikosongin, bukan diisi dari header block — header
      // itu kadang nama market/klien (bukan nama orang), dan satu blok bisa
      // aja isinya project-project yang perlu dipecah ke talent berbeda-
      // beda (biar gak numpuk/bottleneck di satu orang). PM wajib isi
      // manual tiap baris; header cuma dipajang sebagai label info.
      rows.push({ _key: `p${seq++}`, title, target_progress: target, assignee: "", assignee_type: "tim", duration: "", sourceLabel: block.header || "" });
    }
  }
  return rows;
};

/* Auto-link ke order aktif yang sudah ada — kalau task hasil import gak
   di-link ke order_id, sistem nganggep order-nya "belum terhandle"
   terus (tetep muncul di section Belum Terhandle) padahal sebenernya
   sudah ada task-nya, dan order.artists juga gak ke-update. Cuma match
   kalau judulnya PERSIS sama (setelah dinormalisasi) — supaya gak asal
   nebak-nebak salah order; kalau ambigu/gak ketemu, PM link manual. */
const normalizeForOrderMatch = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const findMatchingOrder = (title, orders) => {
  const norm = normalizeForOrderMatch(title);
  if (!norm) return null;
  const candidates = (orders || []).filter((o) => normalizeForOrderMatch(o.project) === norm);
  return candidates.length === 1 ? candidates[0] : null;
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
const getCountdown = (task, now) => {
  if (!task.duration_seconds) return null;
  return task.duration_seconds - getElapsed(task, now);
};
const fmtCountdown = (secs) => {
  if (secs <= 0) return "Overdue";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const fmtBudget = (secs) => {
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}j ${m}m`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
};

/* Aksen warna identitas per orang (avatar + garis atas lane) — hash nama
   biar satu orang tetap warna yang sama di mana pun dia muncul. */
const AVATAR_ACCENTS = [
  { bg: "bg-indigo-500",  border: "border-t-indigo-500",  ring: "ring-indigo-100",  text: "text-indigo-600",  stroke: "stroke-indigo-500"  },
  { bg: "bg-emerald-500", border: "border-t-emerald-500", ring: "ring-emerald-100", text: "text-emerald-600", stroke: "stroke-emerald-500" },
  { bg: "bg-amber-500",   border: "border-t-amber-500",   ring: "ring-amber-100",   text: "text-amber-600",   stroke: "stroke-amber-500"   },
  { bg: "bg-rose-500",    border: "border-t-rose-500",    ring: "ring-rose-100",    text: "text-rose-600",    stroke: "stroke-rose-500"    },
  { bg: "bg-purple-500",  border: "border-t-purple-500",  ring: "ring-purple-100",  text: "text-purple-600",  stroke: "stroke-purple-500"  },
  { bg: "bg-cyan-500",    border: "border-t-cyan-500",    ring: "ring-cyan-100",    text: "text-cyan-600",    stroke: "stroke-cyan-500"    },
];
const avatarAccent = (name) => {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_ACCENTS[Math.abs(h) % AVATAR_ACCENTS.length];
};

/* Judul task sering diketik admin ala kadarnya (ALL CAPS, campur-campur) —
   dirapikan jadi Capitalize Each Word cuma pas ditampilkan, data asli di
   database gak disentuh. Kata yang ada angkanya (3D, dll) dibiarin apa
   adanya biar gak jadi "3d". */
const toTitleCase = (s) => {
  return (s || "").split(" ").map((w) => {
    if (!w || /\d/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
};

/* Task yang "ditonjolkan" di atas tiap lane: yang timer-nya lagi jalan
   diprioritaskan (itu yang paling relevan buat dilihat sekarang), kalau
   gak ada yang jalan baru task aktif pertama di urutan (prioritas
   berikutnya). Task yang udah kelar (done/failed/review) gak pernah
   ditonjolkan — kerjaannya udah lewat dari tahap itu. */
const pickFeaturedTask = (tasks) => {
  const running = tasks.find((t) => !!t.timer_started);
  if (running) return running;
  return tasks.find((t) => !["done", "failed", "menunggu_review"].includes(t.status)) || null;
};

const STATUS_META = {
  pending:          { label: "Pending",     bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400",   rail: "bg-amber-400"   },
  "in progress":    { label: "In Progress", bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-500",     rail: "bg-sky-500"     },
  in_revision:      { label: "In Revision", bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500",  rail: "bg-violet-500"  },
  menunggu_review:  { label: "Review",      bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500",  rail: "bg-orange-500"  },
  done:             { label: "Done",        bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", rail: "bg-emerald-500" },
  failed:           { label: "Gagal",       bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500",    rail: "bg-rose-500"    },
};

const KANBAN_COLS = [
  { key: "pending",         label: "Pending",     color: "border-t-amber-400"   },
  { key: "in progress",     label: "In Progress", color: "border-t-sky-400"     },
  { key: "in_revision",     label: "In Revision", color: "border-t-violet-400"  },
  { key: "menunggu_review", label: "Review",      color: "border-t-orange-400"  },
  { key: "done",            label: "Done",        color: "border-t-emerald-400" },
  { key: "failed",          label: "Gagal",       color: "border-t-rose-400"    },
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
  const { tasks, initialLoading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const { orders, updateOrder, deleteOrder } = useOrders();
  const now = useNow();
  const ordersOnDay = (date) => orders.filter((o) => (o.order_date || o.created_at?.slice(0, 10)) === date).length;

  /* ── Edit Order langsung di To Do — sebelumnya redirect ke halaman
     Order, sekarang OrderDrawer yang sama dirender in-place biar admin
     gak bolak-balik halaman. Handler-nya sama persis kayak di
     Orders.jsx (reuse OrderDrawer, jadi kontraknya harus sama). ── */
  const [editOrder, setEditOrder] = useState(null);
  const handleSaveOrder = async (updated) => {
    const contributions = (updated.artist_contributions || []).filter((c) => c.name.trim());
    const artistNames = contributions.map((c) => c.name.trim());
    await updateOrder(editOrder.id, {
      ...updated,
      total: Number(updated.total),
      artists: artistNames.length ? artistNames : (updated.artists || "").split(",").map((a) => a.trim()).filter(Boolean),
      artist_contributions: contributions,
      fee_freelance: Number(updated.fee_freelance) || 0,
    });
    setEditOrder(null);
  };
  const handleDeleteOrder = async (id) => {
    if (!confirm("Hapus order ini? Task yang sudah ke-link gak ikut kehapus.")) return;
    await deleteOrder(id);
    setEditOrder(null);
  };
  const handleCompleteMilestoneForOrder = async (orderId, idx) => {
    try {
      await api.post(`/orders/${orderId}/milestones/${idx}/complete`);
      toast.success("Milestone selesai! Milestone berikutnya aktif.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal update milestone");
    }
  };
  const handleActivateMilestoneForOrder = async (orderId, idx) => {
    try {
      await api.post(`/orders/${orderId}/milestones/${idx}/activate`);
      toast.success("Milestone diaktifkan!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengaktifkan milestone");
    }
  };

  const role = user?.role || "talent";
  const isAdminOrPM = role === "admin" || role === "pm";
  // Detail order (harga, client, dll) rahasia -- cuma admin yang boleh buka/edit,
  // beda sama isAdminOrPM yang dipakai buat hak akses task talent/PM biasa.
  const isAdmin = role === "admin";
  const { streaming, connectStreamWithMedia, resumeStream, pendingResume, sendBRB, dismissResume } = useStream();

  const [date, setDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [confirmDone, setConfirmDone] = useState(null);
  const [needDailyUpdate, setNeedDailyUpdate] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [detailEstStart, setDetailEstStart] = useState(null);
  const [taskInput, setTaskInput] = useState({
    title: "", assignee: "", assignee_type: "tim", status: "pending", date: todayStr(), notes: "",
    duration_seconds: null, target_progress: "",
  });
  const [dragState, setDragState] = useState({});
  const dragIdRef = useRef(null);
  const dragOverRef = useRef(null);
  // Selama drag task aktif, animasi hover (membesar/mengecil) di-nonaktifin
  // sementara — kalau enggak, card yang lagi di-drag-over ikut membesar dan
  // ngegeser layout persis di bawah kursor, bikin browser gagal ngedeteksi
  // drop target yang bener (task paling atas/featured jadi kayak gak bisa
  // dipindah posisinya).
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  useEffect(() => {
    const clear = () => setIsDraggingTask(false);
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  useEffect(() => { if (user) fetchTasks(date); }, [date, fetchTasks, user]);

  /* ── Status Online/Istirahat tim — biar admin/PM bisa lihat kalau ada
     yang "Istirahat" kelamaan (indikasi dipakai kabur dari reminder) ── */
  const [presenceMap, setPresenceMap] = useState({}); // {full_name: {work_status, work_status_since}}
  useEffect(() => {
    if (!isAdminOrPM) return;
    const fetchPresence = () => {
      api.get("/team/presence").then((r) => {
        const map = {};
        (r.data?.team || []).forEach((t) => { map[t.full_name] = t; });
        setPresenceMap(map);
      }).catch(() => {});
    };
    fetchPresence();
    const id = setInterval(fetchPresence, 30000);
    return () => clearInterval(id);
  }, [isAdminOrPM]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => t.date === date);
  }, [tasks, date]);

  const grouped = useMemo(() => {
    return visibleTasks.reduce((acc, task) => {
      const bucket = task.assignee_type?.toLowerCase() === "freelance" ? acc.freelance : acc.tim;
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

  const unhandledOrders = useMemo(() => {
    const handledIds = new Set(visibleTasks.map((t) => t.order_id).filter(Boolean));
    return orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "done" || s === "cancel") return false;
      return !handledIds.has(o.id);
    });
  }, [orders, visibleTasks]);

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
    setShowGenerateConfirm(false);
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
    setTaskInput({ title: "", assignee: "", assignee_type: "tim", status: "pending", date, notes: "", duration_seconds: null, target_progress: "" });
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

  /* ── tombol Mulai: start timer + auto-stream jika order punya stream_allowed ── */
  const handleTimer = useCallback(async (task) => {
    if (task.timer_started) {
      /* PAUSE: hentikan timer + kirim BRB overlay ke monitor */
      const elapsed = getElapsed(task, Date.now());
      const payload = { time_elapsed: elapsed, timer_started: null };
      if (task.status === "in progress") payload.status = "pending";
      await updateTask(task.id, payload);
      sendBRB(true); // tampilkan "Be Right Back!" di live monitor
    } else {
      /* START / RESUME: live screen WAJIB */

      // Jika sedang BRB (pause sebelumnya), cabut BRB overlay dulu
      sendBRB(false);

      if (streaming) {
        /* Sudah streaming, langsung start timer saja */
        const payload = { timer_started: new Date().toISOString() };
        if (task.status === "pending") payload.status = "in progress";
        await updateTask(task.id, payload);
        return;
      }

      /* Tampilkan picker — harus dalam user gesture yang sama dengan klik */
      toast.info("📺 Pilih jendela yang ingin di-share untuk memulai timer…", { duration: 5000 });
      let capturedMedia = null;
      try {
        capturedMedia = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 } },
          audio: false,
        });
      } catch (err) {
        if (err.name === "NotAllowedError") {
          toast.error("⛔ Kamu harus share layar untuk memulai timer.");
        } else {
          toast.error("Gagal share layar: " + err.message);
        }
        return;
      }

      const payload = { timer_started: new Date().toISOString() };
      if (task.status === "pending") payload.status = "in progress";
      await updateTask(task.id, payload);
      connectStreamWithMedia(capturedMedia, task.title, task.order_id);
    }
  }, [updateTask, streaming, connectStreamWithMedia, sendBRB]);

  /* ── tombol Done: talent → menunggu review (kalau belum kirim preview
     hari ini ke topik Update Progress, backend nolak dan kita tampilin
     pop out perintah kirim, bukan langsung submit).
     Admin/PM (buat task orang lain): DULU selalu nanya manual "udah
     kirim ke Telegram?" (honor system, gak pernah cek beneran). Sekarang
     dicek dulu ke db.daily_updates (sumber yang sama yang dipakai bot) —
     kalau bot emang udah konfirmasi, langsung submit ke review tanpa
     nanya lagi; kalau belum, kasih tau buat kirim dulu (pop out yang
     sama kayak alur talent). Popup konfirmasi manual jadi fallback
     doang kalau pengecekan API-nya gagal (misal lagi offline). ── */
  const handleMarkDone = useCallback(async (task) => {
    // PM tidak boleh approve task-nya sendiri — statusnya sama kayak
    // talent biasa (submit ke review, admin lain yang approve). PM tetap
    // bisa approve langsung task ORANG LAIN kayak biasa.
    const myName = user?.full_name || user?.username;
    const isOwnTask = task.assignee === myName;
    const canSelfApprove = role === "admin" || (isAdminOrPM && !isOwnTask);

    if (canSelfApprove) {
      try {
        const res = await api.get(`/tasks/${task.id}/daily-update-status`);
        if (res.data?.confirmed) {
          await handleStatus(task, "menunggu_review");
          toast.success("Update Telegram sudah terdeteksi bot — dikirim untuk review.");
        } else {
          setNeedDailyUpdate(task);
        }
      } catch {
        // Gagal cek status (misal API lagi bermasalah) — fallback ke
        // konfirmasi manual biar admin tetap bisa lanjut kerja.
        setConfirmDone(task);
      }
      return;
    }
    try {
      await handleStatus(task, "menunggu_review");
      toast.success("File dikirim untuk review admin.");
    } catch (err) {
      if (err?.response?.data?.detail === "belum_kirim_update_harian") {
        setNeedDailyUpdate(task);
      } else {
        toast.error(err?.response?.data?.detail || "Gagal submit task.");
      }
    }
  }, [isAdminOrPM, role, user, handleStatus]);

  /* ── admin/PM: ingatkan manual — fallback kalau desktop app lagi bug/mati ── */
  const handleRemind = useCallback(async (task) => {
    try {
      const res = await api.post(`/tasks/${task.id}/remind`);
      if (!res.data?.ok) {
        toast.info(res.data?.message || "Tidak ada yang perlu diingatkan saat ini.");
      } else if (res.data.warning) {
        // Reminder terkirim tapi orangnya tidak terhubung — kasih tau jelas,
        // jangan cuma bilang "sukses" padahal kemungkinan besar tidak sampai.
        toast.warning(res.data.warning, { duration: 8000 });
      } else {
        toast.success(`🔔 Reminder terkirim ke ${res.data.assignee}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal kirim reminder.");
    }
  }, []);

  /* ── admin/PM: remote ke PC talent (RustDesk, dijalankan lewat desktop app) ── */
  const handleRemote = useCallback(async (task) => {
    try {
      const res = await api.post(`/team/${encodeURIComponent(task.assignee)}/remote-connect`);
      toast.success(`🖥️ Membuka RustDesk ke ${res.data.target_name}...`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal buka remote access.");
    }
  }, []);

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
      duration_seconds: editTask.duration_seconds || null,
      target_progress: editTask.target_progress || null,
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
    setIsDraggingTask(true);
  };
  const onDragOver = (e, assignee, overTaskId) => {
    e.preventDefault();
    dragOverRef.current = { assignee, overTaskId };
  };

  const onDrop = useCallback(async (e, targetAssignee, targetAssigneeType) => {
    e.preventDefault();
    setIsDraggingTask(false);
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

  /* ── render ─────────────── */
  return (
    <div className="todo-page space-y-[22px]">
      {/* Font khusus redesain (Sora buat judul/nama, IBM Plex Sans buat
          teks biasa, IBM Plex Mono buat angka/jam/kode) — di-scope ke
          class .todo-page doang biar halaman lain tetap Inter kayak
          biasa, gak ikut berubah. */}
      {/* Aplikasi ini di-zoom 0.8 secara global (lihat html{zoom:0.8} di
          index.css) — ukuran font/jarak yang udah disamain persis-piksel
          ke draft (yang dibikin TANPA zoom itu) jadi kelihatan 20% lebih
          kecil dari niatnya begitu ke-render. zoom:1.25 di sini nge-
          batalin zoom parent-nya (0.8 × 1.25 = 1.0) — cuma buat halaman
          To Do, halaman lain tetap ikut zoom 0.8 seperti biasa. */}
      <style>{`
        .todo-page { font-family: "IBM Plex Sans", Inter, sans-serif; zoom: 1.25; }
        .todo-page .font-display { font-family: "Sora", "IBM Plex Sans", sans-serif; }
        .todo-page .font-mono { font-family: "IBM Plex Mono", ui-monospace, monospace; }
      `}</style>
      {/* ── Resume Stream Banner (setelah refresh) ── */}
      {pendingResume && !streaming && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 shadow-sm animate-pulse-slow">
          <div className="flex items-center gap-3">
            {/* Pulsing dot merah tanda "menunggu resume" */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-900">
                Stream dijeda — klik di mana saja untuk melanjutkan
              </p>
              <p className="text-xs text-violet-600">
                Task: <span className="font-medium">{pendingResume.task}</span>
              </p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismissResume(); }}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-violet-500 hover:bg-violet-100 transition border border-violet-200">
            ✕ Batalkan
          </button>
        </div>
      )}

      {/* Header + Statistik digabung — biar halaman gak kepotong-potong
          jadi banyak kotak kecil kayak versi lama. */}
      <div className="rounded-[28px] border border-slate-200 bg-white px-7 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[27px] font-extrabold tracking-tight text-slate-900">To Do</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">{fmtDateLabel(date)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdminOrPM && (
              <button onClick={() => setShowGenerateConfirm(true)} disabled={generating} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-60 transition">
                <Zap size={14} /> {generating ? "Generating..." : "Auto Generate"}
              </button>
            )}
            {isAdminOrPM && (
              <button
                onClick={() => copyToClipboard(buildMarketPriorityText(visibleTasks, orders, unhandledOrders), "Teks urutan prioritas semua market disalin!")}
                title="Copy teks 'Urutan Prioritas' semua task hari ini, dikelompokkan per market"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                <Copy size={14} /> Copy Semua
              </button>
            )}
            {isAdminOrPM && (
              <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                <ClipboardPaste size={14} /> Import dari Teks
              </button>
            )}
            {isAdminOrPM && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                <Plus size={14} /> Task
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5">
              <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-1.5 hover:bg-slate-200 text-slate-600">‹</button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-none bg-transparent text-sm font-semibold text-slate-800 outline-none" />
              <button onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-1.5 hover:bg-slate-200 text-slate-600">›</button>
            </div>
            <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setViewMode("list")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <ClipboardList size={14} className="inline mr-1" />List
              </button>
              <button onClick={() => setViewMode("kanban")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${viewMode === "kanban" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Kanban size={14} className="inline mr-1" />Kanban
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            {[
              { label: "Total",       value: stats.total,      color: "text-slate-700"   },
              { label: "Pending",     value: stats.pending,    color: "text-amber-600"   },
              { label: "In Progress", value: stats.inProgress, color: "text-sky-600"     },
              { label: "Revisi",      value: stats.inRevision, color: "text-violet-600"  },
              { label: "Review",      value: stats.review,     color: "text-orange-600"  },
              { label: "Done",        value: stats.done,       color: "text-emerald-600" },
              { label: "Gagal",       value: stats.failed,     color: "text-rose-600"    },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className={`font-display text-[19px] font-extrabold tabular-nums ${s.color}`}>{s.value}</span>
                <span className="text-[11.5px] font-medium text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Belum Terhandle — order aktif yang belum punya task hari ini */}
      {!initialLoading && viewMode === "list" && unhandledOrders.length > 0 && (
        <UnhandledSection
          orders={unhandledOrders}
          isAdminOrPM={isAdminOrPM}
          isAdmin={isAdmin}
          onOpenOrder={setEditOrder}
          onAddTask={(order) => {
            setTaskInput((p) => ({
              ...p,
              order_id: order.id,
              title: order.project,
              notes: order.folder_code || "",
              date,
            }));
            setShowAdd(true);
          }}
        />
      )}

      {/* Content */}
      {initialLoading ? (
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
          onTimer={handleTimer} onMarkDone={handleMarkDone} onRemind={handleRemind} onRemote={handleRemote}
          onApprove={handleApprove} onReject={handleReject}
          onStatus={handleStatus} onEdit={setEditTask}
          onDetail={(t) => setDetailTaskId(t.id)} onDelete={handleDelete}
        />
      ) : (
        <>
          <PersonLanesGrid
            groups={grouped.tim} assigneeType="tim"
            orders={orders} dragState={dragState} taskMap={taskMap} now={now} isAdminOrPM={isAdminOrPM}
            presenceMap={presenceMap} isDraggingTask={isDraggingTask}
            onTimer={handleTimer} onMarkDone={handleMarkDone} onRemind={handleRemind} onRemote={handleRemote}
            onApprove={handleApprove} onReject={handleReject}
            onStatus={handleStatus} onDelete={handleDelete}
            onEdit={setEditTask}
            onDetail={(t, estStart) => { setDetailTaskId(t.id); setDetailEstStart(estStart ?? null); }}
            onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
          />
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Freelance &amp; Update Harian</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <FreelanceChecklist groups={grouped.freelance} isAdminOrPM={isAdminOrPM} onStatus={handleStatus} />
            <TeamUpdateChecklist groups={grouped.tim} orders={orders} className="sm:col-span-1 xl:col-span-2" />
          </div>
        </>
      )}

      {showGenerateConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                  <Zap size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-base">Auto Generate Task</p>
                  <p className="text-xs text-indigo-100">Konfirmasi sebelum generate</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 leading-relaxed">
                Generate task otomatis untuk <span className="font-bold text-indigo-600">{fmtDateLabel(date)}</span>?
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Proses ini akan membuat 1 task per order aktif. Task yang sudah ada tidak akan ditimpa.
              </p>
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setShowGenerateConfirm(false)} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Batal
              </button>
              <button onClick={handleAutoGenerate} className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
                Ya, Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <TaskModal
          title="Tambah Task" data={taskInput} onChange={setTaskInput}
          onSubmit={handleCreateTask} onClose={() => setShowAdd(false)}
          orders={orders} knownAssignees={knownAssignees} isAdd
        />
      )}
      {showImport && (
        <ImportPriorityModal
          date={date} knownAssignees={knownAssignees} orders={orders}
          createTask={createTask}
          onClose={() => setShowImport(false)}
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
      {needDailyUpdate && (
        <NeedDailyUpdateModal
          task={needDailyUpdate}
          onClose={() => setNeedDailyUpdate(null)}
        />
      )}
      {liveDetailTask && (
        <TaskDetailModal
          task={liveDetailTask}
          orders={orders}
          now={now}
          isAdminOrPM={isAdminOrPM}
          isAdmin={isAdmin}
          estStart={detailEstStart}
          onClose={() => { setDetailTaskId(null); setDetailEstStart(null); }}
          onEdit={(t) => { setDetailTaskId(null); setEditTask({ ...t }); }}
          onOpenOrder={(o) => { setDetailTaskId(null); setEditOrder(o); }}
          onTimer={handleTimer} onMarkDone={handleMarkDone} onRemind={handleRemind} onRemote={handleRemote}
          onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete}
        />
      )}
      {editOrder && (
        <OrderDrawer
          order={editOrder}
          ordersOnDay={ordersOnDay}
          onClose={() => setEditOrder(null)}
          onSave={handleSaveOrder}
          onDelete={handleDeleteOrder}
          onCompleteMilestone={handleCompleteMilestoneForOrder}
          onActivateMilestone={handleActivateMilestoneForOrder}
        />
      )}
    </div>
  );
}

/* ─── KanbanView ────────────────────────────────────────────────── */
function KanbanView({ tasks, now, isAdminOrPM, onTimer, onMarkDone, onRemind, onRemote, onApprove, onReject, onStatus, onEdit, onDetail, onDelete }) {
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
                    onTimer={onTimer} onMarkDone={onMarkDone} onRemind={onRemind} onRemote={onRemote} onApprove={onApprove} onReject={onReject}
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

/* ─── FreelanceChecklist ────────────────────────────────────────────
   Freelancer gak login ke workspace, jadi semua tombol (Mulai/Ingatkan/
   Remote/dll) di lane biasa cuma makan tempat tanpa guna buat mereka.
   Ini gantinya: list simpel, checkbox otomatis nyala kalau bot Telegram
   udah nangkep update hari ini, dan admin/PM tinggal klik buat approve
   (toggle status done) — satu-satunya aksi yang mereka perlu. ── */
function FreelanceChecklist({ groups, isAdminOrPM, onStatus }) {
  const flat = useMemo(() => Object.values(groups).flat(), [groups]);

  // Freelancer gak masuk grup Telegram, jadi bot gak bisa deteksi/
  // konfirmasi update mereka — beda dari Tim Internal. Centangnya
  // murni manual oleh admin/PM, gak ada gerbang konfirmasi bot lagi.
  const handleToggle = async (task) => {
    if (!isAdminOrPM) return;
    const isDone = task.status === "done";
    try {
      await onStatus(task, isDone ? "pending" : "done");
    } catch {
      toast.error("Gagal update status.");
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
        <span className="text-lg">🎨</span>
        <h3 className="font-display font-bold text-slate-800">Freelance</h3>
        <span className="ml-auto text-xs text-slate-400">{flat.length} task</span>
      </div>
      {flat.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada task freelance hari ini.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {flat.map((task) => {
            const isDone = task.status === "done";
            return (
              <div key={task.id} className="flex items-center gap-3 px-6 py-[11px]">
                <button
                  onClick={() => handleToggle(task)}
                  disabled={!isAdminOrPM}
                  title={isDone ? "Batalkan approve" : "Tandai selesai (manual, freelance gak bisa dikonfirmasi bot)"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isDone ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-indigo-400"
                  } ${isAdminOrPM ? "cursor-pointer" : "cursor-default"}`}
                >
                  {isDone && <Check size={12} className="text-white" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14.5px] font-medium ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}>
                    {toTitleCase(displayTitle(task))}
                  </p>
                  <p className="text-[11.5px] text-slate-400">{task.assignee}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── TeamUpdateChecklist ─────────────────────────────────────────────
   Checklist "sudah kirim update Telegram hari ini apa belum", per market.
   Beda dari FreelanceChecklist: ini bukan status task (pending/done), tapi
   status kirim-update — jadi tetap tercentang walau admin belum approve
   ke "done", dan gak bisa dicentang manual sama sekali (murni dari bot). ── */
function TeamUpdateChecklist({ groups, orders, className = "" }) {
  const tasks = useMemo(() => Object.values(groups).flat(), [groups]);
  const orderMap = useMemo(() => {
    const m = {};
    (orders || []).forEach((o) => { m[o.id] = o; });
    return m;
  }, [orders]);

  const marketGroups = useMemo(() => {
    const g = {};
    for (const t of tasks) {
      const order = t.order_id ? orderMap[t.order_id] : null;
      const market = platformLabel(order?.platform);
      if (!g[market]) g[market] = [];
      g[market].push(t);
    }
    return g;
  }, [tasks, orderMap]);

  const [confirmedMap, setConfirmedMap] = useState({});
  const idsKey = useMemo(() => tasks.map((t) => t.id).sort().join(","), [tasks]);

  useEffect(() => {
    if (!idsKey) { setConfirmedMap({}); return; }
    let alive = true;
    api.get("/tasks/daily-update-status-bulk", { params: { ids: idsKey } })
      .then((r) => { if (alive) setConfirmedMap(r.data || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [idsKey]);

  useEffect(() => {
    return subscribe("daily_update_confirmed", (msg) => {
      if (!msg?.task_id) return;
      setConfirmedMap((prev) => ({ ...prev, [msg.task_id]: !msg.revoked }));
    });
  }, []);

  const doneCount = tasks.filter((t) => confirmedMap[t.id]).length;
  const marketNames = Object.keys(marketGroups).sort();

  return (
    <div className={`w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
        <span className="text-lg">📋</span>
        <h3 className="font-display font-bold text-slate-800">Update Hari Ini</h3>
        <span className="ml-auto text-xs text-slate-400">{doneCount}/{tasks.length} update</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada task tim internal hari ini.</p>
      ) : (
        <div className="px-6 py-4 sm:columns-2 sm:gap-x-8 [column-fill:balance]">
          {marketNames.map((market) => (
            <div key={market} className="break-inside-avoid pb-4">
              <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-slate-700">{market}</p>
              <div className="space-y-2.5">
                {marketGroups[market].map((task) => {
                  const isConfirmed = !!confirmedMap[task.id];
                  return (
                    <div key={task.id} className="flex items-center gap-2.5">
                      <span
                        title={isConfirmed ? "Sudah kirim update hari ini" : "Belum kirim update hari ini"}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isConfirmed ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                        }`}
                      >
                        {isConfirmed && <Check size={12} className="text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13.5px] font-medium ${isConfirmed ? "text-slate-700" : "text-slate-400"}`}>
                          {toTitleCase(displayTitle(task))}
                        </p>
                        <p className="text-[11px] text-slate-400">{task.assignee}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── PersonLanesGrid ───────────────────────────────────────────────
   Redesign: dulu satu kartu "Tim Internal" isinya semua orang berjejer
   ke bawah + panel checklist duplikat di sampingnya. Sekarang tiap
   orang jadi kartu (lane) sendiri dalam grid 2 kolom — checklist-nya
   digabung langsung jadi checkbox di tiap baris task, gak ada panel
   duplikat lagi. ── */
function PersonLanesGrid({ groups, assigneeType, orders, dragState, taskMap, now, isAdminOrPM, presenceMap, isDraggingTask, onTimer, onMarkDone, onRemind, onRemote, onApprove, onReject, onStatus, onDelete, onEdit, onDetail, onDragStart, onDragOver, onDrop }) {
  const entries = Object.entries(groups);
  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
        Tidak ada task tim internal hari ini.
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([assignee, aTasks]) => {
        const orderedIds = dragState[assignee] || aTasks.map((t) => t.id);
        const ordered = orderedIds.map((id) => taskMap[id]).filter(Boolean);
        return (
          <PersonLane
            key={assignee} assignee={assignee} tasks={ordered} orders={orders} now={now} isAdminOrPM={isAdminOrPM}
            presence={presenceMap[assignee]} isDraggingTask={isDraggingTask}
            onTimer={onTimer} onMarkDone={onMarkDone} onRemind={onRemind} onRemote={onRemote} onApprove={onApprove} onReject={onReject}
            onDelete={onDelete} onEdit={onEdit} onDetail={onDetail}
            onDragStart={onDragStart}
            onDragOver={(e, overId) => onDragOver(e, assignee, overId)}
            onDrop={(e) => onDrop(e, assignee, assigneeType)}
          />
        );
      })}
    </div>
  );
}

/* ─── PersonLane ────────────────────────────────────────────────────
   Satu kartu per orang: header (avatar + nama + ring progres hari ini),
   task yang lagi/paling perlu dikerjakan ditonjolkan jadi kartu besar
   berwarna, sisanya list ringkas — keduanya sekarang dirender pakai satu
   komponen (TalentTaskRow) yang morph ukurannya lewat hover: task mana
   pun yang lagi di-hover (`hoveredId`) yang tampil besar, sisanya
   (termasuk task andalan default) otomatis mengecil. Posisi tiap task
   TIDAK pindah — cuma ukurannya yang animasi. Semua logic asli (schedule
   estimasi jam, drag-reorder, presence) dipertahankan persis dari versi
   lama. ── */
function PersonLane({ assignee, tasks, orders, now, isAdminOrPM, presence, isDraggingTask, onTimer, onMarkDone, onRemind, onRemote, onApprove, onReject, onDelete, onEdit, onDetail, onDragStart, onDragOver, onDrop }) {
  const accent = avatarAccent(assignee);
  const [hoveredId, setHoveredId] = useState(null);
  // Selama ada drag task aktif, hover diabaikan biar card gak membesar/
  // mengecil sendiri di bawah kursor (itu yang bikin drop target-nya
  // gagal ke-detect browser, khususnya buat task yang lagi tampil besar).
  const handleHoverStart = useCallback((id) => { if (!isDraggingTask) setHoveredId(id); }, [isDraggingTask]);
  const handleHoverEnd = useCallback((id) => { if (!isDraggingTask) setHoveredId((h) => (h === id ? null : h)); }, [isDraggingTask]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aFinished = ["done", "failed", "menunggu_review"].includes(a.status);
      const bFinished = ["done", "failed", "menunggu_review"].includes(b.status);
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return 0;
    });
  }, [tasks]);

  /* ── Real-time schedule: estimated start time per task ────────────
     Default work start: 09:00. Lunch break: 11:30–13:00.
     Tasks are iterated in drag/order_num order (the `tasks` prop).
     Done / failed / menunggu_review tasks are skipped (they're over).
     Remaining duration of each task (duration - elapsed) drives the
     cursor so the schedule updates live every second via `now`.    */
  const schedule = useMemo(() => {
    const WORK_START  = 9 * 60;        // 09:00 in minutes from midnight
    const BREAK_START = 11 * 60 + 30;  // 11:30
    const BREAK_END   = 13 * 60;       // 13:00

    // Current time-of-day in minutes (fractional seconds included)
    const d = new Date(now);
    const nowMins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

    // Cursor starts at current time (or 09:00 if before work hours)
    // This makes all estimates relative to NOW, not to the fixed 09:00 plan
    const result = {};
    let cursor = Math.max(WORK_START, nowMins);

    for (const task of tasks) {
      // Skip completed tasks — they don't occupy future slots
      if (["done", "failed", "menunggu_review"].includes(task.status)) continue;

      // If cursor fell into the break window, push to end of break
      if (cursor >= BREAK_START && cursor < BREAK_END) cursor = BREAK_END;

      // Record this task's estimated start label (floor to nearest minute)
      if (task.duration_seconds) {
        const h = Math.floor(cursor / 60);
        const m = Math.floor(cursor % 60);
        result[task.id] = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      } else {
        result[task.id] = null; // no duration → can't schedule
      }

      // Advance cursor by the task's REMAINING duration
      if (task.duration_seconds) {
        const elapsed = getElapsed(task, now);
        const remainMins = Math.max(0, task.duration_seconds - elapsed) / 60;
        let endMins = cursor + remainMins;
        // If task spans the lunch break, add break length (90 min)
        if (cursor < BREAK_START && endMins > BREAK_START) {
          endMins += BREAK_END - BREAK_START;
        }
        cursor = endMins;
      }
    }
    return result;
  }, [tasks, now]);

  const featured = useMemo(() => pickFeaturedTask(sortedTasks), [sortedTasks]);
  const restTasks = useMemo(() => sortedTasks.filter((t) => t.id !== featured?.id), [sortedTasks, featured]);
  const activeId = isDraggingTask ? (featured?.id ?? null) : (hoveredId ?? featured?.id ?? null);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const ringC = 2 * Math.PI * 18;
  const ringOffset = ringC - (ringC * pct) / 100;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`overflow-hidden rounded-[26px] border border-t-[5px] border-slate-200 bg-white shadow-sm ${accent.border}`}
    >
      <div className="flex items-center gap-3.5 px-6 py-5">
        <div className="relative shrink-0">
          <div className={`flex h-[46px] w-[46px] items-center justify-center rounded-full text-base font-bold text-white ${accent.bg}`}>
            {assignee?.charAt(0)?.toUpperCase() || "?"}
          </div>
          {/* Titik status — prioritas: desktop app tidak terhubung (abu-abu,
              paling penting, artinya reminder TIDAK akan pernah sampai ke dia
              apapun status Online/Istirahat-nya) > Istirahat (kuning) > Online (hijau) */}
          {presence && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                !presence.desktop_connected ? "bg-slate-400" : presence.work_status === "break" ? "bg-amber-400" : "bg-emerald-500"
              }`}
              title={
                !presence.desktop_connected
                  ? "🔌 Desktop app TIDAK terhubung — reminder tidak akan sampai ke laptop-nya"
                  : presence.work_status === "break"
                  ? `☕ Istirahat${presence.work_status_since ? ` sejak ${new Date(presence.work_status_since).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                  : "⚡ Online & terhubung"
              }
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16.5px] font-bold text-slate-900">{assignee}</p>
          <p className="mt-px text-[12.5px] text-slate-400">{tasks.length} task</p>
        </div>
        {isAdminOrPM && (
          <button
            onClick={() => copyToClipboard(buildPriorityTextFor(assignee, tasks), `Prioritas ${assignee} disalin!`)}
            title="Copy teks 'Urutan Prioritas' buat di-paste ke WhatsApp"
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <Copy size={14} />
          </button>
        )}
        <div className="relative h-11 w-11 shrink-0">
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-slate-100" />
            <circle
              cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round"
              className={accent.stroke}
              strokeDasharray={ringC} strokeDashoffset={ringOffset}
              style={{ transition: "stroke-dashoffset .3s" }}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold ${accent.text}`}>{pct}%</span>
        </div>
      </div>

      {featured && (
        <TalentTaskRow
          task={featured} orders={orders} now={now} isAdminOrPM={isAdminOrPM}
          estStart={schedule[featured.id] ?? null}
          isBig={activeId === featured.id}
          onHoverStart={handleHoverStart} onHoverEnd={handleHoverEnd}
          onTimer={onTimer} onMarkDone={onMarkDone} onApprove={onApprove} onReject={onReject} onDelete={onDelete}
          onDetail={(t, est) => onDetail(t, est ?? schedule[t.id] ?? null)}
          onDragStart={onDragStart} onDragOver={onDragOver}
        />
      )}

      <div>
        {restTasks.length === 0 && !featured && (
          <p className="px-5 py-6 text-center text-xs text-slate-400">Tidak ada task.</p>
        )}
        {restTasks.map((task) => (
          <TalentTaskRow
            key={task.id} task={task} orders={orders} now={now} isAdminOrPM={isAdminOrPM}
            estStart={schedule[task.id] ?? null}
            isBig={activeId === task.id}
            onHoverStart={handleHoverStart} onHoverEnd={handleHoverEnd}
            onTimer={onTimer} onMarkDone={onMarkDone} onApprove={onApprove} onReject={onReject} onDelete={onDelete}
            onDetail={onDetail}
            onDragStart={onDragStart} onDragOver={onDragOver}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── TalentTaskRow ─────────────────────────────────────────────────
   Satu komponen buat kedua tampilan (dulu FeaturedTaskCard & CompactTaskRow
   terpisah): `isBig` nentuin apakah render sebagai kartu besar berwarna
   atau baris ringkas. Posisinya di DOM TETAP di tempatnya masing-masing —
   yang berubah cuma ukurannya (animasi via transition-all + collapse
   grid-rows), dipicu hover (lihat `activeId` di PersonLane). Saat besar,
   durasi pengerjaan & kode folder ikut kebuka (sebelumnya cuma keliatan
   di detail modal). ── */
function TalentTaskRow({ task, orders, now, isAdminOrPM, estStart, isBig, onHoverStart, onHoverEnd, onTimer, onMarkDone, onApprove, onReject, onDelete, onDetail, onDragStart, onDragOver }) {
  const isDone = task.status === "done";
  const isFailed = task.status === "failed";
  const isReview = task.status === "menunggu_review";
  const isRevision = task.status === "in_revision";
  const isFinished = isDone || isFailed;
  const isActive = task.status === "pending" || task.status === "in progress" || isRevision;
  const isRunning = !!task.timer_started && (!task.date || task.date >= todayStr());
  const elapsed = getElapsed(task, now);
  const countdown = getCountdown(task, now);
  const hasStarted = elapsed > 0 || !!task.timer_started;
  const isOverdue = !isFinished && countdown !== null && countdown <= 0 && hasStarted;
  const isUrgent = !isFinished && countdown !== null && countdown > 0 && countdown <= 1800 && hasStarted;
  const rail = STATUS_META[task.status]?.rail || "bg-slate-200";
  const sub = task.target_progress || "";
  const linkedOrderInfo = useMemo(() => (task.order_id && orders?.length ? orders.find((o) => o.id === task.order_id) : null), [task.order_id, orders]);
  const streamAllowed = !!linkedOrderInfo?.stream_allowed;
  const folderCode = task.notes || linkedOrderInfo?.folder_code || "";
  const stopProp = (fn) => (e) => { e.stopPropagation(); fn(); };

  // Link ke pesan update spesifik di Telegram — cuma perlu di-fetch pas task
  // selesai DAN lagi ditampilin besar (buat tombol "Cek Update").
  const [telegramLink, setTelegramLink] = useState(null);
  useEffect(() => {
    if (!isBig || !isDone) return;
    let alive = true;
    api.get(`/tasks/${task.id}/daily-update-status`)
      .then((r) => { if (alive) setTelegramLink(r.data?.telegram_link || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isBig, isDone, task.id]);

  const checkTitle = isDone ? "Selesai" : isReview ? "Menunggu review admin" : isFailed ? (isAdminOrPM ? "Tandai selesai" : "Gagal") : isAdminOrPM ? "Tandai selesai" : "Kirim untuk review";
  const checkDisabled = isDone || isReview || (isFailed && !isAdminOrPM);
  const handleCheck = () => {
    if (checkDisabled) return;
    if (isFailed) { onApprove(task); return; }
    onMarkDone(task);
  };

  const tone = isOverdue
    ? { wrap: "bg-rose-500", label: "text-rose-100", title: "text-white", sub: "text-rose-50", barTrack: "bg-rose-400/50", barFill: "bg-white", btn: "bg-white text-rose-600 hover:bg-rose-50" }
    : isUrgent
    ? { wrap: "bg-amber-400", label: "text-amber-900/70", title: "text-amber-950", sub: "text-amber-900/80", barTrack: "bg-amber-300/60", barFill: "bg-amber-950", btn: "bg-amber-950 text-amber-50 hover:bg-amber-900" }
    : isDone
    ? { wrap: "bg-emerald-50", label: "text-emerald-400", title: "text-emerald-900", sub: "text-emerald-500", barTrack: "bg-emerald-200", barFill: "bg-emerald-500", btn: "bg-white text-emerald-700 shadow-sm hover:bg-emerald-50" }
    : task.status === "in_revision"
    ? { wrap: "bg-violet-50", label: "text-violet-400", title: "text-violet-900", sub: "text-violet-500", barTrack: "bg-violet-200", barFill: "bg-violet-500", btn: "bg-white text-violet-700 shadow-sm hover:bg-violet-50" }
    : isReview
    ? { wrap: "bg-orange-50", label: "text-orange-400", title: "text-orange-900", sub: "text-orange-500", barTrack: "bg-orange-200", barFill: "bg-orange-500", btn: "bg-white text-orange-700 shadow-sm hover:bg-orange-50" }
    : { wrap: "bg-sky-50", label: "text-sky-400", title: "text-sky-900", sub: "text-sky-500", barTrack: "bg-sky-200", barFill: "bg-sky-500", btn: "bg-white text-sky-700 shadow-sm hover:bg-sky-50" };

  return (
    <div
      draggable={isAdminOrPM}
      onDragStart={isAdminOrPM ? (e) => { e.stopPropagation(); onDragStart(e, task.id); } : undefined}
      onDragOver={onDragOver ? (e) => onDragOver(e, task.id) : undefined}
      onMouseEnter={() => onHoverStart?.(task.id)}
      onMouseLeave={() => onHoverEnd?.(task.id)}
      onClick={() => onDetail(task, estStart)}
      className={`group relative cursor-pointer transition-all duration-300 ease-out ${
        isBig
          ? `mx-[18px] my-3 rounded-[18px] px-[19px] py-[17px] hover:-translate-y-0.5 ${tone.wrap}`
          : "border-b border-slate-100 px-6 py-[11px] last:border-0 hover:bg-slate-50"
      }`}
    >
      {!isBig && (
        <span className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-colors ${isOverdue ? "bg-rose-500" : isUrgent ? "bg-amber-400" : rail}`} />
      )}

      <div className="flex items-start gap-3">
        {!isBig && (
          <button
            onClick={stopProp(handleCheck)}
            disabled={checkDisabled}
            title={checkTitle}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              isDone ? "border-emerald-500 bg-emerald-500"
              : isReview ? "cursor-default border-orange-300 bg-orange-50"
              : checkDisabled ? "cursor-default border-slate-200"
              : "border-slate-300 hover:border-indigo-400"
            }`}
          >
            {isDone && <Check size={11} className="text-white" />}
            {isReview && <span className="text-[10px]">⏳</span>}
          </button>
        )}

        <div className="min-w-0 flex-1">
          {isBig && (
            <p className={`text-[10px] font-bold uppercase tracking-[0.07em] ${tone.label}`}>
              {isOverdue ? "Overdue" : isUrgent ? "Segera!" : isDone ? "Selesai" : isReview ? "Menunggu Review" : isRunning ? "Lagi Dikerjakan" : "Prioritas Berikutnya"}
            </p>
          )}
          <p className={`truncate transition-all duration-300 ${
            isBig
              ? `font-display mt-0.5 text-lg font-extrabold ${tone.title}`
              : `text-[14.5px] font-semibold ${isDone || isFailed ? "text-slate-400 line-through" : "text-slate-900"}`
          }`}>
            {toTitleCase(displayTitle(task))}
          </p>
          <p className={`truncate transition-all duration-300 ${isBig ? `mt-0.5 text-[12.5px] ${tone.sub}` : "text-[11.5px] text-slate-400"}`}>
            {sub || (isBig ? "" : " ")}
          </p>
        </div>

        {!isBig && (
          isOverdue ? (
            <span className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1 text-[10.5px] font-bold text-white">
              🕐 {fmtCountdown(Math.abs(countdown))} lewat
            </span>
          ) : isUrgent ? (
            <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[10.5px] font-bold text-amber-950">
              {fmtCountdown(countdown)} lagi
            </span>
          ) : estStart && !isFinished && !isRunning ? (
            <span className="shrink-0 font-mono text-[11.5px] font-semibold text-slate-400">🕐 {estStart}</span>
          ) : null
        )}
        {!isBig && (
          isReview ? (
            <button onClick={stopProp(() => onApprove(task))} className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-[15px] py-[7px] text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition">
              Approve
            </button>
          ) : isActive ? (
            <button
              onClick={stopProp(() => onTimer(task))}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-[15px] py-[7px] text-xs font-bold transition ${
                isRunning ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              }`}
            >
              {isRunning ? <Pause size={11} /> : <Play size={11} />}
              {isRunning
                ? <span className="font-mono">{fmtClock(elapsed)}</span>
                : elapsed > 0 ? <span className="font-mono">{fmtElapsed(elapsed)}</span> : "Mulai"}
            </button>
          ) : null
        )}
        {!isBig && isAdminOrPM && (
          <button
            onClick={stopProp(() => onDelete(task.id))}
            title="Hapus task"
            className="shrink-0 rounded-full p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
          >
            <X size={13} />
          </button>
        )}
        {isBig && streamAllowed && (
          <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">🔴 LIVE</span>
        )}
        {isBig && isAdminOrPM && (
          <button
            onClick={stopProp(() => onDelete(task.id))}
            title="Hapus task"
            className={`shrink-0 rounded-full p-1 transition hover:bg-black/10 ${tone.sub}`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Info yang cuma kebuka pas besar: progress durasi + kode folder */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isBig ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="mt-[14px] flex items-center gap-3">
            {task.duration_seconds ? (
              <>
                <div className={`h-[7px] max-w-[180px] flex-1 overflow-hidden rounded-full ${tone.barTrack}`}>
                  <div className={`h-full rounded-full ${tone.barFill}`} style={{ width: `${Math.min(100, Math.round((elapsed / task.duration_seconds) * 100))}%` }} />
                </div>
                <span className={`shrink-0 font-mono text-[11.5px] font-semibold ${tone.sub}`}>{fmtElapsed(elapsed)} / {fmtBudget(task.duration_seconds)}</span>
              </>
            ) : <span />}
            {isReview ? (
              <button
                onClick={stopProp(() => onApprove(task))}
                className={`ml-auto shrink-0 rounded-full px-[18px] py-[9px] text-[12.5px] font-bold transition ${tone.btn}`}
              >
                Approve
              </button>
            ) : isDone ? (
              <button
                onClick={stopProp(() => window.open(telegramLink || TELEGRAM_TOPIC_LINK, "_blank", "noopener,noreferrer"))}
                className={`ml-auto shrink-0 rounded-full px-[18px] py-[9px] text-[12.5px] font-bold transition ${tone.btn}`}
              >
                Cek Update
              </button>
            ) : !isFailed ? (
              <button
                onClick={stopProp(() => (isRunning ? onMarkDone(task) : onTimer(task)))}
                className={`ml-auto shrink-0 rounded-full px-[18px] py-[9px] text-[12.5px] font-bold transition ${tone.btn}`}
              >
                {isRunning ? "Tandai Selesai" : "Mulai"}
              </button>
            ) : null}
          </div>
          {folderCode && (
            <p className={`mt-2 truncate font-mono text-[11px] ${tone.sub}`}>📁 {folderCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── TaskCard ──────────────────────────────────────────────────── */
function TaskCard({ task, orders, now, isAdminOrPM, onTimer, onMarkDone, onRemind, onRemote, onApprove, onReject, onDelete, onEdit, onDetail, onDragStart, onDragOver, estStart = null, compact = false }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = getElapsed(task, now);
  const linkedOrderInfo = useMemo(() => {
    if (!task.order_id || !orders?.length) return null;
    return orders.find((o) => o.id === task.order_id) || null;
  }, [task.order_id, orders]);
  const activeMilestone = useMemo(() => {
    if (!linkedOrderInfo?.milestones?.length) return null;
    return linkedOrderInfo.milestones.find((m) => m.status === "active") || null;
  }, [linkedOrderInfo]);
  const streamAllowed = !!linkedOrderInfo?.stream_allowed;
  const isDone = task.status === "done";
  const isFailed = task.status === "failed";
  const isReview = task.status === "menunggu_review";
  const isRevision = task.status === "in_revision";
  const isFinished = isDone || isFailed;
  const isRunning = !!task.timer_started && (!task.date || task.date >= todayStr());
  const isActive = task.status === "pending" || task.status === "in progress" || isRevision;

  const countdown = getCountdown(task, now);
  const hasStarted = elapsed > 0 || !!task.timer_started;
  const isOverdue = !isFinished && countdown !== null && countdown <= 0 && hasStarted;
  const isUrgent  = !isFinished && countdown !== null && countdown > 0 && countdown <= 1800 && hasStarted;

  const stopProp = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div
      draggable={!compact && isAdminOrPM}
      onDragStart={!compact && isAdminOrPM ? (e) => { e.stopPropagation(); onDragStart(e, task.id); } : undefined}
      onDragOver={compact ? undefined : (e) => onDragOver(e, task.id)}
      onClick={() => onDetail(task)}
      className={`rounded-2xl border transition cursor-pointer ${
        isOverdue
          ? "border-rose-400 bg-rose-50/60"
          : isUrgent
          ? "border-orange-400 bg-orange-50/60"
          : isRunning
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
      {isOverdue   && <div className="h-1 rounded-t-2xl bg-rose-500" />}
      {!isOverdue && isUrgent && <div className="h-1 rounded-t-2xl bg-orange-400" />}
      {isDone      && <div className="h-1 rounded-t-2xl bg-emerald-400" />}
      {isFailed    && <div className="h-1 rounded-t-2xl bg-rose-400" />}
      {isReview    && !isOverdue && !isUrgent && <div className="h-1 rounded-t-2xl bg-orange-400" />}
      {isRevision  && !isOverdue && !isUrgent && <div className="h-1 rounded-t-2xl bg-violet-400" />}

      {/* Top row: title + edit/delete */}
      <div className="flex items-start gap-2 px-4 pt-3">
        {!compact && <GripVertical size={14} className="mt-1 shrink-0 text-slate-300" />}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${sm.dot}`} />
                {isDone && <span className="text-emerald-500 text-xs font-bold shrink-0">✓</span>}
                {isReview && <span className="text-orange-500 text-xs font-bold shrink-0">⏳</span>}
                {isOverdue && <span className="text-xs font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full shrink-0">Overdue</span>}
                <p className={`text-sm font-semibold break-words min-w-0 ${
                  isDone || isFailed ? "line-through text-slate-400" : "text-slate-900"
                }`}>
                  {displayTitle(task)}
                </p>
              </div>
              {/* Live stream badge */}
              {streamAllowed && !isFinished && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    🔴 LIVE STREAM
                  </span>
                </div>
              )}
              {activeMilestone && (
                <div className="mt-1 flex items-center gap-1.5 w-fit">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-lg px-2 py-0.5">
                    🏁 {activeMilestone.title}
                  </span>
                  {activeMilestone.deadline && (() => {
                    const d = Math.ceil((new Date(activeMilestone.deadline) - new Date()) / 86400000);
                    return d <= 7 ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${d < 0 ? "bg-rose-100 text-rose-600" : d <= 3 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                        {d < 0 ? `${Math.abs(d)}h lewat` : d === 0 ? "hari ini" : `${d}h lagi`}
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
              {task.target_progress && (
                <p className="mt-1 flex items-center gap-1 text-xs text-violet-600 font-medium">
                  <Target size={10} className="shrink-0" />{task.target_progress}
                </p>
              )}
              {task.notes && (
                <p className="mt-1 text-xs text-slate-500 font-mono whitespace-pre-wrap break-words break-all leading-relaxed">
                  {task.notes}
                </p>
              )}
            </div>
            {/* Top-right: estimated start chip + admin edit/delete */}
            {(estStart || isAdminOrPM) && (
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {estStart && !isFinished && !isRunning && (
                  <span className="text-sm font-semibold font-mono text-indigo-500 leading-none whitespace-nowrap">
                    🕐 {estStart}
                  </span>
                )}
                {isAdminOrPM && (
                  <div className="flex items-center gap-1">
                    <button onClick={stopProp(() => onEdit({ ...task }))} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                      <Pencil size={13} />
                    </button>
                    <button onClick={stopProp(() => onDelete(task.id))} title="Hapus" className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duration / countdown bar */}
      {countdown !== null && !isFinished && (
        <div className={`mx-4 mt-2 flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${
          !hasStarted ? "bg-slate-50 border border-dashed border-slate-200"
          : isOverdue ? "bg-rose-100" : isUrgent ? "bg-orange-100" : "bg-sky-50"
        }`}>
          <AlarmClock size={12} className={
            !hasStarted ? "text-slate-400 shrink-0"
            : isOverdue ? "text-rose-500 shrink-0" : isUrgent ? "text-orange-500 shrink-0" : "text-sky-500 shrink-0"
          } />
          <span className={`text-xs font-mono font-bold ${
            !hasStarted ? "text-slate-500"
            : isOverdue ? "text-rose-600" : isUrgent ? "text-orange-600" : "text-sky-600"
          }`}>
            {!hasStarted
              ? fmtBudget(task.duration_seconds)
              : isOverdue ? `Overdue +${fmtCountdown(Math.abs(countdown))}` : fmtCountdown(countdown)
            }
          </span>
          {!hasStarted && <span className="ml-auto text-[10px] text-slate-400 font-medium">durasi</span>}
          {isUrgent && <span className="ml-auto text-[10px] text-orange-500 font-semibold animate-pulse">Segera!</span>}
        </div>
      )}

      {/* Bottom row: aksi kiri + status kanan */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">

        {/* Kiri: tombol aksi — di mode compact (Kanban) cuma tombol inti yang
            ditampilkan biar gak "kebablasan" (overflow) di kolom sempit;
            Ingatkan/Remote tetap bisa diakses lewat detail modal (klik card). */}
        <div className="flex flex-wrap items-center gap-1.5">
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
              <span>Done</span>
            </button>
          )}

          {/* Admin/PM: ingatkan manual — fallback kalau desktop app talent lagi bug/mati.
              Disembunyikan di mode compact (Kanban), tetap ada di detail modal. */}
          {isActive && isAdminOrPM && !compact && (
            <button
              onClick={stopProp(() => onRemind(task))}
              title="Ingatkan mulai / live stream (manual, buat jaga-jaga kalau app di laptop-nya lagi bug)"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
            >
              <Bell size={12} />
              <span>Ingatkan</span>
            </button>
          )}

          {/* Admin/PM: remote ke PC talent (RustDesk, dijalankan via desktop app admin).
              Disembunyikan di mode compact (Kanban), tetap ada di detail modal. */}
          {isActive && isAdminOrPM && !compact && (
            <button
              onClick={stopProp(() => onRemote(task))}
              title="Buka remote desktop ke PC talent ini"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 transition"
            >
              <Monitor size={12} />
              <span>Remote</span>
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

          {/* Admin/PM: pulihkan task gagal → tandai selesai */}
          {isFailed && isAdminOrPM && (
            <button
              onClick={stopProp(() => onApprove(task))}
              title="Tim sudah selesai tapi lupa klik Done?"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
            >
              <CheckCircle2 size={12} /> Tandai Selesai
            </button>
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

/* ─── TaskDetailModal ─────────────────────────────────────────────
   Semua detail yang sebelumnya numpuk di card (target, order, kode
   update harian, durasi) sekarang di sini — card di list cuma nyisain
   judul + 1 tombol. Semua fetch/state (orderTotal, dailyUpdateConfirmed,
   revoke) dipertahankan persis, cuma tata letaknya dirapikan + sekarang
   satu tombol aksi utama per status (bukan nyebar 4-5 tombol). ── */
function TaskDetailModal({ task, orders, now, isAdminOrPM, isAdmin, estStart, onClose, onEdit, onOpenOrder, onTimer, onMarkDone, onRemind, onRemote, onApprove, onReject, onDelete }) {
  const sm = STATUS_META[task.status] || STATUS_META.pending;
  const elapsed = getElapsed(task, now);
  const linkedOrder = orders.find((o) => o.id === task.order_id);
  const handleOpenOrder = () => onOpenOrder(linkedOrder);
  const isDone = task.status === "done";
  const isFailed = task.status === "failed";
  const isReview = task.status === "menunggu_review";
  const isRevision = task.status === "in_revision";
  const isFinished = isDone || isFailed;
  const isActive = task.status === "pending" || task.status === "in progress" || isRevision;
  const isRunning = !!task.timer_started && (!task.date || task.date >= todayStr());
  const countdown = getCountdown(task, now);
  const hasStarted = elapsed > 0 || !!task.timer_started;
  const isOverdue = countdown !== null && countdown <= 0 && hasStarted && !isFinished;
  const isUrgent  = countdown !== null && countdown > 0 && countdown <= 1800 && hasStarted && !isFinished;

  const [orderTotal, setOrderTotal] = useState(null);
  useEffect(() => {
    if (!task.order_id) { setOrderTotal(null); return; }
    api.get("/tasks/order-total", { params: { order_id: task.order_id } })
      .then((r) => setOrderTotal(r.data?.total_seconds ?? null))
      .catch(() => setOrderTotal(null));
  }, [task.order_id]);

  const [codeCopied, setCodeCopied] = useState(false);
  const dailyCode = dailyUpdateCode(displayTitle(task));
  const [dailyUpdateConfirmed, setDailyUpdateConfirmed] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    api.get(`/tasks/${task.id}/daily-update-status`)
      .then((r) => { if (alive) setDailyUpdateConfirmed(!!r.data?.confirmed); })
      .catch(() => { if (alive) setDailyUpdateConfirmed(null); });
    return () => { alive = false; };
  }, [task.id]);
  const [revoking, setRevoking] = useState(false);
  const handleRevokeConfirmation = async () => {
    if (!confirm("Batalkan konfirmasi update hari ini? Task jadi 'belum update' lagi — pakai ini kalau ketauan filenya sudah dihapus di Telegram.")) return;
    setRevoking(true);
    try {
      await api.delete(`/tasks/${task.id}/daily-update-confirmation`);
      setDailyUpdateConfirmed(false);
      toast.success("Konfirmasi update hari ini dibatalkan.");
    } catch {
      toast.error("Gagal membatalkan konfirmasi.");
    } finally {
      setRevoking(false);
    }
  };
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(dailyCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("Gagal copy, salin manual aja ya.");
    }
  };

  const badge = isOverdue
    ? { bg: "bg-rose-500", text: "text-white", label: `Overdue +${fmtCountdown(Math.abs(countdown))}` }
    : isUrgent
    ? { bg: "bg-amber-400", text: "text-amber-950", label: `${fmtCountdown(countdown)} lagi` }
    : { bg: sm.bg, text: sm.text, label: sm.label };

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`h-1.5 ${isOverdue ? "bg-rose-500" : isUrgent ? "bg-amber-400" : sm.dot}`} />
        <div className="flex items-start justify-between gap-3 px-6 pt-4 pb-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <h2 className={`mt-2 text-lg font-extrabold leading-snug break-words ${isDone ? "line-through text-slate-400" : "text-slate-900"}`}>
              {toTitleCase(displayTitle(task))}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{task.assignee} · {task.date}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 shrink-0 mt-1">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {estStart && !isFinished && !isRunning && !isOverdue && !isUrgent && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg leading-none">🕐</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estimasi Mulai</p>
                <p className="text-sm font-mono font-bold text-slate-700">{estStart}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Waktu Pengerjaan Hari Ini</p>
                <p className={`text-sm font-mono font-semibold ${isRunning ? "text-sky-600" : "text-slate-700"}`}>
                  {elapsed > 0 ? fmtElapsed(elapsed) : "Belum dimulai"}
                  {task.duration_seconds ? ` / ${fmtBudget(task.duration_seconds)}` : ""}
                  {isRunning && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
                </p>
              </div>
            </div>
            {task.duration_seconds ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${isOverdue ? "bg-rose-500" : isUrgent ? "bg-amber-400" : "bg-sky-500"}`}
                  style={{ width: `${Math.min(100, Math.round((elapsed / task.duration_seconds) * 100))}%` }}
                />
              </div>
            ) : null}
          </div>

          {task.target_progress && (
            <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-400">Target Progres</p>
              <p className="text-sm font-semibold text-violet-800">{task.target_progress}</p>
            </div>
          )}
          {task.notes && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Catatan</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words break-all leading-relaxed font-mono">{task.notes}</p>
            </div>
          )}
          {linkedOrder && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">Order Terkait</p>
                  <p className="text-sm font-semibold text-indigo-900 truncate">{linkedOrder.project}</p>
                  <p className="text-xs text-indigo-500 font-mono">{linkedOrder.folder_code || linkedOrder.client}</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleOpenOrder}
                    title="Buka & edit order ini (kayak di halaman Order)"
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                    <Link2 size={12} /> Edit Order
                  </button>
                )}
              </div>
              {orderTotal !== null && (
                <p className="mt-2 border-t border-indigo-100 pt-2 text-[11.5px] text-indigo-500">
                  ⏱ Total pengerjaan order ini (semua hari):{" "}
                  <span className="font-mono font-bold text-indigo-800">{orderTotal > 0 ? fmtElapsed(orderTotal) : "belum ada"}</span>
                </p>
              )}
            </div>
          )}

          {/* Kode update harian — dipakai buat nama file yang dikirim ke Telegram */}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Kode Update Harian</p>
              {dailyUpdateConfirmed === true && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Check size={10} /> Sudah dikirim
                </span>
              )}
              {dailyUpdateConfirmed === false && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Belum dikirim
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 min-w-0 text-sm font-mono font-semibold text-emerald-800 break-all">{dailyCode}</p>
              <button
                onClick={handleCopyCode}
                className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200"
              >
                {codeCopied ? <Check size={12} /> : <Copy size={12} />}
                {codeCopied ? "Tersalin" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-600">
              Pakai buat nama file yang dikirim ke Telegram, tambahin nomor gambar di belakang. Contoh:{" "}
              <span className="font-mono font-semibold">{dailyCode} 01.png</span>
            </p>
            {isAdminOrPM && dailyUpdateConfirmed === true && (
              <button
                onClick={handleRevokeConfirmation}
                disabled={revoking}
                className="mt-2 text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline disabled:opacity-50"
              >
                {revoking ? "Membatalkan..." : "Batalkan konfirmasi (misal filenya sudah dihapus di Telegram)"}
              </button>
            )}
          </div>
        </div>

        {/* Aksi utama — satu tombol paling relevan sesuai status task */}
        {(isReview || isActive || (isFailed && isAdminOrPM)) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-6 py-4">
            {isReview ? (
              isAdminOrPM ? (
                <>
                  <button onClick={() => { onApprove(task); onClose(); }} className="flex-1 rounded-2xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition">
                    ✓ Setuju
                  </button>
                  <button onClick={() => { onReject(task); onClose(); }} className="flex-1 rounded-2xl bg-rose-50 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100 transition">
                    Kembalikan
                  </button>
                </>
              ) : (
                <div className="flex-1 rounded-2xl border border-orange-200 bg-orange-50 py-2.5 text-center text-sm font-semibold text-orange-600">
                  ⏳ Menunggu review admin
                </div>
              )
            ) : (
              <>
                {isActive && (
                  <button
                    onClick={() => onTimer(task)}
                    className={`flex-1 rounded-2xl py-2.5 text-sm font-bold text-white transition ${isRunning ? "bg-sky-500 hover:bg-sky-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
                  >
                    {isRunning ? `Pause · ${fmtClock(elapsed)}` : elapsed > 0 ? "Lanjutkan" : "Mulai"}
                  </button>
                )}
                {isActive && (
                  <button onClick={() => { onMarkDone(task); onClose(); }} className="flex-1 rounded-2xl bg-emerald-100 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200 transition">
                    {isAdminOrPM ? "Tandai Selesai" : "Kirim Review"}
                  </button>
                )}
                {isFailed && isAdminOrPM && (
                  <button onClick={() => { onApprove(task); onClose(); }} className="flex-1 rounded-2xl bg-emerald-100 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-200 transition">
                    Tandai Selesai
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Utilitas admin — ingatkan / remote, cuma buat task yang masih aktif */}
        {isAdminOrPM && isActive && (
          <div className="flex gap-2 px-6 pb-4">
            <button onClick={() => onRemind(task)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-amber-50 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition">
              <Bell size={12} /> Ingatkan
            </button>
            <button onClick={() => onRemote(task)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-sky-50 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition">
              <Monitor size={12} /> Remote
            </button>
          </div>
        )}

        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            Tutup
          </button>
          {isAdminOrPM && (
            <>
              <button onClick={() => onEdit(task)} className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
                Edit
              </button>
              <button
                onClick={() => { if (confirm("Hapus task ini?")) { onDelete(task.id); onClose(); } }}
                title="Hapus"
                className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 transition">
                Hapus
              </button>
            </>
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
            <p className="font-semibold text-slate-900 text-sm">{displayTitle(task)}</p>
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

/* ─── NeedDailyUpdateModal ──────────────────────────────────────────
   Muncul kalau talent coba submit task ke review padahal belum ada file
   yang kebaca bot Telegram di topik "Update Progress" hari ini — beda dari
   TelegramConfirmModal (yang honor-system buat admin/PM), ini beneran ke-
   gate otomatis dari backend (lihat db.daily_updates). ── */
function NeedDailyUpdateModal({ task, onClose }) {
  const dailyCode = dailyUpdateCode(displayTitle(task));
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dailyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
              <Send size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-base">Belum Ada Update Hari Ini</p>
              <p className="text-xs text-orange-100">Kirim preview dulu sebelum submit</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            Belum ada file dari kamu yang kebaca di topik <span className="font-bold text-orange-600">Update Progress</span> hari ini untuk:
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-semibold text-slate-900 text-sm">{displayTitle(task)}</p>
          </div>
          <p className="mt-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Kirim dengan nama file</p>
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex-1 min-w-0 text-sm font-mono font-semibold text-amber-800 break-all">{dailyCode}</p>
            <button onClick={handleCopy} className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-200">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Tersalin" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <a href={TELEGRAM_TOPIC_LINK} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-2xl bg-sky-500 py-2.5 text-sm font-bold text-white hover:bg-sky-600 transition text-center">
            Buka Telegram
          </a>
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── UnhandledSection ──────────────────────────────────────────── */
function UnhandledSection({ orders, isAdminOrPM, isAdmin, onOpenOrder, onAddTask }) {
  // Default tertutup -- section ini gampang jadi panjang (order aktif tanpa
  // task numpuk terus), jadi biar gak langsung mendominasi layar tiap buka
  // To Do, admin/PM buka manual pas emang butuh liat.
  const [collapsed, setCollapsed] = useState(true);

  // Kelompokkan per status produksi (Need Designer, Modeling, Revisi, dst)
  // biar admin bisa langsung lihat order mana yang nyangkut di tahap mana,
  // bukan cuma tumpukan kartu polos gak terpilah.
  const grouped = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const st = normalizeStatus(o.status);
      (map[st] = map[st] || []).push(o);
    });
    return STATUS_OPTIONS
      .filter((s) => map[s]?.length)
      .map((s) => ({ status: s, items: map[s] }));
  }, [orders]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-[11px] px-6 py-4 text-left select-none"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[12px] font-extrabold text-amber-950">
          {orders.length}
        </span>
        <span className="text-sm font-bold text-slate-800">Belum Terhandle</span>
        <span className="text-[12.5px] text-slate-400">— order aktif belum ada task hari ini</span>
        <span className={`ml-auto text-xs text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}>▾</span>
      </button>

      {!collapsed && (
        // Grid multi-kolom + tinggi dibatasi (scroll internal) biar makin
        // banyak grup status makin lebar/scroll ke bawah DI DALAM kartu ini,
        // bukan mendorong seluruh halaman ke bawah ("memanjang kebawah").
        <div className="max-h-[420px] overflow-y-auto px-[18px] pb-[18px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {grouped.map(({ status, items }) => {
              const sc = STATUS_COLORS[status] || { bg: "#f1f5f9", text: "#64748b" };
              return (
                <div key={status} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="mb-1.5 flex items-center gap-2 px-0.5">
                    <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: sc.bg, color: sc.text }}>
                      {status}
                    </span>
                    <span className="text-[11px] text-slate-400">{items.length} order</span>
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    {items.map((order) => (
                      <div
                        key={order.id}
                        onClick={isAdmin ? () => onOpenOrder(order) : undefined}
                        title={isAdmin ? "Klik buat buka & edit order ini" : undefined}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition ${
                          isAdmin ? "cursor-pointer hover:border-indigo-300" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-slate-800 truncate">{order.project || "Unnamed"}</p>
                          <p className="font-mono text-[10px] text-slate-400 truncate">{order.folder_code || order.client || ""}</p>
                        </div>
                        {isAdminOrPM && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddTask(order); }}
                            className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 transition"
                          >
                            + Task
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ImportPriorityModal ───────────────────────────────────────────
   Paste teks "Urutan Prioritas" mentah dari WA, sistem parse jadi
   draft task per baris. Nama di header blok cuma saran assignee —
   PM edit langsung di tabel kalau ternyata itu nama market/klien,
   bukan nama tim. Bikin semua task sekaligus setelah dikurasi. ── */
function ImportPriorityModal({ date, knownAssignees, orders = [], createTask, onClose }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState(null); // null = belum di-parse
  const [submitting, setSubmitting] = useState(false);
  const [orderSearchFor, setOrderSearchFor] = useState(null); // _key baris yang lagi cari order
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  const handleParse = () => {
    const parsed = parsePriorityText(raw);
    if (parsed.length === 0) {
      toast.error("Gak ketemu baris task — pastikan formatnya '1. Judul - target' per baris.");
      return;
    }
    // Auto-link ke order aktif yang judulnya persis sama, biar order gak
    // ketinggalan "Belum Terhandle" dan order.artists ke-sync otomatis.
    const withOrderLink = parsed.map((r) => {
      const match = findMatchingOrder(r.title, orders);
      return match ? { ...r, order_id: match.id } : { ...r, order_id: null };
    });
    setRows(withOrderLink);
  };

  const updateRow = (key, patch) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
  };

  const filteredOrdersFor = useMemo(() => {
    if (!orderSearchQuery) return orders.slice(0, 6);
    const q = orderSearchQuery.toLowerCase();
    return orders.filter((o) =>
      o.project?.toLowerCase().includes(q) || o.folder_code?.toLowerCase().includes(q) || o.client?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [orders, orderSearchQuery]);
  const openOrderSearch = (key) => { setOrderSearchFor(key); setOrderSearchQuery(""); };
  const pickOrderFor = (key, order) => {
    updateRow(key, { order_id: order.id });
    setOrderSearchFor(null);
  };

  const handleSubmit = async () => {
    const valid = (rows || []).filter((r) => r.title.trim());
    if (valid.length === 0) { toast.error("Gak ada task buat dibuat."); return; }
    const missingAssignee = valid.some((r) => !r.assignee.trim());
    if (missingAssignee && !confirm("Ada task yang belum ada assignee-nya — tetap lanjut buat?")) return;
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        valid.map((r) =>
          createTask({
            title: r.title.trim(),
            assignee: r.assignee.trim(),
            assignee_type: r.assignee_type || "tim",
            status: "pending",
            date,
            notes: "",
            target_progress: r.target_progress || "",
            order_id: r.order_id || null,
            duration_seconds: r.duration && !isNaN(parseFloat(r.duration)) ? Math.round(parseFloat(r.duration) * 3600) : null,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (failed > 0) toast.warning(`${ok} task berhasil dibuat, ${failed} gagal.`);
      else toast.success(`${ok} task berhasil dibuat dari import.`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
            <ClipboardPaste size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-base">Import dari Teks</p>
            <p className="text-xs text-indigo-100">Paste teks "Urutan Prioritas" dari WA, sistem bikinin draft task-nya</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-white/80 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {rows === null ? (
            <>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={12}
                placeholder={"Contoh:\n\nEirene\n1. Government Uniform (Emperor) - Cek Roblox\n2. Cone Coach - Revisi 100%\n\nDARTMAX3D\n1. 3D Vtuber model - Rigg - 50%"}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-2 text-xs text-slate-400">
                Boleh paste beberapa pesan sekaligus (dipisah baris kosong). Baris di atas tiap list dianggap saran nama assignee — bisa diedit lagi sebelum dibuat.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <datalist id="known-assignees-import">
                {knownAssignees.map((a) => <option key={a} value={a} />)}
              </datalist>

              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r._key} className="rounded-xl border border-slate-200 p-2.5">
                    {r.sourceLabel && (
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Dari teks: {r.sourceLabel} — isi assignee manual di bawah ↓
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={r.title}
                        onChange={(e) => updateRow(r._key, { title: e.target.value })}
                        placeholder="Judul task"
                        className="min-w-0 flex-[2] rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      />
                      <input
                        value={r.assignee}
                        onChange={(e) => updateRow(r._key, { assignee: e.target.value })}
                        list="known-assignees-import"
                        placeholder="Assignee (wajib diisi)"
                        className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none ${
                          r.assignee.trim() ? "border-slate-200 focus:border-indigo-400" : "border-amber-300 bg-amber-50"
                        }`}
                      />
                      <input
                        value={r.target_progress}
                        onChange={(e) => updateRow(r._key, { target_progress: e.target.value })}
                        placeholder="Target/progres"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      />
                      <div className="relative shrink-0">
                        <input
                          value={r.duration}
                          onChange={(e) => updateRow(r._key, { duration: e.target.value })}
                          type="number" step="0.5" min="0"
                          title="Estimasi durasi pengerjaan (jam) — dipakai buat hitung estimasi jam mulai & countdown"
                          placeholder="Jam"
                          className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 pr-6 text-sm focus:border-indigo-400 focus:outline-none"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">j</span>
                      </div>
                      <button onClick={() => removeRow(r._key)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Link ke order aktif — biar order gak nyangkut di
                        "Belum Terhandle" dan artists-nya ke-sync otomatis */}
                    <div className="mt-1.5">
                      {r.order_id ? (
                        (() => {
                          const linked = orders.find((o) => o.id === r.order_id);
                          return (
                            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs">
                              <Link2 size={12} className="shrink-0 text-emerald-500" />
                              <span className="min-w-0 flex-1 truncate text-emerald-700">
                                Terhubung ke order: <span className="font-semibold">{linked?.project || r.order_id}</span>
                                {linked?.folder_code && <span className="text-emerald-500"> · {linked.folder_code}</span>}
                              </span>
                              <button onClick={() => updateRow(r._key, { order_id: null })} className="shrink-0 text-emerald-400 hover:text-emerald-700" title="Lepas link order">
                                <Unlink size={12} />
                              </button>
                            </div>
                          );
                        })()
                      ) : orderSearchFor === r._key ? (
                        <div className="rounded-lg border border-slate-200 p-2">
                          <input
                            autoFocus
                            value={orderSearchQuery}
                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                            placeholder="Cari project atau kode folder..."
                            className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                          />
                          <div className="max-h-32 space-y-0.5 overflow-y-auto">
                            {filteredOrdersFor.map((o) => (
                              <button key={o.id} onClick={() => pickOrderFor(r._key, o)} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-indigo-50">
                                <span className="font-medium text-slate-700">{o.project}</span>
                                <span className="text-slate-400"> · {o.folder_code}</span>
                              </button>
                            ))}
                            {filteredOrdersFor.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Tidak ditemukan.</p>}
                          </div>
                          <button onClick={() => setOrderSearchFor(null)} className="mt-1 text-xs text-slate-400 hover:text-slate-600">Batal</button>
                        </div>
                      ) : (
                        <button onClick={() => openOrderSearch(r._key)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition">
                          <Link2 size={12} /> Gak terhubung ke order — klik buat hubungkan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">Semua baris dihapus — klik "Ulang" buat paste lagi.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          {rows === null ? (
            <>
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Batal
              </button>
              <button onClick={handleParse} className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
                Parse Teks
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRows(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Ulang
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || rows.length === 0}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
                {submitting ? "Membuat..." : `Buat ${rows.length} Task`}
              </button>
            </>
          )}
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
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="h-1.5 bg-indigo-500" />
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5 sticky top-0 bg-white z-10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            {isAdd ? <Plus size={20} /> : <Pencil size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[19px] font-extrabold tracking-tight text-slate-900">{title}</h2>
            {data.date && <p className="text-xs text-slate-400 mt-0.5">· {data.date}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form className="space-y-4 p-6" onSubmit={onSubmit}>
          {isAdd && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Link ke Order (opsional)</p>
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

          <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Title
            <input
              value={data.title}
              onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
              required placeholder="Mis: Modeling chest rig"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
            <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
            <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Durasi (Countdown)</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number" min="0" max="23"
                  value={Math.floor((data.duration_seconds || 0) / 3600)}
                  onChange={(e) => {
                    const h = Math.max(0, parseInt(e.target.value) || 0);
                    const m = Math.floor(((data.duration_seconds || 0) % 3600) / 60);
                    onChange((p) => ({ ...p, duration_seconds: h * 3600 + m * 60 || null }));
                  }}
                  className="w-16 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-center text-slate-900 outline-none focus:border-indigo-300"
                />
                <span className="text-xs text-slate-400">jam</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number" min="0" max="59"
                  value={Math.floor(((data.duration_seconds || 0) % 3600) / 60)}
                  onChange={(e) => {
                    const h = Math.floor((data.duration_seconds || 0) / 3600);
                    const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                    onChange((p) => ({ ...p, duration_seconds: h * 3600 + m * 60 || null }));
                  }}
                  className="w-16 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-center text-slate-900 outline-none focus:border-indigo-300"
                />
                <span className="text-xs text-slate-400">menit</span>
              </div>
              {data.duration_seconds > 0 && (
                <button type="button" onClick={() => onChange((p) => ({ ...p, duration_seconds: null }))} className="text-slate-300 hover:text-rose-400">
                  <X size={14} />
                </button>
              )}
            </div>
            {data.duration_seconds > 0 && (
              <p className="text-xs text-indigo-500">Countdown mulai saat tombol Start ditekan</p>
            )}
          </div>
          <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Target Progres
            <input
              value={data.target_progress || ""}
              onChange={(e) => onChange((p) => ({ ...p, target_progress: e.target.value }))}
              placeholder="Mis: Modeling selesai 100%"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal normal-case text-slate-900 outline-none focus:border-indigo-300 tracking-normal"
            />
          </label>

          <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
