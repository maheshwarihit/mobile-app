import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Image, FlatList } from "react-native";
import { FileImage } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { Card, Pill, LoadingState, EmptyState } from "@/components/ui";
import { PaymentReviewModal } from "@/components/feature/PaymentReviewModal";
import { supabase } from "@/lib/supabase";
import {
  useAllBookings,
  money,
  formatDate,
  PAYMENT_STATUS_META,
  PAYMENT_PROOF_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type BookingWithNames,
} from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

// Admin module: every booking that carries an uploaded payment proof, showing the
// patient name + the screenshot. Tapping a card opens the existing review modal
// (Verify / Reject). Thumbnails are batch-signed (private bucket, 5-min URLs).
export function AdminPaymentProofsScreen({ navigation }: AdminScreenProps<"AdminPaymentProofs">) {
  const { data: bookings, isLoading } = useAllBookings(true);
  const [selected, setSelected] = useState<BookingWithNames | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const withProof = useMemo(
    () => (bookings ?? []).filter((b): b is BookingWithNames & { payment_proof_path: string } => !!b.payment_proof_path),
    [bookings]
  );

  useEffect(() => {
    const paths = withProof.map((b) => b.payment_proof_path);
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(PAYMENT_PROOF_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        for (const item of data) {
          if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
        }
        setUrls(map);
      });
    return () => {
      cancelled = true;
    };
  }, [withProof]);

  return (
    <AdminScreen title="Payment proofs" onBack={() => navigation.goBack()}>
      <FlatList
        data={withProof}
        keyExtractor={(b) => b.id}
        contentContainerClassName="px-5 pt-4 pb-8 gap-3"
        ListHeaderComponent={
          <Text className="mb-1 text-xs text-gray-500">
            Screenshots patients uploaded as proof of payment. Tap a card to review, verify, or reject.
          </Text>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon={FileImage} title="No payment proofs" description="Uploaded screenshots appear here." />
          ) : null
        }
        renderItem={({ item: b }) => {
          const meta = PAYMENT_STATUS_META[b.payment_status];
          const url = urls[b.payment_proof_path];
          return (
            <Pressable onPress={() => setSelected(b)} className="active:opacity-80">
              <Card className="p-4">
                <View className="flex-row gap-3">
                  {url ? (
                    <Image source={{ uri: url }} className="h-20 w-20 rounded-lg border border-gray-200" resizeMode="cover" />
                  ) : (
                    <View className="h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                      <FileImage size={18} color="#9ca3af" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{b.account?.full_name ?? "—"}</Text>
                    <Text className="text-xs text-gray-500">for {b.subject_name ?? "—"}</Text>
                    <Text className="mt-1 text-sm text-gray-600">
                      {b.service_name} · {money(b.total_amount)}
                    </Text>
                    <Text className="text-xs text-gray-500">{formatDate(b.start_date)}</Text>
                    <View className="mt-1.5 self-start">
                      <Pill bgClass={meta.bg} textClass={meta.text}>
                        {meta.label}
                      </Pill>
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      {isLoading ? <LoadingState message="Loading payment proofs…" /> : null}
      <PaymentReviewModal booking={selected} onClose={() => setSelected(null)} />
    </AdminScreen>
  );
}
