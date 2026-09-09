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
  OutlineButton,
  WarningBanner,
  TextButton,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { translateServiceName, translateServiceDescription } from "@/lib/serviceI18n";
import { ServiceDescription } from "@/components/feature/ServiceDescription";
import { useLanguage } from "@/lib/i18n";
import {
  useServices,
  useFamilyMembers,
  appointmentSchema,
  timeSlots,
  todayISODate,
  daysBetween,
  MAX_BOOKING_DAYS,
  MIN_BOOKING_LEAD_MINUTES,
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
    // Which of the selected service's listed areas the visit is about — makes
    // each service's booking screen genuinely specific to that service rather
    // than an identical form (QA row 24). Optional; folded into the brief.
    focus_area: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Arriving from a tapped service card (route param set) means the service is
  // already chosen — showing an open dropdown again reads as "why is it asking
  // me twice?". Start collapsed to a summary row with a Change affordance; only
  // open as a picker when the user came in without a pre-pick, or taps Change.
  const [showServicePicker, setShowServicePicker] = useState(!route.params?.serviceId);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Switching service invalidates any focus area picked for the previous one.
  const setService = (v: string) => setForm((f) => ({ ...f, service_id: v, focus_area: "" }));
  // Picking a later start date shouldn't leave a stale end date before it.
  const setStartDate = (v: string) => setForm((f) => ({ ...f, start_date: v, end_date: f.end_date < v ? v : f.end_date }));

  const serviceId = form.service_id || services?.[0]?.id || "";
  const selectedService = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const profileComplete = !!profile?.full_name;

  // The service description is "summary\n• area\n• area…" — offer those areas
  // as an optional picker so the form reflects the specific service chosen.
  const serviceDescription = selectedService ? translateServiceDescription(t, selectedService.description) : "";
  const focusOptions = useMemo(() => {
    const areas = serviceDescription
      .split("\n")
      .filter((l) => l.trim().startsWith("•"))
      .map((l) => l.replace(/^[•\s]+/, "").trim())
      .filter(Boolean);
    return [{ value: "", label: t("appointment.focusAreaNone") }, ...areas.map((a) => ({ value: a, label: a }))];
  }, [serviceDescription, t]);

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
    // The date picker only blocks past dates, not a past — or too-soon — time
    // slot on today's date. A same-day slot must be far enough out that the
    // care team can actually plan and travel to the visit (a booking 20 min
    // from now isn't serviceable), so require MIN_BOOKING_LEAD_MINUTES of
    // notice rather than merely "not in the past".
    if (form.start_date === todayISODate()) {
      const [sh, sm] = form.time_slot.split(":").map(Number);
      const slot = new Date();
      slot.setHours(sh || 0, sm || 0, 0, 0);
      const earliest = Date.now() + MIN_BOOKING_LEAD_MINUTES * 60_000;
      if (slot.getTime() < earliest) {
        setErrors({ time_slot: t("appointment.error.leadTime", { hours: MIN_BOOKING_LEAD_MINUTES / 60 }) });
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

    // Prepend the chosen focus area so it reaches ops with the brief (no
    // schema change needed — it rides along in symptom_brief).
    const brief = form.focus_area ? `${form.focus_area}: ${form.symptom_brief}` : form.symptom_brief;

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
        symptom_brief: brief,
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
            onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Services"))}
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
              {showServicePicker ? (
                <SelectSheet label={t("appointment.service")} value={serviceId} onValueChange={setService} options={serviceOptions} />
              ) : (
                <View>
                  <Text className="mb-1.5 text-sm font-medium text-gray-700">{t("appointment.service")}</Text>
                  <View className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <Text className="flex-1 text-base text-gray-900">
                      {selectedService ? translateServiceName(t, selectedService.name) : "—"}
                    </Text>
                    <TextButton onPress={() => setShowServicePicker(true)}>{t("appointment.changeService")}</TextButton>
                  </View>
                </View>
              )}
              {selectedService && serviceDescription ? (
                <View className="-mt-1 rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3">
                  <Text className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
                    {t("appointment.serviceCovers")}
                  </Text>
                  <ServiceDescription text={serviceDescription} />
                </View>
              ) : null}
              {focusOptions.length > 1 ? (
                <SelectSheet
                  label={t("appointment.focusArea")}
                  value={form.focus_area}
                  onValueChange={set("focus_area")}
                  options={focusOptions}
                />
              ) : null}
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
              <View>
                <TimeField label={t("appointment.preferredTime")} value={form.time_slot} onChange={set("time_slot")} error={errors.time_slot} />
                {form.start_date === todayISODate() ? (
                  <Text className="mt-1.5 text-xs text-gray-400">
                    {t("appointment.leadTimeHint", { hours: MIN_BOOKING_LEAD_MINUTES / 60 })}
                  </Text>
                ) : null}
              </View>
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
          <View className="mt-3">
            <OutlineButton
              fullWidth
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Services"))}
            >
              {t("appointment.cancel")}
            </OutlineButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
