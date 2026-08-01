"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, FileImage, Check, Eye } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, FormInput, LoadingState, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  useAllReports,
  useReviewReport,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  formatLocalDateTime,
} from "@vagewell/shared";

// Full report history, visible to every ops role (staff/leaf_node/admin) —
// not just admin, and not just reports still awaiting review. patient_name/
// service_name come pre-snapshotted on each row (migration 0014), so this
// never needs to join against bookings (which would silently fail to
// resolve for a plain staff/leaf_node caller viewing a report outside their
// own assigned scope, since bookings RLS is scoped narrower than reports RLS).
function ReportsContent() {
  const { role } = useAuth();
  const { data: reports, isLoading } = useAllReports(true);
  const review = useReviewReport();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reports ?? []).filter(
      (r) => !q || (r.patient_name ?? "").toLowerCase().includes(q) || (r.service_name ?? "").toLowerCase().includes(q)
    );
  }, [reports, query]);

  const paths = useMemo(() => rows.map((r) => r.storage_path), [rows]);
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

  return (
    <div>
      <PageHeader title="Reports" />
      <p className="mb-4 text-xs text-gray-500">
        Every report ever uploaded by staff and leaf node members, newest first. Admin releases a report to
        make it visible to the customer.
      </p>
      <div className="mb-4">
        <FormInput label="Search by patient or service" value={query} onChangeText={setQuery} placeholder="Name or service…" />
      </div>

      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No reports" description="Uploads appear here as soon as staff submit one." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
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
                  <p className="text-sm font-semibold text-gray-900">
                    {r.service_name ?? "—"} · <span className="text-brand-600">{r.patient_name ?? "—"}</span>
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    <Pill bgClass="bg-gray-100" textClass="text-gray-600">
                      {REPORT_TYPE_LABELS[r.report_type]}
                    </Pill>
                    <Pill
                      bgClass={r.reviewed ? "bg-emerald-100" : "bg-amber-100"}
                      textClass={r.reviewed ? "text-emerald-700" : "text-amber-700"}
                    >
                      {r.reviewed ? "Released" : "Awaiting review"}
                    </Pill>
                  </div>
                  {r.note ? <p className="mt-1 text-xs text-gray-500">{r.note}</p> : null}
                  <p className="mt-1 text-xs text-gray-400">Uploaded: {formatLocalDateTime(r.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {urls[r.storage_path] ? (
                    <a
                      href={urls[r.storage_path]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-gray-600 active:opacity-70"
                    >
                      <Eye size={14} />
                      View
                    </a>
                  ) : null}
                  {role === "admin" && !r.reviewed ? (
                    <PrimaryButton icon={Check} loading={review.isPending} onClick={() => review.mutate(r.id)}>
                      Release
                    </PrimaryButton>
                  ) : null}
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
