import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stethoscope, ArrowRight, UserPlus, PhoneCall } from "lucide-react-native";
import { PageHeader, SmallPrimaryButton, OutlineButton, LoadingState, EmptyState, ErrorBanner, Card } from "@/components/ui";
import { BRAND } from "@/theme";
import { useServices, money, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

// SCREEN_ID: SERVICE_LIST
export function ServicesScreen({ navigation }: ServicesStackScreenProps<"Services">) {
  const { data: services, isLoading, error } = useServices();

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader
          title="Our services"
          subtitle="Choose a service to begin your care journey."
          action={
            <Pressable
              onPress={() => Linking.openURL(`tel:${HOSPITAL_CONTACT_PHONE}`)}
              className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 active:opacity-70"
            >
              <PhoneCall size={18} color={BRAND} />
            </Pressable>
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
            <View className="mt-2">
              <OutlineButton fullWidth icon={UserPlus} onPress={() => navigation.navigate("ProfileTab")}>
                Add a family member
              </OutlineButton>
              <Text className="mt-2 text-center text-xs text-purple-700">
                Book for a parent, spouse, or child under this same login.
              </Text>
            </View>
          }
          renderItem={({ item: s }) => (
            <Card className="p-4">
              <View className="flex-row items-start gap-3">
                <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <Stethoscope size={18} color={BRAND} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{s.name}</Text>
                  {s.description ? <Text className="mt-0.5 text-sm text-gray-500">{s.description}</Text> : null}
                </View>
              </View>
              <View className="mt-3 flex-row justify-end">
                <SmallPrimaryButton icon={ArrowRight} onPress={() => navigation.navigate("Appointment", { serviceId: s.id })}>
                  {s.pricing_model === "flat_advance" ? `Book · ${money(s.price_per_day)} advance` : `Book · ${money(s.price_per_day)}/day`}
                </SmallPrimaryButton>
              </View>
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
