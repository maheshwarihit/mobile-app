/**
 * VAgeWell Care — shared domain types.
 * Field names are snake_case to match Postgres columns 1:1 (rows come straight
 * from supabase-js). Enums mirror ./constants.ts arrays.
 */
import type {
  ROLES,
  GENDERS,
  RELATIONSHIPS,
  HOW_HEARD_OPTIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  BOOKING_STATUSES,
  BLOOD_GROUPS,
  ERROR_CODES,
} from "./constants";

export type Role = (typeof ROLES)[number];
export type Gender = (typeof GENDERS)[number];
export type Relationship = (typeof RELATIONSHIPS)[number];
export type HowHeard = (typeof HOW_HEARD_OPTIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

// ── profiles (extends auth.users; id = auth.uid()) ───────────────
export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  age: number | null;
  gender: Gender | null;
  date_of_birth: string | null; // YYYY-MM-DD
  how_heard: HowHeard | null;
  wellness_note: string | null; // "How well are you?" (R1.5)
  created_at: string; // UTC ISO 8601
  updated_at: string;
}

// ── family_members (dependents) ──────────────────────────────────
export interface FamilyMember {
  id: string;
  account_id: string; // FK -> profiles.id
  full_name: string;
  age: number | null;
  date_of_birth: string | null;
  gender: Gender | null;
  relationship: Relationship;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

// ── services (bookable care) ─────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description: string | null;
  price_per_day: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── bookings (appointments) ──────────────────────────────────────
export interface Booking {
  id: string;
  account_id: string; // FK -> profiles.id (who booked = auth.uid())
  family_member_id: string | null; // null = for the account holder
  service_id: string;
  service_name: string; // snapshot
  price_per_day: number; // snapshot
  num_days: number;
  total_amount: number; // generated: num_days * price_per_day
  start_date: string; // YYYY-MM-DD
  time_slot: string; // "HH:MM[:SS]" on a 15-min boundary
  symptom_brief: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_note: string | null; // admin rejection reason
  payment_proof_path: string | null; // storage object path (online)
  booking_status: BookingStatus;
  created_at: string;
  updated_at: string;
}

// ── clinical_records (vitals ledger; one subject per row) ────────
export interface ClinicalRecord {
  id: string;
  profile_id: string | null; // subject = account holder
  family_member_id: string | null; // subject = dependent
  recorded_by: string; // staff/admin auth.uid()
  systolic: number | null; // mmHg
  diastolic: number | null; // mmHg
  blood_glucose: number | null; // mg/dL
  spo2: number | null; // %
  blood_group: BloodGroup | null;
  medical_conditions: string | null;
  note: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

// ── Convenience view types (joins the UI builds client-side) ─────
export interface BookingWithNames extends Booking {
  account?: Pick<Profile, "full_name" | "phone">;
  subject_name?: string; // account holder or dependent name
}

// clinical record + joined subject/recorder names (admin live sheet)
export interface ClinicalRecordWithNames extends ClinicalRecord {
  subject_name?: string; // account holder or dependent the vitals belong to
  recorded_by_name?: string; // staff/admin who recorded it
}

