import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, ChevronRight } from "lucide-react-native";
import {
  useAllProfiles,
  useAllFamilyMembers,
  formatDate,
  localPhone,
  profileCompletionPercent,
  type Profile,
  type FamilyMember,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, FormInput, LoadingState, EmptyState, ProfileCompletionRing } from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import type { ClientsStackScreenProps } from "@/navigation/types";

/**
 * SCREEN_ID: OPS_CLIENTS — every client account and dependent, searchable.
 * Port of web/src/app/patients/page.tsx. Open to both ops roles: fam_select and
 * profiles_select both grant any is_staff() caller full visibility, and a
 * caregiver looking up who they're about to visit is part of the job.
 *
 * Photo only applies to account holders — a `family_members` row has no
 * `avatar_path` of its own unless it's linked to its own profile, which would
 * need a second lookup. Completion % applies to both: `family_members` carries
 * its own `age`/`date_of_birth`/`gender` directly on the row, same shape
 * `profileCompletionPercent()` already expects.
 */
type ClientRow =
  | { kind: "account"; key: string; name: string; phone: string | null; detail: string; accountId: string; profile: Profile }
  | {
      kind: "dependent";
      key: string;
      name: string;
      phone: string | null;
      detail: string;
      accountId: string;
      dependent: FamilyMember;
    };

export function OpsClientsScreen({ navigation }: ClientsStackScreenProps<"ClientsList">) {
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles(true);
  const { data: dependents, isLoading: depsLoading } = useAllFamilyMembers(true);
  const [query, setQuery] = useState("");
  const isLoading = profilesLoading || depsLoading;

  const rows = useMemo<ClientRow[]>(() => {
    const all = profiles ?? [];
    const nameById = new Map(all.map((p) => [p.id, p.full_name ?? "—"]));

    const accounts: ClientRow[] = all
      .filter((p) => p.role === "patient")
      .map((p) => ({
        kind: "account",
        key: `p:${p.id}`,
        name: p.full_name ?? "—",
        phone: p.phone,
        detail: `${localPhone(p.phone) || "—"} · Joined ${formatDate(p.created_at)}`,
        accountId: p.id,
        profile: p,
      }));

    const members: ClientRow[] = (dependents ?? []).map((d) => ({
      kind: "dependent",
      key: `f:${d.id}`,
      name: d.full_name,
      phone: d.contact_phone,
      detail: `${d.relationship[0].toUpperCase()}${d.relationship.slice(1)} of ${
        nameById.get(d.account_id) ?? "—"
      } · ${localPhone(d.contact_phone) || "no number"}`,
      accountId: d.account_id,
      dependent: d,
    }));

    const q = query.trim().toLowerCase();
    return [...accounts, ...members]
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.phone ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, dependents, query]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={["top"]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader title="Clients" subtitle="Account holders and their family members." />
            <View className="mb-4">
              <FormInput
                label="Search client"
                value={query}
                onChangeText={setQuery}
                placeholder="Name or phone…"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Loading clients…" />
          ) : (
            <EmptyState
              icon={Users}
              title="No clients"
              description="Registered clients and family members appear here."
            />
          )
        }
        renderItem={({ item }) => (
          // Both kinds open the same household page, but a dependent passes
          // its own id (memberId) so the page opens focused on *that* person
          // instead of always defaulting to the account holder.
          <Pressable
            onPress={() =>
              navigation.navigate("ClientDetail", {
                accountId: item.accountId,
                memberId: item.kind === "dependent" ? item.dependent.id : undefined,
              })
            }
            className="active:opacity-80"
          >
            <Card className="flex-row items-center gap-3 p-4">
              {item.kind === "account" ? <ProfilePhoto profile={item.profile} size={40} /> : null}
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">{item.name}</Text>
                  {item.kind === "dependent" ? (
                    <Pill bgClass="bg-purple-50 dark:bg-purple-400/10" textClass="text-purple-700 dark:text-purple-300">Family member</Pill>
                  ) : null}
                </View>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{item.detail}</Text>
              </View>
              <ProfileCompletionRing
                percent={profileCompletionPercent(item.kind === "account" ? item.profile : item.dependent)}
                size={36}
              />
              <ChevronRight size={18} color="#9ca3af" />
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
