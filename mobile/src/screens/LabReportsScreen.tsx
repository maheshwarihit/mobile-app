import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, UserCircle, Users, Plus, FlaskConical, type LucideIcon } from "lucide-react-native";
import { useFamilyMembers } from "@vagewell/shared";
import { PageHeader, Card, LoadingState, OutlineButton } from "@/components/ui";
import { BioMarkers } from "@/components/feature/BioMarkers";
import { DependentModal } from "@/components/feature/DependentModal";
import { SubjectTab } from "@/screens/NutritionScreen";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { relationshipLabel } from "@/lib/enumI18n";
import { BRAND } from "@/theme";
import type { ServicesStackScreenProps } from "@/navigation/types";

type Subject = "self" | "dependents";
type ModuleId = "labReport";

const MODULES: { id: ModuleId; icon: LucideIcon; labelKey: TranslationKey }[] = [
  { id: "labReport", icon: FlaskConical, labelKey: "labReports.title" },
];

// SCREEN_ID: BIO_MARKERS_MODULES — what the Bio Markers service card opens
// instead of the appointment form. Like Nutrition: Self / Dependents, then the
// module list; Lab Report Insights reads a lab report with AI and keeps it in
// the Report library.
export function LabReportsScreen({ navigation }: ServicesStackScreenProps<"LabReports">) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();
  const [subject, setSubject] = useState<Subject>("self");
  const [dependentId, setDependentId] = useState<string | null>(null);
  // null = the module list; otherwise that module is open on its own.
  const [activeId, setActiveId] = useState<ModuleId | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const dependent = dependents?.find((d) => d.id === dependentId) ?? null;
  const choosingDependent = subject === "dependents" && !dependent;
  const person = subject === "self" ? profile : dependent;
  const personName = person?.full_name ?? "";
  const active = MODULES.find((m) => m.id === activeId) ?? null;

  const switchSubject = (next: Subject) => {
    setSubject(next);
    setDependentId(null);
    setActiveId(null);
  };

  // Back steps out one level: open module → module list → family list → Services.
  const back = () => {
    if (active) setActiveId(null);
    else if (subject === "dependents" && dependent) setDependentId(null);
    else navigation.goBack();
  };

  if (active) {
    return (
      <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
          <PageHeader
            title={t(active.labelKey)}
            subtitle={personName ? t("nutrition.forPerson", { name: personName }) : t("labReports.subtitle")}
            onBack={back}
          />
          <BioMarkers
            key={dependent?.id ?? "self"}
            personKey={dependent?.id ?? "self"}
            person={{ age: person?.age ?? undefined, gender: person?.gender ?? undefined }}
            onExit={() => setActiveId(null)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <PageHeader title={t("labReports.pageTitle")} subtitle={t("nutrition.subtitle")} onBack={back} />

        <View className="mb-5 flex-row rounded-full border border-gray-200 bg-white p-1">
          <SubjectTab label={t("nutrition.subject.self")} active={subject === "self"} onPress={() => switchSubject("self")} />
          <SubjectTab
            label={t("nutrition.subject.dependents")}
            active={subject === "dependents"}
            onPress={() => switchSubject("dependents")}
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
              <Pressable
                onPress={() => setAddOpen(true)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-xl border border-dashed border-purple-300 bg-white p-4 active:opacity-70"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-50">
                  <Plus size={22} color={BRAND} />
                </View>
                <Text className="flex-1 text-base font-semibold text-purple-700">{t("nutrition.addDependent")}</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            {subject === "dependents" && dependent ? (
              <View className="mb-3 flex-row items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
                <Text className="flex-1 text-sm font-semibold text-gray-900">
                  {t("nutrition.forPerson", { name: dependent.full_name })}
                </Text>
                <Pressable onPress={() => setDependentId(null)} hitSlop={8} className="active:opacity-70">
                  <Text className="text-sm font-semibold text-purple-700">{t("nutrition.changeDependent")}</Text>
                </Pressable>
              </View>
            ) : null}
            <View className="gap-3">
              {MODULES.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setActiveId(m.id)}
                  className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 active:opacity-70"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                    <m.icon size={20} color={BRAND} />
                  </View>
                  <Text className="flex-1 text-base font-semibold text-gray-900">{t(m.labelKey)}</Text>
                  <ChevronRight size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
            {/* Google Play health-app policy: AI health information must say it is not medical advice. */}
            <Text className="mt-4 text-center text-xs text-gray-400">{t("labReports.aiNote")}</Text>
          </>
        )}
      </ScrollView>
      <DependentModal open={addOpen} dependent={null} accountId={user?.id ?? ""} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}
