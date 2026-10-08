import { ageFromDob } from "@vagewell/shared";

/**
 * Returns the form with Age set from its date of birth, when there is one.
 * The forms run this when they open and again on Save, so a stale or
 * mistyped age is corrected automatically instead of only being flagged.
 */
export function withAgeFromDob<T extends { age: string; date_of_birth: string }>(form: T): T {
  const age = form.date_of_birth ? ageFromDob(form.date_of_birth) : null;
  return age === null ? form : { ...form, age: String(age) };
}
