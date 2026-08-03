"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCircle, Users, ChevronRight, FileCheck2, Eye } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { SectionCard, LoadingState, EmptyState, PageHeader, Pill } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useAllBookings,
  useAllReports,
  localPhone,
  formatLocalDateTime,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@vagewell/shared";

// Role promotion (Staff/Leaf Node/Admin) lives on the /staff and /leaf-nodes
// pages now, which can search and promote *any* account — a patient's own
// detail page doesn't need a role picker; every account here starts and
// stays a patient unless promoted from one of those admin-facing lists.
function PatientProfileContent({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { data: profiles } = useAllProfiles(true);
  const { data: dependents, isLoading } = useFamilyMembersByAccount(accountId);

  const profile = (profiles ?? []).find((p) => p.id === accountId);
  const patientName = profile?.full_name ?? "Patient";

  // Every report ever uploaded across this account's own bookings AND its
  // dependents' bookings, in one place — a booking's account_id is always
  // the primary account holder regardless of which subject it's for, so
  // filtering bookings by account_id already covers the whole household.
  const { data: bookings } = useAllBookings(true);
  const { data: reports } = useAllReports(true);
  const householdBookingIds = useMemo(
    () => new Set((bookings ?? []).filter((b) => b.account_id === accountId).map((b) => b.id)),
    [bookings, accountId]
  );
  const householdReports = useMemo(
    () => (reports ?? []).filter((r) => householdBookingIds.has(r.booking_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [reports, householdBookingIds]
  );
  const reportPaths = useMemo(() => householdReports.map((r) => r.storage_path), [householdReports]);
  const { data: reportUrls = {} } = useQuery({
    queryKey: ["patient-report-urls", accountId, reportPaths],
    enabled: reportPaths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage.from(MEDICAL_REPORT_BUCKET).createSignedUrls(reportPaths, SIGNED_URL_TTL_SECONDS);
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });

  return (
    <div>
      <PageHeader title="Family members" onBack={() => router.push("/patients")} />

      <SectionCard icon={UserCircle} title={patientName} subtitle="Account holder">
        <button
          onClick={() => router.push(`/patients/${accountId}/self`)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-left active:opacity-80"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">Edit record</p>
            <p className="text-xs text-gray-500">{localPhone(profile?.phone) || "—"} · vitals & medical</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      </SectionCard>

      <SectionCard icon={Users} title="Dependents" subtitle="Tap to edit a member's record">
        {isLoading ? (
          <LoadingState message="Loading…" />
        ) : (dependents?.length ?? 0) === 0 ? (
          <EmptyState icon={Users} title="No dependents" description="This account has no dependents." />
        ) : (
          <div className="flex flex-col gap-2">
            {dependents?.map((d) => (
              <button
                key={d.id}
                onClick={() => router.push(`/patients/${accountId}/dependents/${d.id}`)}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-left active:opacity-80"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{d.full_name}</p>
                  <p className="text-xs capitalize text-gray-500">
                    {d.relationship}
                    {d.age != null ? ` · ${d.age} yrs` : ""}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={FileCheck2} title="Reports" subtitle="Every report uploaded for this account and its dependents, newest first">
        {householdReports.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No reports" description="Uploads for this household appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {householdReports.map((r) => {
              const url = reportUrls[r.storage_path];
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.patient_name ?? "—"}</p>
                    <p className="text-xs text-gray-500">{r.file_name ?? REPORT_TYPE_LABELS[r.report_type]}</p>
                    <p className="text-xs text-gray-400">{formatLocalDateTime(r.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill bgClass={r.reviewed ? "bg-emerald-100" : "bg-amber-100"} textClass={r.reviewed ? "text-emerald-700" : "text-amber-700"}>
                      {r.reviewed ? "Released" : "Awaiting review"}
                    </Pill>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-brand-600">
                        <Eye size={14} />
                        View
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function PatientProfilePage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return (
    <RequireStaff>
      <PatientProfileContent accountId={accountId} />
    </RequireStaff>
  );
}
