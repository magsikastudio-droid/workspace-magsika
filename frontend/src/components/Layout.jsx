import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Kanban, MessageSquare,
  CheckSquare, FileText, TrendingUp, Users, DollarSign,
  Settings as SettingsIcon, LogOut, Search, Menu, X,
  Megaphone, CalendarDays, Bell, Zap, Target, BookOpen,
  Send, Loader2, LayoutGrid,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { showLocalNotification } from "../lib/notifications";
import OverdueAlarmBanner from "./OverdueAlarmBanner";
import BirthdayBanner from "./BirthdayBanner";

const FEELINGS_LOCK = [
  { value: "Semangat", emoji: "😊", active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "Biasa",    emoji: "😐", active: "border-amber-400 bg-amber-50 text-amber-700"    },
  { value: "Lelah",    emoji: "😔", active: "border-rose-400 bg-rose-50 text-rose-700"       },
];

const todayStrLock = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const isAfterDeadlineLock = (h, m) => {
  const now = new Date();
  const wibH = (now.getUTCHours() + 7) % 24;
  const wibM = now.getUTCMinutes();
  return wibH > h || (wibH === h && wibM >= m);
};
const LOCK_MIN_CHARS = 100;

const computeElapsedForAlarm = (task) => {
  let base = task.time_elapsed || 0;
  if (task.timer_started) {
    base += Math.floor((Date.now() - new Date(task.timer_started).getTime()) / 1000);
  }
  return Math.max(0, base);
};
const LockCharCount = ({ val }) => {
  const n = (val || "").trim().length;
  const ok = n >= LOCK_MIN_CHARS;
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${ok ? "text-emerald-500" : "text-rose-400"}`}>
      {n}/{LOCK_MIN_CHARS}
    </span>
  );
};

const NAV_SECTIONS = [
  {
    label: "Main Menu",
    items: [
      { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, roles: ["admin"] },
      { to: "/daily-chat",   label: "Daily Chat",   icon: MessageSquare,   roles: ["admin"] },
      { to: "/orders",       label: "Orders",       icon: ClipboardList,   roles: ["admin"] },
      { to: "/order-layout", label: "Order Layout",  icon: LayoutGrid,      roles: ["admin", "pm", "talent"] },
      { to: "/board",        label: "Board",        icon: Kanban,          roles: ["admin", "pm", "talent"] },
      { to: "/todo",          label: "To Do",         icon: CheckSquare,  roles: ["admin", "pm", "talent"] },
      { to: "/daily-report",  label: "Daily Report",  icon: BookOpen,     roles: ["admin", "pm", "talent"] },
      { to: "/performance",   label: "Performance",   icon: TrendingUp,   roles: ["admin", "pm", "talent"] },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/invoice",      label: "Invoice",      icon: FileText,        roles: ["admin"] },
      { to: "/earnings",     label: "Earnings",     icon: DollarSign,      roles: ["admin"] },
      { to: "/freelance",    label: "Freelance",    icon: Users,           roles: ["admin"] },
    ],
  },
  {
    label: "Tim",
    items: [
      { to: "/pengumuman",   label: "Pengumuman",   icon: Megaphone,       roles: ["admin", "pm", "talent"] },
      { to: "/schedule",     label: "Schedule",     icon: CalendarDays,    roles: ["admin", "pm", "talent"] },
      { to: "/notifications",label: "Notifikasi",   icon: Bell,            roles: ["admin", "pm"] },
      { to: "/settings",     label: "Settings",     icon: SettingsIcon,    roles: ["admin", "pm", "talent"] },
    ],
  },
  {
    label: "Strategi",
    items: [
      { to: "/rencana/teknis", label: "Rencana Teknis",  icon: Zap,     roles: ["admin", "pm"] },
      { to: "/rencana/market", label: "Rencana Market",  icon: Target,  roles: ["admin", "pm"] },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({ announcements: 0, schedule: 0, notifications: 0 });
  const navigate = useNavigate();
  const location = useLocation();

  const role = (user?.role || "talent").toLowerCase();

  // Daily report lock (talent + pm)
  const [deadline, setDeadline] = useState({ hour: 16, minute: 30 });
  const [reportSubmitted, setReportSubmitted] = useState(true);
  const [lockForm, setLockForm] = useState({ work_done: "", feelings: "Semangat", obstacles: "", notes: "" });
  const [lockSubmitting, setLockSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !["talent", "pm"].includes(role)) return;
    api.get("/settings/daily-report-deadline")
      .then((r) => setDeadline({ hour: r.data.hour ?? 16, minute: r.data.minute ?? 30 }))
      .catch(() => {});
  }, [user, role]);

  useEffect(() => {
    if (!user || !["talent", "pm"].includes(role)) return;
    if (!isAfterDeadlineLock(deadline.hour, deadline.minute)) { setReportSubmitted(true); return; }
    api.get("/daily-reports/today-status")
      .then((r) => setReportSubmitted(r.data.submitted))
      .catch(() => setReportSubmitted(true));
  }, [user, role, deadline]);

  const validateLock = (f) => {
    const MIN = 100;
    if (f.work_done.trim().length < MIN) { toast.error(`Pekerjaan minimal ${MIN} karakter (${f.work_done.trim().length}/${MIN})`); return false; }
    if (f.obstacles.trim().length < MIN) { toast.error(`Kendala minimal ${MIN} karakter (${f.obstacles.trim().length}/${MIN})`); return false; }
    if (f.notes.trim().length < MIN)     { toast.error(`Note minimal ${MIN} karakter (${f.notes.trim().length}/${MIN})`);     return false; }
    return true;
  };

  const handleLockSubmit = async (e) => {
    e.preventDefault();
    if (!validateLock(lockForm)) return;
    setLockSubmitting(true);
    try {
      await api.post("/daily-reports", lockForm);
      setReportSubmitted(true);
      toast.success("Daily report berhasil disubmit!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal submit daily report.");
    } finally {
      setLockSubmitting(false);
    }
  };

  const isLocked = ["talent", "pm"].includes(role) && isAfterDeadlineLock(deadline.hour, deadline.minute) && reportSubmitted === false;

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const res = await api.get("/unread-counts");
        setUnreadCounts(res.data ?? { announcements: 0, schedule: 0, notifications: 0 });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [user]);

  // Overdue alarm — global, fires for all roles on any page
  const [overdueAlarms, setOverdueAlarms] = useState([]);
  const [alarmBannerVisible, setAlarmBannerVisible] = useState(false);
  const overdueAlarmFiredRef = useRef(new Set());

  useEffect(() => {
    if (!user) return;
    const checkOverdue = async () => {
      try {
        const today = todayStrLock();
        const res = await api.get("/tasks", { params: { date: today } });
        const tasks = res.data?.tasks || [];
        const overdue = [];
        let hasNew = false;
        tasks.forEach((t) => {
          if (!t.duration_seconds) return;
          if (["done", "failed"].includes(t.status)) return;
          const elapsed = computeElapsedForAlarm(t);
          if (elapsed <= 0) return; // never started
          if (elapsed < t.duration_seconds) return; // not yet overdue
          overdue.push({ ...t, _overtime: elapsed - t.duration_seconds });
          if (!overdueAlarmFiredRef.current.has(t.id)) {
            overdueAlarmFiredRef.current.add(t.id);
            showLocalNotification("⏰ Waktu Habis!", `${t.title} — ${t.assignee}`);
            hasNew = true;
          }
        });
        setOverdueAlarms(overdue);
        if (hasNew) setAlarmBannerVisible(true);
        if (overdue.length === 0) setAlarmBannerVisible(false);
      } catch {}
    };
    checkOverdue();
    const id = setInterval(checkOverdue, 10000);
    return () => clearInterval(id);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const effectiveRole = user?.is_superadmin ? "superadmin" : role;
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role) || item.roles.includes(effectiveRole)),
  })).filter((section) => section.items.length > 0);

  const allVisibleItems = visibleSections.flatMap((s) => s.items);
  const currentPage = allVisibleItems.find((i) => location.pathname.startsWith(i.to));

  const filteredItems = search
    ? allVisibleItems.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] px-5 py-4">
        <img src="/logo.png" alt="Magsika Studio" className="h-8 w-auto object-contain" />
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/5 py-2 pl-9 pr-3 text-xs text-slate-700 dark:text-slate-300 outline-none transition focus:border-violet-300 dark:focus:border-violet-700 focus:bg-white dark:focus:bg-white/10 placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {filteredItems ? (
          <div className="space-y-0.5">
            {filteredItems.map((item) => <NavItem key={item.to} item={item} badge={
    item.to === "/notifications" ? unreadCounts.notifications
    : item.to === "/performance" && role === "talent" ? unreadCounts.notifications
    : item.to === "/pengumuman" ? unreadCounts.announcements
    : item.to === "/schedule" ? unreadCounts.schedule
    : 0
} />)}
            {filteredItems.length === 0 && <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-600">Tidak ditemukan.</p>}
          </div>
        ) : (
          visibleSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => <NavItem key={item.to} item={item} badge={
    item.to === "/notifications" ? unreadCounts.notifications
    : item.to === "/performance" && role === "talent" ? unreadCounts.notifications
    : item.to === "/pengumuman" ? unreadCounts.announcements
    : item.to === "/schedule" ? unreadCounts.schedule
    : 0
} />)}
              </div>
            </div>
          ))
        )}
      </nav>

      {role === "admin" && (
        <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tampilkan harga</span>
            <button
              onClick={() => setCurrency(currency === "IDR" ? "USD" : "IDR")}
              className="rounded-lg bg-white dark:bg-white/10 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-white/20 transition"
            >
              {currency}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {(user?.name || user?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name || user?.full_name || "Admin"}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-600 capitalize">{user?.is_superadmin ? "Superadmin" : (user?.role || "admin")}</p>
            </div>
          </div>
          <button onClick={logout} title="Logout" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-rose-500 transition">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  if (isLocked) {
    const deadlineLabel = `${String(deadline.hour).padStart(2,"0")}:${String(deadline.minute).padStart(2,"0")}`;
    return (
      <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-violet-950 via-violet-900 to-slate-900 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Magsika Studio" className="h-10 w-auto object-contain mx-auto mb-4 opacity-80" />
            <h1 className="text-2xl font-bold text-white">Akses Terkunci</h1>
            <p className="text-violet-300 text-sm mt-1">Sudah pukul {deadlineLabel} WIB — isi daily report untuk melanjutkan</p>
          </div>
          <div className="rounded-[2rem] bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-4">
              <h2 className="text-white font-bold text-lg">Daily Report Hari Ini</h2>
              <p className="text-violet-200 text-xs mt-0.5">{todayStrLock()}</p>
            </div>
            <form onSubmit={handleLockSubmit} className="px-5 py-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Apa yang dikerjakan hari ini? *</label>
                  <LockCharCount val={lockForm.work_done} />
                </div>
                <textarea
                  value={lockForm.work_done}
                  onChange={(e) => setLockForm((p) => ({ ...p, work_done: e.target.value }))}
                  rows={6} required
                  placeholder="Ceritakan detail pekerjaan yang sudah diselesaikan hari ini..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Perasaan hari ini</label>
                <div className="flex gap-2">
                  {FEELINGS_LOCK.map((f) => (
                    <button key={f.value} type="button" onClick={() => setLockForm((p) => ({ ...p, feelings: f.value }))}
                      className={`flex items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${lockForm.feelings === f.value ? f.active : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                      {f.emoji} {f.value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Kendala hari ini *</label>
                  <LockCharCount val={lockForm.obstacles} />
                </div>
                <textarea
                  value={lockForm.obstacles}
                  onChange={(e) => setLockForm((p) => ({ ...p, obstacles: e.target.value }))}
                  rows={4} placeholder="Adakah hambatan atau tantangan yang dihadapi?"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Note tambahan *</label>
                  <LockCharCount val={lockForm.notes} />
                </div>
                <textarea
                  value={lockForm.notes}
                  onChange={(e) => setLockForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3} placeholder="Informasi lain yang ingin disampaikan..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
                />
              </div>
              <button type="submit" disabled={lockSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-60 transition">
                {lockSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {lockSubmitting ? "Mengirim..." : "Submit Daily Report"}
              </button>
            </form>
          </div>
          <p className="text-center text-violet-400 text-xs mt-4">Setelah submit, semua menu akan terbuka kembali.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-50 dark:bg-[#0f0f0f]">
      <BirthdayBanner />
      {alarmBannerVisible && (
        <OverdueAlarmBanner
          tasks={overdueAlarms}
          onDismiss={() => setAlarmBannerVisible(false)}
        />
      )}
      <aside className="hidden w-56 shrink-0 overflow-hidden border-r border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0d0d0d] lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 overflow-hidden bg-white dark:bg-[#0d0d0d] shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0d0d0d] px-5 py-3.5 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-600">
                <span>Magsika Studio</span>
                <span>/</span>
                <span className="font-medium text-violet-600 dark:text-violet-400">{currentPage?.label || "Dashboard"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "pm") && (
              <button
                onClick={() => navigate("/notifications")}
                title="Notifikasi"
                className="relative rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/5 p-2 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-500 hover:border-indigo-200 dark:hover:border-indigo-700 transition"
              >
                <Bell size={16} />
                {unreadCounts.notifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {unreadCounts.notifications > 9 ? "9+" : unreadCounts.notifications}
                  </span>
                )}
              </button>
            )}
            {role === "talent" && (
              <button
                onClick={() => navigate("/performance")}
                title="Notifikasi Performa"
                className="relative rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/5 p-2 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-500 hover:border-indigo-200 dark:hover:border-indigo-700 transition"
              >
                <Bell size={16} />
                {unreadCounts.notifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {unreadCounts.notifications > 9 ? "9+" : unreadCounts.notifications}
                  </span>
                )}
              </button>
            )}
            <button onClick={logout} title="Logout" className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/5 p-2 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-800 transition">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ item, badge = 0 }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
          isActive
            ? "bg-violet-50 dark:bg-violet-500/10 font-semibold text-violet-700 dark:text-violet-400"
            : "font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={16} className={isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400 dark:text-slate-600"} />
          <span className="flex-1">{item.label}</span>
          {badge > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
