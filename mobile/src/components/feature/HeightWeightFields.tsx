import { View } from "react-native";
import { FormInput } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

/** Height (cm) and Weight (kg), side by side — required on every profile form (they feed BMI and the Nutrition modules). */
export function HeightWeightFields({
  height,
  weight,
  onHeight,
  onWeight,
  heightError,
  weightError,
}: {
  height: string;
  weight: string;
  onHeight: (v: string) => void;
  onWeight: (v: string) => void;
  heightError?: string;
  weightError?: string;
}) {
  const { t } = useLanguage();
  // Digits and one decimal point only.
  const clean = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <FormInput
          label={t("common.heightCm")}
          value={height}
          onChangeText={(v) => onHeight(clean(v))}
          keyboardType="decimal-pad"
          placeholder="158"
          error={heightError}
          required
        />
      </View>
      <View className="flex-1">
        <FormInput
          label={t("common.weightKg")}
          value={weight}
          onChangeText={(v) => onWeight(clean(v))}
          keyboardType="decimal-pad"
          placeholder="64"
          error={weightError}
          required
        />
      </View>
    </View>
  );
}
