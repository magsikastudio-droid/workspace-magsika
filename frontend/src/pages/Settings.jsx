import React, { useState, useEffect, useCallback } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  Save, RefreshCw, Plus, X, Check, Pencil, Trash2,
  UserPlus, Mail, ShieldCheck, Clock,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = ["admin", "pm", "talent"];

const ROLE_COLORS = {
  admin: "bg-violet-100 text-violet-700",
  pm: "bg-sky-100 text-sky-700",
  talent: "bg-amber-100 text-amber-700",
};

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-orange-100 text-orange-700",
};

function UserRow({ u, onApprove, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: u.full_name, role: u.role, password: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { full_name: form.full_name, role: form.role };
      if (form.password) payload.password = form.password;
      await onUpdate(u.id, payload);
      setEditing(false);
      toast.success("User diperbarui");
    } catch {
      toast.error("Gagal memperbarui user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {(u.full_name || u.username || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name || u.username}</p>
          <p className="text-xs text-slate-400 truncate">{u.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[u.role] || "bg-slate-100 text-slate-600"}`}>
            {u.role}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-600"}`}>
            {u.status === "active" ? "Aktif" : "Pending"}
          </span>
          {u.status === "pending" && (
            <button
              onClick={() => onApprove(u.id)}
              title="Setujui"
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
            >
              <Check size={15} />
            </button>
          )}
          <button
            onClick={() => setEditing((p) => !p)}
            title="Edit"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(u.id, u.full_name || u.username)}
            title="Hapus"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Nama lengkap"
              className="flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400"
            />
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password baru (opsional)"
              className="flex-1 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-xl px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 transition">
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ username: "", full_name: "", email: "", role: "talent", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/users/invite", form);
      toast.success(`User ${res.data.user.full_name} berhasil diundang`);
      onInvited(res.data.user);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengundang user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Undang User Baru</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          {[
            { key: "full_name", label: "Nama Lengkap", type: "text" },
            { key: "username", label: "Username", type: "text" },
            { key: "email", label: "Email", type: "email" },
            { key: "password", label: "Password", type: "password" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={set("role")}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {loading ? "Mengundang..." : "Undang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { currency, setCurrency, exchangeRate, setExchangeRate } = useCurrency();
  const isAdmin = user?.role === "admin";

  const [rate, setRate] = useState(exchangeRate || 16000);
  const [bankInfo, setBankInfo] = useState({ nama: "Ivo Febrian Pratama", bank: "BCA", rekening: "8030651287" });

  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data.users || []);
    } catch {
      // non-admin roles get 403, silently ignore
    }
  }, []);

  const fetchWhitelist = useCallback(async () => {
    try {
      const res = await api.get("/settings/email-whitelist");
      setWhitelist(res.data.emails || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchWhitelist();
    }
  }, [isAdmin, fetchUsers, fetchWhitelist]);

  const handleApprove = async (userId) => {
    try {
      const res = await api.patch(`/users/${userId}`, { status: "active" });
      setUsers((prev) => prev.map((u) => u.id === userId ? res.data.user : u));
      toast.success("User disetujui");
    } catch {
      toast.error("Gagal menyetujui user");
    }
  };

  const handleUpdate = async (userId, payload) => {
    const res = await api.patch(`/users/${userId}`, payload);
    setUsers((prev) => prev.map((u) => u.id === userId ? res.data.user : u));
  };

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Hapus user "${name}"?`)) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User dihapus");
    } catch {
      toast.error("Gagal menghapus user");
    }
  };

  const handleAddWhitelist = async () => {
    if (!newEmail || !newEmail.includes("@")) { toast.error("Email tidak valid"); return; }
    if (whitelist.includes(newEmail)) { toast.error("Email sudah ada"); return; }
    const updated = [...whitelist, newEmail];
    try {
      await api.post("/settings/email-whitelist", { emails: updated });
      setWhitelist(updated);
      setNewEmail("");
      toast.success("Email ditambahkan");
    } catch {
      toast.error("Gagal menyimpan whitelist");
    }
  };

  const handleRemoveWhitelist = async (email) => {
    const updated = whitelist.filter((e) => e !== email);
    try {
      await api.post("/settings/email-whitelist", { emails: updated });
      setWhitelist(updated);
      toast.success("Email dihapus dari whitelist");
    } catch {
      toast.error("Gagal menyimpan whitelist");
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const activeUsers = users.filter((u) => u.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Akses tim & konfigurasi dashboard.</p>
      </div>

      {isAdmin && (
        <>
          {/* Whitelist Email */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={18} className="text-violet-500" />
              <h2 className="text-lg font-semibold">Whitelist Email Pendaftaran</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Hanya email di daftar ini yang boleh mendaftar (admin selalu boleh). Kosongkan = semua boleh.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWhitelist()}
                placeholder="email@contoh.com"
                type="email"
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
              />
              <button
                onClick={handleAddWhitelist}
                className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
              >
                <Plus size={15} /> Tambah
              </button>
            </div>
            {whitelist.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Kosong — semua email boleh mendaftar.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {whitelist.map((email) => (
                  <span key={email} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {email}
                    <button onClick={() => handleRemoveWhitelist(email)} className="text-slate-400 hover:text-rose-500 transition">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User Management */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-violet-500" />
                <h2 className="text-lg font-semibold">User Management</h2>
              </div>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
              >
                <UserPlus size={15} /> Invite User
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Kelola akses tim. User baru mendaftar status <strong>pending</strong> sampai disetujui. Admin bisa invite user langsung aktif.
            </p>

            {pendingUsers.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={14} className="text-orange-500" />
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-500">Menunggu Persetujuan ({pendingUsers.length})</p>
                </div>
                <div className="space-y-2">
                  {pendingUsers.map((u) => (
                    <UserRow key={u.id} u={u} onApprove={handleApprove} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}

            {activeUsers.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Anggota Aktif ({activeUsers.length})</p>
                <div className="space-y-2">
                  {activeUsers.map((u) => (
                    <UserRow key={u.id} u={u} onApprove={handleApprove} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada user tambahan.</p>
            )}
          </div>
        </>
      )}

      {/* Currency */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-5">Mata Uang & Kurs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tampilkan Harga Dalam</label>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setCurrency("IDR")} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currency === "IDR" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>IDR</button>
              <button onClick={() => setCurrency("USD")} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currency === "USD" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>USD</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kurs USD → IDR</label>
            <div className="flex gap-2">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                type="number"
                min="1"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400"
              />
              <button
                onClick={() => {
                  const val = Number(rate);
                  if (isNaN(val) || val <= 0) { toast.error("Kurs tidak valid"); return; }
                  setExchangeRate(val);
                  toast.success("Kurs berhasil disimpan");
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Save size={14} /> Simpan
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">1 USD = Rp {Number(rate).toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      {/* Bank Info */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-5">Info Pembayaran (Invoice)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nama Rekening</label>
            <input value={bankInfo.nama} onChange={(e) => setBankInfo((p) => ({ ...p, nama: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bank</label>
            <input value={bankInfo.bank} onChange={(e) => setBankInfo((p) => ({ ...p, bank: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">No. Rekening</label>
            <input value={bankInfo.rekening} onChange={(e) => setBankInfo((p) => ({ ...p, rekening: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => toast.success("Info bank disimpan")} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Save size={14} /> Simpan Info Bank
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Versi App</h2>
        <p className="text-sm text-slate-500">Magsika Studio Dashboard v2.0</p>
        <p className="text-xs text-slate-400 mt-1">Deploy: {new Date().toLocaleDateString("id-ID")}</p>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={(newUser) => setUsers((prev) => [...prev, newUser])}
        />
      )}
    </div>
  );
}
