import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Minus, Pencil } from "lucide-react-native";
import { GENDERS, formatLocalDateTime } from "@vagewell/shared";
import {
  Card,
  FormInput,
  AgeField,
  ChoiceChips,
  SelectSheet,
  PrimaryButton,
  OutlineButton,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { genderLabel } from "@/lib/enumI18n";
import {
  loadBodyMetrics,
  saveBodyMetrics,
  type BodyMetrics,
} from "@/lib/bodyMetricsStorage";
import { syncNutrition, unsyncNutrition, syncOnce } from "@/lib/nutritionSync";
import { HeightWeightConfirm } from "@/components/feature/HeightWeightConfirm";
import { BmiTrendChart } from "@/components/feature/BmiTrendChart";
import { loadBmiHistory, recordBmiPoint, type BmiPoint } from "@/lib/bmiHistory";
import { toast } from "@/lib/toast";
import { BRAND } from "@/theme";

// Stored values are these fixed codes; labels come from translations, so a
// saved record reads correctly in either language.
const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "very",
  "extra",
] as const;
const CONDITIONS = [
  "diabetes",
  "hypertension",
  "cardiovascular",
  "cancer",
  "kidneyLiver",
  "psychiatric",
  "autoimmune",
  "allergic",
  "hereditary",
] as const;
const HISTORY = [
  "illnesses",
  "infections",
  "hospitalizations",
  "operations",
  "trauma",
  "allergies",
  "previousMeds",
  "longTermMeds",
] as const;

type Props = {
  /** "self" or a dependent's id — saved answers are kept per person. */
  personKey: string;
  defaultAge: number | null;
  defaultGender: string | null;
  /** From the person's profile. */
  defaultHeight?: number | null;
  defaultWeight?: number | null;
  /** Open straight on the form instead of the summary (e.g. sent here from another module to fill it in). */
  startEditing?: boolean;
  /** Called after a successful Save. */
  onSaved?: () => void;
  /** Opens the height / weight editor (Profile, or the family member form). */
  onUpdateHeightWeight?: () => void;
};

/** Nutrition → Body Metrics: one person's measurements, activity level and medical background. */
export function BodyMetricsForm({
  personKey,
  defaultAge,
  defaultGender,
  startEditing = false,
  onSaved,
  defaultHeight,
  defaultWeight,
  onUpdateHeightWeight,
}: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [loaded, setLoaded] = useState(false);
  const [age, setAge] = useState(defaultAge != null ? String(defaultAge) : "");
  const [gender, setGender] = useState(defaultGender ?? "");
  // Height and weight belong to the profile: when it has them they are used
  // as-is (shown read-only here, changed in Profile), even over values this
  // form saved before they moved to the profile.
  const profileHeight = defaultHeight ? String(defaultHeight) : null;
  const profileWeight = defaultWeight ? String(defaultWeight) : null;
  const fromProfile = !!profileHeight && !!profileWeight;
  // The BMI history shown under the height / weight card (same as BMI Check); reloads after a profile update.
  const [bmiHistory, setBmiHistory] = useState<BmiPoint[]>([]);
  useEffect(() => {
    if (!profileHeight || !profileWeight) return;
    let alive = true;
    void loadBmiHistory(userId, personKey)
      .then(() => recordBmiPoint(userId, personKey, Number(profileHeight), Number(profileWeight)))
      .then((h) => alive && setBmiHistory(h));
    return () => {
      alive = false;
    };
  }, [userId, personKey, profileHeight, profileWeight]);
  const [heightCm, setHeightCm] = useState(
    defaultHeight ? String(defaultHeight) : "",
  );
  const [weightKg, setWeightKg] = useState(
    defaultWeight ? String(defaultWeight) : "",
  );
  const [activityLevel, setActivityLevel] = useState("");
  const [conditions, setConditions] = useState<string[]>([""]);
  const [history, setHistory] = useState<string[]>([""]);
  // Last saved answers. The module always opens as a read-only summary with
  // an Edit button — for someone with nothing saved yet the summary shows
  // what is known from their profile (age, gender) and a dash for the rest.
  // Editing works on a copy until Save.
  const [saved, setSaved] = useState<BodyMetrics | null>(null);
  const [editing, setEditing] = useState(startEditing);
  const blank: BodyMetrics = {
    age: defaultAge != null ? String(defaultAge) : "",
    gender: defaultGender ?? "",
    heightCm: defaultHeight ? String(defaultHeight) : "",
    weightKg: defaultWeight ? String(defaultWeight) : "",
    activityLevel: "",
    medicalConditions: [],
    pastHistory: [],
    savedAt: "",
  };
  const shown = {
    ...(saved ?? blank),
    ...(profileHeight ? { heightCm: profileHeight } : {}),
    ...(profileWeight ? { weightKg: profileWeight } : {}),
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void loadBodyMetrics(userId, personKey).then((saved) => {
      if (!active) return;
      if (saved) {
        fillFrom(saved);
        setSaved(saved);
        // Shared with the care team (saved before syncing existed: uploaded once).
        void syncOnce(userId, personKey, "body_metrics", [
          { clientId: `body_metrics:${personKey}`, data: saved },
        ]);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId, personKey]);

  useEffect(() => {
    if (profileHeight) setHeightCm(profileHeight);
    if (profileWeight) setWeightKg(profileWeight);
  }, [profileHeight, profileWeight]);

  function fillFrom(m: BodyMetrics) {
    setAge(m.age);
    setGender(m.gender);
    setHeightCm(profileHeight ?? m.heightCm);
    setWeightKg(profileWeight ?? m.weightKg);
    setActivityLevel(m.activityLevel);
    setConditions(m.medicalConditions.length ? m.medicalConditions : [""]);
    setHistory(m.pastHistory.length ? m.pastHistory : [""]);
  }

  const cancelEdit = () => {
    fillFrom(saved ?? blank);
    setErrors({});
    setEditing(false);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    const h = Number(profileHeight ?? heightCm);
    const w = Number(profileWeight ?? weightKg);
    if (!age) errs.age = t("bodyMetrics.error.age");
    if (!gender) errs.gender = t("bodyMetrics.error.gender");
    if (!(h >= 50 && h <= 250)) errs.height = t("bodyMetrics.error.height");
    if (!(w >= 2 && w <= 400)) errs.weight = t("bodyMetrics.error.weight");
    if (!activityLevel) errs.activity = t("bodyMetrics.error.activity");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const next: BodyMetrics = {
      age,
      gender,
      heightCm: profileHeight ?? heightCm,
      weightKg: profileWeight ?? weightKg,
      activityLevel,
      // Rows left on "Select…" are just unused slots, not answers.
      medicalConditions: conditions.filter(Boolean),
      pastHistory: history.filter(Boolean),
      savedAt: new Date().toISOString(),
    };
    const ok = await saveBodyMetrics(userId, personKey, next);
    setSaving(false);
    if (ok) {
      setSaved(next);
      setEditing(false);
      // The current values, plus a dated copy so the care team can see changes over time.
      void syncNutrition(
        userId,
        personKey,
        "body_metrics",
        `body_metrics:${personKey}`,
        next,
      );
      void syncNutrition(
        userId,
        personKey,
        "body_metrics",
        `body_metrics:${personKey}:${next.savedAt}`,
        next,
        null,
        next.savedAt,
      );
      toast.success(t("bodyMetrics.saved"));
      onSaved?.();
    } else {
      toast.error(t("bodyMetrics.saveFailed"));
    }
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  if (!editing) {
    const conditionLabels = shown.medicalConditions.map((c) =>
      t(`bodyMetrics.condition.${c}` as TranslationKey),
    );
    const historyLabels = shown.pastHistory.map((h) =>
      t(`bodyMetrics.history.${h}` as TranslationKey),
    );
    return (
      <Card className="gap-3 p-5">
        <SummaryRow label={t("bodyMetrics.age")} value={shown.age} />
        <SummaryRow
          label={t("bodyMetrics.gender")}
          value={
            shown.gender
              ? genderLabel(t, shown.gender as (typeof GENDERS)[number])
              : "—"
          }
        />
        <SummaryRow label={t("bodyMetrics.height")} value={shown.heightCm} />
        <SummaryRow label={t("bodyMetrics.weight")} value={shown.weightKg} />
        <SummaryRow
          label={t("bodyMetrics.activity")}
          value={
            shown.activityLevel
              ? t(
                  `bodyMetrics.activity.${shown.activityLevel}` as TranslationKey,
                )
              : "—"
          }
        />
        <SummaryList
          label={t("bodyMetrics.conditions")}
          items={conditionLabels}
        />
        <SummaryList label={t("bodyMetrics.history")} items={historyLabels} />
        <View className="mt-2">
          <PrimaryButton
            fullWidth
            icon={Pencil}
            onPress={() => setEditing(true)}
          >
            {t("bodyMetrics.edit")}
          </PrimaryButton>
        </View>
        <Text className="text-center text-xs text-gray-400">
          {saved
            ? t("bodyMetrics.lastSaved", {
                date: formatLocalDateTime(saved.savedAt),
              })
            : t("bodyMetrics.notSaved")}
        </Text>
      </Card>
    );
  }

  return (
    <Card className="gap-4 p-5">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <AgeField
            label={t("bodyMetrics.age")}
            value={age}
            onChange={setAge}
            error={errors.age}
            required
          />
        </View>
      </View>
      <ChoiceChips
        label={t("bodyMetrics.gender")}
        value={gender}
        onChange={setGender}
        options={GENDERS.map((g) => ({ value: g, label: genderLabel(t, g) }))}
        error={errors.gender}
        required
      />
      {fromProfile ? (
        // Height and weight come from the profile: confirm them, or update them there.
        <View className="gap-4">
          <HeightWeightConfirm
            heightCm={profileHeight ?? ""}
            weightKg={profileWeight ?? ""}
            onUpdate={() => onUpdateHeightWeight?.()}
          />
          <BmiTrendChart points={bmiHistory} />
        </View>
      ) : (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormInput
              label={t("bodyMetrics.height")}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="decimal-pad"
              error={errors.height}
              required
            />
          </View>
          <View className="flex-1">
            <FormInput
              label={t("bodyMetrics.weight")}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              error={errors.weight}
              required
            />
          </View>
        </View>
      )}
      <ChoiceChips
        label={t("bodyMetrics.activity")}
        value={activityLevel}
        onChange={setActivityLevel}
        options={ACTIVITY_LEVELS.map((a) => ({
          value: a,
          label: t(`bodyMetrics.activity.${a}` as TranslationKey),
        }))}
        error={errors.activity}
        required
      />
      <MultiSelectRows
        label={t("bodyMetrics.conditions")}
        rows={conditions}
        onChange={setConditions}
        options={CONDITIONS.map((c) => ({
          value: c,
          label: t(`bodyMetrics.condition.${c}` as TranslationKey),
        }))}
      />
      <MultiSelectRows
        label={t("bodyMetrics.history")}
        rows={history}
        onChange={setHistory}
        options={HISTORY.map((h) => ({
          value: h,
          label: t(`bodyMetrics.history.${h}` as TranslationKey),
        }))}
      />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <OutlineButton fullWidth onPress={cancelEdit}>
            {t("common.cancel")}
          </OutlineButton>
        </View>
        <View className="flex-1">
          <PrimaryButton fullWidth loading={saving} onPress={save}>
            {t("bodyMetrics.save")}
          </PrimaryButton>
        </View>
      </View>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900">
        {value || "—"}
      </Text>
    </View>
  );
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-gray-500">{label}</Text>
      {items.length ? (
        items.map((item) => (
          <Text key={item} className="text-sm font-medium text-gray-900">
            • {item}
          </Text>
        ))
      ) : (
        <Text className="text-sm font-medium text-gray-900">—</Text>
      )}
    </View>
  );
}

/**
 * A list of dropdown rows: "−" removes a row, "+" adds another. Each dropdown
 * only offers options not already picked in another row, and "+" disappears
 * once every option has a row.
 */
function MultiSelectRows({
  label,
  rows,
  onChange,
  options,
}: {
  label: string;
  rows: string[];
  onChange: (rows: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useLanguage();
  const setRow = (i: number, v: string) =>
    onChange(rows.map((r, j) => (j === i ? v : r)));
  const removeRow = (i: number) =>
    onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""]);
  const canAdd = rows.length < options.length;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      {rows.map((row, i) => (
        <View key={i} className="flex-row items-center gap-2">
          <View className="flex-1">
            <SelectSheet
              value={row}
              onValueChange={(v) => setRow(i, v)}
              options={options.filter(
                (o) => o.value === row || !rows.includes(o.value),
              )}
              placeholder={t("bodyMetrics.select")}
            />
          </View>
          <Pressable
            onPress={() => removeRow(i)}
            hitSlop={6}
            accessibilityLabel={t("bodyMetrics.removeRow")}
            className="h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white active:bg-gray-50"
          >
            <Minus size={16} color="#dc2626" />
          </Pressable>
        </View>
      ))}
      {canAdd ? (
        <Pressable
          onPress={() => onChange([...rows, ""])}
          hitSlop={6}
          className="flex-row items-center gap-1.5 self-start py-1 active:opacity-70"
        >
          <Plus size={16} color={BRAND} />
          <Text className="text-sm font-semibold text-purple-700">
            {t("bodyMetrics.addRow")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
