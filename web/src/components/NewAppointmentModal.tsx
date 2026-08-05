"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Modal,
  FormInput,
  SelectField,
  TextareaInput,
  PrimaryButton,
  TextButton,
  ErrorBanner,
  EmptyState,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useServices,
  appointmentSchema,
  timeSlots,
  todayISODate,
  money,
  qk,
  localPhone,
  type Profile,
} from "@vagewell/shared";

const SLOTS = timeSlots();

/** Admin books a real appointment on a caller's behalf (0018) — existing accounts only, Pay at Visit only. */
export function NewAppointmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profiles } = useAllProfiles(open);
  const { data: services } = useServices();
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<Profile | null>(null);
  const { data: dependents } = useFamilyMembersByAccount(patient?.id ?? null);
  const [familyMemberId, setFamilyMemberId] = useState("");
  const [form, setForm] = useState({
    service_id: "",
    start_date: todayISODate(),
    num_days: "1",
    time_slot: SLOTS[0].value,
    symptom_brief: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (profiles ?? [])
      .filter((p) => p.role === "patient")
      .filter((p) => (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .slice(0, 20);
  }, [profiles, query]);

  const subjectOptions = [
    { value: "", label: `Myself${patient?.full_name ? ` (${patient.full_name})` : ""}` },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: `${d.full_name} (${d.relationship})` })),
  ];
  const serviceOptions = (services ?? []).map((s) => ({
    value: s.id,
    label: s.pricing_model === "flat_advance" ? `${s.name} — Advance ${money(s.price_per_day)}` : `${s.name} — ${money(s.price_per_day)}/day`,
  }));
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setQuery("");
    setPatient(null);
    setFamilyMemberId("");
    setForm({ service_id: "", start_date: todayISODate(), num_days: "1", time_slot: SLOTS[0].value, symptom_brief: "" });
    setErrors({});
  };

  const submit = async () => {
    if (!patient) return;
    setErrors({});
    const serviceId = form.service_id || services?.[0]?.id || "";
    const days = Math.max(1, Number(form.num_days) || 1);
    const candidate = {
      service_id: serviceId,
      family_member_id: familyMemberId,
      service_mode: "home_care" as const,
      start_date: form.start_date,
      num_days: days,
      time_slot: form.time_slot,
      symptom_brief: form.symptom_brief,
    };
    const parsed = appointmentSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    if (form.start_date === todayISODate()) {
      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (form.time_slot <= nowHHMM) {
        setErrors({ time_slot: "That time has already passed today — pick a later time or a future date." });
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      account_id: patient.id,
      service_id: serviceId,
      family_member_id: familyMemberId || null,
      service_mode: "home_care",
      num_days: days,
      start_date: form.start_date,
      time_slot: form.time_slot,
      symptom_brief: form.symptom_brief || null,
      payment_method: "direct",
    });
    setBusy(false);
    if (error) {
      setErrors({ form: error.message });
      return;
    }
    void qc.invalidateQueries({ queryKey: qk.bookings("all") });
    toast.success("Appointment booked — pay at visit.");
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <h3 className="mb-4 text-lg font-bold text-gray-900">Book an appointment for a caller</h3>

      {!patient ? (
        <div className="flex flex-col gap-3">
          <FormInput label="Find client" value={query} onChangeText={setQuery} placeholder="Name or phone…" icon={Search} />
          {query.trim() && matches.length === 0 ? (
            <EmptyState title="No match" description="No client found with that name or phone. They need an account first." />
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatient(p)}
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
          <TextButton icon={ChevronLeft} onClick={() => setPatient(null)}>
            Change client
          </TextButton>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">{patient.full_name ?? "—"}</p>
            <p className="text-xs text-gray-500">{localPhone(patient.phone) || "—"}</p>
          </div>

          {errors.form ? <ErrorBanner message={errors.form} /> : null}

          <SelectField label="Care for" value={familyMemberId} onValueChange={setFamilyMemberId} options={subjectOptions} />
          <SelectField label="Service" value={form.service_id || services?.[0]?.id || ""} onValueChange={set("service_id")} options={serviceOptions} />
          {errors.service_id ? <span className="text-xs text-danger">{errors.service_id}</span> : null}

          <div className="flex gap-3">
            <div className="flex-1">
              <FormInput label="Start date" value={form.start_date} onChangeText={set("start_date")} type="date" />
              {errors.start_date ? <span className="text-xs text-danger">{errors.start_date}</span> : null}
            </div>
            <div className="flex-1">
              <FormInput label="Days / months" value={form.num_days} onChangeText={set("num_days")} type="number" />
              {errors.num_days ? <span className="text-xs text-danger">{errors.num_days}</span> : null}
            </div>
          </div>

          <SelectField label="Time" value={form.time_slot} onValueChange={set("time_slot")} options={SLOTS} />
          {errors.time_slot ? <span className="text-xs text-danger">{errors.time_slot}</span> : null}

          <TextareaInput label="Note (optional)" value={form.symptom_brief} onChangeText={set("symptom_brief")} placeholder="Symptoms or context from the call…" rows={2} maxLength={2000} />

          <p className="text-xs text-gray-400">Payment: Pay at Visit — the client settles with staff in person.</p>

          <PrimaryButton fullWidth loading={busy} onClick={submit}>
            Book appointment
          </PrimaryButton>
        </div>
      )}
    </Modal>
  );
}
