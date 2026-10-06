import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { FormInput } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

type Parts = { street: string; city: string; pincode: string };

const PINCODE_LENGTH = 6;

/** "12, Main St, Chennai - 600001" → its three parts. Older free-text addresses fall back to street-only. */
function splitAddress(value: string): Parts {
  let rest = value.trim();
  let pincode = "";
  const pin = rest.match(/^([\s\S]*?)[\s,-]*(\d{6})$/);
  if (pin) {
    rest = pin[1].trim();
    pincode = pin[2];
  }
  const cut = rest.lastIndexOf(",");
  if (cut === -1) return { street: rest, city: "", pincode };
  return { street: rest.slice(0, cut).trim(), city: rest.slice(cut + 1).trim(), pincode };
}

function joinAddress({ street, city, pincode }: Parts): string {
  const line = [street.trim(), city.trim()].filter(Boolean).join(", ");
  // A half-typed pincode is left out rather than saved as stray digits.
  if (pincode.length !== PINCODE_LENGTH) return line;
  return line ? `${line} - ${pincode}` : pincode;
}

type Props = {
  label?: string;
  value: string; // the single stored address string
  onChange: (v: string) => void;
  error?: string;
};

/**
 * Address entry as three short boxes (house/street, city, pincode) instead of
 * one free-text area. The profile still stores a single `address` string —
 * the parts are joined on the way out and split again when editing.
 */
export function AddressFields({ label, value, onChange, error }: Props) {
  const { t } = useLanguage();
  const [parts, setParts] = useState<Parts>(() => splitAddress(value));
  // What this component last sent up, so a parent-driven change (the form
  // being filled from the saved profile) can be told apart from our own echo.
  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(splitAddress(value));
  }, [value]);

  const set = (key: keyof Parts) => (text: string) => {
    const next = { ...parts, [key]: key === "pincode" ? text.replace(/\D/g, "").slice(0, PINCODE_LENGTH) : text };
    setParts(next);
    emitted.current = joinAddress(next);
    onChange(emitted.current);
  };

  const pincodeIncomplete = parts.pincode.length > 0 && parts.pincode.length < PINCODE_LENGTH;

  return (
    <View>
      {label ? <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</Text> : null}
      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[220px] flex-[2]">
          <FormInput
            value={parts.street}
            onChangeText={set("street")}
            placeholder={t("profile.address.street")}
            autoCapitalize="words"
            maxLength={300}
          />
        </View>
        <View className="min-w-[130px] flex-1">
          <FormInput
            value={parts.city}
            onChangeText={set("city")}
            placeholder={t("profile.address.city")}
            autoCapitalize="words"
            maxLength={80}
          />
        </View>
        <View className="min-w-[110px] flex-1">
          <FormInput
            value={parts.pincode}
            onChangeText={set("pincode")}
            placeholder={t("profile.address.pincode")}
            keyboardType="number-pad"
            maxLength={PINCODE_LENGTH}
            error={pincodeIncomplete ? t("profile.address.pincodeError") : undefined}
          />
        </View>
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
