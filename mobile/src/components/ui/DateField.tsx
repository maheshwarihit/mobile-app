import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { formatDate } from "@vagewell/shared";

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromISO(s: string): Date {
  if (s) {
    const [y, m, d] = s.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return new Date();
}

type Props = {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  minimumDate?: Date;
  placeholder?: string;
};

/** Date input: a trigger showing the formatted date; opens the native Android date dialog. */
export function DateField({ label, value, onChange, error, required, minimumDate, placeholder = "Pick a date" }: Props) {
  const [show, setShow] = useState(false);

  const onPick = (e: DateTimePickerEvent, date?: Date) => {
    setShow(false); // the Android dialog dismisses itself on set/cancel
    if (e.type === "set" && date) onChange(toISO(date));
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
        onPress={() => setShow(true)}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
      >
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Calendar size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
      {show ? (
        <DateTimePicker value={fromISO(value)} mode="date" onChange={onPick} minimumDate={minimumDate} />
      ) : null}
    </View>
  );
}
