import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Kanban, MessageSquare,
  CheckSquare, FileText, TrendingUp, Users, DollarSign,
  Settings as SettingsIcon, LogOut, Search, Bell, ChevronDown,
  Menu, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

const NAV_SECTIONS = [
  {
    label: "Main Menu",
    items: [
      { to: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { to: "/daily-chat", label: "Daily Chat",  icon: MessageSquare },
      { to: "/orders",     label: "Orders",      icon: ClipboardList },
      { to: "/board",      label: "Board",       icon: Kanban },
      { to: "/todo",       label: "To Do",       icon: CheckSquare },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/invoice",    label: "Invoice",     icon: FileText },
      { to: "/earnings",   label: "Earnings",    icon: DollarSign },
      { to: "/performance",label: "Performance", icon: TrendingUp },
    ],
  },
  {
    label: "Tim",
    items: [
      { to: "/freelance",  label: "Freelance",   icon: Users },
      { to: "/settings",   label: "Settings",    icon: SettingsIcon },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const currentPage = ALL_ITEMS.find((i) => location.pathname.startsWith(i.to));

  const filteredItems = search
    ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <img src="/logo.png" alt="Magsika Studio" className="h-8 w-auto object-contain" />
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {filteredItems ? (
          <div className="space-y-0.5">
            {filteredItems.map((item) => <NavItem key={item.to} item={item} />)}
            {filteredItems.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Tidak ditemukan.</p>}
          </div>
        ) : (
          NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Currency toggle */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-500">Tampilkan harga</span>
          <button
            onClick={() => setCurrency(currency === "IDR" ? "USD" : "IDR")}
            className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition"
          >
            {currency}
          </button>
        </div>
      </div>

      {/* User */}
      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {(user?.name || user?.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">{user?.name || user?.full_name || "Admin"}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role || "admin"}</p>
            </div>
          </div>
          <button onClick={logout} title="Logout" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex overflow-hidden bg-slate-50" style={{ height: "125vh" }}>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 overflow-hidden bg-white shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Magsika Studio</span>
                <span>/</span>
                <span className="font-medium text-violet-600">{currentPage?.label || "Dashboard"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex">
              <Search size={13} />
              <span className="ml-1">Cari...</span>
              <kbd className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </div>
            <button className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
              <Bell size={16} />
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <div className="h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
                {(user?.name || user?.full_name || "A").charAt(0).toUpperCase()}
              </div>
              {user?.name || user?.full_name || "Admin"}
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
          isActive
            ? "bg-violet-50 font-semibold text-violet-700"
            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={16} className={isActive ? "text-violet-600" : "text-slate-400"} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}
