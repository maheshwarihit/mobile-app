import { useMemo, useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarClock } from "lucide-react-native";
import {
  PageHeader,
  SectionCard,
  SelectSheet,
  DateField,
  TextareaInput,
  TimeField,
  PrimaryButton,
  WarningBanner,
  TextButton,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { translateServiceName } from "@/lib/serviceI18n";
import { useLanguage } from "@/lib/i18n";
import {
  useServices,
  useFamilyMembers,
  appointmentSchema,
  timeSlots,
  todayISODate,
  daysBetween,
  MAX_BOOKING_DAYS,
} from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

const SLOTS = timeSlots();

// Local, not UTC — `new Date("YYYY-MM-DD")` parses as UTC midnight, which can
// land on the wrong calendar day once shifted to the device's local zone.
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// SCREEN_ID: APPOINTMENT
export function AppointmentScreen({ navigation, route }: ServicesStackScreenProps<"Appointment">) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { data: services, isLoading } = useServices();
  const { data: dependents } = useFamilyMembers();

  const [form, setForm] = useState({
    service_id: route.params?.serviceId ?? "",
    family_member_id: "",
    start_date: todayISODate(),
    end_date: todayISODate(),
    time_slot: SLOTS[0].value,
    symptom_brief: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Picking a later start date shouldn't leave a stale end date before it.
  const setStartDate = (v: string) => setForm((f) => ({ ...f, start_date: v, end_date: f.end_date < v ? v : f.end_date }));

  const serviceId = form.service_id || services?.[0]?.id || "";
  const selectedService = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const profileComplete = !!profile?.full_name;

  // No price shown on the service picker — the amount is decided by the
  // care assistant/admin after the visit, not calculated at booking time.
  const serviceOptions = (services ?? []).map((s) => ({
    value: s.id,
    label: translateServiceName(t, s.name),
  }));
  const subjectOptions = [
    { value: "", label: `${t("appointment.myself")}${profile?.full_name ? ` (${profile.full_name})` : ""}` },
    ...(dependents ?? []).map((d) => ({ value: d.id, label: `${d.full_name} (${d.relationship})` })),
  ];

  const submit = () => {
    setErrors({});
    if (form.end_date < form.start_date) {
      setErrors({ end_date: t("appointment.error.endBeforeStart") });
      return;
    }
    const days = daysBetween(form.start_date, form.end_date);
    if (days > MAX_BOOKING_DAYS) {
      setErrors({ end_date: t("appointment.error.rangeTooLong", { max: MAX_BOOKING_DAYS }) });
      return;
    }
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
    // symptom_brief is optional in the shared schema (NewAppointmentModal's
    // admin-side "Note (optional)" field reuses the same schema and must stay
    // genuinely optional) — required specifically on the patient's own
    // booking form, enforced here rather than in the shared schema.
    if (form.symptom_brief.trim().length === 0) {
      setErrors({ symptom_brief: t("appointment.error.describeSymptoms") });
      return;
    }
    // The date picker only blocks past dates, not a past time slot on today's
    // date — defaults (today + the earliest slot) would otherwise create a
    // booking that's already "missed" the instant it's submitted.
    if (form.start_date === todayISODate()) {
      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (form.time_slot <= nowHHMM) {
        setErrors({ time_slot: t("appointment.error.timePassed") });
        return;
      }
    }
    if (!selectedService) {
      setErrors({ service_id: t("appointment.error.selectService") });
      return;
    }
    const subjectName =
      form.family_member_id === ""
        ? profile?.full_name ?? t("appointment.myself")
        : dependents?.find((d) => d.id === form.family_member_id)?.full_name ?? t("appointment.dependent");

    navigation.navigate("Payment", {
      draft: {
        service_id: selectedService.id,
        service_name: selectedService.name,
        family_member_id: form.family_member_id || null,
        subject_name: subjectName,
        service_mode: "home_care",
        start_date: form.start_date,
        end_date: form.end_date,
        num_days: days,
        time_slot: form.time_slot,
        symptom_brief: form.symptom_brief,
      },
    });
  };

  if (isLoading) return <LoadingState message={t("appointment.loading")} />;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-8" keyboardShouldPersistTaps="handled">
          <PageHeader
            title={t("appointment.title")}
            subtitle={t("appointment.subtitle")}
            onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
          />

          {!profileComplete ? (
            <View className="mb-4">
              <WarningBanner message={t("appointment.completeProfileWarning")} />
              <View className="mt-2 self-start">
                <TextButton onPress={() => navigation.navigate("ProfileTab")}>{t("appointment.goToProfile")}</TextButton>
              </View>
            </View>
          ) : null}

          <SectionCard icon={CalendarClock} title={t("appointment.sectionTitle")}>
            <View className="gap-4">
              <SelectSheet label={t("appointment.service")} value={serviceId} onValueChange={set("service_id")} options={serviceOptions} />
              <SelectSheet label={t("appointment.careFor")} value={form.family_member_id} onValueChange={set("family_member_id")} options={subjectOptions} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <DateField label={t("appointment.startDate")} value={form.start_date} onChange={setStartDate} error={errors.start_date} minimumDate={new Date()} required />
                </View>
                <View className="flex-1">
                  <DateField
                    label={t("appointment.endDate")}
                    value={form.end_date}
                    onChange={set("end_date")}
                    error={errors.end_date}
                    minimumDate={parseISODate(form.start_date)}
                    required
                  />
                </View>
              </View>
              <TimeField label={t("appointment.preferredTime")} value={form.time_slot} onChange={set("time_slot")} error={errors.time_slot} />
              <TextareaInput
                label={t("appointment.problemLabel")}
                value={form.symptom_brief}
                onChangeText={set("symptom_brief")}
                placeholder={t("appointment.problemPlaceholder")}
                rows={3}
                maxLength={2000}
                error={errors.symptom_brief}
                required
              />
            </View>
          </SectionCard>

          <View className="mb-5 rounded-xl border border-purple-100 bg-purple-50 p-4">
            <Text className="text-sm text-gray-600">{t("appointment.priceAfterVisitNote")}</Text>
          </View>

          <PrimaryButton fullWidth disabled={!profileComplete} onPress={submit}>
            {t("appointment.continueToPayment")}
          </PrimaryButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
