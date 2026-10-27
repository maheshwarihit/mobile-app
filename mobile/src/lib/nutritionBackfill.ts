import { syncOnce } from "@/lib/nutritionSync";
import { loadBodyMetrics } from "@/lib/bodyMetricsStorage";
import { loadMeals, type SavedMeal } from "@/lib/mealLibrary";
import { loadReports, type SavedReport } from "@/lib/reportLibrary";
import { loadSelfAssessment } from "@/lib/selfAssessmentStorage";
import { loadBmiHistory, syncBmiHistory } from "@/lib/bmiHistory";
import { PDF_THUMB_URI } from "@/lib/labReport";

/** The server copy of a saved meal (Meal library). */
export function mealSyncItem(m: SavedMeal) {
  return {
    clientId: `meal:${m.id}`,
    data: { analysis: m.analysis, savedAt: m.savedAt, photoCount: m.photoCount ?? 1, language: m.language },
    photoUri: m.photoUri,
    createdAt: m.savedAt,
  };
}

/** The server copy of a saved lab report (Report library). */
export function reportSyncItem(r: SavedReport) {
  return {
    clientId: `lab_report:${r.id}`,
    data: { result: r.result, savedAt: r.savedAt, pages: r.pages ?? 1, language: r.language, files: r.files ?? [] },
    photoUri: r.photoUri && r.photoUri !== PDF_THUMB_URI ? r.photoUri : null,
    createdAt: r.savedAt,
  };
}

/**
 * Everything this phone has saved in the Nutrition and Bio Markers modules,
 * for the account holder ("self") and each family member, copied to the
 * server if it is not there yet — so the admin and assigned Care Givers see
 * it without the patient having to reopen each module. Runs when the app
 * opens; only what is missing is uploaded, and failures are retried next time.
 */
export async function syncAllNutrition(userId: string | null, personKeys: string[]): Promise<void> {
  if (!userId) return;
  for (const personKey of personKeys) {
    try {
      const [body, meals, reports, assessment, bmi] = await Promise.all([
        loadBodyMetrics(userId, personKey),
        loadMeals(userId, personKey),
        loadReports(userId, personKey),
        loadSelfAssessment(userId, personKey),
        loadBmiHistory(userId, personKey),
      ]);
      if (body) await syncOnce(userId, personKey, "body_metrics", [{ clientId: `body_metrics:${personKey}`, data: body }]);
      if (assessment) await syncOnce(userId, personKey, "self_assessment", [{ clientId: `self_assessment:${personKey}`, data: assessment }]);
      await syncOnce(userId, personKey, "meal", meals.map(mealSyncItem));
      await syncOnce(userId, personKey, "lab_report", reports.map(reportSyncItem));
      await syncBmiHistory(userId, personKey, bmi);
    } catch {
      // best-effort; the next app start tries again
    }
  }
}
