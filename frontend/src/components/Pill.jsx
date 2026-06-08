import React from "react";

export default function Pill({ label, bg = "#e2e8f0", text = "#0f172a" }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ background: bg, color: text }}>
      {label}
    </span>
  );
}
