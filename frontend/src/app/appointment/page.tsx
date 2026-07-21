"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Info } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  SelectInput,
  FormInput,
  TextareaInput,
  PrimaryButton,
  WarningBanner,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { useServices, useFamilyMembers } from "@/lib/hooks";
import { appointmentSchema } from "@/lib/schemas";
import { saveDraft } from "@/lib/draft";
import { money, timeSlots } from "@/lib/format";
import { todayISODate, addDays } from "@/lib/dates";
import { MIN_BOOKING_DAYS, MAX_BOOKING_DAYS } from "@shared/constants";

const SLOTS = timeSlots();

// SCREEN_ID: APPOINTMENT
export default function AppointmentPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading…" />}>
      <AppointmentInner />
    </Suspense>
  );
}

function AppointmentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useAuth();
  const { data: services, isLoading } = useServices();
  const { data: dependents } = useFamilyMembers();

  const [form, setForm] = useState({
    service_id: params.get("serviceId") ?? "",
    family_member_id: "",
    start_date: todayISODate(),
    num_days: "1",
    time_slot: SLOTS[0].value,
    symptom_brief: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // preselect the first service if none was passed
  const serviceId = form.service_id || services?.[0]?.id || "";
  const selectedService = useMemo(
    () => services?.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  );
  const days = Math.max(1, Number(form.num_days) || 1);
  const total = selectedService ? days * selectedService.price_per_day : 0;

  const profileComplete = !!profile?.full_name;

  const serviceOptions = (services ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} — ${money(s.price_per_day)}/day`,
  }));
  const subjectOptions = [
    { value: "", label: `Myself${profile?.full_name ? ` (${profile.full_name})` : ""}` },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: `${d.full_name} (${d.relationship})` })),
  ];

  const submit = () => {
    setErrors({});
    const candidate = {
      service_id: serviceId,
      family_member_id: form.family_member_id,
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
    if (!selectedService) {
      setErrors({ service_id: "Select a service" });
      return;
    }
    const subjectName =
      form.family_member_id === ""
        ? profile?.full_name ?? "Myself"
        : dependents?.find((d) => d.id === form.family_member_id)?.full_name ?? "Dependent";

    saveDraft({
      service_id: selectedService.id,
      service_name: selectedService.name,
      price_per_day: selectedService.price_per_day,
      family_member_id: form.family_member_id || null,
      subject_name: subjectName,
      start_date: form.start_date,
      num_days: days,
      time_slot: form.time_slot,
      symptom_brief: form.symptom_brief,
    });
    router.push("/payment");
  };

  if (isLoading) return <LoadingState message="Loading…" />;

  return (
    <div>
      <PageHeader title="Book an Appointment" subtitle="Request a home care visit." />

      {!profileComplete && (
        <div className="mb-4">
          <WarningBanner message="Complete your profile (name) before booking." />
          <div className="mt-2">
            <Link href="/profile" className="text-sm font-semibold text-purple-700 hover:text-purple-800">
              Go to Profile →
            </Link>
          </div>
        </div>
      )}

      <SectionCard icon={CalendarClock} title="Appointment details">
        <div className="space-y-4">
          <SelectInput label="Service" value={serviceId} onChange={set("service_id")} options={serviceOptions} id="service_id" />
          <SelectInput label="Care for" value={form.family_member_id} onChange={set("family_member_id")} options={subjectOptions} id="family_member_id" />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Start date" type="date" value={form.start_date} onChange={set("start_date")} error={errors.start_date} id="start_date" min={todayISODate()} required />
            <FormInput label="Number of days" type="number" value={form.num_days} onChange={set("num_days")} error={errors.num_days} id="num_days" min={MIN_BOOKING_DAYS} max={MAX_BOOKING_DAYS} required />
          </div>
          <SelectInput label="Preferred time slot" value={form.time_slot} onChange={set("time_slot")} options={SLOTS} id="time_slot" />
          <TextareaInput label="Brief on the problem faced" value={form.symptom_brief} onChange={set("symptom_brief")} placeholder="Describe symptoms or concerns…" rows={3} maxLength={2000} id="symptom_brief" />
        </div>
      </SectionCard>

      <div className="mb-6 rounded-xl border border-purple-100 bg-purple-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              {days} day{days > 1 ? "s" : ""} × {money(selectedService?.price_per_day ?? 0)}/day
            </p>
            {days > 1 && (
              <p className="mt-0.5 text-[11px] text-gray-400">
                {form.start_date} → {addDays(form.start_date, days)} (consecutive)
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Total</p>
            <p className="text-xl font-bold text-purple-700">{money(total)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <Info size={14} /> Slots are recorded as requested; availability is confirmed by our team.
      </div>

      <PrimaryButton onClick={submit} disabled={!profileComplete} fullWidth>
        Continue to Payment
      </PrimaryButton>
    </div>
  );
}
