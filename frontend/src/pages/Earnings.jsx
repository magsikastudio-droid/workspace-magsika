import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { DollarSign, ChevronLeft, ChevronRight, Target } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const PLATFORMS = ["fiverr","etsy","upwork","vgen","komunitas","lain_lain"];
const PLATFORM_LABELS = { fiverr:"Fiverr", etsy:"Etsy", upwork:"Upwork", vgen:"VGen", komunitas:"Komunitas", lain_lain:"Lain-lain" };
const WEEKS = [1, 2, 3, 4, 5];
// Dulu dipecah per akun (Magsika/Eirene/Lolicharm) x platform x minggu --
// tapi laporan mingguan kenyataannya cuma satu angka gabungan per platform
// (mis. Fiverr dari dua akun sekaligus), jadi disederhanakan jadi satu
// tabel akumulasi per minggu. Account tunggal ini match backend's
// EARNINGS_ACCOUNT, data lama per-akun sudah digabung otomatis lewat
// migrasi startup (_consolidate_earnings_accounts).
const EARNINGS_ACCOUNT = "all";

function fmt(val) {
  if (!val && val !== 0) return "";
  return Number(val) === 0 ? "" : String(val);
}

export default function Earnings() {
  const { orders } = useOrders();
  const { formatMoney } = useCurrency();

  const today = new Date();
  const [tab, setTab] = useState("weekly");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const [entries, setEntries] = useState({}); // { [week]: { [platform]: number } }
  const [target, setTarget] = useState("");
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
        map[e.week] = {
          fiverr: e.fiverr, etsy: e.etsy, upwork: e.upwork,
          vgen: e.vgen, komunitas: e.komunitas, lain_lain: e.lain_lain,
        };
      });
      setEntries(map);
      const t = (tRes.data.targets || [])[0];
      setTarget(t ? t.target : "");
    } catch {
      setEntries({});
      setTarget("");
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

  const saveRow = useCallback((week, row) => {
    const key = `w${week}`;
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(async () => {
      const data = {};
      PLATFORMS.forEach((p) => { data[p] = row[p] || 0; });
      try {
        await api.put("/earnings/weekly", { year: viewYear, month: viewMonth, account: EARNINGS_ACCOUNT, week, ...data });
      } catch { toast.error("Gagal menyimpan"); }
    }, 600);
  }, [viewYear, viewMonth]);

  const handleCellChange = useCallback((week, platform, value) => {
    const num = value === "" ? 0 : Number(value);
    setEntries((prev) => {
      const row = { ...(prev[week] || {}), [platform]: isNaN(num) ? 0 : num };
      const next = { ...prev, [week]: row };
      saveRow(week, row);
      return next;
    });
  }, [saveRow]);

  const handleTargetChange = useCallback((value, save = false) => {
    const num = value === "" ? 0 : Number(value);
    setTarget(isNaN(num) ? 0 : num);
    if (save && !isNaN(num)) {
      api.put("/earnings/targets", { year: viewYear, month: viewMonth, account: EARNINGS_ACCOUNT, target: num })
        .catch(() => toast.error("Gagal menyimpan target"));
    }
  }, [viewYear, viewMonth]);

  const totals = useMemo(() => {
    const byWeek = {};
    const byPlatform = {};
    let grand = 0;
    WEEKS.forEach((w) => {
      const row = entries[w] || {};
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
  }, [entries]);

  const targetNum = Number(target) || 0;
  const pct = targetNum > 0 ? Math.min(100, Math.round((totals.grand / targetNum) * 100)) : 0;

  /* ── Orders-based monthly summary ── */
  const selectedMonthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthOrders = useMemo(() =>
    orders.filter((o) => (o.created_at || "").startsWith(selectedMonthKey)),
    [orders, selectedMonthKey]
  );
  const totalRevenue = monthOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalLunas = monthOrders.filter((o) => o.payment_status === "Lunas").reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Laporan Pendapatan</h1>
          <p className="mt-0.5 text-sm text-slate-500">Akumulasi mingguan per platform — satu angka gabungan, bukan dipecah per akun.</p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          <button onClick={prevMonth} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-slate-800">
            {MONTHS_ID[viewMonth - 1]} {viewYear}
          </span>
          <button onClick={nextMonth} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button onClick={() => setTab("weekly")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "weekly" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
          Input Mingguan
        </button>
        <button onClick={() => setTab("laporan")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "laporan" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
          Laporan Order
        </button>
      </div>

      {tab === "weekly" && (
        loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
        ) : (
          <>
            {/* Total + target — satu kartu ringkas, bukan 3 kartu per akun lagi */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total {MONTHS_ID[viewMonth - 1]} {viewYear}</p>
                <p className="mt-2 font-mono text-3xl font-bold text-indigo-600">${totals.grand.toFixed(2)}</p>
                {targetNum > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Progress target</span>
                      <span className="font-semibold">{pct}% dari ${targetNum}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <Target size={16} className="shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Target bulan ini (USD)</p>
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => handleTargetChange(e.target.value)}
                    onBlur={() => handleTargetChange(target, true)}
                    min="0" step="50"
                    placeholder="0"
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold outline-none focus:border-indigo-300"
                  />
                </div>
              </div>
            </div>

            {/* Tabel akumulasi mingguan */}
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="font-semibold text-slate-900">Akumulasi per Minggu</p>
                <p className="text-xs text-slate-400">Input gabungan semua akun/sumber — Fiverr dari kedua akun, Etsy, dll digabung jadi satu angka per minggu.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 w-20">Minggu</th>
                      {PLATFORMS.map((p) => (
                        <th key={p} className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">{PLATFORM_LABELS[p]}</th>
                      ))}
                      <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKS.map((w) => {
                      const row = entries[w] || {};
                      const rowTotal = totals.byWeek[w] || 0;
                      return (
                        <tr key={w} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                          <td className="px-6 py-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">MG {w}</span>
                          </td>
                          {PLATFORMS.map((p) => (
                            <td key={p} className="px-2 py-1">
                              <input
                                type="number"
                                value={fmt(row[p])}
                                onChange={(e) => handleCellChange(w, p, e.target.value)}
                                min="0" step="1"
                                placeholder="0"
                                className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right font-mono outline-none transition hover:bg-slate-50 focus:border-indigo-300 focus:bg-white"
                              />
                            </td>
                          ))}
                          <td className="px-6 py-2 text-right font-mono font-bold text-slate-800">
                            {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                      <td className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Total</td>
                      {PLATFORMS.map((p) => (
                        <td key={p} className="px-2 py-3 text-right font-mono font-semibold text-slate-700">
                          {(totals.byPlatform[p] || 0) > 0 ? `$${(totals.byPlatform[p] || 0).toFixed(2)}` : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600">${totals.grand.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {tab === "laporan" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Gross Revenue</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatMoney(totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-400">{monthOrders.length} order</p>
            </div>
            <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Sudah Lunas</p>
              <p className="mt-2 font-mono text-2xl font-bold text-emerald-600">{formatMoney(totalLunas)}</p>
              <p className="mt-1 text-xs text-slate-400">Pembayaran diterima</p>
            </div>
            <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Pending</p>
              <p className="mt-2 font-mono text-2xl font-bold text-amber-600">{formatMoney(totalRevenue - totalLunas)}</p>
              <p className="mt-1 text-xs text-slate-400">Belum diterima</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Order {MONTHS_ID[viewMonth - 1]} {viewYear}</h2>
            {monthOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Tidak ada order bulan ini.</p>
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
                        <td className="max-w-[160px] truncate px-4 py-3 font-semibold text-slate-900">{o.project}</td>
                        <td className="px-4 py-3 text-slate-600">{o.client}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{o.platform || "Direct"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{formatMoney(o.total)}</td>
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
