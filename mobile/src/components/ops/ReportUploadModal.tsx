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
        setErr("Please upload a PNG, JPG, WEBP, or PDF file.");
        return;
      }
      if (picked.size > MAX_REPORT_UPLOAD_BYTES) {
        setErr("File exceeds the 10 MB limit.");
        return;
      }
      setFile(picked);
    } catch {
      setErr("Could not open the file picker.");
    }
  };

  if (!booking) return null;

  const submit = () => {
    if (!file) {
      setErr("Choose a file first.");
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
    <AppModal visible onClose={onClose} title="Upload Report">
      <Text className="mb-4 text-sm text-gray-500">
        {booking.service_name} for <Text className="font-medium text-gray-700">{booking.subject_name}</Text>
      </Text>

      <View className="gap-4">
        <SelectSheet
          label="Report type"
          value={reportType}
          onValueChange={(v) => setReportType(v as ReportType)}
          options={TYPE_OPTIONS}
        />

        <View>
          <Text className="mb-1.5 text-sm font-medium text-gray-700">File</Text>
          <Pressable
            onPress={pick}
            className="flex-row items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 active:border-purple-400"
          >
            <UploadCloud size={18} color="#9ca3af" />
            <Text className="flex-1 text-sm text-gray-600" numberOfLines={1}>
              {file ? file.name : "Choose a PNG, JPG, WEBP, or PDF file"}
            </Text>
          </Pressable>
        </View>

        <TextareaInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Any context for this report…"
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
        <OutlineButton onPress={onClose}>Cancel</OutlineButton>
        <PrimaryButton loading={upload.isPending} onPress={submit}>
          Upload
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
