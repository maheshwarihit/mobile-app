import { useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserPlus } from "lucide-react-native";
import { useAllProfiles, formatLocalDateTime, localPhone } from "@vagewell/shared";
import { PageHeader, Card, Pill, LoadingState, EmptyState } from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { useLanguage } from "@/lib/i18n";

/**
 * SCREEN_ID: ADMIN_USER_DETAILS — every registered client, newest first, a
 * "New" pill until an admin actually opens that person's Client detail page
 * (`profiles.viewed_by_admin_at`, migration 0029 — user asked for a real
 * "seen" signal instead of the earlier fixed-24h-timer version). Port of
 * web/src/app/user-details/page.tsx's final "auto-feed only" shape — the
 * earlier "log a caller with no account" manual-form section was explicitly
 * removed there, so it isn't rebuilt here either. Tapping a row jumps straight
 * into that account's Client detail (via `onOpenClient`, which `AdminNavigator`
 * wires to switch the Clients panel's stack directly to `ClientDetail` instead
 * of its default list — see `ClientsStackNavigator`'s `initialAccountId` —
 * and which is also where `viewed_by_admin_at` actually gets set).
 */
export function AdminUserDetailsScreen({ onOpenClient }: { onOpenClient: (accountId: string) => void }) {
  const { t } = useLanguage();
  const { data: profiles, isLoading } = useAllProfiles(true);

  const recent = useMemo(
    () =>
      (profiles ?? [])
        .filter((p) => p.role === "patient")
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [profiles]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={recent}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={<PageHeader title={t("ops.userDetails.title")} subtitle={t("ops.userDetails.subtitle")} />}
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("ops.userDetails.loading")} />
          ) : (
            <EmptyState icon={UserPlus} title={t("ops.userDetails.empty.title")} description={t("ops.userDetails.empty.description")} />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenClient(item.id)} className="active:opacity-80">
            <Card className="flex-row items-center gap-3 p-3">
              <ProfilePhoto profile={item} size={40} />
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">{item.full_name ?? "—"}</Text>
                  {!item.viewed_by_admin_at ? (
                    <Pill bgClass="bg-red-50 dark:bg-red-400/10" textClass="text-red-600 dark:text-red-400">{t("ops.userDetails.new")}</Pill>
                  ) : null}
                </View>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{localPhone(item.phone) || "—"}</Text>
                <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  {t("ops.userDetails.joined", { date: formatLocalDateTime(item.created_at) })}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
