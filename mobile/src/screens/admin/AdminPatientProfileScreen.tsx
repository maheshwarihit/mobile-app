import { View, Text, Pressable, ScrollView } from "react-native";
import { UserCircle, Users, ChevronRight } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { SectionCard, Card, SelectSheet, LoadingState, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import {
  useAllProfiles,
  useFamilyMembersByAccount,
  useSetUserRole,
  localPhone,
  ROLES,
  type Role,
} from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

export function AdminPatientProfileScreen({ navigation, route }: AdminScreenProps<"AdminPatientProfile">) {
  const { accountId, patientName } = route.params;
  const { role: myRole } = useAuth();
  const isAdmin = myRole === "admin";
  const { data: profiles } = useAllProfiles(true);
  const { data: dependents, isLoading } = useFamilyMembersByAccount(accountId);
  const setRole = useSetUserRole();

  const profile = (profiles ?? []).find((p) => p.id === accountId);

  return (
    <AdminScreen title="Family members" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-10">
        {/* Account holder */}
        <SectionCard icon={UserCircle} title={patientName} subtitle="Account holder">
          <Pressable
            onPress={() =>
              navigation.navigate("AdminMemberEdit", {
                subject: { kind: "self", profileId: accountId },
                name: patientName,
              })
            }
            className="flex-row items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 active:opacity-80"
          >
            <View>
              <Text className="text-sm font-medium text-gray-900">Edit record</Text>
              <Text className="text-xs text-gray-500">
                {localPhone(profile?.phone) || "—"} · vitals & medical
              </Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </Pressable>

          {isAdmin ? (
            <View className="mt-4">
              <SelectSheet
                label="Role"
                value={profile?.role ?? "patient"}
                options={ROLE_OPTIONS}
                onValueChange={(r) => setRole.mutate({ userId: accountId, role: r as Role })}
              />
            </View>
          ) : null}
        </SectionCard>

        {/* Dependents */}
        <SectionCard icon={Users} title="Dependents" subtitle="Tap to edit a member's record">
          {isLoading ? (
            <LoadingState message="Loading…" />
          ) : (dependents?.length ?? 0) === 0 ? (
            <EmptyState icon={Users} title="No dependents" description="This account has no dependents." />
          ) : (
            <View className="gap-2">
              {dependents?.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() =>
                    navigation.navigate("AdminMemberEdit", {
                      subject: { kind: "dependent", familyMemberId: d.id, accountId },
                      name: d.full_name,
                    })
                  }
                  className="flex-row items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 active:opacity-80"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">{d.full_name}</Text>
                    <Text className="text-xs capitalize text-gray-500">
                      {d.relationship}
                      {d.age != null ? ` · ${d.age} yrs` : ""}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
          )}
        </SectionCard>
      </ScrollView>
    </AdminScreen>
  );
}
