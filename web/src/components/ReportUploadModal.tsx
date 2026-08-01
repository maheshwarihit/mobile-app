"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useUploadReport, REPORT_TYPES, REPORT_TYPE_LABELS, ALLOWED_REPORT_MIME, MAX_REPORT_UPLOAD_BYTES } from "@vagewell/shared";
import type { BookingWithNames, ReportType } from "@vagewell/shared";
import { Modal, SelectField, TextareaInput, PrimaryButton, OutlineButton, ErrorBanner } from "@/components/ui";

const TYPE_OPTIONS = REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }));

export function ReportUploadModal({ booking, onClose }: { booking: BookingWithNames | null; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<ReportType>("medical_report");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const upload = useUploadReport();

  const onPick = (f: File | undefined) => {
    setErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_REPORT_MIME.includes(f.type as (typeof ALLOWED_REPORT_MIME)[number])) {
      setErr("Please upload a PNG, JPG, WEBP, or PDF file.");
      return;
    }
    if (f.size > MAX_REPORT_UPLOAD_BYTES) {
      setErr("File exceeds the 10 MB limit.");
      return;
    }
    setFile(f);
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
        source: { contentType: file.type, sizeBytes: file.size, toArrayBuffer: () => file.arrayBuffer() },
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
    <Modal open={!!booking} onClose={onClose}>
      <h3 className="mb-1 text-lg font-bold text-gray-900">Upload Report</h3>
      <p className="mb-4 text-sm text-gray-500">
        {booking.service_name} for <span className="font-medium">{booking.subject_name}</span>
      </p>

      <div className="flex flex-col gap-4">
        <SelectField label="Report type" value={reportType} onValueChange={(v) => setReportType(v as ReportType)} options={TYPE_OPTIONS} />

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">File</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-left"
          >
            <UploadCloud size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">{file ? file.name : "Choose a PNG, JPG, WEBP, or PDF file"}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>

        <TextareaInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="Any context for this report…" rows={2} maxLength={1000} />
      </div>

      {err ? (
        <div className="mt-3">
          <ErrorBanner message={err} />
        </div>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <OutlineButton onClick={onClose}>Cancel</OutlineButton>
        <PrimaryButton loading={upload.isPending} onClick={submit}>
          Upload
        </PrimaryButton>
      </div>
    </Modal>
  );
}
