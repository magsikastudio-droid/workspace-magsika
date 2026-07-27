import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const DEFAULT_EMPLOYEES = [
  { no:1,  nama:"Ivo Febrian Pratama", lp:"L", status:"Karyawan",       peran:"Koordinator",  email:"iriantamoeta@gmail.com",  telp:"087801822558",  rekening:"DANA 087801822558",      atasNama:"Ivo Febrian Pratama",  gajiPokok:4750000, bonus:0,      dignity:0,      mengajar:0,      kos:300000, makanSiang:0,      komunikasi:0, laundry:0,      bpjs:185000, shu:0 },
  { no:2,  nama:"Novita Rahmawati",    lp:"P", status:"Karyawan",       peran:"Admin",        email:"novitar2115@gmail.com",   telp:"083838221408",  rekening:"SEABANK 901710074772",   atasNama:"Novita Rahmawati",     gajiPokok:2000000, bonus:300000, dignity:0,      mengajar:0,      kos:300000, makanSiang:300000, komunikasi:0, laundry:100000, bpjs:0,      shu:0 },
  { no:3,  nama:"Andre Afandi",        lp:"L", status:"Karyawan",       peran:"3D Artist",    email:"",                        telp:"",              rekening:"",                       atasNama:"Andre Afandi",         gajiPokok:2000000, bonus:0,      dignity:250000, mengajar:500000, kos:0,      makanSiang:300000, komunikasi:0, laundry:300000, bpjs:185000, shu:0 },
  { no:4,  nama:"Kevin Nurrohman",     lp:"L", status:"Karyawan",       peran:"3D Artist",    email:"",                        telp:"",              rekening:"",                       atasNama:"Kevin Nurrohman",      gajiPokok:2000000, bonus:0,      dignity:0,      mengajar:0,      kos:300000, makanSiang:300000, komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:5,  nama:"Hadziq Avi Aqsava",  lp:"L", status:"Magang Sekolah", peran:"3D Artist",    email:"",                        telp:"",              rekening:"",                       atasNama:"Hadziq Avi Aqsava",    gajiPokok:300000,  bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:6,  nama:"Quinsha Athaya",      lp:"P", status:"Magang Sekolah", peran:"Designer",     email:"iriantamoeta@gmail.com",  telp:"087801822558",  rekening:"DANA 087801822558",      atasNama:"Ivo Febrian Pratama",  gajiPokok:300000,  bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:7,  nama:"Faizal Kamal",        lp:"L", status:"Pendamping",     peran:"Utama",        email:"isalkamal@gmail.com",     telp:"081548109036",  rekening:"BCA 8030476957",         atasNama:"Mia Nurul Fadhilah",   gajiPokok:2750000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:8,  nama:"Febru Harsono",       lp:"L", status:"Pendamping",     peran:"Fasilitator",  email:"harsono.febru@gmail.com", telp:"085640071447",  rekening:"BCA 0095395444",         atasNama:"Febru Harsono",        gajiPokok:1500000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:9,  nama:"Husayn Akmal",        lp:"L", status:"Pendamping",     peran:"Teknis",       email:"husaynap@gmail.com",      telp:"082241544629",  rekening:"BCA 0131186001",         atasNama:"Husayn Akmal",         gajiPokok:2000000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:10, nama:"Anis Sasongko",       lp:"L", status:"Pendamping",     peran:"Strategis",    email:"sasongkoanis@gmail.com",  telp:"082241544629",  rekening:"BCA 8360012841",         atasNama:"Anis Sasongko",        gajiPokok:2000000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:11, nama:"Joko Sasongko",       lp:"L", status:"Pendamping",     peran:"Advisor",      email:"iliksas@gmail.com",       telp:"081222261921",  rekening:"BCA 0095123321",         atasNama:"Ririn Narulita",       gajiPokok:2000000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
  { no:12, nama:"Sunarsih",            lp:"P", status:"Pendamping",     peran:"Fasilitator",  email:"asihazr@gmail.com",       telp:"089636787944",  rekening:"DANA 083894556407",      atasNama:"Sunarsih",             gajiPokok:1000000, bonus:0,      dignity:0,      mengajar:0,      kos:0,      makanSiang:0,      komunikasi:0, laundry:0,      bpjs:0,      shu:0 },
];

const EMPTY_EMP = { nama:"", lp:"L", status:"Karyawan", peran:"", email:"", telp:"", rekening:"", atasNama:"", gajiPokok:0, bonus:0, dignity:0, mengajar:0, kos:0, makanSiang:0, komunikasi:0, laundry:0, bpjs:0, shu:0 };

function rupiah(n) {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

function buildDebet(emp) {
  return [
    { label:"Gaji Pokok",                  amount: emp.gajiPokok },
    { label:"Bonus",                        amount: emp.bonus },
    { label:"Komisi",                       amount: 0 },
    { label:"Lembur",                       amount: 0 },
    { label:"Tunjangan Kos",               amount: emp.kos },
    { label:"Tunjangan Makan Siang",       amount: emp.makanSiang },
    { label:"Tunjangan Komunikasi",        amount: emp.komunikasi },
    { label:"Tunjangan Laundry/Transport", amount: emp.laundry },
    { label:"Dignity",                      amount: emp.dignity },
    { label:"Mengajar",                     amount: emp.mengajar },
    { label:"SHU",                          amount: emp.shu },
  ].filter(r => r.amount > 0 || ["Gaji Pokok","Bonus","Komisi","Lembur"].includes(r.label));
}

function buildKredit(emp) {
  return [
    { label:"Subsidi Kos (sudah dibayar kantor)", amount: 0 },
    { label:"BPJS (ditanggung kantor)",            amount: emp.bpjs },
  ].filter(r => r.amount > 0 || r.label.startsWith("Subsidi"));
}

function LineEditor({ items, setItems }) {
  const update = (idx, field, val) =>
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "amount" ? (parseFloat(val) || 0) : val };
      return next;
    });
  const remove = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="text"
            value={item.label}
            onChange={e => update(idx, "label", e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-violet-500"
          />
          <input
            type="number"
            value={item.amount || ""}
            onChange={e => update(idx, "amount", e.target.value)}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-400 transition hover:bg-rose-100 dark:bg-rose-900/30"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ number, title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
          {number}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:border-violet-500";
const labelCls = "mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400";

export default function SlipGaji() {
  const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
  const [empIdx, setEmpIdx]       = useState(0);
  const [bulan, setBulan]         = useState(new Date().getMonth());
  const [tahun, setTahun]         = useState(String(new Date().getFullYear()));
  const [tglSlip, setTglSlip]     = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm]           = useState({ nama:"", lp:"L", status:"", peran:"", email:"", telp:"", rekening:"", atasNama:"" });
  const [debetItems, setDebetItems] = useState([]);
  const [kreditItems, setKreditItems] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Add-employee panel state
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp]   = useState(EMPTY_EMP);

  const slipRef = useRef(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadEmployeeFrom = (idx, list) => {
    const emp = list[idx];
    if (!emp) return;
    setForm({
      nama: emp.nama, lp: emp.lp || "L", status: emp.status || "",
      peran: emp.peran || "", email: emp.email || "", telp: emp.telp || "",
      rekening: emp.rekening || "", atasNama: emp.atasNama || emp.nama,
    });
    setDebetItems(buildDebet(emp));
    setKreditItems(buildKredit(emp));
  };

  useEffect(() => { loadEmployeeFrom(0, DEFAULT_EMPLOYEES); }, []);

  const handleSelectEmployee = (idx) => {
    setEmpIdx(idx);
    loadEmployeeFrom(idx, employees);
  };

  const handleAddEmployee = () => {
    if (!newEmp.nama.trim()) return toast.error("Nama wajib diisi");
    const emp = { ...newEmp, no: employees.length + 1, atasNama: newEmp.atasNama || newEmp.nama };
    const next = [...employees, emp];
    setEmployees(next);
    const idx = next.length - 1;
    setEmpIdx(idx);
    loadEmployeeFrom(idx, next);
    setShowAdd(false);
    setNewEmp(EMPTY_EMP);
    toast.success(`${emp.nama} ditambahkan!`);
  };

  const handleDeleteEmployee = () => {
    if (employees.length <= 1) return toast.error("Minimal harus ada 1 anggota tim");
    const name = employees[empIdx]?.nama;
    const next = employees.filter((_, i) => i !== empIdx);
    setEmployees(next);
    const newIdx = Math.min(empIdx, next.length - 1);
    setEmpIdx(newIdx);
    loadEmployeeFrom(newIdx, next);
    toast.success(`${name} dihapus dari daftar`);
  };

  const totalDebet  = debetItems.reduce((s, r)  => s + (Number(r.amount) || 0), 0);
  const totalKredit = kreditItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDiterima = totalDebet - totalKredit;

  const bulanTxt  = BULAN[bulan];
  const periodTxt = `${bulanTxt} ${tahun}`;
  const placeDate = (() => {
    if (!tglSlip) return "";
    const d = new Date(tglSlip + "T00:00:00");
    return `Kab. Semarang, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const handleExport = async () => {
    setExporting(true);
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        backgroundColor: "#fbfaf7",
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Force Arial on every element so spaces render correctly across all systems
          clonedDoc.querySelectorAll("[data-slip] *").forEach(el => {
            el.style.fontFamily = "Arial, sans-serif";
          });
        },
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

  // Slip color palette
  const S = {
    navy:     "#16233f",
    navyDeep: "#0d1729",
    gold:     "#b8894a",
    goldSoft: "#e4c9a3",
    paper:    "#fbfaf7",
    ink:      "#1c2333",
    inkSoft:  "#5b6478",
    line:     "#dcd6c9",
    debet:    "#2f5233",
    kredit:   "#8a3324",
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-900">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Generator Slip Gaji</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Pilih anggota tim, sesuaikan data dan nominal, lalu export ke PNG.
        </p>
      </div>

      <div className="flex gap-6" style={{ alignItems: "start" }}>

        {/* ════════ FORM PANEL ════════ */}
        <div className="w-[370px] shrink-0 space-y-4">

          {/* SECTION 1 — Orang & Periode */}
          <SectionCard number="1" title="Pilih Orang & Periode">
            {/* Employee select + add/delete */}
            <div className="mb-3">
              <label className={labelCls}>Anggota Tim</label>
              <div className="flex gap-2">
                <select
                  value={empIdx}
                  onChange={e => handleSelectEmployee(+e.target.value)}
                  className={inputCls + " flex-1"}
                >
                  {employees.map((emp, i) => (
                    <option key={i} value={i}>{emp.nama} — {emp.peran}</option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Tambah anggota baru"
                  onClick={() => setShowAdd(v => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 transition hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                >
                  {showAdd ? <ChevronUp size={15} /> : <Plus size={15} />}
                </button>
                <button
                  type="button"
                  title="Hapus anggota ini"
                  onClick={handleDeleteEmployee}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Add employee form (collapsible) */}
            {showAdd && (
              <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                <p className="mb-3 text-xs font-bold text-violet-700 dark:text-violet-300">Tambah Anggota Tim Baru</p>
                <div className="space-y-2">
                  <div>
                    <label className={labelCls}>Nama Lengkap *</label>
                    <input type="text" value={newEmp.nama} onChange={e => setNewEmp(p => ({...p, nama: e.target.value}))} className={inputCls} placeholder="Nama lengkap" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>L/P</label>
                      <select value={newEmp.lp} onChange={e => setNewEmp(p => ({...p, lp: e.target.value}))} className={inputCls}>
                        <option>L</option><option>P</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <input type="text" value={newEmp.status} onChange={e => setNewEmp(p => ({...p, status: e.target.value}))} className={inputCls} placeholder="Karyawan" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Peran</label>
                    <input type="text" value={newEmp.peran} onChange={e => setNewEmp(p => ({...p, peran: e.target.value}))} className={inputCls} placeholder="3D Artist, Admin, dll." />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={newEmp.email} onChange={e => setNewEmp(p => ({...p, email: e.target.value}))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>No. Telp</label>
                    <input type="text" value={newEmp.telp} onChange={e => setNewEmp(p => ({...p, telp: e.target.value}))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Rekening</label>
                    <input type="text" value={newEmp.rekening} onChange={e => setNewEmp(p => ({...p, rekening: e.target.value}))} className={inputCls} placeholder="BCA 1234567890" />
                  </div>
                  <div>
                    <label className={labelCls}>Atas Nama Rekening</label>
                    <input type="text" value={newEmp.atasNama} onChange={e => setNewEmp(p => ({...p, atasNama: e.target.value}))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      ["Gaji Pokok","gajiPokok"],["Bonus","bonus"],["Tunjangan Kos","kos"],
                      ["Makan Siang","makanSiang"],["Komunikasi","komunikasi"],["Laundry/Transport","laundry"],
                      ["Dignity","dignity"],["Mengajar","mengajar"],["BPJS","bpjs"],["SHU","shu"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <input
                          type="number"
                          value={newEmp[key] || ""}
                          onChange={e => setNewEmp(p => ({...p, [key]: parseFloat(e.target.value)||0}))}
                          className={inputCls + " text-right"}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddEmployee}
                      className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                    >
                      Tambahkan
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setNewEmp(EMPTY_EMP); }}
                      className="rounded-lg border border-slate-200 px-3 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Periode */}
            <div className="grid grid-cols-2 gap-3 mb-3">
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
          </SectionCard>

          {/* SECTION 2 — Data Diri */}
          <SectionCard number="2" title="Data Diri">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nama Lengkap</label>
                <input type="text" value={form.nama} onChange={e => setField("nama", e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className={labelCls}>Peran</label>
                <input type="text" value={form.peran} onChange={e => setField("peran", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="text" value={form.email} onChange={e => setField("email", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>No. Telp</label>
                <input type="text" value={form.telp} onChange={e => setField("telp", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>No. Rekening</label>
                <input type="text" value={form.rekening} onChange={e => setField("rekening", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Atas Nama Rekening</label>
                <input type="text" value={form.atasNama} onChange={e => setField("atasNama", e.target.value)} className={inputCls} />
              </div>
            </div>
          </SectionCard>

          {/* SECTION 3 — Debet */}
          <SectionCard number="3" title="Debet (Pendapatan)">
            <LineEditor items={debetItems} setItems={setDebetItems} />
            <button
              type="button"
              onClick={() => setDebetItems(p => [...p, { label:"Item baru", amount:0 }])}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 transition hover:border-violet-400 hover:text-violet-500 dark:border-slate-600"
            >
              <Plus size={12} /> Tambah item pendapatan
            </button>
          </SectionCard>

          {/* SECTION 4 — Kredit */}
          <SectionCard number="4" title="Kredit (Potongan / Dibayar Kantor)">
            <LineEditor items={kreditItems} setItems={setKreditItems} />
            <button
              type="button"
              onClick={() => setKreditItems(p => [...p, { label:"Item baru", amount:0 }])}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 transition hover:border-violet-400 hover:text-violet-500 dark:border-slate-600"
            >
              <Plus size={12} /> Tambah item potongan
            </button>
          </SectionCard>

          {/* Summary + Export */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 divide-y divide-slate-100 rounded-xl bg-slate-50 px-4 py-0.5 dark:divide-slate-700 dark:bg-slate-700/40">
              <div className="flex justify-between py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span>Total Debet</span><span className="font-medium text-emerald-700 dark:text-emerald-400">{rupiah(totalDebet)}</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span>Total Kredit</span><span className="font-medium text-rose-600 dark:text-rose-400">{rupiah(totalKredit)}</span>
              </div>
              <div className="flex justify-between py-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                <span>Total Diterima</span><span className="text-emerald-700 dark:text-emerald-400">{rupiah(totalDiterima)}</span>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {exporting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Memproses...</>
              ) : (
                <><Download size={16} /> Export PNG</>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">Gambar otomatis ter-download ke perangkatmu.</p>
          </div>
        </div>

        {/* ════════ SLIP PREVIEW ════════ */}
        <div style={{ flex: 1, overflowX: "auto", paddingBottom: 8 }}>
          <div
            ref={slipRef}
            data-slip
            style={{
              position: "relative",
              width: 760,
              background: S.paper,
              border: "1px solid #e3ddcc",
              fontFamily: "Arial, sans-serif",
              color: S.ink,
              fontSize: 13,
              lineHeight: 1.5,
              overflow: "hidden",
            }}
          >
            {/* ── Watermark — behind all content ── */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/watermark-magsika.png')",
              backgroundSize: "100% auto",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top left",
              opacity: 0.05,
              zIndex: 0,
              pointerEvents: "none",
            }} />

            {/* ── Slip content — above watermark; solid backgrounds cover it ── */}
            <div style={{ position: "relative", zIndex: 1, padding: "44px 50px 36px", fontFamily: "Arial, sans-serif" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:`3px solid ${S.navy}`, paddingBottom:16, marginBottom:22 }}>
                <div>
                  <img
                    src="/logo.png"
                    alt="Magsika Studio"
                    crossOrigin="anonymous"
                    style={{ height:38, display:"block", mixBlendMode:"multiply" }}
                  />
                  <div style={{ fontSize:10, color:S.gold, letterSpacing:"0.08em", textTransform:"uppercase", marginTop:6 }}>
                    Digital Visual Studio
                  </div>
                  <div style={{ fontSize:9.5, color:S.inkSoft, marginTop:3, maxWidth:280, lineHeight:1.4 }}>
                    Omah Joglo Cabean Kulon, Karangduren, Kec. Tengaran, Kab. Semarang, Jawa Tengah 50775
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Georgia, serif", fontSize:16, fontWeight:700, color:S.navy, letterSpacing:"0.04em" }}>
                    SLIP GAJI
                  </div>
                  <div style={{ fontSize:12.5, color:S.inkSoft, marginTop:4 }}>{periodTxt}</div>
                </div>
              </div>

              {/* Employee info grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 30px", fontSize:12.5, marginBottom:22 }}>
                {[
                  ["Nama Lengkap", form.nama],
                  ["L/P",          form.lp],
                  ["Status",       form.status],
                  ["Peran",        form.peran],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px dotted #d8d2c2" }}>
                    <span style={{ color:S.inkSoft }}>{k}</span>
                    <span style={{ fontWeight:600, textAlign:"right", maxWidth:"62%" }}>{v || "—"}</span>
                  </div>
                ))}
                {[
                  ["Email",        form.email || "-"],
                  ["No. Telp",     form.telp || "-"],
                  ["No. Rekening", form.rekening || "-"],
                  ["Atas Nama",    form.atasNama || "-"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px dotted #d8d2c2" }}>
                    <span style={{ color:S.inkSoft }}>{k}</span>
                    <span style={{ fontWeight:600, textAlign:"right", maxWidth:"62%" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Ledger */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:22, marginBottom:4 }}>
                {/* Debet */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", paddingBottom:6, marginBottom:8, borderBottom:`2px solid ${S.navy}`, color:S.debet }}>
                    Debet
                  </div>
                  {debetItems.map((r, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"4.5px 0", borderBottom:"1px solid #ece7d9" }}>
                      <span>{r.label}</span>
                      <span style={{ fontVariantNumeric:"tabular-nums" }}>{rupiah(r.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, fontWeight:700, padding:"8px 0 2px", marginTop:2, color:S.debet }}>
                    <span>Total Debet</span><span>{rupiah(totalDebet)}</span>
                  </div>
                </div>
                {/* Kredit */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", paddingBottom:6, marginBottom:8, borderBottom:`2px solid ${S.navy}`, color:S.kredit }}>
                    Kredit
                  </div>
                  {kreditItems.map((r, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"4.5px 0", borderBottom:"1px solid #ece7d9" }}>
                      <span>{r.label}</span>
                      <span style={{ fontVariantNumeric:"tabular-nums" }}>{rupiah(r.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, fontWeight:700, padding:"8px 0 2px", marginTop:2, color:S.kredit }}>
                    <span>Total Kredit</span><span>{rupiah(totalKredit)}</span>
                  </div>
                </div>
              </div>

              {/* Diterima box */}
              <div style={{ marginTop:20, background:S.navy, borderRadius:8, padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16 }}>
                <span style={{ color:S.goldSoft, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700, flexShrink:0 }}>
                  TOTAL DITERIMA
                </span>
                <span style={{ color:"#fff", fontFamily:"Arial, sans-serif", fontSize:22, fontWeight:800, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap", letterSpacing:"-0.01em" }}>
                  {rupiah(totalDiterima)}
                </span>
              </div>

              {/* Signature */}
              <div style={{ marginTop:36 }}>
                <div style={{ textAlign:"right", fontSize:11, color:S.inkSoft, marginBottom:20 }}>{placeDate}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, fontSize:12 }}>

                  {/* Koordinator */}
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:S.inkSoft, fontSize:11, marginBottom:6, lineHeight:1.5 }}>
                      Mengetahui<br />Koordinator Studio
                    </div>
                    <img
                      src="/ttdstempel2.png"
                      alt="TTD Koordinator"
                      crossOrigin="anonymous"
                      style={{ height:72, display:"block", margin:"0 auto 2px", mixBlendMode:"multiply" }}
                    />
                    <div style={{ fontWeight:700, borderTop:`1px solid ${S.ink}`, paddingTop:6, display:"inline-block", minWidth:140 }}>
                      Ivo Febrian Pratama
                    </div>
                  </div>

                  {/* Tim Keuangan */}
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:S.inkSoft, fontSize:11, marginBottom:6, lineHeight:1.5 }}>
                      Tim Keuangan
                    </div>
                    <img
                      src="/ttd.png"
                      alt="TTD Keuangan"
                      crossOrigin="anonymous"
                      style={{ height:72, display:"block", margin:"0 auto 2px", mixBlendMode:"multiply" }}
                    />
                    <div style={{ fontWeight:700, borderTop:`1px solid ${S.ink}`, paddingTop:6, display:"inline-block", minWidth:140 }}>
                      Ivo Febrian Pratama
                    </div>
                  </div>

                  {/* Penerima */}
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:S.inkSoft, fontSize:11, marginBottom:6, lineHeight:1.5 }}>
                      Penerima
                    </div>
                    <div style={{ height:72 }} />
                    <div style={{ fontWeight:700, borderTop:`1px solid ${S.ink}`, paddingTop:6, display:"inline-block", minWidth:140 }}>
                      {form.nama}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <div style={{ marginTop:24, paddingTop:10, borderTop:`1px dashed ${S.line}`, fontSize:9.5, color:"#a39d8c", textAlign:"center" }}>
                Dokumen ini dibuat secara elektronik oleh Magsika Studio.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
