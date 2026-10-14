import { useState } from "react";
import { View, Text, TextInput, Pressable, Modal, FlatList } from "react-native";
import { ChevronDown, Check, Search } from "lucide-react-native";
import { PHONE_COUNTRIES, splitPhone, type PhoneCountry } from "@vagewell/shared";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";

type Props = {
  label: string;
  /** Stored form: "+<code><number>" (or "" while empty). */
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  required?: boolean;
};

/**
 * Mobile number entry in two parts: the country (code picker, India +91 by
 * default) and then the number itself. Emits the full international number,
 * e.g. "+447700900123", which `normalizePhone` checks against that country's
 * number length. Pasting a number that already starts with "+" switches the
 * country to match.
 */
export function PhoneField({ label, value, onChangeText, error, required }: Props) {
  const { t } = useLanguage();
  const initial = splitPhone(value);
  // The country is kept here too, so it survives while the number box is empty.
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const national = value ? splitPhone(value).national : "";
  const emit = (c: PhoneCountry, digits: string) => onChangeText(digits ? `${c.dial}${digits}` : "");

  const onNumber = (text: string) => {
    if (text.trim().startsWith("+")) {
      const parsed = splitPhone(text);
      setCountry(parsed.country);
      emit(parsed.country, parsed.national);
      return;
    }
    // A leading 0 is the domestic trunk prefix, never part of the international number.
    const digits = text.replace(/\D/g, "").replace(/^0+/, "").slice(0, country.max);
    emit(country, digits);
  };

  const choose = (c: PhoneCountry) => {
    setCountry(c);
    setPicking(false);
    setQuery("");
    emit(c, national.slice(0, c.max));
  };

  const q = query.trim().toLowerCase();
  const list = q
    ? PHONE_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/^\+?/, "+")))
    : PHONE_COUNTRIES;
  const border = error ? "border-red-400" : focused ? "border-purple-600" : "border-gray-300";

  return (
    <View>
      <Text className="mb-1.5 text-sm font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={t("phone.country")}
          className="flex-row items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 active:bg-gray-50"
        >
          <Text className="text-sm font-semibold text-gray-900">{country.iso}</Text>
          <Text className="text-sm text-gray-700">{country.dial}</Text>
          <ChevronDown size={14} color="#9ca3af" />
        </Pressable>
        <View className={`flex-1 rounded-lg border ${border} bg-white px-3`}>
          <TextInput
            value={national}
            onChangeText={onNumber}
            placeholder={
              country.min === country.max
                ? t("phone.placeholder", { digits: country.min })
                : t("phone.placeholderRange", { min: country.min, max: country.max })
            }
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="py-3 text-sm text-gray-900"
          />
        </View>
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPicking(false)}>
          <Pressable className="max-h-[75%] rounded-t-2xl bg-white pb-6 pt-2" onPress={() => {}}>
            <View className="mb-1 items-center py-2">
              <View className="h-1 w-10 rounded-full bg-gray-200" />
            </View>
            <Text className="px-5 pb-2 text-base font-bold text-gray-900">{t("phone.country")}</Text>
            <View className="mx-5 mb-2 flex-row items-center gap-2 rounded-lg border border-gray-300 px-3">
              <Search size={16} color="#9ca3af" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("phone.search")}
                placeholderTextColor="#9ca3af"
                className="flex-1 py-2.5 text-sm text-gray-900"
              />
            </View>
            <FlatList
              data={list}
              keyExtractor={(c) => c.iso}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.iso === country.iso;
                return (
                  <Pressable
                    onPress={() => choose(item)}
                    className={`flex-row items-center gap-3 px-5 py-3 active:bg-gray-50 ${active ? "bg-purple-50" : ""}`}
                  >
                    <Text className="w-8 text-sm font-semibold text-gray-500">{item.iso}</Text>
                    <Text className={`flex-1 text-sm ${active ? "font-semibold text-gray-900" : "text-gray-800"}`}>{item.name}</Text>
                    <Text className="text-sm text-gray-500">{item.dial}</Text>
                    {active ? <Check size={16} color={BRAND} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
