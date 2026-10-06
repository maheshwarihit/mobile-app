import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ruler, Scale, Utensils, FlaskConical, Pill as PillIcon, Clock, ChevronRight, type LucideIcon } from "lucide-react-native";
import { PageHeader, Card } from "@/components/ui";
import { BmiCard } from "@/components/feature/BmiCard";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { BRAND } from "@/theme";
import type { ServicesStackScreenProps } from "@/navigation/types";

type ModuleId = "bodyMetrics" | "bmi" | "foodPlate" | "bioMarkers" | "foodSupplements";

// `ready: false` modules are listed but not built yet — they open a
// "coming soon" note rather than a half-working screen.
const MODULES: { id: ModuleId; icon: LucideIcon; labelKey: TranslationKey; ready: boolean }[] = [
  { id: "bodyMetrics", icon: Ruler, labelKey: "nutrition.module.bodyMetrics", ready: false },
  { id: "bmi", icon: Scale, labelKey: "nutrition.module.bmi", ready: true },
  { id: "foodPlate", icon: Utensils, labelKey: "nutrition.module.foodPlate", ready: false },
  { id: "bioMarkers", icon: FlaskConical, labelKey: "nutrition.module.bioMarkers", ready: false },
  { id: "foodSupplements", icon: PillIcon, labelKey: "nutrition.module.foodSupplements", ready: false },
];

// SCREEN_ID: NUTRITION_MODULES — what the Nutrition service card opens instead
// of the appointment form.
export function NutritionScreen({ navigation }: ServicesStackScreenProps<"Nutrition">) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState<ModuleId>("bmi");
  const active = MODULES.find((m) => m.id === activeId)!;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <PageHeader title={t("nutrition.title")} subtitle={t("nutrition.subtitle")} onBack={() => navigation.goBack()} />

        <View className="mb-6 gap-3">
          {MODULES.map((m) => {
            const selected = m.id === activeId;
            return (
              <Pressable
                key={m.id}
                onPress={() => setActiveId(m.id)}
                className={`flex-row items-center gap-3 rounded-xl border bg-white p-4 active:opacity-70 ${
                  selected ? "border-purple-600" : "border-gray-200"
                }`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <m.icon size={20} color={BRAND} />
                </View>
                <Text className="flex-1 text-base font-semibold text-gray-900">{t(m.labelKey)}</Text>
                {m.ready ? (
                  <ChevronRight size={18} color="#9ca3af" />
                ) : (
                  <Text className="text-xs font-semibold text-gray-400">{t("nutrition.comingSoon")}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {active.id === "bmi" ? (
          <BmiCard />
        ) : (
          <Card className="items-center gap-2 p-6">
            <Clock size={22} color="#9ca3af" />
            <Text className="text-base font-bold text-gray-900">{t(active.labelKey)}</Text>
            <Text className="text-center text-sm text-gray-500">{t("nutrition.comingSoonBody")}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
