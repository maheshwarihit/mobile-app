import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeBmi } from "@/lib/bmi";
import { loadBodyMetrics } from "@/lib/bodyMetricsStorage";
import { loadNutritionRecords, syncNutrition, syncOnce } from "@/lib/nutritionSync";

/** One BMI reading: the height and weight on that date, and the BMI they give. */
export type BmiPoint = { at: string; heightCm: number; weightKg: number; bmi: number };

// Kept on the device, per signed-in account and per person (self or a dependent's id).
const key = (userId: string | null, personKey: string) => `vagewell.bmiHistory.${userId ?? "guest"}.${personKey}`;
const MAX_POINTS = 60;
const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);
// One server record per person per day (a second change that day replaces it).
const bmiClientId = (personKey: string, p: BmiPoint) => `bmi:${personKey}:${p.at.slice(0, 10)}`;

/** Copy the readings the server does not have yet (the care team's BMI graph). */
export function syncBmiHistory(userId: string | null, personKey: string, points: BmiPoint[]): Promise<void> {
  return syncOnce(
    userId,
    personKey,
    "bmi",
    points.map((p) => ({ clientId: bmiClientId(personKey, p), data: p, createdAt: p.at })),
  );
}

async function read(userId: string | null, personKey: string): Promise<BmiPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, personKey));
    return raw ? (JSON.parse(raw) as BmiPoint[]) : [];
  } catch {
    return [];
  }
}

async function write(userId: string | null, personKey: string, points: BmiPoint[]) {
  try {
    await AsyncStorage.setItem(key(userId, personKey), JSON.stringify(points.slice(-MAX_POINTS)));
  } catch {
    // best-effort
  }
}

/**
 * Add a reading when height or weight changed (or there is none yet). A second
 * change on the same day replaces that day's reading. Returns the history, oldest first.
 */
export async function recordBmiPoint(userId: string | null, personKey: string, heightCm: number, weightKg: number): Promise<BmiPoint[]> {
  const points = await read(userId, personKey);
  if (!(heightCm > 0 && weightKg > 0)) return points;
  const last = points[points.length - 1];
  if (last && last.heightCm === heightCm && last.weightKg === weightKg) return points;
  const at = new Date().toISOString();
  const point: BmiPoint = { at, heightCm, weightKg, bmi: Math.round(computeBmi(heightCm, weightKg) * 10) / 10 };
  const next = last && sameDay(last.at, at) ? [...points.slice(0, -1), point] : [...points, point];
  await write(userId, personKey, next);
  void syncNutrition(userId, personKey, "bmi", bmiClientId(personKey, point), point, null, point.at);
  return next;
}

/**
 * Add the dated Body Metrics measurements saved on the server (any device,
 * migration 0047) that this phone does not have yet. Best-effort: offline or
 * before the migration it simply adds nothing.
 */
async function mergeServerMeasurements(userId: string | null, personKey: string, points: BmiPoint[]): Promise<BmiPoint[]> {
  if (!userId) return points;
  try {
    const records = await loadNutritionRecords(userId, personKey === "self" ? null : personKey);
    const extra: BmiPoint[] = [];
    for (const r of records) {
      if (r.kind !== "body_metrics") continue;
      const d = r.data as { heightCm?: string; weightKg?: string; savedAt?: string };
      const h = Number(d.heightCm);
      const w = Number(d.weightKg);
      if (!d.savedAt || !(h > 0 && w > 0)) continue;
      const at = d.savedAt;
      if ([...points, ...extra].some((p) => sameDay(p.at, at))) continue;
      extra.push({ at, heightCm: h, weightKg: w, bmi: Math.round(computeBmi(h, w) * 10) / 10 });
    }
    if (!extra.length) return points;
    const merged = [...points, ...extra].sort((a, b) => a.at.localeCompare(b.at));
    await write(userId, personKey, merged);
    return merged;
  } catch {
    return points;
  }
}

/**
 * The person's BMI history, oldest first. The first time, it starts from the
 * height and weight Body Metrics saved earlier (before they moved to the
 * profile), so there is a previous reading to compare with.
 */
export async function loadBmiHistory(userId: string | null, personKey: string): Promise<BmiPoint[]> {
  const points = await mergeServerMeasurements(userId, personKey, await read(userId, personKey));
  if (points.length) return points;
  const old = await loadBodyMetrics(userId, personKey);
  const h = Number(old?.heightCm);
  const w = Number(old?.weightKg);
  if (old?.savedAt && h > 0 && w > 0) {
    const seeded = [{ at: old.savedAt, heightCm: h, weightKg: w, bmi: Math.round(computeBmi(h, w) * 10) / 10 }];
    await write(userId, personKey, seeded);
    return seeded;
  }
  return [];
}
