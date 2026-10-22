import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Card } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";

export type CalendarItem = { id: string; savedAt: string; photoUri: string };

/** A local calendar day as "YYYY-MM-DD". */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** The most recent day that has an item (items are newest first), or null. */
export function latestDay(items: CalendarItem[]): string | null {
  return items.length ? dayKey(items[0].savedAt) : null;
}

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function monthLabel(year: number, month: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  } catch {
    return `${EN_MONTHS[month]} ${year}`;
  }
}

function weekdayLabels(locale: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  } catch {
    return EN_WEEKDAYS;
  }
}

/**
 * A month calendar for the Meal library and the Report library: each date
 * with saved items shows the photo of its latest one (and how many there are
 * when more than one). Tapping such a date selects it; the screen then shows
 * only that day's results.
 */
export function LibraryCalendar({
  items,
  selectedDay,
  onSelectDay,
}: {
  items: CalendarItem[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const { language } = useLanguage();
  const locale = language === "ta" ? "ta-IN" : "en-IN";

  // Items grouped by day; the first of each group is the newest.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const k = dayKey(item.savedAt);
      map.set(k, [...(map.get(k) ?? []), item]);
    }
    return map;
  }, [items]);

  const startFrom = selectedDay ?? latestDay(items) ?? dayKey(new Date());
  const [year, setYear] = useState(Number(startFrom.slice(0, 4)));
  const [month, setMonth] = useState(Number(startFrom.slice(5, 7)) - 1);

  // Follow the selection when it moves to another month (e.g. after a delete).
  useEffect(() => {
    if (!selectedDay) return;
    setYear(Number(selectedDay.slice(0, 4)));
    setMonth(Number(selectedDay.slice(5, 7)) - 1);
  }, [selectedDay]);

  const shift = (by: number) => {
    const d = new Date(year, month + by, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const today = dayKey(new Date());

  return (
    <Card className="gap-2 p-3">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityRole="button" className="h-8 w-8 items-center justify-center rounded-full active:bg-gray-100">
          <ChevronLeft size={18} color={BRAND} />
        </Pressable>
        <Text className="text-sm font-bold text-gray-900">{monthLabel(year, month, locale)}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityRole="button" className="h-8 w-8 items-center justify-center rounded-full active:bg-gray-100">
          <ChevronRight size={18} color={BRAND} />
        </Pressable>
      </View>

      <View className="flex-row">
        {weekdayLabels(locale).map((w, i) => (
          <Text key={i} style={{ width: `${100 / 7}%` }} className="text-center text-[11px] font-semibold text-gray-400">
            {w}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayItems = byDay.get(key);
          const selected = key === selectedDay;
          return (
            <View key={key} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} className="p-0.5">
              <Pressable
                onPress={dayItems ? () => onSelectDay(key) : undefined}
                disabled={!dayItems}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !dayItems }}
                style={selected ? { borderColor: BRAND, borderWidth: 2 } : undefined}
                className={`flex-1 overflow-hidden rounded-lg ${dayItems ? "active:opacity-70" : ""}`}
              >
                {dayItems ? (
                  <>
                    <Image source={{ uri: dayItems[0].photoUri }} resizeMode="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                    <View className="absolute left-0.5 top-0.5 rounded bg-black/55 px-1">
                      <Text className="text-[10px] font-bold text-white">{d}</Text>
                    </View>
                    {dayItems.length > 1 ? (
                      <View style={{ backgroundColor: BRAND }} className="absolute bottom-0.5 right-0.5 h-4 min-w-4 items-center justify-center rounded-full px-1">
                        <Text className="text-[10px] font-bold text-white">{dayItems.length}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className={`text-xs ${key === today ? "font-bold text-purple-700" : "text-gray-500"}`}>{d}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Heading for the selected day's results, e.g. "Thursday, 22 October 2026". */
export function dayHeading(day: string, language: string | null): string {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  try {
    return new Intl.DateTimeFormat(language === "ta" ? "ta-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return day;
  }
}
