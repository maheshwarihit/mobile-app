import { View, Text, Pressable } from "react-native";

export type Tab = { key: string; label: string };

/** In-page horizontal tab bar (used on the staff/admin dashboard). */
export function TabBar({
  tabs,
  activeKey,
  onChange,
}: {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <View className="flex-row border-b border-gray-200">
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className={`border-b-2 px-4 py-2.5 ${active ? "border-purple-600" : "border-transparent"}`}
          >
            <Text className={`text-sm font-medium ${active ? "text-purple-700" : "text-gray-500"}`}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
