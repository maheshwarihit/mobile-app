"use client";

import { useMemo, useState } from "react";
import { UserCircle, Users, Activity, Pencil, Trash2, Plus, Lock } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  FormInput,
  SelectInput,
  PrimaryButton,
  OutlineButton,
  IconButton,
  EmptyState,
  LoadingState,
  ConfirmModal,
} from "@/components/ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { useFamilyMembers, useClinicalRecords } from "@/lib/hooks";
import { useUpdateProfile, useDeleteDependent } from "@/lib/mutations";
import { DependentModal } from "@/components/feature/DependentModal";
import { profileSchema } from "@/lib/schemas";
import { formatDate, formatLocalDateTime } from "@/lib/dates";
import { localPhone } from "@/lib/phone";
import { GENDERS, GENDER_LABELS } from "@shared/constants";
import type { FamilyMember, ClinicalRecord } from "@shared/types";

const GENDER_OPTIONS = [{ value: "", label: "—" }, ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))];

// SCREEN_ID: PROFILE
export default function ProfilePage() {
  const { profile, user, loading, refreshProfile } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();
  const update = useUpdateProfile();
  const del = useDeleteDependent();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", age: "", date_of_birth: "", gender: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [depModalOpen, setDepModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<FamilyMember | null>(null);
  const [deleteDep, setDeleteDep] = useState<FamilyMember | null>(null);

  const [subject, setSubject] = useState("self");

  const startEdit = () => {
    setErrors({});
    setForm({
      full_name: profile?.full_name ?? "",
      age: profile?.age?.toString() ?? "",
      date_of_birth: profile?.date_of_birth ?? "",
      gender: profile?.gender ?? "",
    });
    setEditing(true);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveBio = () => {
    setErrors({});
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    if (!user) return;
    update.mutate(
      {
        id: user.id,
        full_name: parsed.data.full_name,
        age: parsed.data.age,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      },
      {
        onSuccess: async () => {
          await refreshProfile();
          setEditing(false);
        },
      }
    );
  };

  const subjectOptions = [
    { value: "self", label: "Myself" },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: d.full_name })),
  ];
  const subjectQuery = useMemo(
    () => (subject === "self" ? { profileId: user?.id } : { familyMemberId: subject }),
    [subject, user?.id]
  );
  const { data: records, isLoading: vitalsLoading } = useClinicalRecords(user ? subjectQuery : null);

  if (loading) return <LoadingState message="Loading profile…" />;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your details, dependents, and health record." />

      {/* ── Bio ─────────────────────────────────────────── */}
      <SectionCard icon={UserCircle} title="Your details">
        {!editing ? (
          <div>
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={profile?.full_name ?? "—"} />
              <Row label="Mobile" value={localPhone(profile?.phone) || "—"} />
              <Row label="Age" value={profile?.age?.toString() ?? "—"} />
              <Row label="Date of birth" value={profile?.date_of_birth ? formatDate(profile.date_of_birth) : "—"} />
              <Row label="Gender" value={profile?.gender ? GENDER_LABELS[profile.gender] : "—"} />
            </dl>
            <div className="mt-4">
              <OutlineButton onClick={startEdit}>
                <span className="inline-flex items-center gap-1.5"><Pencil size={14} /> Edit details</span>
              </OutlineButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormInput label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} id="pf_name" required />
            <FormInput label="Mobile (verified)" value={localPhone(profile?.phone)} locked id="pf_phone" />
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Age" type="number" value={form.age} onChange={set("age")} error={errors.age} id="pf_age" />
              <FormInput label="Date of birth" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} id="pf_dob" />
            </div>
            <SelectInput label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} id="pf_gender" />
            <div className="flex items-center justify-end gap-2">
              <OutlineButton onClick={() => setEditing(false)}>Cancel</OutlineButton>
              <PrimaryButton onClick={saveBio} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Dependents ──────────────────────────────────── */}
      <SectionCard icon={Users} title="Dependents" subtitle="Family members you can book care for.">
        {depsLoading ? (
          <LoadingState message="Loading dependents…" />
        ) : dependents?.length === 0 ? (
          <EmptyState icon={Users} title="No dependents yet" description="Add a family member to book care for them." actionLabel="Add dependent" onAction={() => { setEditingDep(null); setDepModalOpen(true); }} />
        ) : (
          <div className="space-y-2">
            {dependents?.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.full_name}</p>
                  <p className="text-xs capitalize text-gray-500">
                    {d.relationship}{d.age != null ? ` · ${d.age} yrs` : ""}{d.contact_phone ? ` · ${localPhone(d.contact_phone)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton onClick={() => { setEditingDep(d); setDepModalOpen(true); }} title="Edit">
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton onClick={() => setDeleteDep(d)} title="Remove" danger>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
        {(dependents?.length ?? 0) > 0 && (
          <div className="mt-4">
            <OutlineButton onClick={() => { setEditingDep(null); setDepModalOpen(true); }}>
              <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Add dependent</span>
            </OutlineButton>
          </div>
        )}
      </SectionCard>

      {/* ── Health record (read-only for patient) ───────── */}
      <SectionCard icon={Activity} title="Health record" subtitle="Vitals recorded by care staff.">
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Lock size={13} /> Read-only — updated by VAgeWell staff during visits.
        </div>
        <div className="mb-4 max-w-xs">
          <SelectInput label="View record for" value={subject} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSubject(e.target.value)} options={subjectOptions} id="subject" />
        </div>
        {vitalsLoading ? (
          <LoadingState message="Loading vitals…" />
        ) : (
          <VitalsView records={records ?? []} />
        )}
      </SectionCard>

      <DependentModal
        open={depModalOpen}
        dependent={editingDep}
        accountId={user?.id ?? ""}
        onClose={() => setDepModalOpen(false)}
      />

      <ConfirmModal
        open={!!deleteDep}
        title="Remove dependent?"
        onClose={() => setDeleteDep(null)}
        onConfirm={() => {
          if (deleteDep) del.mutate(deleteDep.id);
          setDeleteDep(null);
        }}
        confirmLabel="Remove"
        cancelLabel="Keep"
        confirmDanger
      >
        <p className="text-sm text-gray-600">Remove {deleteDep?.full_name} from your dependents?</p>
      </ConfirmModal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function VitalsView({ records }: { records: ClinicalRecord[] }) {
  if (records.length === 0) {
    return <EmptyState icon={Activity} title="No vitals recorded" description="Care staff will record vitals during a visit." />;
  }
  const latest = records[0];
  const bp = latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : "—";
  const tiles = [
    { label: "Blood Pressure", value: bp, unit: "mmHg" },
    { label: "Glucose", value: latest.blood_glucose?.toString() ?? "—", unit: "mg/dL" },
    { label: "SpO2", value: latest.spo2?.toString() ?? "—", unit: "%" },
    { label: "Blood Group", value: latest.blood_group ?? "—", unit: "" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-gray-100 bg-white p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{t.value}</p>
            <p className="text-[10px] text-gray-400">{t.unit}</p>
            <p className="mt-1 text-[11px] font-medium text-gray-500">{t.label}</p>
          </div>
        ))}
      </div>
      {latest.medical_conditions && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">Medical conditions</p>
          <p className="mt-1 text-sm text-gray-700">{latest.medical_conditions}</p>
        </div>
      )}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">History</p>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <span className="text-gray-600">
                {r.systolic && r.diastolic ? `BP ${r.systolic}/${r.diastolic} · ` : ""}
                {r.blood_glucose != null ? `Glucose ${r.blood_glucose} · ` : ""}
                {r.spo2 != null ? `SpO2 ${r.spo2}%` : ""}
                {!r.systolic && r.blood_glucose == null && r.spo2 == null ? "Record" : ""}
              </span>
              <span className="text-xs text-gray-400">{formatLocalDateTime(r.recorded_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
