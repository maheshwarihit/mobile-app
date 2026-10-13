// Supabase Edge Function: analyze-food-plate
//
// Takes one cropped photo of a meal plus the person's age, gender, height and
// weight, and returns an AI estimate of the plate: a meal score out of 100
// based on the Food Compass Score approach, calories, protein, carbs, fats,
// the micronutrients it provides against that person's daily needs, and
// recommendations on what is missing. Called by the app's Food Plate Monitor
// (Nutrition → Food Plate Monitor).
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
//   { image_base64: string,
//     media_type: "image/jpeg"|"image/png"|"image/webp",
//     language?: "en"|"ta",
//     person?: { age?: number, gender?: string, height_cm?: number, weight_kg?: number, activity_level?: string } }
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
  score: z.number().describe("Meal score for this plate, 0 (poor) to 100 (excellent), from the Food Compass Score approach"),
  calories_kcal: z.number().describe("Estimated total energy of the whole plate, kcal"),
  protein_g: z.number().describe("Estimated total protein, grams"),
  carbs_g: z.number().describe("Estimated total carbohydrate, grams"),
  fat_g: z.number().describe("Estimated total fat, grams"),
  micronutrients: z
    .array(
      z.object({
        name: z.string().describe("e.g. Iron, Calcium, Vitamin C"),
        amount: z.string().describe('Estimated amount in this plate with unit, e.g. "4 mg"'),
        daily_need: z.string().describe('This person\'s recommended daily amount with unit, e.g. "18 mg"'),
        percent_of_daily_need: z.number().describe("amount as a percentage of daily_need, 0 or more"),
      }),
    )
    .describe("The 6 to 10 micronutrients that matter most for this person's daily needs, including ones this plate is low in"),
  missing: z.array(z.string()).describe("What this plate lacks: 2 to 5 short items, each a food group or nutrient"),
  recommendations: z.array(z.string()).describe("3 to 5 short, practical recommendations that supply what is missing"),
});

const SYSTEM = `You are the nutrition estimator inside VAgeWell Care, a home-care app used mostly by families in India, often for older adults.

You are shown one photo of a plate or meal, and you may be told the age, gender, height, weight and activity level of the person who will eat it.

Use the Food Compass Score as the main scoring method. Food Compass is the nutrient profiling system from Tufts University that rates foods and mixed meals from 1 (least healthful) to 100 (most healthful) across nine domains: nutrient ratios (unsaturated to saturated fat, fibre to carbohydrate, potassium to sodium), vitamins, minerals, food-based ingredients (fruits, vegetables, legumes, whole grains, nuts and seeds, seafood, yoghurt, plant oils, against refined grains and red or processed meat), additives (added sugar, nitrites, artificial sweeteners, flavours and colours), processing (degree of processing, fermentation, frying), specific lipids (omega-3 fats, medium-chain fats, dietary cholesterol), fibre and protein, and phytochemicals (flavonoids, carotenoids). Judge the plate on each domain from what you can see, then combine them into one meal score. You are estimating from a photo, so apply the method's reasoning rather than claiming an exact laboratory calculation.

How to estimate:
- Identify each food and judge its portion from the plate, bowl and utensil sizes in the photo. Indian home meals (rice, roti, dal, sambar, curries, idli, dosa, curd and so on) are common; recognise them by name.
- Give calories, protein, carbohydrate and fat as totals for the whole plate as served, using realistic home-cooking values that include the oil or ghee a dish is normally cooked with. Give your single best figure for each rather than a range.
- Use the person's age, gender, height, weight and activity level to work out their daily needs: their energy requirement, and the recommended daily amount of each micronutrient for someone of that age and gender. Where a detail is not given, assume a typical healthy adult and do not mention the assumption.
- For micronutrients, list the ones that matter most for this person, state how much this plate provides, their daily need, and the percentage of the daily need this plate covers. Include important ones the plate is low in, not only the ones it is rich in.
- Let the person's details shape the meal score only where they change what is healthful for them (for example portion size against their energy needs); the Food Compass domains remain the basis.
- "missing" names what the plate lacks. "recommendations" says how to supply it at this or the next meal: what to add, reduce or swap, specific to this plate and easy to act on. Do not give medical advice or mention diseases.

If the photo does not show food, set is_food to false, explain briefly in dish_summary, and use 0 and empty lists for everything else.`;

type Person = { age?: number; gender?: string; height_cm?: number; weight_kg?: number; activity_level?: string };

// Only plain, bounded values reach the prompt.
function describePerson(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "No details about the person were provided.";
  const p = raw as Person;
  const num = (v: unknown, min: number, max: number) => (typeof v === "number" && v >= min && v <= max ? v : null);
  const word = (v: unknown, allowed: string[]) => (typeof v === "string" && allowed.includes(v) ? v.replace(/_/g, " ") : null);
  const age = num(p.age, 0, 130);
  const height = num(p.height_cm, 50, 250);
  const weight = num(p.weight_kg, 2, 400);
  const gender = word(p.gender, ["male", "female", "other", "prefer_not_to_say"]);
  const activity = word(p.activity_level, ["sedentary", "light", "moderate", "very", "extra"]);
  const activityWords: Record<string, string> = {
    sedentary: "inactive",
    light: "lightly active",
    moderate: "moderately active",
    very: "highly active",
    extra: "extremely active",
  };
  const parts = [
    age !== null ? `Age: ${age} years` : null,
    gender && gender !== "prefer not to say" ? `Gender: ${gender}` : null,
    height !== null ? `Height: ${height} cm` : null,
    weight !== null ? `Weight: ${weight} kg` : null,
    activity ? `Physical activity: ${activityWords[activity]}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : "No details about the person were provided.";
}

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

  let body: { image_base64?: unknown; media_type?: unknown; language?: unknown; person?: unknown };
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
              text: `For the uploaded image, use the Food Compass Score algorithm as the main calculation algorithm and, based on the age, height, weight and gender below, calculate the meal quality of the food plate in the image. Return: the calorie count of the plate, protein, carbs, fats, the daily needed micronutrients, a meal score out of 100, and recommendations on what is missing.

The person:
${describePerson(body.person)}

Write dish_summary, items, micronutrient names, missing and recommendations in ${language}.`,
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
