import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Edit3, Trash2, ChevronDown, ChevronUp,
  CreditCard, Link2, X, Search, TrendingUp, AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";

const STATUS_BAYAR = ["Belum Lunas", "DP", "Lunas"];

const statusColor = {
  "Lunas":       "bg-emerald-100 text-emerald-700 border-emerald-200",
  "DP":          "bg-amber-100 text-amber-700 border-amber-200",
  "Belum Lunas": "bg-rose-100 text-rose-700 border-rose-200",
};

function nowMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const EMPTY_ARTIST = { name: "", bank: "", rekening: "", phone: "", notes: "" };
const EMPTY_PROJECT = { project_name: "", fee: "", dp_amount: "", dp_date: "", pelunasan_date: "", status_bayar: "Belum Lunas", notes: "", order_id: "" };

export default function Freelance() {
  const { formatMoney } = useCurrency();
  const [artists, setArtists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedArtist, setExpandedArtist] = useState(null);

  const [showArtistModal, setShowArtistModal] = useState(false);
  const [editArtist, setEditArtist] = useState(null);
  const [artistForm, setArtistForm] = useState(EMPTY_ARTIST);

  const [showProjectModal, setShowProjectModal] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [orderSearch, setOrderSearch] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [monthFilter, setMonthFilter] = useState("all");

  const { orders } = useOrders();

  /* Orders dengan fee_freelance > 0 untuk auto-link */
  const linkedableOrders = useMemo(() =>
    orders.filter((o) => (o.fee_freelance || 0) > 0),
    [orders]
  );

  /* Artist yang muncul di order sebagai Freelance tapi belum terdaftar */
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

  const artistProjects = (artistId) => {
    const all = projects.filter((p) => p.artist_id === artistId);
    if (monthFilter === "all") return all;
    return all.filter((p) => {
      const linked = p.order_id ? orders.find((o) => o.id === p.order_id) : null;
      const dateRef = linked?.order_date || p.dp_date || p.pelunasan_date || "";
      return dateRef.startsWith(monthFilter);
    });
  };
  const totalFee = (artistId) => artistProjects(artistId).reduce((s, p) => s + (p.fee || 0), 0);
  const paidFee = (artistId) => artistProjects(artistId).filter((p) => p.status_bayar === "Lunas").reduce((s, p) => s + (p.fee || 0), 0);
  const dpFee = (artistId) => artistProjects(artistId).filter((p) => p.status_bayar === "DP").reduce((s, p) => s + (p.dp_amount || 0), 0);

  const availableMonths = useMemo(() => {
    const set = new Set();
    projects.forEach((p) => {
      const linked = p.order_id ? orders.find((o) => o.id === p.order_id) : null;
      const date = linked?.order_date || p.dp_date || p.pelunasan_date;
      if (date) set.add(date.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [projects, orders]);

  /* Global summary — always all-time, ignores monthFilter */
  const allTimeArtistProjects = (artistId) => projects.filter((p) => p.artist_id === artistId);
  const globalTotal = artists.reduce((s, a) => s + allTimeArtistProjects(a.id).reduce((t, p) => t + (p.fee || 0), 0), 0);
  const globalPaid  = artists.reduce((s, a) => s + allTimeArtistProjects(a.id).filter((p) => p.status_bayar === "Lunas").reduce((t, p) => t + (p.fee || 0), 0), 0);
  const globalOutstanding = (() => {
    let out = 0;
    artists.forEach((a) => {
      allTimeArtistProjects(a.id).filter((p) => p.status_bayar !== "Lunas").forEach((p) => {
        out += (p.fee || 0) - (p.dp_amount || 0);
      });
    });
    return out;
  })();

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
      setShowArtistModal(false);
      setEditArtist(null);
      setArtistForm(EMPTY_ARTIST);
      loadAll();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const handleDeleteArtist = async (id) => {
    try {
      await api.delete(`/freelance/artists/${id}`);
      toast.success("Artist dihapus");
      setConfirmDelete(null);
      loadAll();
    } catch { toast.error("Gagal menghapus"); }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...projectForm,
        artist_id: showProjectModal,
        fee: projectForm.fee ? Number(projectForm.fee) : 0,
        dp_amount: projectForm.dp_amount ? Number(projectForm.dp_amount) : null,
        dp_date: projectForm.dp_date || null,
        pelunasan_date: projectForm.pelunasan_date || null,
        order_id: projectForm.order_id || null,
      };
      if (editProject) {
        await api.patch(`/freelance/projects/${editProject.id}`, payload);
        toast.success("Project diperbarui");
      } else {
        await api.post("/freelance/projects", payload);
        toast.success("Project ditambahkan");
      }
      setShowProjectModal(null);
      setEditProject(null);
      setProjectForm(EMPTY_PROJECT);
      setOrderSearch("");
      loadAll();
    } catch { toast.error("Gagal menyimpan project"); }
  };

  const handleUpdateStatus = async (projectId, status_bayar) => {
    try {
      await api.patch(`/freelance/projects/${projectId}`, { status_bayar });
      loadAll();
    } catch { toast.error("Gagal update status"); }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Hapus project ini?")) return;
    try {
      await api.delete(`/freelance/projects/${projectId}`);
      toast.success("Project dihapus");
      loadAll();
    } catch { toast.error("Gagal menghapus"); }
  };

  const openAddProject = (artistId) => {
    setEditProject(null);
    setProjectForm(EMPTY_PROJECT);
    setOrderSearch("");
    setShowProjectModal(artistId);
  };

  const openEditProject = (artistId, proj) => {
    setEditProject(proj);
    setProjectForm({
      project_name: proj.project_name || "",
      fee: proj.fee?.toString() || "",
      dp_amount: proj.dp_amount?.toString() || "",
      dp_date: proj.dp_date || "",
      pelunasan_date: proj.pelunasan_date || "",
      status_bayar: proj.status_bayar || "Belum Lunas",
      notes: proj.notes || "",
      order_id: proj.order_id || "",
    });
    setOrderSearch("");
    setShowProjectModal(artistId);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Users size={28} className="text-sky-500" /> Freelancer
          </h1>
          <p className="mt-1 text-sm text-slate-500">Kelola profil & pembayaran artist freelance.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map((m) => {
              const [y, mo] = m.split("-").map(Number);
              const label = new Date(y, mo - 1, 1).toLocaleString("id-ID", { month: "long", year: "numeric" });
              return <option key={m} value={m}>{label}</option>;
            })}
          </select>
          <button
            onClick={() => { setEditArtist(null); setArtistForm(EMPTY_ARTIST); setShowArtistModal(true); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition"
          >
            <Plus size={15} /> Tambah Artist
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && artists.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Fee</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(globalTotal)}</p>
            <p className="mt-1 text-xs text-slate-400">{artists.length} artist freelance</p>
          </div>
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Sudah Lunas</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(globalPaid)}</p>
            <p className="mt-1 text-xs text-emerald-500">{globalTotal > 0 ? Math.round((globalPaid / globalTotal) * 100) : 0}% dari total</p>
          </div>
          <div className="rounded-[2rem] border border-rose-100 bg-rose-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">Outstanding</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{formatMoney(globalOutstanding)}</p>
            <p className="mt-1 text-xs text-rose-400">belum/DP sisa</p>
          </div>
        </div>
      )}

      {/* Auto-detected unregistered freelancers */}
      {!loading && autoDetected.length > 0 && (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
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

      {loading ? (
        <div className="text-center py-16 text-slate-400">Memuat data...</div>
      ) : artists.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-16 text-center">
          <Users size={40} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">Belum ada freelancer.</p>
          <p className="text-sm text-slate-400 mt-1">Tambah artist pertama kamu.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {artists.map((artist) => {
            const aproj = artistProjects(artist.id);
            const total = totalFee(artist.id);
            const paid = paidFee(artist.id);
            const dp = dpFee(artist.id);
            const outstanding = aproj.filter((p) => p.status_bayar !== "Lunas").reduce((s, p) => s + (p.fee || 0) - (p.dp_amount || 0), 0);
            const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
            const dpPct = total > 0 ? Math.round(((paid + dp) / total) * 100) : 0;
            const expanded = expandedArtist === artist.id;
            const artistColor = `hsl(${Math.abs(artist.name.split("").reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % 360}, 65%, 50%)`;

            return (
              <div key={artist.id} className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Artist row */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shrink-0"
                      style={{ background: artistColor }}
                    >
                      {artist.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xl leading-tight">{artist.name}</p>
                      {(artist.bank || artist.rekening) && (
                        <p className="text-sm text-slate-500 mt-0.5">{artist.bank}{artist.rekening ? ` · ${artist.rekening}` : ""}</p>
                      )}
                      {artist.phone && <p className="text-sm text-slate-400">{artist.phone}</p>}
                      {!artist.bank && !artist.phone && (
                        <p className="text-xs text-amber-500 mt-0.5">Rekening & kontak belum diisi</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5">
                    {/* Fee summary */}
                    {total > 0 ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 min-w-[180px]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Fee</span>
                          <span className="text-base font-bold text-slate-900">{formatMoney(total)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${dpPct}%` }} />
                          <div className="h-full rounded-full bg-emerald-500 -mt-2 transition-all" style={{ width: `${paidPct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-xs text-emerald-600 font-semibold">Lunas: {formatMoney(paid)}</span>
                          {outstanding > 0 && <span className="text-xs text-rose-500 font-semibold">Sisa: {formatMoney(outstanding)}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 text-center">
                        Belum ada project
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openAddProject(artist.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition"
                      >
                        <Plus size={15} /> Tambah Project
                      </button>
                      <button
                        onClick={() => { setEditArtist(artist); setArtistForm({ name: artist.name, bank: artist.bank || "", rekening: artist.rekening || "", phone: artist.phone || "", notes: artist.notes || "" }); setShowArtistModal(true); }}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(artist)}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                      <button
                        onClick={() => setExpandedArtist(expanded ? null : artist.id)}
                        className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 transition"
                      >
                        {expanded ? <><ChevronUp size={15} /> Tutup</> : <><ChevronDown size={15} /> Lihat Project ({aproj.length})</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded project list */}
                {expanded && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-3">
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
                          const remaining = (proj.fee || 0) - (proj.dp_amount || 0);
                          const dpPct = proj.fee > 0 ? Math.round(((proj.dp_amount || 0) / proj.fee) * 100) : 0;
                          const linkedOrder = proj.order_id ? orders.find((o) => o.id === proj.order_id) : null;
                          return (
                            <div key={proj.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900">{proj.project_name}</p>
                                    {linkedOrder && (
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600 border border-sky-100">
                                        <Link2 size={9} /> {linkedOrder.folder_code || linkedOrder.project}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-900">{formatMoney(proj.fee)}</span>
                                    {proj.dp_amount > 0 && (
                                      <>
                                        <span>DP: <span className="font-semibold text-amber-700">{formatMoney(proj.dp_amount)}</span></span>
                                        {proj.dp_date && <span>Tgl DP: {proj.dp_date}</span>}
                                      </>
                                    )}
                                    {proj.pelunasan_date && <span>Pelunasan: {proj.pelunasan_date}</span>}
                                  </div>
                                  {proj.fee > 0 && proj.status_bayar !== "Lunas" && (
                                    <div className="mt-2">
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${dpPct}%` }} />
                                      </div>
                                      {remaining > 0 && (
                                        <p className="mt-0.5 text-[10px] text-rose-500">Sisa {formatMoney(remaining)}</p>
                                      )}
                                    </div>
                                  )}
                                  {proj.notes && <p className="mt-1.5 text-xs text-slate-400 italic">{proj.notes}</p>}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <select
                                    value={proj.status_bayar}
                                    onChange={(e) => handleUpdateStatus(proj.id, e.target.value)}
                                    className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer ${statusColor[proj.status_bayar] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                  >
                                    {STATUS_BAYAR.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                  <button
                                    onClick={() => openEditProject(artist.id, proj)}
                                    className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProject(proj.id)}
                                    className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-100 transition"
                                  >
                                    <Trash2 size={13} />
                                  </button>
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

      {/* Artist Modal */}
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
                <button type="submit" className="rounded-2xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editProject ? "Edit Project" : "Tambah Project Freelance"}</h2>
              <button onClick={() => { setShowProjectModal(null); setEditProject(null); setOrderSearch(""); }} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
            </div>

            {/* Auto-link from orders */}
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
                <button type="submit" className="rounded-2xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition">
                  {editProject ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete artist */}
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
