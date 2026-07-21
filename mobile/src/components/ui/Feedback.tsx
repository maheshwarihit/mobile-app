import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Plus, type LucideIcon } from "lucide-react-native";

/** Inline / page spinner */
export function Spinner({ size = "small" }: { size?: "small" | "large" }) {
  return <ActivityIndicator size={size} color="#9333ea" />;
}

/** Full centered loading state */
export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator size="large" color="#9333ea" />
      <Text className="mt-3 text-sm text-gray-500">{message}</Text>
    </View>
  );
}

/** Centered empty state with icon, title, description, optional action */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center justify-center py-12">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Icon size={24} color="#d1d5db" />
      </View>
      <Text className="mb-1 text-sm font-medium text-gray-500">{title}</Text>
      {description ? <Text className="mb-3 max-w-xs text-center text-sm text-gray-400">{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="flex-row items-center gap-1 active:opacity-70">
          <Plus size={14} color="#9333ea" />
          <Text className="text-sm font-semibold text-purple-600">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
];

/** Initials avatar — colour auto-assigned from an id/name string */
export function Avatar({ name, id = "0", size = "md" }: { name?: string | null; id?: string; size?: "sm" | "md" }) {
  const parts = (name ?? "").trim().split(/\s+/);
  const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  const key = id.length ? id.charCodeAt(id.length - 1) : 0;
  const color = AVATAR_COLORS[key % AVATAR_COLORS.length];
  const sz = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const txt = size === "sm" ? "text-xs" : "text-sm";
  return (
    <View className={`${sz} items-center justify-center rounded-full ${color.bg}`}>
      <Text className={`font-bold ${txt} ${color.text}`}>{initials}</Text>
    </View>
  );
}
