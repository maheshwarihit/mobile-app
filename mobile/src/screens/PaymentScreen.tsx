import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ShieldCheck, CheckCircle2 } from "lucide-react-native";
import { PageHeader, SectionCard, PrimaryButton, ErrorBanner } from "@/components/ui";
import { BRAND } from "@/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { translateServiceName } from "@/lib/serviceI18n";
import { translateTamilToEnglish } from "@/lib/translateText";
import { supabase } from "@/lib/supabase";
import { formatSlot, formatDate, qk } from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

// SCREEN_ID: PAYMENT
// No payment method or amount is collected here — the care assistant/admin
// shares the charges with the customer after the visit, and the customer
// pays that told amount outside this booking flow. This screen is now a
// plain review-and-confirm step for the booking itself.
export function PaymentScreen({ navigation, route }: ServicesStackScreenProps<"Payment">) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { draft } = route.params;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    if (!user) return;
    setErr(null);
    setBusy(true);

    // Free text is stored in English regardless of what script the customer
    // typed in — best-effort auto-translate (translateText.ts), so a Tamil
    // symptom brief still reads clearly to ops staff.
    const symptomBrief = draft.symptom_brief ? await translateTamilToEnglish(draft.symptom_brief) : null;
    const { error } = await supabase.from("bookings").insert({
      service_id: draft.service_id,
      family_member_id: draft.family_member_id,
      service_mode: draft.service_mode,
      num_days: draft.num_days,
      start_date: draft.start_date,
      time_slot: draft.time_slot,
      symptom_brief: symptomBrief,
      payment_method: "direct",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: qk.bookings("mine") });
    toast.success(t("payment.toast.confirmed"));
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-authbg">
        <View className="flex-1 items-center justify-center px-8">
          <CheckCircle2 size={64} color={BRAND} />
          <Text className="mt-4 text-xl font-bold text-gray-900">{t("payment.booked.title")}</Text>
          <Text className="mt-2 text-center text-sm text-gray-600">{t("payment.booked.direct")}</Text>
          <View className="mt-4 w-full rounded-xl border border-gray-100 bg-white p-4">
            <Row label={t("payment.row.service")} value={translateServiceName(t, draft.service_name)} />
            <Row label={t("payment.row.careFor")} value={draft.subject_name} />
            <Row label={t("payment.row.when")} value={`${formatDate(draft.start_date)} · ${formatSlot(draft.time_slot)}`} />
            <Row label={t("payment.row.endDate")} value={formatDate(draft.end_date)} />
          </View>
          <View className="mt-6 w-full">
            <PrimaryButton fullWidth onPress={() => navigation.navigate("AppointmentsTab")}>
              {t("payment.viewAppointments")}
            </PrimaryButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        {/* Back to the appointment form — but only while nothing has been
            written. Once the insert has succeeded a second pass through this
            screen would duplicate the booking, so the way out is the
            dashboard, not Back. */}
        <PageHeader title={t("payment.title")} subtitle={t("payment.subtitle")} onBack={busy ? undefined : () => navigation.goBack()} />

        <SectionCard icon={CalendarCheck} title={t("payment.summary.title")}>
          <View className="gap-2">
            <Row label={t("payment.row.service")} value={translateServiceName(t, draft.service_name)} />
            <Row label={t("payment.row.careFor")} value={draft.subject_name} />
            <Row label={t("payment.row.startDate")} value={formatDate(draft.start_date)} />
            <Row label={t("payment.row.endDate")} value={formatDate(draft.end_date)} />
            <Row label={t("payment.row.time")} value={formatSlot(draft.time_slot)} />
          </View>
        </SectionCard>

        <View className="mb-5 mt-4 rounded-xl border border-purple-100 bg-purple-50 p-4">
          <Text className="text-sm text-gray-600">{t("payment.priceAfterVisitNote")}</Text>
        </View>

        {err ? <ErrorBanner message={err} /> : null}

        <View className="mb-3 mt-2 flex-row items-center gap-2">
          <ShieldCheck size={14} color="#9ca3af" />
          <Text className="flex-1 text-xs text-gray-400">{t("payment.privacyNote")}</Text>
        </View>

        <PrimaryButton fullWidth loading={busy} onPress={confirm}>
          {t("payment.confirmBooking")}
        </PrimaryButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-900">{value}</Text>
    </View>
  );
}
