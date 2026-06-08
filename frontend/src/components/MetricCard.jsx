import React from "react";

export function MetricCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-white ${accent}`}>
        <Icon size={18} />
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
