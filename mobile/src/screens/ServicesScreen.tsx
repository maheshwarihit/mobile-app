import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stethoscope, ArrowRight, PhoneIncoming, UserPlus, PhoneCall } from "lucide-react-native";
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
import { useServices, useCreateBookingRequest, money, profileCompletionPercent, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";
import { iconForService } from "@/lib/serviceIcon";
import { translateServiceName, translateServiceDescription } from "@/lib/serviceI18n";
import { ServiceDescription } from "@/components/feature/ServiceDescription";
import type { ServicesStackScreenProps } from "@/navigation/types";

// SCREEN_ID: SERVICE_LIST
export function ServicesScreen({ navigation }: ServicesStackScreenProps<"Services">) {
  const { t } = useLanguage();
  const { data: services, isLoading, error } = useServices();
  const { profile } = useAuth();
  const requestBooking = useCreateBookingRequest();

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
                <View className="rounded-xl bg-[#63A147] p-4">
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
                <Text className="text-center text-xs text-purple-700">{t("services.addFamilyHint")}</Text>
              </View>
            ) : null
          }
          renderItem={({ item: s }) => {
            const Icon = iconForService(s.name);
            return (
            <Pressable onPress={() => navigation.navigate("Appointment", { serviceId: s.id })} className="active:opacity-70">
              <Card className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                    <Icon size={18} color={BRAND} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{translateServiceName(t, s.name)}</Text>
                    {s.description ? <ServiceDescription text={translateServiceDescription(t, s.description)} /> : null}
                  </View>
                </View>
              </Card>
            </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}
