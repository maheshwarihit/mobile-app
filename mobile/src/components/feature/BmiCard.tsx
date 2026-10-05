import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Scale } from "lucide-react-native";
import { AppModal, Card, FormInput, PrimaryButton, OutlineButton, ErrorBanner, SelectSheet } from "@/components/ui";
import { useFamilyMembersByAccount } from "@vagewell/shared";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { computeBmi, bmiCategory, bmiScalePercent, type BmiCategory } from "@/lib/bmi";
import { loadBmiResults, saveBmiResults } from "@/lib/bmiStorage";
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
  const userId = profile?.id ?? null;
  const [results, setResults] = useState<Result[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const result = results.find((r) => r.name === activeName) ?? results[results.length - 1] ?? null;

  useEffect(() => {
    let active = true;
    setLoaded(false);
    void loadBmiResults(userId).then((saved) => {
      if (!active) return;
      setResults(saved);
      setActiveName(null);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (loaded) void saveBmiResults(userId, results);
  }, [results, loaded, userId]);

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
          <View className="gap-4">
            {results.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                {results.map((r) => (
                  <Pressable
                    key={r.name}
                    onPress={() => setActiveName(r.name)}
                    className={`rounded-full border px-3 py-1 ${
                      r.name === result.name ? "border-purple-600 bg-purple-600" : "border-gray-300 bg-white"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${r.name === result.name ? "text-white" : "text-gray-600"}`}>
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <BmiResult result={result} onNext={() => setOpen(true)} />
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-gray-500">{t("bmi.subtitle")}</Text>
            <PrimaryButton onPress={() => setOpen(true)}>{t("bmi.checkButton")}</PrimaryButton>
          </View>
        )}
      </Card>

      {open ? (
        <BmiForm
          accountId={profile?.id ?? null}
          accountName={profile?.full_name ?? ""}
          onClose={() => setOpen(false)}
          onCalculated={(r) => {
            setResults((prev) => [...prev.filter((p) => p.name !== r.name), r]);
            setActiveName(r.name);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function BmiForm({
  accountId,
  accountName,
  onClose,
  onCalculated,
}: {
  accountId: string | null;
  accountName: string;
  onClose: () => void;
  onCalculated: (r: Result) => void;
}) {
  const { t } = useLanguage();
  const { data: dependents } = useFamilyMembersByAccount(accountId);
  const people = accountId
    ? [
        { value: "self", label: accountName },
        ...(dependents ?? []).map((d) => ({ value: d.id, label: d.full_name })),
      ]
    : [];
  const [personId, setPersonId] = useState("self");
  const [typedName, setTypedName] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const name = people.length ? (people.find((p) => p.value === personId)?.label ?? "") : typedName;

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
        {people.length ? (
          <SelectSheet label={t("bmi.field.name")} value={personId} onValueChange={setPersonId} options={people} required />
        ) : (
          <FormInput label={t("bmi.field.name")} value={typedName} onChangeText={setTypedName} autoCapitalize="words" required />
        )}
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

function BmiResult({ result, onNext }: { result: Result; onNext: () => void }) {
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

      <OutlineButton onPress={onNext}>{t("bmi.result.checkAnother")}</OutlineButton>
    </View>
  );
}
