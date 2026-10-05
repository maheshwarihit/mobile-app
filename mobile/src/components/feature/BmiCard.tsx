import { useState } from "react";
import { View, Text } from "react-native";
import { Scale } from "lucide-react-native";
import { AppModal, Card, FormInput, PrimaryButton, OutlineButton, ErrorBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { computeBmi, bmiCategory, bmiScalePercent, type BmiCategory } from "@/lib/bmi";
import { BRAND, ACCENT_GREEN, WARN, DANGER } from "@/theme";

type Result = { name: string; bmi: number };

const SCALE_BOUNDS = [15, 18.5, 25, 30, 40];
const ADVICE_KEYS = {
  underweight: "bmi.advice.underweight",
  normal: "bmi.advice.normal",
  overweight: "bmi.advice.overweight",
  obese: "bmi.advice.obese",
} as const;
const SEGMENTS: { category: BmiCategory; color: string; labelKey: "bmi.scale.underweight" | "bmi.scale.normal" | "bmi.scale.overweight" | "bmi.scale.obese" }[] = [
  { category: "underweight", color: "#60a5fa", labelKey: "bmi.scale.underweight" },
  { category: "normal", color: ACCENT_GREEN, labelKey: "bmi.scale.normal" },
  { category: "overweight", color: WARN, labelKey: "bmi.scale.overweight" },
  { category: "obese", color: DANGER, labelKey: "bmi.scale.obese" },
];

export function BmiCard() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="mb-6 p-5">
        <View className="mb-3 flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <Scale size={18} color={BRAND} />
          </View>
          <Text className="flex-1 text-lg font-bold text-gray-900">{t("bmi.title")}</Text>
        </View>

        {result ? (
          <BmiResult result={result} onRecalculate={() => setOpen(true)} />
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-gray-500">{t("bmi.subtitle")}</Text>
            <PrimaryButton onPress={() => setOpen(true)}>{t("bmi.checkButton")}</PrimaryButton>
          </View>
        )}
      </Card>

      {open ? (
        <BmiForm
          defaultName={profile?.full_name ?? ""}
          onClose={() => setOpen(false)}
          onCalculated={(r) => {
            setResult(r);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function BmiForm({
  defaultName,
  onClose,
  onCalculated,
}: {
  defaultName: string;
  onClose: () => void;
  onCalculated: (r: Result) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(defaultName);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const calculate = () => {
    const h = Number(height);
    const w = Number(weight);
    if (!name.trim()) return setErr(t("bmi.error.name"));
    if (!(h >= 50 && h <= 250)) return setErr(t("bmi.error.height"));
    if (!(w >= 2 && w <= 400)) return setErr(t("bmi.error.weight"));
    setErr(null);
    onCalculated({ name: name.trim(), bmi: computeBmi(h, w) });
  };

  return (
    <AppModal visible onClose={onClose} title={t("bmi.modal.title")}>
      <View className="gap-4">
        <FormInput label={t("bmi.field.name")} value={name} onChangeText={setName} autoCapitalize="words" required />
        <FormInput
          label={t("bmi.field.height")}
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          required
        />
        <FormInput
          label={t("bmi.field.weight")}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          required
        />
      </View>
      {err ? (
        <View className="mt-3">
          <ErrorBanner message={err} />
        </View>
      ) : null}
      <View className="mt-6 flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>{t("common.cancel")}</OutlineButton>
        <PrimaryButton onPress={calculate}>{t("bmi.calculate")}</PrimaryButton>
      </View>
    </AppModal>
  );
}

function BmiResult({ result, onRecalculate }: { result: Result; onRecalculate: () => void }) {
  const { t } = useLanguage();
  const category = bmiCategory(result.bmi);
  const meta = SEGMENTS.find((s) => s.category === category)!;
  const markerLeft = bmiScalePercent(result.bmi);
  const flexFor = (i: number) => SCALE_BOUNDS[i + 1] - SCALE_BOUNDS[i];

  return (
    <View className="gap-4">
      <Text className="text-sm font-semibold text-gray-700">{t("bmi.result.score", { name: result.name })}</Text>

      <View className="flex-row items-end justify-between">
        <Text className="text-4xl font-extrabold text-gray-900">{result.bmi.toFixed(1)}</Text>
        <View style={{ backgroundColor: meta.color }} className="rounded-full px-3 py-1">
          <Text className="text-xs font-bold text-white">{t(meta.labelKey)}</Text>
        </View>
      </View>

      <View className="gap-1.5">
        <View className="relative h-3">
          <View className="h-3 w-full flex-row overflow-hidden rounded-full">
            {SEGMENTS.map((s, i) => (
              <View key={s.category} style={{ flex: flexFor(i), backgroundColor: s.color }} />
            ))}
          </View>
          <View
            style={{ left: `${markerLeft}%`, marginLeft: -6 }}
            className="absolute -top-1 h-5 w-3 rounded-full border-2 border-white bg-gray-900"
          />
        </View>
        <View className="flex-row justify-between">
          {SEGMENTS.map((s) => (
            <Text key={s.category} className="text-[10px] text-gray-500">
              {t(s.labelKey)}
            </Text>
          ))}
        </View>
      </View>

      <Text className="text-sm text-gray-700">{t(ADVICE_KEYS[category])}</Text>
      <Text className="text-xs text-gray-400">{t("bmi.disclaimer")}</Text>

      <OutlineButton onPress={onRecalculate}>{t("bmi.result.recalculate")}</OutlineButton>
    </View>
  );
}
