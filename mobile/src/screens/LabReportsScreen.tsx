import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, UserCircle, Users, Plus } from "lucide-react-native";
import { useFamilyMembers } from "@vagewell/shared";
import { PageHeader, Card, LoadingState, OutlineButton } from "@/components/ui";
import { BioMarkers } from "@/components/feature/BioMarkers";
import { DependentModal } from "@/components/feature/DependentModal";
import { SubjectTab } from "@/screens/NutritionScreen";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { relationshipLabel } from "@/lib/enumI18n";
import { BRAND } from "@/theme";
import type { ServicesStackScreenProps } from "@/navigation/types";

type Subject = "self" | "dependents";

// SCREEN_ID: LAB_REPORTS — what the Bio Markers service card opens instead of
// the appointment form: Lab Report Insights (read a lab report with AI, keep it
// in the Report library) for yourself or a family member.
export function LabReportsScreen({ navigation }: ServicesStackScreenProps<"LabReports">) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();
  const [subject, setSubject] = useState<Subject>("self");
  const [dependentId, setDependentId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const dependent = dependents?.find((d) => d.id === dependentId) ?? null;
  const choosingDependent = subject === "dependents" && !dependent;
  const person = subject === "self" ? profile : dependent;

  const back = () => {
    if (subject === "dependents" && dependent) setDependentId(null);
    else navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <PageHeader
          title={t("labReports.title")}
          subtitle={dependent ? t("nutrition.forPerson", { name: dependent.full_name }) : t("labReports.subtitle")}
          onBack={back}
        />

        <View className="mb-5 flex-row rounded-full border border-gray-200 bg-white p-1">
          <SubjectTab
            label={t("nutrition.subject.self")}
            active={subject === "self"}
            onPress={() => {
              setSubject("self");
              setDependentId(null);
            }}
          />
          <SubjectTab
            label={t("nutrition.subject.dependents")}
            active={subject === "dependents"}
            onPress={() => {
              setSubject("dependents");
              setDependentId(null);
            }}
          />
        </View>

        {choosingDependent ? (
          depsLoading ? (
            <LoadingState message={t("common.loading")} />
          ) : (dependents ?? []).length === 0 ? (
            <Card className="items-center gap-3 p-6">
              <Users size={22} color="#9ca3af" />
              <Text className="text-center text-sm text-gray-500">{t("nutrition.noDependents")}</Text>
              <OutlineButton icon={Plus} onPress={() => setAddOpen(true)}>
                {t("nutrition.addDependent")}
              </OutlineButton>
            </Card>
          ) : (
            <View className="gap-3">
              <Text className="text-sm font-semibold text-gray-700">{t("nutrition.chooseDependent")}</Text>
              {(dependents ?? []).map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDependentId(d.id)}
                  className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 active:opacity-70"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-50">
                    <UserCircle size={22} color={BRAND} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{d.full_name}</Text>
                    <Text className="text-xs text-gray-500">{relationshipLabel(t, d.relationship)}</Text>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <BioMarkers
            key={dependent?.id ?? "self"}
            personKey={dependent?.id ?? "self"}
            person={{ age: person?.age ?? undefined, gender: person?.gender ?? undefined }}
            onExit={back}
          />
        )}
      </ScrollView>
      <DependentModal open={addOpen} dependent={null} accountId={user?.id ?? ""} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}
