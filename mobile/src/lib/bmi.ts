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

/** Position of the BMI marker on the scale bar, 0–100%. */
export function bmiScalePercent(bmi: number): number {
  const min = 15;
  const max = 40;
  return Math.max(0, Math.min(100, ((bmi - min) / (max - min)) * 100));
}
