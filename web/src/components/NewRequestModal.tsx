"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft } from "lucide-react";
import { Modal, FormInput, TextareaInput, PrimaryButton, TextButton, EmptyState } from "@/components/ui";
import { useAllProfiles, useAdminCreateBookingRequest, localPhone, type Profile } from "@vagewell/shared";

/** Admin logs an incoming call as a request against a specific patient's account (0017). */
export function NewRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profiles } = useAllProfiles(open);
  const create = useAdminCreateBookingRequest();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [note, setNote] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (profiles ?? [])
      .filter((p) => p.role === "patient")
      .filter((p) => (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .slice(0, 20);
  }, [profiles, query]);

  const reset = () => {
    setQuery("");
    setSelected(null);
    setNote("");
  };

  const submit = () => {
    if (!selected) return;
    create.mutate(
      { accountId: selected.id, note },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <h3 className="mb-4 text-lg font-bold text-gray-900">Log a booking request</h3>

      {!selected ? (
        <div className="flex flex-col gap-3">
          <FormInput
            label="Find patient"
            value={query}
            onChangeText={setQuery}
            placeholder="Name or phone…"
            icon={Search}
          />
          {query.trim() && matches.length === 0 ? (
            <EmptyState title="No match" description="No patient found with that name or phone." />
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left active:opacity-70"
                >
                  <p className="text-sm font-medium text-gray-900">{p.full_name ?? "—"}</p>
                  <p className="text-xs text-gray-500">{localPhone(p.phone) || "—"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <TextButton icon={ChevronLeft} onClick={() => setSelected(null)}>
            Change patient
          </TextButton>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">{selected.full_name ?? "—"}</p>
            <p className="text-xs text-gray-500">{localPhone(selected.phone) || "—"}</p>
          </div>
          <TextareaInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why they called, what they asked about…" rows={3} maxLength={1000} />
          <PrimaryButton fullWidth loading={create.isPending} onClick={submit}>
            Log request
          </PrimaryButton>
        </div>
      )}
    </Modal>
  );
}
