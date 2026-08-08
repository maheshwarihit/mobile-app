"use client";

import { useEffect, useState } from "react";
import { LogOut, Pencil } from "lucide-react";
import { ROLE_LABELS, useUpdateProfile, localPhone } from "@vagewell/shared";
import { Modal, FormInput, TextareaInput, PrimaryButton, TextButton } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { ProfileAvatar } from "@/components/ProfileSummary";

/**
 * The logged-in ops account's own details, reached by tapping the avatar in
 * the header — Name/Address/Employee ID are editable, Phone (the auth
 * identifier) and Role (admin-promotion-only, see /staff /leaf-nodes) stay
 * read-only. Log out lives here instead of as a separate header button.
 */
export function OwnProfilePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", address: "", emp_id: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ full_name: profile.full_name ?? "", address: profile.address ?? "", emp_id: profile.emp_id ?? "" });
  }, [profile]);

  if (!profile) return null;

  const save = () => {
    update.mutate(
      {
        id: profile.id,
        full_name: form.full_name.trim() || profile.full_name || "",
        age: profile.age,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        address: form.address.trim() ? form.address.trim() : null,
        emp_id: form.emp_id.trim() ? form.emp_id.trim() : null,
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
    >
      <div className="mb-4 flex items-center gap-3">
        <ProfileAvatar profile={profile} size={56} />
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">{profile.full_name ?? "—"}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[profile.role]}</p>
        </div>
        {!editing ? (
          <TextButton icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </TextButton>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <FormInput label="Name" value={form.full_name} onChangeText={set("full_name")} />
          <TextareaInput label="Address" value={form.address} onChangeText={set("address")} rows={2} maxLength={500} />
          <FormInput label="Employee ID" value={form.emp_id} onChangeText={set("emp_id")} placeholder="e.g. VW-014" />
          <PrimaryButton loading={update.isPending} onClick={save}>
            Save
          </PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ReadRow label="Phone" value={localPhone(profile.phone) || "—"} />
          <ReadRow label="Address" value={profile.address || "—"} />
          <ReadRow label="Employee ID" value={profile.emp_id || "—"} />
          <ReadRow label="Role" value={ROLE_LABELS[profile.role]} />
        </div>
      )}

      <button
        onClick={signOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-danger active:opacity-70"
      >
        <LogOut size={16} />
        Log out
      </button>
    </Modal>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
