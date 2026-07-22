import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { ADMIN_ACCENT } from "@/theme";
import type { BookingWithNames } from "@vagewell/shared";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Monthly calendar for the admin dashboard. Days that have a booking show an accent
 * dot; tapping a day filters the list (tap again clears). Dates are compared as
 * "YYYY-MM-DD" strings — never parsed with new Date(str) — to avoid TZ shifting.
 */
export function AppointmentCalendar({
  bookings,
  selectedDay,
  onSelectDay,
}: {
  bookings: BookingWithNames[];
  selectedDay: string | null;
  onSelectDay: (iso: string | null) => void;
}) {
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const apptDays = useMemo(() => new Set(bookings.map((b) => b.start_date)), [bookings]);

  const firstDow = new Date(ref.y, ref.m, 1).getDay();
  const daysInMonth = new Date(ref.y, ref.m + 1, 0).getDate();

  const shift = (dir: number) => {
    const total = ref.y * 12 + ref.m + dir;
    setRef({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 });
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View className="rounded-xl border border-admin-border bg-admin-surface p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} hitSlop={8} className="rounded-md border border-admin-border px-2 py-1">
          <ChevronLeft size={16} color={ADMIN_ACCENT} />
        </Pressable>
        <Text className="text-sm font-bold text-admin-text">
          {MONTHS[ref.m]} {ref.y}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={8} className="rounded-md border border-admin-border px-2 py-1">
          <ChevronRight size={16} color={ADMIN_ACCENT} />
        </Pressable>
      </View>

      <View className="flex-row">
        {DOW.map((d, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text className="text-[10px] font-bold text-admin-muted">{d}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day === null) return <View key={i} className="h-9 w-[14.28%]" />;
          const iso = `${ref.y}-${pad(ref.m + 1)}-${pad(day)}`;
          const has = apptDays.has(iso);
          const selected = selectedDay === iso;
          return (
            <Pressable
              key={i}
              onPress={() => onSelectDay(selected ? null : iso)}
              className="h-9 w-[14.28%] items-center justify-center"
            >
              <View className={`h-7 w-7 items-center justify-center rounded-full ${selected ? "bg-admin-accent" : ""}`}>
                <Text className={`text-xs ${selected ? "font-bold text-admin" : "text-admin-text"}`}>{day}</Text>
              </View>
              {has ? (
                <View className={`mt-0.5 h-1 w-1 rounded-full ${selected ? "bg-admin" : "bg-admin-accent"}`} />
              ) : (
                <View className="mt-0.5 h-1 w-1" />
              )}
            </Pressable>
          );
        })}
      </View>

      {selectedDay ? (
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-admin-accent">Showing {selectedDay}</Text>
          <Pressable onPress={() => onSelectDay(null)} className="rounded-md border border-admin-border px-2 py-1">
            <Text className="text-xs text-admin-text">Clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
