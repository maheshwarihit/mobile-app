import { View, Text } from "react-native";

/**
 * Generic colored pill. `bgClass`/`textClass` are Tailwind classes (NativeWind) —
 * pass the values from the shared PAYMENT_STATUS_META / BOOKING_STATUS_META maps.
 */
export function Pill({
  children,
  bgClass = "bg-gray-100",
  textClass = "text-gray-600",
}: {
  children: string;
  bgClass?: string;
  textClass?: string;
}) {
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${bgClass}`}>
      <Text className={`text-xs font-medium ${textClass}`}>{children}</Text>
    </View>
  );
}
