import { Platform } from "react-native";
import type { Language } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { LabReport } from "@/lib/labReport";

/** One read lab report kept in the Report library. */
export type SavedReport = {
  id: string;
  /** When the report was added and read (UTC ISO 8601). */
  savedAt: string;
  /** A small copy of the report photo that survives a restart: a data: URL on the web, a file in the app's documents on a phone. */
  photoUri: string;
  result: LabReport;
  /** The language the AI wrote it in (missing on items saved before this was recorded). */
  language?: Language;
  /** Translations into the other language, made when the app was switched to it. */
  translations?: Partial<Record<Language, LabReport>>;
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
// dependent's id) — same approach as the Meal library (mealLibrary.ts).
const key = (userId: string | null, personKey: string) => `vagewell.reportLibrary.${userId ?? "guest"}.${personKey}`;

// Oldest reports drop off past this, so device storage stays bounded (a
// browser allows only a few MB in total, shared with the Meal library).
const MAX_REPORTS = 25;
const WEB_THUMB_PX = 400;

export async function loadReports(userId: string | null, personKey: string): Promise<SavedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, personKey));
    return raw ? (JSON.parse(raw) as SavedReport[]) : [];
  } catch {
    return [];
  }
}

async function writeReports(userId: string | null, personKey: string, reports: SavedReport[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key(userId, personKey), JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

/** Copy the report photo somewhere that outlives this session (the picker's own URI doesn't). */
async function keepPhoto(id: string, photoUri: string): Promise<string> {
  if (Platform.OS === "web") {
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
  const dir = `${FileSystem.documentDirectory}reports/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${id}.jpg`;
  await FileSystem.copyAsync({ from: photoUri, to: dest });
  return dest;
}

async function removePhoto(photoUri: string) {
  if (Platform.OS === "web" || !photoUri.startsWith("file:")) return;
  try {
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
  } catch {
    // best-effort
  }
}

/** Add a read report to the library (newest first). Returns the updated list, or null if it couldn't be stored. */
export async function saveReport(
  userId: string | null,
  personKey: string,
  photoUri: string,
  result: LabReport,
  language: Language,
): Promise<SavedReport[] | null> {
  const savedAt = new Date().toISOString();
  const id = savedAt.replace(/[^0-9]/g, "");
  let kept = photoUri;
  try {
    kept = await keepPhoto(id, photoUri);
  } catch {
    // Keep the report even if its photo couldn't be copied; the picture may not show later.
  }
  return serial(async () => {
    const existing = await loadReports(userId, personKey);
    const next: SavedReport[] = [{ id, savedAt, photoUri: kept, result, language }, ...existing];
    const dropped = next.splice(MAX_REPORTS);
    if (!(await writeReports(userId, personKey, next))) return null;
    for (const r of dropped) void removePhoto(r.photoUri);
    return next;
  });
}

/** Store a translation of one report. Returns the updated list. */
export function addReportTranslation(
  userId: string | null,
  personKey: string,
  id: string,
  language: Language,
  translated: LabReport,
): Promise<SavedReport[]> {
  return serial(async () => {
    const existing = await loadReports(userId, personKey);
    const next = existing.map((r) => (r.id === id ? { ...r, translations: { ...r.translations, [language]: translated } } : r));
    await writeReports(userId, personKey, next);
    return next;
  });
}

/** Remove one report. Returns the updated list. */
export function deleteReport(userId: string | null, personKey: string, id: string): Promise<SavedReport[]> {
  return serial(async () => {
    const existing = await loadReports(userId, personKey);
    const gone = existing.find((r) => r.id === id);
    const next = existing.filter((r) => r.id !== id);
    await writeReports(userId, personKey, next);
    if (gone) void removePhoto(gone.photoUri);
    return next;
  });
}
