// Supabase Edge Function: send-feedback
//
// The patient's feedback from the Services screen (star rating + optional
// message): saved to the feedback table (migration 0052) as the signed-in
// user, then emailed to VAgeWell (info@vagewell.com) through Resend.
// The admin also sees it in the app (admin → Feedback).
//
// Deploy: supabase functions deploy send-feedback
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY       — from resend.com (required for the email)
//   FEEDBACK_EMAIL_TO    — optional, default info@vagewell.com
//   FEEDBACK_EMAIL_FROM  — optional, default "VAgeWell Care <onboarding@resend.dev>";
//                          use an address on a domain verified in Resend (e.g. feedback@vagewell.com)
//
// Request  (POST, signed-in user's JWT in Authorization): { rating: 1-5, message?: string }
// Response 200: { saved: true, emailed: boolean }
// Response 4xx/5xx: { error: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // As the signed-in user, so the database's rules apply (they can only add their own).
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Please sign in again, then send your feedback." }, 401);

  let body: { rating?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Please choose a rating from 1 to 5 stars." }, 400);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  const { error: insertError } = await userClient.from("feedback").insert({ rating, message: message || null });
  if (insertError) {
    console.error("feedback insert failed:", insertError.message);
    return json({ error: "Could not save your feedback. Please try again." }, 500);
  }

  // Email it. Saved already, so a failed email does not fail the request.
  let emailed = false;
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (apiKey) {
    try {
      const { data: profile } = await userClient.from("profiles").select("full_name, phone").eq("id", userData.user.id).maybeSingle();
      const name = profile?.full_name || "A patient";
      const phone = profile?.phone || userData.user.phone || "";
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
      const html = `
        <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
          <h2 style="margin:0 0 12px">New feedback from the VAgeWell Care app</h2>
          <p style="margin:4px 0"><b>From:</b> ${escapeHtml(name)}${phone ? ` (${escapeHtml(phone)})` : ""}</p>
          <p style="margin:4px 0"><b>Rating:</b> <span style="color:#d97706;font-size:18px">${stars}</span> ${rating}/5 · ${RATING_WORDS[rating]}</p>
          <p style="margin:4px 0"><b>Message:</b></p>
          <p style="margin:4px 0;padding:10px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap">${message ? escapeHtml(message) : "<i>(no message)</i>"}</p>
          <p style="margin:12px 0 0;color:#6b7280;font-size:12px">Sent ${escapeHtml(when)} IST · also in the app: admin → Feedback</p>
        </div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("FEEDBACK_EMAIL_FROM") || "VAgeWell Care <onboarding@resend.dev>",
          to: [Deno.env.get("FEEDBACK_EMAIL_TO") || "info@vagewell.com"],
          subject: `Feedback ${rating}/5 from ${name}`,
          html,
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("feedback email failed:", res.status, await res.text());
    } catch (e) {
      console.error("feedback email failed:", e);
    }
  } else {
    console.warn("RESEND_API_KEY is not set; feedback saved but not emailed.");
  }

  return json({ saved: true, emailed });
});
