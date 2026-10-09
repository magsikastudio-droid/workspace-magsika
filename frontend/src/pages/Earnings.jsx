import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import { toast } from "sonner";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const PLATFORMS = ["fiverr","etsy","upwork","vgen","komunitas","lain_lain"];
const PLATFORM_LABELS = { fiverr:"Fiverr", etsy:"Etsy", upwork:"Upwork", vgen:"VGen", komunitas:"Komunitas", lain_lain:"Lain-lain" };
const WEEKS = [1, 2, 3, 4, 5];
// Tiap market/admin diisi terpisah (penanggung jawabnya beda-beda) -- tapi
// SATU angka di satu sel (mis. Fiverr) tetap boleh berupa akumulasi dari
// beberapa sub-akun di market itu, itu urusan masing-masing pas input.
const MAIN_ACCOUNTS = [
  { key: "magsika",   label: "Magsika" },
  { key: "eirene",    label: "Eirene" },
  { key: "lolicharm", label: "Lolicharm & Komunitas" },
];
// Manajemennya beda sendiri dari 3 market di atas -- sengaja section
// terpisah (bukan nyampur di grid yang sama), bukan cuma kartu ke-4.
const JOGLO_ACCOUNT = { key: "joglo_optimasi", label: "Joglo Optimasi" };
const ACCOUNTS = [...MAIN_ACCOUNTS, JOGLO_ACCOUNT];

function fmt(val) {
  if (!val && val !== 0) return "";
  return Number(val) === 0 ? "" : String(val);
}

function AccountSection({ account, entries, target, onCellChange, onTargetChange }) {
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

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="font-semibold text-slate-900">{account.label}</p>
          <p className="font-mono text-xs text-slate-400">Total: <span className="font-bold text-slate-700">${totals.grand.toFixed(2)}</span></p>
        </div>
        <div className="flex items-center gap-4">
          {targetNum > 0 && (
            <div className="hidden min-w-[140px] sm:block">
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>Progress</span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="h-1.5 w-32 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Target</span>
            <input
              type="number"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              onBlur={() => onTargetChange(target, true)}
              min="0" step="50"
              placeholder="0"
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-semibold outline-none focus:border-indigo-300"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 w-16">Minggu</th>
              {PLATFORMS.map((p) => (
                <th key={p} className="px-2 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">{PLATFORM_LABELS[p]}</th>
              ))}
              <th className="px-6 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((w) => {
              const row = entries[w] || {};
              const rowTotal = totals.byWeek[w] || 0;
              return (
                <tr key={w} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">MG {w}</span>
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p} className="px-2 py-1">
                      <input
                        type="number"
                        value={fmt(row[p])}
                        onChange={(e) => onCellChange(w, p, e.target.value)}
                        min="0" step="1"
                        placeholder="0"
                        className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right font-mono text-xs outline-none transition hover:bg-slate-50 focus:border-indigo-300 focus:bg-white"
                      />
                    </td>
                  ))}
                  <td className="px-6 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                    {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-200 bg-slate-50/50">
              <td className="px-6 py-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Total</td>
              {PLATFORMS.map((p) => (
                <td key={p} className="px-2 py-2 text-right font-mono text-xs font-semibold text-slate-700">
                  {(totals.byPlatform[p] || 0) > 0 ? `$${(totals.byPlatform[p] || 0).toFixed(2)}` : <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td className="px-6 py-2 text-right font-mono text-sm font-bold text-indigo-600">${totals.grand.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Rekap OTOMATIS (bukan input manual) -- jumlahin tabel-tabel sumber yang
   dikasih per minggu per platform. Ini "akumulasi mingguan" yang beneran
   dimaksud: admin tetep isi tiap market terpisah di atas, baris ini yang
   nge-total-in buat dibaca pas laporan (gak usah njumlahin manual sendiri). */
function TotalMingguanTable({ label, sources }) {
  const totals = useMemo(() => {
    const byWeekPlatform = {};
    const byWeek = {};
    const byPlatform = {};
    let grand = 0;
    WEEKS.forEach((w) => {
      byWeekPlatform[w] = {};
      let rowSum = 0;
      PLATFORMS.forEach((p) => {
        let v = 0;
        sources.forEach((entries) => { v += Number(entries[w]?.[p] || 0); });
        byWeekPlatform[w][p] = v;
        rowSum += v;
        byPlatform[p] = (byPlatform[p] || 0) + v;
        grand += v;
      });
      byWeek[w] = rowSum;
    });
    return { byWeekPlatform, byWeek, byPlatform, grand };
  }, [sources]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-indigo-100 bg-indigo-50/40 shadow-sm">
      <div className="border-b border-indigo-100 px-6 py-4">
        <p className="font-semibold text-indigo-900">Total Mingguan{label ? ` — ${label}` : ""}</p>
        <p className="text-xs text-indigo-400">Otomatis dijumlah dari tabel-tabel di atas, bukan input manual.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-100">
              <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-400 w-16">Minggu</th>
              {PLATFORMS.map((p) => (
                <th key={p} className="px-2 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-indigo-400">{PLATFORM_LABELS[p]}</th>
              ))}
              <th className="px-6 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-indigo-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((w) => (
              <tr key={w} className="border-b border-indigo-50">
                <td className="px-6 py-1.5">
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">MG {w}</span>
                </td>
                {PLATFORMS.map((p) => (
                  <td key={p} className="px-2 py-1.5 text-right font-mono text-xs text-slate-700">
                    {totals.byWeekPlatform[w][p] > 0 ? `$${totals.byWeekPlatform[w][p].toFixed(2)}` : <span className="text-slate-300">—</span>}
                  </td>
                ))}
                <td className="px-6 py-1.5 text-right font-mono text-xs font-bold text-indigo-700">
                  {totals.byWeek[w] > 0 ? `$${totals.byWeek[w].toFixed(2)}` : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-indigo-200 bg-indigo-50">
              <td className="px-6 py-2 text-[10.5px] font-bold uppercase tracking-wide text-indigo-500">Total</td>
              {PLATFORMS.map((p) => (
                <td key={p} className="px-2 py-2 text-right font-mono text-xs font-semibold text-indigo-700">
                  {(totals.byPlatform[p] || 0) > 0 ? `$${(totals.byPlatform[p] || 0).toFixed(2)}` : <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td className="px-6 py-2 text-right font-mono text-sm font-bold text-indigo-700">${totals.grand.toFixed(2)}</td>
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

  const [entries, setEntries] = useState({}); // { [account]: { [week]: { [platform]: number } } }
  const [targets, setTargets] = useState({}); // { [account]: number }
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

  const saveRow = useCallback((account, week, row) => {
    const key = `${account}-${week}`;
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(async () => {
      const data = {};
      PLATFORMS.forEach((p) => { data[p] = row[p] || 0; });
      try {
        await api.put("/earnings/weekly", { year: viewYear, month: viewMonth, account, week, ...data });
      } catch { toast.error("Gagal menyimpan"); }
    }, 600);
  }, [viewYear, viewMonth]);

  const handleCellChange = useCallback((account, week, platform, value) => {
    const num = value === "" ? 0 : Number(value);
    setEntries((prev) => {
      const accountEntries = prev[account] || {};
      const row = { ...(accountEntries[week] || {}), [platform]: isNaN(num) ? 0 : num };
      const next = { ...prev, [account]: { ...accountEntries, [week]: row } };
      saveRow(account, week, row);
      return next;
    });
  }, [saveRow]);

  const handleTargetChange = useCallback((account, value, save = false) => {
    const num = value === "" ? 0 : Number(value);
    setTargets((prev) => ({ ...prev, [account]: isNaN(num) ? 0 : num }));
    if (save && !isNaN(num)) {
      api.put("/earnings/targets", { year: viewYear, month: viewMonth, account, target: num })
        .catch(() => toast.error("Gagal menyimpan target"));
    }
  }, [viewYear, viewMonth]);

  // Account yang kebalik dari DB tapi bukan salah satu dari 4 market yang
  // dikenal -- sisa dari penggabungan data yang salah kemarin (key "all"),
  // ditampilin apa adanya di panel referensi biar gak hilang begitu aja
  // dari pandangan, tinggal dipindah manual ke market yang benar.
  const legacyAccounts = useMemo(
    () => Object.keys(entries).filter((k) => !ACCOUNTS.some((a) => a.key === k)),
    [entries]
  );

  const handleDeleteLegacy = useCallback(async (accountKey) => {
    try {
      await api.delete("/earnings/weekly", { params: { year: viewYear, month: viewMonth, account: accountKey } });
      toast.success("Data lama dibuang");
      loadData(viewYear, viewMonth);
    } catch {
      toast.error("Gagal membuang data lama");
    }
  }, [viewYear, viewMonth, loadData]);

  const sumAccounts = (keys) => {
    let sum = 0;
    keys.forEach((key) => {
      WEEKS.forEach((w) => {
        const row = entries[key]?.[w] || {};
        PLATFORMS.forEach((p) => { sum += Number(row[p] || 0); });
      });
    });
    return sum;
  };
  // Sengaja TIDAK ikutin legacyAccounts ke total resmi -- begitu admin
  // mindahin angkanya manual ke market yang benar, data lama itu jadi
  // DUPLIKAT dari yang baru diketik (bukan data tambahan beneran), ikut
  // jumlahin bakal nge-dobelin total. Total resmi cuma dari market yang
  // dikenal; data lama cuma ditampilin di panel referensi sampai dibuang.
  const mainGrandTotal = useMemo(
    () => sumAccounts(MAIN_ACCOUNTS.map((a) => a.key)),
    [entries]
  );
  const jogloGrandTotal = useMemo(() => sumAccounts([JOGLO_ACCOUNT.key]), [entries]);

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
          <p className="mt-0.5 text-sm text-slate-500">Input mingguan per market — tiap sel sudah boleh berupa akumulasi dari beberapa sub-akun.</p>
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
            {legacyAccounts.length > 0 && (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm font-bold text-amber-800">⚠️ Data lama belum di-assign ke market</p>
                <p className="mt-1 text-xs text-amber-700">
                  Sisa dari penggabungan data yang salah kemarin — angka di bawah ini <strong>TIDAK ikut dihitung</strong> di Total Mingguan/Grand Total manapun, murni referensi.
                  Kalau sudah kamu masukkan manual ke kartu market yang benar di bawah, klik "Sudah dipindah, buang" biar gak nyangkut lagi.
                </p>
                <div className="mt-3 space-y-3">
                  {legacyAccounts.map((accKey) => (
                    <div key={accKey} className="rounded-2xl bg-white/70 p-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              <th className="px-2 py-1 text-left font-bold text-amber-700">Minggu</th>
                              {PLATFORMS.map((p) => (
                                <th key={p} className="px-2 py-1 text-right font-bold text-amber-700">{PLATFORM_LABELS[p]}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {WEEKS.filter((w) => entries[accKey]?.[w] && Object.values(entries[accKey][w]).some((v) => v > 0)).map((w) => (
                              <tr key={w}>
                                <td className="px-2 py-1 font-semibold text-slate-700">MG {w}</td>
                                {PLATFORMS.map((p) => (
                                  <td key={p} className="px-2 py-1 text-right font-mono text-slate-700">
                                    {entries[accKey][w][p] > 0 ? entries[accKey][w][p] : <span className="text-slate-300">—</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={() => handleDeleteLegacy(accKey)}
                        className="mt-2 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-200"
                      >
                        🗑️ Sudah dipindah, buang
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {MAIN_ACCOUNTS.map((account) => (
                <AccountSection
                  key={account.key}
                  account={account}
                  entries={entries[account.key] || {}}
                  target={targets[account.key] ?? ""}
                  onCellChange={(w, p, v) => handleCellChange(account.key, w, p, v)}
                  onTargetChange={(v, save) => handleTargetChange(account.key, v, save)}
                />
              ))}
            </div>

            <TotalMingguanTable sources={MAIN_ACCOUNTS.map((a) => entries[a.key] || {})} />

            <div className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
              <p className="text-sm font-medium text-slate-300">Grand Total {MONTHS_ID[viewMonth - 1]} {viewYear}</p>
              <p className="mt-2 font-mono text-4xl font-bold">${mainGrandTotal.toFixed(2)}</p>
              <p className="mt-1 text-xs text-slate-400">Magsika + Eirene + Lolicharm &amp; Komunitas</p>
            </div>

            {/* Joglo Optimasi -- manajemennya beda sendiri, sengaja dipisah
                section-nya (pembatas + label sendiri + total sendiri),
                bukan nyampur sama 3 market & Grand Total di atas. */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-200" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Manajemen Terpisah</p>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <AccountSection
              account={JOGLO_ACCOUNT}
              entries={entries[JOGLO_ACCOUNT.key] || {}}
              target={targets[JOGLO_ACCOUNT.key] ?? ""}
              onCellChange={(w, p, v) => handleCellChange(JOGLO_ACCOUNT.key, w, p, v)}
              onTargetChange={(v, save) => handleTargetChange(JOGLO_ACCOUNT.key, v, save)}
            />
            <TotalMingguanTable label={JOGLO_ACCOUNT.label} sources={[entries[JOGLO_ACCOUNT.key] || {}]} />
            <div className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
              <p className="text-sm font-medium text-slate-300">Grand Total {JOGLO_ACCOUNT.label} {MONTHS_ID[viewMonth - 1]} {viewYear}</p>
              <p className="mt-2 font-mono text-4xl font-bold">${jogloGrandTotal.toFixed(2)}</p>
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
