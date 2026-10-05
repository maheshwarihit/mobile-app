import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredBmiResult = { name: string; bmi: number };

const key = (userId: string | null) => `vagewell.bmiResults.${userId ?? "guest"}`;

export async function loadBmiResults(userId: string | null): Promise<StoredBmiResult[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as StoredBmiResult[]) : [];
  } catch {
    return [];
  }
}

export async function saveBmiResults(userId: string | null, results: StoredBmiResult[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(results));
  } catch {
    // best-effort — worst case the results aren't kept across a refresh
  }
}
