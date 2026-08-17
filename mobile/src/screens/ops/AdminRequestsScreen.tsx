import { useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { PhoneIncoming, Check, Phone } from "lucide-react-native";
import {
  useBookingRequests,
  useMarkRequestContacted,
  localPhone,
  formatLocalDateTime,
  type BookingRequestWithAccount,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, LoadingState, EmptyState, SmallPrimaryButton } from "@/components/ui";
import { CardAction } from "@/screens/ops/AdminAppointmentsScreen";
import { openUrl } from "@/lib/signedUrl";

/**
 * SCREEN_ID: BOOKING_REQUESTS — the "Request for Booking" quick-contact inbox.
 * Port of web/src/app/requests/page.tsx. Admin-only, both here and in RLS
 * (booking_request_select is `account_id = auth.uid() or is_admin()`), so a
 * caregiver opening this would only ever see their own requests — which is why
 * it isn't in their tab bar.
 */
export function AdminRequestsScreen() {
  const { data: requests, isLoading, refetch } = useBookingRequests(true);
  const markContacted = useMarkRequestContacted();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const open = (requests ?? []).filter((r) => !r.contacted);
  const contacted = (requests ?? []).filter((r) => r.contacted);

  // One flat list with a divider row, so the "Contacted" section scrolls with
  // everything else rather than needing a second nested list.
  type Row = { kind: "request"; request: BookingRequestWithAccount } | { kind: "divider" };
  const rows: Row[] = [
    ...open.map((r) => ({ kind: "request" as const, request: r })),
    ...(contacted.length ? [{ kind: "divider" as const }] : []),
    ...contacted.map((r) => ({ kind: "request" as const, request: r })),
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={rows}
        keyExtractor={(row, i) => (row.kind === "divider" ? "divider" : row.request.id + i)}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Booking requests"
              subtitle="Clients who tapped “Request for Booking” — call them back, then mark contacted."
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Loading…" />
          ) : (
            <EmptyState icon={PhoneIncoming} title="No requests yet" description="New requests appear here." />
          )
        }
        renderItem={({ item }) =>
          item.kind === "divider" ? (
            <Text className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Contacted</Text>
          ) : (
            <RequestCard
              request={item.request}
              onContact={
                item.request.contacted ? undefined : () => markContacted.mutate(item.request.id)
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function RequestCard({
  request: r,
  onContact,
}: {
  request: BookingRequestWithAccount;
  onContact?: () => void;
}) {
  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">{r.account?.full_name ?? "—"}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{localPhone(r.account?.phone) || "—"}</Text>
          {r.note ? <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">{r.note}</Text> : null}
          <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formatLocalDateTime(r.created_at)}</Text>
        </View>
        {r.contacted ? (
          <Pill bgClass="bg-emerald-50 dark:bg-emerald-400/10" textClass="text-emerald-700 dark:text-emerald-400">Contacted</Pill>
        ) : (
          <Pill bgClass="bg-amber-50 dark:bg-amber-400/10" textClass="text-amber-700 dark:text-amber-400">New</Pill>
        )}
      </View>

      <View className="mt-3 flex-row items-center gap-5 border-t border-gray-100 pt-3">
        {r.account?.phone ? (
          <CardAction icon={Phone} label="Call" onPress={() => openUrl(`tel:${r.account!.phone}`)} />
        ) : null}
        {onContact ? (
          <View className="ml-auto">
            <SmallPrimaryButton icon={Check} onPress={onContact}>
              Mark contacted
            </SmallPrimaryButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
