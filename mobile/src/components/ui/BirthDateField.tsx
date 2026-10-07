import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { formatDateDMY } from "@vagewell/shared";
import { useLanguage } from "@/lib/i18n";
import { DateField, type DateFieldProps } from "./DateField";
import { Wheel, WheelModal } from "./WheelPicker";

const OLDEST_AGE = 130;
const DEFAULT_AGE = 35;

/**
 * Date-of-birth input: the standard wheel `DateField`, limited to the past
 * 130 years up to today, opening around 35 years back, and reading DD/MM/YYYY.
 */
export function BirthDateField(props: Omit<DateFieldProps, "minimumDate" | "maximumDate" | "defaultDate" | "formatValue">) {
  const now = new Date();
  return (
    <DateField
      placeholder="DD/MM/YYYY"
      {...props}
      minimumDate={new Date(now.getFullYear() - OLDEST_AGE, 0, 1)}
      maximumDate={now}
      defaultDate={new Date(now.getFullYear() - DEFAULT_AGE, 0, 1)}
      formatValue={formatDateDMY}
    />
  );
}

const AGES = Array.from({ length: OLDEST_AGE + 1 }, (_, i) => String(i));

type AgeProps = {
  label?: string;
  value: string; // whole years, "" when unset
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

/** Age input: the same scroll-wheel popup as `DateField`, with a single column of years. */
export function AgeField({
  label,
  value,
  onChange,
  error,
  required,
  placeholder = "Select age",
  submitLabel,
}: AgeProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const startIndex = () => {
    const n = value === "" ? DEFAULT_AGE : Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(OLDEST_AGE, Math.round(n))) : DEFAULT_AGE;
  };
  const [index, setIndex] = useState(startIndex);

  const openPicker = () => {
    setIndex(startIndex());
    setOpen(true);
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
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>{value || placeholder}</Text>
        <ChevronDown size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <WheelModal
        visible={open}
        title={label ?? "Select age"}
        submitLabel={submitLabel ?? t("common.submit")}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          onChange(AGES[index]);
          setOpen(false);
        }}
      >
        <Wheel items={AGES} index={index} onIndexChange={setIndex} />
      </WheelModal>
    </View>
  );
}
