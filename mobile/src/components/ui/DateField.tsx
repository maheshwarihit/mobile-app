import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { formatDate } from "@vagewell/shared";
import { BRAND } from "@/theme";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Props = {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  minimumDate?: Date;
  placeholder?: string;
};

/**
 * Date input: a trigger showing the formatted date; tapping opens an in-app month
 * calendar. Built with a plain grid (not the native OS dialog) so it renders and
 * works identically on web/PWA and native. Dates are handled as "YYYY-MM-DD"
 * strings and compared as strings — never `new Date(str)` — to avoid TZ shifting.
 */
export function DateField({ label, value, onChange, error, required, minimumDate, placeholder = "Pick a date" }: Props) {
  const [open, setOpen] = useState(false);
  const minIso = minimumDate ? toISO(minimumDate) : null;

  const startRef = () => {
    const base = value || minIso || toISO(new Date());
    const [y, m] = base.split("-").map(Number);
    return { y, m: m - 1 };
  };
  const [ref, setRef] = useState(startRef);

  const openPicker = () => {
    setRef(startRef());
    setOpen(true);
  };

  const shiftMonth = (dir: number) => {
    const total = ref.y * 12 + ref.m + dir;
    setRef({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 });
  };
  const shiftYear = (dir: number) => setRef((r) => ({ ...r, y: r.y + dir }));

  const firstDow = new Date(ref.y, ref.m, 1).getDay();
  const daysInMonth = new Date(ref.y, ref.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (day: number) => {
    onChange(`${ref.y}-${pad(ref.m + 1)}-${pad(day)}`);
    setOpen(false);
  };

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <Pressable
        onPress={openPicker}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
      >
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Calendar size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={() => setOpen(false)}>
          <Pressable className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-4" onPress={() => {}}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-gray-900">{label ?? "Select date"}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <X size={18} color="#9ca3af" />
              </Pressable>
            </View>

            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row gap-1">
                <NavBtn icon={ChevronsLeft} onPress={() => shiftYear(-1)} />
                <NavBtn icon={ChevronLeft} onPress={() => shiftMonth(-1)} />
              </View>
              <Text className="text-sm font-bold text-gray-800">
                {MONTHS[ref.m]} {ref.y}
              </Text>
              <View className="flex-row gap-1">
                <NavBtn icon={ChevronRight} onPress={() => shiftMonth(1)} />
                <NavBtn icon={ChevronsRight} onPress={() => shiftYear(1)} />
              </View>
            </View>

            <View className="flex-row">
              {DOW.map((d, i) => (
                <View key={i} className="flex-1 items-center py-1">
                  <Text className="text-[10px] font-bold text-gray-400">{d}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {cells.map((day, i) => {
                if (day === null) return <View key={i} className="h-10 w-[14.28%]" />;
                const iso = `${ref.y}-${pad(ref.m + 1)}-${pad(day)}`;
                const disabled = !!minIso && iso < minIso;
                const selected = value === iso;
                return (
                  <View key={i} className="h-10 w-[14.28%] items-center justify-center">
                    <Pressable
                      disabled={disabled}
                      onPress={() => pick(day)}
                      className={`h-8 w-8 items-center justify-center rounded-full ${
                        selected ? "bg-purple-600" : disabled ? "" : "active:bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          selected ? "font-bold text-white" : disabled ? "text-gray-300" : "text-gray-800"
                        }`}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function NavBtn({ icon: Icon, onPress }: { icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="rounded-md border border-gray-200 px-2 py-1 active:bg-gray-50">
      <Icon size={16} color={BRAND} />
    </Pressable>
  );
}
