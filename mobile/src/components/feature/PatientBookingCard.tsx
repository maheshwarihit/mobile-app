import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { toast } from "sonner-native";
import { CalendarClock, Upload, AlertTriangle } from "lucide-react-native";
import { Pill, DangerButton, ConfirmModal, Card } from "@/components/ui";
import { pickImageAsset, assetToProofSource } from "@/lib/upload";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";
import {
  useCancelBooking,
  useReuploadProof,
  paymentStatusMeta,
  bookingStatusMeta,
  formatDate,
  formatSlot,
  money,
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  type Booking,
} from "@vagewell/shared";

export function PatientBookingCard({
  booking,
  subjectName,
  userId,
}: {
  booking: Booking;
  subjectName: string;
  userId: string;
}) {
  const { t } = useLanguage();
  const cancel = useCancelBooking();
  const reupload = useReuploadProof();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pay = paymentStatusMeta(booking.payment_status);
  const status = bookingStatusMeta(booking.booking_status);
  const wasRejected =
    booking.payment_status === "pending" && booking.payment_method === "online" && !!booking.payment_note;

  const onReupload = async () => {
    try {
      const img = await pickImageAsset();
      if (!img) return;
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(img.mimeType)) {
        toast.error(t("bookingCard.error.imageType"));
        return;
      }
      if (img.fileSize > MAX_UPLOAD_BYTES) {
        toast.error(t("bookingCard.error.fileSize"));
        return;
      }
      reupload.mutate({ bookingId: booking.id, userId, source: assetToProofSource(img) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("bookingCard.error.pickerFailed"));
    }
  };

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-start gap-3">
          <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <CalendarClock size={18} color={BRAND} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{translateServiceName(t, booking.service_name)}</Text>
            <Text className="text-xs text-gray-500">
              {t("bookingCard.client")} <Text className="font-medium text-purple-600">{subjectName}</Text>
            </Text>
            <Text className="mt-1 text-sm text-gray-600">
              {formatDate(booking.start_date)} · {formatSlot(booking.time_slot)} · {booking.num_days}{" "}
              {t("bookingCard.days", { plural: booking.num_days > 1 ? "s" : "" })}
            </Text>
            {booking.total_amount != null ? (
              <Text className="mt-1 text-sm font-semibold text-gray-900">
                {t("bookingCard.amount", { amount: money(booking.total_amount) })}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="items-end gap-1">
          <Pill bgClass={pay.bg} textClass={pay.text}>{pay.label}</Pill>
          <Pill bgClass={status.bg} textClass={status.text}>{status.label}</Pill>
        </View>
      </View>

      {wasRejected ? (
        <View className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <View className="flex-row items-center gap-1.5">
            <AlertTriangle size={14} color="#92400e" />
            <Text className="text-xs font-medium text-amber-800">{t("bookingCard.paymentRejected")}</Text>
          </View>
          {booking.payment_note ? <Text className="mt-1 text-xs text-amber-700">{booking.payment_note}</Text> : null}
          <Pressable
            onPress={onReupload}
            disabled={reupload.isPending}
            className="mt-2 flex-row items-center gap-1.5 self-start rounded-lg bg-purple-600 px-3 py-1.5 active:bg-purple-700"
          >
            <Upload size={13} color="#fff" />
            <Text className="text-xs font-medium text-white">
              {reupload.isPending ? t("bookingCard.uploading") : t("bookingCard.reuploadProof")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {booking.booking_status === "requested" || booking.booking_status === "approved" ? (
        <View className="mt-3 flex-row justify-end">
          <DangerButton onPress={() => setConfirmOpen(true)}>{t("bookingCard.cancel")}</DangerButton>
        </View>
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        title={t("bookingCard.confirmCancel.title")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          cancel.mutate(booking.id);
          setConfirmOpen(false);
        }}
        confirmLabel={t("bookingCard.confirmCancel.confirm")}
        cancelLabel={t("bookingCard.confirmCancel.cancel")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">
          {t("bookingCard.confirmCancel.body", { service: translateServiceName(t, booking.service_name), date: formatDate(booking.start_date) })}
        </Text>
      </ConfirmModal>
    </Card>
  );
}
