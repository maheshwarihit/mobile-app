/**
 * VAgeWell Care — shared constants (single source of truth for enums & catalog).
 * Imported by the Next.js frontend (@shared/constants) and the notify-admin edge fn.
 * Keep these arrays in lock-step with the CHECK constraints in
 * supabase/migrations/0001_schema.sql and the string-unions in ./types.ts.
 */

// ── Screen IDs (frozen; one per screen) ──────────────────────────
export const SCREEN_IDS = {
  INITIAL: "INITIAL",
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
  SERVICE_LIST: "SERVICE_LIST",
  APPOINTMENT: "APPOINTMENT",
  PAYMENT: "PAYMENT",
  DASHBOARD: "DASHBOARD",
  PROFILE: "PROFILE",
} as const;

// ── Enums (arrays back the CHECK constraints & UI dropdowns) ──────
export const ROLES = ["patient", "staff", "admin"] as const;

export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export const RELATIONSHIPS = [
  "spouse",
  "parent",
  "child",
  "sibling",
  "grandparent",
  "grandchild",
  "other",
] as const;

export const HOW_HEARD_OPTIONS = [
  "web_search",
  "referral",
  "social_media",
  "family_friend",
  "advertisement",
  "other",
] as const;
export const HOW_HEARD_DEFAULT = "web_search"; // Workflow PDF: dropdown default "Web Search"
export const HOW_HEARD_LABELS: Record<(typeof HOW_HEARD_OPTIONS)[number], string> = {
  web_search: "Web Search",
  referral: "Referral",
  social_media: "Social Media",
  family_friend: "Family / Friend",
  advertisement: "Advertisement",
  other: "Other",
};

export const PAYMENT_METHODS = ["direct", "online"] as const;
export const PAYMENT_STATUSES = [
  "pending",
  "pending_verification",
  "paid",
  "pay_at_visit",
] as const;
export const BOOKING_STATUSES = ["open", "closed", "cancelled"] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

// ── Scheduling (GR-4): record-only, 15-min slots, no availability check ──
export const SLOT_MINUTES = 15;
export const BOOKING_START_HOUR = 6; // 06:00
export const BOOKING_END_HOUR = 21; // 21:00 (last selectable slot start)
export const MIN_BOOKING_DAYS = 1;
export const MAX_BOOKING_DAYS = 60;
export const MULTI_DAY_MODE = "consecutive" as const; // GO-6

// ── Auth (GR-2 / GO-4) ───────────────────────────────────────────
export const SESSION_HOURS = 72;
export const OTP_LENGTH = 6;
export const PHONE_COUNTRY_CODE = "+91";

// ── Payment proof upload (GO-5) ──────────────────────────────────
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const PAYMENT_PROOF_BUCKET = "payment-proofs"; // private
export const SIGNED_URL_TTL_SECONDS = 300; // 5 min

// ── Seed catalog (GO-1) — placeholder prices except Physiotherapy; admin-editable ──
export const SEED_SERVICES = [
  { name: "Physiotherapy", price_per_day: 1500, description: "In-home physiotherapy session by a licensed therapist." },
  { name: "Nursing Care", price_per_day: 1200, description: "Home nursing and bedside care for recovering patients." },
  { name: "Elderly Attendant", price_per_day: 900, description: "Daily attendant support for elderly household members." },
  { name: "Post-Surgical Care", price_per_day: 1800, description: "Post-operative recovery, dressing and wound care." },
  { name: "Doctor Home Visit", price_per_day: 2000, description: "Physician consultation at your home." },
  { name: "Lab Sample Collection", price_per_day: 500, description: "At-home collection of pathology samples." },
] as const;

// ── Notification target (R3.4) ───────────────────────────────────
export const ADMIN_ALERT_EMAIL = "maheshwari21102003@gmail.com";

// ── Machine error codes for user-facing failures ─────────────────
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "PROFILE_INCOMPLETE",
  "PAYMENT_PROOF_REQUIRED",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_BAD_TYPE",
  "INVALID_STATUS_TRANSITION",
  "EMAIL_SEND_FAILED",
  "SERVER_ERROR",
] as const;

export const CURRENCY_SYMBOL = "₹";
