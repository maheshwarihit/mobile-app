import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { UploadCloud, Plus, X } from "lucide-react-native";
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
import { pickReportFiles, fileToProofSource, type PickedFile } from "@/lib/reportFile";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";

const TYPE_OPTIONS = REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }));

/**
 * Caregiver/admin uploads one or more reports against a booking in one pass
 * (e.g. a multi-page lab result, or a prescription plus a scan) — each file
 * becomes its own `report_uploads` row (the schema is one file per row), all
 * sharing the report type/note picked once for the whole batch. Mirrors
 * web/src/components/ReportUploadModal.tsx's original single-file shape,
 * extended to a picked-files list with per-file remove before submitting.
 * An `AFTER INSERT` trigger advances the booking to `report_uploaded` on the
 * first row; the report stays invisible to the client until an admin
 * releases it.
 */
export function ReportUploadModal({
  booking,
  onClose,
}: {
  booking: BookingWithNames | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [reportType, setReportType] = useState<ReportType>("medical_report");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const upload = useUploadReport();

  const pick = async () => {
    setErr(null);
    try {
      const picked = await pickReportFiles();
      if (!picked.length) return; // cancelled
      // Validated here as well as in the mutation so the error lands next to
      // the picker rather than as a toast after a pointless upload attempt.
      const bad = picked.find((f) => !ALLOWED_REPORT_MIME.includes(f.mimeType as (typeof ALLOWED_REPORT_MIME)[number]));
      if (bad) {
        setErr(t("modal.reportUpload.error.fileType"));
        return;
      }
      const tooBig = picked.find((f) => f.size > MAX_REPORT_UPLOAD_BYTES);
      if (tooBig) {
        setErr(t("modal.reportUpload.error.fileSize"));
        return;
      }
      setFiles((prev) => [...prev, ...picked]);
    } catch {
      setErr(t("modal.reportUpload.error.pickerFailed"));
    }
  };

  const removeFile = (uri: string) => setFiles((prev) => prev.filter((f) => f.uri !== uri));

  if (!booking) return null;

  const submit = async () => {
    if (!files.length) {
      setErr(t("modal.reportUpload.error.chooseFile"));
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      // Sequential, not Promise.all — each upload writes to the same
      // booking_id/user.id storage folder with a Date.now()-based filename,
      // and running them one at a time keeps that naturally unique.
      for (const f of files) {
        await upload.mutateAsync({
          bookingId: booking.id,
          reportType,
          note,
          fileName: f.name,
          source: fileToProofSource(f),
        });
      }
      setFiles([]);
      setNote("");
      onClose();
    } catch {
      // useUploadReport() already toasts the specific error; leave the
      // modal open with whatever files hadn't uploaded yet still picked,
      // so the caregiver can retry without re-selecting everything.
    } finally {
      setSubmitting(false);
    }
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

          {files.length ? (
            <View className="mb-2 gap-2">
              {files.map((f) => (
                <View key={f.uri} className="flex-row items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <Text className="flex-1 text-sm text-gray-700" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Pressable onPress={() => removeFile(f.uri)} hitSlop={8} className="active:opacity-60">
                    <X size={16} color="#9ca3af" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={pick}
            className="flex-row items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 active:border-purple-400"
          >
            {files.length ? <Plus size={18} color="#9ca3af" /> : <UploadCloud size={18} color="#9ca3af" />}
            <Text className="flex-1 text-sm text-gray-600" numberOfLines={1}>
              {files.length ? t("modal.reportUpload.addMore") : t("modal.reportUpload.choosePlaceholder")}
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
        <PrimaryButton loading={submitting || upload.isPending} onPress={submit}>
          {files.length > 1 ? t("modal.reportUpload.uploadCount", { count: files.length }) : t("modal.reportUpload.upload")}
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
