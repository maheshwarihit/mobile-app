// General Health Self-Assessment — the questionnaire and its scoring.
//
// Every question is answered for the past 2 weeks on a five-point scale,
// stored as 0–4 (Never = 0 … Always = 4; the screen shows these as 1–5).
// Negatively worded questions (`reverse`) count the other way round:
// item score = 4 − answer. Kept free of app imports so it can be run on its own.

export type SectionId = "physical" | "mental" | "lifestyle" | "nutrition" | "social" | "cognitive";

/** One answer per question, 0–4, or null while unanswered. */
export type SectionAnswers = (number | null)[];

export const QUESTIONS_PER_SECTION = 5;
export const MAX_ANSWER = 4;

// `weight` is the section's share of the overall wellbeing score (sums to 1).
// `reverse[i]` marks question i+1 as negatively worded.
export const SECTIONS: { id: SectionId; weight: number; reverse: boolean[] }[] = [
  { id: "physical", weight: 0.2, reverse: [false, false, true, false, false] },
  { id: "mental", weight: 0.2, reverse: [false, false, true, true, false] },
  { id: "lifestyle", weight: 0.15, reverse: [false, false, true, true, false] },
  { id: "nutrition", weight: 0.15, reverse: [false, false, true, false, false] },
  { id: "social", weight: 0.15, reverse: [false, false, true, false, false] },
  { id: "cognitive", weight: 0.15, reverse: [false, true, false, false, false] },
];

export const isComplete = (answers: SectionAnswers | undefined): answers is number[] =>
  !!answers && answers.length === QUESTIONS_PER_SECTION && answers.every((a) => a !== null);

/** Section score 0–100 = (sum of the 5 item scores ÷ 20) × 100; null until all 5 are answered. */
export function sectionScore(id: SectionId, answers: SectionAnswers | undefined): number | null {
  if (!isComplete(answers)) return null;
  const reverse = SECTIONS.find((s) => s.id === id)!.reverse;
  const sum = answers.reduce((total, a, i) => total + (reverse[i] ? MAX_ANSWER - a : a), 0);
  return Math.round((sum / (QUESTIONS_PER_SECTION * MAX_ANSWER)) * 100);
}

/** Weighted overall wellbeing score 0–100; null until every section is done. */
export function overallScore(all: Partial<Record<SectionId, SectionAnswers>>): number | null {
  let total = 0;
  for (const s of SECTIONS) {
    const score = sectionScore(s.id, all[s.id]);
    if (score === null) return null;
    total += s.weight * score;
  }
  return Math.round(total);
}

export type Band = "thriving" | "good" | "fair" | "attention";

export function bandFor(score: number): Band {
  if (score >= 80) return "thriving";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "attention";
}
