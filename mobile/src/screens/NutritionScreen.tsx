import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Ruler,
  Scale,
  Utensils,
  FlaskConical,
  Pill as PillIcon,
  ClipboardCheck,
  Clock,
  ChevronRight,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useFamilyMembers } from "@vagewell/shared";
import { PageHeader, Card, LoadingState, OutlineButton } from "@/components/ui";
import { BmiCard } from "@/components/feature/BmiCard";
import { BodyMetricsForm } from "@/components/feature/BodyMetricsForm";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { relationshipLabel } from "@/lib/enumI18n";
import { BRAND } from "@/theme";
import type { ServicesStackScreenProps } from "@/navigation/types";

type ModuleId = "bodyMetrics" | "bmi" | "foodPlate" | "bioMarkers" | "foodSupplements" | "selfAssessment";
type Subject = "self" | "dependents";

// `ready: false` modules are listed but not built yet — they open a
// "coming soon" note rather than a half-working screen.
const MODULES: { id: ModuleId; icon: LucideIcon; labelKey: TranslationKey; ready: boolean }[] = [
  { id: "bodyMetrics", icon: Ruler, labelKey: "nutrition.module.bodyMetrics", ready: true },
  { id: "bmi", icon: Scale, labelKey: "nutrition.module.bmi", ready: true },
  { id: "foodPlate", icon: Utensils, labelKey: "nutrition.module.foodPlate", ready: false },
  { id: "bioMarkers", icon: FlaskConical, labelKey: "nutrition.module.bioMarkers", ready: false },
  { id: "foodSupplements", icon: PillIcon, labelKey: "nutrition.module.foodSupplements", ready: false },
  { id: "selfAssessment", icon: ClipboardCheck, labelKey: "nutrition.module.selfAssessment", ready: false },
];

// SCREEN_ID: NUTRITION_MODULES — what the Nutrition service card opens instead
// of the appointment form. A Self / Dependents toggle picks whose modules
// these are; Dependents first lists the family members to choose from.
export function NutritionScreen({ navigation }: ServicesStackScreenProps<"Nutrition">) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { data: dependents, isLoading: depsLoading } = useFamilyMembers();

  const [subject, setSubject] = useState<Subject>("self");
  const [dependentId, setDependentId] = useState<string | null>(null);
  // null = the module list; otherwise that module is open on its own.
  const [activeId, setActiveId] = useState<ModuleId | null>(null);

  const dependent = dependents?.find((d) => d.id === dependentId) ?? null;
  const personName = subject === "self" ? (profile?.full_name ?? "") : (dependent?.full_name ?? "");
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
            subtitle={personName ? t("nutrition.forPerson", { name: personName }) : undefined}
            onBack={back}
          />
          {active.id === "bmi" ? (
            <BmiCard key={personName} personName={personName || undefined} />
          ) : active.id === "bodyMetrics" ? (
            <BodyMetricsForm
              key={dependent?.id ?? "self"}
              personKey={dependent?.id ?? "self"}
              defaultAge={subject === "self" ? (profile?.age ?? null) : (dependent?.age ?? null)}
              defaultGender={subject === "self" ? (profile?.gender ?? null) : (dependent?.gender ?? null)}
            />
          ) : (
            <Card className="items-center gap-2 p-6">
              <Clock size={22} color="#9ca3af" />
              <Text className="text-base font-bold text-gray-900">{t("nutrition.comingSoon")}</Text>
              <Text className="text-center text-sm text-gray-500">{t("nutrition.comingSoonBody")}</Text>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const choosingDependent = subject === "dependents" && !dependent;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <PageHeader title={t("nutrition.title")} subtitle={t("nutrition.subtitle")} onBack={back} />

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
              <OutlineButton onPress={() => navigation.navigate("ProfileTab")}>{t("nutrition.addDependent")}</OutlineButton>
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
                  {m.ready ? null : <Text className="text-xs font-semibold text-gray-400">{t("nutrition.comingSoon")}</Text>}
                  <ChevronRight size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubjectTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-1 items-center rounded-full py-2.5 ${active ? "bg-purple-600" : "active:bg-gray-50"}`}
    >
      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-gray-600"}`}>{label}</Text>
    </Pressable>
  );
}
