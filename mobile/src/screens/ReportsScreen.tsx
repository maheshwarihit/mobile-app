import { useMemo } from "react";
import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { FileText, Download } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner, Card } from "@/components/ui";
import { BRAND } from "@/theme";
import { supabase } from "@/lib/supabase";
import {
  useMyReports,
  useMyBookings,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  formatLocalDateTime,
  type ReportUpload,
} from "@vagewell/shared";

// SCREEN_ID: REPORTS — reviewed medical reports/prescriptions/images uploaded
// by staff/leaf_node during a visit. Unreviewed uploads never reach this list
// (RLS only returns reports the admin has released).
export function ReportsScreen() {
  const { data: reports, isLoading, error } = useMyReports(true);
  const { data: bookings } = useMyBookings();

  const bookingLabel = useMemo(() => {
    const map = new Map((bookings ?? []).map((b) => [b.id, b.service_name]));
    return (r: ReportUpload) => map.get(r.booking_id) ?? "Visit";
  }, [bookings]);

  const openReport = async (r: ReportUpload) => {
    const { data, error: signErr } = await supabase.storage
      .from(MEDICAL_REPORT_BUCKET)
      .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !data?.signedUrl) {
      toast.error("Could not open this report. Please try again.");
      return;
    }
    Linking.openURL(data.signedUrl);
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title="Reports" subtitle="Medical reports, prescriptions, and images from your visits." />

        {error ? <ErrorBanner message="Could not load your reports." /> : null}
        {isLoading ? <LoadingState message="Loading reports…" /> : null}

        <FlatList
          data={reports ?? []}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 pb-6"
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                description="Reports uploaded by care staff appear here once released by our team."
              />
            ) : null
          }
          renderItem={({ item: r }) => (
            <Pressable onPress={() => openReport(r)}>
              <Card className="flex-row items-center gap-3 p-4">
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <FileText size={18} color={BRAND} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{bookingLabel(r)}</Text>
                  <Text className="text-xs text-gray-500">
                    {REPORT_TYPE_LABELS[r.report_type]} · {formatLocalDateTime(r.created_at)}
                  </Text>
                  {r.note ? <Text className="mt-0.5 text-xs text-gray-400">{r.note}</Text> : null}
                </View>
                <Download size={16} color="#9ca3af" />
              </Card>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
