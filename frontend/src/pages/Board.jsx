import React, { useMemo, useState } from "react";
import { Kanban } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { ACTIVE_STATUSES, STATUS_COLORS, getArtistColor, normalizeStatus } from "../lib/constants";
import Pill from "../components/Pill";

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export default function Board() {
  const { orders, updateOrder } = useOrders();
  const [viewBy, setViewBy] = useState("status");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const activeOrders = useMemo(
    () => orders.filter((o) => normalizeStatus(o.status) !== "Done" && normalizeStatus(o.status) !== "Cancel"),
    [orders]
  );

  const grouped = useMemo(() => {
    if (viewBy === "status") {
      return ACTIVE_STATUSES.reduce(
        (acc, status) => ({ ...acc, [status]: activeOrders.filter((o) => o.status === status) }),
        {}
      );
    }
    const byArtist = groupBy(activeOrders, (o) => o.artists?.[0] || "Unassigned");
    return byArtist;
  }, [activeOrders, viewBy]);

  const nonEmptyColumns = useMemo(() => {
    if (viewBy === "status") {
      return Object.entries(grouped).filter(([, items]) => items.length > 0);
    }
    return Object.entries(grouped);
  }, [grouped, viewBy]);

  const handleDrop = async (orderId, target) => {
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const payload = viewBy === "status" ? { status: target } : { artists: [target] };
    await updateOrder(orderId, payload);
    setDragId(null);
    setDragOver(null);
  };

  const deadlineClass = (deadline) => {
    if (!deadline) return "";
    const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (diff < 0) return "text-rose-600";
    if (diff <= 3) return "text-amber-600";
    return "text-slate-500";
  };

  const renderCard = (order) => {
    const color = getArtistColor(order.artists?.[0]);
    const sc = STATUS_COLORS[normalizeStatus(order.status)] || { bg: "#f8fafc", text: "#334155" };
    return (
      <div
        key={order.id}
        draggable
        onDragStart={() => setDragId(order.id)}
        onDragEnd={() => setDragId(null)}
        className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{order.project}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{order.client}</p>
          </div>
          {viewBy === "artist" && (
            <Pill label={order.status} bg={sc.bg} text={sc.text} />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className={deadlineClass(order.deadline)}>{order.deadline || "-"}</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-slate-500">{order.artists?.[0] || "Unassigned"}</span>
          </div>
        </div>
        {order.folder_code && (
          <p className="mt-2 truncate rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs text-slate-400">{order.folder_code}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <Kanban size={18} /> Board
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Visual Board Produksi</h1>
          <p className="mt-2 text-sm text-slate-500">Drag-and-drop order untuk memindahkan status atau artist.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
          <button onClick={() => setViewBy("status")} className={`px-4 py-2 rounded-full transition ${viewBy === "status" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Status</button>
          <button onClick={() => setViewBy("artist")} className={`px-4 py-2 rounded-full transition ${viewBy === "artist" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Artist</button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {nonEmptyColumns.map(([key, items]) => {
          const isOver = dragOver === key;
          const sc = STATUS_COLORS[key];
          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(dragId, key)}
              className={`flex-shrink-0 w-72 rounded-3xl border p-4 transition ${isOver ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  {sc ? (
                    <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: sc.bg, color: sc.text }}>{key}</span>
                  ) : (
                    <h2 className="font-semibold text-slate-900">{key}</h2>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{items.length} order</p>
                </div>
              </div>
              <div className="space-y-3 min-h-[80px]">
                {items.length === 0
                  ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Drop di sini</div>
                  : items.map(renderCard)}
              </div>
            </div>
          );
        })}
        {nonEmptyColumns.length === 0 && (
          <div className="flex h-40 w-full items-center justify-center text-sm text-slate-400">Belum ada order aktif.</div>
        )}
      </div>
    </div>
  );
}
