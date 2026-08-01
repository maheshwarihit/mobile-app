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
  SERVICE_MODES,
  PRICING_MODELS,
  REPORT_TYPES,
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
export type ServiceMode = (typeof SERVICE_MODES)[number];
export type PricingModel = (typeof PRICING_MODELS)[number];
export type ReportType = (typeof REPORT_TYPES)[number];
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
  address: string | null;
  how_heard: HowHeard | null;
  wellness_note: string | null; // "How well are you?" (R1.5)
  // Set once this account's phone auto-links to a family_members row on
  // another account (household linking) — points at that account's id.
  primary_account_id: string | null;
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
  // Set once this dependent's contact_phone registers its own account.
  linked_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── services (bookable care) ─────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description: string | null;
  price_per_day: number; // per-day rate, OR the flat amount when pricing_model = 'flat_advance'
  pricing_model: PricingModel;
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
  pricing_model: PricingModel | null; // snapshot
  num_days: number;
  total_amount: number; // server-computed at insert (flat, or num_days × price_per_day)
  start_date: string; // YYYY-MM-DD
  time_slot: string; // "HH:MM[:SS]" on a 15-min boundary
  symptom_brief: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_note: string | null; // admin rejection reason
  payment_proof_path: string | null; // storage object path (online)
  service_mode: ServiceMode | null; // set on admin approval
  assigned_to: string | null; // FK -> profiles.id (staff or leaf_node), set on assignment
  booking_status: BookingStatus;
  created_at: string;
  updated_at: string;
}

// ── report_uploads (staff/leaf_node uploads; admin-gated before customer sees them) ──
export interface ReportUpload {
  id: string;
  booking_id: string;
  uploaded_by: string; // FK -> profiles.id
  report_type: ReportType;
  storage_path: string;
  note: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // Snapshotted at upload time (migration 0014) — not resolved via a join,
  // since report_select RLS grants every report to any staff/leaf_node/admin
  // caller regardless of who it's assigned to, while bookings RLS itself
  // scopes plain staff/leaf_node to only their own assigned rows.
  patient_name: string | null;
  service_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── booking_requests ("Request for Booking" — quick contact-me lead, admin inbox) ──
export interface BookingRequest {
  id: string;
  account_id: string; // stamped server-side from auth.uid(), never client-supplied
  note: string | null;
  contacted: boolean;
  contacted_by: string | null;
  contacted_at: string | null;
  created_at: string;
}

export interface BookingRequestWithAccount extends BookingRequest {
  account?: Pick<Profile, "full_name" | "phone"> | null;
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
  account?: Pick<Profile, "full_name" | "phone" | "age">;
  subject_name?: string; // account holder or dependent name
  // Subject facts resolved from the dependent row, falling back to the account
  // holder's profile when the booking is for the account holder themselves.
  subject_relationship?: Relationship | "self";
  subject_age?: number | null;
  subject_phone?: string | null;
  assigned_to_name?: string | null; // resolved from the assigned staff/leaf_node profile
}


