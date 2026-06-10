import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Target } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const PLATFORMS = ["fiverr","etsy","upwork","vgen","komunitas","lain_lain"];
const PLATFORM_LABELS = { fiverr:"Fiverr", etsy:"Etsy", upwork:"Upwork", vgen:"VGen", komunitas:"Komunitas", lain_lain:"Lain-lain" };
const ACCOUNTS = [
  { key: "magsika",  label: "Magsika",           color: "from-violet-500 to-indigo-600",  ring: "ring-violet-300" },
  { key: "eirene",   label: "Eirene",             color: "from-rose-400 to-pink-500",     ring: "ring-rose-300"   },
  { key: "lolicharm",label: "Lolicharm & Komunitas", color: "from-amber-400 to-orange-500", ring: "ring-amber-300" },
];
const WEEKS = [1, 2, 3, 4, 5];

function fmt(val) {
  if (!val && val !== 0) return "";
  return Number(val) === 0 ? "" : String(val);
}

function WeeklyGrid({ account, year, month, entries, targets, onCellChange, onTargetChange }) {
  const targetVal = targets[account.key] ?? "";

  const totals = useMemo(() => {
    const byWeek = {};
    const byPlatform = {};
    let grand = 0;
    WEEKS.forEach((w) => {
      const row = entries[account.key]?.[w] || {};
      let rowSum = 0;
      PLATFORMS.forEach((p) => {
        const v = Number(row[p] || 0);
        rowSum += v;
        byPlatform[p] = (byPlatform[p] || 0) + v;
        grand += v;
      });
      byWeek[w] = rowSum;
    });
    return { byWeek, byPlatform, grand };
  }, [entries, account.key]);

  const target = Number(targetVal) || 0;
  const pct = target > 0 ? Math.min(100, Math.round((totals.grand / target) * 100)) : 0;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${account.color} flex items-center justify-center`}>
            <DollarSign size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{account.label}</p>
            <p className="text-xs text-slate-400">Total: <span className="font-bold text-slate-700">${totals.grand.toFixed(2)}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Target (USD)</span>
          <input
            type="number"
            value={targetVal}
            onChange={(e) => onTargetChange(account.key, e.target.value)}
            onBlur={() => onTargetChange(account.key, targetVal, true)}
            min="0" step="50"
            placeholder="0"
            className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-right outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {target > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress bulan ini</span>
            <span className="font-semibold">{pct}% dari ${target}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className={`h-2.5 rounded-full bg-gradient-to-r ${account.color} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-3 text-slate-500 font-semibold w-16">Minggu</th>
              {PLATFORMS.map((p) => (
                <th key={p} className="text-right py-2 px-1.5 text-slate-500 font-semibold">{PLATFORM_LABELS[p]}</th>
              ))}
              <th className="text-right py-2 pl-3 text-slate-700 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((w) => {
              const row = entries[account.key]?.[w] || {};
              const rowTotal = totals.byWeek[w] || 0;
              return (
                <tr key={w} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="py-1.5 pr-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-600">MG {w}</span>
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p} className="py-1 px-1">
                      <input
                        type="number"
                        value={fmt(row[p])}
                        onChange={(e) => onCellChange(account.key, w, p, e.target.value)}
                        onBlur={(e) => onCellChange(account.key, w, p, e.target.value, true)}
                        min="0" step="1"
                        placeholder="0"
                        className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right outline-none focus:border-slate-300 focus:bg-white transition hover:bg-white"
                      />
                    </td>
                  ))}
                  <td className="py-1.5 pl-3 text-right font-bold text-slate-800">
                    {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-200">
              <td className="py-2 pr-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Total</td>
              {PLATFORMS.map((p) => (
                <td key={p} className="py-2 px-1 text-right font-semibold text-slate-700">
                  {(totals.byPlatform[p] || 0) > 0 ? `$${(totals.byPlatform[p] || 0).toFixed(2)}` : <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td className="py-2 pl-3 text-right font-bold text-slate-900">${totals.grand.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Earnings() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const today = new Date();
  const [tab, setTab] = useState("weekly");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const [entries, setEntries] = useState({});
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(false);

  const saveTimer = useRef({});

  const loadData = useCallback(async (year, month) => {
    setLoading(true);
    try {
      const [wRes, tRes] = await Promise.all([
        api.get(`/earnings/weekly?year=${year}&month=${month}`),
        api.get(`/earnings/targets?year=${year}&month=${month}`),
      ]);
      const map = {};
      (wRes.data.entries || []).forEach((e) => {
        if (!map[e.account]) map[e.account] = {};
        map[e.account][e.week] = {
          fiverr: e.fiverr, etsy: e.etsy, upwork: e.upwork,
          vgen: e.vgen, komunitas: e.komunitas, lain_lain: e.lain_lain,
        };
      });
      setEntries(map);
      const tMap = {};
      (tRes.data.targets || []).forEach((t) => { tMap[t.account] = t.target; });
      setTargets(tMap);
    } catch {
      setEntries({});
      setTargets({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "weekly") loadData(viewYear, viewMonth);
  }, [tab, viewYear, viewMonth, loadData]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleCellChange = useCallback((account, week, platform, value, save = false) => {
    const num = value === "" ? 0 : Number(value);
    setEntries((prev) => {
      const next = { ...prev };
      if (!next[account]) next[account] = {};
      if (!next[account][week]) next[account][week] = {};
      next[account][week] = { ...next[account][week], [platform]: isNaN(num) ? 0 : num };
      return next;
    });
    if (save) {
      const key = `${account}-${week}`;
      clearTimeout(saveTimer.current[key]);
      saveTimer.current[key] = setTimeout(async () => {
        try {
          const row = {};
          PLATFORMS.forEach((p) => { row[p] = 0; });
          setEntries((prev) => {
            const r = prev[account]?.[week] || {};
            PLATFORMS.forEach((p) => { row[p] = r[p] || 0; });
            return prev;
          });
          await api.put("/earnings/weekly", {
            year: viewYear, month: viewMonth, account, week,
            fiverr: row.fiverr || 0, etsy: row.etsy || 0, upwork: row.upwork || 0,
            vgen: row.vgen || 0, komunitas: row.komunitas || 0, lain_lain: row.lain_lain || 0,
          });
        } catch { toast.error("Gagal menyimpan"); }
      }, 600);
    }
  }, [viewYear, viewMonth]);

  const handleCellBlur = useCallback((account, week) => {
    setEntries((prev) => {
      const row = prev[account]?.[week] || {};
      const data = {};
      PLATFORMS.forEach((p) => { data[p] = row[p] || 0; });
      api.put("/earnings/weekly", {
        year: viewYear, month: viewMonth, account, week, ...data,
      }).catch(() => toast.error("Gagal menyimpan"));
      return prev;
    });
  }, [viewYear, viewMonth]);

  const handleTargetChange = useCallback((account, value, save = false) => {
    const num = value === "" ? 0 : Number(value);
    setTargets((prev) => ({ ...prev, [account]: isNaN(num) ? 0 : num }));
    if (save && !isNaN(num)) {
      api.put("/earnings/targets", {
        year: viewYear, month: viewMonth, account, target: num,
      }).catch(() => toast.error("Gagal menyimpan target"));
    }
  }, [viewYear, viewMonth]);

  /* ── Orders-based monthly summary ── */
  const selectedMonthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthOrders = useMemo(() =>
    orders.filter((o) => (o.created_at || "").startsWith(selectedMonthKey)),
    [orders, selectedMonthKey]
  );
  const totalRevenue = monthOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalLunas = monthOrders.filter((o) => o.payment_status === "Lunas").reduce((s, o) => s + (o.total || 0), 0);

  /* ── Grand total from weekly entries ── */
  const weeklyGrandTotal = useMemo(() => {
    let sum = 0;
    ACCOUNTS.forEach(({ key }) => {
      WEEKS.forEach((w) => {
        const row = entries[key]?.[w] || {};
        PLATFORMS.forEach((p) => { sum += Number(row[p] || 0); });
      });
    });
    return sum;
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <DollarSign size={18} /> Earnings
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Laporan Pendapatan</h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 border border-slate-200 transition">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-slate-800">
            {MONTHS_ID[viewMonth - 1]} {viewYear}
          </span>
          <button onClick={nextMonth} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 border border-slate-200 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 gap-1">
        <button onClick={() => setTab("weekly")}
          className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${tab === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Input Mingguan
        </button>
        <button onClick={() => setTab("laporan")}
          className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${tab === "laporan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Laporan Order
        </button>
      </div>

      {tab === "weekly" && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {ACCOUNTS.map(({ key, label, color }) => {
              let acctTotal = 0;
              WEEKS.forEach((w) => {
                const row = entries[key]?.[w] || {};
                PLATFORMS.forEach((p) => { acctTotal += Number(row[p] || 0); });
              });
              const acctTarget = Number(targets[key] || 0);
              const pct = acctTarget > 0 ? Math.min(100, Math.round((acctTotal / acctTarget) * 100)) : 0;
              return (
                <div key={key} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className={`mb-3 inline-flex rounded-2xl bg-gradient-to-br ${color} p-2.5`}>
                    <TrendingUp size={16} className="text-white" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900">${acctTotal.toFixed(2)}</p>
                  {acctTarget > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className={`h-1.5 rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{pct}% dari target ${acctTarget}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
          ) : (
            <div className="space-y-4">
              {ACCOUNTS.map((account) => (
                <WeeklyGrid
                  key={account.key}
                  account={account}
                  year={viewYear}
                  month={viewMonth}
                  entries={entries}
                  targets={targets}
                  onCellChange={(acc, w, p, v, save) => {
                    handleCellChange(acc, w, p, v);
                    if (save) handleCellBlur(acc, w);
                  }}
                  onTargetChange={handleTargetChange}
                />
              ))}
            </div>
          )}

          <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
            <p className="text-sm font-medium text-slate-300">Grand Total {MONTHS_ID[viewMonth - 1]} {viewYear}</p>
            <p className="mt-2 text-4xl font-bold">${weeklyGrandTotal.toFixed(2)}</p>
            <p className="mt-1 text-xs text-slate-400">Dari input manual per akun & minggu</p>
          </div>
        </>
      )}

      {tab === "laporan" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 inline-flex rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 p-2.5"><DollarSign size={18} className="text-white" /></div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Gross Revenue</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(totalRevenue)}</p>
              <p className="mt-1 text-sm text-slate-500">{monthOrders.length} order</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 inline-flex rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5"><DollarSign size={18} className="text-white" /></div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Sudah Lunas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(totalLunas)}</p>
              <p className="mt-1 text-sm text-slate-500">Pembayaran diterima</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 inline-flex rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-2.5"><DollarSign size={18} className="text-white" /></div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Pending</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(totalRevenue - totalLunas)}</p>
              <p className="mt-1 text-sm text-slate-500">Belum diterima</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Order {MONTHS_ID[viewMonth - 1]} {viewYear}</h2>
            {monthOrders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada order bulan ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 text-left">Proyek</th>
                      <th className="px-4 py-3 text-left">Client</th>
                      <th className="px-4 py-3 text-left">Platform</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Status Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900 truncate max-w-[160px]">{o.project}</td>
                        <td className="px-4 py-3 text-slate-600">{o.client}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{o.platform || "Direct"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${o.payment_status === "Lunas" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {o.payment_status || "Belum Lunas"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
