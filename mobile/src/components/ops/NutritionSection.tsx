import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Apple } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { SectionCard, Spinner } from "@/components/ui";
import { LibraryEntry, libraryFileName } from "@/components/feature/LibraryEntry";
import { PlateCard } from "@/components/feature/FoodPlateMonitor";
import { ReportResult, reportTitle } from "@/components/feature/BioMarkers";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { loadNutritionRecords, nutritionPhotoUrls, type NutritionRecord } from "@/lib/nutritionSync";
import { computeBmi, bmiCategory } from "@/lib/bmi";
import { SECTIONS, sectionScore, overallScore, bandFor, type SectionId, type SectionAnswers } from "@/lib/selfAssessmentScore";
import { PDF_THUMB_URI, type LabReport } from "@/lib/labReport";
import type { PlateAnalysis } from "@/lib/foodPlate";
import type { BodyMetrics } from "@/lib/bodyMetricsStorage";

const key = (k: string) => k as TranslationKey;

type MealData = { analysis: PlateAnalysis; savedAt: string; photoCount?: number };
type ReportData = { result: LabReport; savedAt: string; pages?: number };
type AssessmentData = { answers: Partial<Record<SectionId, SectionAnswers>>; savedAt: string };

/**
 * Staff view (admin, and Care Givers assigned to this household) of one
 * person's Nutrition modules, as the patient saved them: Body Metrics (with
 * BMI), the General Health Self-Assessment scores, the Meal library and the
 * Report library. Read-only; who may see it is enforced by the database
 * (migration 0047).
 */
export function NutritionSection({ accountId, familyMemberId }: { accountId: string; familyMemberId: string | null }) {
  const { t } = useLanguage();
  const [records, setRecords] = useState<NutritionRecord[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setRecords(null);
    setFailed(false);
    loadNutritionRecords(accountId, familyMemberId)
      .then(async (list) => {
        if (!alive) return;
        setRecords(list);
        const signed = await nutritionPhotoUrls(list.map((r) => r.photo_path).filter((p): p is string => !!p));
        if (alive) setUrls(signed);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [accountId, familyMemberId]);

  const body = records?.find((r) => r.kind === "body_metrics");
  const assessment = records?.find((r) => r.kind === "self_assessment");
  const meals = records?.filter((r) => r.kind === "meal") ?? [];
  const reports = records?.filter((r) => r.kind === "lab_report") ?? [];
  const empty = records && !body && !assessment && !meals.length && !reports.length;

  return (
    <SectionCard icon={Apple} title={t("ops.nutrition.title")} subtitle={t("ops.nutrition.subtitle")}>
      {failed ? (
        <Text className="text-sm text-gray-500">{t("ops.nutrition.loadFailed")}</Text>
      ) : !records ? (
        <Spinner />
      ) : empty ? (
        <Text className="text-sm text-gray-500">{t("ops.nutrition.empty")}</Text>
      ) : (
        <View className="gap-5">
          {body ? <BodyMetricsBlock record={body} /> : null}
          {assessment ? <AssessmentBlock record={assessment} /> : null}

          {meals.length ? (
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-900">{t("ops.nutrition.meals", { count: meals.length })}</Text>
              {meals.map((r) => {
                const d = r.data as MealData;
                const photo = r.photo_path ? (urls[r.photo_path] ?? "") : "";
                return (
                  <LibraryEntry
                    key={r.id}
                    thumbUri={photo}
                    title={d.analysis.dish_summary}
                    subtitle={`${formatLocalDateTime(d.savedAt)} · ${Math.round(d.analysis.calories_kcal)} kcal · ${t("foodPlate.scoreTitle")} ${Math.round(d.analysis.score)}`}
                    fileName={libraryFileName("meal", d.savedAt)}
                    renderCard={() => (
                      <PlateCard photoUri={photo} analysis={d.analysis} dateLine={t("foodPlate.uploadedAt", { date: formatLocalDateTime(d.savedAt) })} />
                    )}
                  />
                );
              })}
            </View>
          ) : null}

          {reports.length ? (
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-900">{t("ops.nutrition.reports", { count: reports.length })}</Text>
              {reports.map((r) => {
                const d = r.data as ReportData;
                const photo = r.photo_path ? (urls[r.photo_path] ?? "") : PDF_THUMB_URI;
                return (
                  <LibraryEntry
                    key={r.id}
                    thumbUri={photo}
                    title={reportTitle(t, d.result)}
                    subtitle={formatLocalDateTime(d.savedAt)}
                    fileName={libraryFileName("report", d.savedAt)}
                    renderCard={() => <ReportResult uri={photo} addedAt={d.savedAt} pages={d.pages} result={d.result} />}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-gray-100 py-1.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-gray-900">{value}</Text>
    </View>
  );
}

function BodyMetricsBlock({ record }: { record: NutritionRecord }) {
  const { t } = useLanguage();
  const m = record.data as BodyMetrics;
  const h = Number(m.heightCm);
  const w = Number(m.weightKg);
  const bmi = h > 0 && w > 0 ? computeBmi(h, w) : null;
  const list = (values: string[] | undefined, prefix: string) =>
    values?.length ? values.map((v) => t(key(`${prefix}.${v}`))).join(", ") : "—";
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold text-gray-900">{t("nutrition.module.bodyMetrics")}</Text>
      <Row label={t("bodyMetrics.height")} value={m.heightCm ? `${m.heightCm} cm` : "—"} />
      <Row label={t("bodyMetrics.weight")} value={m.weightKg ? `${m.weightKg} kg` : "—"} />
      <Row label="BMI" value={bmi ? `${bmi.toFixed(1)} · ${t(key(`bmi.scale.${bmiCategory(bmi)}`))}` : "—"} />
      <Row label={t("bodyMetrics.activity")} value={m.activityLevel ? t(key(`bodyMetrics.activity.${m.activityLevel}`)) : "—"} />
      <Row label={t("bodyMetrics.conditions")} value={list(m.medicalConditions, "bodyMetrics.condition")} />
      <Row label={t("bodyMetrics.history")} value={list(m.pastHistory, "bodyMetrics.history")} />
      {m.savedAt ? <Text className="text-xs text-gray-400">{t("ops.nutrition.updated", { date: formatLocalDateTime(m.savedAt) })}</Text> : null}
    </View>
  );
}

function AssessmentBlock({ record }: { record: NutritionRecord }) {
  const { t } = useLanguage();
  const d = record.data as AssessmentData;
  const overall = overallScore(d.answers);
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-gray-900">{t("nutrition.module.selfAssessment")}</Text>
      {overall !== null ? (
        <Text className="text-sm font-semibold text-gray-900">
          {t("ops.nutrition.overall", { score: overall, band: t(key(`selfAssessment.band.${bandFor(overall)}`)) })}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const score = sectionScore(s.id, d.answers[s.id]);
          return (
            <View key={s.id} className="rounded-lg bg-gray-50 px-2.5 py-1.5">
              <Text className="text-xs text-gray-600">
                {t(key(`selfAssessment.${s.id}.short`))}: <Text className="font-bold text-gray-900">{score ?? "—"}</Text>
              </Text>
            </View>
          );
        })}
      </View>
      {d.savedAt ? <Text className="text-xs text-gray-400">{t("ops.nutrition.updated", { date: formatLocalDateTime(d.savedAt) })}</Text> : null}
    </View>
  );
}
