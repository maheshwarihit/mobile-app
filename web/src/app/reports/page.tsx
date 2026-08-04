"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Check, Eye } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Pill, FormInput, LoadingState, EmptyState, PageHeader } from "@/components/ui";
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
// service_name/file_name come pre-snapshotted on each row (migrations 0014,
// 0015), so this never needs to join against bookings (which would silently
// fail to resolve for a plain staff/leaf_node caller viewing a report outside
// their own assigned scope, since bookings RLS is scoped narrower than
// reports RLS). View/Release are real <a>/<button> elements driven off
// signed URLs fetched up front — never a click-handler that calls
// window.open() after an await, which browsers' popup blockers silently
// swallow since it's no longer considered a direct user gesture by then.
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
        Every report ever uploaded by staff and leaf node members, newest first. Only admin, staff, and
        leaf node accounts can upload or release a report — clients can only view one once it&apos;s released.
      </p>
      <div className="mb-4 max-w-sm">
        <FormInput label="Search by client or service" value={query} onChangeText={setQuery} placeholder="Name or service…" />
      </div>

      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No reports" description="Uploads appear here as soon as staff submit one." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatLocalDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.patient_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{r.service_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{r.file_name ?? REPORT_TYPE_LABELS[r.report_type]}</p>
                    <p className="text-xs text-gray-400">{REPORT_TYPE_LABELS[r.report_type]}</p>
                    {r.note ? <p className="mt-0.5 text-xs text-gray-400">{r.note}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      bgClass={r.reviewed ? "bg-emerald-100" : "bg-amber-100"}
                      textClass={r.reviewed ? "text-emerald-700" : "text-amber-700"}
                    >
                      {r.reviewed ? "Released" : "Awaiting review"}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
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
                        <button
                          onClick={() => review.mutate(r.id)}
                          disabled={review.isPending}
                          className="flex items-center gap-1 text-sm font-medium text-brand-600 active:opacity-70"
                        >
                          <Check size={14} />
                          Release
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
