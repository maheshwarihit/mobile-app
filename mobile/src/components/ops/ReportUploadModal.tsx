import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { UploadCloud } from "lucide-react-native";
import {
  useUploadReport,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  ALLOWED_REPORT_MIME,
  MAX_REPORT_UPLOAD_BYTES,
  type BookingWithNames,
  type ReportType,
} from "@vagewell/shared";
import {
  AppModal,
  SelectSheet,
  TextareaInput,
  PrimaryButton,
  OutlineButton,
  ErrorBanner,
} from "@/components/ui";
import { pickReportFile, fileToProofSource, type PickedFile } from "@/lib/reportFile";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

const TYPE_OPTIONS = REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }));

/**
 * Caregiver/admin uploads a report against a booking. Mirrors
 * web/src/components/ReportUploadModal.tsx — an AFTER INSERT trigger advances
 * the booking to `report_uploaded`, and the report stays invisible to the
 * client until an admin releases it.
 */
export function ReportUploadModal({
  booking,
  onClose,
}: {
  booking: BookingWithNames | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [reportType, setReportType] = useState<ReportType>("medical_report");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const upload = useUploadReport();

  const pick = async () => {
    setErr(null);
    try {
      const picked = await pickReportFile();
      if (!picked) return; // cancelled
      // Validated here as well as in the mutation so the error lands next to
      // the picker rather than as a toast after a pointless upload attempt.
      if (!ALLOWED_REPORT_MIME.includes(picked.mimeType as (typeof ALLOWED_REPORT_MIME)[number])) {
        setErr(t("modal.reportUpload.error.fileType"));
        return;
      }
      if (picked.size > MAX_REPORT_UPLOAD_BYTES) {
        setErr(t("modal.reportUpload.error.fileSize"));
        return;
      }
      setFile(picked);
    } catch {
      setErr(t("modal.reportUpload.error.pickerFailed"));
    }
  };

  if (!booking) return null;

  const submit = () => {
    if (!file) {
      setErr(t("modal.reportUpload.error.chooseFile"));
      return;
    }
    setErr(null);
    upload.mutate(
      {
        bookingId: booking.id,
        reportType,
        note,
        fileName: file.name,
        source: fileToProofSource(file),
      },
      {
        onSuccess: () => {
          setFile(null);
          setNote("");
          onClose();
        },
      }
    );
  };

  return (
    <AppModal visible onClose={onClose} title={t("modal.reportUpload.title")}>
      <Text className="mb-4 text-sm text-gray-500">
        {t("modal.reportUpload.serviceFor", { service: translateServiceName(t, booking.service_name), name: booking.subject_name ?? "" })}
      </Text>

      <View className="gap-4">
        <SelectSheet
          label={t("modal.reportUpload.reportType")}
          value={reportType}
          onValueChange={(v) => setReportType(v as ReportType)}
          options={TYPE_OPTIONS}
        />

        <View>
          <Text className="mb-1.5 text-sm font-medium text-gray-700">{t("modal.reportUpload.file")}</Text>
          <Pressable
            onPress={pick}
            className="flex-row items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 active:border-purple-400"
          >
            <UploadCloud size={18} color="#9ca3af" />
            <Text className="flex-1 text-sm text-gray-600" numberOfLines={1}>
              {file ? file.name : t("modal.reportUpload.choosePlaceholder")}
            </Text>
          </Pressable>
        </View>

        <TextareaInput
          label={t("modal.reportUpload.note")}
          value={note}
          onChangeText={setNote}
          placeholder={t("modal.reportUpload.notePlaceholder")}
          rows={2}
          maxLength={1000}
        />
      </View>

      {err ? (
        <View className="mt-3">
          <ErrorBanner message={err} />
        </View>
      ) : null}

      <View className="mt-6 flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>{t("modal.reportUpload.cancel")}</OutlineButton>
        <PrimaryButton loading={upload.isPending} onPress={submit}>
          {t("modal.reportUpload.upload")}
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
