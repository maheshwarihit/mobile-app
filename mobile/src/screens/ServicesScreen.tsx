import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Stethoscope, ArrowRight, PhoneIncoming, UserPlus, PhoneCall, MessageSquareText } from "lucide-react-native";
import {
  PageHeader,
  PrimaryButton,
  OutlineButton,
  LoadingState,
  EmptyState,
  ErrorBanner,
  Card,
  ProfileCompletionRing,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";
import { useServices, useCreateBookingRequest, money, profileCompletionPercent, HOSPITAL_CONTACT_PHONE, NUTRITION_SERVICE, PARA_MEDICAL_SERVICE } from "@vagewell/shared";
import { imageForService } from "@/lib/serviceImage";
import { translateServiceName, translateServiceDescription } from "@/lib/serviceI18n";
import { ServiceCard } from "@/components/feature/ServiceCard";
import { FeedbackModal } from "@/components/feature/FeedbackModal";
import type { ServicesStackScreenProps } from "@/navigation/types";
import type { TranslationKey } from "@/lib/i18n";

// The modules each service opens in the app, shown first on the back of its card
// (same order as the Nutrition and Bio Markers module lists).
const SERVICE_MODULES: Record<string, TranslationKey[]> = {
  [NUTRITION_SERVICE]: [
    "nutrition.module.bodyMetrics",
    "nutrition.module.bmi",
    "nutrition.module.foodPlate",
    "nutrition.module.selfAssessment",
    "nutrition.module.foodSupplements",
  ],
  [PARA_MEDICAL_SERVICE]: ["labReports.title"],
};

// SCREEN_ID: SERVICE_LIST
export function ServicesScreen({ navigation }: ServicesStackScreenProps<"Services">) {
  const { t } = useLanguage();
  const { data: services, isLoading, error } = useServices();
  const { profile } = useAuth();
  const requestBooking = useCreateBookingRequest();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const profilePercent = profile ? profileCompletionPercent(profile) : 0;

  // No service picker here — this page is browse-only; the Service dropdown on
  // the Appointment screen is where a service is actually chosen.
  const book = () => navigation.navigate("Appointment", undefined);

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader
          title={t("services.title")}
          subtitle={t("services.subtitle")}
          action={
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setFeedbackOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("feedback.open")}
                className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 active:opacity-70"
              >
                <MessageSquareText size={18} color={BRAND} />
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`tel:${HOSPITAL_CONTACT_PHONE}`)}
                className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 active:opacity-70"
              >
                <PhoneCall size={18} color={BRAND} />
              </Pressable>
              <ProfileCompletionRing percent={profilePercent} onPress={() => navigation.navigate("ProfileTab")} />
            </View>
          }
        />

        {error ? <ErrorBanner message={t("services.loadError")} /> : null}
        {isLoading ? <LoadingState message={t("services.loading")} /> : null}

        <FlatList
          data={services ?? []}
          keyExtractor={(s) => s.id}
          contentContainerClassName="gap-3 pb-6"
          ListEmptyComponent={
            !isLoading && !error ? (
              <EmptyState icon={Stethoscope} title={t("services.empty.title")} description={t("services.empty.description")} />
            ) : null
          }
          ListFooterComponent={
            (services?.length ?? 0) > 0 ? (
              <View className="mt-2 gap-3">
                <View className="rounded-xl bg-accent p-4">
                  <Text className="text-center text-sm font-bold text-white">
                    {t("services.pricesFromNote", { price: money(Math.min(...(services ?? []).map((s) => s.price_per_day))) })}
                  </Text>
                </View>
                <OutlineButton
                  fullWidth
                  icon={PhoneIncoming}
                  disabled={requestBooking.isPending}
                  onPress={() => requestBooking.mutate(undefined)}
                >
                  {requestBooking.isPending ? t("services.requestSending") : t("services.requestForBooking")}
                </OutlineButton>
                <Text className="-mt-2 text-center text-xs text-gray-400">{t("services.requestHint")}</Text>
                <PrimaryButton fullWidth icon={ArrowRight} onPress={book}>
                  {t("services.bookAppointment")}
                </PrimaryButton>
                <OutlineButton fullWidth icon={UserPlus} onPress={() => navigation.navigate("ProfileTab")}>
                  {t("services.addFamilyMember")}
                </OutlineButton>
              </View>
            ) : null
          }
          renderItem={({ item: s }) => (
            <ServiceCard
              name={translateServiceName(t, s.name)}
              description={s.description ? translateServiceDescription(t, s.description) : ""}
              image={imageForService(s.name)}
              modules={(SERVICE_MODULES[s.name] ?? []).map((k) => t(k))}
              onPress={() =>
                // Nutrition and Bio Markers (Para-Medical) open their own modules instead of booking.
                s.name === NUTRITION_SERVICE
                  ? navigation.navigate("Nutrition")
                  : s.name === PARA_MEDICAL_SERVICE
                    ? navigation.navigate("LabReports")
                    : navigation.navigate("Appointment", { serviceId: s.id })
              }
            />
          )}
        />
      </View>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}
