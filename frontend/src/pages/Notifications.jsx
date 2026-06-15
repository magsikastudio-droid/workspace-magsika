import React, { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Clock, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
  return `${Math.floor(diff / 86400)}h lalu`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "talent";

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Semua notifikasi ditandai sudah dibaca.");
    } catch {
      toast.error("Gagal menandai.");
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const handleApprove = async (notif) => {
    try {
      await api.patch(`/tasks/${notif.task_id}`, { status: "done" });
      await api.patch(`/notifications/${notif.id}/read`, { result: "approved" });
      toast.success("Task disetujui ✓");
      fetchNotifications();
    } catch {
      toast.error("Gagal approve task.");
    }
  };

  const handleReject = async (notif) => {
    try {
      await api.patch(`/tasks/${notif.task_id}`, { status: "in_revision" });
      await api.patch(`/notifications/${notif.id}/read`, { result: "rejected" });
      toast.info("Task dikembalikan ke In Revision.");
      fetchNotifications();
    } catch {
      toast.error("Gagal reject task.");
    }
  };

  const goToTask = (notif) => {
    markOneRead(notif.id);
    navigate(`/todo?date=${notif.date || ""}`);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (role !== "admin" && role !== "pm") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Bell size={40} className="mb-4 text-slate-200" />
        <p className="font-semibold text-slate-400">Halaman ini hanya untuk Admin dan PM.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={24} className="text-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifikasi</h1>
            <p className="text-sm text-slate-400">
              {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 transition"
          >
            <CheckCheck size={14} /> Tandai semua dibaca
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
          <p className="mt-3 text-sm text-slate-400">Memuat...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Bell size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">Belum ada notifikasi.</p>
          <p className="mt-1 text-sm text-slate-400">Notifikasi muncul ketika talent mengirim file untuk review.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onApprove={handleApprove}
              onReject={handleReject}
              onGoToTask={goToTask}
              onRead={markOneRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifCard({ notif, onApprove, onReject, onGoToTask, onRead }) {
  const isUnread = !notif.read;
  const isReviewPending = notif.type === "review_request";

  return (
    <div
      className={`rounded-2xl border transition ${
        isUnread
          ? "border-indigo-200 bg-indigo-50/50 shadow-sm"
          : "border-slate-200 bg-white opacity-70"
      }`}
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-indigo-100" : "bg-slate-100"}`}>
          {isUnread
            ? <Bell size={15} className="text-indigo-600" />
            : <CheckCheck size={15} className="text-slate-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold leading-snug ${isUnread ? "text-slate-900" : "text-slate-500"}`}>
                <span className="text-indigo-600">{notif.assignee}</span> meminta review
              </p>
              <p className={`mt-0.5 text-sm ${isUnread ? "text-slate-700" : "text-slate-400"} break-words`}>
                {notif.task_title}
              </p>
              {notif.notes && (
                <p className="mt-1 text-xs text-slate-400 font-mono break-words">{notif.notes}</p>
              )}
            </div>
            {isUnread && (
              <button
                onClick={() => onRead(notif.id)}
                title="Tandai dibaca"
                className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock size={11} /> {timeAgo(notif.created_at)}
            </span>
            {notif.date && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
                {notif.date}
              </span>
            )}
            {notif.review_result === "approved" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <CheckCheck size={11} /> Disetujui{notif.reviewed_by ? ` oleh ${notif.reviewed_by}` : ""}
              </span>
            )}
            {notif.review_result === "rejected" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                <X size={11} /> Ditolak{notif.reviewed_by ? ` oleh ${notif.reviewed_by}` : ""}
              </span>
            )}
          </div>

          {isReviewPending && isUnread && !notif.review_result && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onApprove(notif)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition"
              >
                <CheckCheck size={12} /> Approve
              </button>
              <button
                onClick={() => onReject(notif)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <X size={12} /> Tolak
              </button>
              <button
                onClick={() => onGoToTask(notif)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition"
              >
                Lihat Task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
