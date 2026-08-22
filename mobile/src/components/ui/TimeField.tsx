import { useState } from "react";
import { View, Text } from "react-native";
import { SelectSheet } from "./SelectSheet";
import { ChoiceChips } from "./ChoiceChips";
import { combineTime } from "@vagewell/shared";

const HOURS = Array.from({ length: 12 }, (_, i) => {
  const v = String(i + 1).padStart(2, "0");
  return { value: v, label: v };
});
const MINUTES = ["00", "15", "30", "45"].map((m) => ({ value: m, label: m }));
const MERIDIEM = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

function parse(value: string) {
  const [hh, mm] = (value || "06:00").split(":");
  const h24 = Number(hh) || 6;
  const meridiem: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour: String(h12).padStart(2, "0"), minute: mm || "00", meridiem };
}

type Props = {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  label?: string;
  error?: string;
};

/**
 * Hour + minute + AM/PM picker that always emits a valid 24h "HH:MM" on a
 * 15-min boundary — any time of day, no business-hours restriction. Reverted
 * from a single combined dropdown (96 entries to scroll through) back to
 * three small controls, which is faster to actually use even though it's
 * visually three pieces rather than one.
 */
export function TimeField({ value, onChange, label, error }: Props) {
  const init = parse(value);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(init.meridiem);

  const apply = (h: string, m: string, mer: "AM" | "PM") => {
    setHour(h);
    setMinute(m);
    setMeridiem(mer);
    onChange(combineTime(Number(h), Number(m), mer));
  };

  return (
    <View>
      {label ? <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <SelectSheet value={hour} onValueChange={(v) => apply(v, minute, meridiem)} options={HOURS} />
        </View>
        <View className="flex-1">
          <SelectSheet value={minute} onValueChange={(v) => apply(hour, v, meridiem)} options={MINUTES} />
        </View>
      </View>
      <View className="mt-2">
        <ChoiceChips value={meridiem} onChange={(v) => apply(hour, minute, v as "AM" | "PM")} options={MERIDIEM} />
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
