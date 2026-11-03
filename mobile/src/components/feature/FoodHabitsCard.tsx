import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { Card, ChoiceChips } from "@/components/ui";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { analyseFoodHabits, withinDays, type HabitMeal, type HabitPattern } from "@/lib/foodHabits";
import { BRAND, ACCENT_GREEN, WARN, DANGER } from "@/theme";

const key = (k: string) => k as TranslationKey;

// Same bands as a single meal's score.
const scoreColor = (score: number) => (score >= 60 ? ACCENT_GREEN : score >= 40 ? WARN : DANGER);

const PERIODS = [
  { value: "7", days: 7 },
  { value: "30", days: 30 },
  { value: "all", days: null },
] as const;

// Most days the chart shows, so each bar stays readable on a phone.
const MAX_BARS = 14;
const CHART_H = 96;

const shortDay = (day: string) => {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
};

/**
 * Food habits for one person, worked out from their analysed meals: the meal
 * score over time, average calories, the carbs / protein / fat balance, meal
 * timing, foods eaten most, what is often missing, nutrients that stay low, and
 * plain-language patterns. Used by the patient (Meal Scanner) and the care team.
 */
export function FoodHabitsCard({ meals }: { meals: HabitMeal[] }) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<string>("30");
  const days = PERIODS.find((p) => p.value === period)?.days ?? null;
  const habits = useMemo(() => analyseFoodHabits(withinDays(meals, days)), [meals, days]);

  const patternText = (p: HabitPattern) => {
    const params = { ...p.params };
    if (typeof params.slot === "string") params.slot = t(key(`foodHabits.slot.${params.slot}`));
    return t(key(`foodHabits.pattern.${p.key}`), params);
  };

  return (
    <Card className="gap-4 p-4">
      <View className="gap-1">
        <Text className="text-base font-bold text-gray-900">{t("foodHabits.title")}</Text>
        <Text className="text-xs text-gray-500">{t("foodHabits.hint")}</Text>
      </View>
      <ChoiceChips
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p.value, label: t(key(`foodHabits.period.${p.value}`)) }))}
      />

      {!habits ? (
        <Text className="text-sm text-gray-500">{t("foodHabits.none")}</Text>
      ) : (
        <>
          <Text className="text-xs text-gray-500">{t("foodHabits.basedOn", { meals: habits.meals, days: habits.days })}</Text>

          {/* Average score (with its direction) | average calories */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1 rounded-xl bg-gray-50 p-3">
              <Text className="text-[11px] font-semibold text-gray-500">{t("foodHabits.avgScore")}</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl font-extrabold" style={{ color: scoreColor(habits.avgScore) }}>
                  {habits.avgScore}
                </Text>
                {habits.trend ? <TrendIcon trend={habits.trend} /> : null}
              </View>
              <Text className="text-[11px] text-gray-500">
                {habits.trend ? t(key(`foodHabits.trend.${habits.trend}`)) : t("foodHabits.trend.needMore")}
              </Text>
            </View>
            <View className="flex-1 gap-1 rounded-xl bg-gray-50 p-3">
              <Text className="text-[11px] font-semibold text-gray-500">{t("foodHabits.avgCalories")}</Text>
              <Text className="text-2xl font-extrabold text-gray-900">
                {habits.avgCalories}
                <Text className="text-xs font-semibold text-gray-500"> kcal</Text>
              </Text>
              <Text className="text-[11px] text-gray-500">{t("foodHabits.perMeal")}</Text>
            </View>
          </View>

          {/* Daily average score */}
          {habits.daily.length > 1 ? (
            <View className="gap-1.5">
              <Text className="text-sm font-bold text-gray-900">{t("foodHabits.scoreByDay")}</Text>
              <View className="flex-row items-end gap-1" style={{ height: CHART_H }}>
                {habits.daily.slice(-MAX_BARS).map((d) => (
                  <View key={d.day} className="flex-1 items-center justify-end" style={{ height: CHART_H }}>
                    <Text className="text-[9px] font-bold text-gray-700">{d.score}</Text>
                    <View
                      className="w-full rounded-t-md"
                      style={{ height: Math.max(4, (d.score / 100) * (CHART_H - 14)), backgroundColor: scoreColor(d.score) }}
                    />
                  </View>
                ))}
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[10px] text-gray-500">{shortDay(habits.daily.slice(-MAX_BARS)[0].day)}</Text>
                <Text className="text-[10px] text-gray-500">{shortDay(habits.daily[habits.daily.length - 1].day)}</Text>
              </View>
            </View>
          ) : null}

          {/* Where the energy comes from */}
          {habits.energy ? (
            <View className="gap-1.5">
              <Text className="text-sm font-bold text-gray-900">{t("foodHabits.energySplit")}</Text>
              <View className="h-3 flex-row overflow-hidden rounded-full">
                <View style={{ flex: habits.energy.carbs, backgroundColor: WARN }} />
                <View style={{ flex: habits.energy.protein, backgroundColor: ACCENT_GREEN }} />
                <View style={{ flex: habits.energy.fat, backgroundColor: BRAND }} />
              </View>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                <Legend color={WARN} label={`${t("foodPlate.carbs")} ${habits.energy.carbs}%`} />
                <Legend color={ACCENT_GREEN} label={`${t("foodPlate.protein")} ${habits.energy.protein}%`} />
                <Legend color={BRAND} label={`${t("foodPlate.fat")} ${habits.energy.fat}%`} />
              </View>
              <Text className="text-[11px] text-gray-500">{t("foodHabits.energyGuide")}</Text>
            </View>
          ) : null}

          {/* Patterns in plain words */}
          {habits.patterns.length ? (
            <View className="gap-1.5 rounded-xl bg-sky-50 p-3">
              <Text className="text-sm font-bold text-gray-900">{t("foodHabits.patterns")}</Text>
              {habits.patterns.map((p) => (
                <View key={p.key} className="flex-row gap-2">
                  <Text className="text-sm text-gray-700">•</Text>
                  <Text className="flex-1 text-sm leading-5 text-gray-700">{patternText(p)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* When meals are eaten */}
          {habits.slots.length ? (
            <View className="gap-1">
              <Text className="text-sm font-bold text-gray-900">{t("foodHabits.byTime")}</Text>
              {habits.slots.map((s) => (
                <View key={s.slot} className="flex-row items-center justify-between border-b border-gray-100 py-1.5">
                  <Text className="text-sm text-gray-700">{t(key(`foodHabits.slot.${s.slot}`))}</Text>
                  <Text className="text-xs text-gray-500">{t("foodHabits.mealCount", { count: s.meals })}</Text>
                  <Text className="text-sm font-bold" style={{ color: scoreColor(s.avgScore) }}>
                    {s.avgScore}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {habits.lowNutrients.length ? (
            <NameList
              title={t("foodHabits.lowNutrients")}
              rows={habits.lowNutrients.map((n) => ({ name: n.name, value: t("foodHabits.ofDaily", { pct: n.avgPercent }) }))}
            />
          ) : null}
          {habits.oftenMissing.length ? (
            <NameList
              title={t("foodHabits.oftenMissing")}
              rows={habits.oftenMissing.map((n) => ({ name: n.name, value: t("foodHabits.inMeals", { count: n.count, total: habits.meals }) }))}
            />
          ) : null}
          {habits.topFoods.length ? (
            <NameList
              title={t("foodHabits.topFoods")}
              rows={habits.topFoods.map((n) => ({ name: n.name, value: t("foodHabits.times", { count: n.count }) }))}
            />
          ) : null}

          <Text className="text-[11px] text-gray-400">{t("foodHabits.note")}</Text>
        </>
      )}
    </Card>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "steady" }) {
  if (trend === "up") return <TrendingUp size={18} color={ACCENT_GREEN} />;
  if (trend === "down") return <TrendingDown size={18} color={DANGER} />;
  return <Minus size={18} color={WARN} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-gray-700">{label}</Text>
    </View>
  );
}

function NameList({ title, rows }: { title: string; rows: { name: string; value: string }[] }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold text-gray-900">{title}</Text>
      {rows.map((r) => (
        <View key={r.name} className="flex-row items-center justify-between gap-3 border-b border-gray-100 py-1.5">
          <Text className="flex-1 text-sm text-gray-700">{r.name}</Text>
          <Text className="text-xs font-semibold text-gray-600">{r.value}</Text>
        </View>
      ))}
    </View>
  );
}
