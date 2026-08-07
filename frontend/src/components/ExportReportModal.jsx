import React, { useState } from "react";
import { X, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";

/* ── helpers ──────────────────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (ds) => {
  if (!ds) return "—";
  const p = (ds.split("T")[0] || "").split("-");
  return p.length < 3 ? ds : `${parseInt(p[2])}/${parseInt(p[1])}/${String(p[0]).slice(2)}`;
};

const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const n = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${n[parseInt(m) - 1]} ${y}`;
};

const weekDay = (ds) => {
  if (!ds) return 1;
  const d = parseInt((ds.split("T")[0] || "").split("-")[2]) || 1;
  return Math.min(Math.ceil(d / 7), 5);
};

const usd = (n) => (n ? `$${Number(n).toFixed(2)}` : "—");
const idr = (n, xr) =>
  n && xr ? `Rp${Math.round(Number(n) * xr).toLocaleString("id-ID")}` : "";

/* ── status badge ─────────────────────────────────────────────── */
const BADGE_STYLES = {
  done:        "color:#065f46;background:#d1fae5",
  "place order":"color:#065f46;background:#d1fae5",
  cancel:      "color:#991b1b;background:#fee2e2",
  cancelled:   "color:#991b1b;background:#fee2e2",
  gagal:       "color:#7f1d1d;background:#fecaca",
  "on progress":"color:#78350f;background:#fef3c7",
  proses:      "color:#78350f;background:#fef3c7",
  "menunggu review":"color:#1e3a8a;background:#dbeafe",
  revisi:      "color:#7c2d12;background:#ffedd5",
  discussing:  "color:#5b21b6;background:#ede9fe",
  nego:        "color:#5b21b6;background:#ede9fe",
  "offer sent":"color:#c2410c;background:#ffedd5",
};

const badge = (status) => {
  const key = (status || "").toLowerCase();
  const style = BADGE_STYLES[key] || "color:#374151;background:#f3f4f6";
  return `<span style="display:inline-block;padding:1.5px 7px;border-radius:100px;font-size:6.5pt;font-weight:700;white-space:nowrap;${style}">${esc(status || "—")}</span>`;
};

/* ══════════════════════════════════════════════════════════════════
   PDF HTML BUILDER
══════════════════════════════════════════════════════════════════ */
function buildPdfHtml(monthOrders, chatEntries, month, exchangeRate) {
  const lbl = monthLabel(month);
  const xr  = Number(exchangeRate) || 0;
  const now = new Date();
  const todayStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  /* ─── summary stats ─── */
  const done   = monthOrders.filter(o => o.status === "Done");
  const cancel = monthOrders.filter(o => ["Cancel","Cancelled"].includes(o.status));
  const gagal  = monthOrders.filter(o => o.status === "Gagal");
  const active = monthOrders.filter(o => !["Done","Cancel","Cancelled","Gagal"].includes(o.status));
  const earn   = done.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalV = monthOrders
    .filter(o => !["Cancel","Cancelled"].includes(o.status))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const pct = monthOrders.length ? Math.round((done.length / monthOrders.length) * 100) : 0;

  /* ─── chat stats ─── */
  const placed   = chatEntries.filter(e => e.status === "Place Order");
  const chatRev  = placed.reduce((s, e) => s + (Number(e.real) || 0), 0);
  const convPct  = chatEntries.length ? Math.round((placed.length / chatEntries.length) * 100) : 0;

  /* ─── week grouping ─── */
  const [y, m] = month.split("-");
  const mNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const mName  = mNames[parseInt(m) - 1];
  const WNAMES = ["Pertama","Kedua","Ketiga","Keempat","Kelima"];
  const WRANGE = [`1–7 ${mName}`,`8–14 ${mName}`,`15–21 ${mName}`,`22–28 ${mName}`,`29–31 ${mName}`];

  const byWeek = [[], [], [], [], []];
  monthOrders.forEach(o => {
    const d = o.order_date || (o.created_at || "").slice(0, 10) || "";
    const w = weekDay(d) - 1;
    byWeek[Math.min(Math.max(w, 0), 4)].push(o);
  });

  /* ─── platform chips ─── */
  const platforms = [...new Set(monthOrders.map(o => o.platform || "Lainnya"))].sort();

  /* ══════ CSS ══════ */
  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
      font-size: 8pt; color: #111827; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    /* ── header ── */
    .hd {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2.5px solid #059669; padding-bottom: 8px; margin-bottom: 10px;
    }
    .brand { font-size: 15pt; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1; }
    .tagline { font-size: 7pt; color: #6b7280; margin-top: 2px; }
    .title { text-align: center; }
    .title h1 {
      font-size: 11pt; font-weight: 800; color: #111827;
      text-transform: uppercase; letter-spacing: 0.8px;
    }
    .title p { font-size: 7pt; color: #6b7280; margin-top: 3px; }
    .meta { text-align: right; font-size: 7pt; color: #6b7280; line-height: 1.6; }
    .meta strong { display: block; font-size: 11pt; font-weight: 900; color: #059669; line-height: 1; }

    /* ── stat cards ── */
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 8px; }
    .stat {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-top: 3px solid #059669; border-radius: 5px; padding: 7px 9px;
    }
    .stat-lbl { font-size: 6pt; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-val {
      font-size: 13pt; font-weight: 900; color: #059669;
      line-height: 1.1; margin: 3px 0; font-variant-numeric: tabular-nums;
    }
    .stat-sub { font-size: 6.5pt; color: #374151; }

    /* ── platform chips ── */
    .pls { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
    .pl {
      font-size: 6.5pt; font-weight: 600; padding: 2px 9px; border-radius: 100px;
      background: #f0fdf4; border: 1px solid #86efac; color: #166534;
    }

    /* ── section heading ── */
    .sec {
      background: #059669; color: #fff; font-size: 8pt; font-weight: 800;
      padding: 4px 10px; border-radius: 4px; text-transform: uppercase;
      letter-spacing: 0.8px; margin-bottom: 5px;
    }

    /* ── week heading ── */
    .wk {
      display: flex; align-items: center; gap: 8px;
      margin: 10px 0 3px; font-size: 8pt; font-weight: 800; color: #065f46;
    }
    .wk::after { content: ''; flex: 1; border-top: 1px solid #a7f3d0; }
    .wk-range { font-weight: 400; font-size: 7pt; color: #6b7280; }

    /* ── tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    thead th {
      background: #ecfdf5; color: #065f46;
      font-size: 6.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.3px; padding: 4px 5px;
      border: 1px solid #d1fae5; text-align: left; white-space: nowrap;
    }
    tbody td { padding: 3.5px 5px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tbody tr:nth-child(even) td { background: #fafcff; }
    tfoot td {
      background: #ecfdf5; padding: 4px 5px; font-weight: 700;
      font-size: 7pt; color: #065f46; border-top: 1px solid #a7f3d0;
    }

    /* ── util ── */
    .num  { text-align: right; font-variant-numeric: tabular-nums; }
    .ctr  { text-align: center; }
    .muted { color: #9ca3af; }
    .bold { font-weight: 700; }
    .avoid { page-break-inside: avoid; }

    /* ── footer ── */
    .footer {
      margin-top: 10px; padding-top: 6px; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; font-size: 6.5pt; color: #9ca3af;
    }

    /* ── print button (screen only) ── */
    .btn-print {
      position: fixed; bottom: 20px; right: 20px;
      background: #059669; color: #fff; border: none;
      padding: 11px 22px; border-radius: 10px; font-size: 13px; font-weight: 700;
      cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.18);
    }
    @media print { .btn-print { display: none; } }
  `;

  /* ══════ HTML BUILD ══════ */
  let html = `<!DOCTYPE html><html lang="id"><head>
<meta charset="UTF-8">
<title>MAGSIKA — Laporan ${lbl.toUpperCase()}</title>
<style>${css}</style>
</head><body>`;

  /* ── header ── */
  html += `
<div class="hd">
  <div>
    <div class="brand">MAGSIKA STUDIO</div>
    <div class="tagline">Management &amp; Creative Studio</div>
  </div>
  <div class="title">
    <h1>Laporan Bulanan — ${esc(lbl)}</h1>
    <p>Daily Work Progress &amp; New Client Calculation</p>
  </div>
  <div class="meta">
    <strong>${monthOrders.length}</strong>
    order terdaftar<br>
    Digenerate: ${todayStr}
  </div>
</div>`;

  /* ── summary cards ── */
  html += `<div class="stats">
  <div class="stat">
    <div class="stat-lbl">Total Order</div>
    <div class="stat-val">${monthOrders.length}</div>
    <div class="stat-sub">Progress: ${active.length} &nbsp;·&nbsp; Gagal: ${gagal.length}</div>
  </div>
  <div class="stat">
    <div class="stat-lbl">Selesai (Done)</div>
    <div class="stat-val">${done.length}</div>
    <div class="stat-sub">Rate: ${pct}% &nbsp;·&nbsp; Cancel: ${cancel.length}</div>
  </div>
  <div class="stat">
    <div class="stat-lbl">Earn — Lunas/Done</div>
    <div class="stat-val" style="font-size:9pt">${usd(earn)}</div>
    <div class="stat-sub">${idr(earn, xr) || "—"}</div>
  </div>
  <div class="stat">
    <div class="stat-lbl">Total Nilai Order</div>
    <div class="stat-val" style="font-size:9pt;color:#0369a1">${usd(totalV)}</div>
    <div class="stat-sub">${idr(totalV, xr) || "—"}</div>
  </div>
  <div class="stat">
    <div class="stat-lbl">Chat Leads</div>
    <div class="stat-val" style="color:#7c3aed">${chatEntries.length}</div>
    <div class="stat-sub">Place Order: ${placed.length} (${convPct}%) &nbsp;·&nbsp; Rev: ${usd(chatRev)}</div>
  </div>
</div>`;

  /* ── platform chips ── */
  if (platforms.length > 0) {
    html += `<div class="pls">`;
    platforms.forEach(pl => {
      const plO = monthOrders.filter(o => (o.platform || "Lainnya") === pl);
      const plD = plO.filter(o => o.status === "Done");
      const plE = plD.reduce((s, o) => s + (Number(o.total) || 0), 0);
      html += `<span class="pl">${esc(pl)}: ${plO.length} order &nbsp;·&nbsp; Done: ${plD.length} &nbsp;·&nbsp; ${usd(plE)}</span>`;
    });
    html += `</div>`;
  }

  /* ── daily work progress ── */
  html += `<div class="sec">Daily Work Progress</div>`;

  let globalNo = 0;
  for (let w = 0; w < 5; w++) {
    const wO = byWeek[w];
    if (wO.length === 0) continue;

    const wDone = wO.filter(o => o.status === "Done");
    const wEarn = wDone.reduce((s, o) => s + (Number(o.total) || 0), 0);

    html += `<div class="wk">Minggu ${esc(WNAMES[w])} <span class="wk-range">${WRANGE[w]} ${y}</span></div>`;
    html += `<table class="avoid"><thead><tr>
  <th style="width:3%">No</th>
  <th style="width:7%">Tanggal</th>
  <th style="width:10%">Platform</th>
  <th style="width:16%">Client</th>
  <th style="width:10%">Kategori</th>
  <th style="width:11%">Talent</th>
  <th style="width:7%">Deadline</th>
  <th style="width:8%">Rate</th>
  <th style="width:11%">Status</th>
  <th style="width:8%">Payment</th>
  <th style="width:9%">Selesai</th>
</tr></thead><tbody>`;

    wO.forEach(o => {
      globalNo++;
      const artists = (Array.isArray(o.artists) ? o.artists : []).filter(Boolean);
      const talent  = artists.slice(0, 2).join(", ") || "—";
      const rate    = Number(o.total) || 0;
      const isDone  = o.status === "Done";

      html += `<tr>
  <td class="ctr muted">${globalNo}</td>
  <td>${esc(fmtDate(o.order_date || (o.created_at || "").slice(0, 10)))}</td>
  <td>${esc(o.platform || "—")}</td>
  <td class="bold">${esc(o.client || "—")}</td>
  <td>${esc(o.work_type || "—")}</td>
  <td>${esc(talent)}</td>
  <td>${esc(fmtDate(o.deadline))}</td>
  <td class="num bold">${rate ? `$${rate.toFixed(2)}` : "—"}</td>
  <td>${badge(o.status)}</td>
  <td>${esc(o.payment_status || "—")}</td>
  <td class="muted">${isDone ? esc(o.completed_at ? fmtDate(o.completed_at) : "✓") : ""}</td>
</tr>`;
    });

    html += `</tbody><tfoot><tr>
  <td colspan="7" style="text-align:right;font-weight:400;color:#6b7280">Subtotal Minggu ${esc(WNAMES[w])}:</td>
  <td class="num">${usd(wEarn)}</td>
  <td colspan="2" style="font-weight:400;color:#374151">${idr(wEarn, xr)}</td>
  <td>${wDone.length}/${wO.length} selesai</td>
</tr></tfoot></table>`;
  }

  /* ── new client calculation ── */
  if (chatEntries.length > 0) {
    html += `<div class="sec" style="margin-top:12px">New Client Calculation</div>`;
    html += `<table class="avoid"><thead><tr>
  <th style="width:3%">No</th>
  <th style="width:7%">Tanggal</th>
  <th style="width:8%">Akun</th>
  <th style="width:14%">Username</th>
  <th style="width:8%">Tipe</th>
  <th style="width:7%">Est $</th>
  <th style="width:7%">Budget</th>
  <th style="width:7%">Agreed</th>
  <th style="width:8%">Real $</th>
  <th style="width:10%">Status</th>
  <th style="width:21%">Catatan</th>
</tr></thead><tbody>`;

    chatEntries.forEach((e, i) => {
      html += `<tr>
  <td class="ctr muted">${i + 1}</td>
  <td>${esc(fmtDate(e.date))}</td>
  <td>${esc(e.akun || "—")}</td>
  <td class="bold">${esc(e.username || "—")}</td>
  <td>${esc(e.tipe || "New Client")}</td>
  <td class="num">${e.estimasi ? `$${e.estimasi}` : "—"}</td>
  <td class="num">${e.budget   ? `$${e.budget}`   : "—"}</td>
  <td class="num">${e.agreed   ? `$${e.agreed}`   : "—"}</td>
  <td class="num bold">${e.real ? `$${e.real}` : "—"}</td>
  <td>${badge(e.status)}</td>
  <td class="muted">${esc(e.catatan || "")}</td>
</tr>`;
    });

    html += `</tbody><tfoot><tr>
  <td colspan="8" style="text-align:right;font-weight:400;color:#6b7280">Total Revenue (Place Order):</td>
  <td class="num">${usd(chatRev)}</td>
  <td colspan="2" style="font-weight:400;color:#374151">${idr(chatRev, xr)} &nbsp;·&nbsp; Konversi: ${convPct}%</td>
</tr></tfoot></table>`;
  }

  /* ── footer ── */
  html += `
<div class="footer">
  <span>MAGSIKA STUDIO — Laporan ${esc(lbl)} — Digenerate ${todayStr}</span>
  <span>${xr ? `Kurs USD/IDR: Rp${xr.toLocaleString("id-ID")}` : ""}</span>
</div>
<button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
<script>
  window.onload = function () { setTimeout(function () { window.print(); }, 700); };
<\/script>
</body></html>`;

  return html;
}

/* ══════════════════════════════════════════════════════════════════
   MODAL COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function ExportReportModal({ onClose }) {
  const { orders }       = useOrders();
  const { exchangeRate } = useCurrency();

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  const orderCount = orders.filter(o =>
    (o.order_date || (o.created_at || "").slice(0, 10) || "").startsWith(month)
  ).length;

  const handleExport = async () => {
    setLoading(true);
    try {
      /* fetch chat leads — silently skip if unavailable */
      let chatEntries = [];
      try {
        const res = await api.get("/chat-entries", { params: { month } });
        chatEntries = res.data?.entries || [];
      } catch (e) {
        console.warn("Chat entries tidak tersedia:", e);
      }

      const monthOrders = orders
        .filter(o => (o.order_date || (o.created_at || "").slice(0, 10) || "").startsWith(month))
        .sort((a, b) => (a.order_date || "").localeCompare(b.order_date || ""));

      const html = buildPdfHtml(monthOrders, chatEntries, month, exchangeRate);

      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Popup diblokir browser. Izinkan popup untuk situs ini terlebih dahulu.");
        return;
      }
      win.document.write(html);
      win.document.close();

      toast.success(`Preview laporan ${monthLabel(month)} dibuka!`);
      onClose();
    } catch (err) {
      console.error("Export error:", err);
      toast.error(`Gagal buat laporan: ${err?.message || "Error tidak diketahui"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">

        {/* ── header ── */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Export Laporan PDF</p>
                <p className="text-xs text-emerald-100">A4 Landscape · siap cetak</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/70 hover:bg-white/20 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* month picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Pilih Bulan
            </label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-300 focus:bg-white transition"
            />
          </div>

          {/* preview info */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Periode</span>
              <span className="text-sm font-semibold text-slate-800">{monthLabel(month)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Jumlah order</span>
              <span className={`text-sm font-bold ${orderCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {orderCount} order
              </span>
            </div>
          </div>

          {/* print info */}
          <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3">
            <Printer size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Preview terbuka di tab baru. Print dialog muncul otomatis —
              pilih <strong>Save as PDF</strong> atau <strong>Microsoft Print to PDF</strong> untuk menyimpan.
            </p>
          </div>

          {/* included */}
          <ul className="space-y-1.5">
            {[
              "Ringkasan: total order, earn USD+IDR, chat leads",
              "Breakdown per platform",
              "Tabel order per minggu + subtotal",
              "Tabel chat leads (jika ada data)",
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── footer ── */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            onClick={handleExport}
            disabled={loading || orderCount === 0}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Memproses...</>
              : <><FileText size={14} /> Buka Preview</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}
