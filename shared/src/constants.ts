/**
 * VAgeWell Care — shared constants (single source of truth for enums & catalog).
 * Imported by the Next.js frontend (@shared/constants).
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
// 'staff' role retired (0021) — admin and leaf_node cover all ops needs.
export const ROLES = ["patient", "admin", "leaf_node"] as const;
export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  patient: "Client",
  admin: "Admin",
  leaf_node: "Leaf Node",
};
// Roles that operate the web portal (vs. the patient mobile app).
export const OPS_ROLES = ["admin", "leaf_node"] as const;

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

// Assignment pipeline (platform-expansion round): a booking moves through
// these in order, or drops to `cancelled` at any point before `completed`.
export const BOOKING_STATUSES = [
  "requested",
  "approved",
  "assigned",
  "in_progress",
  "report_uploaded",
  "completed",
  "cancelled",
] as const;

export const SERVICE_MODES = ["clinic", "home_care"] as const;
export const SERVICE_MODE_LABELS: Record<(typeof SERVICE_MODES)[number], string> = {
  clinic: "Clinic Visit",
  home_care: "Home Care",
};

// Nutrition/Physio are a flat advance regardless of days; Para-Medical/Mental
// Wellbeing stay ₹/day × days booked.
export const PRICING_MODELS = ["per_day", "flat_advance"] as const;

export const REPORT_TYPES = ["medical_report", "image", "prescription", "pdf"] as const;
export const REPORT_TYPE_LABELS: Record<(typeof REPORT_TYPES)[number], string> = {
  medical_report: "Medical Report",
  image: "Image",
  prescription: "Prescription",
  pdf: "PDF",
};

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

// ── Payment QR (admin-uploaded, public; shown to patients on the payment screen) ──
export const PAYMENT_QR_BUCKET = "payment-qr"; // public bucket (see migration 0005)
export const PAYMENT_QR_OBJECT = "upi.png"; // single fixed object, upserted on upload

// ── Medical reports (staff/leaf_node upload; admin-gated before the customer sees them) ──
export const MEDICAL_REPORT_BUCKET = "medical-reports"; // private (see migration 0009)
export const MAX_REPORT_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_REPORT_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

// ── Seed catalog — confirmed 4-service catalog (mirror of supabase/seed.sql + install_all.sql) ──
export const SEED_SERVICES = [
  { name: "Nutrition", price_per_day: 2000, pricing_model: "flat_advance", description: "Diet adherence (supported by strategic meal provider partnerships)." },
  { name: "Physio Therapy", price_per_day: 2000, pricing_model: "flat_advance", description: "Exercise completion, mobility scores." },
  { name: "Para-Medical", price_per_day: 800, pricing_model: "per_day", description: "Vitals tracking (BP, Sugar, SpO2) and medication compliance." },
  { name: "Mental Wellbeing", price_per_day: 800, pricing_model: "per_day", description: "Mood scores and social engagement tracking." },
] as const;

// Service whose booking unlocks staff vitals entry (patient-facing panel shows Sugar + Blood Group).
export const PARA_MEDICAL_SERVICE = "Para-Medical";

export const HOSPITAL_CONTACT_PHONE = "+919342703376";

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
  "SERVER_ERROR",
] as const;

export const CURRENCY_SYMBOL = "₹";
