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
 * Completion %/photo only apply to account holders — a `family_members` row has
 * no avatar_path/age/gender/dob of its own unless it's linked to its own
 * profile, which would need a second lookup.
 */
type ClientRow =
  | { kind: "account"; key: string; name: string; phone: string | null; detail: string; accountId: string; profile: Profile }
  | { kind: "dependent"; key: string; name: string; phone: string | null; detail: string; accountId: string };

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
          // Both kinds open the same household page — a dependent has no page
          // of its own here; its record lives under the account that owns it.
          <Pressable
            onPress={() => navigation.navigate("ClientDetail", { accountId: item.accountId })}
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
              {item.kind === "account" ? (
                <ProfileCompletionRing percent={profileCompletionPercent(item.profile)} size={36} />
              ) : null}
              <ChevronRight size={18} color="#9ca3af" />
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
