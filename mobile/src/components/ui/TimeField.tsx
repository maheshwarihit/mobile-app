import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Clock } from "lucide-react-native";
import { combineTime, formatSlot } from "@vagewell/shared";
import { useLanguage } from "@/lib/i18n";
import { Wheel, WheelModal } from "./WheelPicker";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];
const MERIDIEM = ["AM", "PM"] as const;

function parse(value: string) {
  const [hh, mm] = (value || "06:00").split(":");
  const h24 = Number(hh) || 0;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    h: h12 - 1,
    m: Math.max(0, MINUTES.indexOf((mm || "00").slice(0, 2))),
    p: h24 >= 12 ? 1 : 0,
  };
}

type Props = {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  submitLabel?: string;
};

/**
 * Time input: one field showing the time (e.g. "11:45 PM"); tapping opens the
 * same hour / minute / AM-PM scroll wheel with a Submit button as the date
 * fields. Always emits a valid 24h "HH:MM" on a 15-minute boundary, any time
 * of day; the "at least 2 hours from now" rule is checked by the form.
 */
export function TimeField({ value, onChange, label, error, required, submitLabel }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => parse(value));

  const openPicker = () => {
    setSel(parse(value));
    setOpen(true);
  };

  const submit = () => {
    onChange(combineTime(Number(HOURS[sel.h]), Number(MINUTES[sel.m]), MERIDIEM[sel.p]));
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
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>{value ? formatSlot(value) : "--:--"}</Text>
        <Clock size={16} color="#6b7280" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <WheelModal
        visible={open}
        title={label ?? "Preferred time"}
        submitLabel={submitLabel ?? t("common.submit")}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <Wheel items={HOURS} index={sel.h} onIndexChange={(h) => setSel((s) => ({ ...s, h }))} />
        <Wheel items={MINUTES} index={sel.m} onIndexChange={(m) => setSel((s) => ({ ...s, m }))} />
        <Wheel items={[...MERIDIEM]} index={sel.p} onIndexChange={(p) => setSel((s) => ({ ...s, p }))} />
      </WheelModal>
    </View>
  );
}
