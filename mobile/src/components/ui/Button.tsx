import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { BRAND } from "@/theme";

type BaseProps = {
  children: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
};

/** Full-width or auto-width primary action button */
export function PrimaryButton({ children, onPress, disabled, loading, fullWidth, icon: Icon }: BaseProps) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`flex-row items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-5 py-3 active:bg-purple-700 ${
        fullWidth ? "w-full" : "self-start"
      } ${off ? "opacity-60" : ""}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          {Icon && <Icon size={16} color="#fff" />}
          <Text className="text-sm font-semibold text-white">{children}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Secondary / cancel button */
export function OutlineButton({ children, onPress, disabled, fullWidth, icon: Icon }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-5 py-3 active:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:active:bg-slate-700 ${
        fullWidth ? "w-full" : "self-start"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {Icon && <Icon size={16} color="#4b5563" />}
      <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300">{children}</Text>
    </Pressable>
  );
}

/** Destructive confirmation button */
export function DangerButton({ children, onPress, disabled, fullWidth }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-lg border border-red-200 bg-white px-5 py-3 active:bg-red-50 dark:border-red-900 dark:bg-slate-800 ${
        fullWidth ? "w-full" : "self-start"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <Text className="text-sm font-semibold text-red-600">{children}</Text>
    </Pressable>
  );
}

/** Compact inline primary — card headers */
export function SmallPrimaryButton({ children, onPress, icon: Icon }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 self-start rounded-lg bg-purple-600 px-3 py-1.5 active:bg-purple-700"
    >
      {Icon && <Icon size={14} color="#fff" />}
      <Text className="text-xs font-semibold text-white">{children}</Text>
    </Pressable>
  );
}

/** Text-only link-style button */
export function TextButton({ children, onPress, icon: Icon }: BaseProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1 self-start active:opacity-70">
      {Icon && <Icon size={14} color={BRAND} />}
      <Text className="text-sm font-semibold text-purple-600">{children}</Text>
    </Pressable>
  );
}

/**
 * Gradient primary — reserved for the dark hero screens (Onboarding, Landing,
 * the Visit-as picker), not a replacement for PrimaryButton elsewhere. The
 * ordinary teal `PrimaryButton` stays flat everywhere else in the app; this
 * exists only because those specific screens match a reference design that
 * uses a diagonal teal→green gradient on its primary CTA.
 */
export function GradientButton({ children, onPress, disabled, loading, fullWidth, icon: Icon }: BaseProps) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`overflow-hidden rounded-lg ${fullWidth ? "w-full" : "self-start"} ${off ? "opacity-60" : ""}`}
    >
      <LinearGradient
        colors={[BRAND, "#0A6B5C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          paddingHorizontal: 20,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            {Icon && <Icon size={16} color="#fff" />}
            <Text className="text-sm font-semibold text-white">{children}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Secondary action on a dark background (Onboarding/Landing's "View as Guest") — a translucent white pill, since the ordinary white-card OutlineButton reads as invisible over a dark gradient. */
export function TranslucentButton({ children, onPress, disabled, fullWidth, icon: Icon }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-5 py-3 active:bg-white/20 ${
        fullWidth ? "w-full" : "self-start"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {Icon && <Icon size={16} color="#fff" />}
      <Text className="text-sm font-semibold text-white">{children}</Text>
    </Pressable>
  );
}

/** Icon-only action button (table/card actions) */
export function IconButton({
  icon: Icon,
  onPress,
  danger = false,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="rounded-lg p-2 active:bg-gray-100 dark:active:bg-slate-700">
      <View>
        <Icon size={18} color={danger ? "#ef4444" : "#9ca3af"} />
      </View>
    </Pressable>
  );
}
