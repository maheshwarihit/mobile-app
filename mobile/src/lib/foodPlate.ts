import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

/** What the analyze-food-plate edge function returns (mirrors its schema). */
export type PlateAnalysis = {
  is_food: boolean;
  dish_summary: string;
  items: string[];
  /** Meal score out of 100, from the Food Compass Score approach. */
  score: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  micronutrients: { name: string; amount: string; daily_need: string; percent_of_daily_need: number }[];
  missing: string[];
  recommendations: string[];
};

/** The person the plate is for; sent so the AI can work out their daily needs. Any field may be unknown. */
export type PlatePerson = {
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
};

export type PlateSource = "camera" | "gallery";

/** Most photos one meal can have (the analysis function accepts up to this many). */
export const MAX_MEAL_PHOTOS = 4;

/**
 * A photo ready to analyse (`base64` set), or one that still needs cropping
 * (`base64` null — the web has no built-in crop step, so the app's own crop
 * screen produces it).
 */
export type PickedPlate = { uri: string; base64: string | null; mediaType: "image/jpeg" | "image/png" | "image/webp" };

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  // On a phone this opens the system crop step straight after the camera or
  // gallery (the camera itself focuses automatically). Ignored on the web.
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: true,
};

function mediaTypeOf(mime: string | undefined): PickedPlate["mediaType"] {
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Open the camera or the gallery for a plate photo, asking for that permission
 * first (the system prompt appears the first time only). Null if cancelled;
 * throws with a readable message if the permission is refused.
 */
export async function pickPlate(source: PlateSource): Promise<PickedPlate | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera access is needed to take a picture. Allow it in your phone's Settings for VAgeWell Care.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Photo access is needed to choose a picture. Allow it in your phone's Settings for VAgeWell Care.");
  }
  const res =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  // Native: already cropped by the system editor, base64 included.
  // Web: uncropped; the crop screen makes the base64.
  const cropped = Platform.OS !== "web" && !!a.base64;
  return { uri: a.uri, base64: cropped ? (a.base64 ?? null) : null, mediaType: mediaTypeOf(a.mimeType) };
}

/** Send a meal's cropped photos (one or more, e.g. the plate and side bowls) for AI analysis as one meal. Throws an Error with a user-readable message on failure. */
export async function analyzePlate(
  photos: { base64: string; mediaType: PickedPlate["mediaType"] }[],
  language: string,
  person: PlatePerson,
): Promise<PlateAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-food-plate", {
    body: { images: photos.map((p) => ({ image_base64: p.base64, media_type: p.mediaType })), language, person },
  });
  if (error) {
    // The function's own { error } message, when it sent one.
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON — fall through to the generic message
    }
    throw new Error(message ?? "AI analysis isn't available right now. Please try again later.");
  }
  return data as PlateAnalysis;
}

/** Translate a stored meal result's words into `language` (no image is sent). */
export async function translatePlate(analysis: PlateAnalysis, language: string): Promise<PlateAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-food-plate", { body: { translate: analysis, language } });
  if (error) {
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON
    }
    throw new Error(message ?? "Could not translate.");
  }
  return data as PlateAnalysis;
}
