import { useEffect, useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Camera, ImageUp, ArrowLeft, RotateCcw, BookOpen, Trash2, ChevronRight, LogOut } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ErrorBanner, WarningBanner, Spinner, ConfirmModal, LoadingState } from "@/components/ui";
import { PlateCropModal } from "@/components/feature/PlateCropModal";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { pickPlate, analyzePlate, type PlateAnalysis, type PlatePerson, type PickedPlate, type PlateSource } from "@/lib/foodPlate";
import { loadMeals, saveMeal, deleteMeal, type SavedMeal } from "@/lib/mealLibrary";
import { loadBodyMetrics } from "@/lib/bodyMetricsStorage";
import { BRAND, ACCENT_GREEN, WARN, DANGER } from "@/theme";

// Keep the result short: only the most important few of each list (meals saved
// before the AI was told to return fewer still show this many).
const MAX_MICROS = 4;
const MAX_POINTS = 3;

type Stage =
  | { name: "start" }
  | { name: "analyzing"; photoUri: string }
  // `savedAt` null: analysed just now but could not be stored (or wasn't food).
  | { name: "result"; photoUri: string; analysis: PlateAnalysis; savedAt: string | null; mealId: string | null; from: "new" | "library" }
  | { name: "library" };

function scoreMeta(score: number): { color: string; labelKey: TranslationKey } {
  if (score >= 80) return { color: ACCENT_GREEN, labelKey: "foodPlate.score.excellent" };
  if (score >= 60) return { color: ACCENT_GREEN, labelKey: "foodPlate.score.good" };
  if (score >= 40) return { color: WARN, labelKey: "foodPlate.score.fair" };
  return { color: DANGER, labelKey: "foodPlate.score.poor" };
}

type Props = {
  /** "self" or a dependent's id — the Meal library is kept per person. */
  personKey: string;
  /** Known from the profile / dependent record; Body Metrics overrides them when saved. */
  defaultAge: number | null;
  defaultGender: string | null;
  /** "Back": leave the module for the Nutrition list. */
  onExit: () => void;
  /** Jump to Body Metrics to add height and weight. */
  onOpenBodyMetrics: () => void;
};

/**
 * Nutrition → AI Food Plate Monitor.
 *
 * Start: Take picture, Upload image, Meal library (only once a plate has been
 * analysed and stored), Back.
 * A photo is cropped to the plate (the system crop screen on a phone, the
 * app's own on the web) and sent with the person's age, gender, height and
 * weight to the analyze-food-plate server function, which asks the AI for a
 * Food Compass based meal score, calories, protein, carbs, fats, the
 * micronutrients against that person's daily needs, and what is missing.
 * Each analysed plate is stored in the Meal library with its date and time.
 */
export function FoodPlateMonitor({ personKey, defaultAge, defaultGender, onExit, onOpenBodyMetrics }: Props) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [stage, setStage] = useState<Stage>({ name: "start" });
  const [busy, setBusy] = useState<PlateSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Web only: the picked photo waiting in the crop screen.
  const [toCrop, setToCrop] = useState<PickedPlate | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [person, setPerson] = useState<PlatePerson>({});
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadMeals(userId, personKey), loadBodyMetrics(userId, personKey)]).then(([savedMeals, metrics]) => {
      if (!active) return;
      setMeals(savedMeals);
      const num = (v: string | undefined) => (v && Number(v) > 0 ? Number(v) : undefined);
      setPerson({
        age: num(metrics?.age) ?? (defaultAge ?? undefined),
        gender: metrics?.gender || defaultGender || undefined,
        height_cm: num(metrics?.heightCm),
        weight_kg: num(metrics?.weightKg),
        activity_level: metrics?.activityLevel || undefined,
      });
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId, personKey, defaultAge, defaultGender]);

  const analyse = async (base64: string, mediaType: PickedPlate["mediaType"], photoUri: string) => {
    setStage({ name: "analyzing", photoUri });
    try {
      const analysis = await analyzePlate(base64, mediaType, language ?? "en", person);
      // Only real meals go in the library.
      const stored = analysis.is_food ? await saveMeal(userId, personKey, photoUri, analysis) : null;
      if (stored) setMeals(stored);
      const meal = stored?.[0] ?? null;
      setStage({
        name: "result",
        photoUri: meal?.photoUri ?? photoUri,
        analysis,
        savedAt: meal?.savedAt ?? null,
        mealId: meal?.id ?? null,
        from: "new",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("foodPlate.error.failed"));
      setStage({ name: "start" });
    }
  };

  const start = async (source: PlateSource) => {
    setError(null);
    setBusy(source);
    try {
      const picked = await pickPlate(source);
      if (!picked) return;
      if (picked.base64) await analyse(picked.base64, picked.mediaType, picked.uri);
      else setToCrop(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("foodPlate.error.failed"));
    } finally {
      setBusy(null);
    }
  };

  const removeMeal = async (id: string) => {
    const next = await deleteMeal(userId, personKey, id);
    setMeals(next);
    setStage(next.length ? { name: "library" } : { name: "start" });
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  const missingBodyDetails = !person.height_cm || !person.weight_kg;

  return (
    <View className="gap-4">
      {stage.name === "start" ? (
        <Card className="gap-3 p-5">
          {missingBodyDetails ? (
            <View className="gap-2">
              <WarningBanner message={t("foodPlate.needBodyMetrics")} />
              <Pressable onPress={onOpenBodyMetrics} hitSlop={6} className="flex-row items-center gap-0.5 self-start active:opacity-70">
                <Text className="text-sm font-semibold text-purple-700">{t("foodPlate.openBodyMetrics")}</Text>
                <ChevronRight size={14} color={BRAND} />
              </Pressable>
            </View>
          ) : null}
          <View className="gap-3">
            <PrimaryButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => start("camera")}>
              {t("foodPlate.takePicture")}
            </PrimaryButton>
            <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => start("gallery")}>
              {t("foodPlate.uploadImage")}
            </OutlineButton>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
        </Card>
      ) : null}

      {/* Same layout as Bio Markers: the Meal library (only once this person
          has an analysed plate stored) or an empty note, then Exit. */}
      {stage.name === "start" ? (
        <>
          {meals.length > 0 ? (
            <OutlineButton fullWidth icon={BookOpen} disabled={busy !== null} onPress={() => setStage({ name: "library" })}>
              {t("foodPlate.mealLibraryCount", { count: meals.length })}
            </OutlineButton>
          ) : (
            <Text className="text-center text-sm text-gray-400">{t("foodPlate.empty")}</Text>
          )}
          <OutlineButton fullWidth icon={LogOut} disabled={busy !== null} onPress={onExit}>
            {t("foodPlate.exit")}
          </OutlineButton>
        </>
      ) : null}

      {stage.name === "analyzing" ? (
        <Card className="overflow-hidden">
          <Image source={{ uri: stage.photoUri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1 }} />
          <View className="flex-row items-center justify-center gap-3 p-5">
            <Spinner />
            <Text className="text-sm font-semibold text-gray-700">{t("foodPlate.analyzing")}</Text>
          </View>
        </Card>
      ) : null}

      {stage.name === "result" ? (
        <>
          <Card className="overflow-hidden">
            <Image source={{ uri: stage.photoUri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1 }} />
            <View className="gap-1 p-4">
              <Text className="text-base font-bold text-gray-900">{stage.analysis.dish_summary}</Text>
              {stage.analysis.items.length ? (
                <Text className="text-sm text-gray-500">{stage.analysis.items.join(" · ")}</Text>
              ) : null}
              {stage.savedAt ? (
                <Text className="mt-1 text-xs text-gray-400">
                  {t(stage.from === "new" ? "foodPlate.savedToLibrary" : "foodPlate.uploadedAt", { date: formatLocalDateTime(stage.savedAt) })}
                </Text>
              ) : null}
            </View>
          </Card>

          {stage.analysis.is_food ? (
            <Results analysis={stage.analysis} />
          ) : (
            <Card className="p-5">
              <Text className="text-sm text-gray-700">{t("foodPlate.notFood")}</Text>
            </Card>
          )}

          <View className="gap-3">
            {stage.from === "new" ? (
              <>
                <PrimaryButton fullWidth icon={RotateCcw} onPress={() => setStage({ name: "start" })}>
                  {t("foodPlate.another")}
                </PrimaryButton>
                {meals.length > 0 ? (
                  <OutlineButton fullWidth icon={BookOpen} onPress={() => setStage({ name: "library" })}>
                    {t("foodPlate.mealLibrary")}
                  </OutlineButton>
                ) : null}
                <OutlineButton fullWidth icon={ArrowLeft} onPress={onExit}>
                  {t("common.back")}
                </OutlineButton>
              </>
            ) : (
              <>
                <PrimaryButton fullWidth icon={ArrowLeft} onPress={() => setStage({ name: "library" })}>
                  {t("foodPlate.backToLibrary")}
                </PrimaryButton>
                {stage.mealId ? (
                  <OutlineButton fullWidth icon={Trash2} onPress={() => setConfirmDelete(stage.mealId)}>
                    {t("foodPlate.deleteMeal")}
                  </OutlineButton>
                ) : null}
              </>
            )}
          </View>
        </>
      ) : null}

      {stage.name === "library" ? (
        <>
          <View>
            <Text className="text-base font-bold text-gray-900">{t("foodPlate.mealLibrary")}</Text>
            <Text className="text-sm text-gray-500">{t("foodPlate.mealLibraryHint")}</Text>
          </View>
          {meals.map((m) => {
            const score = Math.max(0, Math.min(100, Math.round(m.analysis.score)));
            const meta = scoreMeta(score);
            return (
              <Pressable
                key={m.id}
                onPress={() =>
                  setStage({ name: "result", photoUri: m.photoUri, analysis: m.analysis, savedAt: m.savedAt, mealId: m.id, from: "library" })
                }
                className="active:opacity-70"
              >
                <Card className="flex-row items-center gap-3 p-3">
                  <Image source={{ uri: m.photoUri }} resizeMode="cover" style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#e5e7eb" }} />
                  <View className="flex-1 gap-0.5">
                    <Text numberOfLines={2} className="text-sm font-semibold text-gray-900">
                      {m.analysis.dish_summary}
                    </Text>
                    <Text className="text-xs text-gray-500">{formatLocalDateTime(m.savedAt)}</Text>
                    <Text className="text-xs text-gray-500">
                      {Math.round(m.analysis.calories_kcal)} kcal
                    </Text>
                  </View>
                  <View style={{ backgroundColor: meta.color }} className="h-11 w-11 items-center justify-center rounded-full">
                    <Text className="text-sm font-extrabold text-white">{score}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          <OutlineButton fullWidth icon={ArrowLeft} onPress={() => setStage({ name: "start" })}>
            {t("common.back")}
          </OutlineButton>
        </>
      ) : null}

      <PlateCropModal
        uri={toCrop?.uri ?? null}
        onCancel={() => setToCrop(null)}
        onCropped={(base64, previewUri) => {
          setToCrop(null);
          void analyse(base64, "image/jpeg", previewUri);
        }}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title={t("foodPlate.deleteTitle")}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const id = confirmDelete;
          setConfirmDelete(null);
          if (id) void removeMeal(id);
        }}
        confirmLabel={t("common.remove")}
        cancelLabel={t("common.keep")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">{t("foodPlate.deleteBody")}</Text>
      </ConfirmModal>
    </View>
  );
}

function Results({ analysis }: { analysis: PlateAnalysis }) {
  const { t } = useLanguage();
  const score = Math.max(0, Math.min(100, Math.round(analysis.score)));
  const meta = scoreMeta(score);
  const macros: { labelKey: TranslationKey; value: number; unit: string }[] = [
    { labelKey: "foodPlate.calories", value: analysis.calories_kcal, unit: "kcal" },
    { labelKey: "foodPlate.protein", value: analysis.protein_g, unit: "g" },
    { labelKey: "foodPlate.carbs", value: analysis.carbs_g, unit: "g" },
    { labelKey: "foodPlate.fat", value: analysis.fat_g, unit: "g" },
  ];

  return (
    <>
      <Card className="gap-3 p-5">
        <View>
          <Text className="text-sm font-bold text-gray-900">{t("foodPlate.scoreTitle")}</Text>
          <Text className="text-xs text-gray-400">{t("foodPlate.scoreMethod")}</Text>
        </View>
        <View className="flex-row items-end justify-between">
          <View className="flex-row items-end gap-1">
            <Text className="text-4xl font-extrabold text-gray-900">{score}</Text>
            <Text className="mb-1 text-base font-semibold text-gray-400">/ 100</Text>
          </View>
          <View style={{ backgroundColor: meta.color }} className="rounded-full px-3 py-1">
            <Text className="text-xs font-bold text-white">{t(meta.labelKey)}</Text>
          </View>
        </View>
        <View className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <View style={{ width: `${score}%`, backgroundColor: meta.color }} className="h-2.5 rounded-full" />
        </View>
      </Card>

      <Card className="gap-3 p-5">
        <Text className="text-sm font-bold text-gray-900">{t("foodPlate.macrosTitle")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {macros.map((m) => (
            <View key={m.labelKey} className="min-w-[120px] flex-1 rounded-xl bg-purple-50 p-3">
              <Text className="text-xs text-gray-500">{t(m.labelKey)}</Text>
              <Text className="mt-0.5 text-lg font-extrabold text-gray-900">
                {Math.round(m.value)}
                <Text className="text-xs font-semibold text-gray-500"> {m.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {analysis.micronutrients.length ? (
        <Card className="gap-3 p-5">
          <View>
            <Text className="text-sm font-bold text-gray-900">{t("foodPlate.microsTitle")}</Text>
            <Text className="text-xs text-gray-400">{t("foodPlate.microsHint")}</Text>
          </View>
          {analysis.micronutrients.slice(0, MAX_MICROS).map((m) => {
            const pct = Math.max(0, Math.round(m.percent_of_daily_need));
            return (
              <View key={m.name} className="gap-1">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="flex-1 text-sm font-semibold text-gray-900">{m.name}</Text>
                  <Text className="text-xs text-gray-500">
                    {t("foodPlate.ofDailyNeed", { amount: m.amount, need: m.daily_need })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <View style={{ width: `${Math.min(100, pct)}%`, backgroundColor: BRAND }} className="h-2 rounded-full" />
                  </View>
                  <Text className="w-11 text-right text-xs font-bold text-gray-900">{pct}%</Text>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {analysis.missing.length ? (
        <Card className="gap-2 p-5">
          <Text className="text-sm font-bold text-gray-900">{t("foodPlate.missingTitle")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {analysis.missing.slice(0, MAX_POINTS).map((m) => (
              <View key={m} className="rounded-full border border-gray-300 bg-white px-3 py-1">
                <Text className="text-xs font-semibold text-gray-700">{m}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {analysis.recommendations.length ? (
        <Card className="gap-2 p-5">
          <Text className="text-sm font-bold text-gray-900">{t("foodPlate.recommendationsTitle")}</Text>
          {analysis.recommendations.slice(0, MAX_POINTS).map((s) => (
            <Text key={s} className="text-sm leading-5 text-gray-700">
              • {s}
            </Text>
          ))}
        </Card>
      ) : null}

      <Text className="text-center text-xs text-gray-400">{t("foodPlate.disclaimer")}</Text>
    </>
  );
}
