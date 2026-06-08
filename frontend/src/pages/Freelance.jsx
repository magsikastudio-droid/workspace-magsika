import React, { useCallback, useEffect, useState } from "react";
import { Users, Plus, Edit3, Trash2, ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const STATUS_BAYAR = ["Belum Lunas", "DP", "Lunas"];

const statusColor = {
  "Lunas":       "bg-emerald-100 text-emerald-700",
  "DP":          "bg-amber-100 text-amber-700",
  "Belum Lunas": "bg-rose-100 text-rose-700",
};

export default function Freelance() {
  const [artists, setArtists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedArtist, setExpandedArtist] = useState(null);
  const [showArtistForm, setShowArtistForm] = useState(false);
  const [editArtist, setEditArtist] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [artistForm, setArtistForm] = useState({ name: "", bank: "", rekening: "", phone: "", notes: "" });
  const [projectForm, setProjectForm] = useState({ project_name: "", fee: "", dp_amount: "", dp_date: "", pelunasan_date: "", status_bayar: "Belum Lunas", notes: "" });

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

  const artistProjects = (artistId) => projects.filter((p) => p.artist_id === artistId);
  const totalFee = (artistId) => artistProjects(artistId).reduce((s, p) => s + (p.fee || 0), 0);
  const paidFee = (artistId) => artistProjects(artistId).filter((p) => p.status_bayar === "Lunas").reduce((s, p) => s + (p.fee || 0), 0);

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
      setShowArtistForm(false);
      setEditArtist(null);
      setArtistForm({ name: "", bank: "", rekening: "", phone: "", notes: "" });
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
      await api.post("/freelance/projects", { ...projectForm, artist_id: showProjectForm, fee: Number(projectForm.fee), dp_amount: projectForm.dp_amount ? Number(projectForm.dp_amount) : null });
      toast.success("Project ditambahkan");
      setShowProjectForm(null);
      setProjectForm({ project_name: "", fee: "", dp_amount: "", dp_date: "", pelunasan_date: "", status_bayar: "Belum Lunas", notes: "" });
      loadAll();
    } catch { toast.error("Gagal menyimpan project"); }
  };

  const handleUpdateProjectStatus = async (projectId, status_bayar) => {
    try {
      await api.patch(`/freelance/projects/${projectId}`, { status_bayar });
      loadAll();
    } catch { toast.error("Gagal update status"); }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await api.delete(`/freelance/projects/${projectId}`);
      toast.success("Project dihapus");
      loadAll();
    } catch { toast.error("Gagal menghapus"); }
  };

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <Users size={18} /> Freelance
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Manajemen Freelancer</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola profil dan pembayaran DP/Pelunasan artist freelance.</p>
        </div>
        <button onClick={() => { setEditArtist(null); setArtistForm({ name: "", bank: "", rekening: "", phone: "", notes: "" }); setShowArtistForm(true); }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          <Plus size={16} /> Tambah Artist
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Memuat data...</div>
      ) : artists.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-16 text-center">
          <Users size={40} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Belum ada freelancer. Tambah artist pertama.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {artists.map((artist) => {
            const aproj = artistProjects(artist.id);
            const total = totalFee(artist.id);
            const paid = paidFee(artist.id);
            const expanded = expandedArtist === artist.id;
            return (
              <div key={artist.id} className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-lg font-bold text-white">
                      {artist.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-lg">{artist.name}</p>
                      <p className="text-sm text-slate-500">{artist.bank} {artist.rekening && `· ${artist.rekening}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total Fee</p>
                      <p className="font-bold text-slate-900">${total.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">Lunas: ${paid.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Projects</p>
                      <p className="font-bold text-slate-900">{aproj.length}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowProjectForm(artist.id); }} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        <Plus size={13} /> Project
                      </button>
                      <button onClick={() => { setEditArtist(artist); setArtistForm({ name: artist.name, bank: artist.bank || "", rekening: artist.rekening || "", phone: artist.phone || "", notes: artist.notes || "" }); setShowArtistForm(true); }}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(artist)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                        <Trash2 size={13} />
                      </button>
                      <button onClick={() => setExpandedArtist(expanded ? null : artist.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 px-6 pb-6">
                    {artist.phone && <p className="mt-3 text-sm text-slate-500">📱 {artist.phone}</p>}
                    {artist.notes && <p className="mt-1 text-sm text-slate-500">{artist.notes}</p>}
                    {aproj.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-400">Belum ada project untuk artist ini.</p>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-widest text-slate-400">
                              <th className="px-3 py-2 text-left">Project</th>
                              <th className="px-3 py-2 text-left">Fee</th>
                              <th className="px-3 py-2 text-left">DP</th>
                              <th className="px-3 py-2 text-left">Tgl DP</th>
                              <th className="px-3 py-2 text-left">Pelunasan</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {aproj.map((proj) => (
                              <tr key={proj.id} className="hover:bg-slate-50">
                                <td className="px-3 py-3 font-semibold text-slate-900">{proj.project_name}</td>
                                <td className="px-3 py-3">${proj.fee}</td>
                                <td className="px-3 py-3">{proj.dp_amount ? `$${proj.dp_amount}` : "-"}</td>
                                <td className="px-3 py-3">{proj.dp_date || "-"}</td>
                                <td className="px-3 py-3">{proj.pelunasan_date || "-"}</td>
                                <td className="px-3 py-3">
                                  <select value={proj.status_bayar} onChange={(e) => handleUpdateProjectStatus(proj.id, e.target.value)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold border-0 outline-none cursor-pointer ${statusColor[proj.status_bayar] || "bg-slate-100 text-slate-700"}`}>
                                    {STATUS_BAYAR.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-3">
                                  <button onClick={() => handleDeleteProject(proj.id)} className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showArtistForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold mb-6">{editArtist ? "Edit Artist" : "Tambah Artist"}</h2>
            <form onSubmit={handleSaveArtist} className="grid gap-4">
              <label className="space-y-2 text-sm"><span>Nama</span><input value={artistForm.name} onChange={(e) => setArtistForm((p) => ({ ...p, name: e.target.value }))} required className={inputCls} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm"><span>Bank</span><input value={artistForm.bank} onChange={(e) => setArtistForm((p) => ({ ...p, bank: e.target.value }))} placeholder="BCA, BRI, dll" className={inputCls} /></label>
                <label className="space-y-2 text-sm"><span>No. Rekening</span><input value={artistForm.rekening} onChange={(e) => setArtistForm((p) => ({ ...p, rekening: e.target.value }))} className={inputCls} /></label>
              </div>
              <label className="space-y-2 text-sm"><span>No. HP / WhatsApp</span><input value={artistForm.phone} onChange={(e) => setArtistForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} /></label>
              <label className="space-y-2 text-sm"><span>Catatan</span><textarea value={artistForm.notes} onChange={(e) => setArtistForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} /></label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowArtistForm(false); setEditArtist(null); }} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">Batal</button>
                <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProjectForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold mb-6">Tambah Project Freelance</h2>
            <form onSubmit={handleSaveProject} className="grid gap-4">
              <label className="space-y-2 text-sm"><span>Nama Project</span><input value={projectForm.project_name} onChange={(e) => setProjectForm((p) => ({ ...p, project_name: e.target.value }))} required className={inputCls} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm"><span>Fee Total (USD)</span><input value={projectForm.fee} onChange={(e) => setProjectForm((p) => ({ ...p, fee: e.target.value }))} type="number" min="0" className={inputCls} /></label>
                <label className="space-y-2 text-sm"><span>Jumlah DP</span><input value={projectForm.dp_amount} onChange={(e) => setProjectForm((p) => ({ ...p, dp_amount: e.target.value }))} type="number" min="0" className={inputCls} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm"><span>Tanggal DP</span><input value={projectForm.dp_date} onChange={(e) => setProjectForm((p) => ({ ...p, dp_date: e.target.value }))} type="date" className={inputCls} /></label>
                <label className="space-y-2 text-sm"><span>Tanggal Pelunasan</span><input value={projectForm.pelunasan_date} onChange={(e) => setProjectForm((p) => ({ ...p, pelunasan_date: e.target.value }))} type="date" className={inputCls} /></label>
              </div>
              <label className="space-y-2 text-sm"><span>Status Bayar</span>
                <select value={projectForm.status_bayar} onChange={(e) => setProjectForm((p) => ({ ...p, status_bayar: e.target.value }))} className={inputCls}>
                  {STATUS_BAYAR.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm"><span>Catatan</span><textarea value={projectForm.notes} onChange={(e) => setProjectForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} /></label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowProjectForm(null)} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">Batal</button>
                <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold">Hapus Artist?</h2>
            <p className="mt-2 text-sm text-slate-500"><span className="font-semibold">{confirmDelete.name}</span> dan semua project-nya akan dihapus.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">Batal</button>
              <button onClick={() => handleDeleteArtist(confirmDelete.id)} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
