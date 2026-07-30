import AsyncStorage from "@react-native-async-storage/async-storage";

// A missed booking's server-side status doesn't always let a patient cancel
// it (only while requested/approved), so "I've handled this one" is tracked
// locally too — this is what actually clears the "Recently missed" nudge,
// independent of whether the underlying cancel attempt succeeded server-side.
const DISMISSED_MISSED_KEY = "vagewell.dismissedMissedBookingIds";

export async function loadDismissedMissedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_MISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Marks a booking as dismissed once its reschedule is actually booked (not merely started). */
export async function dismissMissedBooking(id: string): Promise<void> {
  try {
    const current = await loadDismissedMissedIds();
    current.add(id);
    await AsyncStorage.setItem(DISMISSED_MISSED_KEY, JSON.stringify([...current]));
  } catch {
    // best-effort — worst case the nudge reappears until the next successful dismiss
  }
}
