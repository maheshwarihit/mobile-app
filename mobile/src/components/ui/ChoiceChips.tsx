import { View, Text, Pressable } from "react-native";

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label?: string;
  error?: string;
  required?: boolean;
};

/**
 * Selectable pill group (e.g. gender, AM/PM). Distinct from the read-only `Pill`
 * badge. Single-select. Uses the teal `purple-*` (remapped) tokens for the active
 * chip so it re-themes with the rest of the app.
 */
export function ChoiceChips({ value, onChange, options, label, error, required }: Props) {
  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`rounded-full border px-4 py-2 ${
                active ? "border-purple-600 bg-purple-50" : "border-gray-300 bg-white"
              }`}
            >
              <Text className={`text-sm ${active ? "font-semibold text-purple-700" : "text-gray-600"}`}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
