import type { TranslationKey } from "@/lib/i18n";
import type { Gender, Relationship } from "@vagewell/shared";

// GENDERS/RELATIONSHIPS (in @vagewell/shared) are the actual stored values —
// always the English enum code ("male", "spouse", ...) regardless of UI
// language. Only the on-screen label changes here.
export function genderLabel(t: (key: TranslationKey) => string, gender: Gender): string {
  return t(`gender.${gender}` as TranslationKey);
}

export function relationshipLabel(t: (key: TranslationKey) => string, relationship: Relationship): string {
  return t(`relationship.${relationship}` as TranslationKey);
}
