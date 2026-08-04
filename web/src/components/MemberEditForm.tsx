"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, UserCircle, Activity, FileCheck2, Eye, Download } from "lucide-react";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useClinicalRecords,
  useUpdateProfile,
  useSaveDependent,
  useAddClinical,
  useAllBookings,
  useAllReports,
  localPhone,
  formatLocalTime,
  groupByLocalDate,
  REPORT_TYPE_LABELS,
  MEDICAL_REPORT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  BLOOD_GROUPS,
  qk,
} from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { SectionCard, FormInput, SelectField, TextareaInput, PrimaryButton, PageHeader, Pill, EmptyState } from "@/components/ui";

const BLOOD_GROUP_OPTIONS = [{ value: "", label: "Not recorded" }, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))];

type Subject = { kind: "self"; profileId: string } | { kind: "dependent"; familyMemberId: string; accountId: string };

/** Parse "120/80" → { systolic, diastolic }; null on missing/invalid. */
function parseBP(s: string): { systolic: number | null; diastolic: number | null } {
  const m = s.split("/");
  const sys = Number(m[0]);
  const dia = Number(m[1]);
  return {
    systolic: m[0] && !isNaN(sys) ? sys : null,
    diastolic: m[1] && !isNaN(dia) ? dia : null,
  };
}

export function MemberEditForm({ subject, name, backHref }: { subject: Subject; name: string; backHref: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: profiles } = useAllProfiles(true);
  const accountId = subject.kind === "self" ? subject.profileId : subject.accountId;
  const { data: dependents } = useFamilyMembersByAccount(accountId);
  const clinicalSubject =
    subject.kind === "self" ? { profileId: subject.profileId } : { familyMemberId: subject.familyMemberId };
  const { data: records } = useClinicalRecords(clinicalSubject);

  const profile = subject.kind === "self" ? (profiles ?? []).find((p) => p.id === subject.profileId) : undefined;
  const dependent = subject.kind === "dependent" ? (dependents ?? []).find((d) => d.id === subject.familyMemberId) : undefined;

  // Every report ever uploaded for exactly this person (not the whole
  // household — that's the parent Patients page's job) — a booking belongs
  // to this subject when it's the account's own (no family_member_id) for
  // "self", or matches this specific dependent's id otherwise.
  const { data: allBookings } = useAllBookings(true);
  const { data: allReports } = useAllReports(true);
  const subjectBookingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of allBookings ?? []) {
      if (subject.kind === "self" ? b.account_id === subject.profileId && !b.family_member_id : b.family_member_id === subject.familyMemberId) {
        ids.add(b.id);
      }
    }
    return ids;
  }, [allBookings, subject]);
  const subjectReports = useMemo(
    () =>
      (allReports ?? [])
        .filter((r) => subjectBookingIds.has(r.booking_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [allReports, subjectBookingIds]
  );
  const reportPaths = useMemo(() => subjectReports.map((r) => r.storage_path), [subjectReports]);
  const reportUrlKey = subject.kind === "self" ? subject.profileId : subject.familyMemberId;
  const { data: reportUrls = {} } = useQuery({
    queryKey: ["member-report-urls", reportUrlKey, reportPaths],
    enabled: reportPaths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage.from(MEDICAL_REPORT_BUCKET).createSignedUrls(reportPaths, SIGNED_URL_TTL_SECONDS);
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });
  // Separate signed URLs with `download: true` — Supabase returns these with
  // Content-Disposition: attachment, so the browser saves the file instead
  // of just navigating to it (which the plain "Open" URL above still does).
  const { data: downloadUrls = {} } = useQuery({
    queryKey: ["member-report-download-urls", reportUrlKey, reportPaths],
    enabled: reportPaths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage
        .from(MEDICAL_REPORT_BUCKET)
        .createSignedUrls(reportPaths, SIGNED_URL_TTL_SECONDS, { download: true });
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });

  const update = useUpdateProfile();
  const saveDep = useSaveDependent();
  const addClinical = useAddClinical();
  const busy = update.isPending || saveDep.isPending || addClinical.isPending;

  const [form, setForm] = useState({ full_name: name, phone: "", age: "", address: "", blood_group: "", bp: "", sugar: "", conditions: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    // Syncs form defaults from data that loads asynchronously after mount
    // (profile/dependent/records are separate react-query fetches, not props
    // whose identity change could be handled by remounting via `key`).
    const latest = records?.[0];
    const bioName = subject.kind === "self" ? profile?.full_name : dependent?.full_name;
    const bioAge = subject.kind === "self" ? profile?.age : dependent?.age;
    const bioPhone = subject.kind === "self" ? profile?.phone : dependent?.contact_phone;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      full_name: bioName ?? name,
      phone: localPhone(bioPhone ?? null),
      age: bioAge != null ? String(bioAge) : "",
      address: subject.kind === "self" ? (profile?.address ?? "") : "",
      blood_group: latest?.blood_group ?? "",
      bp: latest?.systolic && latest?.diastolic ? `${latest.systolic}/${latest.diastolic}` : "",
      sugar: latest?.blood_glucose != null ? String(latest.blood_glucose) : "",
      conditions: latest?.medical_conditions ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dependent?.id, records?.length]);

  const save = () => {
    const ageNum = form.age.trim() === "" ? null : Number(form.age);

    if (subject.kind === "self") {
      update.mutate(
        {
          id: subject.profileId,
          full_name: form.full_name.trim(),
          age: ageNum,
          date_of_birth: profile?.date_of_birth ?? null,
          gender: profile?.gender ?? null,
          address: form.address.trim() ? form.address.trim() : null,
        },
        { onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }) }
      );
    } else {
      saveDep.mutate({
        id: subject.familyMemberId,
        account_id: subject.accountId,
        full_name: form.full_name.trim(),
        age: ageNum,
        relationship: dependent?.relationship ?? "other",
        contact_phone: form.phone.trim() ? form.phone.trim() : null,
        gender: dependent?.gender ?? null,
      });
    }

    const hasMedical = form.bp.trim() || form.sugar.trim() || form.blood_group || form.conditions.trim();
    const finish = () => {
      toast.success("Record saved");
      router.push(backHref);
    };
    if (hasMedical) {
      const { systolic, diastolic } = parseBP(form.bp);
      addClinical.mutate(
        {
          ...(subject.kind === "self" ? { profile_id: subject.profileId } : { family_member_id: subject.familyMemberId }),
          systolic,
          diastolic,
          blood_glucose: form.sugar.trim() ? Number(form.sugar) : null,
          blood_group: form.blood_group || null,
          medical_conditions: form.conditions.trim() ? form.conditions.trim() : null,
        },
        { onSuccess: finish }
      );
    } else {
      finish();
    }
  };

  const phoneReadOnly = subject.kind === "self";

  return (
    <div>
      <PageHeader title="Edit record" onBack={() => router.push(backHref)} />

      <SectionCard icon={UserCircle} title={name} subtitle="Bio details">
        <div className="flex flex-col gap-4">
          <FormInput label="Name" value={form.full_name} onChangeText={set("full_name")} />
          <FormInput
            label={phoneReadOnly ? "Phone (verified)" : "Phone"}
            value={form.phone}
            onChangeText={set("phone")}
            editable={!phoneReadOnly}
          />
          <FormInput label="Age (optional)" value={form.age} onChangeText={set("age")} type="number" />
          {subject.kind === "self" ? (
            <TextareaInput label="Address" value={form.address} onChangeText={set("address")} rows={2} maxLength={500} />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard icon={Activity} title="Medical record" subtitle="Saved as a new dated entry">
        <div className="flex flex-col gap-4">
          <SelectField label="Blood group" value={form.blood_group} onValueChange={set("blood_group")} options={BLOOD_GROUP_OPTIONS} />
          <FormInput label="Blood pressure" value={form.bp} onChangeText={set("bp")} placeholder="e.g. 120/80" />
          <FormInput label="Sugar level (mg/dL)" value={form.sugar} onChangeText={set("sugar")} type="number" placeholder="e.g. 110" />
          <TextareaInput
            label="Other medical conditions"
            value={form.conditions}
            onChangeText={set("conditions")}
            placeholder="e.g. Type 2 diabetes, hypertension"
            rows={2}
            maxLength={2000}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Lock size={12} className="text-gray-400" />
          <p className="text-[11px] text-gray-400">Clients see this as read-only. Each save adds a new dated entry.</p>
        </div>
      </SectionCard>

      <SectionCard icon={FileCheck2} title="Reports" subtitle={`Every report ever uploaded for ${name}, newest first`}>
        {subjectReports.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No reports" description="Uploads for this person appear here." />
        ) : (
          <div className="flex flex-col gap-4">
            {groupByLocalDate(subjectReports).map((group) => (
              <div key={group.dateLabel}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.dateLabel}</p>
                <div className="flex flex-col gap-2">
                  {group.items.map((r) => {
                    const url = reportUrls[r.storage_path];
                    const dlUrl = downloadUrls[r.storage_path];
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{r.file_name ?? REPORT_TYPE_LABELS[r.report_type]}</p>
                          <p className="text-xs text-gray-400">{formatLocalTime(r.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Pill bgClass={r.reviewed ? "bg-emerald-100" : "bg-amber-100"} textClass={r.reviewed ? "text-emerald-700" : "text-amber-700"}>
                            {r.reviewed ? "Released" : "Awaiting review"}
                          </Pill>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-brand-600">
                              <Eye size={14} />
                              Open
                            </a>
                          ) : null}
                          {dlUrl ? (
                            <a href={dlUrl} download={r.file_name ?? undefined} className="flex items-center gap-1 text-sm font-medium text-gray-600">
                              <Download size={14} />
                              Download
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <PrimaryButton fullWidth loading={busy} onClick={save}>
        Save changes
      </PrimaryButton>
    </div>
  );
}
