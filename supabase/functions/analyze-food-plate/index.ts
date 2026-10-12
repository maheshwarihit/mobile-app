// Supabase Edge Function: analyze-food-plate
//
// Takes one cropped photo of a meal and returns an AI estimate of its
// nutrition: a healthiness score, calories, carbs, protein, fat, fibre,
// notable micronutrients and suggestions. Called by the app's Food Plate
// Monitor (Nutrition → Food Plate Monitor).
//
// Why this is a server function and not a direct call from the app: the
// Claude API key is a secret and must never ship inside the app bundle. It
// lives here as the ANTHROPIC_API_KEY function secret.
//
// Deploy (once, from the repo root, with the Supabase CLI logged in):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy analyze-food-plate
//
// Request  (POST, JSON, signed-in user's JWT in Authorization):
//   { image_base64: string, media_type: "image/jpeg"|"image/png"|"image/webp", language?: "en"|"ta" }
// Response 200: PlateAnalysis (see schema below)
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
// ~5 MB of image once decoded; the app sends a cropped, downsized JPEG far below this.
const MAX_BASE64_CHARS = 7_000_000;

const PlateAnalysis = z.object({
  is_food: z.boolean().describe("false when the photo does not show food or a meal"),
  dish_summary: z.string().describe("One short sentence naming what is on the plate"),
  items: z.array(z.string()).describe("Each distinct food or drink visible"),
  score: z.number().describe("Overall healthiness of this plate, 0 (poor) to 100 (excellent)"),
  calories_kcal: z.number().describe("Estimated total energy of the whole plate, kcal"),
  carbs_g: z.number().describe("Estimated total carbohydrate, grams"),
  protein_g: z.number().describe("Estimated total protein, grams"),
  fat_g: z.number().describe("Estimated total fat, grams"),
  fibre_g: z.number().describe("Estimated total dietary fibre, grams"),
  micronutrients: z
    .array(
      z.object({
        name: z.string().describe("e.g. Iron, Calcium, Vitamin C"),
        amount: z.string().describe('Estimated amount with unit, e.g. "4 mg"'),
        level: z.enum(["low", "moderate", "high"]).describe("How much this plate provides relative to a meal's share of daily needs"),
      }),
    )
    .describe("The 4 to 8 most relevant vitamins and minerals for this plate"),
  suggestions: z.array(z.string()).describe("3 to 5 short, practical suggestions to improve this meal"),
});

const SYSTEM = `You are the nutrition estimator inside VAgeWell Care, a home-care app used mostly by families in India, often for older adults.

You are shown one photo of a plate or meal. Estimate the nutrition of everything visible on it, as served.

How to estimate:
- Identify each food and judge its portion from the plate, bowl and utensil sizes in the photo. Indian home meals (rice, roti, dal, sambar, curries, idli, dosa, curd and so on) are common; recognise them by name.
- Give totals for the whole plate, not per 100 g. Use realistic home-cooking values, including the oil or ghee a dish is normally cooked with.
- These are estimates from a photo. Give your single best figure for each value rather than a range.
- Score the plate from 0 to 100 for overall healthiness: balance of vegetables, protein, whole grains and healthy fats, portion size, and how much is fried, sugary or highly refined.
- Suggestions should be specific to this plate and easy to act on at the next meal (what to add, reduce or swap). Do not give medical advice or mention diseases unless the food itself makes it relevant in a general way.

If the photo does not show food, set is_food to false, explain briefly in dish_summary, and use 0 and empty lists for everything else.`;

const anthropic = new Anthropic();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Signed-in users only. The public anon key is itself a valid JWT, so the
  // platform's JWT check alone would let anyone with the app bundle spend the
  // AI budget; require a real user session.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Please sign in to analyse a plate." }, 401);

  let body: { image_base64?: unknown; media_type?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  const mediaType = MEDIA_TYPES.find((m) => m === body.media_type);
  if (!imageBase64 || !mediaType) return json({ error: "Send a JPEG, PNG or WEBP image." }, 400);
  if (imageBase64.length > MAX_BASE64_CHARS) return json({ error: "The image is too large. Crop it closer to the plate and try again." }, 413);
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
      output_config: { effort: "medium", format: zodOutputFormat(PlateAnalysis) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: `Analyse this plate. Write dish_summary, items, micronutrient names and suggestions in ${language}.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "This photo could not be analysed. Please try a different photo of your meal." }, 422);
    }
    if (response.stop_reason === "max_tokens") {
      return json({ error: "The analysis was cut short. Please try again." }, 502);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No analysis was returned. Please try again." }, 502);

    const parsed = PlateAnalysis.safeParse(JSON.parse(text.text));
    if (!parsed.success) return json({ error: "The analysis came back in an unexpected form. Please try again." }, 502);
    return json(parsed.data);
  } catch (error) {
    // Most specific first: bad input, key problems, rate limits, then anything else from the API.
    if (error instanceof Anthropic.BadRequestError) {
      console.error("analyze-food-plate bad request:", error.message);
      return json({ error: "This image could not be read. Please try another photo." }, 400);
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("analyze-food-plate auth error:", error.message);
      return json({ error: "AI analysis is not set up correctly yet. Please contact support." }, 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "Too many requests right now. Please try again in a minute." }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`analyze-food-plate API error ${error.status}:`, error.message);
      return json({ error: "The AI service is having trouble. Please try again shortly." }, 502);
    }
    console.error("analyze-food-plate unexpected error:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
