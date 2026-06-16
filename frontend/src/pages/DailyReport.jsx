import React, { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { BookOpen, Calendar, CheckCircle2, ChevronDown, Clock, Loader2, Pencil, Send, Trash2 } from "lucide-react";

const FEELINGS = [
  { value: "Semangat", emoji: "😊", active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "Biasa",    emoji: "😐", active: "border-amber-400 bg-amber-50 text-amber-700"    },
  { value: "Lelah",    emoji: "😔", active: "border-rose-400 bg-rose-50 text-rose-700"       },
];

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const todayWIB = () => {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
};

const isAfter1630WIB = () => {
  const now = new Date();
  const wibH = (now.getUTCHours() + 7) % 24;
  const wibM = now.getUTCMinutes();
  return wibH > 16 || (wibH === 16 && wibM >= 30);
};

const fmtDate = (str) => {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
};

const MIN_CHARS = 100;

const CharCount = ({ val }) => {
  const n = (val || "").trim().length;
  const ok = n >= MIN_CHARS;
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${ok ? "text-emerald-500" : "text-rose-400"}`}>
      {n}/{MIN_CHARS}
    </span>
  );
};

const EMPTY_FORM = { work_done: "", feelings: "Semangat", obstacles: "", notes: "" };

export default function DailyReport() {
  const { user } = useAuth();
  const role = user?.role || "talent";
  const isAdminOrPM = role === "admin" || role === "pm";

  /* ── Talent state ── */
  const [todayStatus, setTodayStatus] = useState(null);
  const [todayReportId, setTodayReportId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myHistory, setMyHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingHistId, setEditingHistId] = useState(null);
  const [editHistForm, setEditHistForm] = useState(EMPTY_FORM);
  const [editHistSaving, setEditHistSaving] = useState(false);
  const [histRefreshKey, setHistRefreshKey] = useState(0);

  /* ── Admin/PM state ── */
  const [dateFilter, setDateFilter] = useState(todayWIB());
  const [talentFilter, setTalentFilter] = useState("");
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [allTalents, setAllTalents] = useState([]);

  /* ── Fetch today-status (talent) ── */
  useEffect(() => {
    if (isAdminOrPM) return;
    api.get("/daily-reports/today-status")
      .then((r) => setTodayStatus(r.data.submitted))
      .catch(() => setTodayStatus(false));
  }, [isAdminOrPM]);

  /* ── Pre-fill form if already submitted today ── */
  useEffect(() => {
    if (isAdminOrPM || !todayStatus) return;
    api.get("/daily-reports", { params: { date: todayWIB() } })
      .then((r) => {
        const rep = r.data.reports?.[0];
        if (rep) {
          setForm({ work_done: rep.work_done || "", feelings: rep.feelings || "Semangat", obstacles: rep.obstacles || "", notes: rep.notes || "" });
          setTodayReportId(rep.id);
        }
      })
      .catch(() => {});
  }, [todayStatus, isAdminOrPM]);

  /* ── History (talent) ── */
  useEffect(() => {
    if (isAdminOrPM) return;
    setHistLoading(true);
    api.get("/daily-reports")
      .then((r) => setMyHistory(r.data.reports || []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [todayStatus, isAdminOrPM, histRefreshKey]);

  /* ── Reports list (admin) ── */
  useEffect(() => {
    if (!isAdminOrPM) return;
    setReportsLoading(true);
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (talentFilter) params.talent_name = talentFilter;
    api.get("/daily-reports", { params })
      .then((r) => setReports(r.data.reports || []))
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, [isAdminOrPM, dateFilter, talentFilter]);

  /* ── Talent list for filter (admin) ── */
  useEffect(() => {
    if (!isAdminOrPM) return;
    api.get("/users")
      .then((r) => setAllTalents((r.data.users || []).filter((u) => u.role === "talent")))
      .catch(() => {});
  }, [isAdminOrPM]);

  const validateReport = (f) => {
    const MIN = 100;
    if (f.work_done.trim().length < MIN) { toast.error(`Pekerjaan minimal ${MIN} karakter (${f.work_done.trim().length}/${MIN})`); return false; }
    if (f.obstacles.trim().length < MIN) { toast.error(`Kendala minimal ${MIN} karakter (${f.obstacles.trim().length}/${MIN})`); return false; }
    if (f.notes.trim().length < MIN)     { toast.error(`Note minimal ${MIN} karakter (${f.notes.trim().length}/${MIN})`);     return false; }
    return true;
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateReport(form)) return;
    setSubmitting(true);
    try {
      const res = await api.post("/daily-reports", form);
      setTodayStatus(true);
      setTodayReportId(res.data.report?.id || null);
      setHistRefreshKey((k) => k + 1);
      toast.success("Daily report berhasil disubmit!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal submit daily report.");
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const handleDeleteToday = useCallback(async () => {
    if (!todayReportId) return;
    if (!window.confirm("Hapus daily report hari ini?")) return;
    setDeleting(true);
    try {
      await api.delete(`/daily-reports/${todayReportId}`);
      setTodayStatus(false);
      setTodayReportId(null);
      setForm(EMPTY_FORM);
      setHistRefreshKey((k) => k + 1);
      toast.success("Report dihapus.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menghapus.");
    } finally {
      setDeleting(false);
    }
  }, [todayReportId]);

  const handleDeleteHist = useCallback(async (reportId) => {
    if (!window.confirm("Hapus laporan ini?")) return;
    try {
      await api.delete(`/daily-reports/${reportId}`);
      setHistRefreshKey((k) => k + 1);
      setExpandedId(null);
      toast.success("Laporan dihapus.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menghapus.");
    }
  }, []);

  const handleSaveHistEdit = useCallback(async (reportId) => {
    if (!validateReport(editHistForm)) return;
    setEditHistSaving(true);
    try {
      await api.put(`/daily-reports/${reportId}`, editHistForm);
      setHistRefreshKey((k) => k + 1);
      setEditingHistId(null);
      toast.success("Laporan diperbarui.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan.");
    } finally {
      setEditHistSaving(false);
    }
  }, [editHistForm]);

  /* ═══════════════════════════════════════════════
     TALENT VIEW
  ═══════════════════════════════════════════════ */
  if (!isAdminOrPM) {
    const late = isAfter1630WIB();
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Header */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <BookOpen size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Daily Report</h1>
              <p className="text-xs text-slate-400">{fmtDate(todayWIB())} · Laporan harian</p>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className={`px-5 py-3 flex items-center gap-2 ${
            todayStatus
              ? "bg-emerald-50 border-b border-emerald-100"
              : late
              ? "bg-amber-50 border-b border-amber-100"
              : "bg-violet-50 border-b border-violet-100"
          }`}>
            {todayStatus ? (
              <><CheckCircle2 size={16} className="text-emerald-500" /><span className="text-sm font-semibold text-emerald-700">Report hari ini sudah disubmit</span></>
            ) : late ? (
              <><Clock size={16} className="text-amber-500" /><span className="text-sm font-semibold text-amber-700">Sudah lewat 16:30 — segera isi daily report!</span></>
            ) : (
              <><Clock size={16} className="text-violet-400" /><span className="text-sm font-semibold text-violet-600">Isi daily report hari ini</span></>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Apa yang dikerjakan hari ini? *</label>
                <CharCount val={form.work_done} />
              </div>
              <textarea
                value={form.work_done}
                onChange={(e) => setForm((p) => ({ ...p, work_done: e.target.value }))}
                rows={6}
                placeholder="Ceritakan detail pekerjaan yang sudah diselesaikan hari ini&#10;(project, task, revisi, dll)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Perasaan hari ini *</label>
              <div className="flex gap-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, feelings: f.value }))}
                    className={`flex items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                      form.feelings === f.value ? f.active : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {f.emoji} {f.value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Kendala hari ini *</label>
                <CharCount val={form.obstacles} />
              </div>
              <textarea
                value={form.obstacles}
                onChange={(e) => setForm((p) => ({ ...p, obstacles: e.target.value }))}
                rows={4}
                placeholder="Adakah hambatan atau tantangan yang dihadapi?&#10;(teknis, komunikasi, resources, dll)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Note tambahan *</label>
                <CharCount val={form.notes} />
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Informasi tambahan yang ingin disampaikan ke tim atau atasan..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:bg-white resize-y transition"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {todayStatus ? "Update Report" : "Submit Report"}
              </button>
              {todayStatus && todayReportId && (
                <button
                  type="button"
                  onClick={handleDeleteToday}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-60 transition"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Hapus
                </button>
              )}
            </div>
          </form>
        </div>

        {/* History */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-bold text-slate-900">Riwayat Daily Report</p>
            <p className="text-xs text-slate-400 mt-0.5">Laporan yang sudah pernah disubmit</p>
          </div>
          {histLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Memuat...
            </div>
          ) : myHistory.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Belum ada riwayat daily report.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {myHistory.map((r) => (
                <div key={r.id}>
                  <button
                    onClick={() => { setExpandedId(expandedId === r.id ? null : r.id); setEditingHistId(null); }}
                    className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{FEELINGS.find((f) => f.value === r.feelings)?.emoji || "📝"}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{fmtDate(r.date)}</p>
                        <p className="text-xs text-slate-400">{r.feelings}</p>
                      </div>
                    </div>
                    <ChevronDown size={15} className={`text-slate-400 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`} />
                  </button>
                  {expandedId === r.id && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      {editingHistId === r.id ? (
                        /* ── Inline edit form ── */
                        <div className="px-5 py-4 space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pekerjaan</label>
                              <CharCount val={editHistForm.work_done} />
                            </div>
                            <textarea value={editHistForm.work_done} onChange={(e) => setEditHistForm((p) => ({ ...p, work_done: e.target.value }))}
                              rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 resize-y" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Perasaan</label>
                            <div className="flex gap-2">
                              {FEELINGS.map((f) => (
                                <button key={f.value} type="button" onClick={() => setEditHistForm((p) => ({ ...p, feelings: f.value }))}
                                  className={`flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-xs font-semibold transition ${editHistForm.feelings === f.value ? f.active : "border-slate-200 bg-white text-slate-500"}`}>
                                  {f.emoji} {f.value}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kendala</label>
                              <CharCount val={editHistForm.obstacles} />
                            </div>
                            <textarea value={editHistForm.obstacles} onChange={(e) => setEditHistForm((p) => ({ ...p, obstacles: e.target.value }))}
                              rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 resize-y" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Note</label>
                              <CharCount val={editHistForm.notes} />
                            </div>
                            <textarea value={editHistForm.notes} onChange={(e) => setEditHistForm((p) => ({ ...p, notes: e.target.value }))}
                              rows={2} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 resize-y" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveHistEdit(r.id)} disabled={editHistSaving}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 transition">
                              {editHistSaving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Simpan
                            </button>
                            <button onClick={() => setEditingHistId(null)}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── View mode ── */
                        <div className="px-5 pb-4 space-y-3">
                          {r.work_done && <ReportField label="Pekerjaan" value={r.work_done} />}
                          {r.obstacles && <ReportField label="Kendala" value={r.obstacles} />}
                          {r.notes && <ReportField label="Note" value={r.notes} />}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => { setEditingHistId(r.id); setEditHistForm({ work_done: r.work_done || "", feelings: r.feelings || "Semangat", obstacles: r.obstacles || "", notes: r.notes || "" }); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteHist(r.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition"
                            >
                              <Trash2 size={12} /> Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     ADMIN / PM VIEW
  ═══════════════════════════════════════════════ */
  const today = todayWIB();
  const submittedToday = reports.filter((r) => r.date === dateFilter);
  const unsubmittedTalents = allTalents.filter((t) => !submittedToday.find((r) => r.full_name === t.full_name));
  const showSummary = !talentFilter && dateFilter === today;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <BookOpen size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Daily Report Tim</h1>
              <p className="text-xs text-slate-400">Pantau laporan harian seluruh anggota tim</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setExpandedReportId(null); }}
                className="rounded-2xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400"
              />
            </div>
            <select
              value={talentFilter}
              onChange={(e) => { setTalentFilter(e.target.value); setExpandedReportId(null); }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400"
            >
              <option value="">Semua talent</option>
              {allTalents.map((t) => (
                <option key={t.username} value={t.full_name}>{t.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {showSummary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Tim</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{allTalents.length}</p>
          </div>
          <div className="rounded-2xl border-l-4 border border-emerald-200 bg-white px-4 py-4 shadow-sm border-l-emerald-400">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Sudah Submit</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{submittedToday.length}</p>
          </div>
          <div className="rounded-2xl border-l-4 border border-rose-200 bg-white px-4 py-4 shadow-sm border-l-rose-400">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Belum Submit</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{unsubmittedTalents.length}</p>
          </div>
        </div>
      )}

      {/* Not yet submitted banner */}
      {showSummary && unsubmittedTalents.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 shadow-sm">
          <div className="border-b border-rose-100 px-5 py-3">
            <p className="font-semibold text-rose-700 text-sm">Belum Submit Hari Ini</p>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {unsubmittedTalents.map((t) => (
              <span key={t.username} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600">
                {t.full_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="font-bold text-slate-900">
            Laporan {dateFilter ? fmtDate(dateFilter) : "Semua"}{talentFilter ? ` · ${talentFilter}` : ""}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{reports.length} laporan ditemukan</p>
        </div>
        {reportsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Memuat...
          </div>
        ) : reports.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Belum ada daily report untuk filter ini.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {reports.map((r) => (
              <div key={r.id}>
                <button
                  onClick={() => setExpandedReportId(expandedReportId === r.id ? null : r.id)}
                  className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                      {r.full_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(r.date)} · {FEELINGS.find((f) => f.value === r.feelings)?.emoji || "📝"} {r.feelings}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform shrink-0 ${expandedReportId === r.id ? "rotate-180" : ""}`} />
                </button>
                {expandedReportId === r.id && (
                  <div className="px-5 pb-4 space-y-3 bg-slate-50/50 border-t border-slate-100">
                    {r.work_done && <ReportField label="Pekerjaan" value={r.work_done} />}
                    {r.obstacles && <ReportField label="Kendala" value={r.obstacles} />}
                    {r.notes && <ReportField label="Note" value={r.notes} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportField({ label, value }) {
  return (
    <div className="pt-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
