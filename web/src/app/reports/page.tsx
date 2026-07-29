"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, FileImage, Check } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, LoadingState, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  useUnreviewedReports,
  useReviewReport,
  useAllBookings,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  formatLocalDateTime,
  type ReportUpload,
} from "@vagewell/shared";

function ReportsContent() {
  const { data: reports, isLoading } = useUnreviewedReports(true);
  const { data: bookings } = useAllBookings(true);
  const review = useReviewReport();

  const paths = useMemo(() => (reports ?? []).map((r) => r.storage_path), [reports]);
  const { data: urls = {} } = useQuery({
    queryKey: ["report-signed-urls", paths],
    queryFn: async (): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data } = await supabase.storage.from(MEDICAL_REPORT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });

  const bookingLabel = (r: ReportUpload) => {
    const b = (bookings ?? []).find((x) => x.id === r.booking_id);
    return b ? `${b.service_name} · ${b.subject_name ?? "—"}` : r.booking_id;
  };

  return (
    <div>
      <PageHeader title="Reports awaiting review" />
      <p className="mb-4 text-xs text-gray-500">
        Uploaded by staff and leaf node members. Release a report to make it visible to the customer.
      </p>

      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && (reports ?? []).length === 0 ? (
        <EmptyState icon={FileCheck2} title="Nothing to review" description="New uploads appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {(reports ?? []).map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex gap-3">
                {urls[r.storage_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[r.storage_path]} alt="Report preview" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <FileImage size={18} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{bookingLabel(r)}</p>
                  <div className="mt-1">
                    <Pill bgClass="bg-gray-100" textClass="text-gray-600">
                      {REPORT_TYPE_LABELS[r.report_type]}
                    </Pill>
                  </div>
                  {r.note ? <p className="mt-1 text-xs text-gray-500">{r.note}</p> : null}
                  <p className="mt-1 text-xs text-gray-400">{formatLocalDateTime(r.created_at)}</p>
                </div>
                <div className="flex items-start">
                  <PrimaryButton icon={Check} loading={review.isPending} onClick={() => review.mutate(r.id)}>
                    Release
                  </PrimaryButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireStaff>
      <ReportsContent />
    </RequireStaff>
  );
}
