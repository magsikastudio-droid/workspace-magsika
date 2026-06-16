import React, { useState, useEffect, useCallback } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import {
  Save, RefreshCw, Plus, X, Check, Pencil, Trash2,
  UserPlus, Mail, ShieldCheck, Clock, User, Phone, MapPin,
  CreditCard, Calendar, Briefcase, ChevronDown, ChevronUp,
  Sun, Moon, Send,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = ["superadmin", "admin", "pm", "talent"];

const ROLE_COLORS = {
  superadmin: "bg-purple-100 text-purple-800",
  admin: "bg-violet-100 text-violet-700",
  pm: "bg-sky-100 text-sky-700",
  talent: "bg-amber-100 text-amber-700",
};

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-orange-100 text-orange-700",
};

/* ─── ProfileSection ─────────────────────────────────────────────── */
function ProfileSection({ user }) {
  const [profile, setProfile] = useState({
    full_name: "", phone: "", telegram: "", gender: "",
    birthdate: "", birthplace: "", position: "", address: "", bank_account: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/users/me").then((res) => {
      const u = res.data.user || {};
      setProfile({
        full_name: u.full_name || "",
        phone: u.phone || "",
        telegram: u.telegram || "",
        gender: u.gender || "",
        birthdate: u.birthdate || "",
        birthplace: u.birthplace || "",
        position: u.position || "",
        address: u.address || "",
        bank_account: u.bank_account || "",
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(profile).forEach(([k, v]) => { if (v !== "") payload[k] = v; });
      if (Object.keys(payload).length === 0) { toast.info("Tidak ada perubahan"); setSaving(false); return; }
      await api.patch("/users/me", payload);
      toast.success("Profil berhasil disimpan");
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setProfile((p) => ({ ...p, [key]: e.target.value }));

  if (!loaded) return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm animate-pulse h-48" />;

  const avatarLetter = (profile.full_name || user?.username || "?").charAt(0).toUpperCase();
  const roleColor = ROLE_COLORS[user?.role] || "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-bold text-white shadow">
          {avatarLetter}
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-lg">{profile.full_name || user?.username}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${roleColor}`}>{user?.role}</span>
            <span className="text-xs text-slate-400">{user?.email}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <User size={13} /> Nama Lengkap
          </label>
          {user?.role === "admin" ? (
            <input value={profile.full_name} onChange={set("full_name")}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
          ) : (
            <>
              <input value={profile.full_name} readOnly
                className="w-full rounded-2xl border border-slate-100 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
              <p className="mt-1 text-[11px] text-slate-400">Nama tidak bisa diubah sendiri. Hubungi admin.</p>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Briefcase size={13} /> Jabatan / Posisi
          </label>
          <input value={profile.position} onChange={set("position")} placeholder="cth. 3D Artist"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Phone size={13} /> No. HP / WhatsApp
          </label>
          <input value={profile.phone} onChange={set("phone")} placeholder="cth. 081234567890"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Telegram (username)
          </label>
          <input value={profile.telegram} onChange={set("telegram")} placeholder="cth. @username"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Jenis Kelamin</label>
          <select value={profile.gender} onChange={set("gender")}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400">
            <option value="">-- Pilih --</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} /> Tanggal Lahir
          </label>
          <input type="date" value={profile.birthdate} onChange={set("birthdate")}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Tempat Lahir</label>
          <input value={profile.birthplace} onChange={set("birthplace")} placeholder="cth. Jakarta"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <CreditCard size={13} /> Rekening Bank
          </label>
          <input value={profile.bank_account} onChange={set("bank_account")} placeholder="cth. BCA 1234567890 a/n Nama"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
            <MapPin size={13} /> Alamat
          </label>
          <textarea value={profile.address} onChange={set("address")} rows={2} placeholder="Alamat lengkap..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none" />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition">
          <Save size={14} /> {saving ? "Menyimpan..." : "Simpan Profil"}
        </button>
      </div>
    </div>
  );
}

/* ─── UserRow ────────────────────────────────────────────────────── */
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
            <button onClick={() => onApprove(u.id)} title="Setujui"
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition">
              <Check size={15} />
            </button>
          )}
          <button onClick={() => setEditing((p) => !p)} title="Edit"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(u.id, u.full_name || u.username)} title="Hapus"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Nama lengkap"
              className="flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password baru (opsional)"
              className="flex-1 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-xl px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 transition">Batal</button>
            <button onClick={handleSave} disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── InviteModal ────────────────────────────────────────────────── */
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Undang User Baru</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
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
              <input type={type} value={form[key]} onChange={set(key)} required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={form.role} onChange={set("role")}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">Batal</button>
            <button type="submit" disabled={loading}
              className="rounded-2xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition">
              {loading ? "Mengundang..." : "Undang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Settings Page ─────────────────────────────────────────── */
export default function SettingsPage() {
  const { user } = useAuth();
  const { currency, setCurrency, exchangeRate, setExchangeRate } = useCurrency();
  const { theme, setTheme } = useTheme();
  const isAdmin = user?.role === "admin";
  const isAdminOrPM = user?.role === "admin" || user?.role === "pm";

  const [activeTab, setActiveTab] = useState("profil");
  const [rate, setRate] = useState(exchangeRate || 16000);
  const [bankInfo, setBankInfo] = useState({ nama: "", bank: "", rekening: "" });
  const [bankLoaded, setBankLoaded] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  const [deadlineTime, setDeadlineTime] = useState("16:30");
  const [savingDeadline, setSavingDeadline] = useState(false);

  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data.users || []);
    } catch {}
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
      api.get("/settings/daily-report-deadline").then((res) => {
        const h = String(res.data.hour).padStart(2, "0");
        const m = String(res.data.minute).padStart(2, "0");
        setDeadlineTime(`${h}:${m}`);
      }).catch(() => {});
    }
    if (isAdminOrPM) {
      api.get("/settings/bank-info").then((res) => {
        const d = res.data;
        if (d.nama || d.bank || d.rekening) setBankInfo(d);
        setBankLoaded(true);
      }).catch(() => setBankLoaded(true));
    }
  }, [isAdmin, isAdminOrPM, fetchUsers, fetchWhitelist]);

  const handleApprove = async (userId) => {
    try {
      const res = await api.patch(`/users/${userId}`, { status: "active" });
      setUsers((prev) => prev.map((u) => u.id === userId ? res.data.user : u));
      toast.success("User disetujui");
    } catch { toast.error("Gagal menyetujui user"); }
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
    } catch { toast.error("Gagal menghapus user"); }
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
    } catch { toast.error("Gagal menyimpan whitelist"); }
  };

  const handleRemoveWhitelist = async (email) => {
    const updated = whitelist.filter((e) => e !== email);
    try {
      await api.post("/settings/email-whitelist", { emails: updated });
      setWhitelist(updated);
    } catch { toast.error("Gagal menyimpan whitelist"); }
  };

  const handleSeedTeam = async () => {
    if (!window.confirm("Buat akun tim (Ivo, Novita, Kevin, Andre, Hadziq, Quin) dengan password GetukLindri!?\nUser yang sudah ada tidak akan ditimpa.")) return;
    setSeeding(true);
    try {
      const res = await api.post("/admin/seed-team");
      const { created = [], skipped = [] } = res.data;
      if (created.length > 0) toast.success(`Dibuat: ${created.join(", ")}`);
      if (skipped.length > 0) toast.info(`Sudah ada: ${skipped.join(", ")}`);
      fetchUsers();
    } catch { toast.error("Gagal membuat akun tim"); }
    finally { setSeeding(false); }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const activeUsers = users.filter((u) => u.status === "active");

  const TABS = [
    { key: "profil", label: "Profil Saya" },
    { key: "tampilan", label: "Tampilan" },
    ...(isAdminOrPM ? [{ key: "tim", label: "Manajemen Tim" }, { key: "umum", label: "Pengaturan" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Profil & konfigurasi dashboard.</p>
      </div>

      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 gap-1">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profil" && <ProfileSection user={user} />}

      {activeTab === "tampilan" && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Sun size={18} className="text-violet-500" />
            <h2 className="text-lg font-semibold">Tema Tampilan</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">Pilih tampilan yang nyaman untuk kamu.</p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {/* Light theme card */}
            <button
              onClick={() => setTheme("light")}
              className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                theme === "light"
                  ? "border-violet-500 shadow-lg shadow-violet-100"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Mini preview */}
              <div className="h-24 bg-slate-100 flex flex-col">
                <div className="h-4 bg-white border-b border-slate-200 flex items-center px-2 gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <div className="h-1 w-8 rounded bg-slate-200" />
                </div>
                <div className="flex flex-1 gap-1 p-1.5">
                  <div className="w-8 bg-white rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-white rounded" />
                    <div className="h-3 bg-white rounded w-3/4" />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2.5 text-left">
                <p className="text-xs font-semibold text-slate-800">Terang</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tampilan default</p>
              </div>
              {theme === "light" && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </button>

            {/* Dark theme card */}
            <button
              onClick={() => setTheme("dark")}
              className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                theme === "dark"
                  ? "border-violet-500 shadow-lg shadow-violet-900/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Mini preview */}
              <div className="h-24 bg-[#0f0f0f] flex flex-col">
                <div className="h-4 bg-[#0d0d0d] border-b border-white/[0.06] flex items-center px-2 gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <div className="h-1 w-8 rounded bg-white/10" />
                </div>
                <div className="flex flex-1 gap-1 p-1.5">
                  <div className="w-8 bg-[#0d0d0d] rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-white/10 rounded" />
                    <div className="h-3 bg-white/10 rounded w-3/4" />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2.5 text-left bg-[#111111]">
                <p className="text-xs font-semibold text-slate-200">Gelap</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Seperti referensi</p>
              </div>
              {theme === "dark" && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === "tim" && isAdminOrPM && (
        <div className="space-y-6">
          {isAdmin && (
            <>
              {/* Whitelist */}
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={18} className="text-violet-500" />
                  <h2 className="text-lg font-semibold">Whitelist Email Pendaftaran</h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">Hanya email di daftar ini yang boleh mendaftar. Kosongkan = semua boleh.</p>
                <div className="flex gap-2 mb-3">
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddWhitelist()}
                    placeholder="email@contoh.com" type="email"
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
                  <button onClick={handleAddWhitelist}
                    className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
                    <Plus size={15} /> Tambah
                  </button>
                </div>
                {whitelist.length === 0
                  ? <p className="text-xs text-slate-400 italic">Kosong — semua email boleh mendaftar.</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {whitelist.map((email) => (
                        <span key={email} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {email}
                          <button onClick={() => handleRemoveWhitelist(email)} className="text-slate-400 hover:text-rose-500 transition"><X size={12} /></button>
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
                  <div className="flex gap-2">
                    <button onClick={handleSeedTeam} disabled={seeding}
                      className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition">
                      {seeding ? "..." : "Seed Tim"}
                    </button>
                    <button onClick={() => setShowInvite(true)}
                      className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
                      <UserPlus size={15} /> Invite User
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-5">Kelola akses tim. "Seed Tim" membuat akun Ivo, Novita, Kevin, Andre, Hadziq, Quin.</p>

                {pendingUsers.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock size={14} className="text-orange-500" />
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-500">Menunggu Persetujuan ({pendingUsers.length})</p>
                    </div>
                    <div className="space-y-2">
                      {pendingUsers.map((u) => <UserRow key={u.id} u={u} onApprove={handleApprove} onUpdate={handleUpdate} onDelete={handleDelete} />)}
                    </div>
                  </div>
                )}

                {activeUsers.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Anggota Aktif ({activeUsers.length})</p>
                    <div className="space-y-2">
                      {activeUsers.map((u) => <UserRow key={u.id} u={u} onApprove={handleApprove} onUpdate={handleUpdate} onDelete={handleDelete} />)}
                    </div>
                  </div>
                )}
                {users.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Belum ada user tambahan.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "umum" && isAdminOrPM && (
        <div className="space-y-6">
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
                  <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min="1"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400" />
                  <button onClick={() => { const val = Number(rate); if (isNaN(val) || val <= 0) { toast.error("Kurs tidak valid"); return; } setExchangeRate(val); toast.success("Kurs berhasil disimpan"); }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
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
                <input value={bankInfo.nama} onChange={(e) => setBankInfo((p) => ({ ...p, nama: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bank</label>
                <input value={bankInfo.bank} onChange={(e) => setBankInfo((p) => ({ ...p, bank: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">No. Rekening</label>
                <input value={bankInfo.rekening} onChange={(e) => setBankInfo((p) => ({ ...p, rekening: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                disabled={savingBank}
                onClick={async () => {
                  setSavingBank(true);
                  try {
                    await api.post("/settings/bank-info", bankInfo);
                    toast.success("Info bank berhasil disimpan");
                  } catch {
                    toast.error("Gagal menyimpan info bank");
                  } finally {
                    setSavingBank(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition">
                <Save size={14} /> {savingBank ? "Menyimpan..." : "Simpan Info Bank"}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={18} className="text-violet-500" />
                <h2 className="text-lg font-semibold">Batas Waktu Daily Report</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Atur waktu batas pengiriman daily report. Setelah waktu ini, Tim yang belum submit akan mendapat notifikasi dan To Do dikunci.
              </p>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Pukul (WIB)</label>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
                  />
                </div>
                <button
                  disabled={savingDeadline}
                  onClick={async () => {
                    const [h, m] = deadlineTime.split(":").map(Number);
                    if (isNaN(h) || isNaN(m)) { toast.error("Format waktu tidak valid"); return; }
                    setSavingDeadline(true);
                    try {
                      await api.put("/settings/daily-report-deadline", { hour: h, minute: m });
                      toast.success(`Batas waktu disimpan: ${deadlineTime} WIB`);
                    } catch { toast.error("Gagal menyimpan"); }
                    finally { setSavingDeadline(false); }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition"
                >
                  <Save size={14} /> {savingDeadline ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">Notifikasi otomatis dikirim ke talent yang belum submit pada waktu ini.</p>
            </div>
          )}

          {isAdmin && <TelegramSection />}

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Versi App</h2>
            <p className="text-sm text-slate-500">Magsika Studio Dashboard v2.0</p>
            <p className="text-xs text-slate-400 mt-1">Deploy: {new Date().toLocaleDateString("id-ID")}</p>
          </div>

          {isAdmin && <ClearDataSection />}
        </div>
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvited={(newUser) => setUsers((prev) => [...prev, newUser])} />
      )}
    </div>
  );
}

function TelegramSection() {
  const [cfg, setCfg] = useState({ bot_token: "", chat_id: "" });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/settings/telegram").then((res) => {
      setCfg({ bot_token: res.data.bot_token || "", chat_id: res.data.chat_id || "" });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/settings/telegram", cfg);
      toast.success("Konfigurasi Telegram berhasil disimpan");
    } catch {
      toast.error("Gagal menyimpan konfigurasi Telegram");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/telegram/send", { message: "✅ <b>Test koneksi Telegram berhasil!</b>\n\nBot Magsika Studio sudah terhubung." });
      toast.success("Pesan test berhasil dikirim ke Telegram");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal kirim test");
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm animate-pulse h-40" />;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-sky-500">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.461c-.143.643-.527.8-.864.498l-2.37-1.756-1.144 1.1c-.126.127-.232.233-.476.233l.17-2.403 4.367-3.941c.19-.168-.041-.261-.294-.093L7.168 15.447l-2.335-.729c-.507-.158-.52-.507.106-.75l9.136-3.519c.424-.154.797.103.487 1.799z"/>
        </svg>
        <h2 className="text-lg font-semibold">Konfigurasi Telegram Bot</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Isi Bot Token dan Chat ID agar notifikasi order bisa dikirim ke grup Telegram.
        Cara dapat Chat ID: kirim pesan ke grup, lalu cek via{" "}
        <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">@getidsbot</span>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Bot Token</label>
          <input
            type="password"
            value={cfg.bot_token}
            onChange={(e) => setCfg((p) => ({ ...p, bot_token: e.target.value }))}
            placeholder="1234567890:ABC..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 font-mono"
          />
          <p className="mt-1 text-xs text-slate-400">Dari @BotFather di Telegram</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Chat ID</label>
          <input
            value={cfg.chat_id}
            onChange={(e) => setCfg((p) => ({ ...p, chat_id: e.target.value }))}
            placeholder="-1001234567890"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 font-mono"
          />
          <p className="mt-1 text-xs text-slate-400">ID grup/channel tujuan (biasanya negatif)</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition">
          <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
        </button>
        <button onClick={handleTest} disabled={testing || !cfg.bot_token || !cfg.chat_id}
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 px-5 py-2.5 text-sm font-semibold text-sky-600 hover:bg-sky-50 disabled:opacity-40 transition">
          <Send size={14} /> {testing ? "Mengirim..." : "Test Kirim Pesan"}
        </button>
      </div>
    </div>
  );
}

function ClearDataSection() {
  const [confirm, setConfirm] = useState("");
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (confirm !== "HAPUS") { toast.error('Ketik "HAPUS" untuk konfirmasi'); return; }
    setClearing(true);
    try {
      await api.delete("/admin/clear-all-data");
      toast.success("Semua data berhasil dihapus. Silakan refresh halaman.");
      setConfirm("");
    } catch (e) {
      toast.error("Gagal menghapus data: " + (e?.response?.data?.detail || e.message));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="rounded-[2rem] border-2 border-rose-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 size={18} className="text-rose-500" />
        <h2 className="text-xl font-semibold text-rose-600">Hapus Semua Data</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Menghapus <strong>seluruh data</strong> orders, tasks, daily chat, freelance, earnings, notifikasi, pengumuman, dan jadwal.
        Akun pengguna <strong>tidak</strong> akan terhapus.
      </p>
      <div className="flex gap-3 items-center">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.toUpperCase())}
          placeholder='Ketik "HAPUS" untuk konfirmasi'
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm outline-none focus:border-rose-400 w-64"
        />
        <button
          onClick={handleClear}
          disabled={clearing || confirm !== "HAPUS"}
          className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40 transition"
        >
          <Trash2 size={14} /> {clearing ? "Menghapus..." : "Hapus Semua Data"}
        </button>
      </div>
    </div>
  );
}
