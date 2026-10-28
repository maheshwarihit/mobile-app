import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MessageSquareText, Star, Trash2 } from "lucide-react-native";
import { localPhone, formatLocalDateTime } from "@vagewell/shared";
import { PageHeader, Card, LoadingState, EmptyState, ConfirmModal } from "@/components/ui";
import { useAllFeedback, useDeleteFeedback, type Feedback } from "@/lib/feedback";
import { useLanguage } from "@/lib/i18n";
import { WARN } from "@/theme";

/**
 * SCREEN_ID: FEEDBACK — every patient's feedback (star rating + message),
 * newest first, with the average rating on top. Admin-only, both here and in
 * RLS (feedback_select is `account_id = auth.uid() or is_admin()`).
 */
export function AdminFeedbackScreen() {
  const { t } = useLanguage();
  const { data: items, isLoading, isError, refetch } = useAllFeedback(true);
  const remove = useDeleteFeedback();
  const [deleting, setDeleting] = useState<Feedback | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const list = items ?? [];
  const average = list.length ? list.reduce((sum, f) => sum + f.rating, 0) / list.length : 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={list}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader title={t("ops.feedback.title")} subtitle={t("ops.feedback.subtitle")} />
            {list.length ? (
              <Card className="mb-4 flex-row items-center gap-3 p-4">
                <Star size={22} color={WARN} fill={WARN} />
                <Text className="text-base font-bold text-gray-900 dark:text-white">
                  {t("ops.feedback.average", { avg: average.toFixed(1), count: list.length })}
                </Text>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("common.loading")} />
          ) : isError ? (
            <Text className="text-sm text-gray-500">{t("ops.feedback.loadFailed")}</Text>
          ) : (
            <EmptyState icon={MessageSquareText} title={t("ops.feedback.empty")} description={t("ops.feedback.subtitle")} />
          )
        }
        renderItem={({ item: f }) => (
          <Card className="p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">{f.account?.full_name ?? "—"}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{localPhone(f.account?.phone) || "—"}</Text>
              </View>
              <Pressable
                onPress={() => setDeleting(f)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("common.delete")}
                className="active:opacity-70"
              >
                <Trash2 size={16} color="#9ca3af" />
              </Pressable>
            </View>
            <View className="mt-2 flex-row gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={16} color={n <= f.rating ? WARN : "#d1d5db"} fill={n <= f.rating ? WARN : "transparent"} />
              ))}
            </View>
            {f.message ? <Text className="mt-2 text-sm text-gray-700 dark:text-gray-200">{f.message}</Text> : null}
            <Text className="mt-2 text-xs text-gray-400 dark:text-gray-500">{formatLocalDateTime(f.created_at)}</Text>
          </Card>
        )}
      />
      <ConfirmModal
        open={!!deleting}
        title={t("ops.feedback.deleteTitle")}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(null);
        }}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmDanger
      />
    </SafeAreaView>
  );
}
