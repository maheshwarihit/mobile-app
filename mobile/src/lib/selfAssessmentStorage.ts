import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SectionId, SectionAnswers } from "@/lib/selfAssessmentScore";

export type SelfAssessment = {
  answers: Partial<Record<SectionId, SectionAnswers>>;
  savedAt: string; // UTC ISO 8601
};

// Kept on the device, per signed-in account and per person (self or a
// dependent's id) — same approach as Body Metrics (see bodyMetricsStorage.ts).
const key = (userId: string | null, personKey: string) => `vagewell.selfAssessment.${userId ?? "guest"}.${personKey}`;

export async function loadSelfAssessment(userId: string | null, personKey: string): Promise<SelfAssessment | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, personKey));
    return raw ? (JSON.parse(raw) as SelfAssessment) : null;
  } catch {
    return null;
  }
}

export async function saveSelfAssessment(userId: string | null, personKey: string, value: SelfAssessment): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key(userId, personKey), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function clearSelfAssessment(userId: string | null, personKey: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key(userId, personKey));
    return true;
  } catch {
    return false;
  }
}
