import React, { useMemo, useState } from "react";
import { ArrowRight, Kanban } from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import { STATUS_OPTIONS, STATUS_COLORS, ARTIST_COLORS } from "../lib/constants";
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

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "done"), [orders]);

  const grouped = useMemo(() => {
    if (viewBy === "status") {
      return STATUS_OPTIONS.reduce((acc, status) => ({ ...acc, [status]: activeOrders.filter((o) => o.status === status) }), {});
    }
    return groupBy(activeOrders, (o) => (o.artists?.[0] || "Unassigned"));
  }, [activeOrders, viewBy]);

  const handleDrop = async (orderId, target) => {
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const payload = viewBy === "status" ? { status: target } : { artists: [target] };
    await updateOrder(orderId, payload);
    setDragId(null);
    setDragOver(null);
  };

  const renderCard = (order) => {
    const color = ARTIST_COLORS[order.artists?.[0]] || ARTIST_COLORS.Default;
    const status = STATUS_COLORS[order.status] || { bg: "#f8fafc", text: "#334155" };
    return (
      <div
        key={order.id}
        draggable
        onDragStart={() => setDragId(order.id)}
        onDragEnd={() => setDragId(null)}
        className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">{order.project}</h3>
            <p className="mt-1 text-sm text-slate-500">{order.client}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <Pill label={order.status} bg={status.bg} text={status.text} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{order.deadline || "-"}</span>
          <span>{order.artists?.[0] || "Unassigned"}</span>
        </div>
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
          <h1 className="text-3xl font-bold text-slate-900">Visual board</h1>
          <p className="mt-2 text-sm text-slate-500">Drag-and-drop order untuk memindahkan status atau assignee.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
          <button onClick={() => setViewBy("status")} className={`px-4 py-2 rounded-full ${viewBy === "status" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Status</button>
          <button onClick={() => setViewBy("artist")} className={`px-4 py-2 rounded-full ${viewBy === "artist" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Artist</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(grouped).map(([key, items]) => {
          const isOver = dragOver === key;
          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(dragId, key)}
              className={`rounded-3xl border p-4 transition ${isOver ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 capitalize">{key}</h2>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{items.length} order</p>
                </div>
                <ArrowRight size={18} className="text-slate-400" />
              </div>
              <div className="space-y-3 min-h-[120px]">
                {items.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Drop here</div>
                ) : items.map(renderCard)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
