export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export const BMI_SCALE: { category: BmiCategory; max: number }[] = [
  { category: "underweight", max: 18.5 },
  { category: "normal", max: 25 },
  { category: "overweight", max: 30 },
  { category: "obese", max: 40 },
];

export function computeBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

/**
 * Position of the BMI marker on the scale bar, 0–100%. The bar is drawn as
 * four equal parts (one per category), so the marker moves evenly within the
 * part the BMI falls in: 0–18.5 fills the first quarter, 18.5–25 the second,
 * 25–30 the third, 30–40 the last (anything above 40 sits at the end).
 */
export function bmiScalePercent(bmi: number): number {
  let from = 0;
  for (let i = 0; i < BMI_SCALE.length; i++) {
    const to = BMI_SCALE[i].max;
    if (bmi < to || i === BMI_SCALE.length - 1) {
      const within = Math.max(0, Math.min(1, (bmi - from) / (to - from)));
      return ((i + within) / BMI_SCALE.length) * 100;
    }
    from = to;
  }
  return 100;
}
