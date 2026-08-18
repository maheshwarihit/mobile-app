import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { ChevronLeft } from "lucide-react-native";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useServices,
  appointmentSchema,
  timeSlots,
  todayISODate,
  normalizePhone,
  localPhone,
  money,
  qk,
  OTP_LENGTH,
  type Profile,
} from "@vagewell/shared";
import {
  AppModal,
  FormInput,
  TextareaInput,
  SelectSheet,
  DateField,
  TimeField,
  OtpInput,
  PrimaryButton,
  TextButton,
  ErrorBanner,
} from "@/components/ui";
import { supabase, createEphemeralClient } from "@/lib/supabase";
import { useResendTimer } from "@/hooks/useResendTimer";

const SLOTS = timeSlots();

type Mode = "existing" | "new";

/**
 * Admin books a real appointment on someone's behalf — either an already-
 * registered patient (search, pick, book — Pay at Visit only, mirroring the
 * web portal's 2026-07-31 `NewAppointmentModal`), or a brand-new caller on
 * the phone right now: admin-assisted live OTP sends a real code to the
 * caller's number, the caller reads it back over the call, admin enters it
 * — a genuinely phone-verified account is created that instant, then the
 * exact same booking form opens directly (no intermediate "log it for
 * later" step — this is a real booking end to end).
 *
 * No new backend: `verifyOtp()` runs on a throwaway client
 * (`createEphemeralClient`) so it can't overwrite the admin's own session
 * the way calling it on the shared client would.
 */
export function NewAppointmentModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("existing");
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<Profile | null>(null);

  const reset = () => {
    setMode("existing");
    setQuery("");
    setPatient(null);
  };

  const done = () => {
    reset();
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Appointment"
    >
      {!patient ? (
        <View className="mb-4 flex-row rounded-lg bg-gray-100 p-1">
          <Pressable
            onPress={() => setMode("existing")}
            className={`flex-1 items-center rounded-md py-2 ${mode === "existing" ? "bg-white" : ""}`}
          >
            <Text className={`text-sm font-semibold ${mode === "existing" ? "text-purple-700" : "text-gray-500"}`}>
              Existing patient
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("new")}
            className={`flex-1 items-center rounded-md py-2 ${mode === "new" ? "bg-white" : ""}`}
          >
            <Text className={`text-sm font-semibold ${mode === "new" ? "text-purple-700" : "text-gray-500"}`}>
              New caller
            </Text>
          </Pressable>
        </View>
      ) : null}

      {patient ? (
        <BookingForm key={patient.id} patient={patient} onChangePatient={() => setPatient(null)} onDone={done} />
      ) : mode === "existing" ? (
        <PatientSearch query={query} onQueryChange={setQuery} onPick={setPatient} />
      ) : (
        <NewCallerLiveVerify onVerified={setPatient} />
      )}
    </AppModal>
  );
}

function PatientSearch({
  query,
  onQueryChange,
  onPick,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onPick: (p: Profile) => void;
}) {
  const { data: profiles, isLoading, refetch } = useAllProfiles(true);
  // `qk.users` carries the shared 60s staleTime — if it was already fetched
  // earlier in the session (this modal opened once before, or the Team/User
  // Details screen populated it), this list can silently be up to a minute
  // stale, missing an account created moments ago. `phone_registered()` is a
  // live RPC with no caching, so it stays authoritative and can disagree
  // with a stale list here — force a fresh fetch every time this search UI
  // actually mounts, closing that gap regardless of the staleTime window.
  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return (profiles ?? [])
      .filter((p) => p.role === "patient")
      .filter((p) => (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .slice(0, 20);
  }, [profiles, q]);

  return (
    <View className="gap-3">
      <FormInput
        label="Search by name or phone"
        value={query}
        onChangeText={onQueryChange}
        placeholder="Type to search…"
      />
      <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Text className="py-4 text-center text-sm text-gray-400">Loading…</Text>
        ) : !q ? (
          <Text className="py-4 text-center text-sm text-gray-400">Start typing a patient's name or phone.</Text>
        ) : matches.length === 0 ? (
          <Text className="py-4 text-center text-sm text-gray-400">
            No match. Switch to "New caller" to verify and book them right now.
          </Text>
        ) : (
          <View className="gap-2">
            {matches.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => onPick(p)}
                className="rounded-lg border border-gray-100 p-3 active:bg-gray-50"
              >
                <Text className="text-sm font-semibold text-gray-900">{p.full_name ?? "—"}</Text>
                <Text className="text-xs text-gray-500">{localPhone(p.phone) || "—"}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Live, admin-assisted phone verification for a brand-new caller — see the
 * module doc-comment above for why this needs `createEphemeralClient()`.
 */
function NewCallerLiveVerify({ onVerified }: { onVerified: (p: Profile) => void }) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [fullName, setFullName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [e164, setE164] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resend = useResendTimer(60);

  const requestCode = async (phone: string): Promise<boolean> => {
    const client = createEphemeralClient();
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, data: { full_name: fullName.trim() } },
    });
    if (error) {
      setErr(error.message);
      return false;
    }
    resend.restart();
    return true;
  };

  const sendCode = async () => {
    setErr(null);
    if (fullName.trim().length < 2) {
      setErr("Enter their full name.");
      return;
    }
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const { data: already } = await supabase.rpc("phone_registered", { p_phone: normalized });
    if (already) {
      setBusy(false);
      setErr('This number already has an account — use "Existing patient" to search for them instead.');
      return;
    }
    const ok = await requestCode(normalized);
    setBusy(false);
    if (!ok) return;
    setE164(normalized);
    setStep("otp");
    toast.success(`Code sent to ${normalized}`);
  };

  const resendCode = async () => {
    setErr(null);
    setOtp("");
    const ok = await requestCode(e164);
    if (ok) toast.success("Code re-sent");
  };

  const verify = async () => {
    setErr(null);
    if (otp.length !== OTP_LENGTH) {
      setErr(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    const client = createEphemeralClient();
    const { data, error } = await client.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error || !data.user) {
      setBusy(false);
      setErr(error?.message ?? "Could not verify. Please try again.");
      return;
    }
    // Read the canonical row via the admin's own session — is_staff() RLS
    // already grants read on any profile, and handle_new_user() has already
    // created it by the time verifyOtp() resolves.
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    setBusy(false);
    if (profErr || !profile) {
      setErr('Verified, but could not load their profile. Search for them under "Existing patient".');
      return;
    }
    onVerified(profile as Profile);
  };

  if (step === "otp") {
    return (
      <View className="gap-4">
        <Text className="text-sm text-gray-600">
          Code sent to <Text className="font-semibold">{e164}</Text> — ask the caller to read it out.
        </Text>
        {err ? <ErrorBanner message={err} /> : null}
        <OtpInput value={otp} onChange={setOtp} autoFocus />
        <View className="flex-row items-center justify-between">
          <TextButton
            icon={ChevronLeft}
            onPress={() => {
              setStep("details");
              setOtp("");
              setErr(null);
            }}
          >
            Change number
          </TextButton>
          {resend.canResend ? (
            <TextButton onPress={resendCode}>Resend code</TextButton>
          ) : (
            <Text className="text-xs text-gray-500">Resend in {resend.secondsLeft}s</Text>
          )}
        </View>
        <PrimaryButton fullWidth loading={busy} onPress={verify}>
          Verify & Continue
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-xs text-gray-500">
        Sends a real code to the caller's phone while they're on the line — they read it back, you enter it, and a
        real account is created that instant. Then you book the appointment right away, same as for any patient.
      </Text>
      {err ? <ErrorBanner message={err} /> : null}
      <FormInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Name" autoCapitalize="words" required />
      <FormInput
        label="Mobile number"
        value={phoneRaw}
        onChangeText={setPhoneRaw}
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        required
      />
      <PrimaryButton fullWidth loading={busy} onPress={sendCode}>
        Send Code
      </PrimaryButton>
    </View>
  );
}

function BookingForm({
  patient,
  onChangePatient,
  onDone,
}: {
  patient: Profile;
  onChangePatient: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { data: dependents } = useFamilyMembersByAccount(patient.id);
  const { data: services, isLoading: servicesLoading } = useServices();

  const [form, setForm] = useState({
    service_id: "",
    family_member_id: "",
    start_date: todayISODate(),
    num_days: "1",
    time_slot: SLOTS[0].value,
    symptom_brief: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const serviceId = form.service_id || services?.[0]?.id || "";
  const selectedService = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const isFlatAdvance = selectedService?.pricing_model === "flat_advance";
  const days = Math.max(1, Number(form.num_days) || 1);
  const total = selectedService ? (isFlatAdvance ? selectedService.price_per_day : days * selectedService.price_per_day) : 0;

  const serviceOptions = (services ?? []).map((s) => ({
    value: s.id,
    label: s.pricing_model === "flat_advance" ? `${s.name} — Advance ${money(s.price_per_day)}` : `${s.name} — ${money(s.price_per_day)}/day`,
  }));
  const subjectOptions = [
    { value: "", label: `${patient.full_name ?? "Myself"} (self)` },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: `${d.full_name} (${d.relationship})` })),
  ];

  const submit = async () => {
    setErrors({});
    setErr(null);
    const candidate = {
      service_id: serviceId,
      family_member_id: form.family_member_id,
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
    // symptom_brief stays optional at the schema level (shared with the
    // patient's own Appointment screen, which enforces it the same manual
    // way) — enforced here too so an admin booking on someone's behalf always
    // captures a reason for the visit.
    if (form.symptom_brief.trim().length === 0) {
      setErrors({ symptom_brief: "Describe the symptoms or concerns" });
      return;
    }
    // Same same-day-past-slot guard the client's own Appointment screen has —
    // the defaults (today + earliest slot) would otherwise create a booking
    // that's already "missed" the instant it's submitted.
    if (form.start_date === todayISODate()) {
      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (form.time_slot <= nowHHMM) {
        setErrors({ time_slot: "That time has already passed today — pick a later time or a future date." });
        return;
      }
    }
    if (!selectedService) {
      setErrors({ service_id: "Select a service" });
      return;
    }

    setBusy(true);
    // account_id override is admin-only (tg_booking_snapshot, migration 0018)
    // — a patient's own insert can never set this, only stamps to auth.uid().
    const { error } = await supabase.from("bookings").insert({
      account_id: patient.id,
      service_id: selectedService.id,
      family_member_id: form.family_member_id || null,
      service_mode: "home_care",
      num_days: days,
      start_date: form.start_date,
      time_slot: form.time_slot,
      symptom_brief: form.symptom_brief || null,
      payment_method: "direct",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: qk.bookings("all") });
    toast.success("Appointment booked — Pay at Visit");
    onDone();
  };

  if (servicesLoading) return <Text className="py-4 text-center text-sm text-gray-400">Loading…</Text>;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between rounded-lg bg-purple-50 px-3 py-2">
        <View>
          <Text className="text-sm font-semibold text-gray-900">{patient.full_name ?? "—"}</Text>
          <Text className="text-xs text-gray-500">{localPhone(patient.phone) || "—"}</Text>
        </View>
        <TextButton icon={ChevronLeft} onPress={onChangePatient}>
          Change
        </TextButton>
      </View>

      {err ? <ErrorBanner message={err} /> : null}

      <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <SelectSheet label="Service" value={serviceId} onValueChange={set("service_id")} options={serviceOptions} />
          <SelectSheet
            label="Care for"
            value={form.family_member_id}
            onValueChange={set("family_member_id")}
            options={subjectOptions}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField
                label="Start date"
                value={form.start_date}
                onChange={set("start_date")}
                error={errors.start_date}
                minimumDate={new Date()}
                required
              />
            </View>
            <View className="flex-1">
              <FormInput
                label={isFlatAdvance ? "Number of months" : "Number of days"}
                value={form.num_days}
                onChangeText={set("num_days")}
                keyboardType="number-pad"
                error={errors.num_days}
                required
              />
            </View>
          </View>
          <TimeField label="Preferred time" value={form.time_slot} onChange={set("time_slot")} error={errors.time_slot} />
          <TextareaInput
            label="Note"
            value={form.symptom_brief}
            onChangeText={set("symptom_brief")}
            placeholder="Describe symptoms or concerns…"
            rows={2}
            maxLength={2000}
            error={errors.symptom_brief}
            required
          />
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
        <Text className="text-xs text-gray-500">Pay at Visit</Text>
        <Text className="text-base font-bold text-purple-700">{money(total)}</Text>
      </View>

      <PrimaryButton fullWidth loading={busy} onPress={submit}>
        Book Appointment
      </PrimaryButton>
    </View>
  );
}
