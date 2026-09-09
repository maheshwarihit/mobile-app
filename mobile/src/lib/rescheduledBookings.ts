import AsyncStorage from "@react-native-async-storage/async-storage";

// When a patient reschedules, the old booking is released server-side by
// flipping it to `cancelled` — the pipeline has no distinct "rescheduled"
// state. That makes it read as "Cancelled" in the Checkup history, which is
// misleading: the visit wasn't dropped, it was moved. We remember which
// booking ids were rescheduled (not plain-cancelled) on this device so the
// history can label them "Rescheduled" instead. Best-effort / local-only,
// exactly like dismissedMissed.ts.
const RESCHEDULED_KEY = "vagewell.rescheduledBookingIds";

export async function loadRescheduledIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(RESCHEDULED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function markBookingRescheduled(id: string): Promise<void> {
  try {
    const current = await loadRescheduledIds();
    current.add(id);
    await AsyncStorage.setItem(RESCHEDULED_KEY, JSON.stringify([...current]));
  } catch {
    // best-effort — worst case the row shows "Cancelled" instead of "Rescheduled"
  }
}
