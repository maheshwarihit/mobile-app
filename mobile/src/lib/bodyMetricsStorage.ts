import AsyncStorage from "@react-native-async-storage/async-storage";

export type BodyMetrics = {
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  medicalConditions: string[];
  pastHistory: string[];
  savedAt: string; // UTC ISO 8601
};

// Kept on the device, per signed-in account and per person (self or a
// dependent's id) — same approach as the BMI results (see bmiStorage.ts).
const key = (userId: string | null, personKey: string) => `vagewell.bodyMetrics.${userId ?? "guest"}.${personKey}`;

export async function loadBodyMetrics(userId: string | null, personKey: string): Promise<BodyMetrics | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, personKey));
    return raw ? (JSON.parse(raw) as BodyMetrics) : null;
  } catch {
    return null;
  }
}

export async function saveBodyMetrics(userId: string | null, personKey: string, metrics: BodyMetrics): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key(userId, personKey), JSON.stringify(metrics));
    return true;
  } catch {
    return false;
  }
}
