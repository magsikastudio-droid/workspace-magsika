import React, { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Download, Plus, X } from "lucide-react";

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const EMPLOYEES = [
  { no:1, nama:"Ivo Febrian Pratama", lp:"L", status:"Karyawan", peran:"Koordinator", email:"iriantamoeta@gmail.com", telp:"087801822558", rekening:"DANA 087801822558", atasNama:"Ivo Febrian Pratama", gajiPokok:4750000, bonus:0, dignity:0, mengajar:0, kos:300000, makanSiang:0, komunikasi:0, laundry:0, bpjs:185000, shu:0 },
  { no:2, nama:"Novita Rahmawati", lp:"P", status:"Karyawan", peran:"Admin", email:"novitar2115@gmail.com", telp:"083838221408", rekening:"SEABANK 901710074772", atasNama:"Novita Rahmawati", gajiPokok:2000000, bonus:300000, dignity:0, mengajar:0, kos:300000, makanSiang:300000, komunikasi:0, laundry:100000, bpjs:0, shu:0 },
  { no:3, nama:"Andre Afandi", lp:"L", status:"Karyawan", peran:"3D Artist", email:"", telp:"", rekening:"", atasNama:"Andre Afandi", gajiPokok:2000000, bonus:0, dignity:250000, mengajar:500000, kos:0, makanSiang:300000, komunikasi:0, laundry:300000, bpjs:185000, shu:0 },
  { no:4, nama:"Kevin Nurrohman", lp:"L", status:"Karyawan", peran:"3D Artist", email:"", telp:"", rekening:"", atasNama:"Kevin Nurrohman", gajiPokok:2000000, bonus:0, dignity:0, mengajar:0, kos:300000, makanSiang:300000, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:5, nama:"Hadziq Avi Aqsava", lp:"L", status:"Magang Sekolah", peran:"3D Artist", email:"", telp:"", rekening:"", atasNama:"Hadziq Avi Aqsava", gajiPokok:300000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:6, nama:"Quinsha Athaya", lp:"P", status:"Magang Sekolah", peran:"Designer", email:"iriantamoeta@gmail.com", telp:"087801822558", rekening:"DANA 087801822558", atasNama:"Ivo Febrian Pratama", gajiPokok:300000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:7, nama:"Faizal Kamal", lp:"L", status:"Pendamping", peran:"Utama", email:"isalkamal@gmail.com", telp:"081548109036", rekening:"BCA 8030476957", atasNama:"Mia Nurul Fadhilah", gajiPokok:2750000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:8, nama:"Febru Harsono", lp:"L", status:"Pendamping", peran:"Fasilitator", email:"harsono.febru@gmail.com", telp:"085640071447", rekening:"BCA 0095395444", atasNama:"Febru Harsono", gajiPokok:1500000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:9, nama:"Husayn Akmal", lp:"L", status:"Pendamping", peran:"Teknis", email:"husaynap@gmail.com", telp:"082241544629", rekening:"BCA 0131186001", atasNama:"Husayn Akmal", gajiPokok:2000000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:10, nama:"Anis Sasongko", lp:"L", status:"Pendamping", peran:"Strategis", email:"sasongkoanis@gmail.com", telp:"082241544629", rekening:"BCA 8360012841", atasNama:"Anis Sasongko", gajiPokok:2000000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:11, nama:"Joko Sasongko", lp:"L", status:"Pendamping", peran:"Advisor", email:"iliksas@gmail.com", telp:"081222261921", rekening:"BCA 0095123321", atasNama:"Ririn Narulita", gajiPokok:2000000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
  { no:12, nama:"Sunarsih", lp:"P", status:"Pendamping", peran:"Fasilitator", email:"asihazr@gmail.com", telp:"089636787944", rekening:"DANA 083894556407", atasNama:"Sunarsih", gajiPokok:1000000, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 },
];

function rupiah(n) {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

function buildDebet(emp) {
  return [
    { label: "Gaji Pokok", amount: emp.gajiPokok },
    { label: "Bonus", amount: emp.bonus },
    { label: "Komisi", amount: 0 },
    { label: "Lembur", amount: 0 },
    { label: "Tunjangan Kos", amount: emp.kos },
    { label: "Tunjangan Makan Siang", amount: emp.makanSiang },
    { label: "Tunjangan Komunikasi", amount: emp.komunikasi },
    { label: "Tunjangan Laundry/Transport", amount: emp.laundry },
    { label: "Dignity", amount: emp.dignity },
    { label: "Mengajar", amount: emp.mengajar },
    { label: "SHU", amount: emp.shu },
  ].filter(r => r.amount > 0 || ["Gaji Pokok","Bonus","Komisi","Lembur"].includes(r.label));
}

function buildKredit(emp) {
  return [
    { label: "Subsidi Kos (sudah dibayar kantor)", amount: 0 },
    { label: "BPJS (ditanggung kantor)", amount: emp.bpjs },
  ].filter(r => r.amount > 0 || r.label.startsWith("Subsidi"));
}

function LineEditor({ items, setItems }) {
  const update = (idx, field, val) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "amount" ? (parseFloat(val) || 0) : val };
      return next;
    });
  };
  const remove = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="text"
            value={item.label}
            onChange={e => update(idx, "label", e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <input
            type="number"
            value={item.amount || ""}
            onChange={e => update(idx, "amount", e.target.value)}
            className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-xs outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function SlipGaji() {
  const [empIdx, setEmpIdx] = useState(0);
  const [bulan, setBulan] = useState(new Date().getMonth());
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [tglSlip, setTglSlip] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ nama: "", lp: "L", status: "", peran: "", email: "", telp: "", rekening: "", atasNama: "" });
  const [debetItems, setDebetItems] = useState([]);
  const [kreditItems, setKreditItems] = useState([]);
  const [exporting, setExporting] = useState(false);
  const slipRef = useRef(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadEmployee = useCallback((idx) => {
    const emp = EMPLOYEES[idx];
    setForm({
      nama: emp.nama,
      lp: emp.lp || "L",
      status: emp.status || "",
      peran: emp.peran || "",
      email: emp.email || "",
      telp: emp.telp || "",
      rekening: emp.rekening || "",
      atasNama: emp.atasNama || emp.nama,
    });
    setDebetItems(buildDebet(emp));
    setKreditItems(buildKredit(emp));
  }, []);

  useEffect(() => { loadEmployee(0); }, [loadEmployee]);

  const totalDebet = debetItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalKredit = kreditItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDiterima = totalDebet - totalKredit;

  const bulanTxt = BULAN[bulan];
  const periodTxt = `${bulanTxt} ${tahun}`;
  const placeDate = (() => {
    if (!tglSlip) return "";
    const d = new Date(tglSlip + "T00:00:00");
    return `Kab. Semarang, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const handleExport = async () => {
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(slipRef.current, {
        scale: 3,
        backgroundColor: "#fbfaf7",
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `Slip-Gaji-${(form.nama || "slip").replace(/\s+/g, "-")}-${bulanTxt}-${tahun}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      toast.error("Gagal export, coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  // Slip inline styles — always light/paper, independent of dark mode
  const S = {
    navy: "#16233f",
    navyDeep: "#0d1729",
    gold: "#b8894a",
    goldSoft: "#e4c9a3",
    paper: "#fbfaf7",
    ink: "#1c2333",
    inkSoft: "#5b6478",
    line: "#dcd6c9",
    debet: "#2f5233",
    kredit: "#8a3324",
  };

  const inputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const sectionTitle = "mb-3 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-slate-600 dark:text-slate-300";

  return (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-900">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Generator Slip Gaji</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Pilih anggota tim, cek/ubah angkanya, lalu klik "Export PNG".
        </p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "360px 1fr", alignItems: "start" }}>

        {/* ── FORM PANEL ── */}
        <div className="space-y-4">

          {/* 1 · Orang & Periode */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className={sectionTitle}>1 · Pilih Orang &amp; Periode</p>

            <div className="mb-3">
              <label className={labelCls}>Anggota Tim</label>
              <select
                value={empIdx}
                onChange={e => { const i = +e.target.value; setEmpIdx(i); loadEmployee(i); }}
                className={inputCls}
              >
                {EMPLOYEES.map((emp, i) => (
                  <option key={i} value={i}>{emp.nama} — {emp.peran}</option>
                ))}
              </select>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bulan</label>
                <select value={bulan} onChange={e => setBulan(+e.target.value)} className={inputCls}>
                  {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tahun</label>
                <input type="number" value={tahun} onChange={e => setTahun(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Tanggal Slip Dibuat</label>
              <input type="date" value={tglSlip} onChange={e => setTglSlip(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* 2 · Data Diri */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className={sectionTitle}>2 · Data Diri</p>

            <div className="mb-3">
              <label className={labelCls}>Nama Lengkap</label>
              <input type="text" value={form.nama} onChange={e => setField("nama", e.target.value)} className={inputCls} />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>L/P</label>
                <select value={form.lp} onChange={e => setField("lp", e.target.value)} className={inputCls}>
                  <option>L</option><option>P</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <input type="text" value={form.status} onChange={e => setField("status", e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>Peran</label>
              <input type="text" value={form.peran} onChange={e => setField("peran", e.target.value)} className={inputCls} />
            </div>
            <div className="mb-3">
              <label className={labelCls}>Email</label>
              <input type="text" value={form.email} onChange={e => setField("email", e.target.value)} className={inputCls} />
            </div>
            <div className="mb-3">
              <label className={labelCls}>No. Telp</label>
              <input type="text" value={form.telp} onChange={e => setField("telp", e.target.value)} className={inputCls} />
            </div>
            <div className="mb-3">
              <label className={labelCls}>No. Rekening</label>
              <input type="text" value={form.rekening} onChange={e => setField("rekening", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Atas Nama Rekening</label>
              <input type="text" value={form.atasNama} onChange={e => setField("atasNama", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* 3 · Debet */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className={sectionTitle}>3 · Debet (Pendapatan)</p>
            <LineEditor items={debetItems} setItems={setDebetItems} />
            <button
              type="button"
              onClick={() => setDebetItems(p => [...p, { label: "Item baru", amount: 0 }])}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 transition hover:border-amber-400 hover:text-amber-600 dark:border-slate-600 dark:hover:border-amber-400"
            >
              <Plus size={12} /> Tambah item pendapatan
            </button>
          </div>

          {/* 4 · Kredit */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className={sectionTitle}>4 · Kredit (Potongan / Sudah Dibayar Kantor)</p>
            <LineEditor items={kreditItems} setItems={setKreditItems} />
            <button
              type="button"
              onClick={() => setKreditItems(p => [...p, { label: "Item baru", amount: 0 }])}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 transition hover:border-amber-400 hover:text-amber-600 dark:border-slate-600 dark:hover:border-amber-400"
            >
              <Plus size={12} /> Tambah item potongan
            </button>
          </div>

          {/* Summary + Export */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-700/50">
              <div className="flex justify-between py-1 text-slate-600 dark:text-slate-300">
                <span>Total Debet</span><span>{rupiah(totalDebet)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600 dark:text-slate-300">
                <span>Total Kredit</span><span>{rupiah(totalKredit)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-2 font-bold text-emerald-700 dark:border-slate-600 dark:text-emerald-400">
                <span>Total Diterima</span><span>{rupiah(totalDiterima)}</span>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-600 dark:hover:bg-slate-500"
            >
              {exporting ? (
                <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Memproses...</span>
              ) : (
                <><Download size={16} /> Export PNG</>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">Gambar akan otomatis ter-download ke perangkatmu.</p>
          </div>
        </div>

        {/* ── SLIP PREVIEW ── */}
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div
            ref={slipRef}
            style={{
              width: 760,
              background: S.paper,
              border: "1px solid #e3ddcc",
              padding: "44px 50px 36px",
              fontFamily: "'Inter', system-ui, sans-serif",
              color: S.ink,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${S.navy}`, paddingBottom: 16, marginBottom: 22 }}>
              <div style={{ display: "flex" }}>
                <div style={{ width: 46, height: 46, background: S.navy, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: S.goldSoft, fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                  M
                </div>
                <div style={{ marginLeft: 14 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 700, color: S.navyDeep, letterSpacing: "0.02em" }}>MAGSIKA STUDIO</div>
                  <div style={{ fontSize: 11.5, color: S.gold, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>Digital Visual Studio</div>
                  <div style={{ fontSize: 10.5, color: S.inkSoft, marginTop: 4, maxWidth: 260, lineHeight: 1.4 }}>
                    Omah Joglo Cabean Kulon, Karangduren, Kec. Tengaran, Kabupaten Semarang, Jawa Tengah 50775
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: S.navy, letterSpacing: "0.03em" }}>SLIP GAJI</div>
                <div style={{ fontSize: 12.5, color: S.inkSoft, marginTop: 3 }}>{periodTxt}</div>
              </div>
            </div>

            {/* Employee grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 30px", fontSize: 12.5, marginBottom: 22 }}>
              <div>
                {[
                  ["Nama Lengkap", form.nama],
                  ["L/P", form.lp],
                  ["Status", form.status],
                  ["Peran", form.peran],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dotted #d8d2c2" }}>
                    <span style={{ color: S.inkSoft }}>{k}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "64%" }}>{v || "—"}</span>
                  </div>
                ))}
              </div>
              <div>
                {[
                  ["Email", form.email || "-"],
                  ["No. Telp", form.telp || "-"],
                  ["No. Rekening", form.rekening || "-"],
                  ["Atas Nama", form.atasNama || "-"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dotted #d8d2c2" }}>
                    <span style={{ color: S.inkSoft }}>{k}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "64%" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: 4 }}>
              {/* Debet col */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", paddingBottom: 6, marginBottom: 8, borderBottom: `2px solid ${S.navy}`, color: S.debet }}>Debet</div>
                {debetItems.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4.5px 0", borderBottom: "1px solid #ece7d9" }}>
                    <span>{r.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{rupiah(r.amount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, padding: "8px 0 2px", marginTop: 2, color: S.debet }}>
                  <span>Total Debet</span><span>{rupiah(totalDebet)}</span>
                </div>
              </div>

              {/* Kredit col */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", paddingBottom: 6, marginBottom: 8, borderBottom: `2px solid ${S.navy}`, color: S.kredit }}>Kredit</div>
                {kreditItems.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4.5px 0", borderBottom: "1px solid #ece7d9" }}>
                    <span>{r.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{rupiah(r.amount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, padding: "8px 0 2px", marginTop: 2, color: S.kredit }}>
                  <span>Total Kredit</span><span>{rupiah(totalKredit)}</span>
                </div>
              </div>
            </div>

            {/* Diterima box */}
            <div style={{ marginTop: 20, background: S.navy, borderRadius: 8, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: S.goldSoft, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Total Diterima</span>
              <span style={{ color: "#fff", fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{rupiah(totalDiterima)}</span>
            </div>

            {/* Signature */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 40, fontSize: 12 }}>
              <div style={{ gridColumn: "1 / -1", textAlign: "right", fontSize: 11.5, color: S.inkSoft, marginBottom: 6 }}>{placeDate}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: S.inkSoft, fontSize: 11, marginBottom: 44 }}>Mengetahui<br />Koordinator Studio</div>
                <div style={{ fontWeight: 700, borderTop: `1px solid ${S.ink}`, paddingTop: 6, display: "inline-block", minWidth: 140 }}>Ivo Febrian Pratama</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: S.inkSoft, fontSize: 11, marginBottom: 44 }}>Tim Keuangan</div>
                <div style={{ fontWeight: 700, borderTop: `1px solid ${S.ink}`, paddingTop: 6, display: "inline-block", minWidth: 140 }}>Ivo Febrian Pratama</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: S.inkSoft, fontSize: 11, marginBottom: 44 }}>Penerima</div>
                <div style={{ fontWeight: 700, borderTop: `1px solid ${S.ink}`, paddingTop: 6, display: "inline-block", minWidth: 140 }}>{form.nama}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 26, paddingTop: 12, borderTop: `1px dashed ${S.line}`, fontSize: 10, color: "#a39d8c", textAlign: "center" }}>
              Dokumen ini dibuat secara elektronik oleh Magsika Studio.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
