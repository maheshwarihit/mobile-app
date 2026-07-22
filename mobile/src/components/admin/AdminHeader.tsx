import { View, Text, Pressable } from "react-native";
import { ChevronLeft, type LucideIcon } from "lucide-react-native";
import { ADMIN_ACCENT, BRAND } from "@/theme";

/**
 * Admin header bar. `dark` renders the prototype's dark portal bar (login +
 * dashboard); otherwise a light bar with a teal back chevron (drill-down screens).
 */
export function AdminHeader({
  title,
  icon: Icon,
  onBack,
  right,
  dark,
}: {
  title: string;
  icon?: LucideIcon;
  onBack?: () => void;
  right?: React.ReactNode;
  dark?: boolean;
}) {
  const chevron = dark ? ADMIN_ACCENT : BRAND;
  return (
    <View
      className={`flex-row items-center gap-2 px-4 pb-3 pt-1 ${
        dark ? "bg-admin" : "border-b border-gray-200 bg-white"
      }`}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8}>
          <ChevronLeft size={22} color={chevron} />
        </Pressable>
      ) : null}
      {Icon ? <Icon size={16} color={chevron} /> : null}
      <Text className={`flex-1 text-base font-bold ${dark ? "text-admin-text" : "text-gray-900"}`}>{title}</Text>
      {right}
    </View>
  );
}
