// ============================================================================
// notify-admin — Supabase Edge Function (Deno)
// Fired by a Database Webhook on public.bookings (INSERT + UPDATE). Composes and
// sends the operational alert email to the admin (R2.6 / R3.4 / GR-7 / GO-2).
//
// Trigger events (GO-2 default):
//   • INSERT                          → "New booking" alert (the finalization moment)
//   • UPDATE, proof just attached     → "Payment proof uploaded" alert
//
// EMAIL_PROVIDER=dev logs the composed message (no send) so local dev needs no key.
// Configure the webhook in Studio → Database → Webhooks, or via SQL (see README).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_TO = Deno.env.get("NOTIFY_EMAIL_TO") ?? "maheshwari21102003@gmail.com";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@vagewell.example";
const EMAIL_PROVIDER = (Deno.env.get("EMAIL_PROVIDER") ?? "dev").toLowerCase();
const EMAIL_API_KEY = Deno.env.get("EMAIL_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface BookingRow {
  id: string;
  account_id: string;
  family_member_id: string | null;
  service_name: string;
  price_per_day: number;
  num_days: number;
  total_amount: number;
  start_date: string;
  time_slot: string;
  symptom_brief: string | null;
  payment_method: string;
  payment_status: string;
  payment_proof_path: string | null;
}

interface WebhookBody {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: BookingRow | null;
  old_record: BookingRow | null;
}

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

function shouldNotify(body: WebhookBody): "new" | "proof" | null {
  if (body.table !== "bookings" || !body.record) return null;
  if (body.type === "INSERT") return "new";
  if (body.type === "UPDATE") {
    const proofJustAdded =
      !body.old_record?.payment_proof_path && !!body.record.payment_proof_path;
    if (proofJustAdded) return "proof";
  }
  return null;
}

async function lookupNames(b: BookingRow) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { patient_name: null, patient_phone: null, subject_name: null };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", b.account_id)
    .maybeSingle();

  let subject_name = profile?.full_name ?? null; // default: booked for self
  if (b.family_member_id) {
    const { data: dep } = await admin
      .from("family_members")
      .select("full_name")
      .eq("id", b.family_member_id)
      .maybeSingle();
    subject_name = dep?.full_name ?? subject_name;
  }
  return {
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    subject_name,
  };
}

function buildEmail(kind: "new" | "proof", b: BookingRow, names: {
  patient_name: string | null;
  patient_phone: string | null;
  subject_name: string | null;
}) {
  const subject =
    kind === "new"
      ? `VAgeWell — New booking: ${b.service_name} (${b.payment_status})`
      : `VAgeWell — Payment proof uploaded: ${b.service_name}`;

  const lines = [
    `Event: ${kind === "new" ? "New booking finalized" : "Payment proof uploaded"}`,
    `Booking ID: ${b.id}`,
    `Account holder: ${names.patient_name ?? "—"} (${names.patient_phone ?? "—"})`,
    `Care for: ${names.subject_name ?? "—"}`,
    `Service: ${b.service_name}`,
    `Start date: ${b.start_date}   Time: ${b.time_slot}   Days: ${b.num_days}`,
    `Price/day: ${money(b.price_per_day)}   Total: ${money(b.total_amount)}`,
    `Payment: ${b.payment_method} → ${b.payment_status}`,
    `Symptom brief: ${b.symptom_brief ?? "—"}`,
  ];
  return { subject, text: lines.join("\n") };
}

async function sendEmail(subject: string, text: string) {
  // If a real provider is selected but no key is configured, degrade to dev-log
  // instead of throwing.
  const provider = EMAIL_PROVIDER !== "dev" && !EMAIL_API_KEY ? "dev" : EMAIL_PROVIDER;
  if (provider !== EMAIL_PROVIDER) {
    console.warn(`notify-admin: EMAIL_API_KEY missing for provider '${EMAIL_PROVIDER}' — logging instead of sending.`);
  }
  if (provider === "resend") {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [EMAIL_TO], subject, text }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
    return;
  }
  if (provider === "sendgrid") {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: EMAIL_TO }] }],
        from: { email: EMAIL_FROM },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!r.ok) throw new Error(`sendgrid ${r.status}: ${await r.text()}`);
    return;
  }
  // dev: log only (no external send)
  console.log(`\n===== [DEV EMAIL to ${EMAIL_TO}] =====\nSubject: ${subject}\n${text}\n=====================================\n`);
}

Deno.serve(async (req) => {
  try {
    // Authenticity check: the DB webhook sends x-webhook-secret. When the secret
    // is configured, reject anything that doesn't match (blocks URL-spoofed spam).
    if (WEBHOOK_SECRET) {
      if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("notify-admin: NOTIFY_WEBHOOK_SECRET not set — accepting unauthenticated requests (dev only).");
    }

    const body = (await req.json()) as WebhookBody;
    const kind = shouldNotify(body);
    if (!kind || !body.record) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const names = await lookupNames(body.record);
    const { subject, text } = buildEmail(kind, body.record, names);
    await sendEmail(subject, text);
    return new Response(JSON.stringify({ sent: true, provider: EMAIL_PROVIDER }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-admin error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
