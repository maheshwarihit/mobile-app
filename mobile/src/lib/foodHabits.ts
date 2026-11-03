import type { PlateAnalysis } from "@/lib/foodPlate";

/** One analysed meal, as the patient's Meal library and the care team's records both have it. */
export type HabitMeal = { savedAt: string; analysis: PlateAnalysis };

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";
export type Trend = "up" | "down" | "steady";
/** A pattern worth pointing out, as a translation key under foodHabits.pattern.* plus its numbers. */
export type HabitPattern = { key: string; params?: Record<string, string | number> };

export type FoodHabits = {
  meals: number;
  days: number;
  avgScore: number;
  /** Recent meals' average score against earlier ones (needs 4 or more meals). */
  trend: Trend | null;
  avgCalories: number;
  /** Share of energy from each macro, in percent (carbs and protein 4 kcal/g, fat 9). */
  energy: { carbs: number; protein: number; fat: number } | null;
  /** Average meal score per day, oldest first (for the chart). */
  daily: { day: string; score: number; meals: number }[];
  slots: { slot: MealSlot; meals: number; avgScore: number }[];
  topFoods: { name: string; count: number }[];
  oftenMissing: { name: string; count: number }[];
  lowNutrients: { name: string; avgPercent: number }[];
  patterns: HabitPattern[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, e.g. 2026-11-03. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Which meal of the day, from the local time it was saved. */
export function mealSlot(iso: string): MealSlot {
  const h = new Date(iso).getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snack";
  return "dinner";
}

/** Meals saved in the last `days` days (all of them when `days` is null). */
export function withinDays<T extends { savedAt: string }>(meals: T[], days: number | null, now = Date.now()): T[] {
  if (days === null) return meals;
  return meals.filter((m) => now - new Date(m.savedAt).getTime() < days * DAY_MS);
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

// The AI writes food and nutrient names freely, so the same thing can differ in
// case or trailing punctuation; group them on a loose form, show the first spelling.
const looseKey = (s: string) => s.trim().toLowerCase().replace(/[.!,;:]+$/, "").replace(/\s+/g, " ");

function countNames(lists: string[][], limit: number): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const list of lists) {
    // A name repeated within one meal counts once for that meal.
    for (const k of new Set(list.map(looseKey).filter(Boolean))) {
      const original = list.find((s) => looseKey(s) === k)!.trim();
      const entry = counts.get(k) ?? { name: original, count: 0 };
      entry.count += 1;
      counts.set(k, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Patterns in one person's analysed meals: the score over time, calories, the
 * carbs / protein / fat balance, meal timing, the foods eaten most, what the AI
 * most often found missing, and the micronutrients that stay low. Worked out on
 * the phone from the saved results; nothing is sent anywhere.
 */
export function analyseFoodHabits(input: HabitMeal[]): FoodHabits | null {
  const meals = input.filter((m) => m.analysis?.is_food !== false).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  if (!meals.length) return null;
  const a = meals.map((m) => m.analysis);

  const avgScore = avg(a.map((x) => x.score));
  let trend: Trend | null = null;
  if (meals.length >= 4) {
    const half = Math.floor(meals.length / 2);
    const diff = avg(a.slice(-half).map((x) => x.score)) - avg(a.slice(0, half).map((x) => x.score));
    trend = diff >= 5 ? "up" : diff <= -5 ? "down" : "steady";
  }

  const carbsKcal = avg(a.map((x) => x.carbs_g)) * 4;
  const proteinKcal = avg(a.map((x) => x.protein_g)) * 4;
  const fatKcal = avg(a.map((x) => x.fat_g)) * 9;
  const total = carbsKcal + proteinKcal + fatKcal;
  const energy =
    total > 0
      ? { carbs: Math.round((carbsKcal / total) * 100), protein: Math.round((proteinKcal / total) * 100), fat: Math.round((fatKcal / total) * 100) }
      : null;

  const byDay = new Map<string, number[]>();
  for (const m of meals) byDay.set(localDay(m.savedAt), [...(byDay.get(localDay(m.savedAt)) ?? []), m.analysis.score]);
  const daily = [...byDay.entries()].map(([day, scores]) => ({ day, score: Math.round(avg(scores)), meals: scores.length }));

  const slotOrder: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
  const slots = slotOrder
    .map((slot) => {
      const inSlot = meals.filter((m) => mealSlot(m.savedAt) === slot);
      return { slot, meals: inSlot.length, avgScore: Math.round(avg(inSlot.map((m) => m.analysis.score))) };
    })
    .filter((s) => s.meals > 0);

  // Micronutrients seen in at least two meals, lowest average share of the daily need first.
  const micro = new Map<string, { name: string; values: number[] }>();
  for (const x of a) {
    for (const n of x.micronutrients ?? []) {
      const k = looseKey(n.name);
      const entry = micro.get(k) ?? { name: n.name.trim(), values: [] };
      entry.values.push(Math.max(0, n.percent_of_daily_need));
      micro.set(k, entry);
    }
  }
  const lowNutrients = [...micro.values()]
    .filter((e) => e.values.length >= Math.min(2, meals.length))
    .map((e) => ({ name: e.name, avgPercent: Math.round(avg(e.values)) }))
    .filter((e) => e.avgPercent < 25)
    .sort((x, y) => x.avgPercent - y.avgPercent)
    .slice(0, 3);

  const oftenMissing = countNames(a.map((x) => x.missing ?? []), 3).filter((e) => e.count >= 2 || meals.length === 1);
  const topFoods = countNames(a.map((x) => x.items ?? []), 5);

  const patterns: HabitPattern[] = [];
  if (energy) {
    if (energy.carbs > 65) patterns.push({ key: "highCarbs", params: { pct: energy.carbs } });
    if (energy.protein < 12) patterns.push({ key: "lowProtein", params: { pct: energy.protein } });
    if (energy.fat > 35) patterns.push({ key: "highFat", params: { pct: energy.fat } });
    if (energy.carbs <= 65 && energy.protein >= 12 && energy.fat <= 35) patterns.push({ key: "balanced" });
  }
  const late = meals.filter((m) => {
    const h = new Date(m.savedAt).getHours();
    return h >= 21 || h < 4;
  }).length;
  if (meals.length >= 3 && late / meals.length >= 0.3) patterns.push({ key: "lateMeals", params: { count: late, total: meals.length } });
  if (slots.length >= 2) {
    const worst = [...slots].sort((x, y) => x.avgScore - y.avgScore)[0];
    const best = [...slots].sort((x, y) => y.avgScore - x.avgScore)[0];
    if (best.avgScore - worst.avgScore >= 15) patterns.push({ key: "weakSlot", params: { slot: worst.slot } });
  }
  const days = byDay.size;
  if (days >= 3 && meals.length / days < 1.5) patterns.push({ key: "fewPerDay" });

  return {
    meals: meals.length,
    days,
    avgScore: Math.round(avgScore),
    trend,
    avgCalories: Math.round(avg(a.map((x) => x.calories_kcal))),
    energy,
    daily,
    slots,
    topFoods,
    oftenMissing,
    lowNutrients,
    patterns,
  };
}
