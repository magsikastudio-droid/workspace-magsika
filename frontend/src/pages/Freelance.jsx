import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Edit3, Trash2, ChevronDown, ChevronUp,
  Link2, X, Search, AlertCircle, CheckCircle2, Clock, Circle,
  BarChart2,
} from "lucide-react";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { toast } from "sonner";

const STATUS_BAYAR = ["Belum Lunas", "DP", "Lunas"];

// Colorblind-friendly: blue for paid (not green), amber for partial, slate for unpaid
// Each status also has a unique icon — not just color
const STATUS_CFG = {
  "Lunas":       { sel: "bg-blue-100 text-blue-700 border-blue-200",   bar: "#60a5fa", icon: CheckCircle2, label: "Lunas" },
  "DP":          { sel: "bg-amber-100 text-amber-800 border-amber-300", bar: "#fbbf24", icon: Clock,        label: "DP" },
  "Belum Lunas": { sel: "bg-slate-100 text-slate-600 border-slate-300", bar: "#cbd5e1", icon: Circle,       label: "Belum Bayar" },
};

function nowMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const EMPTY_ARTIST = { name: "", bank: "", rekening: "", phone: "", notes: "" };
const EMPTY_PROJECT = { project_name: "", fee: "", dp_amount: "", dp_date: "", pelunasan_date: "", status_bayar: "Belum Lunas", notes: "", order_id: "" };

function avatarColor(name) {
  const h = Math.abs((name || "").split("").reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0)) % 360;
  return `hsl(${h}, 60%, 45%)`;
}

export default function Freelance() {
  const fmtIDR = (v) => (v || v === 0) ? `Rp ${Number(v).toLocaleString("id-ID")}` : "—";

  const [artists, setArtists]         = useState([]);
  const [projects, setProjects]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expandedArtist, setExpandedArtist] = useState(null);
  const [showRoster, setShowRoster]   = useState(false);

  const [showArtistModal, setShowArtistModal] = useState(false);
  const [editArtist, setEditArtist]           = useState(null);
  const [artistForm, setArtistForm]           = useState(EMPTY_ARTIST);

  const [showProjectModal, setShowProjectModal] = useState(null);
  const [editProject, setEditProject]           = useState(null);
  const [projectForm, setProjectForm]           = useState(EMPTY_PROJECT);
  const [orderSearch, setOrderSearch]           = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [monthFilter, setMonthFilter]     = useState(nowMonthStr());

  const { orders } = useOrders();

  const linkedableOrders = useMemo(() =>
    orders.filter((o) => (o.fee_freelance || 0) > 0),
    [orders]
  );

  const autoDetected = useMemo(() => {
    const names = new Set();
    orders.forEach((o) => {
      (o.artist_contributions || []).forEach((c) => {
        if (c.type === "Freelance" && c.name?.trim()) names.add(c.name.trim());
      });
    });
    const registered = new Set(artists.map((a) => a.name));
    return [...names].filter((n) => !registered.has(n));
  }, [orders, artists]);

  const filteredLinkOrders = useMemo(() => {
    if (!orderSearch.trim()) return linkedableOrders;
    const q = orderSearch.toLowerCase();
    return linkedableOrders.filter((o) =>
      o.project?.toLowerCase().includes(q) ||
      o.client?.toLowerCase().includes(q) ||
      o.folder_code?.toLowerCase().includes(q)
    );
  }, [linkedableOrders, orderSearch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ar, pr] = await Promise.all([
        api.get("/freelance/artists"),
        api.get("/freelance/projects"),
      ]);
      setArtists(ar.data.artists || []);
      setProjects(pr.data.projects || []);
    } catch {
      toast.error("Gagal memuat data freelance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const autoProjectsMap = useMemo(() => {
    const result = {};
    artists.forEach((artist) => {
      const linkedOrderIds = new Set(
        projects.filter((p) => p.artist_id === artist.id && p.order_id).map((p) => p.order_id)
      );
      const autoProjs = [];
      orders.forEach((o) => {
        if (linkedOrderIds.has(o.id)) return;
        const contrib = (o.artist_contributions || []).find(
          (c) => c.type === "Freelance" && c.name?.trim() === artist.name?.trim()
        );
        if (!contrib) return;
        const pct = Number(contrib.percent) > 0 ? Number(contrib.percent) : 100;
        autoProjs.push({
          id: `auto_${o.id}_${artist.id}`,
          artist_id: artist.id,
          project_name: o.project || "",
          fee: ((o.fee_freelance || 0) * pct) / 100,
          dp_amount: 0,
          dp_date: null,
          pelunasan_date: null,
          status_bayar: "Belum Lunas",
          notes: o.folder_code || "",
          order_id: o.id,
          is_auto: true,
          _order: o,
        });
      });
      result[artist.id] = autoProjs;
    });
    return result;
  }, [artists, projects, orders]);

  const allProjectsForArtist = (artistId) => [
    ...projects.filter((p) => p.artist_id === artistId),
    ...(autoProjectsMap[artistId] || []),
  ];

  // Filter logic:
  // - Paid (Lunas): show only in the month of payment (pelunasan_date)
  // - Unpaid/DP: always show (outstanding balance)
  const artistProjects = (artistId) => {
    const all = allProjectsForArtist(artistId);
    if (monthFilter === "all") return all;
    return all.filter((p) => {
      if (p.status_bayar === "Lunas") {
        return (p.pelunasan_date || "").startsWith(monthFilter);
      }
      return true; // unpaid always visible
    });
  };

  const totalFee      = (id) => artistProjects(id).reduce((s, p) => s + (p.fee || 0), 0);
  const paidFee       = (id) => artistProjects(id).filter((p) => p.status_bayar === "Lunas").reduce((s, p) => s + (p.fee || 0), 0);
  const dpFee         = (id) => artistProjects(id).filter((p) => p.status_bayar === "DP").reduce((s, p) => s + (p.dp_amount || 0), 0);
  const outstanding   = (id) => artistProjects(id).filter((p) => p.status_bayar !== "Lunas").reduce((s, p) => s + (p.fee || 0) - (p.dp_amount || 0), 0);

  // Only show artists with visible projects (when filtered)
  const visibleArtists = useMemo(() =>
    artists.filter((a) => monthFilter === "all" || artistProjects(a.id).length > 0),
    [artists, monthFilter, projects, autoProjectsMap, orders] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const availableMonths = useMemo(() => {
    const set = new Set();
    [...projects, ...Object.values(autoProjectsMap).flat()].forEach((p) => {
      const linked = p.order_id ? orders.find((o) => o.id === p.order_id) : null;
      const date = p.status_bayar === "Lunas" ? p.pelunasan_date : (linked?.order_date || p.dp_date);
      if (date) set.add(date.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [projects, autoProjectsMap, orders]);

  // Summary for current filter
  const filteredTotal       = visibleArtists.reduce((s, a) => s + totalFee(a.id), 0);
  const filteredPaid        = visibleArtists.reduce((s, a) => s + paidFee(a.id), 0);
  const filteredDp          = visibleArtists.reduce((s, a) => s + dpFee(a.id), 0);
  const filteredOutstanding = visibleArtists.reduce((s, a) => s + outstanding(a.id), 0);

  // All-time totals per artist (for roster)
  const artistLifetime = (artistId) => {
    const all = allProjectsForArtist(artistId);
    return {
      count:   all.length,
      total:   all.reduce((s, p) => s + (p.fee || 0), 0),
      paid:    all.filter((p) => p.status_bayar === "Lunas").reduce((s, p) => s + (p.fee || 0), 0),
      active:  all.filter((p) => p.status_bayar !== "Lunas").length,
    };
  };

  const handleSaveArtist = async (e) => {
    e.preventDefault();
    try {
      if (editArtist) {
        await api.patch(`/freelance/artists/${editArtist.id}`, artistForm);
        toast.success("Artist diperbarui");
      } else {
        await api.post("/freelance/artists", artistForm);
        toast.success("Artist ditambahkan");
      }
      setShowArtistModal(false); setEditArtist(null); setArtistForm(EMPTY_ARTIST);
      loadAll();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const handleDeleteArtist = async (id) => {
    try {
      await api.delete(`/freelance/artists/${id}`);
      toast.success("Artist dihapus");
      setConfirmDelete(null); loadAll();
    } catch { toast.error("Gagal menghapus"); }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...projectForm,
        artist_id:       showProjectModal,
        fee:             projectForm.fee ? Number(projectForm.fee) : 0,
        dp_amount:       projectForm.dp_amount ? Number(projectForm.dp_amount) : null,
        dp_date:         projectForm.dp_date || null,
        pelunasan_date:  projectForm.pelunasan_date || null,
        order_id:        projectForm.order_id || null,
      };
      if (editProject) {
        await api.patch(`/freelance/projects/${editProject.id}`, payload);
        toast.success("Project diperbarui");
      } else {
        await api.post("/freelance/projects", payload);
        toast.success("Project ditambahkan");
      }
      setShowProjectModal(null); setEditProject(null); setProjectForm(EMPTY_PROJECT); setOrderSearch("");
      loadAll();
    } catch { toast.error("Gagal menyimpan project"); }
  };

  const handleUpdateStatus = async (projectId, status_bayar) => {
    try {
      const extra = {};
      if (status_bayar === "Lunas" && !projects.find((p) => p.id === projectId)?.pelunasan_date) {
        extra.pelunasan_date = new Date().toISOString().slice(0, 10);
      }
      await api.patch(`/freelance/projects/${projectId}`, { status_bayar, ...extra });
      loadAll();
    } catch { toast.error("Gagal update status"); }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Hapus project ini?")) return;
    try {
      await api.delete(`/freelance/projects/${projectId}`);
      toast.success("Project dihapus"); loadAll();
    } catch { toast.error("Gagal menghapus"); }
  };

  const openAddProject = (artistId, prefillOrder = null) => {
    setEditProject(null);
    if (prefillOrder) {
      const artist = artists.find((a) => a.id === artistId);
      const contrib = (prefillOrder.artist_contributions || []).find(
        (c) => c.type === "Freelance" && c.name?.trim() === artist?.name?.trim()
      );
      const pct = Number(contrib?.percent) > 0 ? Number(contrib.percent) : 100;
      setProjectForm({
        ...EMPTY_PROJECT,
        project_name: prefillOrder.project || "",
        fee: (((prefillOrder.fee_freelance || 0) * pct) / 100).toString(),
        notes: prefillOrder.folder_code || "",
        order_id: prefillOrder.id,
      });
    } else {
      setProjectForm(EMPTY_PROJECT);
    }
    setOrderSearch(""); setShowProjectModal(artistId);
  };

  const openEditProject = (artistId, proj) => {
    setEditProject(proj);
    setProjectForm({
      project_name:   proj.project_name || "",
      fee:            proj.fee?.toString() || "",
      dp_amount:      proj.dp_amount?.toString() || "",
      dp_date:        proj.dp_date || "",
      pelunasan_date: proj.pelunasan_date || "",
      status_bayar:   proj.status_bayar || "Belum Lunas",
      notes:          proj.notes || "",
      order_id:       proj.order_id || "",
    });
    setOrderSearch(""); setShowProjectModal(artistId);
  };

  const linkOrder = (order) => {
    setProjectForm((p) => ({
      ...p,
      project_name: p.project_name || order.project,
      fee: p.fee || (order.fee_freelance?.toString() || ""),
      order_id: order.id,
    }));
    setOrderSearch("");
  };

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 transition";

  const monthLabel = (m) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleString("id-ID", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Users size={28} className="text-violet-500" /> Freelancer
          </h1>
          <p className="mt-1 text-sm text-slate-500">Kelola profil & pembayaran artist freelance.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400"
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.includes(nowMonthStr()) ? null : (
              <option value={nowMonthStr()}>{monthLabel(nowMonthStr())}</option>
            )}
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button
            onClick={() => { setEditArtist(null); setArtistForm(EMPTY_ARTIST); setShowArtistModal(true); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
          >
            <Plus size={15} /> Tambah Artist
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {!loading && artists.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Total Fee</p>
            <p className="mt-1.5 text-xl font-bold text-slate-900">{fmtIDR(filteredTotal)}</p>
            <p className="mt-0.5 text-xs text-slate-400">{visibleArtists.length} freelancer</p>
          </div>
          <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={13} className="text-blue-500" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Lunas</p>
            </div>
            <p className="text-xl font-bold text-blue-700">{fmtIDR(filteredPaid)}</p>
            <p className="mt-0.5 text-xs text-blue-400">{filteredTotal > 0 ? Math.round((filteredPaid / filteredTotal) * 100) : 0}% dari total</p>
          </div>
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={13} className="text-amber-500" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">DP Masuk</p>
            </div>
            <p className="text-xl font-bold text-amber-700">{fmtIDR(filteredDp)}</p>
            <p className="mt-0.5 text-xs text-amber-400">sudah ditransfer sebagian</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Circle size={13} className="text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-slate-700">{fmtIDR(filteredOutstanding)}</p>
            <p className="mt-0.5 text-xs text-slate-400">belum ditransfer</p>
          </div>
        </div>
      )}

      {/* ── Auto-detected alert ── */}
      {!loading && autoDetected.length > 0 && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-700">
              {autoDetected.length} freelancer terdeteksi dari order — belum terdaftar
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {autoDetected.map((name) => (
              <button
                key={name}
                onClick={() => { setEditArtist(null); setArtistForm({ ...EMPTY_ARTIST, name }); setShowArtistModal(true); }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition"
              >
                <Plus size={14} /> Daftarkan {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Artist cards ── */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Memuat data...</div>
      ) : artists.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-16 text-center">
          <Users size={40} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">Belum ada freelancer.</p>
          <p className="text-sm text-slate-400 mt-1">Tambah artist pertama kamu.</p>
        </div>
      ) : visibleArtists.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-blue-300" />
          <p className="text-slate-600 font-semibold">Semua freelancer sudah lunas bulan ini</p>
          <p className="text-sm text-slate-400 mt-1">Tidak ada outstanding di {monthLabel(monthFilter)}. Pilih "Semua Bulan" untuk melihat riwayat.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleArtists.map((artist) => {
            const aproj    = artistProjects(artist.id);
            const total    = totalFee(artist.id);
            const paid     = paidFee(artist.id);
            const dp       = dpFee(artist.id);
            const owed     = outstanding(artist.id);
            const paidPct  = total > 0 ? (paid / total) * 100 : 0;
            const dpPct    = total > 0 ? (dp / total) * 100 : 0;
            const expanded = expandedArtist === artist.id;

            return (
              <div key={artist.id} className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Artist row */}
                <div className="flex flex-wrap items-center gap-4 p-5">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shrink-0"
                      style={{ background: avatarColor(artist.name) }}
                    >
                      {artist.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-lg leading-tight truncate">{artist.name}</p>
                      {(artist.bank || artist.rekening) && (
                        <p className="text-xs text-slate-500 mt-0.5">{artist.bank}{artist.rekening ? ` · ${artist.rekening}` : ""}</p>
                      )}
                      {artist.phone && <p className="text-xs text-slate-400">{artist.phone}</p>}
                      {!artist.bank && !artist.phone && (
                        <p className="text-xs text-amber-500 mt-0.5">Rekening & kontak belum diisi</p>
                      )}
                    </div>
                  </div>

                  {/* Payment progress */}
                  {total > 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 min-w-[200px] max-w-[260px]">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Fee</span>
                        <span className="text-sm font-bold text-slate-800">{fmtIDR(total)}</span>
                      </div>
                      {/* Stacked bar */}
                      <div className="h-2.5 w-full flex overflow-hidden rounded-full bg-slate-200">
                        {paidPct > 0 && (
                          <div className="h-full transition-all" style={{ width: `${paidPct}%`, background: STATUS_CFG["Lunas"].bar }} />
                        )}
                        {dpPct > 0 && (
                          <div className="h-full transition-all" style={{ width: `${dpPct}%`, background: STATUS_CFG["DP"].bar }} />
                        )}
                      </div>
                      {/* Labels */}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                        {paid > 0 && (
                          <span className="flex items-center gap-1 text-blue-600 font-semibold">
                            <CheckCircle2 size={11} /> {fmtIDR(paid)}
                          </span>
                        )}
                        {dp > 0 && (
                          <span className="flex items-center gap-1 text-amber-700 font-semibold">
                            <Clock size={11} /> DP {fmtIDR(dp)}
                          </span>
                        )}
                        {owed > 0 && (
                          <span className="flex items-center gap-1 text-slate-500 font-semibold">
                            <Circle size={11} /> Sisa {fmtIDR(owed)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 text-center min-w-[140px]">
                      Belum ada project
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => openAddProject(artist.id)}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
                    >
                      <Plus size={14} /> Tambah Project
                    </button>
                    <button
                      onClick={() => { setEditArtist(artist); setArtistForm({ name: artist.name, bank: artist.bank || "", rekening: artist.rekening || "", phone: artist.phone || "", notes: artist.notes || "" }); setShowArtistModal(true); }}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(artist)}
                      className="inline-flex items-center gap-1 rounded-2xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} /> Hapus
                    </button>
                    <button
                      onClick={() => setExpandedArtist(expanded ? null : artist.id)}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 transition"
                    >
                      {expanded ? <><ChevronUp size={14} /> Tutup</> : <><ChevronDown size={14} /> Project ({aproj.length})</>}
                    </button>
                  </div>
                </div>

                {/* ── Expanded project list ── */}
                {expanded && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                    {artist.notes && (
                      <p className="mb-3 text-sm text-slate-500 italic">{artist.notes}</p>
                    )}
                    {aproj.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                        Belum ada project untuk {artist.name}.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aproj.map((proj) => {
                          const rem        = (proj.fee || 0) - (proj.dp_amount || 0);
                          const dpPctProj  = proj.fee > 0 ? ((proj.dp_amount || 0) / proj.fee) * 100 : 0;
                          const linkedOrder = proj.order_id ? orders.find((o) => o.id === proj.order_id) : null;
                          const cfg        = STATUS_CFG[proj.status_bayar] || STATUS_CFG["Belum Lunas"];
                          const StatusIcon = cfg.icon;

                          if (proj.is_auto) {
                            return (
                              <div key={proj.id} className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold text-slate-900">{proj.project_name}</p>
                                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">Auto</span>
                                      {linkedOrder && (
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                                          <Link2 size={9} /> {linkedOrder.folder_code || linkedOrder.project}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                                      {proj.fee > 0
                                        ? <span className="font-semibold text-slate-900">{fmtIDR(proj.fee)}</span>
                                        : <span className="text-slate-400 italic">Fee belum diset di order</span>}
                                      {linkedOrder?.order_date && <span className="text-slate-400">{linkedOrder.order_date}</span>}
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                        <Circle size={9} /> Belum Bayar
                                      </span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-violet-500">Terdeteksi otomatis dari order · Catat untuk atur pembayaran</p>
                                  </div>
                                  <button
                                    onClick={() => openAddProject(artist.id, proj._order)}
                                    className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition shrink-0"
                                  >
                                    <Plus size={12} /> Catat
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          /* ── Manual project ── */
                          return (
                            <div key={proj.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Name + link */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900">{proj.project_name}</p>
                                    {linkedOrder && (
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                                        <Link2 size={9} /> {linkedOrder.folder_code || linkedOrder.project}
                                      </span>
                                    )}
                                  </div>

                                  {/* Fee + dates row */}
                                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
                                    <span className="text-slate-400">Fee total</span>
                                    <span className="font-bold text-slate-900">{fmtIDR(proj.fee)}</span>
                                    {proj.dp_amount > 0 && (
                                      <>
                                        <span className="text-slate-400">DP dibayar</span>
                                        <span className="font-semibold text-amber-700">
                                          {fmtIDR(proj.dp_amount)}{proj.dp_date ? ` · ${proj.dp_date}` : ""}
                                        </span>
                                      </>
                                    )}
                                    {proj.pelunasan_date && (
                                      <>
                                        <span className="text-slate-400">Pelunasan</span>
                                        <span className="font-semibold text-blue-600">{proj.pelunasan_date}</span>
                                      </>
                                    )}
                                    {rem > 0 && proj.status_bayar !== "Lunas" && (
                                      <>
                                        <span className="text-slate-400">Sisa</span>
                                        <span className="font-bold text-slate-700">{fmtIDR(rem)}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Progress bar — only when partially paid */}
                                  {proj.fee > 0 && proj.status_bayar === "DP" && (
                                    <div className="mt-2.5">
                                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                        <span>Progress pembayaran</span>
                                        <span>{Math.round(dpPctProj)}%</span>
                                      </div>
                                      <div className="h-2 w-full flex overflow-hidden rounded-full bg-slate-200">
                                        <div
                                          className="h-full transition-all"
                                          style={{ width: `${dpPctProj}%`, background: STATUS_CFG["DP"].bar }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {proj.notes && <p className="mt-2 text-xs text-slate-400 italic">{proj.notes}</p>}
                                </div>

                                {/* Status + actions */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <select
                                    value={proj.status_bayar}
                                    onChange={(e) => handleUpdateStatus(proj.id, e.target.value)}
                                    className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer ${cfg.sel}`}
                                  >
                                    {STATUS_BAYAR.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => openEditProject(artist.id, proj)}
                                      className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProject(proj.id)}
                                      className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 transition"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Daftar Freelancer (roster) ── */}
      {!loading && artists.length > 0 && (
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition"
            onClick={() => setShowRoster((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <BarChart2 size={18} className="text-violet-500" />
              <div className="text-left">
                <p className="font-bold text-slate-900">Data Freelancer</p>
                <p className="text-xs text-slate-400">{artists.length} freelancer terdaftar · statistik semua waktu</p>
              </div>
            </div>
            {showRoster ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {showRoster && (
            <div className="border-t border-slate-100 px-6 pb-6 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {artists.map((artist) => {
                  const lt = artistLifetime(artist.id);
                  const ltPct = lt.total > 0 ? Math.round((lt.paid / lt.total) * 100) : 0;
                  return (
                    <div key={artist.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shrink-0"
                          style={{ background: avatarColor(artist.name) }}
                        >
                          {artist.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{artist.name}</p>
                          {(artist.bank || artist.rekening) && (
                            <p className="text-xs text-slate-500 truncate">{artist.bank}{artist.rekening ? ` · ${artist.rekening}` : ""}</p>
                          )}
                          {artist.phone && <p className="text-xs text-slate-400">{artist.phone}</p>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                          <p className="text-slate-400 mb-0.5">Total Project</p>
                          <p className="font-bold text-slate-800 text-sm">{lt.count}</p>
                          {lt.active > 0 && <p className="text-amber-600 text-[10px]">{lt.active} aktif</p>}
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                          <p className="text-slate-400 mb-0.5">Total Fee</p>
                          <p className="font-bold text-slate-800">{fmtIDR(lt.total)}</p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-white border border-blue-100 px-3 py-2">
                          <div className="flex justify-between mb-1.5">
                            <span className="text-slate-400">Sudah dibayar</span>
                            <span className="font-bold text-blue-700">{fmtIDR(lt.paid)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full transition-all" style={{ width: `${ltPct}%`, background: STATUS_CFG["Lunas"].bar }} />
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400 text-right">{ltPct}% lunas</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Artist Modal ── */}
      {showArtistModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editArtist ? "Edit Artist" : "Tambah Artist"}</h2>
              <button onClick={() => { setShowArtistModal(false); setEditArtist(null); }} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveArtist} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nama *</label>
                <input value={artistForm.name} onChange={(e) => setArtistForm((p) => ({ ...p, name: e.target.value }))} required className={inputCls} placeholder="Nama artist" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank</label>
                  <input value={artistForm.bank} onChange={(e) => setArtistForm((p) => ({ ...p, bank: e.target.value }))} placeholder="BCA, BRI..." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">No. Rekening</label>
                  <input value={artistForm.rekening} onChange={(e) => setArtistForm((p) => ({ ...p, rekening: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">No. HP / WhatsApp</label>
                <input value={artistForm.phone} onChange={(e) => setArtistForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
                <textarea value={artistForm.notes} onChange={(e) => setArtistForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowArtistModal(false); setEditArtist(null); }} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">Batal</button>
                <button type="submit" className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Project Modal ── */}
      {showProjectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editProject ? "Edit Project" : "Tambah Project Freelance"}</h2>
              <button onClick={() => { setShowProjectModal(null); setEditProject(null); setOrderSearch(""); }} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
            </div>

            {!editProject && linkedableOrders.length > 0 && (
              <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-3">
                <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1"><Link2 size={12} /> Tautkan dari Order (opsional)</p>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Cari order..."
                    className="w-full rounded-2xl border border-sky-200 bg-white pl-8 pr-3 py-2 text-xs outline-none focus:border-sky-400"
                  />
                </div>
                {projectForm.order_id && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-sky-100 px-3 py-2 text-xs text-sky-700 font-semibold">
                    <Link2 size={11} />
                    Tertaut: {orders.find((o) => o.id === projectForm.order_id)?.project || projectForm.order_id}
                    <button onClick={() => setProjectForm((p) => ({ ...p, order_id: "" }))} className="ml-auto"><X size={12} /></button>
                  </div>
                )}
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {filteredLinkOrders.slice(0, 8).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => linkOrder(o)}
                      disabled={projectForm.order_id === o.id}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${projectForm.order_id === o.id ? "bg-sky-200 text-sky-800 cursor-default" : "bg-white hover:bg-sky-100 text-slate-700"}`}
                    >
                      <span className="font-medium truncate">{o.project}</span>
                      <span className="shrink-0 ml-2 font-semibold text-sky-600">Rp {o.fee_freelance?.toLocaleString("id-ID")}</span>
                    </button>
                  ))}
                  {filteredLinkOrders.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">Tidak ada order.</p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProject} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Project *</label>
                <input value={projectForm.project_name} onChange={(e) => setProjectForm((p) => ({ ...p, project_name: e.target.value }))} required className={inputCls} placeholder="Nama project" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fee Total (Rp) *</label>
                  <input value={projectForm.fee} onChange={(e) => setProjectForm((p) => ({ ...p, fee: e.target.value }))} type="number" min="0" required className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah DP</label>
                  <input value={projectForm.dp_amount} onChange={(e) => setProjectForm((p) => ({ ...p, dp_amount: e.target.value }))} type="number" min="0" className={inputCls} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal DP</label>
                  <input value={projectForm.dp_date} onChange={(e) => setProjectForm((p) => ({ ...p, dp_date: e.target.value }))} type="date" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Pelunasan</label>
                  <input value={projectForm.pelunasan_date} onChange={(e) => setProjectForm((p) => ({ ...p, pelunasan_date: e.target.value }))} type="date" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status Bayar</label>
                <select value={projectForm.status_bayar} onChange={(e) => setProjectForm((p) => ({ ...p, status_bayar: e.target.value }))} className={inputCls}>
                  {STATUS_BAYAR.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
                <textarea value={projectForm.notes} onChange={(e) => setProjectForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowProjectModal(null); setEditProject(null); setOrderSearch(""); }} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">Batal</button>
                <button type="submit" className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
                  {editProject ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm delete artist ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Hapus Artist?</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-semibold">{confirmDelete.name}</span> dan semua project-nya akan dihapus permanen.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">Batal</button>
              <button onClick={() => handleDeleteArtist(confirmDelete.id)} className="rounded-2xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
