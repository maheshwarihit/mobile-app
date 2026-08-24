import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Eye, Trash2, Pencil } from "lucide-react-native";
import { useDeleteReport, useRenameReport, formatLocalDateTime, MEDICAL_REPORT_BUCKET, type ReportUpload } from "@vagewell/shared";
import { Pill, ConfirmModal, AppModal, FormInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { useLanguage } from "@/lib/i18n";

/** One uploaded file: name/date/status, View (once its signed URL resolves),
 * Rename, and Delete when `canDelete` — shared by MyVisitsScreen (a
 * caregiver's own not-yet-released uploads) and AdminAppointmentsScreen
 * (admin can rename/remove any report, matching the report_update/
 * report_delete RLS policies in both cases). */
export function ReportRow({ report, bookingId, canDelete }: { report: ReportUpload; bookingId: string; canDelete: boolean }) {
  const { t } = useLanguage();
  const { data: url } = useSignedUrl(MEDICAL_REPORT_BUCKET, report.storage_path);
  const del = useDeleteReport();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Same ownership rule as delete (report_update RLS) — renaming a released
  // report, or one someone else uploaded, is admin-only either way.
  const canRename = canDelete;

  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="flex-1">
        <Text className="text-xs font-medium text-gray-700 dark:text-gray-200" numberOfLines={1}>
          {report.file_name ?? "file"}
        </Text>
        <Text className="text-[11px] text-gray-400 dark:text-gray-500">{formatLocalDateTime(report.created_at)}</Text>
      </View>
      <Pill
        bgClass={report.reviewed ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-amber-50 dark:bg-amber-900/30"}
        textClass={report.reviewed ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}
      >
        {report.reviewed ? t("ops.released") : t("ops.awaitingReview")}
      </Pill>
      {url ? (
        <Pressable onPress={() => openUrl(url)} hitSlop={8} className="active:opacity-60">
          <Eye size={16} color="#4b5563" />
        </Pressable>
      ) : null}
      {canRename ? (
        <Pressable onPress={() => setRenaming(true)} hitSlop={8} className="active:opacity-60">
          <Pencil size={16} color="#4b5563" />
        </Pressable>
      ) : null}
      {canDelete ? (
        <Pressable onPress={() => setConfirmOpen(true)} hitSlop={8} className="active:opacity-60">
          <Trash2 size={16} color="#ef4444" />
        </Pressable>
      ) : null}

      {renaming ? <RenameReportModal report={report} bookingId={bookingId} onClose={() => setRenaming(false)} /> : null}

      <ConfirmModal
        open={confirmOpen}
        title={t("ops.myVisits.confirmDeleteReport.title")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          del.mutate({ id: report.id, bookingId });
          setConfirmOpen(false);
        }}
        confirmLabel={t("ops.myVisits.confirmDeleteReport.confirm")}
        cancelLabel={t("ops.myVisits.confirmDeleteReport.cancel")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">{t("ops.myVisits.confirmDeleteReport.body", { file: report.file_name ?? "file" })}</Text>
      </ConfirmModal>
    </View>
  );
}

function RenameReportModal({ report, bookingId, onClose }: { report: ReportUpload; bookingId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(report.file_name ?? "");
  const rename = useRenameReport();

  const save = () => {
    if (!name.trim()) return;
    rename.mutate({ id: report.id, fileName: name.trim(), bookingId }, { onSuccess: onClose });
  };

  return (
    <AppModal visible onClose={onClose} title={t("ops.reportRow.rename.title")}>
      <FormInput label={t("ops.reportRow.rename.label")} value={name} onChangeText={setName} autoCapitalize="none" required />
      <View className="mt-6 flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>{t("ops.cancel")}</OutlineButton>
        <PrimaryButton loading={rename.isPending} disabled={!name.trim()} onPress={save}>
          {t("ops.save")}
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
