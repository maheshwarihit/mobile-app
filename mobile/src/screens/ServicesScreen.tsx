import { useState } from "react";
import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Stethoscope, CheckCircle2, ArrowRight, UserPlus, PhoneCall } from "lucide-react-native";
import { PageHeader, PrimaryButton, OutlineButton, LoadingState, EmptyState, ErrorBanner, Card } from "@/components/ui";
import { BRAND } from "@/theme";
import { useServices, money, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

// SCREEN_ID: SERVICE_LIST
export function ServicesScreen({ navigation }: ServicesStackScreenProps<"Services">) {
  const { data: services, isLoading, error } = useServices();
  const [selected, setSelected] = useState<string | null>(null);

  const book = () => {
    if (!selected) {
      toast.error("Choose a service first.");
      return;
    }
    navigation.navigate("Appointment", { serviceId: selected });
  };

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
            (services?.length ?? 0) > 0 ? (
              <View className="mt-2 gap-3">
                <PrimaryButton fullWidth icon={ArrowRight} onPress={book}>
                  Request Appointment
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
          renderItem={({ item: s }) => {
            const isSelected = selected === s.id;
            return (
              <Pressable onPress={() => setSelected(s.id)}>
                <Card className={`p-4 ${isSelected ? "border-2 border-purple-500" : ""}`}>
                  <View className="flex-row items-start gap-3">
                    <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                      <Stethoscope size={18} color={BRAND} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">{s.name}</Text>
                      {s.description ? <Text className="mt-0.5 text-sm text-gray-500">{s.description}</Text> : null}
                      <Text className="mt-1 text-sm font-semibold text-purple-700">
                        {s.pricing_model === "flat_advance" ? `Advance ${money(s.price_per_day)} (monthly)` : `${money(s.price_per_day)}/day`}
                      </Text>
                    </View>
                    {isSelected ? <CheckCircle2 size={20} color={BRAND} /> : null}
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
