"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FormInput, SelectInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { useSaveDependent } from "@/lib/mutations";
import { dependentSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/phone";
import { RELATIONSHIPS, GENDERS, GENDER_LABELS } from "@shared/constants";
import type { FamilyMember } from "@shared/types";

const RELATIONSHIP_OPTIONS = RELATIONSHIPS.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));
const GENDER_OPTIONS = [{ value: "", label: "—" }, ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))];

const EMPTY = { full_name: "", age: "", relationship: RELATIONSHIPS[0] as string, contact_phone: "", gender: "" };

export function DependentModal({
  open,
  dependent,
  accountId,
  onClose,
}: {
  open: boolean;
  dependent: FamilyMember | null;
  accountId: string;
  onClose: () => void;
}) {
  const save = useSaveDependent();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(
        dependent
          ? {
              full_name: dependent.full_name,
              age: dependent.age?.toString() ?? "",
              relationship: dependent.relationship,
              contact_phone: dependent.contact_phone ?? "",
              gender: dependent.gender ?? "",
            }
          : EMPTY
      );
    }
  }, [open, dependent]);

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    setErrors({});
    const parsed = dependentSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    save.mutate(
      {
        id: dependent?.id,
        account_id: accountId,
        full_name: parsed.data.full_name,
        age: parsed.data.age,
        relationship: parsed.data.relationship,
        contact_phone: form.contact_phone ? normalizePhone(form.contact_phone) : null,
        gender: form.gender || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{dependent ? "Edit dependent" : "Add dependent"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <FormInput label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} id="dep_name" required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Age" type="number" value={form.age} onChange={set("age")} error={errors.age} id="dep_age" />
            <SelectInput label="Relationship" value={form.relationship} onChange={set("relationship")} options={RELATIONSHIP_OPTIONS} id="dep_rel" />
          </div>
          <SelectInput label="Gender (optional)" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} id="dep_gender" />
          <FormInput label="Contact number (optional)" type="tel" value={form.contact_phone} onChange={set("contact_phone")} error={errors.contact_phone} id="dep_phone" />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
