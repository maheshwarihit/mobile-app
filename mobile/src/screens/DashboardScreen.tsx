import { useMemo } from "react";
import { View, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck } from "lucide-react-native";
import { PageHeader, LoadingState, EmptyState, ErrorBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { PatientBookingCard } from "@/components/feature/PatientBookingCard";
import { useMyBookings, useFamilyMembers } from "@vagewell/shared";

// SCREEN_ID: DASHBOARD — patient "My Appointments" (AppointmentsTab).
// Staff/admin get the separate AdminNavigator, not this screen.
export function DashboardScreen() {
  const { profile, user } = useAuth();
  const { data: bookings, isLoading, error } = useMyBookings();
  const { data: deps } = useFamilyMembers();
  const depMap = useMemo(() => Object.fromEntries((deps ?? []).map((d) => [d.id, d.full_name])), [deps]);
  const profileName = profile?.full_name ?? "Myself";
  const userId = user?.id ?? "";

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <PageHeader title="My Appointments" subtitle="Your booked home-care visits." />
        <FlatList
          data={bookings ?? []}
          keyExtractor={(b) => b.id}
          contentContainerClassName="gap-3 pb-6"
          ListHeaderComponent={
            <View>
              {error ? <ErrorBanner message="Could not load your appointments." /> : null}
              {isLoading ? <LoadingState message="Loading appointments…" /> : null}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState icon={CalendarCheck} title="No appointments yet" description="Book a service to see it here." />
            ) : null
          }
          renderItem={({ item: b }) => (
            <PatientBookingCard
              booking={b}
              userId={userId}
              subjectName={b.family_member_id ? depMap[b.family_member_id] ?? "Dependent" : profileName}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}
