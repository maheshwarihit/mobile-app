import { View, Text } from "react-native";
import { Card, PrimaryButton, OutlineButton } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

/**
 * "Your current height is 158 cm / Your current weight is 62 kg — Please
 * update your profile if anything has changed. [Update] [Yes, correct]".
 * Height and weight live on the profile; this asks the person to confirm
 * them before they are used (BMI Check, Body Metrics).
 */
export function HeightWeightConfirm({
  heightCm,
  weightKg,
  onUpdate,
  onConfirm,
}: {
  heightCm: number | string;
  weightKg: number | string;
  onUpdate: () => void;
  onConfirm?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Card className="gap-3 p-5">
      <View className="gap-1">
        <Text className="text-base text-gray-900">{t("heightCheck.height", { value: heightCm })}</Text>
        <Text className="text-base text-gray-900">{t("heightCheck.weight", { value: weightKg })}</Text>
      </View>
      <Text className="text-sm text-gray-500">{t("heightCheck.body")}</Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <OutlineButton fullWidth onPress={onUpdate}>
            {t("heightCheck.update")}
          </OutlineButton>
        </View>
        {onConfirm ? (
          <View className="flex-1">
            <PrimaryButton fullWidth onPress={onConfirm}>
              {t("heightCheck.correct")}
            </PrimaryButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
