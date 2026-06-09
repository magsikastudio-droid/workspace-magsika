import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Zap, Target, Edit3, Save, X, Plus, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, Calendar, TrendingUp, Users, Layers, Star, ArrowRight,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

/* ─── default templates ────────────────────────────────────────────── */
const DEFAULTS = {
  teknis: {
    title: "Rencana Teknis",
    subtitle: "Pipeline, tools, dan standar kualitas produksi",
    accent: "from-indigo-600 to-violet-600",
    sections: [
      {
        id: "visi",
        title: "Visi & Misi Teknis",
        icon: "star",
        content: "Menjadi studio 3D dengan pipeline produksi yang efisien, konsisten, dan scalable untuk mendukung pertumbuhan bisnis jangka panjang.",
      },
      {
        id: "stack",
        title: "Stack & Tools",
        icon: "layers",
        content: "• Blender — modeling, rigging, rendering\n• Marvelous Designer — cloth simulation\n• Substance Painter — texturing\n• ZBrush — high-poly sculpting\n• Krita / Photoshop — concept & texture painting\n• GitHub — version control aset",
      },
      {
        id: "pipeline",
        title: "Pipeline Produksi",
        icon: "zap",
        content: "1. Brief & Referensi → review dengan client\n2. Blockout / Low-poly base\n3. High-poly sculpt (jika diperlukan)\n4. Retopology & UV Unwrap\n5. Rigging & Weighting\n6. Texturing (PBR workflow)\n7. Internal QC → revisi\n8. Final delivery → feedback client\n9. Arsip aset ke folder sistem",
      },
      {
        id: "kualitas",
        title: "Standar Kualitas",
        icon: "check",
        content: "• Poly count: sesuai brief (game-ready / VRC / cinematic)\n• Naming convention: {folderCode}_{assetName}_{version}\n• Format delivery: FBX + blend file + textures (ZIP)\n• Preview render wajib sebelum delivery\n• Revisi gratis: sesuai kesepakatan brief awal",
      },
      {
        id: "roadmap",
        title: "Roadmap Teknis",
        icon: "calendar",
        content: "Q1: Standarisasi naming convention & folder struktur\nQ2: Template rigging library untuk VRChat avatar\nQ3: Internal tool otomasi export/delivery\nQ4: Evaluasi pipeline & update SOP tahunan",
      },
      {
        id: "kpi",
        title: "KPI Teknis",
        icon: "trending",
        content: "• Rata-rata waktu pengerjaan per asset type\n• Tingkat revisi per order (target: < 1.5x)\n• On-time delivery rate (target: ≥ 85%)\n• Jumlah template & aset reusable yang dibuat\n• Bug / error post-delivery (target: 0)",
      },
    ],
  },
  market: {
    title: "Rencana Market",
    subtitle: "Strategi pemasaran, target audiens, dan pertumbuhan bisnis",
    accent: "from-rose-500 to-orange-500",
    sections: [
      {
        id: "visi",
        title: "Visi & Posisi Pasar",
        icon: "star",
        content: "Magsika Studio menjadi studio 3D karakter pilihan utama untuk komunitas VTuber dan game indie di Asia Tenggara, dikenal dengan kualitas konsisten dan komunikasi profesional.",
      },
      {
        id: "audiens",
        title: "Target Audiens",
        icon: "users",
        content: "Segmen Utama:\n• VTuber (indie & agency) — avatar 3D, rigging, outfit\n• Game developer indie — karakter game-ready\n• Brand / perusahaan — mascot & karakter IP\n\nSegmen Sekunder:\n• Animator & kreator konten 3D\n• Komunitas furry / VRChat",
      },
      {
        id: "platform",
        title: "Platform & Channel",
        icon: "layers",
        content: "Aktif:\n• Twitter / X — showcase karya, engagement komunitas\n• Skeb / Ko-fi — commission platform internasional\n• Discord — client communication & update\n\nTarget Pengembangan:\n• Instagram — portfolio visual\n• YouTube / TikTok — timelapse / process video\n• ArtStation — professional portfolio",
      },
      {
        id: "pricing",
        title: "Pricing Strategy",
        icon: "trending",
        content: "Tier 1 — Base Model: Rp 1.5jt – 3jt\nTier 2 — Full Outfit + Rigging: Rp 3jt – 7jt\nTier 3 — Full VTuber Package: Rp 7jt – 15jt\n\nAdd-on: Toggle outfit, expression blendshape, dynamic physics\nDiskon: Returning client 10%, referral 5%",
      },
      {
        id: "target",
        title: "Target Revenue & Growth",
        icon: "zap",
        content: "Target Bulanan: 8–12 order aktif\nTarget Revenue: Rp 30jt – 60jt / bulan\n\nGrowth Strategy:\n• Referral program: client lama recommend → diskon keduanya\n• Waitlist prestige: slot terbatas untuk kontrol kualitas\n• Bundle package: model + rigging + accessories\n• Seasonal promo: lebaran, akhir tahun, anniversary",
      },
      {
        id: "kpi",
        title: "KPI Marketing",
        icon: "check",
        content: "• Jumlah order baru per bulan (target: 8+)\n• Repeat client rate (target: ≥ 30%)\n• Referral order rate (target: ≥ 20%)\n• Social media impressions per post\n• Response time rata-rata brief → quote (target: < 24 jam)\n• Tingkat konversi inquiry → order (target: ≥ 50%)",
      },
    ],
  },
};

const ICONS = {
  star: Star, layers: Layers, zap: Zap, check: CheckCircle2,
  calendar: Calendar, trending: TrendingUp, users: Users, target: Target,
};

/* ─── main page ─────────────────────────────────────────────────────── */
export default function RencanaStrategis() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const planType = type === "market" ? "market" : "teknis";
  const def = DEFAULTS[planType];

  const [sections, setSections] = useState(def.sections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ title: "", content: "" });
  const [lastUpdated, setLastUpdated] = useState("");
  const [updatedBy, setUpdatedBy] = useState("");

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/strategic-plan/${planType}`);
      if (res.data?.plan?.sections?.length) {
        setSections(res.data.plan.sections);
        setLastUpdated(res.data.plan.updated_at || "");
        setUpdatedBy(res.data.plan.updated_by || "");
      } else {
        setSections(def.sections);
      }
    } catch {
      setSections(def.sections);
    } finally {
      setLoading(false);
    }
  }, [planType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const savePlan = async (nextSections) => {
    setSaving(true);
    try {
      await api.put(`/strategic-plan/${planType}`, { sections: nextSections });
      setSections(nextSections);
      setLastUpdated(new Date().toISOString());
      setUpdatedBy(user?.full_name || "");
      toast.success("Rencana disimpan.");
    } catch {
      toast.error("Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = (id, updated) => {
    const next = sections.map((s) => s.id === id ? { ...s, ...updated } : s);
    savePlan(next);
    setEditingId(null);
  };

  const handleDeleteSection = (id) => {
    if (!window.confirm("Hapus section ini?")) return;
    savePlan(sections.filter((s) => s.id !== id));
  };

  const handleAddSection = () => {
    if (!newSection.title.trim()) return;
    const id = `section_${Date.now()}`;
    savePlan([...sections, { id, icon: "check", ...newSection }]);
    setNewSection({ title: "", content: "" });
    setAddingSection(false);
  };

  const timeAgo = (iso) => {
    if (!iso) return "";
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return "baru saja";
    if (d < 3600) return `${Math.floor(d / 60)}m lalu`;
    if (d < 86400) return `${Math.floor(d / 3600)}j lalu`;
    return `${Math.floor(d / 86400)}h lalu`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className={`rounded-3xl bg-gradient-to-br ${def.accent} p-7 text-white shadow-xl`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-xl bg-white/20 px-3 py-1 text-xs font-semibold tracking-widest uppercase">
                Strategi
              </span>
              <button
                onClick={() => navigate(planType === "teknis" ? "/rencana/market" : "/rencana/teknis")}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 transition"
              >
                {planType === "teknis" ? "→ Market" : "→ Teknis"}
              </button>
            </div>
            <h1 className="text-3xl font-black tracking-tight">{def.title}</h1>
            <p className="mt-1 text-sm text-white/70">{def.subtitle}</p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-white/50">
                Diperbarui {timeAgo(lastUpdated)}{updatedBy ? ` oleh ${updatedBy}` : ""}
              </p>
            )}
          </div>
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20`}>
            {planType === "teknis"
              ? <Zap size={24} className="text-white" />
              : <Target size={24} className="text-white" />
            }
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => navigate("/rencana/teknis")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              planType === "teknis" ? "bg-white text-indigo-700" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            <Zap size={14} /> Rencana Teknis
          </button>
          <button
            onClick={() => navigate("/rencana/market")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              planType === "market" ? "bg-white text-rose-600" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            <Target size={14} /> Rencana Market
          </button>
        </div>
      </div>

      {/* Sections */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
          <p className="mt-3 text-sm text-slate-400">Memuat rencana...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isAdmin={isAdmin}
              editingId={editingId}
              onStartEdit={() => setEditingId(section.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(updated) => handleSaveSection(section.id, updated)}
              onDelete={() => handleDeleteSection(section.id)}
              planType={planType}
            />
          ))}

          {/* Add section */}
          {isAdmin && (
            <div>
              {addingSection ? (
                <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-5">
                  <p className="mb-3 text-sm font-bold text-indigo-700">Section Baru</p>
                  <input
                    value={newSection.title}
                    onChange={(e) => setNewSection((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Judul section..."
                    className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-300"
                    autoFocus
                  />
                  <textarea
                    value={newSection.content}
                    onChange={(e) => setNewSection((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Isi section..."
                    rows={4}
                    className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 resize-y font-mono"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddSection} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                      <Save size={13} /> Tambah
                    </button>
                    <button onClick={() => { setAddingSection(false); setNewSection({ title: "", content: "" }); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSection(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition"
                >
                  <Plus size={16} /> Tambah Section
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SectionCard ───────────────────────────────────────────────────── */
function SectionCard({ section, isAdmin, editingId, onStartEdit, onCancelEdit, onSave, onDelete, planType }) {
  const [draft, setDraft] = useState({ title: section.title, content: section.content });
  const [expanded, setExpanded] = useState(true);

  const isEditing = editingId === section.id;
  const IconComp = ICONS[section.icon] || CheckCircle2;

  const accentColor = planType === "teknis"
    ? { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" }
    : { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" };

  const handleSave = () => {
    if (!draft.title.trim()) return;
    onSave({ title: draft.title, content: draft.content });
  };

  useEffect(() => {
    setDraft({ title: section.title, content: section.content });
  }, [section.title, section.content]);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition`}>
      {/* Card header */}
      <div
        className={`flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 transition ${!isEditing ? "" : "bg-slate-50"}`}
        onClick={!isEditing ? () => setExpanded((v) => !v) : undefined}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentColor.bg} ${accentColor.border} border`}>
          <IconComp size={16} className={accentColor.text} />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400"
            />
          ) : (
            <p className="font-bold text-slate-900">{section.title}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && !isEditing && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setDraft({ title: section.title, content: section.content }); onStartEdit(); setExpanded(true); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {isEditing ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition" title="Simpan">
                <Save size={13} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onCancelEdit(); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition" title="Batal">
                <X size={13} />
              </button>
            </>
          ) : (
            <span className={`text-slate-300 ml-1`}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          )}
        </div>
      </div>

      {/* Card content */}
      {expanded && (
        <div className={`px-6 pb-5 border-t border-slate-50`}>
          {isEditing ? (
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
              rows={8}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-300 resize-y font-mono leading-relaxed"
            />
          ) : (
            <div className="mt-4 space-y-1">
              {section.content.split("\n").map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-2" />;
                const isBullet = line.startsWith("•") || line.startsWith("-");
                const isNumber = /^\d+\./.test(line.trim());
                const isHeader = line.includes(":") && line.indexOf(":") < 20 && !line.startsWith("•");
                return (
                  <div key={i} className={`flex gap-2 ${isBullet || isNumber ? "items-start" : ""}`}>
                    {isBullet && (
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${planType === "teknis" ? "bg-indigo-400" : "bg-rose-400"}`} />
                    )}
                    <p className={`text-sm leading-relaxed ${
                      isHeader && !isBullet
                        ? "font-bold text-slate-700"
                        : "text-slate-600"
                    } ${isBullet ? "ml-0" : ""}`}>
                      {isBullet ? line.slice(1).trim() : line}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
