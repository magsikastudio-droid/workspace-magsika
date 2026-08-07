import React, { useState } from "react";
import * as XLSX from "xlsx";
import { X, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useOrders } from "../context/OrdersContext";
import { useCurrency } from "../context/CurrencyContext";

/* ── helpers ────────────────────────────────────────────────────── */
const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${String(y).slice(2)}`;
};

const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${names[parseInt(m) - 1]} ${y}`;
};

const weekNum = (dateStr, monthStr) => {
  if (!dateStr) return 1;
  const d = parseInt(dateStr.split("-")[2]) || 1;
  return Math.min(Math.ceil(d / 7), 5);
};

const WEEK_NAMES = ["MINGGU PERTAMA", "MINGGU KEDUA", "MINGGU KETIGA", "MINGGU KEEMPAT", "MINGGU KELIMA"];

/* ── cell style helpers (SheetJS-CE: widths only) ────────────────── */
const col = (wch) => ({ wch });

/* ═══════════════════════════════════════════════════════════════════
   BUILD SHEET 1 — Control Document (full layout like original)
═══════════════════════════════════════════════════════════════════ */
function buildControlSheet(monthOrders, chatEntries, month, exchangeRate) {
  const lbl = monthLabel(month).toUpperCase();
  const COLS = 43; // total columns to pre-fill

  /* ─── compute summary stats ─── */
  const complete = monthOrders.filter(o => {
    const s = (o.status || "").toLowerCase();
    return s !== "cancel" && s !== "cancelled";
  });
  const mgsika  = complete.filter(o => (o.platform || "").includes("Magsika"));
  const eirene  = complete.filter(o => (o.platform || "").includes("Eirene"));
  const ltk     = complete.filter(o => (o.platform || "").includes("Komunitas"));
  const earnUsd = complete.filter(o => (o.status || "") === "Done" || (o.payment_status || "") === "Lunas")
                          .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalUsd = complete.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const ltkEarn = ltk.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const ltkDone = ltk.filter(o => o.status === "Done").length;

  /* ─── group chat entries by week ─── */
  const chatByWeek = [[], [], [], [], []];
  chatEntries.forEach(e => {
    const w = weekNum(e.date, month) - 1;
    chatByWeek[Math.min(Math.max(w, 0), 4)].push(e);
  });

  /* ─── group orders by week & date ─── */
  const ordersByWeek = [[], [], [], [], []];
  monthOrders.forEach((o, idx) => {
    const w = weekNum(o.order_date, month) - 1;
    ordersByWeek[Math.min(Math.max(w, 0), 4)].push({ ...o, _no: idx + 1 });
  });

  /* ─── build AoA (array of arrays) ─── */
  const rows = [];
  const blank = () => Array(COLS).fill("");

  // Row 0: Title
  const r0 = blank();
  r0[1] = `MAGSIKA STUDIO CONTROL DOCUMENT — ${lbl}`;
  rows.push(r0);

  // Row 1: Sub-headers (left=new client, right=daily work progress)
  const r1 = blank();
  r1[1] = "MAGSIKA STUDIO NEW CLIENT CALCULATION";
  r1[19] = "DAILY WORK PROGRESS";
  rows.push(r1);

  // Row 2: Account summary
  const r2 = blank();
  r2[1]  = "Akun"; r2[2] = "Discussing"; r2[3] = "Nego"; r2[4] = "Offer Sent"; r2[5] = "Closing";
  r2[19] = "EARN $";  r2[20] = earnUsd.toFixed(2);
  r2[21] = "RUPIAH";  r2[22] = `Rp${Math.round(earnUsd * exchangeRate).toLocaleString("id-ID")}`;
  r2[28] = "EIRENE COMPLETE"; r2[29] = eirene.filter(o => o.status === "Done").length;
  rows.push(r2);

  const magsikaStat = chatEntries.filter(e => e.akun === "Magsika");
  const eireneStat  = chatEntries.filter(e => e.akun === "Eirene");
  const r3 = blank();
  r3[1] = "Magsika";
  r3[2] = magsikaStat.filter(e => e.status === "Discussing").length;
  r3[3] = magsikaStat.filter(e => e.status === "Nego").length;
  r3[4] = magsikaStat.filter(e => e.status === "Offer Sent" || e.status === "Offer sent").length;
  r3[5] = magsikaStat.filter(e => e.status === "Place Order").length;
  r3[19] = "TOTAL $";  r3[20] = totalUsd.toFixed(2);
  r3[21] = "RUPIAH";   r3[22] = `Rp${Math.round(totalUsd * exchangeRate).toLocaleString("id-ID")}`;
  r3[28] = "MAGSIKA COMPLETE"; r3[29] = mgsika.filter(o => o.status === "Done").length;
  rows.push(r3);

  const r4 = blank();
  r4[1] = "Eirene";
  r4[2] = eireneStat.filter(e => e.status === "Discussing").length;
  r4[3] = eireneStat.filter(e => e.status === "Nego").length;
  r4[4] = eireneStat.filter(e => e.status === "Offer Sent" || e.status === "Offer sent").length;
  r4[5] = eireneStat.filter(e => e.status === "Place Order").length;
  r4[28] = "TOTAL EARNING LTK"; r4[29] = `$${ltkEarn.toFixed(2)}`;
  r4[32] = "EARNING LTK COMPLETE"; r4[33] = `$${ltk.filter(o => o.status === "Done").reduce((s,o) => s+(Number(o.total)||0),0).toFixed(2)}`;
  rows.push(r4);

  // Row 5: blank
  rows.push(blank());

  // Row 6: Column headers (left chat | separator | right chat | separator | orders)
  const hdr = blank();
  // Left chat headers (B-I)
  ["NO","ORDER START","PLATFORM","Marketer","STATUS","CLIENT","CATEGORY","ORDER ID","PROJECT","KODE FOLDER","TALENT 1","TALENT 2","DEADLINE","RATE (NETT)","CHECK","COMPLETED","BONUS"]
    .forEach((h, i) => { hdr[19 + i] = h; });
  // Right chat headers (K-R)
  ["Date","Who","Name","Estimated","Budget","Agreed","Real","Status"]
    .forEach((h, i) => { hdr[9 + i] = h; });
  // Left chat headers
  ["Date","Who","Name","Estimated","Budget","Agreed","Real","Status"]
    .forEach((h, i) => { hdr[1 + i] = h; });
  rows.push(hdr);

  // Interleave weekly sections
  const maxWeeks = 5;
  let orderGlobalRow = 0; // running index across all order rows

  for (let w = 0; w < maxWeeks; w++) {
    const weekChatEntries = chatByWeek[w];
    const weekOrders      = ordersByWeek[w];

    if (weekChatEntries.length === 0 && weekOrders.length === 0) continue;

    // Week header
    const wHdr = blank();
    wHdr[1]  = WEEK_NAMES[w];
    wHdr[9]  = WEEK_NAMES[w];
    rows.push(wHdr);

    // Split chat entries: left = "Magsika" acct, right = "Eirene" acct
    const leftChat  = weekChatEntries.filter(e => e.akun === "Magsika" || !e.akun);
    const rightChat = weekChatEntries.filter(e => e.akun === "Eirene");
    const maxChat   = Math.max(leftChat.length, rightChat.length, weekOrders.length);

    for (let i = 0; i < maxChat; i++) {
      const row = blank();

      // Left chat column (B-I)
      const lc = leftChat[i];
      if (lc) {
        row[1] = fmtDate(lc.date);
        row[2] = lc.tipe || "New Client";
        row[3] = lc.username || "";
        row[4] = lc.estimasi ? `$${lc.estimasi}` : "";
        row[5] = lc.budget   ? `$${lc.budget}`   : "";
        row[6] = lc.agreed   ? `$${lc.agreed}`   : "";
        row[7] = lc.real     ? `$${lc.real}`     : "";
        row[8] = lc.status   || "";
      }

      // Right chat column (K-R)
      const rc = rightChat[i];
      if (rc) {
        row[9]  = fmtDate(rc.date);
        row[10] = rc.tipe || "New Client";
        row[11] = rc.username || "";
        row[12] = rc.estimasi ? `$${rc.estimasi}` : "";
        row[13] = rc.budget   ? `$${rc.budget}`   : "";
        row[14] = rc.agreed   ? `$${rc.agreed}`   : "";
        row[15] = rc.real     ? `$${rc.real}`     : "";
        row[16] = rc.status   || "";
      }

      // Order column (U onwards)
      const ord = weekOrders[i];
      if (ord) {
        orderGlobalRow++;
        const artists = Array.isArray(ord.artists) ? ord.artists : [];
        row[19] = orderGlobalRow;
        row[20] = fmtDate(ord.order_date);
        row[21] = ord.platform || "";
        row[22] = ord.marketer || "";
        row[23] = ord.status || "";
        row[24] = ord.client || "";
        row[25] = ord.work_type || "";
        row[26] = ord.order_id || "";
        row[27] = ord.project || "";
        row[28] = ord.folder_code || "";
        row[29] = artists[0] || "";
        row[30] = artists[1] || "";
        row[31] = ord.deadline ? fmtDate(ord.deadline) : "";
        row[32] = ord.total ? `$${Number(ord.total).toFixed(2)}` : "";
        row[33] = ord.payment_status === "Lunas" ? "TRUE" : "FALSE";
        row[34] = ord.status === "Done" ? fmtDate(ord.completed_at || ord.deadline) : "";
        row[35] = "";
      }

      rows.push(row);
    }

    // Week total row
    const totRow = blank();
    const leftPlaced  = leftChat.filter(e => e.status === "Place Order");
    const rightPlaced = rightChat.filter(e => e.status === "Place Order");
    const leftTotal   = leftPlaced.reduce((s, e) => s + (Number(e.real) || 0), 0);
    const rightTotal  = rightPlaced.reduce((s, e) => s + (Number(e.real) || 0), 0);
    totRow[1] = "TOTAL"; totRow[7] = `$${leftTotal.toFixed(2)}`; totRow[8] = "SEMANGAT!";
    totRow[9] = "TOTAL"; totRow[15] = `$${rightTotal.toFixed(2)}`; totRow[16] = "SEMANGAT!";
    rows.push(totRow);
    rows.push(blank());
  }

  // Create sheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    col(3),   // A
    col(10),  // B Date
    col(13),  // C Who
    col(18),  // D Name
    col(12),  // E Est
    col(12),  // F Budget
    col(12),  // G Agreed
    col(12),  // H Real
    col(15),  // I Status
    col(10),  // J Date
    col(13),  // K Who
    col(18),  // L Name
    col(12),  // M Est
    col(12),  // N Budget
    col(12),  // O Agreed
    col(12),  // P Real
    col(15),  // Q Status
    col(3), col(3), // R, S blank
    col(5),   // T NO
    col(12),  // U ORDER START
    col(18),  // V PLATFORM
    col(12),  // W Marketer
    col(18),  // X STATUS
    col(22),  // Y CLIENT
    col(18),  // Z CATEGORY
    col(22),  // AA ORDER ID
    col(30),  // AB PROJECT
    col(38),  // AC KODE FOLDER
    col(14),  // AD TALENT 1
    col(14),  // AE TALENT 2
    col(12),  // AF DEADLINE
    col(13),  // AG RATE
    col(8),   // AH CHECK
    col(12),  // AI COMPLETED
    col(10),  // AJ BONUS
  ];

  return ws;
}

/* ═══════════════════════════════════════════════════════════════════
   BUILD SHEET 2 — Orders only (clean table)
═══════════════════════════════════════════════════════════════════ */
function buildOrdersSheet(monthOrders, month, exchangeRate) {
  const lbl = monthLabel(month).toUpperCase();
  const headers = ["NO","ORDER START","PLATFORM","MARKETER","STATUS","CLIENT","KATEGORI","ORDER ID","PROJECT","KODE FOLDER","TALENT 1","TALENT 2","DEADLINE","RATE (NETT)","PAYMENT","SELESAI"];

  const data = monthOrders.map((o, idx) => {
    const artists = Array.isArray(o.artists) ? o.artists : [];
    return [
      idx + 1,
      fmtDate(o.order_date),
      o.platform || "",
      o.marketer || "",
      o.status || "",
      o.client || "",
      o.work_type || "",
      o.order_id || "",
      o.project || "",
      o.folder_code || "",
      artists[0] || "",
      artists[1] || "",
      o.deadline ? fmtDate(o.deadline) : "",
      o.total ? `$${Number(o.total).toFixed(2)}` : "",
      o.payment_status || "",
      o.status === "Done" ? (o.completed_at ? fmtDate(o.completed_at) : "✓") : "",
    ];
  });

  const earn   = monthOrders.filter(o => o.status === "Done").reduce((s,o) => s+(Number(o.total)||0), 0);
  const total  = monthOrders.filter(o => o.status !== "Cancel").reduce((s,o) => s+(Number(o.total)||0), 0);
  const done   = monthOrders.filter(o => o.status === "Done").length;
  const cancel = monthOrders.filter(o => o.status === "Cancel").length;

  const aoa = [
    [`MAGSIKA STUDIO — DAILY WORK PROGRESS — ${lbl}`],
    [],
    [`Total Order: ${monthOrders.length}`, "", `Done: ${done}`, "", `Cancel: ${cancel}`,
     "", `Earn (Done): $${earn.toFixed(2)}`, "", `Total Value: $${total.toFixed(2)}`,
     "", `≈ Rp${Math.round(earn * exchangeRate).toLocaleString("id-ID")}`],
    [],
    headers,
    ...data,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    col(5), col(12), col(20), col(12), col(20), col(22), col(18),
    col(24), col(32), col(40), col(14), col(14), col(12), col(14), col(15), col(12),
  ];
  return ws;
}

/* ═══════════════════════════════════════════════════════════════════
   BUILD SHEET 3 — Chat / New Client Calculation (clean table)
═══════════════════════════════════════════════════════════════════ */
function buildChatSheet(chatEntries, month, exchangeRate) {
  const lbl = monthLabel(month).toUpperCase();
  const headers = ["DATE","AKUN","USERNAME","TIPE","ESTIMATED","BUDGET","AGREED","REAL","STATUS","CATATAN"];

  const chatByWeek = [[], [], [], [], []];
  chatEntries.forEach(e => {
    const w = weekNum(e.date, month) - 1;
    chatByWeek[Math.min(Math.max(w, 0), 4)].push(e);
  });

  const aoa = [
    [`MAGSIKA STUDIO — NEW CLIENT CALCULATION — ${lbl}`],
    [],
    [`Total Leads: ${chatEntries.length}`,
     `Place Order: ${chatEntries.filter(e => e.status === "Place Order").length}`,
     `Konversi: ${chatEntries.length ? Math.round(chatEntries.filter(e => e.status === "Place Order").length / chatEntries.length * 100) : 0}%`,
     `Revenue: $${chatEntries.filter(e => e.status === "Place Order").reduce((s,e) => s+(Number(e.real)||0),0).toFixed(2)}`],
    [],
  ];

  for (let w = 0; w < 5; w++) {
    const wEntries = chatByWeek[w];
    if (wEntries.length === 0) continue;

    aoa.push([WEEK_NAMES[w]]);
    aoa.push(headers);

    wEntries.forEach(e => {
      aoa.push([
        fmtDate(e.date),
        e.akun || "",
        e.username || "",
        e.tipe || "New Client",
        e.estimasi ? `$${e.estimasi}` : "",
        e.budget   ? `$${e.budget}`   : "",
        e.agreed   ? `$${e.agreed}`   : "",
        e.real     ? `$${e.real}`     : "",
        e.status   || "",
        e.catatan  || "",
      ]);
    });

    const placed = wEntries.filter(e => e.status === "Place Order");
    const wTotal = placed.reduce((s, e) => s + (Number(e.real) || 0), 0);
    aoa.push(["TOTAL", "", `${placed.length} order`, "", "", "", "", `$${wTotal.toFixed(2)}`, "SEMANGAT!"]);
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    col(12), col(12), col(20), col(16), col(13), col(13), col(13), col(13), col(18), col(30),
  ];
  return ws;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function ExportReportModal({ onClose }) {
  const { orders } = useOrders();
  const { exchangeRate } = useCurrency();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch chat entries for selected month
      const chatRes = await api.get("/chat-entries", { params: { month } });
      const chatEntries = chatRes.data?.entries || [];

      // Filter orders for selected month, sorted by date
      const monthOrders = orders
        .filter(o => {
          const d = o.order_date || (o.created_at || "").slice(0, 10) || "";
          return d.startsWith(month);
        })
        .sort((a, b) => (a.order_date || "").localeCompare(b.order_date || ""));

      // Build workbook
      const wb = XLSX.utils.book_new();

      const wsControl = buildControlSheet(monthOrders, chatEntries, month, exchangeRate);
      XLSX.utils.book_append_sheet(wb, wsControl, "Control Document");

      const wsOrders = buildOrdersSheet(monthOrders, month, exchangeRate);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Daily Work Progress");

      const wsChat = buildChatSheet(chatEntries, month, exchangeRate);
      XLSX.utils.book_append_sheet(wb, wsChat, "New Client Calculation");

      // Download
      const filename = `MAGSIKA CONTROL DOCUMENT ${monthLabel(month).toUpperCase()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Laporan ${monthLabel(month)} berhasil diexport!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gagal export laporan");
    } finally {
      setLoading(false);
    }
  };

  const previewMonth = monthOrders => monthOrders
    .filter(o => (o.order_date || "").startsWith(month)).length;
  const orderCount = orders.filter(o => (o.order_date || "").startsWith(month)).length;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <FileSpreadsheet size={22} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Export Laporan</p>
                <p className="text-xs text-emerald-100">Format Control Document Excel</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-white/70 hover:bg-white/20 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-5">
          {/* Month picker */}
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

          {/* Preview info */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Periode</span>
              <span className="text-sm font-semibold text-slate-800">{monthLabel(month)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Jumlah order</span>
              <span className="text-sm font-bold text-emerald-600">{orderCount} order</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Sheet yang dibuat</span>
              <span className="text-xs font-semibold text-slate-600">3 sheet</span>
            </div>
          </div>

          {/* Sheet list */}
          <div className="space-y-1.5">
            {[
              { name: "Control Document", desc: "Layout asli — chat & order side-by-side per minggu" },
              { name: "Daily Work Progress", desc: "Tabel order bersih dengan summary" },
              { name: "New Client Calculation", desc: "Tabel chat / leads per minggu" },
            ].map(s => (
              <div key={s.name} className="flex items-start gap-3 rounded-xl bg-emerald-50 px-3.5 py-2.5">
                <span className="text-emerald-500 text-xs font-bold mt-0.5">📋</span>
                <div>
                  <p className="text-xs font-bold text-emerald-800">{s.name}</p>
                  <p className="text-[10px] text-emerald-600">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 px-7 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            Batal
          </button>
          <button
            onClick={handleExport}
            disabled={loading || orderCount === 0}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating...</>
              : <><FileSpreadsheet size={15} /> Export .xlsx</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
