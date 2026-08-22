import type { TranslationKey } from "@/lib/i18n";

// Client-side lookup for the 4-service catalog (SEED_SERVICES in
// @vagewell/shared) — `services.name`/`.description` come from the DB, but
// this catalog is fixed seed content (see supabase/seed.sql, install_all.sql),
// so matching on the exact English string is safe. Anything that doesn't
// match (a future 5th service, an admin edit via Studio) falls back to the
// original text unchanged rather than showing a missing-translation gap.
const NAME_KEYS: Record<string, TranslationKey> = {
  Nutrition: "services.catalog.nutrition.name",
  "Physio Therapy": "services.catalog.physio.name",
  "Para-Medical": "services.catalog.paraMedical.name",
  "Mental Wellbeing": "services.catalog.mentalWellbeing.name",
};

// Multi-line: a one-line summary followed by "• " feature bullets (migration
// 0030) — must match SEED_SERVICES/the DB text byte-for-byte to be found.
const DESCRIPTION_KEYS: Record<string, TranslationKey> = {
  [
    "Diet adherence (supported by strategic meal provider partnerships).\n" +
      "• Individualized diet planning & support\n" +
      "• Ryles tube feeding guidance\n" +
      "• Dietitian consultation"
  ]: "services.catalog.nutrition.description",
  [
    "Exercise completion, mobility scores.\n" +
      "• Mobility training\n" +
      "• Post-surgery physio care\n" +
      "• Therapeutic exercise"
  ]: "services.catalog.physio.description",
  [
    "Vitals Monitoring and medication compliance.\n" +
      "• Vitals Monitoring (BP, Sugar, O2)\n" +
      "• Elderly & geriatric care\n" +
      "• Bedridden patient care\n" +
      "• Wound & dressing care\n" +
      "• Post-hospitalization care\n" +
      "• 24/7 home nursing care"
  ]: "services.catalog.paraMedical.description",
  [
    "Mood scores and social engagement tracking.\n" +
      "• Elderly wellbeing support\n" +
      "• Psychological support\n" +
      "• Spiritual care\n" +
      "• Rehabilitation / relaxation care"
  ]: "services.catalog.mentalWellbeing.description",
};

export function translateServiceName(t: (key: TranslationKey) => string, name: string): string {
  const key = NAME_KEYS[name];
  return key ? t(key) : name;
}

export function translateServiceDescription(
  t: (key: TranslationKey) => string,
  description: string | null | undefined
): string {
  if (!description) return description ?? "";
  const key = DESCRIPTION_KEYS[description];
  return key ? t(key) : description;
}
