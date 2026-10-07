import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Calendar } from "lucide-react-native";
import { formatDate } from "@vagewell/shared";
import { useLanguage } from "@/lib/i18n";
import { Wheel, WheelModal } from "./WheelPicker";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Year span offered when a field sets no limit of its own.
const DEFAULT_YEARS_BACK = 120;
const DEFAULT_YEARS_AHEAD = 5;
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type DateFieldProps = {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Where the wheel starts when there's no value yet (default: today). */
  defaultDate?: Date;
  placeholder?: string;
  submitLabel?: string;
  /** How the picked date reads in the field (default: "Feb 16, 2003"). */
  formatValue?: (iso: string) => string;
};

/**
 * Date input: a trigger showing the formatted date; tapping opens a
 * day / month / year scroll wheel with a Submit button. Plain ScrollViews (no
 * native picker) so it behaves the same on web/PWA and native. Dates stay
 * "YYYY-MM-DD" strings and are compared as strings — never `new Date(str)` —
 * to avoid TZ shifting. A pick outside minimumDate/maximumDate is pulled back
 * to the nearest allowed day on Submit.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  required,
  minimumDate,
  maximumDate,
  defaultDate,
  placeholder = "Pick a date",
  submitLabel,
  formatValue = formatDate,
}: DateFieldProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const thisYear = new Date().getFullYear();
  const minIso = minimumDate ? toISO(minimumDate) : null;
  const maxIso = maximumDate ? toISO(maximumDate) : null;
  const firstYear = minimumDate ? minimumDate.getFullYear() : thisYear - DEFAULT_YEARS_BACK;
  const lastYear = Math.max(firstYear, maximumDate ? maximumDate.getFullYear() : thisYear + DEFAULT_YEARS_AHEAD);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i));

  const clamp = (iso: string) => (minIso && iso < minIso ? minIso : maxIso && iso > maxIso ? maxIso : iso);

  const startSel = () => {
    const [y, m, d] = clamp(value || toISO(defaultDate ?? new Date())).split("-").map(Number);
    return { y: Math.max(0, Math.min(years.length - 1, y - firstYear)), m: m - 1, d: d - 1 };
  };
  const [sel, setSel] = useState(startSel);

  const openPicker = () => {
    setSel(startSel());
    setOpen(true);
  };

  const year = firstYear + sel.y;
  const daysInMonth = new Date(year, sel.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  // Derived, not stored: moving from a 31-day month to a shorter one clamps the day.
  const dayIndex = Math.min(sel.d, daysInMonth - 1);

  const submit = () => {
    onChange(clamp(`${year}-${pad(sel.m + 1)}-${pad(dayIndex + 1)}`));
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
          {value ? formatValue(value) : placeholder}
        </Text>
        <Calendar size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <WheelModal
        visible={open}
        title={label ?? "Select date"}
        submitLabel={submitLabel ?? t("common.submit")}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <Wheel items={days} index={dayIndex} onIndexChange={(d) => setSel((s) => ({ ...s, d }))} />
        <Wheel items={MONTHS} index={sel.m} onIndexChange={(m) => setSel((s) => ({ ...s, m }))} />
        <Wheel items={years} index={sel.y} onIndexChange={(y) => setSel((s) => ({ ...s, y }))} />
      </WheelModal>
    </View>
  );
}
