import { Platform } from "react-native";
import type { Language } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { PlateAnalysis } from "@/lib/foodPlate";

/** One analysed plate kept in the Meal library. */
export type SavedMeal = {
  id: string;
  /** When the plate was uploaded and analysed (UTC ISO 8601). */
  savedAt: string;
  /** A small copy of the photo that survives a restart: a data: URL on the web, a file in the app's documents on a phone. */
  photoUri: string;
  analysis: PlateAnalysis;
  /** How many photos the meal had (only the first is kept as the picture). */
  photoCount?: number;
  /** The language the AI wrote it in (missing on items saved before this was recorded). */
  language?: Language;
  /** Translations into the other language, made when the app was switched to it. */
  translations?: Partial<Record<Language, PlateAnalysis>>;
};

// Writes go one after another, so translations finishing together can't
// overwrite each other's read-modify-write.
let queue: Promise<unknown> = Promise.resolve();
function serial<R>(task: () => Promise<R>): Promise<R> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

// Kept on the device, per signed-in account and per person (self or a
// dependent's id) — same approach as BMI results and Body Metrics.
const key = (userId: string | null, personKey: string) => `vagewell.mealLibrary.${userId ?? "guest"}.${personKey}`;

// Oldest meals drop off past this, so device storage stays bounded (a browser
// allows only a few MB in total).
const MAX_MEALS = 40;
const WEB_THUMB_PX = 480;

export async function loadMeals(userId: string | null, personKey: string): Promise<SavedMeal[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, personKey));
    return raw ? (JSON.parse(raw) as SavedMeal[]) : [];
  } catch {
    return [];
  }
}

async function writeMeals(userId: string | null, personKey: string, meals: SavedMeal[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key(userId, personKey), JSON.stringify(meals));
    return true;
  } catch {
    return false;
  }
}

/**
 * Make a copy of the plate photo that outlives this session. The picker's own
 * URI doesn't: on the web it is a temporary blob/data URL, on a phone a cache
 * file the system may clear.
 */
async function keepPhoto(id: string, photoUri: string): Promise<string> {
  if (Platform.OS === "web") {
    // Shrink to a thumbnail-sized JPEG data URL.
    const g = globalThis as unknown as { document: Document; Image: new () => HTMLImageElement };
    const img = new g.Image();
    img.src = photoUri;
    await img.decode();
    const scale = Math.min(1, WEB_THUMB_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = g.document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  }
  const dir = `${FileSystem.documentDirectory}meals/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${id}.jpg`;
  await FileSystem.copyAsync({ from: photoUri, to: dest });
  return dest;
}

/** Add an analysed plate to the library (newest first). Returns the updated list, or null if it couldn't be stored. */
export async function saveMeal(
  userId: string | null,
  personKey: string,
  photoUri: string,
  analysis: PlateAnalysis,
  language: Language,
  photoCount = 1,
): Promise<SavedMeal[] | null> {
  const savedAt = new Date().toISOString();
  const id = savedAt.replace(/[^0-9]/g, "");
  let kept = photoUri;
  try {
    kept = await keepPhoto(id, photoUri);
  } catch {
    // Keep the meal even if its photo couldn't be copied; the picture may not show later.
  }
  return serial(async () => {
    const existing = await loadMeals(userId, personKey);
    const next: SavedMeal[] = [{ id, savedAt, photoUri: kept, analysis, language, photoCount }, ...existing];
    const dropped = next.splice(MAX_MEALS);
    if (!(await writeMeals(userId, personKey, next))) return null;
    for (const meal of dropped) void removePhoto(meal.photoUri);
    return next;
  });
}

/** Store a translation of one meal's result. Returns the updated list. */
export function addMealTranslation(
  userId: string | null,
  personKey: string,
  id: string,
  language: Language,
  translated: PlateAnalysis,
): Promise<SavedMeal[]> {
  return serial(async () => {
    const existing = await loadMeals(userId, personKey);
    const next = existing.map((m) => (m.id === id ? { ...m, translations: { ...m.translations, [language]: translated } } : m));
    await writeMeals(userId, personKey, next);
    return next;
  });
}

async function removePhoto(photoUri: string) {
  if (Platform.OS === "web" || !photoUri.startsWith("file:")) return;
  try {
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
  } catch {
    // best-effort
  }
}

/** Remove one meal. Returns the updated list. */
export function deleteMeal(userId: string | null, personKey: string, id: string): Promise<SavedMeal[]> {
  return serial(async () => {
    const existing = await loadMeals(userId, personKey);
    const gone = existing.find((m) => m.id === id);
    const next = existing.filter((m) => m.id !== id);
    await writeMeals(userId, personKey, next);
    if (gone) void removePhoto(gone.photoUri);
    return next;
  });
}
