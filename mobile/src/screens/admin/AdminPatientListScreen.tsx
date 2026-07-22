import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Users, ChevronRight } from "lucide-react-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { FormInput, Card, LoadingState, EmptyState } from "@/components/ui";
import { useAllProfiles, formatDate, localPhone } from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

export function AdminPatientListScreen({ navigation }: AdminScreenProps<"AdminPatientList">) {
  const { data: profiles, isLoading } = useAllProfiles(true);
  const [query, setQuery] = useState("");

  const patients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (profiles ?? [])
      .filter((p) => p.role === "patient")
      .filter(
        (p) => !q || (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q)
      );
  }, [profiles, query]);

  return (
    <AdminScreen title="Patients" onBack={() => navigation.goBack()}>
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        contentContainerClassName="px-5 pt-4 pb-8 gap-3"
        ListHeaderComponent={
          <View className="mb-1">
            <FormInput label="Search patient" value={query} onChangeText={setQuery} placeholder="Name or phone…" />
            {isLoading ? <LoadingState message="Loading patients…" /> : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon={Users} title="No patients" description="Registered patients appear here." />
          ) : null
        }
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() =>
              navigation.navigate("AdminPatientProfile", { accountId: p.id, patientName: p.full_name ?? "Patient" })
            }
            className="active:opacity-80"
          >
            <Card className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{p.full_name ?? "—"}</Text>
                <Text className="text-xs text-gray-500">
                  {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
                </Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Card>
          </Pressable>
        )}
      />
    </AdminScreen>
  );
}
