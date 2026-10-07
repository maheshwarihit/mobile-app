import { z } from "zod";
import {
  GENDERS,
  RELATIONSHIPS,
  BLOOD_GROUPS,
  REPORT_TYPES,
  MIN_BOOKING_DAYS,
  MAX_BOOKING_DAYS,
} from "./constants";
import { normalizePhone } from "./phone";
import { ageFromDob } from "./dates";

const asTuple = <T extends readonly string[]>(a: T) => a as unknown as [string, ...string[]];

const phone = z.string().refine((v) => normalizePhone(v) !== null, "Enter a valid 10-digit mobile number");
const optionalAge = z
  .union([z.literal(""), z.coerce.number().int().min(0, "Invalid age").max(150, "Invalid age")])
  .transform((v) => (v === "" ? null : v));
// Age is compulsory everywhere it's collected (profile, dependents).
const requiredAge = optionalAge.refine((v) => v !== null, "Select the age");
// Gender and date of birth are compulsory alongside age.
const requiredGender = z.enum(asTuple(GENDERS), { errorMap: () => ({ message: "Select a gender" }) });
const requiredDob = z.string().min(1, "Select the date of birth");

// Catches a mistyped age: it must equal the age the date of birth gives today.
// Reported on the Age field so the person sees what it should be.
function ageMatchesDob(v: { age: number | null; date_of_birth: string }, ctx: z.RefinementCtx) {
  if (v.age === null || !v.date_of_birth) return;
  const expected = ageFromDob(v.date_of_birth);
  if (expected !== null && expected !== v.age) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["age"],
      message: `Age doesn't match the date of birth — it should be ${expected}`,
    });
  }
}

// ── Registration (quick sign-up: name + phone only, OTP does the rest) ────
// Everything else (age/gender/address/how_heard/wellness_note) is filled in
// later via the Profile screen's edit form, not collected up front.
export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  phone,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Dependent (PROFILE) ──────────────────────────────────────────
export const dependentSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the dependent's name"),
  age: requiredAge,
  date_of_birth: requiredDob,
  relationship: z.enum(asTuple(RELATIONSHIPS)),
  contact_phone: z
    .string()
    .trim()
    .min(1, "Enter a contact number")
    .refine((v) => normalizePhone(v) !== null, "Enter a valid mobile number"),
  gender: requiredGender,
}).superRefine(ageMatchesDob);
export type DependentInput = z.infer<typeof dependentSchema>;

// ── Profile bio edit (PROFILE) ───────────────────────────────────
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  // Age, date of birth and gender are compulsory on the profile.
  age: requiredAge,
  date_of_birth: requiredDob,
  gender: requiredGender,
  address: z.string().trim().max(500).optional().default(""),
}).superRefine(ageMatchesDob);
export type ProfileInput = z.infer<typeof profileSchema>;

// ── Appointment (APPOINTMENT) ────────────────────────────────────
export const appointmentSchema = z.object({
  service_id: z.string().uuid("Select a service"),
  family_member_id: z.string().optional().default(""), // "" = self
  service_mode: z.literal("home_care"), // Clinic Visit retired — Home Care is the only bookable mode
  start_date: z.string().min(1, "Pick a start date"),
  num_days: z.coerce.number().int().min(MIN_BOOKING_DAYS, "At least 1 day").max(MAX_BOOKING_DAYS),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time slot"),
  symptom_brief: z.string().trim().max(2000).optional().default(""),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

// ── Clinical vitals (PROFILE, staff/admin) ───────────────────────
export const clinicalSchema = z.object({
  systolic: z.union([z.literal(""), z.coerce.number().int().min(40).max(300)]).transform((v) => (v === "" ? null : v)),
  diastolic: z.union([z.literal(""), z.coerce.number().int().min(20).max(200)]).transform((v) => (v === "" ? null : v)),
  blood_glucose: z.union([z.literal(""), z.coerce.number().min(0).max(2000)]).transform((v) => (v === "" ? null : v)),
  spo2: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]).transform((v) => (v === "" ? null : v)),
  blood_group: z.union([z.enum(asTuple(BLOOD_GROUPS)), z.literal("")]).optional(),
  medical_conditions: z.string().trim().max(2000).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});
export type ClinicalInput = z.infer<typeof clinicalSchema>;

// ── Report upload (staff/leaf_node, MY VISITS) ────────────────────
export const reportUploadSchema = z.object({
  report_type: z.enum(asTuple(REPORT_TYPES)),
  note: z.string().trim().max(1000).optional().default(""),
});
export type ReportUploadInput = z.infer<typeof reportUploadSchema>;
