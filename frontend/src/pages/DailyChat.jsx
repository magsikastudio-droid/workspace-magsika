import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useChat } from "../context/ChatContext";
import { toast } from "sonner";

const CHAT_STATUSES = ["Discussing", "Follow Up", "Nego", "Lost", "Place Order"];
const CHAT_TYPES = ["New Client", "Follow Up", "Repeat Client", "Referral"];
const CHAT_ACCOUNTS = ["Magsika", "Eirene", "Etsy", "Direct"];

const STATUS_STYLE = {
  "Discussing":  { bg: "bg-sky-100",   text: "text-sky-700",   border: "border-sky-200"   },
  "Follow Up":   { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  "Nego":        { bg: "bg-purple-100",text: "text-purple-700",border: "border-purple-200"},
  "Lost":        { bg: "bg-rose-100",  text: "text-rose-700",  border: "border-rose-200"  },
  "Place Order": { bg: "bg-emerald-100",text: "text-emerald-700",border:"border-emerald-200"},
};

const ACCOUNT_STYLE = {
  "Magsika": { bg: "bg-indigo-100", text: "text-indigo-700" },
  "Eirene":  { bg: "bg-pink-100",   text: "text-pink-700"   },
  "Etsy":    { bg: "bg-orange-100", text: "text-orange-700" },
  "Direct":  { bg: "bg-slate-100",  text: "text-slate-700"  },
};

function nowMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekRange(monthStr, week) {
  const [y, m] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, daysInMonth);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m)}-${pad(startDay)}`,
    end: `${y}-${pad(m)}-${pad(endDay)}`,
    label: `Minggu ${week} · ${new Date(y, m - 1, 1).toLocaleString("id-ID", { month: "long" })} ${y}`,
  };
}

function getEntryWeek(dateStr) {
  const day = parseInt(dateStr?.split("-")[2] || "1");
  return Math.min(Math.ceil(day / 7), 5);
}

function fmtDate(d) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function DailyChat() {
  const { entries, loading, fetchEntries, createEntry, updateEntry, deleteEntry } = useChat();
  const [month, setMonth] = useState(nowMonthStr());
  const [week, setWeek] = useState(() => getEntryWeek(todayStr()));
  const [accountFilter, setAccountFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");

  useEffect(() => {
    fetchEntries(month);
  }, [month, fetchEntries]);

  const weekRange = useMemo(() => getWeekRange(month, week), [month, week]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!e.date) return false;
      if (e.date < weekRange.start || e.date > weekRange.end) return false;
      if (accountFilter !== "Semua" && e.akun !== accountFilter) return false;
      if (statusFilter !== "Semua" && e.status !== statusFilter) return false;
      return true;
    });
  }, [entries, weekRange, accountFilter, statusFilter]);

  const metrics = useMemo(() => {
    const allMonth = entries;
    const inbox = allMonth.length;
    const discussing = allMonth.filter((e) => e.status === "Discussing").length;
    const followUp = allMonth.filter((e) => e.status === "Follow Up" || e.status === "Nego").length;
    const placed = allMonth.filter((e) => e.status === "Place Order").length;
    const realRev = allMonth.filter((e) => e.status === "Place Order").reduce((s, e) => s + (e.real || 0), 0);
    const conversion = inbox ? Math.round((placed / inbox) * 100) : 0;
    return { inbox, discussing, followUp, placed, conversion, realRev };
  }, [entries]);

  const handleAddRow = async () => {
    try {
      await createEntry({
        date: todayStr(),
        tipe: "New Client",
        username: "",
        status: "Discussing",
        akun: accountFilter !== "Semua" ? accountFilter : "Magsika",
      });
    } catch {
      toast.error("Gagal menambah baris");
    }
  };

  const handleField = useCallback(async (id, field, value) => {
    try {
      await updateEntry(id, { [field]: value === "" ? null : value });
    } catch {
      toast.error("Gagal menyimpan");
    }
  }, [updateEntry]);

  const handleDelete = async (id) => {
    if (!confirm("Hapus baris ini?")) return;
    try {
      await deleteEntry(id);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setWeek(1);
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setWeek(1);
  };

  const exportCSV = () => {
    const header = "TGL,TIPE,USERNAME,ESTIMASI,BUDGET,AGREED,REAL,STATUS,AKUN";
    const rows = filtered.map((e) =>
      [e.date, e.tipe, e.username, e.estimasi ?? "", e.budget ?? "", e.agreed ?? "", e.real ?? "", e.status, e.akun].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dailychat-${month}-w${week}.csv`;
    a.click();
  };

  const monthLabel = (m) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleString("id-ID", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600">
            <MessageSquare size={16} /> Daily Chat
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Daily Chat</h1>
          <p className="mt-1 text-sm text-slate-500">Tracking inbox &amp; pipeline client</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={handleAddRow} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={15} /> Tambah client
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="TOTAL INBOX" value={metrics.inbox} sub="bulan ini" color="text-indigo-600" />
        <MetricCard label="DISCUSSING" value={metrics.discussing} sub="aktif" color="text-sky-600" />
        <MetricCard label="FOLLOW UP / NEGO" value={metrics.followUp} sub={metrics.followUp === 0 ? "perlu tindak lanjut" : "perlu follow up"} color="text-amber-600" />
        <MetricCard label="PLACE ORDER" value={metrics.placed} sub="closing bulan ini" color="text-emerald-600" />
        <MetricCard label="CONVERSION RATE" value={`${metrics.conversion}%`} sub="closing / total" color="text-purple-600" />
      </div>

      {/* Week navigation + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          <button onClick={prevMonth} className="rounded-full p-1.5 hover:bg-slate-100"><ChevronLeft size={16} /></button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-slate-800">{weekRange.label}</span>
          <button onClick={nextMonth} className="rounded-full p-1.5 hover:bg-slate-100"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`h-9 w-9 rounded-full text-sm font-semibold transition ${
                week === w ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              W{w}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["Semua", "Magsika", "Eirene"].map((acc) => (
            <button
              key={acc}
              onClick={() => setAccountFilter(acc)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                accountFilter === acc ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {acc}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="Semua">Semua status</option>
          {CHAT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto text-sm font-semibold text-slate-600">
          Real revenue: <span className="text-emerald-600">${metrics.realRev.toLocaleString()}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                <th className="px-4 py-3 text-left">TGL</th>
                <th className="px-4 py-3 text-left">TIPE</th>
                <th className="px-4 py-3 text-left">USERNAME</th>
                <th className="px-4 py-3 text-right">ESTIMASI</th>
                <th className="px-4 py-3 text-right">BUDGET</th>
                <th className="px-4 py-3 text-right">AGREED</th>
                <th className="px-4 py-3 text-right">REAL</th>
                <th className="px-4 py-3 text-left">STATUS</th>
                <th className="px-4 py-3 text-left">AKUN</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-slate-400">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">Belum ada data minggu ini.</td></tr>
              ) : (
                filtered.map((entry) => (
                  <ChatRow
                    key={entry.id}
                    entry={entry}
                    onField={handleField}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <button
          onClick={handleAddRow}
          className="flex w-full items-center justify-center gap-2 border-t border-dashed border-slate-200 py-4 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition"
        >
          <Plus size={15} /> Tambah baris
        </button>
      </div>
    </div>
  );
}

function ChatRow({ entry, onField, onDelete }) {
  const statusStyle = STATUS_STYLE[entry.status] || STATUS_STYLE["Discussing"];
  const accStyle = ACCOUNT_STYLE[entry.akun] || ACCOUNT_STYLE["Direct"];
  const inputCls = "w-full bg-transparent text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1";

  return (
    <tr className="group hover:bg-slate-50 transition">
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineInput value={entry.date || ""} onBlur={(v) => onField(entry.id, "date", v)} type="date" className={inputCls} />
      </td>
      <td className="px-4 py-3">
        <select
          value={entry.tipe || "New Client"}
          onChange={(e) => onField(entry.id, "tipe", e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300 cursor-pointer"
        >
          {CHAT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <InlineInput value={entry.username || ""} onBlur={(v) => onField(entry.id, "username", v)} placeholder="username..." className={inputCls} />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-slate-400 mr-0.5 text-xs">$</span>
        <InlineNum value={entry.estimasi} onBlur={(v) => onField(entry.id, "estimasi", v)} className="w-20 text-right bg-transparent text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1" />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-slate-400 mr-0.5 text-xs">$</span>
        <InlineNum value={entry.budget} onBlur={(v) => onField(entry.id, "budget", v)} className="w-20 text-right bg-transparent text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1" />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-slate-400 mr-0.5 text-xs">$</span>
        <InlineNum value={entry.agreed} onBlur={(v) => onField(entry.id, "agreed", v)} className="w-20 text-right bg-transparent text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1" />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-slate-400 mr-0.5 text-xs">$</span>
        <InlineNum value={entry.real} onBlur={(v) => onField(entry.id, "real", v)} className="w-20 text-right bg-transparent text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1" />
      </td>
      <td className="px-4 py-3">
        <select
          value={entry.status || "Discussing"}
          onChange={(e) => onField(entry.id, "status", e.target.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
        >
          {CHAT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={entry.akun || "Magsika"}
          onChange={(e) => onField(entry.id, "akun", e.target.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer ${accStyle.bg} ${accStyle.text} border-transparent`}
        >
          {CHAT_ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDelete(entry.id)}
          className="rounded-full p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function InlineInput({ value, onBlur, type = "text", placeholder = "—", className }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onBlur(local); }}
      className={className}
    />
  );
}

function InlineNum({ value, onBlur, className }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  return (
    <input
      type="number"
      min="0"
      value={local}
      placeholder="—"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = local === "" ? null : Number(local);
        if (n !== value) onBlur(n);
      }}
      className={className}
    />
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
