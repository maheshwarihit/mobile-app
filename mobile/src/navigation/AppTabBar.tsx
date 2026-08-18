import { View, Text, Pressable } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

/**
 * Custom bottom tab bar — active tab renders as a filled brand-teal pill
 * (icon + label, both white); inactive tabs are a plain gray icon with no
 * label. Replaces React Navigation's default flat icon-over-label row.
 * Reused by both the patient tabs (AppNavigator) and the caregiver tabs
 * (OpsNavigator's CaregiverNavigator) so the whole app reads as one design.
 */
export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      className="flex-row items-center justify-around border-t border-gray-100 bg-white px-2 pt-2.5 dark:border-slate-700 dark:bg-slate-900"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            className={`flex-row items-center gap-1.5 rounded-full px-4 py-2.5 active:opacity-80 ${
              isFocused ? "bg-purple-600" : ""
            }`}
          >
            {options.tabBarIcon?.({ focused: isFocused, color: isFocused ? "#ffffff" : "#9ca3af", size: 20 })}
            {isFocused ? <Text className="text-sm font-semibold text-white">{label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
