export const STATUS_OPTIONS = [
  "Pending",
  "Need Designer",
  "Modeling",
  "Teksturing",
  "Cut & Key",
  "Waiting File",
  "Articulate",
  "Revisi",
  "Rigging",
  "Ready to Send",
  "Rendering",
  "Coloring 3D Print",
  "Animation",
  "Waiting Feedback",
  "Delivered",
  "Done",
  "Cancel",
];

export const ACTIVE_STATUSES = STATUS_OPTIONS.filter(
  (s) => s !== "Done" && s !== "Cancel"
);

export const STATUS_COLORS = {
  "Pending":           { bg: "#fef3c7", text: "#b45309" },
  "Need Designer":     { bg: "#ede9fe", text: "#6d28d9" },
  "Modeling":          { bg: "#dbeafe", text: "#1d4ed8" },
  "Teksturing":        { bg: "#e0f2fe", text: "#0369a1" },
  "Cut & Key":         { bg: "#f0fdf4", text: "#15803d" },
  "Waiting File":      { bg: "#fef9c3", text: "#a16207" },
  "Articulate":        { bg: "#fce7f3", text: "#be185d" },
  "Revisi":            { bg: "#fee2e2", text: "#b91c1c" },
  "Rigging":           { bg: "#ffedd5", text: "#c2410c" },
  "Ready to Send":     { bg: "#dcfce7", text: "#15803d" },
  "Rendering":         { bg: "#e0e7ff", text: "#3730a3" },
  "Coloring 3D Print": { bg: "#fdf4ff", text: "#7e22ce" },
  "Animation":         { bg: "#ecfdf5", text: "#065f46" },
  "Waiting Feedback":  { bg: "#fef3c7", text: "#92400e" },
  "Delivered":         { bg: "#d1fae5", text: "#065f46" },
  "Done":              { bg: "#dcfce7", text: "#166534" },
  "Cancel":            { bg: "#f1f5f9", text: "#64748b" },
};

export const PLATFORM_OPTIONS = [
  "Fiverr Magsika",
  "Fiverr Eirene",
  "Etsy Lolicharm",
  "Direct",
  "Komunitas",
];

export const PLATFORM_CODES = {
  "Fiverr Magsika":  "FVR-MGSK",
  "Fiverr Eirene":   "FVR-EIRE",
  "Etsy Lolicharm":  "ETY-LOLI",
  "Direct":          "DIR",
  "Komunitas":       "KOM",
};

export const PLATFORM_COLORS = {
  "Fiverr Magsika":  "#10b981",
  "Fiverr Eirene":   "#06b6d4",
  "Etsy Lolicharm":  "#a855f7",
  "Direct":          "#0ea5e9",
  "Komunitas":       "#f97316",
};

export const MARKET_OPTIONS = ["Magsika", "Eirene", "Lolicharm"];

export const WORK_TYPE_OPTIONS = [
  "Modeling",
  "Print",
  "Roblox",
  "Game Asset",
  "Vroid",
  "Mask",
  "Rigging",
  "Animation",
  "AR Vtuber",
  "Paid Consultation",
];

export const MARKETER_OPTIONS = ["Ivo", "Novita", "Lainnya"];

export const PAYMENT_OPTIONS = ["Belum Lunas", "DP", "Lunas"];

export const PAYMENT_COLORS = {
  "Lunas":       { bg: "#dcfce7", text: "#166534" },
  "DP":          { bg: "#fef9c3", text: "#a16207" },
  "Belum Lunas": { bg: "#fee2e2", text: "#b91c1c" },
};

export const ARTIST_COLORS = {
  Default: "#0f172a",
};

export function getArtistColor(name) {
  const palette = [
    "#2563eb", "#ea580c", "#10b981", "#8b5cf6",
    "#ec4899", "#f59e0b", "#06b6d4", "#84cc16",
  ];
  if (!name) return ARTIST_COLORS.Default;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function generateFolderCode(platform, market, artist, workType, date) {
  const d = date ? new Date(date) : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;

  const marketMap = {
    "Magsika": "MGSK",
    "Eirene":  "EIRE",
    "Lolicharm": "LOLI",
  };
  const marketCode = marketMap[market] || market?.slice(0, 4).toUpperCase() || "MGSK";

  const artistCode = artist ? artist.slice(0, 4).toUpperCase() : "TEAM";

  const workMap = {
    "Modeling": "MDL",
    "Print": "PRT",
    "Roblox": "RBX",
    "Game Asset": "GME",
    "Vroid": "VRD",
    "Mask": "MSK",
    "Rigging": "RIG",
    "Animation": "ANM",
    "AR Vtuber": "ARV",
    "Paid Consultation": "CON",
  };
  const workCode = workMap[workType] || workType?.slice(0, 3).toUpperCase() || "MDL";

  return `${dateStr}-${marketCode}01-${artistCode}-${workCode}`;
}
