"use client";

import { useEffect, useState } from "react";
import { X, Activity } from "lucide-react";
import { FormInput, SelectInput, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useAddClinical } from "@/lib/mutations";
import { clinicalSchema } from "@/lib/schemas";
import { BLOOD_GROUPS } from "@shared/constants";

export interface VitalsSubject {
  profileId?: string;
  familyMemberId?: string;
  name: string;
}

const BLOOD_GROUP_OPTIONS = [{ value: "", label: "—" }, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))];
const EMPTY = {
  systolic: "",
  diastolic: "",
  blood_glucose: "",
  spo2: "",
  blood_group: "",
  medical_conditions: "",
  note: "",
};

export function VitalsModal({
  open,
  subject,
  onClose,
}: {
  open: boolean;
  subject: VitalsSubject | null;
  onClose: () => void;
}) {
  const add = useAddClinical();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open, subject]);

  if (!open || !subject) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    setErrors({});
    const parsed = clinicalSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    const payload: Record<string, unknown> = {
      systolic: parsed.data.systolic,
      diastolic: parsed.data.diastolic,
      blood_glucose: parsed.data.blood_glucose,
      spo2: parsed.data.spo2,
      blood_group: parsed.data.blood_group || null,
      medical_conditions: parsed.data.medical_conditions || null,
      note: parsed.data.note || null,
    };
    if (subject.profileId) payload.profile_id = subject.profileId;
    else if (subject.familyMemberId) payload.family_member_id = subject.familyMemberId;
    add.mutate(payload, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Activity size={18} className="text-purple-600" /> Record Vitals
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">For {subject.name}</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Systolic (mmHg)" type="number" value={form.systolic} onChange={set("systolic")} error={errors.systolic} id="v_sys" />
            <FormInput label="Diastolic (mmHg)" type="number" value={form.diastolic} onChange={set("diastolic")} error={errors.diastolic} id="v_dia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Glucose (mg/dL)" type="number" value={form.blood_glucose} onChange={set("blood_glucose")} error={errors.blood_glucose} id="v_glu" />
            <FormInput label="SpO2 (%)" type="number" value={form.spo2} onChange={set("spo2")} error={errors.spo2} id="v_spo2" />
          </div>
          <SelectInput label="Blood group" value={form.blood_group} onChange={set("blood_group")} options={BLOOD_GROUP_OPTIONS} id="v_bg" />
          <TextareaInput label="Medical conditions" value={form.medical_conditions} onChange={set("medical_conditions")} placeholder="e.g. Type 2 diabetes, hypertension" rows={2} maxLength={2000} id="v_cond" />
          <TextareaInput label="Note" value={form.note} onChange={set("note")} placeholder="Visit note (optional)" rows={2} maxLength={1000} id="v_note" />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={submit} disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Save Vitals"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
