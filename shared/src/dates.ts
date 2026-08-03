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

/** Time-of-day only, e.g. "01:09 PM" — used alongside a shared date heading
 *  (groupByLocalDate) where the date itself is no longer repeated per item. */
export function formatLocalTime(utc: string | null | undefined): string {
  if (!utc) return "—";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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

/**
 * Compose a 12-hour picker (hour 1–12 + minute + AM/PM) into a 24-hour "HH:MM"
 * string for storage/validation. Inverse of formatSlot(). The caller is
 * responsible for validating the result against timeSlots() / the DB window.
 */
export function combineTime(h12: number, minute: number, meridiem: "AM" | "PM"): string {
  let h24 = h12 % 12; // 12 → 0
  if (meridiem === "PM") h24 += 12; // 12 PM → 12, 1 PM → 13
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** end date of a consecutive multi-day booking (GO-6) */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Math.max(0, days - 1));
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Group items (e.g. report uploads) by their local calendar date, preserving
 * whatever order the input array is already in — pass it pre-sorted
 * (newest first) and the groups come out newest-date-first too, with each
 * group's items in their original relative order. Two reports uploaded the
 * same day (different times) land in one group instead of two separate
 * date-stamped entries.
 */
export function groupByLocalDate<T extends { created_at: string }>(items: T[]): { dateLabel: string; items: T[] }[] {
  const groups: { key: string; dateLabel: string; items: T[] }[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ key, dateLabel: d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }), items: [] });
    }
    groups[idx].items.push(item);
  }
  return groups.map(({ dateLabel, items }) => ({ dateLabel, items }));
}
