import { useState } from "react";
import { View, Text, Image } from "react-native";
import { Camera, ImageUp, Sparkles, LogOut, RotateCcw } from "lucide-react-native";
import { Card, PrimaryButton, OutlineButton, ErrorBanner, Spinner } from "@/components/ui";
import { PlateCropModal } from "@/components/feature/PlateCropModal";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { pickPlate, analyzePlate, type PlateAnalysis, type PickedPlate, type PlateSource } from "@/lib/foodPlate";
import { BRAND, ACCENT_GREEN, WARN, DANGER } from "@/theme";

type Stage =
  | { name: "start" }
  | { name: "analyzing"; photoUri: string }
  | { name: "result"; photoUri: string; analysis: PlateAnalysis };

const LEVEL_KEYS = {
  low: "foodPlate.level.low",
  moderate: "foodPlate.level.moderate",
  high: "foodPlate.level.high",
} as const;

function scoreMeta(score: number): { color: string; labelKey: TranslationKey } {
  if (score >= 80) return { color: ACCENT_GREEN, labelKey: "foodPlate.score.excellent" };
  if (score >= 60) return { color: ACCENT_GREEN, labelKey: "foodPlate.score.good" };
  if (score >= 40) return { color: WARN, labelKey: "foodPlate.score.fair" };
  return { color: DANGER, labelKey: "foodPlate.score.poor" };
}

/**
 * Nutrition → AI Food Plate Monitor.
 *
 * 1. Take a picture (camera) or Upload image (gallery).
 * 2. Crop to the plate — the system crop screen on a phone, the app's own
 *    crop screen on the web.
 * 3. The cropped photo goes to the analyze-food-plate server function, which
 *    asks the AI for a score, calories, carbs, protein, fat, fibre,
 *    micronutrients and suggestions.
 * 4. Results screen, with "Check another plate" and "Exit".
 *
 * Nothing is saved: the photo and its analysis live on this screen only.
 */
export function FoodPlateMonitor({ onExit }: { onExit: () => void }) {
  const { t, language } = useLanguage();
  const [stage, setStage] = useState<Stage>({ name: "start" });
  const [busy, setBusy] = useState<PlateSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Web only: the picked photo waiting in the crop screen.
  const [toCrop, setToCrop] = useState<PickedPlate | null>(null);

  const analyse = async (base64: string, mediaType: PickedPlate["mediaType"], photoUri: string) => {
    setStage({ name: "analyzing", photoUri });
    try {
      const analysis = await analyzePlate(base64, mediaType, language ?? "en");
      setStage({ name: "result", photoUri, analysis });
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

  const exitButton = (
    <OutlineButton fullWidth icon={LogOut} onPress={onExit}>
      {t("foodPlate.exit")}
    </OutlineButton>
  );

  return (
    <View className="gap-4">
      {stage.name === "start" ? (
        <Card className="gap-3 p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <Sparkles size={18} color={BRAND} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900">{t("foodPlate.addTitle")}</Text>
              <Text className="text-sm text-gray-500">{t("foodPlate.addHint")}</Text>
            </View>
          </View>
          <View className="gap-3">
            <PrimaryButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => start("camera")}>
              {t("foodPlate.takePicture")}
            </PrimaryButton>
            <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => start("gallery")}>
              {t("foodPlate.uploadImage")}
            </OutlineButton>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          {exitButton}
        </Card>
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
            <PrimaryButton fullWidth icon={RotateCcw} onPress={() => setStage({ name: "start" })}>
              {t("foodPlate.another")}
            </PrimaryButton>
            {exitButton}
          </View>
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
    </View>
  );
}

function Results({ analysis }: { analysis: PlateAnalysis }) {
  const { t } = useLanguage();
  const score = Math.max(0, Math.min(100, Math.round(analysis.score)));
  const meta = scoreMeta(score);
  const macros: { labelKey: TranslationKey; value: number; unit: string }[] = [
    { labelKey: "foodPlate.calories", value: analysis.calories_kcal, unit: "kcal" },
    { labelKey: "foodPlate.carbs", value: analysis.carbs_g, unit: "g" },
    { labelKey: "foodPlate.protein", value: analysis.protein_g, unit: "g" },
    { labelKey: "foodPlate.fat", value: analysis.fat_g, unit: "g" },
    { labelKey: "foodPlate.fibre", value: analysis.fibre_g, unit: "g" },
  ];

  return (
    <>
      <Card className="gap-3 p-5">
        <Text className="text-sm font-bold text-gray-900">{t("foodPlate.scoreTitle")}</Text>
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
            <View key={m.labelKey} className="min-w-[92px] flex-1 rounded-xl bg-purple-50 p-3">
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
        <Card className="gap-2 p-5">
          <Text className="text-sm font-bold text-gray-900">{t("foodPlate.microsTitle")}</Text>
          {analysis.micronutrients.map((m) => (
            <View key={m.name} className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-sm text-gray-700">{m.name}</Text>
              <Text className="text-sm font-semibold text-gray-900">{m.amount}</Text>
              <View
                style={{ backgroundColor: m.level === "high" ? ACCENT_GREEN : m.level === "moderate" ? WARN : "#9ca3af" }}
                className="w-20 items-center rounded-full px-2 py-0.5"
              >
                <Text className="text-[11px] font-bold text-white">{t(LEVEL_KEYS[m.level])}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {analysis.suggestions.length ? (
        <Card className="gap-2 p-5">
          <Text className="text-sm font-bold text-gray-900">{t("foodPlate.suggestionsTitle")}</Text>
          {analysis.suggestions.map((s) => (
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
