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
//   { images: [{ image_base64: string, media_type: "image/jpeg"|"image/png"|"image/webp" }]  (1–6 pages of one report, in order)
//     — or a single image_base64 + media_type —
//     language?: "en"|"ta",
//     person?: { age?: number, gender?: string } }
//   or, to translate a saved reading into the other language (no image):
//   { translate: LabReport, language: "en"|"ta" }
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

// Report pages can be photos or PDF files (a PDF is read as a document).
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
// ~5 MB of image once decoded.
const MAX_BASE64_CHARS = 7_000_000;

// One or more images: `images: [{ image_base64, media_type }]` (up to 6
// pages of one report, in order), or the original single `image_base64` + `media_type`.
type InImage = { data: string; media_type: (typeof MEDIA_TYPES)[number] };
const MAX_IMAGES = 6;
// Whole request, all images together.
const MAX_TOTAL_BASE64_CHARS = 24_000_000;
function readImages(body: { image_base64?: unknown; media_type?: unknown; images?: unknown }): InImage[] | string {
  const raw = Array.isArray(body.images) ? body.images : [{ image_base64: body.image_base64, media_type: body.media_type }];
  if (raw.length === 0 || raw.length > MAX_IMAGES) return `Send between 1 and ${MAX_IMAGES} images.`;
  const out: InImage[] = [];
  let total = 0;
  for (const item of raw) {
    const data = item && typeof item.image_base64 === "string" ? item.image_base64 : "";
    const media_type = MEDIA_TYPES.find((m) => m === item?.media_type);
    if (!data || !media_type) return "Send PDF, JPEG, PNG or WEBP files.";
    if (data.length > MAX_BASE64_CHARS) return "One of the images is too large. Please try a smaller photo.";
    total += data.length;
    out.push({ data, media_type });
  }
  if (total > MAX_TOTAL_BASE64_CHARS) return "The images are too large together. Please send fewer or smaller photos.";
  return out;
}

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
  person_mismatch: z
    .string()
    .describe("One short sentence when the name, age or gender on the report clearly does not match the patient details given; otherwise empty"),
});
// Readings saved before person_mismatch existed are still accepted for translation.
const SavedLabReport = LabReport.extend({ person_mismatch: z.string().optional().default("") });

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
- Always end with the disclaimer: say this is not a diagnosis and the report should be reviewed with a doctor.
- When status is "unreadable", leave every list empty, use "Other" and "Routine", and still give the disclaimer.
- If the name, age or gender printed on the report clearly does not match the patient details given, say so in person_mismatch in one short sentence (for example: "This report is for Baby DEVESH, a 2-year-old boy, not a 38-year-old woman."), and do not repeat it in the summary. Otherwise leave person_mismatch empty.`;

// The answer's language, as a firm rule of its own: a one-line request at the
// end of the message alone is often ignored, since the report, the schema and
// the instructions are all in English.
function languageRule(language: "English" | "Tamil"): string {
  if (language === "English") return "LANGUAGE: Write everything in English.";
  return `LANGUAGE: Write in Tamil, using Tamil script. This applies to every sentence you write: summary, what_it_measures, possible_causes, health_concerns, diet_lifestyle, doctor_questions, unreadable_reason, retake_tip and disclaimer. Do not write those in English. Only test names, values, units and reference ranges stay exactly as printed on the report. Use simple, everyday Tamil that a family member would understand.`;
}

// Only the explanatory text is translated; test names, values, units, ranges
// and every status word are copied from the original so nothing can drift.
function translateSystem(language: "English" | "Tamil"): string {
  return `You translate a lab report reading for VAgeWell Care into ${language}${language === "Tamil" ? " (Tamil script)" : ""}. You are given the reading as JSON. Return the same JSON with these fields translated: unreadable_reason, retake_tip, summary, abnormal_explanations[].what_it_measures, abnormal_explanations[].possible_causes, health_concerns, diet_lifestyle, doctor_questions, disclaimer and person_mismatch. Keep every other field exactly as given. Keep the meaning, use simple everyday language, and keep every list the same length and order.`;
}

type LabReportT = z.infer<typeof LabReport>;
function mergeTranslation(orig: LabReportT, tr: LabReportT): LabReportT {
  const explanations =
    tr.abnormal_explanations.length === orig.abnormal_explanations.length
      ? orig.abnormal_explanations.map((e, i) => ({
          ...e,
          what_it_measures: tr.abnormal_explanations[i].what_it_measures,
          possible_causes: tr.abnormal_explanations[i].possible_causes,
        }))
      : orig.abnormal_explanations;
  return {
    ...orig,
    unreadable_reason: tr.unreadable_reason,
    retake_tip: tr.retake_tip,
    summary: tr.summary,
    abnormal_explanations: explanations,
    health_concerns: tr.health_concerns,
    diet_lifestyle: tr.diet_lifestyle,
    doctor_questions: tr.doctor_questions,
    disclaimer: tr.disclaimer,
    person_mismatch: orig.person_mismatch ? tr.person_mismatch : "",
  };
}

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

  let body: { image_base64?: unknown; media_type?: unknown; images?: unknown; language?: unknown; person?: unknown; translate?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const language: "English" | "Tamil" = body.language === "ta" ? "Tamil" : "English";

  // Translate a saved reading (text only, no image).
  if (body.translate !== undefined) {
    const original = SavedLabReport.safeParse(body.translate);
    if (!original.success) return json({ error: "Invalid request." }, 400);
    try {
      const response = await anthropic.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: zodOutputFormat(LabReport) },
        system: translateSystem(language),
        messages: [{ role: "user", content: JSON.stringify(original.data) }],
      });
      const text = response.content.find((b) => b.type === "text");
      if (response.stop_reason !== "end_turn" || !text || text.type !== "text") return json({ error: "Could not translate. Please try again." }, 502);
      const translated = LabReport.safeParse(JSON.parse(text.text));
      if (!translated.success) return json({ error: "Could not translate. Please try again." }, 502);
      return json(mergeTranslation(original.data, translated.data));
    } catch (error) {
      console.error("analyze-lab-report translate error:", error);
      return json({ error: "Could not translate. Please try again." }, 502);
    }
  }

  const images = readImages(body);
  if (typeof images === "string") return json({ error: images }, 400);

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
      system: `${SYSTEM}\n\n${languageRule(language)}`,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) =>
              img.media_type === "application/pdf"
                ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: img.data } }
                : { type: "image" as const, source: { type: "base64" as const, media_type: img.media_type, data: img.data } },
            ),
            {
              type: "text",
              text: `${images.length > 1 ? `Read this lab report. The ${images.length} files above (photos and/or PDFs) are its pages, in order; treat them as one report, list each test once, and give one summary.` : "Read this lab report."}

The patient:
${describePerson(body.person)}

Write your answer in ${language}${language === "Tamil" ? " (Tamil script)" : ""}.`,
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
