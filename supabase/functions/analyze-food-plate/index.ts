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
//   { images: [{ image_base64: string, media_type: "image/jpeg"|"image/png"|"image/webp" }]  (1–4 photos of one meal)
//     — or a single image_base64 + media_type —
//     language?: "en"|"ta",
//     person?: { age?: number, gender?: string, height_cm?: number, weight_kg?: number, activity_level?: string } }
//   or, to translate a saved result into the other language (no image):
//   { translate: PlateAnalysis, language: "en"|"ta" }
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

// One or more images: `images: [{ image_base64, media_type }]` (up to 4
// photos of one meal, e.g. the plate and side bowls), or the original single `image_base64` + `media_type`.
type InImage = { data: string; media_type: (typeof MEDIA_TYPES)[number] };
const MAX_IMAGES = 4;
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
    if (!data || !media_type) return "Send JPEG, PNG or WEBP images.";
    if (data.length > MAX_BASE64_CHARS) return "One of the images is too large. Please try a smaller photo.";
    total += data.length;
    out.push({ data, media_type });
  }
  if (total > MAX_TOTAL_BASE64_CHARS) return "The images are too large together. Please send fewer or smaller photos.";
  return out;
}

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
    .describe("The 4 micronutrients that matter most for this person's daily needs, including ones this plate is low in"),
  missing: z.array(z.string()).describe("What this plate lacks: at most 3 short items, each a food group or nutrient"),
  recommendations: z.array(z.string()).describe("At most 3 simple suggestions, each a short phrase of no more than 8 words, e.g. 'Add a bowl of curd'"),
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
- "missing" names what the plate lacks. "recommendations" are simple suggestions for this or the next meal: what to add, reduce or swap. Keep each one a short, plain phrase of no more than 8 words (for example "Add a bowl of curd", "Use less oil", "Swap white rice for millet"), with no explanation. Do not give medical advice or mention diseases.

If the photo does not show food, set is_food to false, explain briefly in dish_summary, and use 0 and empty lists for everything else.`;

// The answer's language, as a firm rule of its own: a one-line request at the
// end of the message alone is often ignored, since the schema and the
// instructions are all in English.
function languageRule(language: "English" | "Tamil"): string {
  if (language === "English") return "LANGUAGE: Write everything in English.";
  return `LANGUAGE: Write in Tamil, using Tamil script. This applies to dish_summary, items, micronutrient names, missing and recommendations. Do not write those in English. Numbers and units (kcal, g, mg) stay as they are. Use simple, everyday Tamil.`;
}

// Only the words are translated; every number is copied from the original.
function translateSystem(language: "English" | "Tamil"): string {
  return `You translate a meal analysis for VAgeWell Care into ${language}${language === "Tamil" ? " (Tamil script)" : ""}. You are given it as JSON. Return the same JSON with these fields translated: dish_summary, items, micronutrients[].name, missing and recommendations. Keep every number and unit exactly as given, keep the meaning, use simple everyday language, and keep every list the same length and order. Keep each recommendation a short phrase.`;
}

type PlateAnalysisT = z.infer<typeof PlateAnalysis>;
function mergeTranslation(orig: PlateAnalysisT, tr: PlateAnalysisT): PlateAnalysisT {
  return {
    ...orig,
    dish_summary: tr.dish_summary,
    items: tr.items,
    micronutrients:
      tr.micronutrients.length === orig.micronutrients.length
        ? orig.micronutrients.map((m, i) => ({ ...m, name: tr.micronutrients[i].name }))
        : orig.micronutrients,
    missing: tr.missing,
    recommendations: tr.recommendations,
  };
}

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

  let body: { image_base64?: unknown; media_type?: unknown; images?: unknown; language?: unknown; person?: unknown; translate?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const language: "English" | "Tamil" = body.language === "ta" ? "Tamil" : "English";

  // Translate a saved result (text only, no image).
  if (body.translate !== undefined) {
    const original = PlateAnalysis.safeParse(body.translate);
    if (!original.success) return json({ error: "Invalid request." }, 400);
    try {
      const response = await anthropic.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: zodOutputFormat(PlateAnalysis) },
        system: translateSystem(language),
        messages: [{ role: "user", content: JSON.stringify(original.data) }],
      });
      const text = response.content.find((b) => b.type === "text");
      if (response.stop_reason !== "end_turn" || !text || text.type !== "text") return json({ error: "Could not translate. Please try again." }, 502);
      const translated = PlateAnalysis.safeParse(JSON.parse(text.text));
      if (!translated.success) return json({ error: "Could not translate. Please try again." }, 502);
      return json(mergeTranslation(original.data, translated.data));
    } catch (error) {
      console.error("analyze-food-plate translate error:", error);
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
      output_config: { effort: "medium", format: zodOutputFormat(PlateAnalysis) },
      system: `${SYSTEM}\n\n${languageRule(language)}`,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.media_type, data: img.data } })),
            {
              type: "text",
              text: `${images.length > 1 ? `The ${images.length} photos above together show one meal (for example the plate and its side bowls). Treat them as one meal: count each food once, even if it appears in more than one photo, and give totals for the whole meal.\n\n` : ""}For the uploaded image, use the Food Compass Score algorithm as the main calculation algorithm and, based on the age, height, weight and gender below, calculate the meal quality of the food plate in the image. Return: the calorie count of the plate, protein, carbs, fats, the daily needed micronutrients, a meal score out of 100, and recommendations on what is missing.

The person:
${describePerson(body.person)}

Write dish_summary, items, micronutrient names, missing and recommendations in ${language}${language === "Tamil" ? " (Tamil script)" : ""}.`,
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
