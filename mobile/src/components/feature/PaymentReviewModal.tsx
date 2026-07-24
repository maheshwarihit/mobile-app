import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Image, Linking, useWindowDimensions } from "react-native";
import { X, Check, Ban, FileImage } from "lucide-react-native";
import { PrimaryButton, DangerButton, OutlineButton, TextareaInput } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  useVerifyPayment,
  useRejectPayment,
  money,
  formatDate,
  formatSlot,
  PAYMENT_PROOF_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type BookingWithNames,
} from "@vagewell/shared";

export function PaymentReviewModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const verify = useVerifyPayment();
  const reject = useRejectPayment();

  useEffect(() => {
    setSignedUrl(null);
    setReason("");
    setShowReject(false);
    if (booking?.payment_proof_path) {
      supabase.storage
        .from(PAYMENT_PROOF_BUCKET)
        .createSignedUrl(booking.payment_proof_path, SIGNED_URL_TTL_SECONDS)
        .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
    }
  }, [booking]);

  const doVerify = () => booking && verify.mutate(booking.id, { onSuccess: onClose });
  const doReject = () => booking && reject.mutate({ id: booking.id, reason }, { onSuccess: onClose });

  return (
    <Modal visible={!!booking} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          style={{ maxHeight: height * 0.85 }}
          className="w-full max-w-md rounded-2xl border border-gray-100 bg-white"
          onPress={() => {}}
        >
          {booking ? (
            <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">Review Payment</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                  <X size={18} color="#9ca3af" />
                </Pressable>
              </View>

              <View className="mb-4 gap-1.5">
                <Row label="Account" value={booking.account?.full_name ?? "—"} />
                <Row label="Care for" value={booking.subject_name ?? "—"} />
                <Row label="Service" value={booking.service_name} />
                <Row
                  label="When"
                  value={`${formatDate(booking.start_date)} · ${formatSlot(booking.time_slot)} · ${booking.num_days}d`}
                />
                <Row label="Total" value={money(booking.total_amount)} />
                <Row label="Method" value={booking.payment_method} />
              </View>

              <Text className="mb-1.5 text-sm font-medium text-gray-700">Payment proof</Text>
              {booking.payment_proof_path ? (
                signedUrl ? (
                  <Pressable onPress={() => Linking.openURL(signedUrl)}>
                    <Image
                      source={{ uri: signedUrl }}
                      className="h-64 w-full rounded-lg border border-gray-200"
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : (
                  <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <FileImage size={16} color="#9ca3af" />
                    <Text className="text-sm text-gray-400">Loading proof…</Text>
                  </View>
                )
              ) : (
                <View className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Text className="text-sm text-gray-500">No screenshot (direct / pay-at-visit).</Text>
                </View>
              )}

              {showReject ? (
                <View className="mt-4">
                  <TextareaInput
                    label="Rejection reason"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g. Screenshot unclear / amount mismatch"
                    rows={2}
                    maxLength={500}
                  />
                </View>
              ) : null}

              {/* A cancelled visit is read-only: the proof stays visible so staff
                  can see what was uploaded, but there is no payment decision left
                  to take. Reachable from the Payment proofs screen as well as the
                  dashboard, so the rule lives here rather than on the caller. */}
              <View className="mt-5 flex-row items-center justify-end gap-2">
                {booking.booking_status === "cancelled" ? (
                  <>
                    <Text className="flex-1 text-xs text-gray-500">
                      This booking was cancelled. Payment can no longer be verified.
                    </Text>
                    <OutlineButton onPress={onClose}>Close</OutlineButton>
                  </>
                ) : !showReject ? (
                  <>
                    <OutlineButton icon={Ban} onPress={() => setShowReject(true)}>
                      Reject
                    </OutlineButton>
                    <PrimaryButton icon={Check} loading={verify.isPending} onPress={doVerify}>
                      Mark Paid
                    </PrimaryButton>
                  </>
                ) : (
                  <>
                    <OutlineButton onPress={() => setShowReject(false)}>Back</OutlineButton>
                    <DangerButton onPress={doReject}>Confirm Reject</DangerButton>
                  </>
                )}
              </View>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium capitalize text-gray-900">{value}</Text>
    </View>
  );
}
