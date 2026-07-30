"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, UserCircle, Activity } from "lucide-react";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useClinicalRecords,
  useUpdateProfile,
  useSaveDependent,
  useAddClinical,
  localPhone,
  BLOOD_GROUPS,
  qk,
} from "@vagewell/shared";
import { SectionCard, FormInput, SelectField, TextareaInput, PrimaryButton, PageHeader } from "@/components/ui";

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
          <FormInput label="Age" value={form.age} onChangeText={set("age")} type="number" />
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
          <p className="text-[11px] text-gray-400">Patients see this as read-only. Each save adds a new dated entry.</p>
        </div>
      </SectionCard>

      <PrimaryButton fullWidth loading={busy} onClick={save}>
        Save changes
      </PrimaryButton>
    </div>
  );
}
