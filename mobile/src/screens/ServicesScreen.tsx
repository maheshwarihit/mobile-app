import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Stethoscope, ArrowRight, PhoneIncoming, UserPlus, PhoneCall } from "lucide-react-native";
import { PageHeader, PrimaryButton, OutlineButton, LoadingState, EmptyState, ErrorBanner, Card } from "@/components/ui";
import { PremiumPackagesSection } from "@/components/feature/PremiumPackagesSection";
import { useAuth } from "@/providers/AuthProvider";
import { BRAND } from "@/theme";
import { useServices, useCreateBookingRequest, money, profileCompletionPercent, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

const RING_SIZE = 44;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Naukri-style profile completion ring — tap to jump to the Profile tab. */
function ProfileCompletionButton({ percent, onPress }: { percent: number; onPress: () => void }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <Pressable onPress={onPress} className="h-11 w-11 items-center justify-center active:opacity-70">
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke="#e5e7eb" strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={BRAND}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <Text className="text-[9px] font-bold text-gray-700">{clamped}%</Text>
    </Pressable>
  );
}

// SCREEN_ID: SERVICE_LIST
export function ServicesScreen({ navigation }: ServicesStackScreenProps<"Services">) {
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
          title="Our services"
          subtitle="Choose a service to begin your care journey."
          action={
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => Linking.openURL(`tel:${HOSPITAL_CONTACT_PHONE}`)}
                className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 active:opacity-70"
              >
                <PhoneCall size={18} color={BRAND} />
              </Pressable>
              <ProfileCompletionButton percent={profilePercent} onPress={() => navigation.navigate("ProfileTab")} />
            </View>
          }
        />

        {error ? <ErrorBanner message="Could not load services. Please try again." /> : null}
        {isLoading ? <LoadingState message="Loading services…" /> : null}

        <FlatList
          data={services ?? []}
          keyExtractor={(s) => s.id}
          contentContainerClassName="gap-3 pb-6"
          ListEmptyComponent={
            !isLoading && !error ? (
              <EmptyState icon={Stethoscope} title="No services available" description="Please check back later." />
            ) : null
          }
          ListFooterComponent={
            (services?.length ?? 0) > 0 ? (
              <View className="mt-2 gap-3">
                <View className="mb-2">
                  <PremiumPackagesSection onPressPackage={book} />
                </View>
                <OutlineButton
                  fullWidth
                  icon={PhoneIncoming}
                  disabled={requestBooking.isPending}
                  onPress={() => requestBooking.mutate(undefined)}
                >
                  {requestBooking.isPending ? "Sending…" : "Request for Booking"}
                </OutlineButton>
                <Text className="-mt-2 text-center text-xs text-gray-400">
                  Not ready to pick a service? Ask our team to call you back.
                </Text>
                <PrimaryButton fullWidth icon={ArrowRight} onPress={book}>
                  Book Appointment
                </PrimaryButton>
                <OutlineButton fullWidth icon={UserPlus} onPress={() => navigation.navigate("ProfileTab")}>
                  Add a family member
                </OutlineButton>
                <Text className="text-center text-xs text-purple-700">
                  Book for a parent, spouse, or child under this same login.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: s }) => (
            <Pressable onPress={() => navigation.navigate("Appointment", { serviceId: s.id })} className="active:opacity-70">
              <Card className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                    <Stethoscope size={18} color={BRAND} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{s.name}</Text>
                    {s.description ? <Text className="mt-0.5 text-sm text-gray-500">{s.description}</Text> : null}
                    <Text className="mt-1 text-sm font-semibold text-purple-700">
                      {s.pricing_model === "flat_advance" ? `Advance ${money(s.price_per_day)} (monthly package)` : `${money(s.price_per_day)}/day`}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
