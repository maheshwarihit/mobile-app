// Supabase Edge Function: analyze-lab-report
//
// Takes one photo of a medical lab report (blood test, urine routine, stool
// routine…) plus optional patient details, and returns a plain-language
// reading of it: every test with its value, unit, reference range and
// Normal / High / Low / Critical status, what the abnormal values mean, an
// overall summary, possible concerns, diet and lifestyle suggestions,
// questions for the doctor and an urgency level. Called by the app's Bio
// Markers module (Nutrition → Bio Markers).
//
// Uses the same ANTHROPIC_API_KEY function secret as analyze-food-plate.
// Deploy: supabase functions deploy analyze-lab-report
//
// Request  (POST, JSON, signed-in user's JWT in Authorization):
//   { image_base64: string,
//     media_type: "image/jpeg"|"image/png"|"image/webp",
//     language?: "en"|"ta",
//     person?: { age?: number, gender?: string } }
// Response 200: LabReport (see schema below)
// Response 4xx/5xx: { error: string }

import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// ~5 MB of image once decoded.
const MAX_BASE64_CHARS = 7_000_000;

const TestResult = z.object({
  name: z.string().describe("Test name as on the report, e.g. Haemoglobin"),
  value: z.string().describe("The value exactly as printed, or 'unclear' if it cannot be read"),
  unit: z.string().describe("Unit as printed, e.g. g/dL; empty if none"),
  reference_range: z.string().describe("Reference range, e.g. 12.0 - 15.5"),
  range_source: z.enum(["report", "standard"]).describe("'report' if the range is printed on the report, 'standard' if a standard adult range was used"),
  status: z.enum(["Normal", "High", "Low", "Critical", "Unclear"]),
});

const LabReport = z.object({
  status: z.enum(["ok", "unreadable"]),
  unreadable_reason: z.string().describe("When unreadable: a short reason. Otherwise empty"),
  retake_tip: z.string().describe("When unreadable: one short tip for a better photo. Otherwise empty"),
  report_type: z.enum(["Blood Test", "Urine Routine", "Stool Routine", "Other"]),
  report_panels: z
    .array(z.string())
    .describe("For blood tests, the panels present: CBC, Lipid, LFT, KFT, Thyroid, Sugar/HbA1c, Vitamin. Otherwise empty"),
  tests: z.array(TestResult).describe("Every test on the report, in the order printed"),
  abnormal_explanations: z
    .array(
      z.object({
        test: z.string(),
        what_it_measures: z.string().describe("One simple sentence"),
        possible_causes: z.string().describe("One or two simple sentences; possibilities, never a diagnosis"),
      }),
    )
    .describe("One entry for each High, Low or Critical test"),
  summary: z.string().describe("Two or three simple sentences about the report overall"),
  health_concerns: z.array(z.string()).describe("Possible health concerns, at most 4, short"),
  diet_lifestyle: z.array(z.string()).describe("Diet and lifestyle suggestions, at most 4, short"),
  doctor_questions: z.array(z.string()).describe("Questions to ask the doctor, at most 4, short"),
  urgency: z.enum(["Routine", "Consult Soon", "Urgent"]),
  disclaimer: z.string(),
});

const SYSTEM = `You read medical lab reports for VAgeWell Care, a home-care app used mostly by families in India, often for older adults.

INPUT: An image (photo or upload) of a medical lab report, plus optional patient details.

TASKS:
1. Image check: If the image is blurry, cropped, not a medical report, or unreadable, return status "unreadable" with a short reason and a tip to retake the photo.
2. Detect report type: Blood Test (CBC, Lipid, LFT, KFT, Thyroid, Sugar/HbA1c, Vitamin), Urine Routine, Stool/Motion Routine, or Other.
3. Extract every test: name, value, unit, reference range (from the report; if missing, use standard adult ranges and mark range_source "standard").
4. Classify each value: Normal / High / Low / Critical.
5. Explain each abnormal value in simple language (what it measures, possible causes).
6. Give an overall summary, possible health concerns, diet & lifestyle suggestions, questions for the doctor, and an urgency level: Routine / Consult Soon / Urgent.

RULES:
- Use simple, friendly language (8th-grade level). No medical jargon without explanation.
- NEVER give a final diagnosis or prescribe medicines or dosages.
- If any value is Critical, set urgency "Urgent" and advise seeing a doctor immediately.
- Do not invent values. If a value is unclear, set its value to "unclear" and its status to "Unclear".
- Respond in the language requested (default English). Test names, values, units and ranges stay exactly as printed.
- Always end with the disclaimer: say this is not a diagnosis and the report should be reviewed with a doctor.
- When status is "unreadable", leave every list empty, use "Other" and "Routine", and still give the disclaimer.`;

type Person = { age?: number; gender?: string };

// Only plain, bounded values reach the prompt.
function describePerson(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "No patient details were provided.";
  const p = raw as Person;
  const age = typeof p.age === "number" && p.age >= 0 && p.age <= 130 ? p.age : null;
  const gender = typeof p.gender === "string" && ["male", "female", "other"].includes(p.gender) ? p.gender : null;
  const parts = [age !== null ? `Age: ${age} years` : null, gender ? `Gender: ${gender}` : null].filter(Boolean);
  return parts.length ? parts.join("\n") : "No patient details were provided.";
}

const anthropic = new Anthropic();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Signed-in users only (the anon key alone must not be able to spend the AI budget).
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Please sign in to read a report." }, 401);

  let body: { image_base64?: unknown; media_type?: unknown; language?: unknown; person?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  const mediaType = MEDIA_TYPES.find((m) => m === body.media_type);
  if (!imageBase64 || !mediaType) return json({ error: "Send a JPEG, PNG or WEBP image." }, 400);
  if (imageBase64.length > MAX_BASE64_CHARS) return json({ error: "The image is too large. Please try a smaller photo." }, 413);
  const language = body.language === "ta" ? "Tamil" : "English";

  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // If the model's safety checks decline a request, re-run it on
      // Anthropic's recommended fallback model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(LabReport) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: `Read this lab report.

The patient:
${describePerson(body.person)}

Respond in ${language}.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "This report could not be read. Please try a different photo." }, 422);
    }
    if (response.stop_reason === "max_tokens") {
      return json({ error: "The report was too long to read in one go. Please photograph one page at a time." }, 502);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No reading was returned. Please try again." }, 502);

    const parsed = LabReport.safeParse(JSON.parse(text.text));
    if (!parsed.success) return json({ error: "The reading came back in an unexpected form. Please try again." }, 502);
    const report = parsed.data;
    // Rule: any Critical value makes the report Urgent, whatever the model said.
    if (report.tests.some((t) => t.status === "Critical")) report.urgency = "Urgent";
    return json(report);
  } catch (error) {
    // Most specific first: bad input, key problems, rate limits, then anything else from the API.
    if (error instanceof Anthropic.BadRequestError) {
      console.error("analyze-lab-report bad request:", error.message);
      return json({ error: "This image could not be read. Please try another photo." }, 400);
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("analyze-lab-report auth error:", error.message);
      return json({ error: "AI analysis is not set up correctly yet. Please contact support." }, 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "Too many requests right now. Please try again in a minute." }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`analyze-lab-report API error ${error.status}:`, error.message);
      return json({ error: "The AI service is having trouble. Please try again shortly." }, 502);
    }
    console.error("analyze-lab-report unexpected error:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
