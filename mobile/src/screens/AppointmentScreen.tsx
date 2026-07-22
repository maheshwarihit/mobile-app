import { useMemo, useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarClock, Info } from "lucide-react-native";
import {
  PageHeader,
  SectionCard,
  SelectSheet,
  FormInput,
  DateField,
  TextareaInput,
  TimeField,
  PrimaryButton,
  WarningBanner,
  TextButton,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import {
  useServices,
  useFamilyMembers,
  appointmentSchema,
  money,
  timeSlots,
  todayISODate,
  addDays,
} from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

const SLOTS = timeSlots();

// SCREEN_ID: APPOINTMENT
export function AppointmentScreen({ navigation, route }: ServicesStackScreenProps<"Appointment">) {
  const { profile } = useAuth();
  const { data: services, isLoading } = useServices();
  const { data: dependents } = useFamilyMembers();

  const [form, setForm] = useState({
    service_id: route.params?.serviceId ?? "",
    family_member_id: "",
    start_date: todayISODate(),
    num_days: "1",
    time_slot: SLOTS[0].value,
    symptom_brief: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const serviceId = form.service_id || services?.[0]?.id || "";
  const selectedService = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const days = Math.max(1, Number(form.num_days) || 1);
  const total = selectedService ? days * selectedService.price_per_day : 0;
  const profileComplete = !!profile?.full_name;

  const serviceOptions = (services ?? []).map((s) => ({ value: s.id, label: `${s.name} — ${money(s.price_per_day)}/day` }));
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

    navigation.navigate("Payment", {
      draft: {
        service_id: selectedService.id,
        service_name: selectedService.name,
        price_per_day: selectedService.price_per_day,
        family_member_id: form.family_member_id || null,
        subject_name: subjectName,
        start_date: form.start_date,
        num_days: days,
        time_slot: form.time_slot,
        symptom_brief: form.symptom_brief,
      },
    });
  };

  if (isLoading) return <LoadingState message="Loading…" />;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-8" keyboardShouldPersistTaps="handled">
          <PageHeader title="Book an Appointment" subtitle="Request a home care visit." />

          {!profileComplete ? (
            <View className="mb-4">
              <WarningBanner message="Complete your profile (name) before booking." />
              <View className="mt-2 self-start">
                <TextButton onPress={() => navigation.navigate("ProfileTab")}>Go to Profile →</TextButton>
              </View>
            </View>
          ) : null}

          <SectionCard icon={CalendarClock} title="Appointment details">
            <View className="gap-4">
              <SelectSheet label="Service" value={serviceId} onValueChange={set("service_id")} options={serviceOptions} />
              <SelectSheet label="Care for" value={form.family_member_id} onValueChange={set("family_member_id")} options={subjectOptions} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <DateField label="Start date" value={form.start_date} onChange={set("start_date")} error={errors.start_date} minimumDate={new Date()} required />
                </View>
                <View className="flex-1">
                  <FormInput label="Number of days" value={form.num_days} onChangeText={set("num_days")} keyboardType="number-pad" error={errors.num_days} required />
                </View>
              </View>
              <TimeField label="Preferred time" value={form.time_slot} onChange={set("time_slot")} error={errors.time_slot} />
              <TextareaInput label="Brief on the problem faced" value={form.symptom_brief} onChangeText={set("symptom_brief")} placeholder="Describe symptoms or concerns…" rows={3} maxLength={2000} />
            </View>
          </SectionCard>

          <View className="mb-5 rounded-xl border border-purple-100 bg-purple-50 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm text-gray-600">
                  {days} day{days > 1 ? "s" : ""} × {money(selectedService?.price_per_day ?? 0)}/day
                </Text>
                {days > 1 ? (
                  <Text className="mt-0.5 text-[11px] text-gray-400">
                    {form.start_date} → {addDays(form.start_date, days)} (consecutive)
                  </Text>
                ) : null}
              </View>
              <View className="items-end">
                <Text className="text-[11px] uppercase tracking-wide text-gray-400">Total</Text>
                <Text className="text-xl font-bold text-purple-700">{money(total)}</Text>
              </View>
            </View>
          </View>

          <View className="mb-3 flex-row items-center gap-2">
            <Info size={14} color="#9ca3af" />
            <Text className="flex-1 text-xs text-gray-400">
              Slots are recorded as requested; availability is confirmed by our team.
            </Text>
          </View>

          <PrimaryButton fullWidth disabled={!profileComplete} onPress={submit}>
            Continue to Payment
          </PrimaryButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
