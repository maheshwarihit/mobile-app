import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, ScrollView, TextInput, Easing } from "react-native";
import {
  ClipboardList,
  PhoneIncoming,
  UserPlus,
  Users,
  UserCog,
  FileText,
  Table2,
  Receipt,
  QrCode,
  Search,
  Sun,
  Moon,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { ROLE_LABELS, type Profile } from "@vagewell/shared";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { useThemePreference } from "@/hooks/useThemePreference";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

export type AdminSection =
  | "appointments"
  | "requests"
  | "userDetails"
  | "clients"
  | "team"
  | "reports"
  | "liveSheet"
  | "paymentProofs"
  | "paymentQr"
  | "profile";

const ITEM_DEFS: { key: AdminSection; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { key: "appointments", labelKey: "ops.nav.appointments", icon: ClipboardList },
  { key: "requests", labelKey: "ops.nav.requests", icon: PhoneIncoming },
  { key: "userDetails", labelKey: "ops.nav.userDetails", icon: UserPlus },
  { key: "clients", labelKey: "ops.nav.clients", icon: Users },
  { key: "team", labelKey: "ops.nav.team", icon: UserCog },
  { key: "reports", labelKey: "ops.nav.reports", icon: FileText },
  { key: "liveSheet", labelKey: "ops.nav.liveSheet", icon: Table2 },
  { key: "paymentProofs", labelKey: "ops.nav.paymentProofs", icon: Receipt },
  { key: "paymentQr", labelKey: "ops.nav.paymentQr", icon: QrCode },
];

const PANEL_WIDTH = 280;

/**
 * Slide-in drawer sidebar (2026-08-12) — replaces the earlier top-nav-bar /
 * wrapping-grid designs. Hidden by default on every width, opened via the
 * hamburger in `AdminNavigator`'s thin top bar, closed by tapping the
 * backdrop, selecting a section, or the X — never permanently eats screen
 * width the way an always-visible sidebar would on a phone (explicit choice
 * over the reference's always-visible desktop layout).
 *
 * The search box is a real filter over the 9 section rows below it, not a
 * decorative copy of the reference — this app has no global search feature
 * to fake, but filtering its own menu is a genuine, small, correct use of
 * the same visual slot.
 *
 * Light/Dark lives in the header (Sun/Moon icon button, next to the close X)
 * rather than buried at the bottom of a long list — uses NativeWind's real
 * `dark:` variant system (`useThemePreference`, persisted), functional, not
 * decorative.
 *
 * IMPORTANT: `Animated.View` here carries ONLY transform/opacity via its
 * `style` prop, never a NativeWind `className` — mixing the two on a raw
 * `Animated.View` (from "react-native", not a NativeWind-wrapped component)
 * silently drops the className-derived background color, letting whatever
 * is behind the modal show straight through. Every actual visual style
 * (background, borders, text) lives on a plain nested `View`/`Pressable`
 * instead, which NativeWind always intercepts correctly.
 */
export function AdminSidebar({
  visible,
  onClose,
  active,
  onSelect,
  requestsBadge,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  active: AdminSection;
  onSelect: (key: AdminSection) => void;
  requestsBadge?: number;
  profile: Pick<Profile, "id" | "full_name" | "avatar_path" | "updated_at" | "role"> | null;
}) {
  const { t } = useLanguage();
  const ITEMS = ITEM_DEFS.map((i) => ({ key: i.key, label: t(i.labelKey), icon: i.icon }));
  const [query, setQuery] = useState("");
  const { colorScheme, toggle } = useThemePreference();
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -PANEL_WIDTH,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, backdropOpacity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((i) => i.label.toLowerCase().includes(q));
  }, [query]);

  const select = (key: AdminSection) => {
    onSelect(key);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: backdropOpacity }}>
          <Pressable style={{ flex: 1 }} className="bg-black/50" onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: PANEL_WIDTH,
            transform: [{ translateX }],
          }}
        >
          <View className="flex-1 bg-white dark:bg-slate-900">
            <View className="flex-row items-center justify-between border-b border-gray-100 px-4 pb-3 pt-12 dark:border-slate-700">
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900 dark:text-white">{t("ops.brand")}</Text>
                <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {profile?.role ? ROLE_LABELS[profile.role] : "Admin"} {t("ops.portal")}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Pressable onPress={toggle} hitSlop={10} className="rounded-lg p-1.5 active:bg-gray-100 dark:active:bg-slate-800">
                  {colorScheme === "dark" ? <Sun size={19} color="#9ca3af" /> : <Moon size={19} color="#6b7280" />}
                </Pressable>
                <Pressable onPress={onClose} hitSlop={10} className="rounded-lg p-1.5 active:bg-gray-100 dark:active:bg-slate-800">
                  <X size={19} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            <View className="px-4 pt-3">
              <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <Search size={15} color="#9ca3af" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("ops.searchMenu")}
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-sm text-gray-900 dark:text-white"
                />
              </View>
            </View>

            <ScrollView className="flex-1 px-2 pt-3" showsVerticalScrollIndicator={false}>
              <Text className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t("ops.menu")}
              </Text>
              {filtered.map((item) => {
                const isActive = item.key === active;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => select(item.key)}
                    className={`mb-0.5 flex-row items-center gap-3 rounded-lg px-3 py-2.5 active:opacity-70 ${
                      isActive ? "bg-teal-50 dark:bg-teal-400/10" : ""
                    }`}
                  >
                    <Icon size={18} color={isActive ? "#12809E" : "#6b7280"} />
                    <Text
                      className={`flex-1 text-sm ${
                        isActive ? "font-semibold" : "font-medium text-gray-700 dark:text-gray-300"
                      }`}
                      style={isActive ? { color: "#12809E" } : undefined}
                    >
                      {item.label}
                    </Text>
                    {item.key === "requests" && requestsBadge ? (
                      <View className="h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
                        <Text className="text-[10px] font-bold text-white">{requestsBadge}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => select("profile")}
              className="flex-row items-center gap-3 border-t border-gray-100 px-4 py-3 active:opacity-70 dark:border-slate-700"
            >
              {profile ? <ProfilePhoto profile={profile} size={36} /> : null}
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                  {profile?.full_name ?? "—"}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {profile?.role ? ROLE_LABELS[profile.role] : ""}
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
