import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save, RefreshCw } from "lucide-react";

const IDR = (v) =>
  Number(v || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const SALARY_COLS = [
  { key: "gajiPokok",   label: "Gaji Pokok" },
  { key: "bonus",       label: "Bonus" },
  { key: "dignity",     label: "Dignity" },
  { key: "mengajar",    label: "Mengajar" },
  { key: "kos",         label: "Kos" },
  { key: "makanSiang",  label: "Makan Siang" },
  { key: "komunikasi",  label: "Komunikasi" },
  { key: "laundry",     label: "Laundry" },
  { key: "bpjs",        label: "BPJS" },
  { key: "shu",         label: "SHU" },
];

const TEXT_COLS = [
  { key: "nama",         label: "Nama",          width: 180 },
  { key: "lp",           label: "L/P",           width: 60  },
  { key: "status",       label: "Status",        width: 140 },
  { key: "peran",        label: "Peran",         width: 120 },
  { key: "tanggalMasuk", label: "Tgl Masuk",     width: 120 },
  { key: "tanggalLahir", label: "Tgl Lahir",     width: 120 },
  { key: "email",        label: "Email",         width: 200 },
  { key: "telp",         label: "Telp",          width: 130 },
  { key: "rekening",     label: "Rekening",      width: 200 },
  { key: "atasNama",     label: "Atas Nama",     width: 160 },
  { key: "alamat",       label: "Alamat",        width: 240 },
];

const LP_OPTIONS = ["L", "P"];
const STATUS_OPTIONS = ["Karyawan", "Magang Sekolah", "Pendamping", "Freelance"];

const EMPTY = {
  nama: "", lp: "L", status: "Karyawan", peran: "", alamat: "",
  email: "", telp: "", rekening: "", atasNama: "",
  tanggalMasuk: "", tanggalLahir: "",
  gajiPokok: 0, bonus: 0, dignity: 0, mengajar: 0, kos: 0,
  makanSiang: 0, komunikasi: 0, laundry: 0, bpjs: 0, shu: 0,
};

function total(member) {
  return SALARY_COLS.reduce((s, c) => s + Number(member[c.key] || 0), 0);
}

function EditCell({ value, type = "text", options, onCommit, width }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = type === "number" ? (parseFloat(draft) || 0) : draft;
    if (String(parsed) !== String(value)) onCommit(parsed);
  }, [draft, value, type, onCommit]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer select-none px-2 py-1.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded transition min-h-[32px] flex items-center"
        style={{ width, minWidth: width, maxWidth: width }}
        title="Klik untuk edit"
      >
        {type === "number"
          ? <span className="tabular-nums">{Number(value || 0).toLocaleString("id-ID")}</span>
          : <span className="truncate">{value || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
        }
      </div>
    );
  }

  if (options) {
    return (
      <select
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className="w-full rounded px-2 py-1 text-sm border border-violet-400 bg-violet-50 dark:bg-violet-900/30 dark:text-white outline-none"
        style={{ width, minWidth: width }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type === "number" ? "number" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(value); }}}
      className="w-full rounded px-2 py-1 text-sm border border-violet-400 bg-white dark:bg-slate-800 dark:text-white outline-none tabular-nums"
      style={{ width, minWidth: width }}
    />
  );
}

export default function TimDatabase() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState(EMPTY);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/tim");
      setMembers(res.data);
    } catch {
      toast.error("Gagal memuat data tim.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateField = async (member, key, val) => {
    const updated = { ...member, [key]: val };
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    setSaving((s) => ({ ...s, [member.id]: true }));
    try {
      await api.put(`/tim/${member.id}`, updated);
      toast.success("Tersimpan", { duration: 1500 });
    } catch {
      toast.error("Gagal menyimpan.");
      setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
    } finally {
      setSaving((s) => ({ ...s, [member.id]: false }));
    }
  };

  const deleteMember = async (member) => {
    if (!window.confirm(`Hapus ${member.nama || "anggota ini"}?`)) return;
    try {
      await api.delete(`/tim/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Anggota dihapus.");
    } catch {
      toast.error("Gagal menghapus.");
    }
  };

  const addMember = async () => {
    if (!newRow.nama.trim()) { toast.error("Nama wajib diisi."); return; }
    try {
      const res = await api.post("/tim", newRow);
      setMembers((prev) => [...prev, res.data]);
      setNewRow(EMPTY);
      setAdding(false);
      toast.success("Anggota ditambahkan.");
    } catch {
      toast.error("Gagal menambahkan.");
    }
  };

  const grandTotal = members.reduce((s, m) => s + total(m), 0);
  const colTotal = (key) => members.reduce((s, m) => s + Number(m[key] || 0), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Database Tim</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{members.length} anggota · Klik sel untuk edit, tersimpan otomatis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMembers}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
          >
            <Plus size={14} /> Tambah Anggota
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/20 p-4">
          <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-3">Anggota Baru</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
            {TEXT_COLS.map((c) => (
              <div key={c.key}>
                <label className="block text-[10px] font-semibold text-violet-600 dark:text-violet-400 mb-1">{c.label}</label>
                {c.key === "lp" ? (
                  <select
                    value={newRow[c.key]}
                    onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                    className="w-full rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm dark:text-white outline-none focus:border-violet-500"
                  >
                    {LP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : c.key === "status" ? (
                  <select
                    value={newRow[c.key]}
                    onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                    className="w-full rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm dark:text-white outline-none focus:border-violet-500"
                  >
                    {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    value={newRow[c.key]}
                    onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                    className="w-full rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm dark:text-white outline-none focus:border-violet-500"
                  />
                )}
              </div>
            ))}
            {SALARY_COLS.map((c) => (
              <div key={c.key}>
                <label className="block text-[10px] font-semibold text-violet-600 dark:text-violet-400 mb-1">{c.label}</label>
                <input
                  type="number"
                  value={newRow[c.key]}
                  onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm dark:text-white outline-none focus:border-violet-500 tabular-nums"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addMember} className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-bold text-white transition">
              <Save size={13} /> Simpan
            </button>
            <button onClick={() => { setAdding(false); setNewRow(EMPTY); }} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111] shadow-sm">
        <table className="border-collapse text-sm" style={{ minWidth: 2000 }}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
              <th className="sticky left-0 z-20 bg-slate-50 dark:bg-[#0d0d0d] border-r border-slate-200 dark:border-white/[0.06] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ width: 36, minWidth: 36 }}>#</th>
              {TEXT_COLS.map((c) => (
                <th key={c.key}
                  className={`px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${c.key === "nama" ? "sticky left-9 z-20 bg-slate-50 dark:bg-[#0d0d0d] border-r border-slate-200 dark:border-white/[0.06]" : ""}`}
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
              {SALARY_COLS.map((c) => (
                <th key={c.key} className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ width: 130, minWidth: 130 }}>
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400" style={{ width: 140, minWidth: 140 }}>Total</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400" style={{ width: 50, minWidth: 50 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, idx) => (
              <tr key={member.id} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] group">
                <td className="sticky left-0 z-10 bg-white dark:bg-[#111] group-hover:bg-slate-50/60 dark:group-hover:bg-[#141414] border-r border-slate-100 dark:border-white/[0.04] px-3 py-0.5 text-xs text-slate-400 dark:text-slate-600 text-center">
                  {saving[member.id] ? <Loader2 size={11} className="animate-spin text-violet-400 mx-auto" /> : idx + 1}
                </td>
                {TEXT_COLS.map((c) => (
                  <td key={c.key}
                    className={`py-0.5 ${c.key === "nama" ? "sticky left-9 z-10 bg-white dark:bg-[#111] group-hover:bg-slate-50/60 dark:group-hover:bg-[#141414] border-r border-slate-100 dark:border-white/[0.04] font-medium text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300"}`}
                    style={{ width: c.width, minWidth: c.width }}
                  >
                    <EditCell
                      value={member[c.key]}
                      type="text"
                      options={c.key === "lp" ? LP_OPTIONS : c.key === "status" ? STATUS_OPTIONS : undefined}
                      width={c.width - 4}
                      onCommit={(val) => updateField(member, c.key, val)}
                    />
                  </td>
                ))}
                {SALARY_COLS.map((c) => (
                  <td key={c.key} className="py-0.5 text-right" style={{ width: 130, minWidth: 130 }}>
                    <EditCell
                      value={member[c.key]}
                      type="number"
                      width={126}
                      onCommit={(val) => updateField(member, c.key, val)}
                    />
                  </td>
                ))}
                <td className="py-0.5 pr-2 text-right">
                  <span className="inline-block tabular-nums text-xs font-bold text-violet-700 dark:text-violet-400 px-2">
                    {IDR(total(member))}
                  </span>
                </td>
                <td className="py-0.5 text-center">
                  <button
                    onClick={() => deleteMember(member)}
                    className="rounded-lg p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                    title="Hapus"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Totals row */}
            <tr className="border-t-2 border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/10 font-bold">
              <td className="sticky left-0 z-10 bg-violet-50 dark:bg-violet-900/10 border-r border-violet-100 dark:border-violet-800/30 px-3 py-2.5 text-xs text-slate-400"></td>
              <td className="sticky left-9 z-10 bg-violet-50 dark:bg-violet-900/10 border-r border-violet-100 dark:border-violet-800/30 px-2 py-2.5 text-xs font-bold text-violet-700 dark:text-violet-400" style={{ width: 180 }}>
                TOTAL ({members.length} orang)
              </td>
              {TEXT_COLS.slice(1).map((c) => (
                <td key={c.key} style={{ width: c.width }} />
              ))}
              {SALARY_COLS.map((c) => (
                <td key={c.key} className="px-2 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300" style={{ width: 130 }}>
                  {IDR(colTotal(c.key))}
                </td>
              ))}
              <td className="pr-2 py-2.5 text-right text-xs tabular-nums font-bold text-violet-700 dark:text-violet-400" style={{ width: 140 }}>
                {IDR(grandTotal)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center pb-1">
        Klik sel mana saja untuk mengedit · Perubahan tersimpan otomatis ke database
      </p>
    </div>
  );
}
