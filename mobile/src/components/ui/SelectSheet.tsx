import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import { BRAND } from "@/theme";

export type SelectOption = string | { value: string; label: string };

function normalize(opt: SelectOption): { value: string; label: string } {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

type Props = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
};

/** Dropdown replacement: a Pressable trigger that opens a bottom-sheet option list. */
export function SelectSheet({ label, value, onValueChange, options, placeholder = "Select…", error, required }: Props) {
  const [open, setOpen] = useState(false);
  const opts = options.map(normalize);
  const selected = opts.find((o) => o.value === value);

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
      >
        <Text className={`text-sm ${selected ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color="#9ca3af" />
      </Pressable>

      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-white pb-6 pt-2" onPress={() => {}}>
            <View className="mb-1 items-center py-2">
              <View className="h-1 w-10 rounded-full bg-gray-200" />
            </View>
            {label ? <Text className="px-5 pb-2 text-base font-bold text-gray-900">{label}</Text> : null}
            <FlatList
              data={opts}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-5 py-3.5 active:bg-gray-50"
                  >
                    <Text className={`text-sm ${active ? "font-semibold text-purple-700" : "text-gray-700"}`}>
                      {item.label}
                    </Text>
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
