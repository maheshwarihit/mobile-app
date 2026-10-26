import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { AppModal, Card, FormInput, PrimaryButton, OutlineButton, ErrorBanner, SelectSheet } from "@/components/ui";
import { useFamilyMembersByAccount } from "@vagewell/shared";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { computeBmi, bmiCategory, bmiScalePercent, type BmiCategory } from "@/lib/bmi";
import { loadBmiResults, saveBmiResults } from "@/lib/bmiStorage";
import { ACCENT_GREEN, WARN, DANGER } from "@/theme";

type Result = { name: string; bmi: number };

const ADVICE_KEYS = {
  underweight: "bmi.advice.underweight",
  normal: "bmi.advice.normal",
  overweight: "bmi.advice.overweight",
  obese: "bmi.advice.obese",
} as const;
// `upTo` is the value written under the divider at the end of each part
// (same cut-offs as bmiCategory()): 0 │ 18.4 │ 24.9 │ 29.9 │ 30+.
const SEGMENTS: { category: BmiCategory; color: string; upTo: string; labelKey: "bmi.scale.underweight" | "bmi.scale.normal" | "bmi.scale.overweight" | "bmi.scale.obese" }[] = [
  { category: "underweight", color: "#60a5fa", upTo: "18.4", labelKey: "bmi.scale.underweight" },
  { category: "normal", color: ACCENT_GREEN, upTo: "24.9", labelKey: "bmi.scale.normal" },
  { category: "overweight", color: WARN, upTo: "29.9", labelKey: "bmi.scale.overweight" },
  { category: "obese", color: DANGER, upTo: "30+", labelKey: "bmi.scale.obese" },
];

/**
 * `personName` set: the card is scoped to that one person (the Nutrition
 * screen's Self / Dependents pick) — only their result shows, the form is
 * locked to them, and there's no "check another person".
 */
export function BmiCard({
  personName,
  heightCm,
  weightKg,
}: {
  personName?: string;
  /** From the person's profile: when both are given the BMI is shown straight from them, with no separate entry. */
  heightCm?: number | null;
  weightKg?: number | null;
} = {}) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [results, setResults] = useState<Result[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);
  // null = closed; otherwise the name to preselect ("" for a fresh check).
  const [formFor, setFormFor] = useState<string | null>(null);
  const result = personName
    ? (results.find((r) => r.name === personName) ?? null)
    : (results.find((r) => r.name === activeName) ?? results[results.length - 1] ?? null);

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

  if (personName && heightCm && weightKg) {
    return (
      <Card className="mb-6 gap-3 p-5">
        <BmiResult result={{ name: personName, bmi: computeBmi(heightCm, weightKg) }} />
        <Text className="text-xs text-gray-500">{t("bmi.fromProfile", { height: heightCm, weight: weightKg })}</Text>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6 p-5">

        {result ? (
          <View className="gap-4">
            {!personName && results.length > 1 ? (
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
            <BmiResult
              result={result}
              onRecheck={() => setFormFor(result.name)}
              onNext={personName ? undefined : () => setFormFor("")}
            />
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-gray-500">{t("bmi.subtitle")}</Text>
            <PrimaryButton onPress={() => setFormFor(personName ?? "")}>{t("bmi.checkButton")}</PrimaryButton>
          </View>
        )}
      </Card>

      {formFor !== null ? (
        <BmiForm
          accountId={profile?.id ?? null}
          accountName={profile?.full_name ?? ""}
          initialName={formFor}
          locked={!!personName}
          onClose={() => setFormFor(null)}
          onCalculated={(r) => {
            setResults((prev) => [...prev.filter((p) => p.name !== r.name), r]);
            setActiveName(r.name);
            setFormFor(null);
          }}
        />
      ) : null}
    </>
  );
}

function BmiForm({
  accountId,
  accountName,
  initialName,
  locked,
  onClose,
  onCalculated,
}: {
  accountId: string | null;
  accountName: string;
  initialName: string;
  locked?: boolean;
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
  // Unset until the user picks: dependents load async, so the recheck
  // preselection is resolved by name on each render rather than once at mount.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const personId = pickedId ?? people.find((p) => p.label === initialName)?.value ?? "self";
  const [typedName, setTypedName] = useState(initialName);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const name = locked ? initialName : people.length ? (people.find((p) => p.value === personId)?.label ?? "") : typedName;

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
        {/* Locked: the person was already chosen with the Self / Dependents toggle. */}
        {locked ? null : people.length ? (
          <SelectSheet label={t("bmi.field.name")} value={personId} onValueChange={setPickedId} options={people} required />
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

function BmiResult({ result, onRecheck, onNext }: { result: Result; onRecheck?: () => void; onNext?: () => void }) {
  const { t } = useLanguage();
  const category = bmiCategory(result.bmi);
  const meta = SEGMENTS.find((s) => s.category === category)!;
  const markerLeft = bmiScalePercent(result.bmi);

  return (
    <View className="gap-4">
      <Text className="text-base font-bold text-gray-900">{t("bmi.result.score", { name: result.name })}</Text>

      <View className="flex-row items-end justify-between">
        <Text className="text-4xl font-extrabold text-gray-900">{result.bmi.toFixed(1)}</Text>
        <View style={{ backgroundColor: meta.color }} className="rounded-full px-3 py-1">
          <Text className="text-xs font-bold text-white">{t(meta.labelKey)}</Text>
        </View>
      </View>

      <View className="gap-1">
        {/* The bar: four equal parts with a white divider between each. */}
        <View className="relative h-4">
          <View className="h-4 w-full flex-row overflow-hidden rounded-md">
            {SEGMENTS.map((s, i) => (
              <View
                key={s.category}
                style={{ flex: 1, backgroundColor: s.color, borderLeftWidth: i === 0 ? 0 : 2, borderLeftColor: "#fff" }}
              />
            ))}
          </View>
          <View
            style={{ left: `${markerLeft}%`, marginLeft: -6 }}
            className="absolute -top-1 h-6 w-3 rounded-full border-2 border-white bg-gray-900"
          />
        </View>
        {/* Values under the dividers: 0 at the start, each part's end value under
            its right edge. Each cell is one part wide; its value is right-aligned
            and nudged so it sits under the divider (the last stays inside). */}
        <View className="flex-row">
          {SEGMENTS.map((s, i) => (
            <View key={s.category} className="flex-1 flex-row justify-between">
              <Text className="text-[11px] font-semibold text-gray-700">{i === 0 ? "0" : ""}</Text>
              <Text
                style={{ marginRight: i === SEGMENTS.length - 1 ? 0 : -12 }}
                className="text-[11px] font-semibold text-gray-700"
              >
                {s.upTo}
              </Text>
            </View>
          ))}
        </View>
        {/* Category name under each part; the person's own category in bold. */}
        <View className="flex-row">
          {SEGMENTS.map((s) => (
            <Text
              key={s.category}
              className={`flex-1 text-center text-[11px] ${s.category === category ? "font-bold text-gray-900" : "text-gray-500"}`}
            >
              {t(s.labelKey)}
            </Text>
          ))}
        </View>
      </View>

      <Text className="text-sm text-gray-700">{t(ADVICE_KEYS[category])}</Text>

      {onRecheck || onNext ? (
        <View className="flex-row flex-wrap gap-3">
          {onRecheck ? <OutlineButton onPress={onRecheck}>{t("bmi.result.recheck")}</OutlineButton> : null}
          {onNext ? <OutlineButton onPress={onNext}>{t("bmi.result.checkAnother")}</OutlineButton> : null}
        </View>
      ) : null}
    </View>
  );
}
