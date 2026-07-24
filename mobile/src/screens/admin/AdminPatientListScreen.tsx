import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Users, ChevronRight } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { FormInput, Card, Pill, LoadingState, EmptyState } from "@/components/ui";
import { useAllProfiles, useAllFamilyMembers, formatDate, localPhone } from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

/**
 * One searchable list holding both account holders and their dependents —
 * a family member is a patient in their own right, so staff can find them by
 * name without knowing which account they sit under.
 */
type PatientRow =
  | { kind: "account"; key: string; name: string; phone: string | null; detail: string; accountId: string }
  | {
      kind: "dependent";
      key: string;
      name: string;
      phone: string | null;
      detail: string;
      accountId: string;
      familyMemberId: string;
    };

export function AdminPatientListScreen({ navigation }: AdminScreenProps<"AdminPatientList">) {
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles(true);
  const { data: dependents, isLoading: depsLoading } = useAllFamilyMembers(true);
  const [query, setQuery] = useState("");
  const isLoading = profilesLoading || depsLoading;

  const rows = useMemo<PatientRow[]>(() => {
    const all = profiles ?? [];
    // Dependents belong to whoever owns the account — including staff/admin accounts.
    const nameById = new Map(all.map((p) => [p.id, p.full_name ?? "—"]));

    const accounts: PatientRow[] = all
      .filter((p) => p.role === "patient")
      .map((p) => ({
        kind: "account",
        key: `p:${p.id}`,
        name: p.full_name ?? "—",
        phone: p.phone,
        detail: `${localPhone(p.phone) || "—"} · Joined ${formatDate(p.created_at)}`,
        accountId: p.id,
      }));

    const members: PatientRow[] = (dependents ?? []).map((d) => ({
      kind: "dependent",
      key: `f:${d.id}`,
      name: d.full_name,
      phone: d.contact_phone,
      detail: `${d.relationship[0].toUpperCase()}${d.relationship.slice(1)} of ${nameById.get(d.account_id) ?? "—"} · ${localPhone(d.contact_phone) || "no number"}`,
      accountId: d.account_id,
      familyMemberId: d.id,
    }));

    const q = query.trim().toLowerCase();
    return [...accounts, ...members]
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.phone ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, dependents, query]);

  const open = (r: PatientRow) =>
    r.kind === "account"
      ? navigation.navigate("AdminPatientProfile", { accountId: r.accountId, patientName: r.name })
      : navigation.navigate("AdminMemberEdit", {
          subject: { kind: "dependent", familyMemberId: r.familyMemberId, accountId: r.accountId },
          name: r.name,
        });

  return (
    <AdminScreen title="Patients" onBack={() => navigation.goBack()}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerClassName="px-5 pt-4 pb-8 gap-3"
        ListHeaderComponent={
          <View className="mb-1">
            <FormInput label="Search patient" value={query} onChangeText={setQuery} placeholder="Name or phone…" />
            {isLoading ? <LoadingState message="Loading patients…" /> : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon={Users} title="No patients" description="Registered patients and family members appear here." />
          ) : null
        }
        renderItem={({ item: r }) => (
          <Pressable onPress={() => open(r)} className="active:opacity-80">
            <Card className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">{r.name}</Text>
                  {r.kind === "dependent" ? (
                    <Pill bgClass="bg-purple-50" textClass="text-purple-700">
                      Family member
                    </Pill>
                  ) : null}
                </View>
                <Text className="text-xs text-gray-500">{r.detail}</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Card>
          </Pressable>
        )}
      />
    </AdminScreen>
  );
}
