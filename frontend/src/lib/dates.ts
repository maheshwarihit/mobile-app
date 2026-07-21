/** Date/time helpers. Storage & transport are UTC ISO 8601; display is local. */

export function formatLocalDateTime(utc: string | null | undefined): string {
  if (!utc) return "—";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  // date-only strings ("YYYY-MM-DD") — render without TZ shifting.
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** "13:45:00" or "13:45" → "01:45 PM" */
export function formatSlot(slot: string | null | undefined): string {
  if (!slot) return "—";
  const [hh, mm] = slot.split(":");
  const h = Number(hh);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${mm} ${suffix}`;
}

export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** end date of a consecutive multi-day booking (GO-6) */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Math.max(0, days - 1));
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
