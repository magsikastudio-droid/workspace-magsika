import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CheckSquare, Dice5, LayoutDashboard, ClipboardList,
  Settings as SettingsIcon, ShieldCheck, LogOut, Kanban,
  MessageSquare, FileText, TrendingUp, Users, DollarSign,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

const navItems = [
  { to: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { to: "/board",       label: "Board",        icon: Kanban },
  { to: "/orders",      label: "Orders",       icon: ClipboardList },
  { to: "/todo",        label: "To Do",        icon: CheckSquare },
  { to: "/daily-chat",  label: "Daily Chat",   icon: MessageSquare },
  { to: "/invoice",     label: "Invoice",      icon: FileText },
  { to: "/earnings",    label: "Earnings",     icon: DollarSign },
  { to: "/performance", label: "Performance",  icon: TrendingUp },
  { to: "/freelance",   label: "Freelance",    icon: Users },
  { to: "/settings",    label: "Settings",     icon: SettingsIcon },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-sm">
              <Dice5 size={20} />
            </div>
            <div className="text-left">
              <p className="text-lg font-semibold">Magsika Studio</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Admin Dashboard</p>
            </div>
          </button>

          <nav className="hidden items-center gap-1 lg:flex flex-wrap">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700 sm:flex">
              <span className="mr-2 font-semibold">{currency}</span>
              <button onClick={() => setCurrency(currency === "IDR" ? "USD" : "IDR")} className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm transition hover:bg-slate-50">
                Toggle
              </button>
            </div>
            <div className="relative">
              <button onClick={() => setShowMenu((v) => !v)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50">
                <span>{user?.name || "Admin"}</span>
                <ShieldCheck size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-52 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                  <button onClick={logout} className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                    Logout <LogOut size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block self-start sticky top-24">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Hi,</p>
              <p className="text-lg font-semibold">{user?.name || "Admin User"}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">{user?.role || "Admin"}</div>
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
