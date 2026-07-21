import { z } from "zod";
import {
  HOW_HEARD_OPTIONS,
  GENDERS,
  RELATIONSHIPS,
  BLOOD_GROUPS,
  MIN_BOOKING_DAYS,
  MAX_BOOKING_DAYS,
} from "@shared/constants";
import { normalizePhone } from "@/lib/phone";

const asTuple = <T extends readonly string[]>(a: T) => a as unknown as [string, ...string[]];

const phone = z.string().refine((v) => normalizePhone(v) !== null, "Enter a valid 10-digit mobile number");
const optionalAge = z
  .union([z.literal(""), z.coerce.number().int().min(0, "Invalid age").max(150, "Invalid age")])
  .transform((v) => (v === "" ? null : v));

// ── Registration (REGISTER) ──────────────────────────────────────
export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  phone,
  age: optionalAge,
  how_heard: z.enum(asTuple(HOW_HEARD_OPTIONS)),
  wellness_note: z.string().trim().max(1000).optional().default(""),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Dependent (PROFILE) ──────────────────────────────────────────
export const dependentSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the dependent's name"),
  age: optionalAge,
  relationship: z.enum(asTuple(RELATIONSHIPS)),
  contact_phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v) !== null, "Enter a valid mobile number"),
  gender: z.union([z.enum(asTuple(GENDERS)), z.literal("")]).optional(),
});
export type DependentInput = z.infer<typeof dependentSchema>;

// ── Profile bio edit (PROFILE) ───────────────────────────────────
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  age: optionalAge,
  date_of_birth: z.string().optional().default(""),
  gender: z.union([z.enum(asTuple(GENDERS)), z.literal("")]).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// ── Appointment (APPOINTMENT) ────────────────────────────────────
export const appointmentSchema = z.object({
  service_id: z.string().uuid("Select a service"),
  family_member_id: z.string().optional().default(""), // "" = self
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
