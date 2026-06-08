export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (monthKey) => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("id-ID", { month: "long", year: "numeric" });
};

export const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

export const monthKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const daysToDeadline = (deadline) => {
  if (!deadline) return null;
  const now = new Date();
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return null;
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
};
