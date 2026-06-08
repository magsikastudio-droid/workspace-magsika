import React, { useState } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { currency, setCurrency, exchangeRate, setExchangeRate } = useCurrency();
  const [rate, setRate] = useState(exchangeRate || 16000);
  const [bankInfo, setBankInfo] = useState({
    nama: "Ivo Febrian Pratama",
    bank: "BCA",
    rekening: "8030651287",
  });

  const handleSaveRate = () => {
    const val = Number(rate);
    if (isNaN(val) || val <= 0) { toast.error("Kurs tidak valid"); return; }
    setExchangeRate(val);
    toast.success("Kurs berhasil disimpan");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Konfigurasi preferensi dashboard.</p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-5">Mata Uang & Kurs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tampilkan Harga Dalam</label>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setCurrency("IDR")} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currency === "IDR" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>IDR</button>
              <button onClick={() => setCurrency("USD")} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currency === "USD" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>USD</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kurs USD → IDR</label>
            <div className="flex gap-2">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                type="number"
                min="1"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400"
              />
              <button onClick={handleSaveRate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                <Save size={14} /> Simpan
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">1 USD = Rp {Number(rate).toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-5">Info Pembayaran (Invoice)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nama Rekening</label>
            <input value={bankInfo.nama} onChange={(e) => setBankInfo((p) => ({ ...p, nama: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bank</label>
            <input value={bankInfo.bank} onChange={(e) => setBankInfo((p) => ({ ...p, bank: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">No. Rekening</label>
            <input value={bankInfo.rekening} onChange={(e) => setBankInfo((p) => ({ ...p, rekening: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => toast.success("Info bank disimpan")} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Save size={14} /> Simpan Info Bank
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-5">Akun & Keamanan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Ganti Password</p>
            <p className="mt-1 text-sm text-slate-500">Untuk mengubah password, gunakan endpoint <code className="rounded bg-slate-200 px-1">/auth/change-password</code> atau hubungi admin.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Versi App</p>
            <p className="mt-1 text-sm text-slate-500">Magsika Studio Dashboard v2.0</p>
            <p className="text-xs text-slate-400 mt-1">Deploy: {new Date().toLocaleDateString("id-ID")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
