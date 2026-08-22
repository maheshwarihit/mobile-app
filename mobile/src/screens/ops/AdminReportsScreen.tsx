import { useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Eye, FileText } from "lucide-react-native";
import {
  useAllReports,
  useReviewReport,
  formatLocalDateTime,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  type ReportUpload,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, FormInput, LoadingState, EmptyState, SmallPrimaryButton } from "@/components/ui";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { useAuth } from "@/providers/AuthProvider";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

/**
 * SCREEN_ID: ADMIN_REPORTS — every report ever uploaded, reviewed or not, in
 * one searchable list. Port of web/src/app/reports/page.tsx. **Release** (the
 * `review_report()` RPC) is admin-only server-side — gated here to match,
 * since a leaf_node would only get a 403 from it (they don't reach this
 * screen at all, though: it's an admin-only nav item).
 */
export function AdminReportsScreen() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const { data: reports, isLoading } = useAllReports(true);
  const review = useReviewReport();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports ?? [];
    return (reports ?? []).filter((r) =>
      [r.patient_name, r.service_name, r.file_name, REPORT_TYPE_LABELS[r.report_type]]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [reports, query]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader title={t("ops.reports.title")} subtitle={t("ops.reports.subtitle")} />
            <View className="mb-4">
              <FormInput
                label={t("ops.reports.searchLabel")}
                value={query}
                onChangeText={setQuery}
                placeholder={t("ops.reports.searchPlaceholder")}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("ops.reports.loading")} />
          ) : (
            <EmptyState icon={FileText} title={t("ops.reports.empty.title")} description={t("ops.reports.empty.description")} />
          )
        }
        renderItem={({ item }) => (
          <ReportRow report={item} canRelease={role === "admin"} onRelease={() => review.mutate(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}

function ReportRow({
  report,
  canRelease,
  onRelease,
}: {
  report: ReportUpload;
  canRelease: boolean;
  onRelease: () => void;
}) {
  const { t } = useLanguage();
  const { data: url } = useSignedUrl(MEDICAL_REPORT_BUCKET, report.storage_path);

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">
            {report.file_name ?? REPORT_TYPE_LABELS[report.report_type]}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {report.service_name ? translateServiceName(t, report.service_name) : "—"} · {report.patient_name ?? "—"}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {t("ops.reports.uploaded", { date: formatLocalDateTime(report.created_at) })}
          </Text>
        </View>
        {report.reviewed ? (
          <Pill bgClass="bg-emerald-50 dark:bg-emerald-400/10" textClass="text-emerald-700 dark:text-emerald-400">{t("ops.released")}</Pill>
        ) : (
          <Pill bgClass="bg-amber-50 dark:bg-amber-400/10" textClass="text-amber-700 dark:text-amber-400">{t("ops.awaitingReview")}</Pill>
        )}
      </View>

      <View className="mt-3 flex-row items-center gap-5 border-t border-gray-100 pt-3 dark:border-slate-700">
        {url ? <CardAction icon={Eye} label={t("ops.view")} onPress={() => openUrl(url)} tone="muted" /> : null}
        {canRelease && !report.reviewed ? (
          <View className="ml-auto">
            <SmallPrimaryButton icon={CheckCircle2} onPress={onRelease}>
              {t("ops.reports.release")}
            </SmallPrimaryButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
