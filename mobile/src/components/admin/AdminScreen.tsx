import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { AdminHeader } from "./AdminHeader";

/**
 * Admin screen shell: a header bar (dark on login/dashboard, light on drill-downs)
 * over a light content area — matching the prototype. The top safe-area inset
 * matches the header colour.
 */
export function AdminScreen({
  title,
  icon,
  onBack,
  right,
  dark,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  onBack?: () => void;
  right?: React.ReactNode;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView className={`flex-1 ${dark ? "bg-admin" : "bg-white"}`} edges={["top"]}>
      <AdminHeader title={title} icon={icon} onBack={onBack} right={right} dark={dark} />
      <View className="flex-1 bg-authbg">{children}</View>
    </SafeAreaView>
  );
}
