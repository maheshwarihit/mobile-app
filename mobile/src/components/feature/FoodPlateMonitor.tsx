import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated } from "react-native";
import { Camera, ImageUp, ArrowLeft, BookOpen, Trash2, ChevronRight, LogOut } from "lucide-react-native";
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

      {stage.name === "analyzing" ? <PlateCard photoUri={stage.photoUri} analysis={null} /> : null}

      {stage.name === "result" ? (
        <>
          {stage.analysis.is_food ? (
            <PlateCard
              photoUri={stage.photoUri}
              analysis={stage.analysis}
              dateLine={
                stage.savedAt
                  ? t(stage.from === "new" ? "foodPlate.savedToLibrary" : "foodPlate.uploadedAt", { date: formatLocalDateTime(stage.savedAt) })
                  : undefined
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <Image source={{ uri: stage.photoUri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 2 }} />
              <Text className="p-5 text-sm text-gray-700">{t("foodPlate.notFood")}</Text>
            </Card>
          )}

          {/* Exit goes back one step: to the start (take / upload / Meal library)
              for a new plate, or to the Meal library for a stored one. */}
          <View className="flex-row items-center justify-between">
            {stage.from === "library" && stage.mealId ? (
              <Pressable onPress={() => setConfirmDelete(stage.mealId)} hitSlop={8} className="flex-row items-center gap-1 active:opacity-70">
                <Trash2 size={14} color={DANGER} />
                <Text className="text-sm font-semibold" style={{ color: DANGER }}>
                  {t("foodPlate.deleteMeal")}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <OutlineButton
              icon={LogOut}
              onPress={() => setStage(stage.from === "library" ? { name: "library" } : { name: "start" })}
            >
              {t("foodPlate.exit")}
            </OutlineButton>
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

/**
 * The plate result in one card, laid out as: photo | Calories, Carbs, Protein, Fat;
 * Score | Micronutrients; Suggestions. With `analysis` null (still analysing)
 * the same layout shows shimmering placeholders, so the result fills in place.
 */
function PlateCard({ photoUri, analysis, dateLine }: { photoUri: string; analysis: PlateAnalysis | null; dateLine?: string }) {
  const { t } = useLanguage();
  const score = analysis ? Math.max(0, Math.min(100, Math.round(analysis.score))) : 0;
  const meta = scoreMeta(score);
  const macros: { labelKey: TranslationKey; value: number | null; unit: string }[] = [
    { labelKey: "foodPlate.calories", value: analysis?.calories_kcal ?? null, unit: "kcal" },
    { labelKey: "foodPlate.carbs", value: analysis?.carbs_g ?? null, unit: "g" },
    { labelKey: "foodPlate.protein", value: analysis?.protein_g ?? null, unit: "g" },
    { labelKey: "foodPlate.fat", value: analysis?.fat_g ?? null, unit: "g" },
  ];
  const micros = analysis ? analysis.micronutrients.slice(0, MAX_MICROS) : [];
  const tips = analysis ? analysis.recommendations.slice(0, MAX_POINTS) : [];

  return (
    <Card className="gap-4 p-4">
      {analysis ? (
        <Text className="text-sm font-bold text-gray-900">{analysis.dish_summary}</Text>
      ) : (
        <View className="flex-row items-center gap-2">
          <Spinner />
          <Text className="text-sm font-semibold text-gray-700">{t("foodPlate.analyzing")}</Text>
        </View>
      )}

      {/* Photo | the four macros */}
      <View className="flex-row gap-3">
        <Image source={{ uri: photoUri }} resizeMode="cover" style={{ width: "40%", aspectRatio: 1, borderRadius: 12 }} />
        <View className="flex-1 flex-row flex-wrap justify-between gap-y-2">
          {macros.map((m) => (
            <View key={m.labelKey} style={{ width: "48%" }} className="justify-center rounded-xl bg-purple-50 p-2">
              <Text className="text-[11px] text-gray-500">{t(m.labelKey)}</Text>
              {m.value === null ? (
                <Shimmer width="70%" height={18} />
              ) : (
                <Text className="text-base font-extrabold text-gray-900">
                  {Math.round(m.value)}
                  <Text className="text-[11px] font-semibold text-gray-500"> {m.unit}</Text>
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Score | micronutrients */}
      <View className="flex-row gap-3">
        <View style={{ width: "34%" }} className="items-center justify-center gap-1 rounded-xl bg-gray-50 p-3">
          <Text className="text-[11px] font-semibold text-gray-500">{t("foodPlate.scoreTitle")}</Text>
          {analysis ? (
            <>
              <View style={{ borderColor: meta.color }} className="h-16 w-16 items-center justify-center rounded-full border-4">
                <Text className="text-xl font-extrabold text-gray-900">{score}</Text>
              </View>
              <Text className="text-center text-[11px] font-bold" style={{ color: meta.color }}>
                {t(meta.labelKey)}
              </Text>
            </>
          ) : (
            <Shimmer width={64} height={64} radius={32} />
          )}
        </View>
        <View className="flex-1 gap-2 rounded-xl border border-gray-200 p-3">
          <Text className="text-[11px] font-semibold text-gray-500">{t("foodPlate.micros")}</Text>
          {analysis
            ? micros.map((m) => {
                const pct = Math.max(0, Math.round(m.percent_of_daily_need));
                return (
                  <View key={m.name} className="gap-1">
                    <View className="flex-row justify-between gap-2">
                      <Text className="flex-1 text-xs font-semibold text-gray-900" numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text className="text-xs font-bold text-gray-900">{pct}%</Text>
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <View style={{ width: `${Math.min(100, pct)}%`, backgroundColor: BRAND }} className="h-1.5 rounded-full" />
                    </View>
                  </View>
                );
              })
            : [0, 1, 2, 3].map((i) => <Shimmer key={i} width="100%" height={12} />)}
        </View>
      </View>

      {/* Suggestions */}
      <View className="gap-1.5">
        <Text className="text-sm font-bold text-gray-900">{t("foodPlate.suggestions")}</Text>
        {analysis
          ? tips.map((s) => (
              <View key={s} className="flex-row gap-2">
                <Text className="text-sm text-gray-700">•</Text>
                <Text className="flex-1 text-sm leading-5 text-gray-700">{s}</Text>
              </View>
            ))
          : [0, 1, 2].map((i) => <Shimmer key={i} width={i === 2 ? "60%" : "100%"} height={12} />)}
      </View>

      {analysis ? (
        <View className="gap-0.5">
          {dateLine ? <Text className="text-[11px] text-gray-400">{dateLine}</Text> : null}
          <Text className="text-[11px] text-gray-400">{t("foodPlate.disclaimer")}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** A grey placeholder bar that gently pulses while the result is on its way. */
function Shimmer({ width, height, radius = 6 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: "#e5e7eb", opacity, marginTop: 4 }} />;
}
