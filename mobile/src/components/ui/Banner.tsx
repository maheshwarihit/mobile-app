import { View, Text } from "react-native";
import { AlertTriangle, Check } from "lucide-react-native";
import { DANGER, WARN } from "@/theme";

/** Inline error banner (login failure, form errors) */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <AlertTriangle size={16} color={DANGER} />
      <Text className="flex-1 text-sm text-red-600">{message}</Text>
    </View>
  );
}

/** Inline warning notice */
export function WarningBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <AlertTriangle size={16} color={WARN} />
      <Text className="flex-1 text-sm text-amber-800">{message}</Text>
    </View>
  );
}

/** Inline success banner */
export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <Check size={16} color="#047857" />
      <Text className="flex-1 text-sm text-emerald-700">{message}</Text>
    </View>
  );
}
