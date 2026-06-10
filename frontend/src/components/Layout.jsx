import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Kanban, MessageSquare,
  CheckSquare, FileText, TrendingUp, Users, DollarSign,
  Settings as SettingsIcon, LogOut, Search, Menu, X,
  Megaphone, CalendarDays, Bell, Zap, Target,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";

const NAV_SECTIONS = [
  {
    label: "Main Menu",
    items: [
      { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, roles: ["admin", "pm"] },
      { to: "/daily-chat",   label: "Daily Chat",   icon: MessageSquare,   roles: ["admin", "pm"] },
      { to: "/orders",       label: "Orders",       icon: ClipboardList,   roles: ["admin", "pm"] },
      { to: "/board",        label: "Board",        icon: Kanban,          roles: ["admin", "pm", "talent"] },
      { to: "/todo",         label: "To Do",        icon: CheckSquare,     roles: ["admin", "pm", "talent"] },
      { to: "/performance",  label: "Performance",  icon: TrendingUp,      roles: ["admin", "pm", "talent"] },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/invoice",      label: "Invoice",      icon: FileText,        roles: ["admin", "pm"] },
      { to: "/earnings",     label: "Earnings",     icon: DollarSign,      roles: ["admin", "pm"] },
    ],
  },
  {
    label: "Tim",
    items: [
      { to: "/pengumuman",   label: "Pengumuman",   icon: Megaphone,       roles: ["admin", "pm", "talent"] },
      { to: "/schedule",     label: "Schedule",     icon: CalendarDays,    roles: ["admin", "pm", "talent"] },
      { to: "/notifications",label: "Notifikasi",   icon: Bell,            roles: ["admin", "pm"] },
      { to: "/freelance",    label: "Freelance",    icon: Users,           roles: ["admin", "pm"] },
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
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role || "talent";

  useEffect(() => {
    if (role !== "admin" && role !== "pm") return;
    const poll = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        setUnreadCount(res.data?.count ?? 0);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [role]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
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
            {filteredItems.map((item) => <NavItem key={item.to} item={item} badge={item.to === "/notifications" ? unreadCount : 0} />)}
            {filteredItems.length === 0 && <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-600">Tidak ditemukan.</p>}
          </div>
        ) : (
          visibleSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => <NavItem key={item.to} item={item} badge={item.to === "/notifications" ? unreadCount : 0} />)}
              </div>
            </div>
          ))
        )}
      </nav>

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

      <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {(user?.name || user?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name || user?.full_name || "Admin"}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-600 capitalize">{user?.role || "admin"}</p>
            </div>
          </div>
          <button onClick={logout} title="Logout" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-rose-500 transition">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-50 dark:bg-[#0f0f0f]">
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
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
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
