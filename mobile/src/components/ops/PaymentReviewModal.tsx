import { useState } from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { Check, Ban, Save } from "lucide-react-native";
import {
  useVerifyPayment,
  useRejectPayment,
  useSetBookingAmount,
  formatDate,
  formatSlot,
  PAYMENT_PROOF_BUCKET,
  type BookingWithNames,
} from "@vagewell/shared";
import {
  AppModal,
  PrimaryButton,
  OutlineButton,
  DangerButton,
  SmallPrimaryButton,
  TextareaInput,
  FormInput,
  Spinner,
} from "@/components/ui";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

/**
 * Admin reviews an uploaded payment screenshot and settles or rejects it.
 * Mirrors web/src/components/PaymentReviewModal.tsx — including the cancelled
 * case rendering read-only, because `verify_payment()`/`reject_payment()`
 * reject a cancelled booking server-side (0008) and offering the buttons
 * anyway would just produce an error toast.
 *
 * The caller must key this on `booking.id` so a fresh instance — with fresh
 * useState defaults — mounts per booking.
 */
export function PaymentReviewModal({
  booking,
  onClose,
}: {
  booking: BookingWithNames | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  // Not pre-filled from any catalog calculation — admin types the real
  // amount fresh, based on what actually happened at the visit (migration
  // 0044). Pre-filled only from a value admin already saved earlier, so
  // re-opening Review doesn't lose prior work.
  const [amount, setAmount] = useState(booking?.total_amount != null ? String(booking.total_amount) : "");
  const verify = useVerifyPayment();
  const reject = useRejectPayment();
  const setBookingAmount = useSetBookingAmount();
  const { data: signedUrl, isLoading: urlLoading } = useSignedUrl(
    PAYMENT_PROOF_BUCKET,
    booking?.payment_proof_path
  );

  if (!booking) return null;

  const parsedAmount = Number(amount);
  const amountValid = amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount >= 0;

  const doSaveAmount = () => {
    if (!amountValid) return;
    setBookingAmount.mutate({ id: booking.id, amount: parsedAmount });
  };
  const doVerify = () => verify.mutate(booking.id, { onSuccess: onClose });
  const doReject = () => reject.mutate({ id: booking.id, reason }, { onSuccess: onClose });

  return (
    <AppModal visible onClose={onClose} title={t("modal.paymentReview.title")}>
      <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
        <View className="mb-4 gap-1.5">
          <Row label={t("modal.paymentReview.account")} value={booking.account?.full_name ?? "—"} />
          <Row label={t("modal.paymentReview.careFor")} value={booking.subject_name ?? "—"} />
          <Row label={t("modal.paymentReview.service")} value={translateServiceName(t, booking.service_name)} />
          <Row
            label={t("modal.paymentReview.when")}
            value={`${formatDate(booking.start_date)} · ${formatSlot(booking.time_slot)} · ${booking.num_days}d`}
          />
          <Row
            label={t("modal.paymentReview.method")}
            value={booking.payment_method === "online" ? t("modal.paymentReview.methodOnline") : t("modal.paymentReview.methodDirect")}
          />
        </View>

        {booking.booking_status !== "cancelled" ? (
          <View className="mb-4 flex-row items-end gap-2">
            <View className="flex-1">
              <FormInput
                label={t("modal.paymentReview.amountLabel")}
                value={amount}
                onChangeText={setAmount}
                placeholder={t("modal.paymentReview.amountPlaceholder")}
                keyboardType="decimal-pad"
              />
            </View>
            <SmallPrimaryButton
              icon={Save}
              disabled={!amountValid || setBookingAmount.isPending}
              onPress={doSaveAmount}
            >
              {t("modal.paymentReview.saveAmount")}
            </SmallPrimaryButton>
          </View>
        ) : (
          <Row label={t("modal.paymentReview.total")} value={booking.total_amount != null ? String(booking.total_amount) : "—"} />
        )}

        <Text className="mb-1.5 text-sm font-medium text-gray-700">{t("modal.paymentReview.proofLabel")}</Text>
        {booking.payment_proof_path ? (
          signedUrl ? (
            // Tap opens the full-size image — the inline preview is contained
            // to a fixed height and a screenshot of a UPI receipt is often
            // taller than it is wide.
            <Pressable onPress={() => openUrl(signedUrl)}>
              <Image
                source={{ uri: signedUrl }}
                className="h-64 w-full rounded-lg border border-gray-200"
                resizeMode="contain"
              />
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
              {urlLoading ? <Spinner /> : null}
              <Text className="text-sm text-gray-400">
                {urlLoading ? t("modal.paymentReview.loadingProof") : t("modal.paymentReview.proofLoadFailed")}
              </Text>
            </View>
          )
        ) : (
          <View className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Text className="text-sm text-gray-500">{t("modal.paymentReview.noScreenshot")}</Text>
          </View>
        )}

        {showReject ? (
          <View className="mt-4">
            <TextareaInput
              label={t("modal.paymentReview.rejectionReason")}
              value={reason}
              onChangeText={setReason}
              placeholder={t("modal.paymentReview.rejectionPlaceholder")}
              rows={2}
              maxLength={500}
            />
          </View>
        ) : null}
      </ScrollView>

      <View className="mt-5 flex-row items-center justify-end gap-3">
        {booking.booking_status === "cancelled" ? (
          <>
            <Text className="flex-1 text-xs text-gray-500">{t("modal.paymentReview.cancelledNote")}</Text>
            <OutlineButton onPress={onClose}>{t("modal.paymentReview.close")}</OutlineButton>
          </>
        ) : !showReject ? (
          <>
            {booking.total_amount == null ? (
              <Text className="flex-1 text-xs text-gray-500">{t("modal.paymentReview.amountRequiredHint")}</Text>
            ) : null}
            <OutlineButton icon={Ban} onPress={() => setShowReject(true)}>
              {t("modal.paymentReview.reject")}
            </OutlineButton>
            <PrimaryButton icon={Check} loading={verify.isPending} disabled={booking.total_amount == null} onPress={doVerify}>
              {t("modal.paymentReview.markPaid")}
            </PrimaryButton>
          </>
        ) : (
          <>
            <OutlineButton onPress={() => setShowReject(false)}>{t("modal.paymentReview.back")}</OutlineButton>
            <DangerButton onPress={doReject}>{t("modal.paymentReview.confirmReject")}</DangerButton>
          </>
        )}
      </View>
    </AppModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900">{value}</Text>
    </View>
  );
}
