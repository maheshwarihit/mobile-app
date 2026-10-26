import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Camera, ImageUp, ArrowLeft, BookOpen, Trash2, ChevronRight, LogOut, Download, Sparkles } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ErrorBanner, WarningBanner, Spinner, ConfirmModal, LoadingState } from "@/components/ui";
import { PlateCropModal } from "@/components/feature/PlateCropModal";
import { AnalysisProgress } from "@/components/feature/AnalysisProgress";
import { PhotoTray } from "@/components/feature/PhotoTray";
import { LibraryCalendar, dayKey, latestDay, dayHeading } from "@/components/feature/LibraryCalendar";
import { LibraryEntry, libraryFileName } from "@/components/feature/LibraryEntry";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { pickPlate, analyzePlate, translatePlate, MAX_MEAL_PHOTOS, type PlateAnalysis, type PlatePerson, type PickedPlate, type PlateSource } from "@/lib/foodPlate";
import { loadMeals, saveMeal, deleteMeal, addMealTranslation, type SavedMeal } from "@/lib/mealLibrary";
import { useTranslatedResult, detectLanguage } from "@/lib/useTranslatedResult";
import { loadBodyMetrics } from "@/lib/bodyMetricsStorage";
import { syncNutrition, unsyncNutrition, syncOnce } from "@/lib/nutritionSync";
import { saveViewImage } from "@/lib/saveViewImage";
import { toast } from "@/lib/toast";
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
  /** From the person's profile, used when Body Metrics has no height / weight. */
  defaultHeight?: number | null;
  defaultWeight?: number | null;
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
export function FoodPlateMonitor({ personKey, defaultAge, defaultGender, onExit, onOpenBodyMetrics, defaultHeight, defaultWeight }: Props) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [stage, setStage] = useState<Stage>({ name: "start" });
  const [busy, setBusy] = useState<PlateSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Web only: the picked photo waiting in the crop screen.
  // Web only: picked photos waiting for the crop screen, one at a time.
  const [cropQueue, setCropQueue] = useState<PickedPlate[]>([]);
  const toCrop = cropQueue[0] ?? null;
  const nextCrop = () => setCropQueue((q) => q.slice(1));
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [person, setPerson] = useState<PlatePerson>({});
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // The Meal library day being shown (null: the latest day with a meal).
  const [libDay, setLibDay] = useState<string | null>(null);
  // Photos of the meal gathered so far (cropped), waiting for "Analyse meal".
  const [photos, setPhotos] = useState<{ base64: string; mediaType: PickedPlate["mediaType"]; uri: string }[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([loadMeals(userId, personKey), loadBodyMetrics(userId, personKey)]).then(([savedMeals, metrics]) => {
      if (!active) return;
      setMeals(savedMeals);
      // Shared with the care team (meals saved before syncing existed: uploaded once).
      void syncOnce(
        userId,
        personKey,
        "meal",
        savedMeals.map((m) => ({
          clientId: `meal:${m.id}`,
          data: { analysis: m.analysis, savedAt: m.savedAt, photoCount: m.photoCount ?? 1, language: m.language },
          photoUri: m.photoUri,
          createdAt: m.savedAt,
        })),
      );
      const num = (v: string | undefined) => (v && Number(v) > 0 ? Number(v) : undefined);
      setPerson({
        age: num(metrics?.age) ?? (defaultAge ?? undefined),
        gender: metrics?.gender || defaultGender || undefined,
        height_cm: num(metrics?.heightCm) ?? (defaultHeight ?? undefined),
        weight_kg: num(metrics?.weightKg) ?? (defaultWeight ?? undefined),
        activity_level: metrics?.activityLevel || undefined,
      });
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId, personKey, defaultAge, defaultGender, defaultHeight, defaultWeight]);

  const analyse = async () => {
    if (!photos.length) return;
    const photoUri = photos[0].uri;
    setError(null);
    setStage({ name: "analyzing", photoUri });
    try {
      const analysis = await analyzePlate(photos, language ?? "en", person);
      // Only real meals go in the library.
      const stored = analysis.is_food ? await saveMeal(userId, personKey, photoUri, analysis, language ?? "en", photos.length) : null;
      setPhotos([]);
      if (stored) {
        setMeals(stored);
        const m = stored[0];
        void syncNutrition(userId, personKey, "meal", `meal:${m.id}`, { analysis: m.analysis, savedAt: m.savedAt, photoCount: m.photoCount ?? 1, language: m.language }, m.photoUri, m.savedAt);
      }
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
      const picked = await pickPlate(source, MAX_MEAL_PHOTOS - photos.length);
      const ready = picked.filter((p) => p.base64);
      if (ready.length) setPhotos((prev) => [...prev, ...ready.map((p) => ({ base64: p.base64!, mediaType: p.mediaType, uri: p.uri }))]);
      const uncropped = picked.filter((p) => !p.base64);
      if (uncropped.length) setCropQueue((q) => [...q, ...uncropped]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("foodPlate.error.failed"));
    } finally {
      setBusy(null);
    }
  };

  const removeMeal = async (id: string) => {
    const next = await deleteMeal(userId, personKey, id);
    void unsyncNutrition(userId, `meal:${id}`);
    setMeals(next);
    setStage(next.length ? { name: "library" } : { name: "start" });
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  // The chosen day while it still has meals, otherwise the latest day.
  const mealDay = libDay && meals.some((m) => dayKey(m.savedAt) === libDay) ? libDay : latestDay(meals);

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
          {photos.length ? (
            <PhotoTray
              uris={photos.map((p) => p.uri)}
              hint={t("foodPlate.photosHint", { max: MAX_MEAL_PHOTOS })}
              onRemove={(i) => setPhotos((prev) => prev.filter((_, j) => j !== i))}
            />
          ) : null}
          <View className="gap-3">
            {photos.length ? (
              <PrimaryButton fullWidth icon={Sparkles} disabled={busy !== null} onPress={() => void analyse()}>
                {photos.length > 1 ? t("foodPlate.analyseMeal", { count: photos.length }) : t("foodPlate.analyseMealOne")}
              </PrimaryButton>
            ) : null}
            {photos.length < MAX_MEAL_PHOTOS ? (
              <>
                {photos.length ? (
                  <OutlineButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => start("camera")}>
                    {t("foodPlate.addPhotoCamera")}
                  </OutlineButton>
                ) : (
                  <PrimaryButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => start("camera")}>
                    {t("foodPlate.takePicture")}
                  </PrimaryButton>
                )}
                <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => start("gallery")}>
                  {photos.length ? t("foodPlate.addPhotoUpload") : t("foodPlate.uploadImage")}
                </OutlineButton>
              </>
            ) : null}
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
        <AnalysisProgress photoUri={stage.photoUri} steps={ANALYSIS_STEPS} expectedMs={20000} />
      ) : null}

      {stage.name === "result" ? (
        <>
          {stage.analysis.is_food ? (
            <SavablePlateCard
              photoUri={stage.photoUri}
              analysis={stage.analysis}
              savedAt={stage.savedAt ?? undefined}
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
          {/* The library as a calendar: tap a date to see that day's meals. */}
          {mealDay ? (
            <>
              <LibraryCalendar items={meals} selectedDay={mealDay} onSelectDay={setLibDay} />
              <Text className="text-sm font-bold text-gray-900">{dayHeading(mealDay, language)}</Text>
              {meals
                .filter((m) => dayKey(m.savedAt) === mealDay)
                .map((m) => (
                  <LibraryMealCard
                    key={m.id}
                    meal={m}
                    onDelete={() => setConfirmDelete(m.id)}
                    onTranslated={(lang, translated) => void addMealTranslation(userId, personKey, m.id, lang, translated).then(setMeals)}
                  />
                ))}
            </>
          ) : null}
          <OutlineButton fullWidth icon={ArrowLeft} onPress={() => setStage({ name: "start" })}>
            {t("common.back")}
          </OutlineButton>
        </>
      ) : null}

      {/* Keyed by photo, so each photo in the queue starts with a fresh crop. */}
      <PlateCropModal
        key={toCrop?.uri ?? "none"}
        uri={toCrop?.uri ?? null}
        onCancel={nextCrop}
        onCropped={(base64, previewUri) => {
          nextCrop();
          setPhotos((prev) => [...prev, { base64, mediaType: "image/jpeg", uri: previewUri }]);
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
 * A result card with "Download image" (and optionally "Delete") under it. The
 * download is a picture of exactly what the card shows.
 */
/**
 * A Meal library entry, shown in the app's current language: a result made in
 * the other language is translated once and the translation stored.
 */
function LibraryMealCard({
  meal,
  onDelete,
  onTranslated,
}: {
  meal: SavedMeal;
  onDelete: () => void;
  onTranslated: (language: "en" | "ta", translated: PlateAnalysis) => void;
}) {
  const { t, language } = useLanguage();
  const current = language ?? "en";
  const { shown, translating, failed } = useTranslatedResult({
    original: meal.analysis,
    originalLanguage: meal.language ?? detectLanguage(meal.analysis.dish_summary, ...meal.analysis.recommendations),
    stored: meal.translations?.[current],
    language: current,
    translate: () => translatePlate(meal.analysis, current),
    onTranslated: (translated) => onTranslated(current, translated),
  });
  const photos = meal.photoCount ?? 1;
  const dateLine = [t("foodPlate.uploadedAt", { date: formatLocalDateTime(meal.savedAt) }), photos > 1 ? t("foodPlate.photoCount", { count: photos }) : null]
    .filter(Boolean)
    .join(" · ");
  const subtitle = [
    formatLocalDateTime(meal.savedAt),
    `${Math.round(shown.calories_kcal)} kcal`,
    `${t("foodPlate.scoreTitle")} ${Math.round(shown.score)}`,
  ].join(" · ");

  return (
    <LibraryEntry
      thumbUri={meal.photoUri}
      title={shown.dish_summary}
      subtitle={subtitle}
      note={
        translating || failed ? (
          <View className="flex-row items-center gap-2">
            {translating ? <Spinner /> : null}
            <Text className="text-xs text-gray-500">{t(translating ? "common.translating" : "common.translateFailed")}</Text>
          </View>
        ) : null
      }
      fileName={libraryFileName("meal", meal.savedAt)}
      renderCard={() => <PlateCard photoUri={meal.photoUri} analysis={shown} dateLine={dateLine} />}
      onDelete={onDelete}
    />
  );
}

function SavablePlateCard({
  photoUri,
  analysis,
  savedAt,
  dateLine,
  onDelete,
}: {
  photoUri: string;
  analysis: PlateAnalysis;
  savedAt?: string;
  dateLine?: string;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  const download = async () => {
    setSaving(true);
    // Local date and time in the file name, e.g. vagewell-meal-2026-10-16-1429.png
    const d = savedAt ? new Date(savedAt) : new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
    const ok = await saveViewImage(cardRef, `vagewell-meal-${stamp}.png`);
    setSaving(false);
    if (!ok) toast.error(t("foodPlate.downloadFailed"));
  };

  return (
    <View className="gap-2">
      {/* collapsable={false}: Android must keep this wrapper as a real view to capture it. */}
      <View ref={cardRef} collapsable={false}>
        <PlateCard photoUri={photoUri} analysis={analysis} dateLine={dateLine} />
      </View>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => void download()}
          disabled={saving}
          hitSlop={8}
          accessibilityRole="button"
          className="flex-row items-center gap-1 active:opacity-70"
        >
          {saving ? <Spinner /> : <Download size={14} color={BRAND} />}
          <Text className="text-sm font-semibold text-purple-700">{t("foodPlate.download")}</Text>
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1 active:opacity-70">
            <Trash2 size={14} color={DANGER} />
            <Text className="text-sm font-semibold" style={{ color: DANGER }}>
              {t("foodPlate.deleteMeal")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The plate result in one card, laid out as: photo | Calories, Carbs, Protein, Fat;
 * Score | Micronutrients; Suggestions.
 */
export function PlateCard({ photoUri, analysis, dateLine }: { photoUri: string; analysis: PlateAnalysis; dateLine?: string }) {
  const { t } = useLanguage();
  const score = Math.max(0, Math.min(100, Math.round(analysis.score)));
  const meta = scoreMeta(score);
  const macros: { labelKey: TranslationKey; value: number; unit: string }[] = [
    { labelKey: "foodPlate.calories", value: analysis.calories_kcal, unit: "kcal" },
    { labelKey: "foodPlate.carbs", value: analysis.carbs_g, unit: "g" },
    { labelKey: "foodPlate.protein", value: analysis.protein_g, unit: "g" },
    { labelKey: "foodPlate.fat", value: analysis.fat_g, unit: "g" },
  ];
  const micros = analysis.micronutrients.slice(0, MAX_MICROS);
  const tips = analysis.recommendations.slice(0, MAX_POINTS);

  return (
    <Card className="gap-4 p-4">
      <Text className="text-sm font-bold text-gray-900">{analysis.dish_summary}</Text>

      {/* Photo | the four macros */}
      <View className="flex-row gap-3">
        <Image source={{ uri: photoUri }} resizeMode="cover" style={{ width: "40%", aspectRatio: 1, borderRadius: 12 }} />
        <View className="flex-1 flex-row flex-wrap justify-between gap-y-2">
          {macros.map((m) => (
            <View key={m.labelKey} style={{ width: "48%" }} className="justify-center rounded-xl bg-purple-50 p-2">
              <Text className="text-[11px] text-gray-500">{t(m.labelKey)}</Text>
              <Text className="text-base font-extrabold text-gray-900">
                {Math.round(m.value)}
                <Text className="text-[11px] font-semibold text-gray-500"> {m.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Score | micronutrients */}
      <View className="flex-row gap-3">
        <View style={{ width: "34%" }} className="items-center justify-center gap-1 rounded-xl bg-gray-50 p-3">
          <Text className="text-[11px] font-semibold text-gray-500">{t("foodPlate.scoreTitle")}</Text>
          <View style={{ borderColor: meta.color }} className="h-16 w-16 items-center justify-center rounded-full border-4">
            <Text className="text-xl font-extrabold text-gray-900">{score}</Text>
          </View>
          <Text className="text-center text-[11px] font-bold" style={{ color: meta.color }}>
            {t(meta.labelKey)}
          </Text>
        </View>
        <View className="flex-1 gap-2 rounded-xl border border-gray-200 p-3">
          <Text className="text-[11px] font-semibold text-gray-500">{t("foodPlate.micros")}</Text>
          {micros.map((m) => {
            const pct = Math.max(0, Math.round(m.percent_of_daily_need));
            return (
              <View key={m.name} className="gap-1">
                <View className="flex-row justify-between gap-2">
                  {/* No numberOfLines: its clipping cuts the text off in the downloaded picture. */}
                  <Text className="flex-1 text-xs font-semibold text-gray-900">{m.name}</Text>
                  <Text className="text-xs font-bold text-gray-900">{pct}%</Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <View style={{ width: `${Math.min(100, pct)}%`, backgroundColor: BRAND }} className="h-1.5 rounded-full" />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Suggestions */}
      <View className="gap-1.5">
        <Text className="text-sm font-bold text-gray-900">{t("foodPlate.suggestions")}</Text>
        {tips.map((tip) => (
          <View key={tip} className="flex-row gap-2">
            <Text className="text-sm text-gray-700">•</Text>
            <Text className="flex-1 text-sm leading-5 text-gray-700">{tip}</Text>
          </View>
        ))}
      </View>

      {dateLine ? <Text className="text-[11px] text-gray-400">{dateLine}</Text> : null}
    </Card>
  );
}

// What the analysis is doing, shown one after another while it runs.
const ANALYSIS_STEPS: TranslationKey[] = [
  "foodPlate.step.find",
  "foodPlate.step.portion",
  "foodPlate.step.nutrients",
  "foodPlate.step.score",
];
