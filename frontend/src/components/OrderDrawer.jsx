/* Di-extract dari Orders.jsx biar bisa dipakai langsung dari halaman lain
   (To Do) juga — sebelumnya klik "Edit Order" harus redirect ke halaman
   Order dulu, sekarang drawer yang sama bisa dirender in-place. Reuse
   komponen ini, JANGAN duplikat, biar gak ada 2 versi yang gampang beda. */
import React, { useState, useEffect, useMemo } from "react";
import { Edit3, X, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { api } from "../lib/api";
import {
  STATUS_OPTIONS, STATUS_COLORS,
  PLATFORM_OPTIONS, PAYMENT_OPTIONS, PAYMENT_COLORS,
  WORK_TYPE_OPTIONS, MARKETER_OPTIONS,
  generateFolderCode, normalizeStatus,
} from "../lib/constants";

const emptyMilestone = () => ({ title: "", price: "", deadline: "", status: "pending" });

function fmtSec(s) {
  if (!s || s <= 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}
const AVATAR_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
const artistColor = (name) => AVATAR_COLORS[Math.abs((name||"").split("").reduce((h,c)=>c.charCodeAt(0)+((h<<5)-h),0)) % AVATAR_COLORS.length];

export default function OrderDrawer({ order, ordersOnDay, onClose, onSave, onDelete, onCompleteMilestone, onActivateMilestone }) {
  const { exchangeRate, formatMoney } = useCurrency();
  const { updateOrder } = useOrders();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...order,
    artists: Array.isArray(order.artists) ? order.artists.join(", ") : (order.artists || ""),
    artist_contributions: order.artist_contributions?.length
      ? order.artist_contributions
      : [{ name: (Array.isArray(order.artists) ? order.artists[0] : "") || "", type: "Tim", percent: 100 }],
  });
  const [manualFolder, setManualFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicContribs, setDynamicContribs] = useState(null);
  const [totalCurrency, setTotalCurrency] = useState("USD");
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    api.get("/markets").then((r) => setMarkets(r.data.markets || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!order.id) return;
    api.get("/tasks/contributions", { params: { order_id: order.id } })
      .then((r) => {
        const contribs = r.data.contributions || [];
        if (contribs.length === 0) return;
        setDynamicContribs(r.data);

        // Build task-based contributions (primary = tasks count)
        const totalTasks = contribs.reduce((s, c) => s + (c.tasks || 0), 0);
        const newContributions = contribs.map((c) => ({
          name: c.name,
          type: c.type || "Tim",
          percent: totalTasks > 0 ? Math.round((c.tasks || 0) / totalTasks * 100) : 0,
        }));

        // Sync edit form to show real contributors + real percentages
        setForm((p) => ({ ...p, artist_contributions: newContributions }));

        // If there are new artists not in DB yet, update order in DB
        const currentArtists = order.artists || [];
        const allNames = contribs.map((c) => c.name).filter(Boolean);
        const hasNew = allNames.some((n) => !currentArtists.includes(n));
        if (hasNew) {
          updateOrder(order.id, {
            artists: [...new Set([...currentArtists, ...allNames])],
            artist_contributions: newContributions,
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const setContrib = (idx, field, value) => setForm((p) => {
    const next = [...(p.artist_contributions || [])];
    next[idx] = { ...next[idx], [field]: value };
    return { ...p, artist_contributions: next };
  });

  const drawerDisplayTotal = totalCurrency === "IDR"
    ? (form.total ? Math.round(Number(form.total) * exchangeRate) : "")
    : (form.total ?? "");
  const handleDrawerTotalChange = (e) => {
    const v = e.target.value;
    setForm((p) => ({ ...p, total: totalCurrency === "IDR" ? (v ? Number(v) / exchangeRate : "") : v }));
  };

  const rebalance = (list) => {
    const n = list.length;
    if (n === 0) return list;
    const base = Math.floor(100 / n);
    return list.map((c, i) => ({ ...c, percent: i === n - 1 ? 100 - base * (n - 1) : base }));
  };

  const addContrib = () => setForm((p) => ({
    ...p,
    artist_contributions: rebalance([...(p.artist_contributions || []), { name: "", type: "Tim", percent: 0 }]),
  }));
  const removeContrib = (idx) => setForm((p) => ({
    ...p,
    artist_contributions: rebalance((p.artist_contributions || []).filter((_, i) => i !== idx)),
  }));

  // Merge order artist list with dynamic task data for view mode
  const mergedContribs = useMemo(() => {
    const baseList = order.artist_contributions?.length
      ? order.artist_contributions
      : (Array.isArray(order.artists) ? order.artists : []).map((a) => ({ name: a, type: "Tim", percent: 100 }));

    if (!dynamicContribs?.contributions?.length) {
      const n = baseList.length;
      if (n <= 1) return baseList;
      const total = baseList.reduce((s, c) => s + (Number(c.percent) || 0), 0);
      return total > 100 ? rebalance(baseList) : baseList;
    }

    const dynMap = {};
    dynamicContribs.contributions.forEach((c) => { dynMap[c.name] = c; });

    const merged = baseList.map((ac) => ({
      ...ac,
      tasks: dynMap[ac.name]?.tasks ?? 0,
      done: dynMap[ac.name]?.done ?? 0,
      time: dynMap[ac.name]?.time ?? 0,
    }));
    dynamicContribs.contributions.forEach((dc) => {
      if (!merged.find((m) => m.name === dc.name)) merged.push({ ...dc, type: dc.type || "Tim" });
    });

    const totalTime = merged.reduce((s, c) => s + (c.time || 0), 0);
    const totalTasks = merged.reduce((s, c) => s + (c.tasks || 0), 0);
    const n = merged.length;

    if (totalTasks > 0) return merged.map((c) => ({ ...c, percent: Math.round((c.tasks || 0) / totalTasks * 100) }));
    if (totalTime > 0) return merged.map((c) => ({ ...c, percent: Math.round((c.time || 0) / totalTime * 100) }));
    return rebalance(merged);
  }, [dynamicContribs, order.artist_contributions, order.artists]);

  const orderDate = form.order_date || new Date().toISOString().slice(0, 10);
  const orderNumToday = (ordersOnDay ? ordersOnDay(orderDate) : 0) + 1;
  const autoFolderCode = generateFolderCode(form.platform, form.client, form.project, orderDate, orderNumToday);
  const totalIdr = (Number(form.total) || 0) * exchangeRate;
  const feeIdr = Number(form.fee_freelance) || 0;
  const netUsd = (Number(form.total) || 0) - feeIdr / exchangeRate;
  const hasFreelance = form.artist_contributions?.some((c) => c.type === "Freelance");
  const totalPct = (form.artist_contributions || []).reduce((s, c) => s + (Number(c.percent) || 0), 0);
  const sc = STATUS_COLORS[normalizeStatus(order.status)] || { bg: "#f1f5f9", text: "#64748b" };
  const pc = PAYMENT_COLORS[order.payment_status] || { bg: "#f1f5f9", text: "#64748b" };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, folder_code: manualFolder ? form.folder_code : autoFolderCode, is_draft: false });
      setEditing(false);
    } catch {
      toast.error("Gagal menyimpan order");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white transition";
  const Row = ({ label, value, className = "" }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="shrink-0 text-xs text-slate-400 w-32">{label}</span>
      <span className={`text-sm font-medium text-slate-800 text-right flex-1 ${className}`}>{value || "—"}</span>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[200] bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 inset-y-0 z-[300] flex w-full max-w-[500px] flex-col overflow-hidden rounded-l-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: sc.bg, color: sc.text }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.text }} />
                {normalizeStatus(order.status)}
              </span>
              <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: pc.bg, color: pc.text }}>
                {order.payment_status || "Belum Lunas"}
              </span>
              {order.stream_allowed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">
                  🔴 Live Stream
                </span>
              )}
              {order.is_draft && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  🤖 Draft dari Telegram
                </span>
              )}
              {order.payment_status === "DP" && order.dp_paid > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Sisa: {formatMoney(Math.max(0, (order.total || 0) - order.dp_paid / exchangeRate))}
                </span>
              )}
            </div>
            <h2 className="mt-2 truncate text-lg font-bold text-slate-900">{order.project}</h2>
            <p className="text-sm text-slate-400">{order.client} · {order.platform}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">
                <Edit3 size={13} /> Edit
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!editing ? (
            /* VIEW MODE */
            <div className="space-y-0 divide-y divide-slate-100">
              {/* Milestones */}
              {order.milestones?.length > 0 && (
                <div className="px-6 py-4">
                  {/* Header + progress bar */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Milestones</p>
                    <span className="text-xs font-semibold text-slate-500">
                      {order.milestones.filter((m) => m.status === "done").length}/{order.milestones.length} selesai
                    </span>
                  </div>
                  <div className="mb-4 h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${(order.milestones.filter((m) => m.status === "done").length / order.milestones.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {order.milestones.map((ms, idx) => {
                      const isDone = ms.status === "done";
                      const isActive = ms.status === "active";
                      const daysLeft = ms.deadline ? Math.ceil((new Date(ms.deadline) - new Date()) / 86400000) : null;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                            isDone ? "border-emerald-200 bg-emerald-50"
                            : isActive ? "border-blue-200 bg-blue-50 ring-1 ring-blue-300"
                            : "border-slate-100 bg-slate-50 opacity-50"
                          }`}
                        >
                          {/* Status icon */}
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isDone ? "bg-emerald-500 text-white"
                            : isActive ? "bg-blue-500 text-white"
                            : "bg-slate-200 text-slate-400"
                          }`}>
                            {isDone ? "✓" : idx + 1}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${isDone ? "line-through text-slate-400" : isActive ? "text-blue-800" : "text-slate-600"}`}>
                              {ms.title}
                              {isActive && <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">Aktif</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {ms.price && (
                                <p className="text-xs text-slate-400">${ms.price}</p>
                              )}
                              {ms.deadline && (
                                <p className={`text-xs font-medium ${
                                  isDone ? "text-slate-300"
                                  : daysLeft < 0 ? "text-rose-500"
                                  : daysLeft <= 3 ? "text-amber-500"
                                  : "text-slate-400"
                                }`}>
                                  📅 {ms.deadline}
                                  {!isDone && daysLeft !== null && (
                                    <span className="ml-1">
                                      ({daysLeft < 0 ? `${Math.abs(daysLeft)}h lewat` : daysLeft === 0 ? "hari ini" : `${daysLeft}h lagi`})
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Tombol aksi */}
                          {isActive && (
                            <button
                              onClick={() => onCompleteMilestone(order.id, idx)}
                              className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 active:scale-95 transition"
                            >
                              ✓ Selesai
                            </button>
                          )}
                          {!isDone && !isActive && !order.milestones.some((m) => m.status === "active") && idx === order.milestones.findIndex((m) => m.status === "pending") && (
                            <button
                              onClick={() => onActivateMilestone(order.id, idx)}
                              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 active:scale-95 transition"
                            >
                              ▶ Mulai
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Info */}
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Info Order</p>
                <Row label="Order ID" value={order.order_id} />
                <Row label="Tanggal Order" value={order.order_date} />
                <Row label="Deadline" value={<span className={order.deadline && Math.ceil((new Date(order.deadline) - new Date()) / 86400000) < 0 ? "text-rose-600" : order.deadline && Math.ceil((new Date(order.deadline) - new Date()) / 86400000) <= 3 ? "text-amber-600" : ""}>{order.deadline}</span>} />
                <Row label="Platform" value={order.platform} />
                <Row label="Marketer" value={order.marketer} />
                <Row label="Jenis Pekerjaan" value={order.work_type} />
              </div>

              {/* Folder Code */}
              <div className="px-6 py-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Kode Folder</p>
                <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                  <p className="font-mono text-sm font-semibold text-indigo-800">{order.folder_code || autoFolderCode}</p>
                </div>
              </div>

              {/* Tim Artist */}
              <div className="px-6 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tim Artist</p>
                  {dynamicContribs && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Aktual dari task</span>
                  )}
                </div>
                <div className="space-y-2">
                  {mergedContribs.map((c, i) => (
                    <div key={i} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: artistColor(c.name) }}>{c.name?.charAt(0)?.toUpperCase() || "?"}</div>
                          <span className="text-sm font-medium text-slate-800">{c.name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.type === "Freelance" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{c.type}</span>
                          <span className="text-sm font-bold text-slate-700">{c.percent}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.percent}%`, background: artistColor(c.name) }} />
                      </div>
                      {c.time > 0 && (
                        <p className="mt-0.5 text-[10px] text-slate-400">{fmtSec(c.time)} · {c.done}/{c.tasks} task done</p>
                      )}
                    </div>
                  ))}
                </div>
                {!dynamicContribs && (
                  <p className="mt-2 text-[10px] text-slate-400 italic">Persentase diperbarui otomatis saat task dikerjakan.</p>
                )}
              </div>

              {/* Keuangan */}
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Keuangan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400">Nilai Order</p>
                    <p className="mt-1 text-base font-bold text-slate-900">${order.total}</p>
                    <p className="text-xs text-slate-400">{formatMoney(order.total)}</p>
                  </div>
                  {order.fee_freelance > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                      <p className="text-xs text-amber-600">Fee Freelance</p>
                      <p className="mt-1 text-base font-bold text-amber-700">Rp{Number(order.fee_freelance).toLocaleString("id-ID")}</p>
                      <p className="text-xs text-amber-500">{Number(order.total) > 0 ? Math.round((order.fee_freelance / exchangeRate / Number(order.total)) * 100) : 0}% dari order</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 col-span-2">
                    <p className="text-xs text-emerald-600">Net</p>
                    <p className="mt-1 text-base font-bold text-emerald-700">${((Number(order.total) || 0) - (Number(order.fee_freelance) || 0) / exchangeRate).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              {order.notes && (
                <div className="px-6 py-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Catatan</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>
          ) : (
            /* EDIT MODE */
            <form id="drawer-edit-form" onSubmit={handleSave} className="space-y-0 divide-y divide-slate-100">
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Info Dasar</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-500">Tanggal Order<input type="date" value={form.order_date || ""} onChange={set("order_date")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Deadline<input type="date" value={form.deadline || ""} onChange={set("deadline")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Platform<select value={form.platform} onChange={set("platform")} className={inp}>{PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Marketer<select value={form.marketer || ""} onChange={set("marketer")} className={inp}><option value="">-</option>{MARKETER_OPTIONS.map((m) => <option key={m}>{m}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Market<input list="market-suggestions-drawer" value={form.market || ""} onChange={set("market")} placeholder="Magsika / Eirene / dll" className={inp} /><datalist id="market-suggestions-drawer">{markets.map((m) => <option key={m.id} value={m.name} />)}</datalist></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Order ID<input value={form.order_id || ""} onChange={set("order_id")} className={inp} /></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Klien<input value={form.client} onChange={set("client")} required className={inp} /></label>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Detail Project</p>
                <label className="mb-3 block space-y-1 text-xs font-medium text-slate-500">Nama Project<input value={form.project} onChange={set("project")} required className={inp} /></label>
                <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-700">Kode Folder</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer"><input type="checkbox" checked={manualFolder} onChange={(e) => setManualFolder(e.target.checked)} className="rounded" /> Edit manual</label>
                  </div>
                  {manualFolder ? <input value={form.folder_code || ""} onChange={set("folder_code")} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 font-mono text-sm text-indigo-800 outline-none" /> : <p className="font-mono text-sm font-semibold text-indigo-800">{autoFolderCode}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-500">Jenis Pekerjaan<select value={form.work_type} onChange={set("work_type")} className={inp}>{WORK_TYPE_OPTIONS.map((w) => <option key={w}>{w}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Status<select value={form.status} onChange={set("status")} className={inp}>{STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
                </div>
                {/* LIVE STREAM TOGGLE */}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, stream_allowed: !p.stream_allowed }))}
                  className={`mt-3 w-full flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                    form.stream_allowed ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg leading-none ${form.stream_allowed ? "animate-pulse" : "opacity-40"}`}>🔴</span>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${form.stream_allowed ? "text-red-700" : "text-slate-600"}`}>Live Stream</p>
                      <p className="text-xs text-slate-400">Tim harus streaming saat mengerjakan</p>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.stream_allowed ? "bg-red-500" : "bg-slate-200"}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.stream_allowed ? "translate-x-6" : "translate-x-1"}`} />
                  </div>
                </button>
              </div>
              {/* Milestones editor */}
              <div className="px-6 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Milestones</p>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, milestones: [...(p.milestones || []), emptyMilestone()] }))}
                    className="rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    + Tambah Milestone
                  </button>
                </div>
                {(!form.milestones || form.milestones.length === 0) ? (
                  <p className="text-xs text-slate-400">Order ini tidak menggunakan milestone.</p>
                ) : (
                  <div className="space-y-2">
                    {form.milestones.map((ms, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{idx + 1}</span>
                          <input
                            value={ms.title}
                            onChange={(e) => setForm((p) => { const m = [...p.milestones]; m[idx] = { ...m[idx], title: e.target.value }; return { ...p, milestones: m }; })}
                            placeholder="Nama milestone"
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                          />
                          <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, milestones: p.milestones.filter((_, i) => i !== idx) }))}
                            className="rounded-full p-1 text-slate-300 hover:text-rose-500"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pl-8">
                          <input
                            type="number" min="0" step="0.01"
                            value={ms.price || ""}
                            onChange={(e) => setForm((p) => { const m = [...p.milestones]; m[idx] = { ...m[idx], price: e.target.value }; return { ...p, milestones: m }; })}
                            placeholder="Harga $"
                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-300"
                          />
                          <input
                            type="date"
                            value={ms.deadline || ""}
                            onChange={(e) => setForm((p) => { const m = [...p.milestones]; m[idx] = { ...m[idx], deadline: e.target.value }; return { ...p, milestones: m }; })}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tim Artist</p>
                <div className="space-y-2">
                  {(form.artist_contributions || []).map((contrib, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{idx + 1}</span>
                      <input value={contrib.name} onChange={(e) => setContrib(idx, "name", e.target.value)} placeholder="Nama artist" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300" />
                      <select value={contrib.type} onChange={(e) => setContrib(idx, "type", e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none">
                        <option>Tim</option><option>Freelance</option>
                      </select>
                      <input type="number" min="0" max="100" value={contrib.percent} onChange={(e) => setContrib(idx, "percent", Number(e.target.value))} className="w-14 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm outline-none" />
                      <span className="text-xs text-slate-400">%</span>
                      {(form.artist_contributions || []).length > 1 && <button type="button" onClick={() => removeContrib(idx)} className="rounded-full p-1 text-slate-300 hover:text-rose-500"><X size={13} /></button>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-1.5 w-full rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${totalPct === 100 ? "bg-emerald-500" : totalPct > 100 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${Math.min(totalPct, 100)}%` }} /></div>
                    <p className="mt-0.5 text-xs text-slate-400">Total: <span className={totalPct === 100 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{totalPct}%</span></p>
                  </div>
                  <button type="button" onClick={addContrib} className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600">+ Tambah</button>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Keuangan</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">Nilai Order</p>
                      <div className="flex overflow-hidden rounded-lg border border-slate-200 text-[10px] font-bold">
                        <button type="button" onClick={() => setTotalCurrency("USD")} className={`px-2 py-0.5 transition ${totalCurrency === "USD" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>USD</button>
                        <button type="button" onClick={() => setTotalCurrency("IDR")} className={`px-2 py-0.5 transition ${totalCurrency === "IDR" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>IDR</button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{totalCurrency === "IDR" ? "Rp" : "$"}</span>
                      <input type="number" min="0" value={drawerDisplayTotal} onChange={handleDrawerTotalChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm outline-none focus:border-indigo-300" />
                    </div>
                    <p className="text-xs text-slate-400">
                      {totalCurrency === "IDR" ? `≈ $${(Number(form.total) || 0).toFixed(2)}` : `= Rp${Math.round((Number(form.total) || 0) * exchangeRate).toLocaleString("id-ID")}`}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Fee Freelance (Rp)</p>
                    <input type="number" min="0" value={form.fee_freelance || ""} onChange={set("fee_freelance")} disabled={!hasFreelance} placeholder="0" className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ${hasFreelance ? "focus:border-indigo-300" : "opacity-40 cursor-not-allowed"}`} />
                    {hasFreelance && feeIdr > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{Number(form.total) > 0 ? Math.round((feeIdr / exchangeRate / Number(form.total)) * 100) : 0}% dari order</span>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Net</p>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">${netUsd.toFixed(2)}</div>
                  </div>
                  <label className="space-y-1 text-xs font-medium text-slate-500">Payment<select value={form.payment_status} onChange={set("payment_status")} className={inp}>{PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
                </div>
                <label className="mt-3 block space-y-1 text-xs font-medium text-slate-500">Catatan<textarea value={form.notes || ""} onChange={set("notes")} rows={3} className={inp} /></label>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          {editing ? (
            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">Batal</button>
              <button type="submit" form="drawer-edit-form" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-60">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          ) : (
            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => onDelete(order.id)} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:-translate-y-0.5 hover:bg-rose-50">
                <Trash2 size={14} /> Hapus
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700">
                <Edit3 size={14} /> Edit Order
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
