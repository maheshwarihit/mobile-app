import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Receipt } from "lucide-react-native";
import {
  useAllBookings,
  money,
  formatDate,
  PAYMENT_PROOF_BUCKET,
  type BookingWithNames,
} from "@vagewell/shared";
import { PageHeader, Card, LoadingState, EmptyState } from "@/components/ui";
import { PaymentReviewModal } from "@/components/ops/PaymentReviewModal";
import { useSignedUrl } from "@/lib/signedUrl";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

/**
 * SCREEN_ID: ADMIN_PAYMENT_PROOFS — every booking awaiting proof review in one
 * batch list (thumbnail + name), distinct from the per-booking Review action
 * already on Appointments — this is specifically for working the review queue
 * itself. Port of web/src/app/payment-proofs/page.tsx.
 */
export function AdminPaymentProofsScreen() {
  const { t } = useLanguage();
  const { data: bookings, isLoading, refetch } = useAllBookings(true);
  const [reviewing, setReviewing] = useState<BookingWithNames | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  // Only bookings with a screenshot genuinely awaiting a decision — verified/
  // rejected/pay-at-visit bookings don't belong in a review queue.
  const pending = useMemo(
    () => (bookings ?? []).filter((b) => b.payment_status === "pending_verification" && b.payment_proof_path),
    [bookings]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={pending}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <PageHeader title={t("ops.paymentProofs.title")} subtitle={t("ops.paymentProofs.subtitle")} />
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message={t("ops.paymentProofs.loading")} />
          ) : (
            <EmptyState icon={Receipt} title={t("ops.paymentProofs.empty.title")} description={t("ops.paymentProofs.empty.description")} />
          )
        }
        renderItem={({ item }) => <ProofCard booking={item} onPress={() => setReviewing(item)} />}
      />

      {reviewing ? (
        <PaymentReviewModal key={reviewing.id} booking={reviewing} onClose={() => setReviewing(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function ProofCard({ booking, onPress }: { booking: BookingWithNames; onPress: () => void }) {
  const { t } = useLanguage();
  const { data: signedUrl } = useSignedUrl(PAYMENT_PROOF_BUCKET, booking.payment_proof_path);

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card className="flex-row items-center gap-3 p-3">
        <View className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
          {signedUrl ? (
            <Image source={{ uri: signedUrl }} className="h-full w-full" resizeMode="cover" />
          ) : null}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">{booking.account?.full_name ?? "—"}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {translateServiceName(t, booking.service_name)} · {t("ops.client")}{" "}
            <Text className="font-medium text-purple-700 dark:text-purple-300">{booking.subject_name ?? "—"}</Text>
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {formatDate(booking.start_date)} · {money(booking.total_amount)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
